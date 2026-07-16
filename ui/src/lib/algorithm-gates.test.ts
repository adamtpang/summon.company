import { describe, expect, it } from "vitest";
import {
  currentGateIndex,
  deriveAlgorithmGates,
  deriveRequirementOwner,
} from "./algorithm-gates";
import { deriveIssueAge } from "./issue-age";
import type { IssueStatus } from "@paperclipai/shared";

const NOW = new Date("2026-07-16T12:00:00Z").getTime();

function gateIssue(status: IssueStatus, overrides: Partial<{
  createdByAgentId: string | null;
  createdByUserId: string | null;
  startedAt: string | null;
}> = {}) {
  return {
    status,
    createdByAgentId: overrides.createdByAgentId ?? null,
    createdByUserId: overrides.createdByUserId !== undefined ? overrides.createdByUserId : "user-1",
    startedAt: overrides.startedAt ?? null,
  };
}

describe("deriveRequirementOwner", () => {
  it("names the creating agent", () => {
    const owner = deriveRequirementOwner(
      { createdByAgentId: "agent-1", createdByUserId: null },
      new Map([["agent-1", "Vitals CTO"]]),
    );
    expect(owner).toEqual({ kind: "agent", name: "Vitals CTO" });
  });

  it("falls back to the board for user creators", () => {
    const owner = deriveRequirementOwner({ createdByAgentId: null, createdByUserId: "user-1" });
    expect(owner).toEqual({ kind: "user", name: "Board" });
  });

  it("is unknown when no creator is recorded", () => {
    const owner = deriveRequirementOwner({ createdByAgentId: null, createdByUserId: null });
    expect(owner).toEqual({ kind: "unknown", name: null });
  });
});

describe("deriveAlgorithmGates", () => {
  const owner = { kind: "user" as const, name: "Board" };

  it("flags a missing requirement owner as attention on gate 1", () => {
    const gates = deriveAlgorithmGates(gateIssue("todo"), { kind: "unknown", name: null });
    expect(gates[0]).toMatchObject({ key: "requirements", state: "attention" });
    expect(currentGateIndex(gates)).toBe(0);
  });

  it("keeps the delete gate active while work is still waiting", () => {
    const gates = deriveAlgorithmGates(gateIssue("todo"), owner);
    expect(gates[0].state).toBe("passed");
    expect(gates[1]).toMatchObject({ key: "delete", state: "active" });
    expect(currentGateIndex(gates)).toBe(1);
  });

  it("treats cancellation as a passed delete gate", () => {
    const gates = deriveAlgorithmGates(gateIssue("cancelled"), owner);
    expect(gates[1]).toMatchObject({ state: "passed", detail: expect.stringContaining("Deleted") });
  });

  it("moves started work to the simplify gate", () => {
    const gates = deriveAlgorithmGates(gateIssue("in_progress", { startedAt: "2026-07-16T11:00:00Z" }), owner);
    expect(gates[1].state).toBe("passed");
    expect(gates[2]).toMatchObject({ key: "simplify", state: "active" });
    expect(currentGateIndex(gates)).toBe(2);
  });

  it("escalates the accelerate gate when the timeline is long", () => {
    const issue = gateIssue("in_progress", { startedAt: "2026-07-10T12:00:00Z" });
    const age = deriveIssueAge(
      { status: "in_progress", startedAt: "2026-07-10T12:00:00Z", createdAt: "2026-07-10T12:00:00Z", updatedAt: "2026-07-10T12:00:00Z" },
      NOW,
    );
    const gates = deriveAlgorithmGates(issue, owner, age);
    expect(gates[3]).toMatchObject({ key: "accelerate", state: "attention" });
    expect(gates[3].detail).toContain("if a timeline is long, it's wrong");
  });

  it("activates automate only when the task is done", () => {
    const todoGates = deriveAlgorithmGates(gateIssue("todo"), owner);
    expect(todoGates[4]).toMatchObject({ key: "automate", state: "pending" });
    const doneGates = deriveAlgorithmGates(gateIssue("done", { startedAt: "2026-07-15T12:00:00Z" }), owner);
    expect(doneGates[4]).toMatchObject({ key: "automate", state: "active" });
    expect(currentGateIndex(doneGates)).toBe(4);
  });
});
