import { z } from "zod";
import { ADAPTER_AGNOSTIC_KEYS } from "./constants.js";
import { quotaProviderLabel } from "./quota-alerts.js";
import type { ProviderQuotaResult } from "./types/quota.js";

/**
 * Ordered fallback model chains (VIT-49). Per-employee policy: primary adapter
 * (the agent's own adapterType/adapterConfig) -> fallback1 -> fallback2, walked
 * at run start against provider health derived from the VIT-48 quota snapshot.
 * Re-evaluating from the primary down on every run start is the auto-reprobe:
 * when the primary's quota window resets, the next run falls back UP without
 * any manual adapter surgery. Design reference:
 * doc/research/OPENCLAW-LEARNINGS.md section 2.4 ("provider/model strings with
 * ordered fallbacks and auto-reprobe of the primary").
 *
 * Failover triggers are ONLY quota exhaustion, auth failure, provider outage,
 * and cost-limit pressure. Content refusals are deliberately not a trigger:
 * they route to the board, never to a different model.
 */

export const FAILOVER_TRIGGERS = [
  "quota_exhausted",
  "auth_failure",
  "provider_outage",
  "cost_limit",
] as const;
export type FailoverTrigger = (typeof FAILOVER_TRIGGERS)[number];

export const modelChainFallbackEntrySchema = z.object({
  adapterType: z.string().trim().min(1),
  /**
   * Adapter config used when this entry is active (e.g. { model: "haiku" }).
   * Adapter-agnostic keys (env, cwd, skill sync, ...) are inherited from the
   * agent's primary adapterConfig; see mergeFallbackAdapterConfig.
   */
  adapterConfig: z.record(z.string(), z.unknown()).optional(),
  label: z.string().trim().min(1).optional(),
}).strict();

export type ModelChainFallbackEntry = z.infer<typeof modelChainFallbackEntrySchema>;

export const modelChainConfigSchema = z.object({
  /** ordered fallbacks; entry 0 is tried first after the primary */
  fallbacks: z.array(modelChainFallbackEntrySchema).max(8).default([]),
  /**
   * Board governance: pin this employee to its primary provider for sensitive
   * work. Pinned employees never fail over, even when the primary is down.
   */
  pinned: z.boolean().optional(),
}).strict();

export type ModelChainConfig = z.infer<typeof modelChainConfigSchema>;

