// SUM-170 (SUM-144 D1): unpause resumes NOTHING by default.
//
// When an agent is unpaused, `agents.lastResumedAt` is stamped. The stranded-
// assignment reconciler must NOT fan out the agent's historical backlog just
// because the agent became invokable again. Only issues with explicit post-
// resume intent (assignment/update/comment/re-dispatch after lastResumedAt)
// may be re-armed.

export function toMillis(value: unknown): number | null {
  if (value == null) return null;
  if (value instanceof Date) {
    const ms = value.getTime();
    return Number.isFinite(ms) ? ms : null;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string" && value.trim()) {
    const ms = Date.parse(value);
    return Number.isFinite(ms) ? ms : null;
  }
  return null;
}

export function readLastResumedAt(agent: { lastResumedAt?: unknown } | null | undefined): number | null {
  if (!agent) return null;
  return toMillis(agent.lastResumedAt);
}

export type PostResumeIntentSignals = {
  issueUpdatedAt?: unknown;
  issueCreatedAt?: unknown;
  latestRunCreatedAt?: unknown;
  latestRunStartedAt?: unknown;
  acceptedInteractionResolvedAt?: unknown;
  latestCommentAt?: unknown;
};

/**
 * True when some wake-relevant signal happened AFTER the unpause instant.
 * Null lastResumedAt keeps legacy behaviour (compat for agents never unpaused
 * under the new semantics).
 */
export function hasPostResumeIntent(
  lastResumedAtMs: number | null,
  signals: PostResumeIntentSignals = {},
): boolean {
  if (lastResumedAtMs == null) return true;
  const candidates = [
    signals.issueUpdatedAt,
    signals.issueCreatedAt,
    signals.latestRunCreatedAt,
    signals.latestRunStartedAt,
    signals.acceptedInteractionResolvedAt,
    signals.latestCommentAt,
  ]
    .map(toMillis)
    .filter((ms): ms is number => ms != null);
  return candidates.some((ms) => ms > lastResumedAtMs);
}

/**
 * Gate used by reconcileStrandedAssignedIssues: skip automatic backlog
 * re-arm after unpause unless post-resume intent is present.
 */
export function shouldSkipStaleBacklogAfterResume(
  agent: { lastResumedAt?: unknown } | null | undefined,
  signals: PostResumeIntentSignals = {},
): boolean {
  const lastResumedAtMs = readLastResumedAt(agent);
  if (lastResumedAtMs == null) return false;
  return !hasPostResumeIntent(lastResumedAtMs, signals);
}
