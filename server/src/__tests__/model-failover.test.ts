import { describe, expect, it } from "vitest";
import type { Db } from "@paperclipai/db";
import type { ProviderQuotaResult } from "@paperclipai/shared";
import {
  consultModelChainFallbackPolicy,
  resolveAgentModelFailoverForRun,
  type ModelFailoverAgentLike,
} from "../services/model-failover.ts";

const db = {} as Db;

const CODEX_EXHAUSTED_SNAPSHOT = {
  fetchedAt: Date.parse("2026-07-15T12:00:00.000Z"),
  results: [
    {
      provider: "openai",
      ok: true,
      windows: [
        { label: "1w", usedPercent: 100, resetsAt: "2026-07-22T07:00:00.000Z", valueLabel: null },
      ],
    },
    {
      provider: "anthropic",
      ok: true,
      windows: [
        { label: "7d", usedPercent: 40, resetsAt: "2026-07-20T00:00:00.000Z", valueLabel: null },
      ],
    },
  ] as ProviderQuotaResult[],
};

const ALL_HEALTHY_SNAPSHOT = {
  fetchedAt: Date.parse("2026-07-22T08:00:00.000Z"),
  results: [
    { provider: "openai", ok: true, windows: [{ label: "1w", usedPercent: 5, resetsAt: null, valueLabel: null }] },
    { provider: "anthropic", ok: true, windows: [{ label: "7d", usedPercent: 40, resetsAt: null, valueLabel: null }] },
  ] as ProviderQuotaResult[],
};

function makeAgent(overrides?: Partial<ModelFailoverAgentLike>): ModelFailoverAgentLike {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    companyId: "22222222-2222-4222-8222-222222222222",
    name: "Vitals Engineer",
    adapterType: "codex_local",
    adapterConfig: { model: "gpt-5.5", env: { FOO: "bar" } },
    runtimeConfig: {
      modelChain: {
        fallbacks: [{ adapterType: "claude_local", adapterConfig: { model: "claude-fable-5" } }],
      },
    },
    metadata: null,
    ...overrides,
  };
}

function captureDeps() {
  const events: Array<{ action: string; details: Record<string, unknown> }> = [];
  const persisted: Record<string, unknown>[] = [];
  return {
    events,
    persisted,
    deps: {
      logEvent: async (event: { action: string; details: Record<string, unknown> }) => {
        events.push(event);
      },
      persistMetadata: async (metadata: Record<string, unknown>) => {
        persisted.push(metadata);
      },
      companyDefaultChain: null,
      now: new Date("2026-07-15T12:05:00.000Z"),
    },
  };
}