/** Safe read of runtimeConfig.modelChain; null when absent or malformed. */
export function readAgentModelChain(runtimeConfig: unknown): ModelChainConfig | null {
  if (runtimeConfig == null || typeof runtimeConfig !== "object") return null;
  const raw = (runtimeConfig as Record<string, unknown>).modelChain;
  if (raw == null) return null;
  const parsed = modelChainConfigSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

/** Same adapter->provider mapping the quota-windows service uses. */
export function providerSlugForAdapterType(adapterType: string): string {
  switch (adapterType) {
    case "claude_local":
      return "anthropic";
    case "codex_local":
      return "openai";
    default:
      return adapterType;
  }
}

export interface ProviderFailoverHealth {
  provider: string;
  available: boolean;
  trigger: FailoverTrigger | null;
  detail: string | null;
  /**
   * When unavailable due to quota exhaustion: the latest reset among exhausted
   * windows, i.e. when the provider becomes usable again.
   */
  resetsAt: string | null;
}

const AUTH_ERROR_PATTERN = /\b(auth|unauthorized|unauthenticated|forbidden|credential|login|logged out|token expired|401|403)\b/i;
const OUTAGE_ERROR_PATTERN = /\b(timed? ?out|timeout|econnrefused|econnreset|enotfound|network|unavailable|unreachable|50[0-4]|529|overloaded)\b/i;

/**
 * Classifies a provider probe error into a failover trigger. Unknown errors
 * return null (available): ambiguity must never cause a failover, and content
 * refusals never classify as any trigger.
 */
export function classifyProviderProbeError(error: string | null | undefined): FailoverTrigger | null {
  if (!error) return null;
  if (AUTH_ERROR_PATTERN.test(error)) return "auth_failure";
  if (OUTAGE_ERROR_PATTERN.test(error)) return "provider_outage";
  return null;
}

/**
 * Derives per-provider failover health from the VIT-48 quota snapshot (the
 * single quota poller; no second one). Providers with no data are treated as
 * available: never fail over blind.
 */
export function evaluateProviderFailoverHealth(
  results: ProviderQuotaResult[] | null | undefined,
  opts?: {
    /** providers under run-level cost pressure (cost_limit trigger source) */
    costLimitLowProviders?: string[];
  },
): Record<string, ProviderFailoverHealth> {
  const health: Record<string, ProviderFailoverHealth> = {};
  for (const result of results ?? []) {
    if (!result.ok) {
      const trigger = classifyProviderProbeError(result.error);
      health[result.provider] = {
        provider: result.provider,
        available: trigger == null,
        trigger,
        detail: trigger ? result.error ?? null : null,
        resetsAt: null,
      };
      continue;
    }
    const exhausted = result.windows.filter(
      (w) => w.usedPercent != null && w.usedPercent >= 100,
    );
    if (exhausted.length === 0) {
      health[result.provider] = {
        provider: result.provider,
        available: true,
        trigger: null,
        detail: null,
        resetsAt: null,
      };
      continue;
    }
    // one exhausted window blocks the provider; usable again once the LAST
    // exhausted window has reset
    const resetsAt = exhausted.reduce<string | null>((latest, w) => {
      if (w.resetsAt == null) return latest;
      if (latest == null || Date.parse(w.resetsAt) > Date.parse(latest)) return w.resetsAt;
      return latest;
    }, null);
    const labels = exhausted.map((w) => w.label).join(", ");
    health[result.provider] = {
      provider: result.provider,
      available: false,
      trigger: "quota_exhausted",
      detail: `${quotaProviderLabel(result.provider)} ${labels} quota exhausted`,
      resetsAt,
    };
  }
  for (const provider of opts?.costLimitLowProviders ?? []) {
    if (health[provider]?.available === false) continue;
    health[provider] = {
      provider,
      available: false,
      trigger: "cost_limit",
      detail: `${quotaProviderLabel(provider)} cost limit remaining too low for this run`,
      resetsAt: null,
    };
  }
  return health;
}

export type ModelChainShift =
  /** primary selected, no failover state to report */
  | "none"
  /** moved off the previously active entry to a worse (or first) fallback */
  | "failover"
  /** primary recovered; moved back up to it */
  | "failback"
  /** still on the same fallback as the previous run; no new event */
  | "hold"
  /** primary unavailable but the employee is pinned; stayed on primary */
  | "pinned_unavailable"
  /** every entry in the chain is unavailable; VIT-64 suspend territory */
  | "exhausted_no_fallback";

export interface ModelChainBlockedEntry {
  index: number;
  adapterType: string;
  provider: string;
  trigger: FailoverTrigger;
  detail: string | null;
  resetsAt: string | null;
}

export interface ModelChainSelection {
  /** 0 = primary; 1..n = fallbacks[index-1] */
  index: number;
  adapterType: string;
  entry: ModelChainFallbackEntry | null;
  shift: ModelChainShift;
  /** trigger that blocked the primary (or, for no-fallback, the primary's trigger) */
  trigger: FailoverTrigger | null;
  blocked: ModelChainBlockedEntry[];
  /**
   * When shift is failover/pinned_unavailable/exhausted_no_fallback: when the
   * blocking condition clears (earliest known reset for no-fallback so VIT-64
   * can suspend with a reset timestamp; the primary's reset otherwise).
   */
  resetsAt: string | null;
}

export interface ModelChainSelectionInput {
  primaryAdapterType: string;
  chain: ModelChainConfig | null | undefined;
  health: Record<string, ProviderFailoverHealth> | null | undefined;
  /** the chain index active on the previous run (0/null = primary) */
  previousActiveIndex?: number | null;
}

function healthFor(
  health: Record<string, ProviderFailoverHealth> | null | undefined,
  adapterType: string,
): ProviderFailoverHealth | null {
  return health?.[providerSlugForAdapterType(adapterType)] ?? null;
}

/**
 * Walks primary -> fallbacks in order and selects the first entry whose
 * provider is available. Deterministic, side-effect free; the server wires
 * events and persistence around it, and VIT-64 consults it before entering the
 * quota-suspended state.
 */
export function resolveModelChainSelection(input: ModelChainSelectionInput): ModelChainSelection {
  const previousActiveIndex = input.previousActiveIndex ?? 0;
  const fallbacks = input.chain?.fallbacks ?? [];
  const primaryHealth = healthFor(input.health, input.primaryAdapterType);
  const primaryAvailable = primaryHealth?.available !== false;

  const primarySelection = (shift: ModelChainShift): ModelChainSelection => ({
    index: 0,
    adapterType: input.primaryAdapterType,
    entry: null,
    shift,
    trigger: shift === "none" || shift === "failback" ? null : primaryHealth?.trigger ?? null,
    blocked: [],
    resetsAt: shift === "none" || shift === "failback" ? null : primaryHealth?.resetsAt ?? null,
  });

  if (input.chain?.pinned) {
    return primarySelection(primaryAvailable ? "none" : "pinned_unavailable");
  }

  if (primaryAvailable) {
    return primarySelection(previousActiveIndex > 0 ? "failback" : "none");
  }

  const blocked: ModelChainBlockedEntry[] = [
    {
      index: 0,
      adapterType: input.primaryAdapterType,
      provider: providerSlugForAdapterType(input.primaryAdapterType),
      trigger: primaryHealth?.trigger ?? "provider_outage",
      detail: primaryHealth?.detail ?? null,
      resetsAt: primaryHealth?.resetsAt ?? null,
    },
  ];

  for (let i = 0; i < fallbacks.length; i++) {
    const entry = fallbacks[i]!;
    const entryHealth = healthFor(input.health, entry.adapterType);
    if (entryHealth?.available !== false) {
      const index = i + 1;
      return {
        index,
        adapterType: entry.adapterType,
        entry,
        shift: index === previousActiveIndex ? "hold" : "failover",
        trigger: blocked[0]!.trigger,
        blocked,
        resetsAt: blocked[0]!.resetsAt,
      };
    }
    blocked.push({
      index: i + 1,
      adapterType: entry.adapterType,
      provider: providerSlugForAdapterType(entry.adapterType),
      trigger: entryHealth.trigger ?? "provider_outage",
      detail: entryHealth.detail,
      resetsAt: entryHealth.resetsAt,
    });
  }

  // nothing available: stay on the primary nominally; the runtime (VIT-64)
  // decides whether to suspend. Earliest known reset = soonest retry point.
  const earliestReset = blocked.reduce<string | null>((earliest, b) => {
    if (b.resetsAt == null) return earliest;
    if (earliest == null || Date.parse(b.resetsAt) < Date.parse(earliest)) return b.resetsAt;
    return earliest;
  }, null);
  return {
    index: 0,
    adapterType: input.primaryAdapterType,
    entry: null,
    shift: "exhausted_no_fallback",
    trigger: blocked[0]!.trigger,
    blocked,
    resetsAt: earliestReset,
  };
}

/**
 * Adapter config for an active fallback entry: the entry's own config plus the
 * adapter-agnostic keys inherited from the primary config — the same
 * keys-survive-adapter-swap semantics the agents PATCH route enforces.
 */
export function mergeFallbackAdapterConfig(input: {
  primaryAdapterConfig: Record<string, unknown>;
  entryAdapterConfig?: Record<string, unknown> | null;
}): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...(input.entryAdapterConfig ?? {}) };
  for (const key of ADAPTER_AGNOSTIC_KEYS) {
    if (merged[key] === undefined && input.primaryAdapterConfig[key] !== undefined) {
      merged[key] = input.primaryAdapterConfig[key];
    }
  }
  return merged;
}

