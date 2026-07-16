import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockAgentService = vi.hoisted(() => ({
  list: vi.fn(),
  updateCompanyAgentConfigurationsIfIdle: vi.fn(),
}));
const mockAccessService = vi.hoisted(() => ({
  decide: vi.fn(),
  canUser: vi.fn(),
  hasPermission: vi.fn(),
}));
const mockSecretService = vi.hoisted(() => ({
  normalizeAdapterConfigForPersistence: vi.fn(
    async (_companyId: string, config: Record<string, unknown>) => config,
  ),
}));
const mockLogActivity = vi.hoisted(() => vi.fn());

vi.mock("../services/index.js", () => ({
  agentService: () => mockAgentService,
  agentInstructionsService: () => ({}),
  accessService: () => mockAccessService,
  approvalService: () => ({}),
  builtInAgentService: () => ({ ensureCompanyDefaultAgentGrants: vi.fn() }),
  companySkillService: () => ({ listRuntimeSkillEntries: vi.fn() }),
  budgetService: () => ({}),
  heartbeatService: () => ({ wakeup: vi.fn() }),
  issueApprovalService: () => ({}),
  issueRecoveryActionService: () => ({}),
  issueService: () => ({}),
  logActivity: mockLogActivity,
  secretService: () => mockSecretService,
  syncInstructionsBundleConfigFromFilePath: vi.fn((_agent, config) => config),
  workspaceOperationService: () => ({}),
}));

vi.mock("../services/secrets.js", () => ({
  secretService: () => mockSecretService,
}));

vi.mock("../services/instance-settings.js", () => ({
  instanceSettingsService: () => ({
    getGeneral: vi.fn(async () => ({ censorUsernameInLogs: false })),
  }),
  isTruthyRuntimeEnvValue: vi.fn(() => false),
  resolveWorktreeRunExecutionActivationState: vi.fn(),
}));

vi.mock("../services/recovery/service.js", () => ({
  recoveryService: () => ({}),
}));

const claudeAgent = {
  id: "11111111-1111-4111-8111-111111111111",
  companyId: "company-1",
  name: "Builder",
  status: "idle",
  adapterType: "claude_local",
  adapterConfig: {
    model: "claude-opus-4-8",
    effort: "high",
    cwd: "C:/workspace",
    env: { SHARED_FLAG: "1" },
    instructionsRootPath: "C:/instructions",
  },
  runtimeConfig: {
    heartbeat: { enabled: true, intervalSec: 300 },
    modelProfiles: {
      cheap: {
        enabled: true,
        label: "Cheap",
        adapterConfig: { model: "gpt-5.5", modelReasoningEffort: "low" },
      },
    },
  },
};

function createDb(activeRuns: Array<{ status: "queued" | "running" }>) {
  let selectCount = 0;
  return {
    select: vi.fn(() => {
      selectCount += 1;
      const rows = selectCount % 2 === 1 ? [{ id: "company-1" }] : activeRuns;
      const query = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn(async () => rows),
      };
      return query;
    }),
  };
}

async function createApp(activeRuns: Array<{ status: "queued" | "running" }> = []) {
  const [{ agentRoutes }, { errorHandler }] = await Promise.all([
    import("../routes/agents.js"),
    import("../middleware/index.js"),
  ]);
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).actor = {
      type: "board",
      userId: "local-board",
      companyIds: ["company-1"],
      source: "local_implicit",
      isInstanceAdmin: false,
    };
    next();
  });
  app.use("/api", agentRoutes(createDb(activeRuns) as any));
  app.use(errorHandler);
  return app;
}

describe("company model pit stop routes", () => {
  let companyAgents: Array<Record<string, unknown>>;

  beforeEach(() => {
    vi.clearAllMocks();
    companyAgents = [
      { ...claudeAgent },
      {
        ...claudeAgent,
        id: "22222222-2222-4222-8222-222222222222",
        name: "Pending",
        status: "pending_approval",
      },
      {
        ...claudeAgent,
        id: "33333333-3333-4333-8333-333333333333",
        name: "Gateway",
        adapterType: "openclaw_gateway",
      },
    ];
    mockAgentService.list.mockImplementation(async () => companyAgents);
    mockAgentService.updateCompanyAgentConfigurationsIfIdle.mockImplementation(
      async (_companyId: string, updates: Array<Record<string, unknown>>) => {
        companyAgents = companyAgents.map((agent) => {
          const update = updates.find((candidate) => candidate.id === agent.id);
          return update ? { ...agent, ...update } : agent;
        });
        return companyAgents;
      },
    );
    mockAccessService.decide.mockResolvedValue({
      allowed: true,
      reason: "allow_explicit_grant",
      explanation: "Allowed by test grant",
    });
    mockLogActivity.mockResolvedValue(undefined);
  });

  it("closes the pit lane while any company run is queued or running", async () => {
    const response = await request(await createApp([{ status: "queued" }, { status: "running" }]))
      .get("/api/companies/company-1/model-pit-stop");

    expect(response.status, JSON.stringify(response.body)).toBe(200);
    expect(response.body).toMatchObject({
      currentAdapterType: "claude_local",
      eligibleAgentCount: 1,
      excludedAgentCount: 2,
      activeRuns: { total: 2, queued: 1, running: 1 },
      canSwitch: false,
    });
    expect(response.body.providers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        adapterType: "claude_local",
        primaryModel: "claude-opus-4-8",
        cheapModel: "claude-sonnet-4-6",
      }),
      expect.objectContaining({
        adapterType: "codex_local",
        primaryModel: "gpt-5.6",
        cheapModel: "gpt-5.5",
      }),
    ]));
  }, 15_000);

  it("rejects a refit when a run is active", async () => {
    const response = await request(await createApp([{ status: "running" }]))
      .post("/api/companies/company-1/model-pit-stop")
      .send({ adapterType: "codex_local" });

    expect(response.status, JSON.stringify(response.body)).toBe(409);
    expect(response.body.error).toContain("Pit lane closed");
    expect(mockAgentService.updateCompanyAgentConfigurationsIfIdle).not.toHaveBeenCalled();
  });

  it("fits provider-correct primary and cheap models without waking agents", async () => {
    const response = await request(await createApp())
      .post("/api/companies/company-1/model-pit-stop")
      .send({ adapterType: "codex_local" });

    expect(response.status, JSON.stringify(response.body)).toBe(200);
    expect(response.body).toMatchObject({
      adapterType: "codex_local",
      changedAgentCount: 1,
      primaryModel: "gpt-5.6",
      cheapModel: "gpt-5.5",
      status: {
        currentAdapterType: "codex_local",
        eligibleAgentCount: 1,
        activeRuns: { total: 0 },
      },
    });

    const updates = mockAgentService.updateCompanyAgentConfigurationsIfIdle.mock.calls[0]?.[1];
    expect(updates).toHaveLength(1);
    expect(updates[0]).toMatchObject({
      id: claudeAgent.id,
      adapterType: "codex_local",
      adapterConfig: {
        model: "gpt-5.6",
        cwd: "C:/workspace",
        env: { SHARED_FLAG: "1" },
        instructionsRootPath: "C:/instructions",
      },
      runtimeConfig: {
        heartbeat: { enabled: true, intervalSec: 300 },
        modelProfiles: {
          cheap: {
            enabled: true,
            adapterConfig: {
              model: "gpt-5.5",
              modelReasoningEffort: "low",
            },
          },
        },
      },
    });
    expect(updates[0].adapterConfig).not.toHaveProperty("effort");
    expect(mockLogActivity).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      action: "company.model_pit_stop_completed",
      entityType: "company",
      entityId: "company-1",
    }));
  });
});
