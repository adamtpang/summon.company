import type { AgentStatus } from "./constants.js";

export type AgentEligibilityLifecycleReason =
  | "eligible"
  | "terminated"
  | "pending_approval"
  | "paused"
  | "invalid_org_chain"
  | "unknown_status";

export interface AgentEligibilityAgent {
  id: string;
  companyId: string;
  name: string;
  status: AgentStatus | string;
  reportsTo?: string | null;
}

export interface CompanyCofounderCandidate {
  id: string;
  role?: string | null;
  reportsTo?: string | null;
  status: AgentStatus | string;
  createdAt?: Date | string | null;
}

export interface AgentOrgChainEntry {
  id: string;
  companyId: string;
  name: string;
  status: AgentStatus | string;
  reportsTo: string | null;
  depth: number;
  relation: "self" | "ancestor";
}

export interface AgentInvalidOrgChainAncestor {
  id: string;
  name: string;
  status: AgentStatus | string;
}

export type AgentOrgChainInvalidReason =
  | "healthy"
  | "terminated_ancestor"
  | "missing_manager"
  | "cycle";

export interface AgentOrgChainHealth {
  status: "healthy" | "invalid_org_chain";
  reason: AgentOrgChainInvalidReason;
  fullChain: AgentOrgChainEntry[];
  firstInvalidAncestor: AgentInvalidOrgChainAncestor | null;
  invalidAncestors: AgentInvalidOrgChainAncestor[];
  repairGuidance: string | null;
}

export interface AgentWorkEligibility {
  assignable: boolean;
  invokable: boolean;
  assignabilityReason: AgentEligibilityLifecycleReason;
  invokabilityReason: AgentEligibilityLifecycleReason;
  orgChainHealth: AgentOrgChainHealth;
}

const NON_ASSIGNABLE_AGENT_STATUSES = new Set<string>(["terminated", "pending_approval"]);
const NON_INVOKABLE_AGENT_STATUSES = new Set<string>(["terminated", "pending_approval", "paused"]);
const ASSIGNABLE_AGENT_STATUSES = new Set<string>(["active", "paused", "idle", "running", "error"]);
const INVOKABLE_AGENT_STATUSES = new Set<string>(["active", "idle", "running", "error"]);

/**
 * One opinionated Cofounder choice for Company Loop and every board-chat
 * surface: CEO first, otherwise a top-level employee, otherwise the oldest
 * remaining employee. Lifecycle eligibility is checked separately so a
 * paused or pending preferred Cofounder fails visibly instead of silently
 * routing board authority to somebody else.
 */
export function selectCompanyCofounder<T extends CompanyCofounderCandidate>(
  companyAgents: readonly T[],
): T | null {
  const rank = (agent: T) => agent.role === "ceo" ? 0 : agent.reportsTo == null ? 1 : 2;
  const createdAtKey = (agent: T) =>
    agent.createdAt instanceof Date
      ? agent.createdAt.toISOString()
      : String(agent.createdAt ?? "");

  return [...companyAgents]
    .filter((agent) => agent.status !== "terminated")
    .sort((left, right) => {
      const rankDifference = rank(left) - rank(right);
      if (rankDifference !== 0) return rankDifference;
      const createdAtDifference = createdAtKey(left).localeCompare(createdAtKey(right));
      if (createdAtDifference !== 0) return createdAtDifference;
      return left.id.localeCompare(right.id);
    })[0] ?? null;
}

export function isAgentStatusAssignableToWork(status: AgentStatus | string): boolean {
  return ASSIGNABLE_AGENT_STATUSES.has(status) && !NON_ASSIGNABLE_AGENT_STATUSES.has(status);
}

export function isAgentStatusInvokable(status: AgentStatus | string): boolean {
  return INVOKABLE_AGENT_STATUSES.has(status) && !NON_INVOKABLE_AGENT_STATUSES.has(status);
}

function chainEntry(
  agent: AgentEligibilityAgent,
  depth: number,
  relation: AgentOrgChainEntry["relation"],
): AgentOrgChainEntry {
  return {
    id: agent.id,
    companyId: agent.companyId,
    name: agent.name,
    status: agent.status,
    reportsTo: agent.reportsTo ?? null,
    depth,
    relation,
  };
}

function invalidAncestor(agent: AgentEligibilityAgent): AgentInvalidOrgChainAncestor {
  return {
    id: agent.id,
    name: agent.name,
    status: agent.status,
  };
}

