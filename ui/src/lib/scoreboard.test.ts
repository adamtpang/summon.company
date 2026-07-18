import { describe, expect, it } from "vitest";
import type { Issue, IssuePriority, IssueStatus } from "@paperclipai/shared";
import {
  buildScoreboard,
  deriveProgress,
  importanceStarsFor,
  isReviewNeeded,
  isRunLive,
  sortScoreboardRows,
  toScoreboardRow,
  urgencyStarsFor,
  tierFor,
} from "./scoreboard";

/** Minimal issue factory — only the fields the scoreboard reads. */
function issue(overrides: Partial<Issue> = {}): Issue {
  return {
    id: "issue-1",
    identifier: "VIT-1",
    title: "A task",
    status: "todo" as IssueStatus,
    priority: "medium" as IssuePriority,
    assigneeAgentId: null,
    executionRunId: null,
    checkoutRunId: null,
    executionLockedAt: null,
    startedAt: null,
    hiddenAt: null,
    scheduledRetry: null,
    blockedInboxAttention: null,
    productivityReview: null,
    ...overrides,
  } as Issue;
}

describe("importanceStarsFor", () => {
  it("maps the triage priority to 2..5 stars", () => {
    expect(importanceStarsFor("critical")).toBe(5);
    expect(importanceStarsFor("high")).toBe(4);
    expect(importanceStarsFor("medium")).toBe(3);
    expect(importanceStarsFor("low")).toBe(2);
  });
});

describe("urgencyStarsFor", () => {
  it("starts from the importance base", () => {
    expect(urgencyStarsFor(issue({ priority: "high", status: "in_progress" }))).toBe(4);
  });

  it("bumps up for pressing lifecycle states, clamped at 5", () => {
    expect(urgencyStarsFor(issue({ priority: "high", status: "in_review" }))).toBe(5);
    expect(urgencyStarsFor(issue({ priority: "critical", status: "blocked" }))).toBe(5);
    expect(
      urgencyStarsFor(issue({ priority: "low", status: "in_progress", scheduledRetry: { runId: "r" } as never })),
    ).toBe(3);
  });

  it("drops one star in the backlog, floored at 1", () => {
    expect(urgencyStarsFor(issue({ priority: "low", status: "backlog" }))).toBe(1);
    expect(urgencyStarsFor(issue({ priority: "medium", status: "backlog" }))).toBe(2);
  });
});

describe("isRunLive", () => {
  it("is true when any run/checkout lock is held", () => {
    expect(isRunLive(issue({ executionRunId: "run-1" }))).toBe(true);
    expect(isRunLive(issue({ checkoutRunId: "co-1" }))).toBe(true);
    expect(isRunLive(issue({ executionLockedAt: new Date() }))).toBe(true);
    expect(isRunLive(issue())).toBe(false);
  });
});

describe("isReviewNeeded", () => {
  it("flags in_review and board-awaiting decisions, but nothing broader", () => {
    expect(isReviewNeeded(issue({ status: "in_review" }))).toBe(true);
    expect(
      isReviewNeeded(issue({ blockedInboxAttention: { state: "awaiting_decision" } as never })),
    ).toBe(true);
    // Broader agent-attention signals must NOT dilute the board-review band.
    expect(
      isReviewNeeded(issue({ blockedInboxAttention: { state: "needs_attention" } as never })),
    ).toBe(false);
    expect(
      isReviewNeeded(issue({ blockedInboxAttention: { state: "external_wait" } as never })),
    ).toBe(false);
    expect(isReviewNeeded(issue({ productivityReview: { reviewIssueId: "x" } as never }))).toBe(false);
    expect(isReviewNeeded(issue({ status: "in_progress" }))).toBe(false);
  });
});

describe("deriveProgress", () => {
  it("walks the lifecycle ladder", () => {
    expect(deriveProgress(issue({ status: "backlog" }))).toEqual({ progress: 0, label: "Backlog" });
    expect(deriveProgress(issue({ status: "todo" }))).toEqual({ progress: 0, label: "To do" });
    expect(deriveProgress(issue({ status: "in_progress" }))).toEqual({ progress: 10, label: "Woken" });
    expect(deriveProgress(issue({ status: "in_progress", startedAt: new Date() }))).toEqual({
      progress: 25,
      label: "Started",
    });
    expect(deriveProgress(issue({ status: "in_progress", executionRunId: "run-1" }))).toEqual({
      progress: 25,
      label: "Run started",
    });
    expect(deriveProgress(issue({ status: "blocked" }))).toEqual({ progress: 25, label: "Blocked" });
    expect(deriveProgress(issue({ status: "in_review" }))).toEqual({ progress: 90, label: "In review" });
    expect(deriveProgress(issue({ status: "done" }))).toEqual({ progress: 100, label: "Done" });
  });
});

