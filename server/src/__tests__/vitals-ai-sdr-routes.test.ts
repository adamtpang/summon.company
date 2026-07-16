import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import express from "express";
import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  activityLog,
  companies,
  createDb,
  documents,
  documentRevisions,
  issueDocuments,
  issues,
  issueThreadInteractions,
  issueWorkProducts,
} from "@paperclipai/db";
import {
  getEmbeddedPostgresTestSupport,
  startEmbeddedPostgresTestDatabase,
} from "./helpers/embedded-postgres.js";
import { errorHandler } from "../middleware/error-handler.js";
import { vitalsAiSdrRoutes } from "../routes/vitals-ai-sdr.js";

const embeddedPostgresSupport = await getEmbeddedPostgresTestSupport();
const describeEmbeddedPostgres = embeddedPostgresSupport.supported ? describe.sequential : describe.skip;

if (!embeddedPostgresSupport.supported) {
  console.warn(
    `Skipping embedded Postgres Vitals AI SDR route tests on this host: ${embeddedPostgresSupport.reason ?? "unsupported environment"}`,
  );
}

describeEmbeddedPostgres("Vitals AI SDR routes", () => {
  let db!: ReturnType<typeof createDb>;
  let tempDb: Awaited<ReturnType<typeof startEmbeddedPostgresTestDatabase>> | null = null;

  const boardActor: Express.Request["actor"] = {
    type: "board",
    userId: "local-board",
    source: "local_implicit",
    isInstanceAdmin: true,
  };

  beforeAll(async () => {
    tempDb = await startEmbeddedPostgresTestDatabase("paperclip-vitals-ai-sdr-routes-");
    db = createDb(tempDb.connectionString);
  }, 20_000);

  afterEach(async () => {
    await db.delete(issueThreadInteractions);
    await db.delete(issueWorkProducts);
    await db.delete(issueDocuments);
    await db.delete(documentRevisions);
    await db.delete(documents);
    await db.delete(activityLog);
    await db.delete(issues);
    await db.delete(companies);
  });

  afterAll(async () => {
    await tempDb?.cleanup();
  });

  function app(actor: Express.Request["actor"] = boardActor) {
    const instance = express();
    instance.use(express.json());
    instance.use((req, _res, next) => {
      req.actor = actor;
      next();
    });
    instance.use("/api", vitalsAiSdrRoutes(db));
    instance.use(errorHandler);
    return instance;
  }

  async function seedCompany(name = "Company Zero") {
    const [company] = await db.insert(companies).values({
      name,
      issuePrefix: `V${randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase()}`,
    }).returning();
    return company!;
  }

  async function seedIssue(companyId: string) {
    const [issue] = await db.insert(issues).values({
      companyId,
      title: "Build the local AI SDR intake-to-draft dogfood loop",
      status: "in_progress",
      priority: "high",
      identifier: `VIT-${randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase()}`,
    }).returning();
    return issue!;
  }

  it("generates local-only dossiers, drafts, approval interaction, work products, and measurement activity", async () => {
    const company = await seedCompany();
    const issue = await seedIssue(company.id);
    const http = request(app());

    const fixtures = await http
      .get(`/api/companies/${company.id}/vitals/ai-sdr/local-fixtures`)
      .expect(200);
    expect(fixtures.body.leadSourceKind).toBe("local_fixture");
    expect(fixtures.body.downstreamBlocks.map((block: { stageKey: string }) => block.stageKey)).toContain("outbound");

    const res = await http
      .post(`/api/companies/${company.id}/vitals/ai-sdr/local-dogfood`)
      .send({
        issueId: issue.id,
        intake: {
          companyUrl: "https://vitals.run",
          icp: "Founder-led B2B software companies preparing their first outbound workflow",
          senderIdentity: "Adam from vitals.run",
          objective: "book a short diagnosis call around a board-approved AI SDR loop",
          bannedClaims: ["guaranteed meetings", "inbox placement"],
          geography: "United States",
          maxDraftCount: 1,
          notes: "Dogfood inside Paperclip only.",
        },
      })
      .expect(201);

    expect(res.body.bundle.leadSourcePlan.kind).toBe("local_fixture");
    expect(res.body.bundle.dossiers[0].citations[0].source).toContain("Local sample fixture");
    expect(res.body.bundle.drafts[0].body).toContain("[F1]");
    expect(res.body.bundle.drafts[0].approvalStatus).toBe("pending_board_approval");
    expect(res.body.bundle.downstreamBlocks.every((block: { status: string }) => block.status === "blocked")).toBe(true);
    expect(res.body.documents.drafts.body).toContain("Every draft is pending board approval");
    expect(res.body.interaction.kind).toBe("request_item_verdicts");
    expect(res.body.interaction.status).toBe("pending");

    const documentLinks = await db
      .select()
      .from(issueDocuments)
      .where(eq(issueDocuments.issueId, issue.id));
    expect(documentLinks.map((row) => row.key).sort()).toEqual([
      "ai-sdr-dossiers",
      "ai-sdr-drafts",
      "ai-sdr-intake",
      "ai-sdr-measurements",
    ]);

    const products = await db
      .select()
      .from(issueWorkProducts)
      .where(eq(issueWorkProducts.issueId, issue.id));
    expect(products).toHaveLength(2);
    expect(products.map((product) => product.provider)).toEqual([
      "vitals-local-ai-sdr",
      "vitals-local-ai-sdr",
    ]);
    expect(products.every((product) => product.reviewState === "needs_board_review")).toBe(true);

    const interactions = await db
      .select()
      .from(issueThreadInteractions)
      .where(eq(issueThreadInteractions.issueId, issue.id));
    expect(interactions).toHaveLength(1);
    expect(interactions[0]?.kind).toBe("request_item_verdicts");
    expect(interactions[0]?.payload).toMatchObject({
      version: 1,
      prompt: "Approve, reject, or defer each local AI SDR draft.",
    });

    const activities = await db
      .select()
      .from(activityLog)
      .where(eq(activityLog.entityId, issue.id));
    expect(activities.map((activity) => activity.action)).toEqual(expect.arrayContaining([
      "vitals.ai_sdr.intake_submitted",
      "vitals.ai_sdr.dossier_created",
      "vitals.ai_sdr.draft_created",
      "vitals.ai_sdr.approval_requested",
      "vitals.ai_sdr.outbound_blocked",
      "vitals.ai_sdr.sync_proposed",
      "vitals.ai_sdr.local_dogfood_generated",
    ]));
  });

  it("rejects dogfood writes when the issue belongs to another company", async () => {
    const company = await seedCompany("Primary");
    const otherCompany = await seedCompany("Other");
    const otherIssue = await seedIssue(otherCompany.id);

    await request(app())
      .post(`/api/companies/${company.id}/vitals/ai-sdr/local-dogfood`)
      .send({
        issueId: otherIssue.id,
        intake: {
          companyUrl: "https://vitals.run",
          icp: "Founder-led B2B software companies preparing their first outbound workflow",
          senderIdentity: "Adam from vitals.run",
          objective: "book a short diagnosis call",
          geography: "United States",
          maxDraftCount: 1,
        },
      })
      .expect(404);
  });
});
