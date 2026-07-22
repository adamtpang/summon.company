import type { Issue } from "@paperclipai/shared";
import type { IssueAgeInfo } from "./issue-age";

/**
 * The five-gate Algorithm (doc/research/ELON-OPERATING-MODEL.md §1.1, §3.1):
 * question requirements → delete → simplify → accelerate → automate, IN ORDER.
 * Gate state is derived from data the task already carries — no new fields.
 */

export type AlgorithmGateKey =
  | "requirements"
  | "delete"
  | "simplify"
  | "accelerate"
  | "automate";

export type AlgorithmGateState =
  /** Cleared — the question was answered. */
  | "passed"
  /** The gate the task is currently at. */
  | "active"
  /** The gate is failing loudly (missing owner, aging timeline). */
  | "attention"
  /** Not reached yet — earlier gates come first. */
  | "pending";

export interface AlgorithmGate {
  key: AlgorithmGateKey;
  label: string;
  question: string;
  state: AlgorithmGateState;
  detail: string;
}

export interface RequirementOwner {
  kind: "agent" | "user" | "unknown";
  name: string | null;
}

type GateIssueFields = {
  status: Issue["status"];
  createdByAgentId: string | null;
  createdByUserId: string | null;
  startedAt: Date | string | null;
};

/**
 * "You must know the name of the real person who made every requirement."
 * The requirement owner is whoever created the task — a named agent or a
 * named human, never a department.
 */
export function deriveRequirementOwner(
  issue: Pick<Issue, "createdByAgentId" | "createdByUserId">,
  agentNameById?: Map<string, string>,
  userLabel?: string | null,
): RequirementOwner {
  if (issue.createdByAgentId) {
    return {
      kind: "agent",
      name: agentNameById?.get(issue.createdByAgentId) ?? null,
    };
  }
  if (issue.createdByUserId) {
    return { kind: "user", name: userLabel ?? "Board" };
  }
  return { kind: "unknown", name: null };
}

export function deriveAlgorithmGates(
  issue: GateIssueFields,
  owner: RequirementOwner,
  age?: IssueAgeInfo | null,
): AlgorithmGate[] {
  const status = issue.status;
  const cancelled = status === "cancelled";
  const done = status === "done";
  const started = status === "in_progress" || status === "in_review" || Boolean(issue.startedAt);
  const waiting = status === "backlog" || status === "todo";

  const requirements: AlgorithmGate = owner.name
    ? {
        key: "requirements",
        label: "Requirements",
        question: "Who requires this?",
        state: "passed",
        detail: owner.name,
      }
    : {
        key: "requirements",
        label: "Requirements",
        question: "Who requires this?",
        state: "attention",
        detail: "No named owner, a requirement without a person is not a requirement",
      };

  const deleteGate: AlgorithmGate = cancelled
    ? {
        key: "delete",
        label: "Delete",
        question: "Should this exist?",
        state: "passed",
        detail: "Deleted, the cheapest task is the one that doesn't exist",
      }
    : waiting
      ? {
          key: "delete",
          label: "Delete",
          question: "Should this exist?",
          state: "active",
          detail: "Still cheap to delete, propose deletion if this shouldn't exist",
        }
      : {
          key: "delete",
          label: "Delete",
          question: "Should this exist?",
          state: "passed",
          detail: "Survived deletion review, work started",
        };

  const simplify: AlgorithmGate = cancelled
    ? { key: "simplify", label: "Simplify", question: "What can be removed?", state: "pending", detail: "·" }
    : done || status === "in_review"
      ? { key: "simplify", label: "Simplify", question: "What can be removed?", state: "passed", detail: "Scope settled" }
      : started
        ? { key: "simplify", label: "Simplify", question: "What can be removed?", state: "active", detail: "Shrink scope before adding speed" }
        : { key: "simplify", label: "Simplify", question: "What can be removed?", state: "pending", detail: "After the delete question" };

  let accelerate: AlgorithmGate;
  if (cancelled) {
    accelerate = { key: "accelerate", label: "Accelerate", question: "Why is it slow?", state: "pending", detail: "·" };
  } else if (done) {
    accelerate = { key: "accelerate", label: "Accelerate", question: "Why is it slow?", state: "passed", detail: "Shipped" };
  } else if (started || status === "blocked") {
    if (age && age.tier !== "calm") {
      accelerate = {
        key: "accelerate",
        label: "Accelerate",
        question: "Why is it slow?",
        state: "attention",
        detail: `${age.stateLabel} for ${age.compact} - if a timeline is long, it's wrong`,
      };
    } else {
      accelerate = {
        key: "accelerate",
        label: "Accelerate",
        question: "Why is it slow?",
        state: "active",
        detail: age ? `${age.stateLabel} for ${age.compact}` : "In flight",
      };
    }
  } else {
    accelerate = { key: "accelerate", label: "Accelerate", question: "Why is it slow?", state: "pending", detail: "Not started" };
  }

  const automate: AlgorithmGate = done
    ? {
        key: "automate",
        label: "Automate",
        question: "Will this recur?",
        state: "active",
        detail: "Done, if this recurs, make it a routine",
      }
    : {
        key: "automate",
        label: "Automate",
        question: "Will this recur?",
        state: "pending",
        detail: "Automation comes last",
      };

  return [requirements, deleteGate, simplify, accelerate, automate];
}

/** The first gate that isn't cleared — where the task "is" in the Algorithm. */
export function currentGateIndex(gates: AlgorithmGate[]): number {
  const index = gates.findIndex((gate) => gate.state !== "passed");
  return index === -1 ? gates.length - 1 : index;
}
