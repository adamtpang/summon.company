import { describe, expect, it } from "vitest";
import {
  AGENT_CONCURRENCY_DEFER_REASON,
  buildDeferredConcurrencyPayload,
  countLiveRunsForAgent,
  normalizeMaxConcurrentRuns,
  orderParkedWakesForRelease,
  shouldDeferNewRunForAgentConcurrency,
} from "./should-defer-new-run-for-agent-concurrency.js";

describe("should-defer-new-run-for-agent-concurrency (SUM-174)", () => {
  it("defers when live runs already at maxConcurrentRuns=1", () => {
    expect(shouldDeferNewRunForAgentConcurrency({ liveRunCount: 1, maxConcurrentRuns: 1 })).toBe(true);
  });

  it("allows create when under the limit", () => {
    expect(shouldDeferNewRunForAgentConcurrency({ liveRunCount: 0, maxConcurrentRuns: 1 })).toBe(false);
  });

  it("does not defer after same-issue coalesce", () => {
    expect(shouldDeferNewRunForAgentConcurrency({
      liveRunCount: 1,
      maxConcurrentRuns: 1,
      sameIssueCoalesced: true,
    })).toBe(false);
  });

  it("counts only live execution-path statuses", () => {
    expect(countLiveRunsForAgent([
      { status: "queued" },
      { status: "running" },
      { status: "succeeded" },
      { status: "scheduled_retry" },
    ])).toBe(3);
  });

  it("normalizes invalid maxConcurrentRuns to 1", () => {
    expect(normalizeMaxConcurrentRuns(undefined)).toBe(1);
    expect(normalizeMaxConcurrentRuns("nope")).toBe(1);
  });

  it("orders board-pointed wakes ahead of agent-spawned subtasks", () => {
    const ordered = orderParkedWakesForRelease([
      { requestedByActorType: "agent", agentSpawnedSubtask: true, requestedAt: "2026-07-19T06:00:00.000Z" },
      { requestedByActorType: "user", boardPointed: true, requestedAt: "2026-07-19T06:01:00.000Z" },
      { source: "assignment", requestedAt: "2026-07-19T06:02:00.000Z" },
    ]);
    expect(ordered[0]?.boardPointed).toBe(true);
    expect(ordered[1]?.source).toBe("assignment");
    expect(ordered[2]?.agentSpawnedSubtask).toBe(true);
  });

  it("builds deferred payload with concurrency marker", () => {
    const payload = buildDeferredConcurrencyPayload({
      issueId: "issue-1",
      liveRunCount: 1,
      maxConcurrentRuns: 1,
      payload: { keep: true },
    });
    expect(payload.issueId).toBe("issue-1");
    expect(payload.keep).toBe(true);
    expect(payload.deferredAgentConcurrency).toMatchObject({
      reason: AGENT_CONCURRENCY_DEFER_REASON,
      liveRunCount: 1,
      maxConcurrentRuns: 1,
    });
  });
});
