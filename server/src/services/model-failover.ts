import { eq } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { agents } from "@paperclipai/db";
import {
  describeModelChainShift,
  evaluateProviderFailoverHealth,
  mergeFallbackAdapterConfig,
  readAgentModelChain,
  readModelFailoverState,
  resolveModelChainSelection,
  type ModelChainConfig,
  type ModelChainSelection,
  type ModelFailoverState,
  type ProviderQuotaResult,
} from "@paperclipai/shared";
import { peekQuotaWindows } from "./quota-windows.js";
import { instanceSettingsService } from "./instance-settings.js";
import { logActivity } from "./activity-log.js";
import { logger } from "../middleware/logger.js";

/**
 * VIT-49 fallback model chains: run-start policy that keeps work moving when a
 * provider hits a quota wall / auth failure / outage. The pure ordered-chain
 * policy lives in @paperclipai/shared model-chain.ts; this service wires it to
 * the VIT-48 quota snapshot (the single quota poller), persists per-agent
 * failover state in agent.metadata.modelFailover, and writes governance
 * events (agent.model_failover / agent.model_failback /
 * agent.model_fallback_unavailable) that the board attention feed surfaces.
 *
 * Boundary vs VIT-64: this service owns "try the next model". When NO entry in
 * the chain is available it does not suspend anything — it reports
 * exhausted_no_fallback with the earliest reset timestamp, and VIT-64's
 * quota-suspend state consumes that via consultModelChainFallbackPolicy().
 */

export const MODEL_FAILOVER_EVENT_ACTIONS = [
  "agent.model_failover",
  "agent.model_failback",
  "agent.model_fallback_unavailable",
] as const;

export interface ModelFailoverAgentLike {
  id: string;
  companyId: string;
  name: string;
  adapterType: string;
  adapterConfig: Record<string, unknown>;
  runtimeConfig: Record<string, unknown>;
  metadata: Record<string, unknown> | null;
}

export interface ModelFailoverDeps {
  /** override for tests; defaults to the VIT-48 stale-while-revalidate cache */
  quotaSnapshot?: { fetchedAt: number; results: ProviderQuotaResult[] } | null;
  /** override for tests; defaults to instance settings modelChainDefaults[companyId] */
  companyDefaultChain?: ModelChainConfig | null;
  logEvent?: (input: {
    action: (typeof MODEL_FAILOVER_EVENT_ACTIONS)[number];
    details: Record<string, unknown>;
  }) => Promise<void>;
  persistMetadata?: (metadata: Record<string, unknown>) => Promise<void>;
  now?: Date;
}

export interface ModelFailoverRunResolution<T extends ModelFailoverAgentLike> {
  /** effective agent for this run — same object when no failover applied */
  agent: T;
  /** true when the run executes on a fallback entry instead of the primary */
  applied: boolean;
  selection: ModelChainSelection;
  chain: ModelChainConfig | null;
  chainSource: "agent" | "company_default" | null;
  /** board-feed sentence when a shift happened, e.g. the Jul-15 incident line */
  message: string | null;
  /** written into the run context as paperclipModelFailover (run-log evidence) */
  contextMetadata: Record<string, unknown> | null;
}

async function readCompanyDefaultChain(db: Db, companyId: string): Promise<ModelChainConfig | null> {
  try {
    const general = await instanceSettingsService(db).getGeneral();
    return general.modelChainDefaults?.[companyId] ?? null;
  } catch (error) {
    logger.warn({ err: error, companyId }, "model-failover: failed to read company default chain");
    return null;
  }
}

function unavailableDedupKey(selection: ModelChainSelection): string {
  return `${selection.shift}:${selection.trigger ?? "unknown"}:${selection.resetsAt ?? "no-reset"}`;
}

/**
 * Resolves the effective adapter for a run about to launch. Never throws: any
 * internal failure logs a warning and returns the agent unchanged, so the
 * failover layer can only ever help a run, not kill one.
 */
