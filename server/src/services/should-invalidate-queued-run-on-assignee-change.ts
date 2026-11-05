// SUM-175 (SUM-144 D4): queued wakes invalidated on unassign / reassign.
//
// Side (a) run-start revalidation already lives in claimQueuedRun /
// evaluateQueuedRunStaleness. Side (b) is the proactive mutation cancel:
// when assigneeAgentId changes, cancel queued|scheduled_retry runs still
// owned by the previous assignee for this issue.

export const LIVE_QUEUED_STATUSES = Object.freeze(["queued", "scheduled_retry"] as const);
export const INVALIDATION_ERROR_CODE = "issue_assignee_changed";
export const INVALIDATION_REASON =
  "Cancelled because issue assignee changed before the queued run could start; the new owner will be woken instead";

export function evaluateQueuedRunAssigneeStaleness(input: {
  runAgentId?: string | null;
  issueAssigneeAgentId?: string | null;
  isInteractionWake?: boolean;
  issueId?: string | null;
}): {
  stale: boolean;
  errorCode?: string;
  reason?: string;
  details?: Record<string, unknown>;
} {
  if (!input.runAgentId) {
    return {
      stale: true,
      errorCode: INVALIDATION_ERROR_CODE,
      reason: INVALIDATION_REASON,
      details: {
        issueId: input.issueId ?? null,
        previousAssigneeAgentId: null,
        currentAssigneeAgentId: input.issueAssigneeAgentId ?? null,
      },
    };
  }

  if (input.isInteractionWake) return { stale: false };
  if (input.issueAssigneeAgentId === input.runAgentId) return { stale: false };

  return {
    stale: true,
    errorCode: INVALIDATION_ERROR_CODE,
    reason: INVALIDATION_REASON,
    details: {
      issueId: input.issueId ?? null,
      previousAssigneeAgentId: input.runAgentId,
      currentAssigneeAgentId: input.issueAssigneeAgentId ?? null,
    },
  };
}

export function shouldInvalidateQueuedRunOnAssigneeChange(input: {
  run?: { agentId?: string | null; status?: string | null; issueId?: string | null } | null;
  issueId: string;
  previousAssigneeAgentId?: string | null;
  nextAssigneeAgentId?: string | null;
}): boolean {
  const run = input.run;
  if (!run || !input.issueId) return false;
  if (!input.previousAssigneeAgentId) return false;
  if (input.previousAssigneeAgentId === input.nextAssigneeAgentId) return false;
  if (!run.status || !(LIVE_QUEUED_STATUSES as readonly string[]).includes(run.status)) return false;

  const runIssueId = run.issueId ?? null;
  if (runIssueId && runIssueId !== input.issueId) return false;
  if (run.agentId !== input.previousAssigneeAgentId) return false;
  if (input.nextAssigneeAgentId && run.agentId === input.nextAssigneeAgentId) return false;
  return true;
}

export function selectQueuedRunsToInvalidateOnAssigneeChange<T extends {
  agentId?: string | null;
  status?: string | null;
  issueId?: string | null;
}>(input: {
  runs?: T[];
  issueId: string;
  previousAssigneeAgentId?: string | null;
  nextAssigneeAgentId?: string | null;
}): T[] {
  return (input.runs ?? []).filter((run) =>
    shouldInvalidateQueuedRunOnAssigneeChange({
      run,
      issueId: input.issueId,
      previousAssigneeAgentId: input.previousAssigneeAgentId,
      nextAssigneeAgentId: input.nextAssigneeAgentId,
    }),
  );
}

export function buildAssigneeChangedCancellationResult(details: Record<string, unknown> = {}) {
  return {
    status: "cancelled" as const,
    errorCode: INVALIDATION_ERROR_CODE,
    error: INVALIDATION_REASON,
    resultJson: {
      stopReason: INVALIDATION_ERROR_CODE,
      ...details,
    },
    wakeupStatus: "skipped" as const,
    wakeupError: "assignee changed",
  };
}
