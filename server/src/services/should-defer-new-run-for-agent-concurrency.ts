// SUM-174 (SUM-144 D3): one-live-run-per-agent governor at the queued-run gate.
//
// Wire into enqueueWakeup AFTER same-issue coalesce, BEFORE insert(heartbeatRuns).
// startNextQueuedRunForAgent already caps *starts*; this gate stops a second run
// from being *queued* while the agent already holds a live execution path.

export const DEFAULT_MAX_CONCURRENT_RUNS = 1;
export const LIVE_RUN_STATUSES = Object.freeze(["queued", "running", "scheduled_retry"] as const);
export const AGENT_CONCURRENCY_DEFER_REASON = "agent_max_concurrent_runs";

export function normalizeMaxConcurrentRuns(value: unknown): number {
  const parsed = Math.floor(Number(value));
  if (!Number.isFinite(parsed)) return DEFAULT_MAX_CONCURRENT_RUNS;
  return Math.max(1, Math.min(50, parsed));
}

export function countLiveRunsForAgent(runs: Array<{ status?: string | null }> = []): number {
  let n = 0;
  for (const run of runs) {
    if (run?.status && (LIVE_RUN_STATUSES as readonly string[]).includes(run.status)) n += 1;
  }
  return n;
}

/**
 * Should enqueueWakeup park this wake instead of creating another queued run?
 * Same-issue coalesce must be evaluated first by the caller.
 */
export function shouldDeferNewRunForAgentConcurrency(input: {
  liveRunCount: number;
  maxConcurrentRuns?: number;
  sameIssueCoalesced?: boolean;
}): boolean {
  if (input.sameIssueCoalesced) return false;
  const limit = normalizeMaxConcurrentRuns(input.maxConcurrentRuns);
  const live = Number(input.liveRunCount);
  if (!Number.isFinite(live) || live < 0) return false;
  return live >= limit;
}

export function rankParkedWakeForRelease(wake: {
  requestedByActorType?: string | null;
  source?: string | null;
  triggerDetail?: string | null;
  boardPointed?: boolean;
  agentSpawnedSubtask?: boolean;
  requestedAt?: number | string | Date | null;
} = {}): number {
  if (wake.boardPointed === true || wake.requestedByActorType === "user") return 0;
  if (wake.agentSpawnedSubtask === true) return 30;
  if (wake.source === "assignment" || wake.triggerDetail === "assignment") return 5;
  if (wake.source === "comment" || wake.triggerDetail === "comment") return 10;
  if (wake.requestedByActorType === "agent") return 20;
  if (wake.requestedByActorType === "system" || wake.source === "timer") return 25;
  return 15;
}

function toMillis(value: unknown): number {
  if (value == null) return 0;
  if (value instanceof Date) {
    const ms = value.getTime();
    return Number.isFinite(ms) ? ms : 0;
  }
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const ms = Date.parse(value);
    return Number.isFinite(ms) ? ms : 0;
  }
  return 0;
}

export function orderParkedWakesForRelease<T extends {
  requestedByActorType?: string | null;
  source?: string | null;
  triggerDetail?: string | null;
  boardPointed?: boolean;
  agentSpawnedSubtask?: boolean;
  requestedAt?: number | string | Date | null;
}>(wakes: T[] = []): T[] {
  return [...wakes].sort((a, b) => {
    const rankDelta = rankParkedWakeForRelease(a) - rankParkedWakeForRelease(b);
    if (rankDelta !== 0) return rankDelta;
    return toMillis(a.requestedAt) - toMillis(b.requestedAt);
  });
}

export function buildDeferredConcurrencyPayload(input: {
  issueId?: string | null;
  contextSnapshot?: Record<string, unknown>;
  payload?: Record<string, unknown> | null;
  liveRunCount: number;
  maxConcurrentRuns?: number;
}): Record<string, unknown> {
  return {
    ...(input.payload && typeof input.payload === "object" ? input.payload : {}),
    issueId: input.issueId ?? null,
    deferredAgentConcurrency: {
      reason: AGENT_CONCURRENCY_DEFER_REASON,
      liveRunCount: input.liveRunCount,
      maxConcurrentRuns: normalizeMaxConcurrentRuns(input.maxConcurrentRuns),
      deferredAt: new Date().toISOString(),
    },
    deferredWakeContext: input.contextSnapshot ?? {},
  };
}