export async function resolveAgentModelFailoverForRun<T extends ModelFailoverAgentLike>(input: {
  db: Db;
  agent: T;
  runId: string | null;
  deps?: ModelFailoverDeps;
}): Promise<ModelFailoverRunResolution<T>> {
  const { db, agent, runId } = input;
  const deps = input.deps ?? {};
  const unchanged = (selection: ModelChainSelection, chain: ModelChainConfig | null, chainSource: "agent" | "company_default" | null): ModelFailoverRunResolution<T> => ({
    agent,
    applied: false,
    selection,
    chain,
    chainSource,
    message: null,
    contextMetadata: null,
  });
  const noopSelection: ModelChainSelection = {
    index: 0,
    adapterType: agent.adapterType,
    entry: null,
    shift: "none",
    trigger: null,
    blocked: [],
    resetsAt: null,
  };

  try {
    const agentChain = readAgentModelChain(agent.runtimeConfig);
    const companyChain = agentChain
      ? null
      : deps.companyDefaultChain !== undefined
        ? deps.companyDefaultChain
        : await readCompanyDefaultChain(db, agent.companyId);
    const chain = agentChain ?? companyChain;
    const chainSource: "agent" | "company_default" | null = agentChain ? "agent" : companyChain ? "company_default" : null;
    const previous = readModelFailoverState(agent.metadata);
    if (!chain) {
      // no chain configured anywhere: status quo, no events. VIT-48 already
      // notifies quota exhaustion; VIT-64 owns the chainless suspend path.
      return unchanged(noopSelection, null, null);
    }

    const quotaSnapshot = deps.quotaSnapshot !== undefined ? deps.quotaSnapshot : peekQuotaWindows();
    const health = evaluateProviderFailoverHealth(quotaSnapshot?.results ?? null);
    const selection = resolveModelChainSelection({
      primaryAdapterType: agent.adapterType,
      chain,
      health,
      previousActiveIndex: previous?.activeIndex ?? 0,
    });
    const now = deps.now ?? new Date();
    const nowIso = now.toISOString();
    const message = describeModelChainShift({
      agentName: agent.name,
      primaryAdapterType: agent.adapterType,
      selection,
    });
    const logEvent = deps.logEvent ?? (async (event: { action: (typeof MODEL_FAILOVER_EVENT_ACTIONS)[number]; details: Record<string, unknown> }) => {
      await logActivity(db, {
        companyId: agent.companyId,
        actorType: "system",
        actorId: "model-failover",
        agentId: agent.id,
        runId,
        action: event.action,
        entityType: "agent",
        entityId: agent.id,
        details: event.details,
      });
    });
    const persistMetadata = deps.persistMetadata ?? (async (metadata: Record<string, unknown>) => {
      await db
        .update(agents)
        .set({ metadata, updatedAt: new Date() })
        .where(eq(agents.id, agent.id));
    });
    const baseDetails: Record<string, unknown> = {
      agentName: agent.name,
      primaryAdapterType: agent.adapterType,
      selectedAdapterType: selection.adapterType,
      chainIndex: selection.index,
      chainSource,
      trigger: selection.trigger,
      resetsAt: selection.resetsAt,
      message,
      blocked: selection.blocked,
    };

    if (selection.shift === "failover" || selection.shift === "hold") {
      const state: ModelFailoverState = {
        activeIndex: selection.index,
        adapterType: selection.adapterType,
        trigger: selection.trigger,
        since: selection.shift === "hold" && previous ? previous.since : nowIso,
        resetsAt: selection.resetsAt,
      };
      const metadata = { ...(agent.metadata ?? {}), modelFailover: state };
      if (selection.shift === "failover") {
        await persistMetadata(metadata);
        await logEvent({ action: "agent.model_failover", details: baseDetails });
      }
      const effectiveAgent: T = {
        ...agent,
        adapterType: selection.adapterType,
        adapterConfig: mergeFallbackAdapterConfig({
          primaryAdapterConfig: agent.adapterConfig,
          entryAdapterConfig: selection.entry?.adapterConfig ?? null,
        }),
        metadata,
      };
      return {
        agent: effectiveAgent,
        applied: true,
        selection,
        chain,
        chainSource,
        message: selection.shift === "failover" ? message : null,
        contextMetadata: {
          shift: selection.shift,
          chainIndex: selection.index,
          adapterType: selection.adapterType,
          primaryAdapterType: agent.adapterType,
          trigger: selection.trigger,
          resetsAt: selection.resetsAt,
          chainSource,
        },
      };
    }

    if (selection.shift === "failback") {
      const metadata = { ...(agent.metadata ?? {}) };
      delete metadata.modelFailover;
      await persistMetadata(metadata);
      await logEvent({ action: "agent.model_failback", details: baseDetails });
      return {
        ...unchanged(selection, chain, chainSource),
        agent: { ...agent, metadata },
        message,
        contextMetadata: {
          shift: "failback",
          adapterType: agent.adapterType,
          primaryAdapterType: agent.adapterType,
          chainSource,
        },
      };
    }

    if (selection.shift === "pinned_unavailable" || selection.shift === "exhausted_no_fallback") {
      const dedupKey = unavailableDedupKey(selection);
      if (previous?.lastUnavailableKey !== dedupKey) {
        const state: ModelFailoverState = {
          activeIndex: 0,
          adapterType: agent.adapterType,
          trigger: selection.trigger,
          since: nowIso,
          resetsAt: selection.resetsAt,
          lastUnavailableKey: dedupKey,
        };
        await persistMetadata({ ...(agent.metadata ?? {}), modelFailover: state });
        await logEvent({ action: "agent.model_fallback_unavailable", details: baseDetails });
      }
      return { ...unchanged(selection, chain, chainSource), message };
    }

    // shift === "none": clear any stale unavailable-state marker silently
    if (previous && previous.activeIndex === 0 && previous.lastUnavailableKey) {
      const metadata = { ...(agent.metadata ?? {}) };
      delete metadata.modelFailover;
      await persistMetadata(metadata);
      return { ...unchanged(selection, chain, chainSource), agent: { ...agent, metadata } };
    }
    return unchanged(selection, chain, chainSource);
  } catch (error) {
    logger.warn(
      { err: error, agentId: agent.id, companyId: agent.companyId, runId },
      "model-failover: resolution failed; running on the agent's primary adapter",
    );
    return unchanged(noopSelection, null, null);
  }
}

