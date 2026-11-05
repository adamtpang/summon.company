import { describe, expect, it } from "vitest";
import type { Agent, AttentionFeed, AttentionItem, Issue } from "@paperclipai/shared";
import { computeYourTurn } from "./your-turn";

const agent = (id: string, name: string, status: string, errorReason: string | null = null) =>
  ({ id, name, status, errorReason }) as unknown as Agent;

const issue = (id: string, identifier: string, status: string, assigneeAgentId: string | null, updatedAt = "2026-09-26T10:00:00Z") =>
  ({ id, identifier, title: `Quest ${identifier}`, status, assigneeAgentId, updatedAt }) as unknown as Issue;

const decision = (id: string, issueId: string | null, dismissed = false) =>
  ({
    id,
    subject: { kind: "interaction", id: `i-${id}`, title: "Confirmation requested", href: `/SUM/x#${id}`, metadata: issueId ? { issueId } : {} },
    relatedIssue: issueId ? { kind: "issue", id: issueId, title: "Related", href: "/SUM/issues/X" } : null,
    whyNow: "Confirm or decline.",
    dismissal: dismissed ? { at: "x" } : null,
  }) as unknown as AttentionItem;

const feed = (items: AttentionItem[]) => ({ items }) as unknown as AttentionFeed;

describe("computeYourTurn", () => {
  const agents = [
    agent("eng", "Engineering", "running"),
    agent("des", "Design", "idle"),
    agent("sal", "Sales", "error", "OAuth session expired"),
    agent("cof", "Cofounder", "paused"),
  ];

  it("routes a decision to the department that owns its issue and puts that card first", () => {
    const issues = [issue("1", "SUM-1", "in_progress", "des")];
    const turn = computeYourTurn({ companyPrefix: "SUM", agents, issues, attention: feed([decision("d1", "1")]) });
    expect(turn.cards[0].name).toBe("Design");
    expect(turn.cards[0].state).toBe("needs_you");
    expect(turn.cards[0].items[0].kind).toBe("decision");
    expect(turn.needsYouTotal).toBe(1);
  });

  it("bands the rest as error, then working, then idle, and hides paused agents", () => {
    const turn = computeYourTurn({ companyPrefix: "SUM", agents, issues: [], attention: feed([]) });
    expect(turn.cards.map((c) => [c.name, c.state])).toEqual([
      ["Sales", "error"],
      ["Engineering", "working"],
      ["Design", "idle"],
    ]);
    expect(turn.cards[0].errorReason).toBe("OAuth session expired");
  });

  it("counts a blocked issue as needing the board on its owner's card", () => {
    const issues = [issue("2", "SUM-2", "blocked", "eng")];
    const turn = computeYourTurn({ companyPrefix: "SUM", agents, issues, attention: feed([]) });
    const eng = turn.cards.find((c) => c.name === "Engineering")!;
    expect(eng.state).toBe("needs_you");
    expect(eng.items[0]).toMatchObject({ kind: "blocked", href: "/SUM/issues/SUM-2" });
  });

  it("puts ownerless decisions and paused owners on a Board card, and skips dismissed ones", () => {
    const issues = [issue("3", "SUM-3", "done", "cof")];
    const turn = computeYourTurn({
      companyPrefix: "SUM",
      agents,
      issues,
      attention: feed([decision("d2", null), decision("d3", "3"), decision("d4", null, true)]),
    });
    const board = turn.cards.find((c) => c.name === "Board")!;
    expect(board.items).toHaveLength(2);
    expect(turn.needsYouTotal).toBe(2);
  });

  it("shows what a department is on: in-progress first, then the newest open quest", () => {
    const issues = [
      issue("4", "SUM-4", "todo", "eng", "2026-09-26T12:00:00Z"),
      issue("5", "SUM-5", "in_progress", "eng", "2026-09-26T09:00:00Z"),
      issue("6", "SUM-6", "done", "eng", "2026-09-26T13:00:00Z"),
    ];
    const turn = computeYourTurn({ companyPrefix: "SUM", agents, issues, attention: feed([]) });
    expect(turn.cards.find((c) => c.name === "Engineering")!.focus?.identifier).toBe("SUM-5");
  });
});
