import { describe, expect, it } from "vitest";
import type { ProviderQuotaResult } from "./types/quota.js";
import {
  FAILOVER_TRIGGERS,
  classifyProviderProbeError,
  describeModelChainShift,
  evaluateProviderFailoverHealth,
  mergeFallbackAdapterConfig,
  modelChainConfigSchema,
  readAgentModelChain,
  readModelFailoverState,
  resolveModelChainSelection,
} from "./model-chain.js";

const CODEX_EXHAUSTED: ProviderQuotaResult = {
  provider: "openai",
  ok: true,
  windows: [
    { label: "5h", usedPercent: 100, resetsAt: "2026-07-15T21:00:00.000Z", valueLabel: null },
    { label: "1w", usedPercent: 100, resetsAt: "2026-07-22T07:00:00.000Z", valueLabel: null },
  ],
};

const CODEX_HEALTHY: ProviderQuotaResult = {
  provider: "openai",
  ok: true,
  windows: [
    { label: "5h", usedPercent: 12, resetsAt: "2026-07-22T12:00:00.000Z", valueLabel: null },
    { label: "1w", usedPercent: 3, resetsAt: "2026-07-29T07:00:00.000Z", valueLabel: null },
  ],
};

const CLAUDE_HEALTHY: ProviderQuotaResult = {
  provider: "anthropic",
  ok: true,
  windows: [
    { label: "5h", usedPercent: 40, resetsAt: "2026-07-15T20:00:00.000Z", valueLabel: null },
    { label: "7d", usedPercent: 55, resetsAt: "2026-07-20T00:00:00.000Z", valueLabel: null },
  ],
};

const CHAIN = modelChainConfigSchema.parse({
  fallbacks: [
    { adapterType: "claude_local", adapterConfig: { model: "claude-fable-5" }, label: "Claude fallback" },
    { adapterType: "claude_local", adapterConfig: { model: "claude-haiku-4-5-20251001" } },
  ],
});

describe("failover triggers", () => {
  it("contains only the four board-approved triggers — content refusal is structurally impossible", () => {
    expect([...FAILOVER_TRIGGERS]).toEqual([
      "quota_exhausted",
      "auth_failure",
      "provider_outage",
      "cost_limit",
    ]);
  });

  it("classifies auth errors and outages, and refuses to classify ambiguity", () => {
    expect(classifyProviderProbeError("codex CLI not logged in: unauthorized (401)")).toBe("auth_failure");
    expect(classifyProviderProbeError("quota polling timed out after 20s")).toBe("provider_outage");
    expect(classifyProviderProbeError("ECONNREFUSED 127.0.0.1:443")).toBe("provider_outage");
    // refusal-shaped or unknown errors never trigger a failover
    expect(classifyProviderProbeError("the model declined to answer this request")).toBeNull();
    expect(classifyProviderProbeError("some novel parse error")).toBeNull();
    expect(classifyProviderProbeError(null)).toBeNull();
  });
});

describe("provider health from the VIT-48 quota snapshot", () => {
  it("marks a provider exhausted when any window hits 100%, usable at the LAST reset", () => {
    const health = evaluateProviderFailoverHealth([CODEX_EXHAUSTED, CLAUDE_HEALTHY]);
    expect(health.openai).toMatchObject({
      available: false,
      trigger: "quota_exhausted",
      resetsAt: "2026-07-22T07:00:00.000Z",
    });
    expect(health.anthropic).toMatchObject({ available: true, trigger: null });
  });

  it("treats missing providers and unknown probe errors as available (never fail over blind)", () => {
    const health = evaluateProviderFailoverHealth([
      { provider: "openai", ok: false, error: "novel unclassifiable failure", windows: [] },
    ]);
    expect(health.openai?.available).toBe(true);
    expect(health.anthropic).toBeUndefined();
  });

  it("flags cost-limit pressure as its own trigger without overriding quota exhaustion", () => {
    const health = evaluateProviderFailoverHealth([CODEX_EXHAUSTED], {
      costLimitLowProviders: ["openai", "anthropic"],
    });
    expect(health.openai?.trigger).toBe("quota_exhausted");
    expect(health.anthropic?.trigger).toBe("cost_limit");
  });
});

describe("chain selection — the 2026-07-15 incident as regression", () => {
  it("DOWN-SHIFT: codex primary exhausted (weekly limit to Jul 22) auto-continues on the claude fallback", () => {
    const selection = resolveModelChainSelection({
      primaryAdapterType: "codex_local",
      chain: CHAIN,
      health: evaluateProviderFailoverHealth([CODEX_EXHAUSTED, CLAUDE_HEALTHY]),
      previousActiveIndex: 0,
    });
    expect(selection).toMatchObject({
      index: 1,
      adapterType: "claude_local",
      shift: "failover",
      trigger: "quota_exhausted",
      resetsAt: "2026-07-22T07:00:00.000Z",
    });
    expect(selection.entry?.adapterConfig).toEqual({ model: "claude-fable-5" });
    const message = describeModelChainShift({
      agentName: "Vitals Engineer",
      primaryAdapterType: "codex_local",
      selection,
    });
    expect(message).toContain("Vitals Engineer fell back to Claude (claude_local)");
    expect(message).toContain("resets Jul 22");
  });

  it("HOLD: while the primary stays exhausted, later runs stay on the same fallback with no new event", () => {
    const selection = resolveModelChainSelection({
      primaryAdapterType: "codex_local",
      chain: CHAIN,
      health: evaluateProviderFailoverHealth([CODEX_EXHAUSTED, CLAUDE_HEALTHY]),
      previousActiveIndex: 1,
    });
    expect(selection.shift).toBe("hold");
    expect(selection.index).toBe(1);
  });

  it("UP-SHIFT: when the codex window resets, the next run auto-restores the primary", () => {
    const selection = resolveModelChainSelection({
      primaryAdapterType: "codex_local",
      chain: CHAIN,
      health: evaluateProviderFailoverHealth([CODEX_HEALTHY, CLAUDE_HEALTHY]),
      previousActiveIndex: 1,
    });
    expect(selection).toMatchObject({ index: 0, adapterType: "codex_local", shift: "failback" });
    expect(
      describeModelChainShift({
        agentName: "Vitals Engineer",
        primaryAdapterType: "codex_local",
        selection,
      }),
    ).toContain("restored to primary Codex (codex_local)");
  });
});