const TRIGGER_PHRASES: Record<FailoverTrigger, string> = {
  quota_exhausted: "quota exhausted",
  auth_failure: "authentication failed",
  provider_outage: "provider unavailable",
  cost_limit: "cost limit remaining too low",
};

function formatResetDay(resetsAt: string | null): string | null {
  if (!resetsAt) return null;
  const ms = Date.parse(resetsAt);
  if (Number.isNaN(ms)) return null;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(ms));
}

function adapterDisplay(adapterType: string): string {
  return `${quotaProviderLabel(providerSlugForAdapterType(adapterType))} (${adapterType})`;
}

/**
 * Board-feed sentence for a chain shift, e.g. "Vitals Engineer fell back to
 * Claude (claude_local): Codex weekly limit — quota exhausted, resets Jul 22".
 */
export function describeModelChainShift(input: {
  agentName: string;
  primaryAdapterType: string;
  selection: ModelChainSelection;
}): string | null {
  const { agentName, primaryAdapterType, selection } = input;
  const primaryBlock = selection.blocked[0] ?? null;
  const reason = selection.trigger ? TRIGGER_PHRASES[selection.trigger] : null;
  const resetDay = formatResetDay(selection.resetsAt);
  const reasonSuffix = [
    primaryBlock?.detail ?? (reason ? `${adapterDisplay(primaryAdapterType)} ${reason}` : null),
    resetDay ? `resets ${resetDay}` : null,
  ].filter(Boolean).join(", ");
  switch (selection.shift) {
    case "failover":
      return `${agentName} fell back to ${adapterDisplay(selection.adapterType)}: ${reasonSuffix}`;
    case "failback":
      return `${agentName} restored to primary ${adapterDisplay(primaryAdapterType)}: provider recovered`;
    case "pinned_unavailable":
      return `${agentName} is pinned to ${adapterDisplay(primaryAdapterType)} and cannot fail over: ${reasonSuffix}`;
    case "exhausted_no_fallback":
      return `${agentName} has no available model in its fallback chain: ${reasonSuffix}`;
    default:
      return null;
  }
}

/** Per-agent failover state persisted in agent.metadata.modelFailover. */
export interface ModelFailoverState {
  activeIndex: number;
  adapterType: string;
  trigger: FailoverTrigger | null;
  since: string;
  resetsAt: string | null;
  /** dedup key for unavailable notifications (trigger + reset window) */
  lastUnavailableKey?: string | null;
}

export function readModelFailoverState(metadata: unknown): ModelFailoverState | null {
  if (metadata == null || typeof metadata !== "object") return null;
  const raw = (metadata as Record<string, unknown>).modelFailover;
  if (raw == null || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  const activeIndex = typeof record.activeIndex === "number" ? record.activeIndex : null;
  const adapterType = typeof record.adapterType === "string" ? record.adapterType : null;
  if (activeIndex == null || adapterType == null) return null;
  return {
    activeIndex,
    adapterType,
    trigger: FAILOVER_TRIGGERS.includes(record.trigger as FailoverTrigger)
      ? (record.trigger as FailoverTrigger)
      : null,
    since: typeof record.since === "string" ? record.since : new Date(0).toISOString(),
    resetsAt: typeof record.resetsAt === "string" ? record.resetsAt : null,
    lastUnavailableKey: typeof record.lastUnavailableKey === "string" ? record.lastUnavailableKey : null,
  };
}
