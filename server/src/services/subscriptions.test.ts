import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import {
  companies,
  companySubscriptions,
  createDb,
  outcomeCommissions,
  pricingPlans,
  subscriptionUsageRecords,
} from "@paperclipai/db";
import {
  getEmbeddedPostgresTestSupport,
  startEmbeddedPostgresTestDatabase,
} from "../__tests__/helpers/embedded-postgres.js";
import { subscriptionService } from "./subscriptions.js";

/**
 * VIT-5 billing layer — recordUsage's spend-cap hard-stop, exercised against a
 * real database. The cap check must survive concurrent usage recordings for
 * the same subscription without letting accrued spend run past the cap.
 */

const embeddedPostgresSupport = await getEmbeddedPostgresTestSupport();
const describeEmbeddedPostgres = embeddedPostgresSupport.supported ? describe : describe.skip;

if (!embeddedPostgresSupport.supported) {
  console.warn(
    `Skipping embedded Postgres subscriptions tests on this host: ${embeddedPostgresSupport.reason ?? "unsupported environment"}`,
  );
}

describeEmbeddedPostgres("subscriptionService.recordUsage", () => {
  let stopDb: (() => Promise<void>) | null = null;
  let db!: ReturnType<typeof createDb>;

  beforeAll(async () => {
    const started = await startEmbeddedPostgresTestDatabase("subscriptions");
    stopDb = started.cleanup;
    db = createDb(started.connectionString);
  }, 60_000);

  afterEach(async () => {
    await db.delete(subscriptionUsageRecords);
    await db.delete(outcomeCommissions);
    await db.delete(companySubscriptions);
    await db.delete(pricingPlans);
    await db.delete(companies);
  });

  afterAll(async () => {
    await stopDb?.();
  });

  async function seedCompanyWithCappedSubscription(capCents: number) {
    const companyId = randomUUID();
    await db.insert(companies).values({
      id: companyId,
      name: "Test Co",
      issuePrefix: `T${companyId.replace(/-/g, "").slice(0, 6).toUpperCase()}`,
      requireBoardApprovalForNewAgents: false,
    });

    const [plan] = await db
      .insert(pricingPlans)
      .values({
        companyId,
        key: "starter",
        name: "Starter",
        basePriceCents: 0,
        bundledUsageCents: 0,
        overageMarkupBps: 0,
      })
      .returning();

    const now = new Date();
    const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const periodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    const [sub] = await db
      .insert(companySubscriptions)
      .values({
        companyId,
        planId: plan.id,
        status: "active",
        capCents,
        hardStopEnabled: true,
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
      })
      .returning();

    return { companyId, plan, sub };
  }

  it("hard-stops on the first recordUsage call that alone crosses the cap", async () => {
    const cancelWorkForScope = vi.fn(async () => undefined);
    const { companyId } = await seedCompanyWithCappedSubscription(100);
    const service = subscriptionService(db, { cancelWorkForScope });

    const first = await service.recordUsage(companyId, { cogsCents: 40 });
    expect(first.capHit).toBe(false);

    const second = await service.recordUsage(companyId, { cogsCents: 70 });
    expect(second.capHit).toBe(true);
    expect(cancelWorkForScope).toHaveBeenCalledTimes(1);

    const [company] = await db.select().from(companies).where(eq(companies.id, companyId));
    expect(company.status).toBe("paused");
    expect(company.pauseReason).toBe("budget");
  });

  it("does not let concurrent recordUsage calls jointly overrun the cap unpaused", async () => {
    // Each call alone stays under the 100-cent cap; only their SUM crosses it.
    // Without the transactional row lock, both could read spend-under-cap
    // before either's insert becomes visible to the other, and neither would
    // trigger the pause.
    const cancelWorkForScope = vi.fn(async () => undefined);
    const { companyId } = await seedCompanyWithCappedSubscription(100);
    const service = subscriptionService(db, { cancelWorkForScope });

    const [a, b] = await Promise.all([
      service.recordUsage(companyId, { cogsCents: 60 }),
      service.recordUsage(companyId, { cogsCents: 60 }),
    ]);

    // Both usage records land - recording usage itself is never rejected.
    const records = await db
      .select()
      .from(subscriptionUsageRecords)
      .where(eq(subscriptionUsageRecords.companyId, companyId));
    expect(records).toHaveLength(2);

    // Combined spend (120) is over the 100-cent cap, so exactly one call must
    // have observed that and paused the company - never zero.
    expect([a.capHit, b.capHit].filter(Boolean)).toHaveLength(1);
    expect(cancelWorkForScope).toHaveBeenCalledTimes(1);

    const [company] = await db.select().from(companies).where(eq(companies.id, companyId));
    expect(company.status).toBe("paused");
  });
});
