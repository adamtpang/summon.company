import { describe, expect, it } from "vitest";
import type { Issue, IssuePriority, IssueStatus } from "@paperclipai/shared";
import {
  buildScoreboard,
  deriveInboxScore,
  deriveProgress,
  importanceStarsFor,
  isReviewNeeded,
  isRunLive,
  moneyInvolvedStarsFor,
  routeFor,
  sortIssuesByInboxScore,
  sortScoreboardRows,
  tierForFour,
  timeInvolvedStarsFor,
  toScoreboardRow,
  urgencyStarsFor,
  tierFor,
  workTypeTagFor,
  parseWinConditionItems,
  coarseDishProgress,
  dishBlockerText,
  deriveWinCondition,
} from "./scoreboard";

/** Attach labels to a bare issue for the SUM-148 four-input tests. */
function labeled(names: string[], overrides: Partial<Issue> = {}): Issue {
  return issue({
    labels: names.map((name, i) => ({ id: `l-${i}`, name })),
    ...overrides,
  } as Partial<Issue>);
}

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

/* --- SUM-148: four-input scoring, tags, and routing --------------------- */

describe("timeInvolvedStarsFor / moneyInvolvedStarsFor", () => {
  it("reads namespaced size labels into 1..5 stars", () => {
    expect(timeInvolvedStarsFor(labeled(["time:xs"]))).toBe(1);
    expect(timeInvolvedStarsFor(labeled(["time:l"]))).toBe(4);
    expect(moneyInvolvedStarsFor(labeled(["money:xl"]))).toBe(5);
    expect(moneyInvolvedStarsFor(labeled(["money:s"]))).toBe(2);
  });

  it("is neutral (3) when the board has not tagged the input", () => {
    expect(timeInvolvedStarsFor(labeled([]))).toBe(3);
    expect(moneyInvolvedStarsFor(labeled(["engineering"]))).toBe(3);
    // Bare issue with no labels array at all must not throw.
    expect(timeInvolvedStarsFor(issue())).toBe(3);
  });

  it("is case-insensitive and ignores unrelated labels", () => {
    expect(timeInvolvedStarsFor(labeled(["TIME:M", "engineering"]))).toBe(3);
    expect(moneyInvolvedStarsFor(labeled(["Money:L"]))).toBe(4);
  });
});

describe("workTypeTagFor", () => {
  it("prefers a dept: label, then a bare department label, with synonyms", () => {
    expect(workTypeTagFor(labeled(["dept:engineering"]))).toBe("engineering");
    expect(workTypeTagFor(labeled(["design"]))).toBe("design");
    expect(workTypeTagFor(labeled(["growth"]))).toBe("marketing");
    expect(workTypeTagFor(labeled(["operations"]))).toBe("ops");
  });

  it("lets a dept: label win over a bare one", () => {
    expect(workTypeTagFor(labeled(["sales", "dept:finance"]))).toBe("finance");
  });

  it("returns null when no work type is tagged", () => {
    expect(workTypeTagFor(labeled(["time:l", "money:s"]))).toBeNull();
    expect(workTypeTagFor(issue())).toBeNull();
  });
});

describe("routeFor", () => {
  it("routes each work type to its named agent", () => {
    expect(routeFor("engineering")?.agentNameKey).toBe("Forge");
    expect(routeFor("design")?.agentNameKey).toBe("Ink");
    expect(routeFor("marketing")?.agentNameKey).toBe("Echo");
    expect(routeFor("sales")?.agentNameKey).toBe("Vector");
    expect(routeFor("finance")?.agentNameKey).toBe("Ledger");
    expect(routeFor("ops")?.agentNameKey).toBe("Atlas");
    expect(routeFor("support")?.agentNameKey).toBe("Pulse");
  });

  it("leaves legal unrouted (board dispatches) and null-safe", () => {
    expect(routeFor("legal")?.agentNameKey).toBeNull();
    expect(routeFor(null)).toBeNull();
  });
});

describe("tierForFour", () => {
  it("rewards high value at low effort with S, penalizes heavy lifts", () => {
    // max value, minimum time -> 5+5+5+(6-1)=20
    expect(tierForFour(5, 5, 1, 5)).toBe("S");
    // same value but max time -> 5+5+5+(6-5)=16 -> A
    expect(tierForFour(5, 5, 5, 5)).toBe("A");
    // neutral everything -> 3+3+3+(6-3)=12 -> B
    expect(tierForFour(3, 3, 3, 3)).toBe("B");
    // low value, high effort -> 2+1+1+(6-5)=5 -> F
    expect(tierForFour(2, 1, 5, 1)).toBe("F");
  });
});

describe("deriveInboxScore", () => {
  it("assembles all four inputs, tier, tag, and route from one issue", () => {
    const s = deriveInboxScore(
      labeled(["dept:engineering", "time:xs", "money:xl"], {
        priority: "critical",
        status: "in_review",
      }),
    );
    expect(s.importanceStars).toBe(5);
    expect(s.urgencyStars).toBe(5); // in_review is pressing
    expect(s.timeStars).toBe(1);
    expect(s.moneyStars).toBe(5);
    expect(s.tier).toBe("S");
    expect(s.workType).toBe("engineering");
    expect(s.route?.agentNameKey).toBe("Forge");
  });

  it("falls back to neutral inputs and no route when untagged", () => {
    const s = deriveInboxScore(issue({ priority: "medium", status: "todo" }));
    expect(s.timeStars).toBe(3);
    expect(s.moneyStars).toBe(3);
    expect(s.workType).toBeNull();
    expect(s.route).toBeNull();
  });
});