describe("sortScoreboardRows", () => {
  it("puts review-needed first, then heavier stars, then least complete", () => {
    const rows = [
      toScoreboardRow(issue({ id: "done", title: "Done task", priority: "critical", status: "done" })),
      toScoreboardRow(issue({ id: "low", title: "Low task", priority: "low", status: "todo" })),
      toScoreboardRow(issue({ id: "crit", title: "Crit task", priority: "critical", status: "in_progress" })),
      toScoreboardRow(issue({ id: "review", title: "Review task", priority: "low", status: "in_review" })),
    ];
    const sorted = sortScoreboardRows(rows);
    expect(sorted.map((r) => r.id)).toEqual(["review", "crit", "done", "low"]);
  });

  it("orders the review band most-complete first, working band least-complete first", () => {
    const rows = [
      toScoreboardRow(issue({ id: "rev-fresh", title: "b", priority: "critical", status: "todo",
        blockedInboxAttention: { state: "awaiting_decision" } as never })),
      toScoreboardRow(issue({ id: "rev-ready", title: "a", priority: "critical", status: "in_review" })),
      toScoreboardRow(issue({ id: "work-done", title: "d", priority: "high", status: "done" })),
      toScoreboardRow(issue({ id: "work-fresh", title: "c", priority: "high", status: "todo" })),
    ];
    const sorted = sortScoreboardRows(rows);
    // Review band (critical) first, in_review (90%) ahead of flagged todo (0%);
    // then working band (high), unfinished todo ahead of done.
    expect(sorted.map((r) => r.id)).toEqual(["rev-ready", "rev-fresh", "work-fresh", "work-done"]);
  });
});

describe("buildScoreboard", () => {
  it("excludes cancelled, hidden, and the Board Operations backing issue", () => {
    const board = buildScoreboard([
      issue({ id: "a", status: "todo" }),
      issue({ id: "b", status: "cancelled" }),
      issue({ id: "c", hiddenAt: new Date() }),
      issue({ id: "d", title: "Board Operations" }),
    ]);
    expect(board.rows.map((r) => r.id)).toEqual(["a"]);
    expect(board.summary.taskCount).toBe(1);
  });

  it("counts live agents by distinct assignee with an active run", () => {
    const board = buildScoreboard([
      issue({ id: "a", assigneeAgentId: "agent-1", executionRunId: "run-1" }),
      issue({ id: "b", assigneeAgentId: "agent-1", checkoutRunId: "co-1" }),
      issue({ id: "c", assigneeAgentId: "agent-2", executionRunId: "run-2" }),
      issue({ id: "d", assigneeAgentId: "agent-3" }),
    ]);
    expect(board.summary.agentsLive).toBe(2);
  });

  it("computes an importance-weighted overall progress", () => {
    const board = buildScoreboard([
      issue({ id: "a", priority: "critical", status: "done" }), // 100 * 5
      issue({ id: "b", priority: "low", status: "todo" }), //        0 * 2
    ]);
    // (100*5 + 0*2) / (5 + 2) = 71.4 -> 71
    expect(board.summary.overallProgress).toBe(71);
    expect(board.summary.doneCount).toBe(1);
  });

  it("is empty-safe", () => {
    const board = buildScoreboard([]);
    expect(board.summary).toEqual({
      taskCount: 0,
      agentsLive: 0,
      doneCount: 0,
      reviewNeededCount: 0,
      overallProgress: 0,
    });
  });
});

describe("tierFor (VIT-113 ladder)", () => {
  it("maps the star weight to S/A/B/C/D/F with a narrow S band", () => {
    expect(tierFor(5, 5)).toBe("S");
    expect(tierFor(5, 4)).toBe("S");
    expect(tierFor(4, 4)).toBe("A");
    expect(tierFor(4, 3)).toBe("B");
    expect(tierFor(3, 3)).toBe("B");
    expect(tierFor(3, 2)).toBe("C");
    expect(tierFor(2, 2)).toBe("C");
    expect(tierFor(2, 1)).toBe("D");
    expect(tierFor(1, 1)).toBe("F");
  });
});
