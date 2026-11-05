import { describe, expect, it } from "vitest";
import type { Agent, Issue } from "@paperclipai/shared";
import type { MarketCapSnapshot } from "@paperclipai/shared/vitals-market-cap";
import type { RoadmapStageAssignment } from "../pages/Roadmap";
import { computeCompanyGame } from "./company-game";

const NOW = new Date(2026, 8, 17, 12, 0, 0);
const at = (day: number, hour: number) => new Date(2026, 8, day, hour, 0, 0);

function agent(name: string, status: Agent["status"]): Agent {
  return { id: `agent-${name}`, name, status } as unknown as Agent;
}

function issue(overrides: Partial<Issue> & { identifier: string }): Issue {
  return {
    id: `issue-${overrides.identifier}`,
    title: overrides.identifier,
    status: "todo",
    assigneeAgentId: null,
    completedAt: null,
    updatedAt: at(1, 0),
    ...overrides,
  } as unknown as Issue;
}

function stage(sequence: number, progress: number, extra: Partial<RoadmapStageAssignment> = {}): RoadmapStageAssignment {
  return {
    stage: { sequence, title: `Stage ${sequence}` },
    ownerDepartment: { name: `Dept ${sequence}` },
    ownerAgent: null,
    progress,
    dependencyState: "ready",
    isUnblocked: progress < 100,
    evidence: [],
    taskCount: 0,
    projectCount: 0,
    goalCount: 0,
    blockedEvidenceCount: 0,
    highRiskOpenCount: 0,
    ...extra,
  } as unknown as RoadmapStageAssignment;
}

describe("computeCompanyGame", () => {
  it("levels come from fully complete stages, never from activity", () => {
    const stages = [stage(1, 100), stage(2, 100), stage(3, 40), stage(4, 0)];
    const game = computeCompanyGame({
      companyPrefix: "SUM", agents: [], issues: [], stages, constraint: stages[2], snapshot: null, decisions: 0, now: NOW,
    });
    expect(game.level).toBe(3);
    expect(game.totalLevels).toBe(4);
    expect(game.progress).toBe(60);
  });

  it("the boss is the constraint stage with its owner and open quest counts", () => {
    const boss = stage(3, 40, {
      ownerAgent: agent("Operations", "idle"),
      blockedEvidenceCount: 2,
      evidence: [
        { progress: 0, blocked: false }, { progress: 100, blocked: false }, { progress: 10, blocked: true },
      ] as unknown as RoadmapStageAssignment["evidence"],
    });
    const game = computeCompanyGame({
      companyPrefix: "SUM", agents: [], issues: [], stages: [boss], constraint: boss, snapshot: null, decisions: 0, now: NOW,
    });
    expect(game.boss).toEqual({
      stageSequence: 3, stageTitle: "Stage 3", ownerName: "Operations", progress: 40, openQuests: 1, blockedQuests: 2,
    });
  });

  it("a paused owner does not lead the boss stage; the department does", () => {
    const boss = stage(2, 10, { ownerAgent: agent("Reflection Coach", "paused") });
    const game = computeCompanyGame({
      companyPrefix: "SUM", agents: [], issues: [], stages: [boss], constraint: boss, snapshot: null, decisions: 0, now: NOW,
    });
    expect(game.boss?.ownerName).toBe("Dept 2");
  });

  it("gold is $0 verified unless Stripe is connected with a real ARR figure", () => {
    const base = { companyPrefix: "SUM", agents: [], issues: [], stages: [], constraint: null, decisions: 0, now: NOW };
    expect(computeCompanyGame({ ...base, snapshot: null }).gold).toEqual({ label: "$0 verified", verified: false });
    const disconnected = { arrCents: null, arrLabel: "n/a", inputs: { stripeConnected: false } } as unknown as MarketCapSnapshot;
    expect(computeCompanyGame({ ...base, snapshot: disconnected }).gold.verified).toBe(false);
    const connected = { arrCents: 120000, arrLabel: "$1,200", inputs: { stripeConnected: true } } as unknown as MarketCapSnapshot;
    expect(computeCompanyGame({ ...base, snapshot: connected }).gold).toEqual({ label: "$1,200", verified: true });
  });

  it("today counts only quests completed today, newest first, capped at five", () => {
    const issues = [
      issue({ identifier: "SUM-1", status: "done", completedAt: at(17, 8) }),
      issue({ identifier: "SUM-2", status: "done", completedAt: at(16, 23) }),
      issue({ identifier: "SUM-3", status: "done", completedAt: at(17, 10) }),
      ...[4, 5, 6, 7, 8].map((n) => issue({ identifier: `SUM-${n}`, status: "done", completedAt: at(17, n) })),
      issue({ identifier: "SUM-9", status: "in_progress", updatedAt: at(17, 11) }),
    ];
    const game = computeCompanyGame({
      companyPrefix: "SUM", agents: [agent("A", "running"), agent("B", "error"), agent("C", "idle")],
      issues, stages: [], constraint: null, snapshot: null, decisions: 0, now: NOW,
    });
    expect(game.today.completedCount).toBe(7);
    expect(game.today.completed).toHaveLength(5);
    expect(game.today.completed[0].identifier).toBe("SUM-3");
    expect(game.today.completed[0].href).toBe("/SUM/issues/SUM-3");
    expect(game.today.partyRunning).toBe(1);
    expect(game.today.partyErrored).toBe(1);
  });

  it("your turn counts decisions, blocked quests, and open quests with no owner", () => {
    const issues = [
      issue({ identifier: "SUM-1", status: "blocked" }),
      issue({ identifier: "SUM-2", status: "todo" }),
      issue({ identifier: "SUM-3", status: "backlog", assigneeAgentId: "agent-x" }),
      issue({ identifier: "SUM-4", status: "done" }),
    ];
    const game = computeCompanyGame({
      companyPrefix: "SUM", agents: [], issues, stages: [], constraint: null, snapshot: null, decisions: 3, now: NOW,
    });
    expect(game.yourTurn).toEqual({ decisions: 3, blocked: 1, unassigned: 1 });
  });
});