describe("chain selection — governance and edges", () => {
  it("pinned employees never fail over, even with the primary exhausted", () => {
    const selection = resolveModelChainSelection({
      primaryAdapterType: "codex_local",
      chain: { ...CHAIN, pinned: true },
      health: evaluateProviderFailoverHealth([CODEX_EXHAUSTED, CLAUDE_HEALTHY]),
    });
    expect(selection).toMatchObject({
      index: 0,
      adapterType: "codex_local",
      shift: "pinned_unavailable",
      trigger: "quota_exhausted",
    });
  });

  it("skips an unhealthy fallback and lands on the next one", () => {
    const health = evaluateProviderFailoverHealth([
      CODEX_EXHAUSTED,
      { provider: "anthropic", ok: false, error: "unauthorized: token expired", windows: [] },
    ]);
    const selection = resolveModelChainSelection({
      primaryAdapterType: "codex_local",
      chain: modelChainConfigSchema.parse({
        fallbacks: [
          { adapterType: "claude_local" },
          { adapterType: "opencode_local" },
        ],
      }),
      health,
    });
    expect(selection).toMatchObject({ index: 2, adapterType: "opencode_local", shift: "failover" });
    expect(selection.blocked.map((b) => b.trigger)).toEqual(["quota_exhausted", "auth_failure"]);
  });

  it("reports exhausted_no_fallback with the EARLIEST reset when every entry is down (VIT-64 hook)", () => {
    const health = evaluateProviderFailoverHealth([
      CODEX_EXHAUSTED,
      {
        provider: "anthropic",
        ok: true,
        windows: [{ label: "7d", usedPercent: 100, resetsAt: "2026-07-18T00:00:00.000Z", valueLabel: null }],
      },
    ]);
    const selection = resolveModelChainSelection({
      primaryAdapterType: "codex_local",
      chain: modelChainConfigSchema.parse({ fallbacks: [{ adapterType: "claude_local" }] }),
      health,
    });
    expect(selection).toMatchObject({
      index: 0,
      shift: "exhausted_no_fallback",
      resetsAt: "2026-07-18T00:00:00.000Z",
    });
  });

  it("without a chain, an exhausted primary is exhausted_no_fallback (status quo preserved)", () => {
    const selection = resolveModelChainSelection({
      primaryAdapterType: "codex_local",
      chain: null,
      health: evaluateProviderFailoverHealth([CODEX_EXHAUSTED]),
    });
    expect(selection).toMatchObject({ index: 0, shift: "exhausted_no_fallback" });
  });

  it("with no health signal at all, the primary is used untouched", () => {
    const selection = resolveModelChainSelection({
      primaryAdapterType: "codex_local",
      chain: CHAIN,
      health: null,
    });
    expect(selection).toMatchObject({ index: 0, shift: "none", trigger: null });
  });
});

describe("fallback adapter config merge", () => {
  it("inherits adapter-agnostic keys from the primary and keeps entry overrides", () => {
    const merged = mergeFallbackAdapterConfig({
      primaryAdapterConfig: {
        model: "gpt-5.5",
        env: { FOO: "bar" },
        cwd: "C:/work/repo",
        paperclipSkillSync: { mode: "managed" },
      },
      entryAdapterConfig: { model: "claude-fable-5", cwd: "C:/other" },
    });
    expect(merged).toEqual({
      model: "claude-fable-5",
      cwd: "C:/other",
      env: { FOO: "bar" },
      paperclipSkillSync: { mode: "managed" },
    });
    // primary's provider-specific model never leaks into the fallback
    expect(merged.model).not.toBe("gpt-5.5");
  });
});

describe("config + state readers", () => {
  it("reads a valid runtimeConfig.modelChain and rejects malformed ones", () => {
    expect(readAgentModelChain({ modelChain: { fallbacks: [{ adapterType: "claude_local" }] } }))
      .toMatchObject({ fallbacks: [{ adapterType: "claude_local" }] });
    expect(readAgentModelChain({ modelChain: { fallbacks: [{ adapterType: "" }] } })).toBeNull();
    expect(readAgentModelChain({})).toBeNull();
    expect(readAgentModelChain(null)).toBeNull();
  });

  it("round-trips failover state from agent.metadata", () => {
    expect(readModelFailoverState({
      modelFailover: {
        activeIndex: 1,
        adapterType: "claude_local",
        trigger: "quota_exhausted",
        since: "2026-07-15T12:00:00.000Z",
        resetsAt: "2026-07-22T07:00:00.000Z",
      },
    })).toMatchObject({ activeIndex: 1, adapterType: "claude_local", trigger: "quota_exhausted" });
    expect(readModelFailoverState({ modelFailover: { activeIndex: "x" } })).toBeNull();
    expect(readModelFailoverState(null)).toBeNull();
  });
});