function buildRepairGuidance(
  agent: AgentEligibilityAgent,
  firstInvalidAncestor: AgentInvalidOrgChainAncestor,
): string {
  if (firstInvalidAncestor.status === "missing") {
    return [
      `${agent.name} reports to missing manager ${firstInvalidAncestor.id}.`,
      `Reassign ${agent.name} or the nearest affected ancestor under an active manager/root, or explicitly pause or terminate the invalid subtree before assigning work or starting runs.`,
    ].join(" ");
  }
  if (firstInvalidAncestor.status === "cycle") {
    return [
      `${agent.name} has a cycle in its reporting chain at ${firstInvalidAncestor.name}.`,
      `Break the cycle by assigning one affected agent to an active manager/root, or explicitly pause or terminate the invalid subtree before assigning work or starting runs.`,
    ].join(" ");
  }
  return [
    `${agent.name} reports through terminated ancestor ${firstInvalidAncestor.name}.`,
    `Reassign ${agent.name} or the nearest affected ancestor under an active manager/root, or explicitly pause or terminate the invalid subtree before assigning work or starting runs.`,
  ].join(" ");
}

export function getAgentOrgChainHealth(input: {
  agent: AgentEligibilityAgent;
  agents: AgentEligibilityAgent[];
}): AgentOrgChainHealth {
  const byId = new Map(input.agents.map((agent) => [agent.id, agent]));
  const fullChain: AgentOrgChainEntry[] = [chainEntry(input.agent, 0, "self")];
  const invalidAncestors: AgentInvalidOrgChainAncestor[] = [];
  const seen = new Set<string>([input.agent.id]);

  let current = input.agent;
  let depth = 1;
  while (current.reportsTo) {
    if (seen.has(current.reportsTo)) {
      const cycleAgent = byId.get(current.reportsTo);
      const invalid = {
        id: current.reportsTo,
        name: cycleAgent?.name ?? current.reportsTo,
        status: "cycle",
      };
      fullChain.push({
        id: invalid.id,
        companyId: input.agent.companyId,
        name: invalid.name,
        status: invalid.status,
        reportsTo: cycleAgent?.reportsTo ?? null,
        depth,
        relation: "ancestor",
      });
      invalidAncestors.push(invalid);
      break;
    }
    seen.add(current.reportsTo);

    const parent = byId.get(current.reportsTo);
    if (!parent || parent.companyId !== input.agent.companyId) {
      const invalid = {
        id: current.reportsTo,
        name: current.reportsTo,
        status: "missing",
      };
      fullChain.push({
        id: invalid.id,
        companyId: input.agent.companyId,
        name: invalid.name,
        status: invalid.status,
        reportsTo: null,
        depth,
        relation: "ancestor",
      });
      invalidAncestors.push(invalid);
      break;
    }

    fullChain.push(chainEntry(parent, depth, "ancestor"));
    if (parent.status === "terminated") {
      invalidAncestors.push(invalidAncestor(parent));
    }

    current = parent;
    depth += 1;
  }

  const firstInvalidAncestor = invalidAncestors[0] ?? null;
  return {
    status: firstInvalidAncestor ? "invalid_org_chain" : "healthy",
    reason: firstInvalidAncestor
      ? firstInvalidAncestor.status === "missing"
        ? "missing_manager"
        : firstInvalidAncestor.status === "cycle"
          ? "cycle"
          : "terminated_ancestor"
      : "healthy",
    fullChain,
    firstInvalidAncestor,
    invalidAncestors,
    repairGuidance: firstInvalidAncestor
      ? buildRepairGuidance(input.agent, firstInvalidAncestor)
      : null,
  };
}

export function getAgentWorkEligibility(input: {
  agent: AgentEligibilityAgent;
  agents: AgentEligibilityAgent[];
}): AgentWorkEligibility {
  const orgChainHealth = getAgentOrgChainHealth(input);
  const assignabilityReason: AgentEligibilityLifecycleReason = !isAgentStatusAssignableToWork(input.agent.status)
    ? input.agent.status === "terminated"
      ? "terminated"
      : input.agent.status === "pending_approval"
        ? "pending_approval"
        : "unknown_status"
    : orgChainHealth.status === "invalid_org_chain"
      ? "invalid_org_chain"
      : "eligible";
  const invokabilityReason: AgentEligibilityLifecycleReason = !isAgentStatusInvokable(input.agent.status)
    ? input.agent.status === "terminated"
      ? "terminated"
      : input.agent.status === "pending_approval"
        ? "pending_approval"
        : input.agent.status === "paused"
          ? "paused"
          : "unknown_status"
    : orgChainHealth.status === "invalid_org_chain"
      ? "invalid_org_chain"
      : "eligible";

  return {
    assignable: assignabilityReason === "eligible",
    invokable: invokabilityReason === "eligible",
    assignabilityReason,
    invokabilityReason,
    orgChainHealth,
  };
}

export function isAgentAssignableToWork(input: {
  agent: AgentEligibilityAgent;
  agents: AgentEligibilityAgent[];
}): boolean {
  return getAgentWorkEligibility(input).assignable;
}

export function isAgentInvokable(input: {
  agent: AgentEligibilityAgent;
  agents: AgentEligibilityAgent[];
}): boolean {
  return getAgentWorkEligibility(input).invokable;
}