describe("resolveAgentModelFailoverForRun — the 2026-07-15 incident, end to end at the run seam", () => {
  it("fails over a codex-primary agent to its claude fallback, logs the event, persists state", async () => {
    const { events, persisted, deps } = captureDeps();
    const resolution = await resolveAgentModelFailoverForRun({
      db,
      agent: makeAgent(),
      runId: "33333333-3333-4333-8333-333333333333",
      deps: { ...deps, quotaSnapshot: CODEX_EXHAUSTED_SNAPSHOT },
    });

    expect(resolution.applied).toBe(true);
    expect(resolution.agent.adapterType).toBe("claude_local");
    // fallback model applies; adapter-agnostic env survives; codex model doesn't leak
    expect(resolution.agent.adapterConfig).toEqual({ model: "claude-fable-5", env: { FOO: "bar" } });
    expect(resolution.message).toContain("Vitals Engineer fell back to Claude (claude_local)");
    expect(resolution.message).toContain("resets Jul 22");
    expect(events).toHaveLength(1);
    expect(events[0]!.action).toBe("agent.model_failover");
    expect(events[0]!.details).toMatchObject({
      trigger: "quota_exhausted",
      chainIndex: 1,
      resetsAt: "2026-07-22T07:00:00.000Z",
      chainSource: "agent",
    });
    expect(persisted).toHaveLength(1);
    expect(persisted[0]!.modelFailover).toMatchObject({ activeIndex: 1, adapterType: "claude_local" });
    expect(resolution.contextMetadata).toMatchObject({ shift: "failover", chainIndex: 1 });
  });

  it("holds on the same fallback on subsequent runs without duplicate events", async () => {
    const { events, persisted, deps } = captureDeps();
    const resolution = await resolveAgentModelFailoverForRun({
      db,
      agent: makeAgent({
        metadata: {
          modelFailover: {
            activeIndex: 1,
            adapterType: "claude_local",
            trigger: "quota_exhausted",
            since: "2026-07-15T12:05:00.000Z",
            resetsAt: "2026-07-22T07:00:00.000Z",
          },
        },
      }),
      runId: null,
      deps: { ...deps, quotaSnapshot: CODEX_EXHAUSTED_SNAPSHOT },
    });
    expect(resolution.applied).toBe(true);
    expect(resolution.agent.adapterType).toBe("claude_local");
    expect(events).toHaveLength(0);
    expect(persisted).toHaveLength(0);
  });

  it("fails back up to the primary when the quota window resets, clearing state", async () => {
    const { events, persisted, deps } = captureDeps();
    const resolution = await resolveAgentModelFailoverForRun({
      db,
      agent: makeAgent({
        metadata: {
          keepMe: true,
          modelFailover: {
            activeIndex: 1,
            adapterType: "claude_local",
            trigger: "quota_exhausted",
            since: "2026-07-15T12:05:00.000Z",
            resetsAt: "2026-07-22T07:00:00.000Z",
          },
        },
      }),
      runId: null,
      deps: { ...deps, quotaSnapshot: ALL_HEALTHY_SNAPSHOT },
    });
    expect(resolution.applied).toBe(false);
    expect(resolution.agent.adapterType).toBe("codex_local");
    expect(events).toHaveLength(1);
    expect(events[0]!.action).toBe("agent.model_failback");
    expect(persisted).toHaveLength(1);
    expect(persisted[0]!.modelFailover).toBeUndefined();
    expect(persisted[0]!.keepMe).toBe(true);
    expect(resolution.message).toContain("restored to primary Codex (codex_local)");
  });

  it("pinned employees never fail over; the unavailable event fires once per window", async () => {
    const { events, deps } = captureDeps();
    const pinnedAgent = makeAgent({
      runtimeConfig: {
        modelChain: {
          fallbacks: [{ adapterType: "claude_local" }],
          pinned: true,
        },
      },
    });
    const first = await resolveAgentModelFailoverForRun({
      db,
      agent: pinnedAgent,
      runId: null,
      deps: { ...deps, quotaSnapshot: CODEX_EXHAUSTED_SNAPSHOT },
    });
    expect(first.applied).toBe(false);
    expect(first.agent.adapterType).toBe("codex_local");
    expect(events).toHaveLength(1);
    expect(events[0]!.action).toBe("agent.model_fallback_unavailable");

    // second run in the same blocked window: dedup, no second event
    const dedupKey = "pinned_unavailable:quota_exhausted:2026-07-22T07:00:00.000Z";
    const second = await resolveAgentModelFailoverForRun({
      db,
      agent: makeAgent({
        runtimeConfig: pinnedAgent.runtimeConfig,
        metadata: {
          modelFailover: {
            activeIndex: 0,
            adapterType: "codex_local",
            trigger: "quota_exhausted",
            since: "2026-07-15T12:05:00.000Z",
            resetsAt: "2026-07-22T07:00:00.000Z",
            lastUnavailableKey: dedupKey,
          },
        },
      }),
      runId: null,
      deps: { ...deps, quotaSnapshot: CODEX_EXHAUSTED_SNAPSHOT },
    });
    expect(second.applied).toBe(false);
    expect(events).toHaveLength(1);
  });

  it("uses the company default chain when the agent has none configured", async () => {
    const { events, deps } = captureDeps();
    const resolution = await resolveAgentModelFailoverForRun({
      db,
      agent: makeAgent({ runtimeConfig: {} }),
      runId: null,
      deps: {
        ...deps,
        quotaSnapshot: CODEX_EXHAUSTED_SNAPSHOT,
        companyDefaultChain: {
          fallbacks: [{ adapterType: "claude_local", adapterConfig: { model: "claude-haiku-4-5-20251001" } }],
        },
      },
    });
    expect(resolution.applied).toBe(true);
    expect(resolution.agent.adapterType).toBe("claude_local");
    expect(resolution.chainSource).toBe("company_default");
    expect(events[0]!.details.chainSource).toBe("company_default");
  });

  it("returns the agent unchanged when no chain exists anywhere (status quo)", async () => {
    const { events, persisted, deps } = captureDeps();
    const agent = makeAgent({ runtimeConfig: {} });
    const resolution = await resolveAgentModelFailoverForRun({
      db,
      agent,
      runId: null,
      deps: { ...deps, quotaSnapshot: CODEX_EXHAUSTED_SNAPSHOT, companyDefaultChain: null },
    });
    expect(resolution.agent).toBe(agent);
    expect(resolution.applied).toBe(false);
    expect(events).toHaveLength(0);
    expect(persisted).toHaveLength(0);
  });

  it("never lets an internal failure kill the run — falls back to the primary adapter", async () => {
    const resolution = await resolveAgentModelFailoverForRun({
      db,
      agent: makeAgent(),
      runId: null,
      deps: {
        quotaSnapshot: CODEX_EXHAUSTED_SNAPSHOT,
        companyDefaultChain: null,
        logEvent: async () => {
          throw new Error("activity log unavailable");
        },
        persistMetadata: async () => {
          throw new Error("db write failed");
        },
      },
    });
    expect(resolution.applied).toBe(false);
    expect(resolution.agent.adapterType).toBe("codex_local");
  });
});

describe("consultModelChainFallbackPolicy — the VIT-64 hook", () => {
  it("reports a fallback available while the chain has a healthy entry", async () => {
    const result = await consultModelChainFallbackPolicy({
      db,
      agent: makeAgent(),
      quotaSnapshot: CODEX_EXHAUSTED_SNAPSHOT,
    });
    expect(result.hasFallbackAvailable).toBe(true);
    expect(result.selection.adapterType).toBe("claude_local");
  });

  it("reports no fallback with the earliest reset timestamp when everything is down", async () => {
    const result = await consultModelChainFallbackPolicy({
      db,
      agent: makeAgent(),
      quotaSnapshot: {
        fetchedAt: Date.parse("2026-07-15T12:00:00.000Z"),
        results: [
          {
            provider: "openai",
            ok: true,
            windows: [{ label: "1w", usedPercent: 100, resetsAt: "2026-07-22T07:00:00.000Z", valueLabel: null }],
          },
          {
            provider: "anthropic",
            ok: true,
            windows: [{ label: "7d", usedPercent: 100, resetsAt: "2026-07-18T00:00:00.000Z", valueLabel: null }],
          },
        ],
      },
    });
    expect(result.hasFallbackAvailable).toBe(false);
    expect(result.resetsAt).toBe("2026-07-18T00:00:00.000Z");
  });
});