/**
 * VIT-64 policy hook: side-effect-free consult of the fallback chain. The
 * quota-suspend runtime calls this FIRST; only when hasFallbackAvailable is
 * false (or the agent is pinned) does it enter the suspended state, using
 * resetsAt as the retry timestamp.
 */
export async function consultModelChainFallbackPolicy(input: {
  db: Db;
  agent: ModelFailoverAgentLike;
  quotaSnapshot?: { fetchedAt: number; results: ProviderQuotaResult[] } | null;
}): Promise<{
  chain: ModelChainConfig | null;
  selection: ModelChainSelection;
  hasFallbackAvailable: boolean;
  resetsAt: string | null;
}> {
  const agentChain = readAgentModelChain(input.agent.runtimeConfig);
  const chain = agentChain ?? (await readCompanyDefaultChain(input.db, input.agent.companyId));
  const quotaSnapshot = input.quotaSnapshot !== undefined ? input.quotaSnapshot : peekQuotaWindows();
  const selection = resolveModelChainSelection({
    primaryAdapterType: input.agent.adapterType,
    chain,
    health: evaluateProviderFailoverHealth(quotaSnapshot?.results ?? null),
    previousActiveIndex: readModelFailoverState(input.agent.metadata)?.activeIndex ?? 0,
  });
  const hasFallbackAvailable =
    selection.shift !== "pinned_unavailable" && selection.shift !== "exhausted_no_fallback";
  return { chain, selection, hasFallbackAvailable, resetsAt: selection.resetsAt };
}