describe("sortIssuesByInboxScore", () => {
  it("ranks by tier, then four-input score, then title", () => {
    const s = labeled(["time:xs", "money:xl"], { id: "s", title: "S task", priority: "critical", status: "in_review" });
    const f = labeled(["time:xl", "money:xs"], { id: "f", title: "F task", priority: "low", status: "backlog" });
    const bHi = labeled(["money:l"], { id: "b-hi", title: "B high", priority: "high", status: "in_progress" });
    const bLo = labeled(["money:s"], { id: "b-lo", title: "B low", priority: "high", status: "in_progress" });
    const sorted = sortIssuesByInboxScore([bLo, f, s, bHi]);
    expect(sorted[0].id).toBe("s");
    expect(sorted[sorted.length - 1].id).toBe("f");
    // bHi outranks bLo on money within the same tier band.
    expect(sorted.indexOf(bHi)).toBeLessThan(sorted.indexOf(bLo));
  });
});

/* SUM-229 — win-condition progress derivations. */

describe("parseWinConditionItems", () => {
  it("reads markdown task lists, checked and unchecked", () => {
    const items = parseWinConditionItems(
      "Intro prose\n- [ ] ship the route\n* [x] wire the score\n- [X] add tests\nplain bullet\n- not a checkbox",
    );
    expect(items).toEqual([
      { text: "ship the route", checked: false },
      { text: "wire the score", checked: true },
      { text: "add tests", checked: true },
    ]);
  });

  it("returns [] for empty or checkbox-free text", () => {
    expect(parseWinConditionItems(null)).toEqual([]);
    expect(parseWinConditionItems("just a description")).toEqual([]);
  });
});

describe("coarseDishProgress", () => {
  it("follows the board ladder: queued 5, assigned 15, cooking 55, plated 90, done 100", () => {
    expect(coarseDishProgress(issue({ status: "backlog", assigneeAgentId: null }), false).progress).toBe(5);
    expect(coarseDishProgress(issue({ status: "todo", assigneeAgentId: "a1" }), false).progress).toBe(15);
    expect(coarseDishProgress(issue({ status: "in_progress" }), true)).toEqual({ progress: 55, label: "Cooking" });
    expect(coarseDishProgress(issue({ status: "in_progress" }), false).progress).toBe(15);
    expect(coarseDishProgress(issue({ status: "in_review" }), false).progress).toBe(90);
    expect(coarseDishProgress(issue({ status: "done" }), false).progress).toBe(100);
  });
});

describe("dishBlockerText", () => {
  it("prefers the inbox-attention action and owner", () => {
    const withAction = issue({
      blockedInboxAttention: {
        reason: "pending_board_decision",
        action: { label: "Approve the plan", detail: null },
        owner: { label: "Board", type: "board", agentId: null, userId: null },
      } as never,
    });
    expect(dishBlockerText(withAction)).toBe("Approve the plan · Board");
  });

  it("falls back to a humanized reason then to Blocked", () => {
    expect(
      dishBlockerText(issue({ blockedInboxAttention: { reason: "open_recovery_issue" } as never })),
    ).toBe("Open recovery issue");
    expect(dishBlockerText(issue({ blockedInboxAttention: null }))).toBe("Blocked");
  });
});

describe("deriveWinCondition", () => {
  it("uses the checklist fraction when >= 2 criteria are declared", () => {
    const wc = deriveWinCondition(
      issue({ status: "in_progress", description: "- [x] one\n- [x] two\n- [ ] three\n- [ ] four" }),
      { cooking: true },
    );
    expect(wc.mode).toBe("checklist");
    expect(wc.checkedCount).toBe(2);
    expect(wc.totalCount).toBe(4);
    expect(wc.progress).toBe(50);
    expect(wc.label).toBe("2/4 criteria");
  });

  it("reads 100 for a done dish even mid-checklist", () => {
    const wc = deriveWinCondition(
      issue({ status: "done", description: "- [x] one\n- [ ] two" }),
      { cooking: false },
    );
    expect(wc.progress).toBe(100);
  });

  it("falls back to the coarse ladder with fewer than 2 criteria", () => {
    const wc = deriveWinCondition(
      issue({ status: "in_progress", description: "- [ ] only one" }),
      { cooking: true },
    );
    expect(wc.mode).toBe("coarse");
    expect(wc.progress).toBe(55);
  });

  it("short-circuits to the blocker for a blocked dish", () => {
    const wc = deriveWinCondition(
      issue({ status: "blocked", description: "- [x] a\n- [ ] b", blockedInboxAttention: { reason: "pending_user_decision" } as never }),
      { cooking: false },
    );
    expect(wc.mode).toBe("blocked");
    expect(wc.blocker).toBe("Awaiting a user decision");
  });

  it("folds extra plan text in alongside the description", () => {
    const wc = deriveWinCondition(
      issue({ status: "in_progress", description: "no criteria here" }),
      { cooking: false, extraText: "- [x] from plan\n- [ ] also plan" },
    );
    expect(wc.mode).toBe("checklist");
    expect(wc.totalCount).toBe(2);
  });
});
