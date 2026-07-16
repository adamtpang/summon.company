import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import {
  agentConfigRevisions,
  agents,
  companies,
  createDb,
  heartbeatRuns,
} from "@paperclipai/db";
import {
  getEmbeddedPostgresTestSupport,
  startEmbeddedPostgresTestDatabase,
} from "./helpers/embedded-postgres.js";
import { agentService } from "../services/agents.ts";

const embeddedPostgresSupport = await getEmbeddedPostgresTestSupport().catch((error: unknown) => ({
  supported: false as const,
  reason: error instanceof Error ? error.message : String(error),
}));
const describeEmbeddedPostgres = embeddedPostgresSupport.supported ? describe : describe.skip;

if (!embeddedPostgresSupport.supported) {
  console.warn(
    `Skipping embedded Postgres model pit-stop tests on this host: ${embeddedPostgresSupport.reason ?? "unsupported environment"}`,
  );
}

describeEmbeddedPostgres("company model pit stop service", () => {
  let db!: ReturnType<typeof createDb>;
  let tempDb: Awaited<ReturnType<typeof startEmbeddedPostgresTestDatabase>> | null = null;

  beforeAll(async () => {
    tempDb = await startEmbeddedPostgresTestDatabase("paperclip-model-pit-stop-");
    db = createDb(tempDb.connectionString);
  }, 60_000);

  afterEach(async () => {
    await db.delete(agentConfigRevisions);
    await db.delete(heartbeatRuns);
    await db.delete(agents);
    await db.delete(companies);
  });

  afterAll(async () => {
    await tempDb?.cleanup();
  });

  async function seedCompanyAndAgent() {
    const companyId = randomUUID();
    await db.insert(companies).values({
      id: companyId,
      name: "Summon",
      issuePrefix: `T${companyId.replace(/-/g, "").slice(0, 6).toUpperCase()}`,
      requireBoardApprovalForNewAgents: false,
    });
    const agent = await agentService(db).create(companyId, {
      name: "Builder",
      role: "engineer",
      status: "idle",
      adapterType: "claude_local",
      adapterConfig: { model: "claude-opus-4-8", cwd: "C:/workspace" },
      runtimeConfig: {
        modelProfiles: {
          cheap: {
            enabled: true,
            adapterConfig: { model: "claude-sonnet-4-6", effort: "low" },
          },
        },
      },
      spentMonthlyCents: 0,
      lastHeartbeatAt: null,
    });
    return { companyId, agent };
  }

  it("rolls back without changing configuration when a run is queued", async () => {
    const { companyId, agent } = await seedCompanyAndAgent();
    await db.insert(heartbeatRuns).values({
      companyId,
      agentId: agent.id,
      status: "queued",
    });

    const service = agentService(db);
    await expect(service.updateCompanyAgentConfigurationsIfIdle(companyId, [{
      id: agent.id,
      adapterType: "codex_local",
      adapterConfig: { model: "gpt-5.6", cwd: "C:/workspace" },
      runtimeConfig: {
        modelProfiles: {
          cheap: {
            enabled: true,
            adapterConfig: { model: "gpt-5.5", modelReasoningEffort: "low" },
          },
        },
      },
    }], {
      createdByUserId: "board-user",
      source: "company_model_pit_stop",
    })).rejects.toMatchObject({
      status: 409,
      details: {
        code: "company_model_pit_stop_active_runs",
        activeRunCount: 1,
        queuedRunCount: 1,
        runningRunCount: 0,
      },
    });

    await expect(service.getById(agent.id)).resolves.toMatchObject({
      adapterType: "claude_local",
      adapterConfig: expect.objectContaining({ model: "claude-opus-4-8" }),
    });
    await expect(db.select().from(agentConfigRevisions)).resolves.toHaveLength(0);
  });

  it("updates the fleet and records reversible per-agent revisions", async () => {
    const { companyId, agent } = await seedCompanyAndAgent();
    const service = agentService(db);

    const updated = await service.updateCompanyAgentConfigurationsIfIdle(companyId, [{
      id: agent.id,
      adapterType: "codex_local",
      adapterConfig: { model: "gpt-5.6", cwd: "C:/workspace" },
      runtimeConfig: {
        modelProfiles: {
          cheap: {
            enabled: true,
            adapterConfig: { model: "gpt-5.5", modelReasoningEffort: "low" },
          },
        },
      },
    }], {
      createdByUserId: "board-user",
      source: "company_model_pit_stop",
    });

    expect(updated).toHaveLength(1);
    expect(updated[0]).toMatchObject({
      adapterType: "codex_local",
      adapterConfig: { model: "gpt-5.6", cwd: "C:/workspace" },
      runtimeConfig: {
        modelProfiles: {
          cheap: {
            enabled: true,
            adapterConfig: { model: "gpt-5.5", modelReasoningEffort: "low" },
          },
        },
      },
    });

    const revisions = await db
      .select()
      .from(agentConfigRevisions)
      .where(eq(agentConfigRevisions.agentId, agent.id));
    expect(revisions).toHaveLength(1);
    expect(revisions[0]).toMatchObject({
      companyId,
      agentId: agent.id,
      createdByUserId: "board-user",
      source: "company_model_pit_stop",
      changedKeys: expect.arrayContaining(["adapterType", "adapterConfig", "runtimeConfig"]),
    });
  });
});
