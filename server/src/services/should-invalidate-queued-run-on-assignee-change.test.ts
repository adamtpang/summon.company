import { describe, expect, it } from "vitest";
import {
  INVALIDATION_ERROR_CODE,
  buildAssigneeChangedCancellationResult,
  evaluateQueuedRunAssigneeStaleness,
  selectQueuedRunsToInvalidateOnAssigneeChange,
  shouldInvalidateQueuedRunOnAssigneeChange,
} from "./should-invalidate-queued-run-on-assignee-change.js";

describe("should-invalidate-queued-run-on-assignee-change (SUM-175)", () => {
  const issueId = "issue-vit-110";
  const atlas = "agent-atlas";
  const other = "agent-other";

  it("marks run-start stale when assignee no longer matches", () => {
    const decision = evaluateQueuedRunAssigneeStaleness({
      runAgentId: atlas,
      issueAssigneeAgentId: null,
      issueId,
    });
    expect(decision.stale).toBe(true);
    expect(decision.errorCode).toBe(INVALIDATION_ERROR_CODE);
  });

  it("keeps run when assignee still matches", () => {
    expect(evaluateQueuedRunAssigneeStaleness({
      runAgentId: atlas,
      issueAssigneeAgentId: atlas,
      issueId,
    }).stale).toBe(false);
  });

  it("proactively invalidates previous assignee queued wake on unassign", () => {
    expect(shouldInvalidateQueuedRunOnAssigneeChange({
      run: { agentId: atlas, status: "queued", issueId },
      issueId,
      previousAssigneeAgentId: atlas,
      nextAssigneeAgentId: null,
    })).toBe(true);
  });

  it("leaves running runs alone", () => {
    expect(shouldInvalidateQueuedRunOnAssigneeChange({
      run: { agentId: atlas, status: "running", issueId },
      issueId,
      previousAssigneeAgentId: atlas,
      nextAssigneeAgentId: null,
    })).toBe(false);
  });

  it("selects only previous-assignee queued/scheduled_retry for this issue", () => {
    const selected = selectQueuedRunsToInvalidateOnAssigneeChange({
      runs: [
        { id: "keep-other-issue", agentId: atlas, status: "queued", issueId: "other" },
        { id: "cancel-me", agentId: atlas, status: "queued", issueId },
        { id: "keep-running", agentId: atlas, status: "running", issueId },
        { id: "keep-other-agent", agentId: other, status: "queued", issueId },
      ],
      issueId,
      previousAssigneeAgentId: atlas,
      nextAssigneeAgentId: other,
    });
    expect(selected.map((run) => run.id)).toEqual(["cancel-me"]);
  });

  it("builds cancellation result with stopReason mirror", () => {
    const result = buildAssigneeChangedCancellationResult({ issueId });
    expect(result.errorCode).toBe(INVALIDATION_ERROR_CODE);
    expect(result.resultJson.stopReason).toBe(INVALIDATION_ERROR_CODE);
    expect(result.wakeupStatus).toBe("skipped");
  });
});
