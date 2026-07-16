import { and, eq } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { agents, approvals, issueApprovals } from "@paperclipai/db";
import { forbidden, notFound, unprocessable } from "../errors.js";
import { logActivity } from "./activity-log.js";

/**
 * Risk-rated async approval gate (VIT-45), the durable enforcement of the
 * board-ratified VIT-15 Policy v1. Deliberately built on existing primitives —
 * the `approvals` table, `issue_approvals` links, and the activity log — with
 * all gate-specific state in the approval payload, because the source
 * migration journal cannot diverge from the live packaged runtime (VIT-14).
 *
 * A gated action never holds a live process: the initiator's run ends after
 * `requestGate` persists the approval record, and the existing
 * `approval_approved` wake on POST /approvals/:id/approve resumes the
 * initiator once the decision lands. Restart survival is the DB row.
 */

export const RISK_GATED_ACTION_APPROVAL_TYPE = "risk_gated_action";

export type RiskTier = "low" | "medium" | "high";
export type TrustLevel = "untrusted" | "trusted" | "autonomous";
export type ApprovalGateKind = "none" | "founder" | "board";
export type ApprovalRoute = "auto_approve" | "digest" | "board_urgent";

export interface RiskAxes {
  reversibility: "reversible" | "recoverable" | "irreversible";
  blastRadius: "internal" | "one_external_party" | "public";
  moneyAtStakeUsd: number;
  moneyRecurring?: boolean;
  dataLegal: "none" | "internal_customer_data" | "sensitive";
}

export type RiskAxisName = keyof Pick<RiskAxes, "reversibility" | "blastRadius" | "dataLegal"> | "money";

/**
 * Policy v1 always-ask carve-outs: never auto-approved at any tier or trust
 * level. Mirrors the CEO board-approval list.
 */
export const ALWAYS_ASK_CATEGORIES = [
  "hire",
  "budget_increase",
  "incorporation",
  "banking",
  "contract",
  "production_deploy",
  "customer_data_access",
  "destructive_change",
  "public_claim",
  "outbound_message",
  "credential_handling",
] as const;

export type AlwaysAskCategory = (typeof ALWAYS_ASK_CATEGORIES)[number];

const TIER_RANK: Record<RiskTier, number> = { low: 0, medium: 1, high: 2 };
const TRUST_RANK: Record<TrustLevel, number> = { untrusted: 0, trusted: 1, autonomous: 2 };

/** Policy v1 §5: above this fraction of budget spent, MED stops auto-approving. */
export const BUDGET_TIGHTEN_FRACTION = 0.8;

function moneyTier(axes: RiskAxes): RiskTier {
  if (axes.moneyRecurring || axes.moneyAtStakeUsd > 200) return "high";
  if (axes.moneyAtStakeUsd > 20) return "medium";
  return "low";
}

const REVERSIBILITY_TIER: Record<RiskAxes["reversibility"], RiskTier> = {
  reversible: "low",
  recoverable: "medium",
  irreversible: "high",
};

const BLAST_RADIUS_TIER: Record<RiskAxes["blastRadius"], RiskTier> = {
  internal: "low",
  one_external_party: "medium",
  public: "high",
};

const DATA_LEGAL_TIER: Record<RiskAxes["dataLegal"], RiskTier> = {
  none: "low",
  internal_customer_data: "medium",
  sensitive: "high",
};

/** Policy v1 §1: score all four axes; the tier is the highest axis reached. */
export function classifyRiskTier(axes: RiskAxes): { tier: RiskTier; drivingAxis: RiskAxisName } {
  const scores: Array<{ axis: RiskAxisName; tier: RiskTier }> = [
    { axis: "reversibility", tier: REVERSIBILITY_TIER[axes.reversibility] },
    { axis: "blastRadius", tier: BLAST_RADIUS_TIER[axes.blastRadius] },
    { axis: "money", tier: moneyTier(axes) },
    { axis: "dataLegal", tier: DATA_LEGAL_TIER[axes.dataLegal] },
  ];
  let winner = scores[0];
  for (const score of scores) {
    if (TIER_RANK[score.tier] > TIER_RANK[winner.tier]) winner = score;
  }
  return { tier: winner.tier, drivingAxis: winner.axis };
}

export function isAlwaysAskCategory(category: string): category is AlwaysAskCategory {
  return (ALWAYS_ASK_CATEGORIES as readonly string[]).includes(category);
}

export interface ApprovalRouteDecision {
  route: ApprovalRoute;
  gate: ApprovalGateKind;
  autoApproved: boolean;
  reason: string;
}

/**
 * Policy v1 §2 + §3 + §5: tier × trust × budget → route.
 * Pure so every decision is unit-testable and replayable from its inputs.
 */
export function decideApprovalRoute(input: {
  tier: RiskTier;
  trustLevel: TrustLevel;
  categories: string[];
  /** Whether the action's cost fits the agent's standing budget. */
  withinStandingBudget: boolean;
  /** Fraction of the monthly budget already spent (null when unknown → treated as tightened). */
  budgetUsedFraction: number | null;
  reversible: boolean;
  urgent?: boolean;
}): ApprovalRouteDecision {
  const alwaysAsk = input.categories.filter(isAlwaysAskCategory);
  const budgetTightened =
    input.budgetUsedFraction === null || input.budgetUsedFraction >= BUDGET_TIGHTEN_FRACTION;

  if (alwaysAsk.length > 0) {
    return {
      route: input.urgent ? "board_urgent" : "digest",
      gate: "board",
      autoApproved: false,
      reason: `always-ask category: ${alwaysAsk.join(", ")}`,
    };
  }

  if (input.tier === "low") {
    return { route: "auto_approve", gate: "none", autoApproved: true, reason: "LOW auto-approves, log-only" };
  }

  if (input.tier === "medium") {
    if (
      TRUST_RANK[input.trustLevel] >= TRUST_RANK.trusted
      && input.withinStandingBudget
      && !budgetTightened
    ) {
      return {
        route: "auto_approve",
        gate: "none",
        autoApproved: true,
        reason: "MED auto-approved: trust ≥ Trusted, within budget, below 80% spend",
      };
    }
    return {
      route: "digest",
      gate: budgetTightened ? "board" : "founder",
      autoApproved: false,
      reason: budgetTightened
        ? "MED requires board: budget at or above 80% (or unknown)"
        : "MED requires founder approval: trust or standing budget insufficient",
    };
  }

  // HIGH: board approval, except a proven Autonomous agent may auto-approve a
  // reversible HIGH within budget (Policy v1 §3).
  if (
    input.trustLevel === "autonomous"
    && input.reversible
    && input.withinStandingBudget
    && !budgetTightened
  ) {
    return {
      route: "auto_approve",
      gate: "none",
      autoApproved: true,
      reason: "HIGH auto-approved: Autonomous trust, reversible, within budget",
    };
  }
  return {
    route: input.urgent ? "board_urgent" : "digest",
    gate: "board",
    autoApproved: false,
    reason: input.urgent ? "HIGH urgent: immediate board approval" : "HIGH batches into board digest",
  };
}

export interface EvidenceItem {
  kind: string;
  /** Human-readable summary of the evidence item. */
  summary: string;
  /** Optional pointer: URL, file path (forward slashes), or record id. */
  ref?: string;
}

export interface ApprovalGatePayload extends Record<string, unknown> {
  action: string;
  evidence: EvidenceItem[];
  riskTier: RiskTier;
  drivingAxis: RiskAxisName;
  axes: RiskAxes;
  categories: string[];
  initiatorAgentId: string;
  initiatorRunId: string | null;
  initiatorParentAgentId: string | null;
  budgetImpactCents: number;
  route: ApprovalRoute;
  gate: ApprovalGateKind;
  reason: string;
  urgent: boolean;
  /** Policy v1 §4 timeout rule: LOW/MED fail open, HIGH fails closed. */
  defaultOnTimeout: "fail_open" | "fail_closed";
  decidedByAgentId?: string | null;
}

function readTrustLevel(metadata: Record<string, unknown> | null | undefined): TrustLevel {
  const raw = metadata?.trustLevel;
  if (raw === "untrusted" || raw === "autonomous") return raw;
  // Policy v1 §3: Trusted is the default for the core-8.
  return "trusted";
}

const MAX_LINEAGE_HOPS = 16;

/**
 * Structural separation of duties: an agent can never approve its own
 * proposal, and a sub-agent can never approve its parent's (walked via
 * agents.reports_to). Board/user approvers are structurally distinct from
 * agent initiators and always pass. Violations are logged before refusal.
 */
export async function assertSeparationOfDuties(db: Db, input: {
  companyId: string;
  approvalId: string;
  initiatorAgentId: string;
  approverAgentId?: string | null;
  approverUserId?: string | null;
}): Promise<void> {
  const approverAgentId = input.approverAgentId ?? null;
  if (!approverAgentId) return;

  let violation: "self_approval" | "sub_agent_of_initiator" | null = null;
  if (approverAgentId === input.initiatorAgentId) {
    violation = "self_approval";
  } else {
    let currentId: string | null = approverAgentId;
    for (let hop = 0; hop < MAX_LINEAGE_HOPS && currentId; hop += 1) {
      const row: { reportsTo: string | null } | null = await db
        .select({ reportsTo: agents.reportsTo })
        .from(agents)
        .where(eq(agents.id, currentId))
        .then((rows: Array<{ reportsTo: string | null }>) => rows[0] ?? null);
      currentId = row?.reportsTo ?? null;
      if (currentId === input.initiatorAgentId) {
        violation = "sub_agent_of_initiator";
        break;
      }
    }
  }

  if (!violation) return;

  await logActivity(db, {
    companyId: input.companyId,
    actorType: "system",
    actorId: "approval-gate",
    action: "approval_gate.self_approval_blocked",
    entityType: "approval",
    entityId: input.approvalId,
    agentId: approverAgentId,
    details: {
      violation,
      approvalId: input.approvalId,
      initiatorAgentId: input.initiatorAgentId,
      approverAgentId,
    },
  });
  throw forbidden(
    violation === "self_approval"
      ? "Separation of duties: an agent cannot approve its own proposal."
      : "Separation of duties: a sub-agent cannot approve its parent's proposal.",
    {
      code: "approval_gate_separation_of_duties",
      violation,
      approvalId: input.approvalId,
    },
  );
}

export function approvalGateService(db: Db) {
  async function getGateApproval(approvalId: string) {
    const approval = await db
      .select()
      .from(approvals)
      .where(eq(approvals.id, approvalId))
      .then((rows: Array<typeof approvals.$inferSelect>) => rows[0] ?? null);
    if (!approval) throw notFound("Approval not found");
    if (approval.type !== RISK_GATED_ACTION_APPROVAL_TYPE) {
      throw unprocessable("Approval is not a risk-gated action gate");
    }
    return approval;
  }

  return {
    /**
     * Classify, decide, and either auto-apply (audit record only) or suspend:
     * persist a durable approval record and return without holding any live
     * process. The caller's run should end; the approve-route wake resumes it.
     */
    requestGate: async (input: {
      companyId: string;
      issueId?: string | null;
      action: string;
      evidence: EvidenceItem[];
      axes: RiskAxes;
      categories?: string[];
      initiatorAgentId: string;
      initiatorRunId?: string | null;
      budgetImpactCents?: number;
      urgent?: boolean;
    }) => {
      const action = input.action.trim();
      if (!action) throw unprocessable("Gated action description is required");

      const initiator = await db
        .select({
          id: agents.id,
          reportsTo: agents.reportsTo,
          metadata: agents.metadata,
          budgetMonthlyCents: agents.budgetMonthlyCents,
          spentMonthlyCents: agents.spentMonthlyCents,
        })
        .from(agents)
        .where(eq(agents.id, input.initiatorAgentId))
        .then((rows: Array<{
          id: string;
          reportsTo: string | null;
          metadata: Record<string, unknown> | null;
          budgetMonthlyCents: number | null;
          spentMonthlyCents: number | null;
        }>) => rows[0] ?? null);
      if (!initiator) throw notFound("Initiator agent not found");

      const trustLevel = readTrustLevel(initiator.metadata);
      const budgetImpactCents = Math.max(0, Math.round(input.budgetImpactCents ?? 0));
      const budgetMonthlyCents = initiator.budgetMonthlyCents ?? 0;
      const spentMonthlyCents = initiator.spentMonthlyCents ?? 0;
      const budgetUsedFraction = budgetMonthlyCents > 0 ? spentMonthlyCents / budgetMonthlyCents : null;
      const withinStandingBudget = budgetMonthlyCents > 0
        ? spentMonthlyCents + budgetImpactCents <= budgetMonthlyCents
        : budgetImpactCents === 0;

      const categories = [...new Set((input.categories ?? []).map((category) => category.trim()).filter(Boolean))];
      const { tier, drivingAxis } = classifyRiskTier(input.axes);
      const decision = decideApprovalRoute({
        tier,
        trustLevel,
        categories,
        withinStandingBudget,
        budgetUsedFraction,
        reversible: input.axes.reversibility === "reversible",
        urgent: input.urgent,
      });

      const rationale = {
        riskTier: tier,
        drivingAxis,
        axes: input.axes,
        categories,
        trustLevel,
        budgetUsedFraction,
        withinStandingBudget,
        budgetImpactCents,
        route: decision.route,
        gate: decision.gate,
        reason: decision.reason,
      };

      if (decision.autoApproved) {
        await logActivity(db, {
          companyId: input.companyId,
          actorType: "system",
          actorId: "approval-gate",
          action: "approval_gate.auto_approved",
          entityType: "agent",
          entityId: input.initiatorAgentId,
          agentId: input.initiatorAgentId,
          runId: input.initiatorRunId ?? null,
          details: { action, ...rationale },
        });
        return { approvalId: null, tier, ...decision };
      }

      // The approval UI must show the evidence bundle before the approve
      // control enables, so a gated action without evidence is unreviewable.
      const evidence = (input.evidence ?? []).filter((item) => item && item.summary?.trim());
      if (evidence.length === 0) {
        throw unprocessable("A gated action requires at least one evidence item for the approver to review", {
          code: "approval_gate_evidence_required",
        });
      }

      const payload: ApprovalGatePayload = {
        action,
        evidence,
        riskTier: tier,
        drivingAxis,
        axes: input.axes,
        categories,
        initiatorAgentId: input.initiatorAgentId,
        initiatorRunId: input.initiatorRunId ?? null,
        initiatorParentAgentId: initiator.reportsTo ?? null,
        budgetImpactCents,
        route: decision.route,
        gate: decision.gate,
        reason: decision.reason,
        urgent: Boolean(input.urgent),
        defaultOnTimeout: tier === "high" ? "fail_closed" : "fail_open",
      };

      const approval = await db
        .insert(approvals)
        .values({
          companyId: input.companyId,
          type: RISK_GATED_ACTION_APPROVAL_TYPE,
          requestedByAgentId: input.initiatorAgentId,
          status: "pending",
          payload,
        })
        .returning()
        .then((rows: Array<typeof approvals.$inferSelect>) => rows[0]);

      if (input.issueId) {
        await db
          .insert(issueApprovals)
          .values({
            companyId: input.companyId,
            issueId: input.issueId,
            approvalId: approval.id,
            linkedByAgentId: input.initiatorAgentId,
          })
          .onConflictDoNothing();
      }

      await logActivity(db, {
        companyId: input.companyId,
        actorType: "system",
        actorId: "approval-gate",
        action: "approval_gate.suspended",
        entityType: "approval",
        entityId: approval.id,
        agentId: input.initiatorAgentId,
        runId: input.initiatorRunId ?? null,
        details: { action, issueId: input.issueId ?? null, ...rationale },
      });

      return { approvalId: approval.id, tier, ...decision };
    },

    /**
     * Executor-level decision on a suspended gate. Separation of duties is
     * asserted here regardless of what the transport layer allowed through.
     */
    decide: async (input: {
      approvalId: string;
      decision: "approved" | "rejected";
      approverAgentId?: string | null;
      approverUserId?: string | null;
      decisionNote?: string | null;
    }) => {
      const approval = await getGateApproval(input.approvalId);
      if (approval.status !== "pending") {
        throw unprocessable("Only pending gate approvals can be decided");
      }
      const payload = approval.payload as ApprovalGatePayload;

      await assertSeparationOfDuties(db, {
        companyId: approval.companyId,
        approvalId: approval.id,
        initiatorAgentId: payload.initiatorAgentId ?? approval.requestedByAgentId ?? "",
        approverAgentId: input.approverAgentId,
        approverUserId: input.approverUserId,
      });

      const now = new Date();
      const updated = await db
        .update(approvals)
        .set({
          status: input.decision,
          decidedByUserId: input.approverUserId ?? null,
          decisionNote: input.decisionNote ?? null,
          decidedAt: now,
          updatedAt: now,
          payload: { ...payload, decidedByAgentId: input.approverAgentId ?? null },
        })
        .where(and(eq(approvals.id, approval.id), eq(approvals.status, "pending")))
        .returning()
        .then((rows: Array<typeof approvals.$inferSelect>) => rows[0] ?? null);
      if (!updated) throw unprocessable("Only pending gate approvals can be decided");

      await logActivity(db, {
        companyId: approval.companyId,
        actorType: input.approverUserId ? "user" : "agent",
        actorId: input.approverUserId ?? input.approverAgentId ?? "approval-gate",
        action: `approval_gate.${input.decision}`,
        entityType: "approval",
        entityId: approval.id,
        agentId: input.approverAgentId ?? null,
        details: {
          action: payload.action,
          riskTier: payload.riskTier,
          gate: payload.gate,
          initiatorAgentId: payload.initiatorAgentId,
          approverAgentId: input.approverAgentId ?? null,
          approverUserId: input.approverUserId ?? null,
        },
      });

      return updated;
    },

    /**
     * Policy v1 §4 digest: every pending gate item for the company, oldest
     * first, with the fields the board needs to decide line-items.
     */
    buildDigest: async (companyId: string) => {
      const rows = await db
        .select()
        .from(approvals)
        .where(and(
          eq(approvals.companyId, companyId),
          eq(approvals.type, RISK_GATED_ACTION_APPROVAL_TYPE),
          eq(approvals.status, "pending"),
        ))
        .then((results: Array<typeof approvals.$inferSelect>) => results);

      const items = rows
        .map((row) => {
          const payload = row.payload as ApprovalGatePayload;
          return {
            approvalId: row.id,
            requestedAt: row.createdAt,
            action: payload.action,
            requestedByAgentId: payload.initiatorAgentId ?? row.requestedByAgentId,
            riskTier: payload.riskTier,
            drivingAxis: payload.drivingAxis,
            gate: payload.gate,
            urgent: payload.urgent,
            budgetImpactCents: payload.budgetImpactCents,
            reversibility: payload.axes?.reversibility,
            defaultOnTimeout: payload.defaultOnTimeout,
            evidence: payload.evidence,
          };
        })
        .sort((a, b) => new Date(a.requestedAt as unknown as string).getTime() - new Date(b.requestedAt as unknown as string).getTime());

      const lines = items.map((item) =>
        `- [${item.riskTier.toUpperCase()}${item.urgent ? " · URGENT" : ""}] ${item.action} — requester ${item.requestedByAgentId}, `
        + `axis ${item.drivingAxis}, cost $${(item.budgetImpactCents / 100).toFixed(2)}, ${item.reversibility}, `
        + `on timeout: ${item.defaultOnTimeout === "fail_open" ? "auto-approve" : "stays blocked"} (approval ${item.approvalId})`,
      );
      const markdown = items.length === 0
        ? "No pending gated actions."
        : `## Approval Digest (${items.length} pending)\n\n${lines.join("\n")}`;

      return { items, markdown };
    },

    /**
     * Policy v1 §4 timeout rule. LOW/MED gates older than the window fail
     * open (auto-approve with audit); HIGH gates fail closed and stay pending.
     */
    sweepTimeouts: async (input: {
      companyId: string;
      now?: Date;
      failOpenAfterHours?: number;
    }) => {
      const now = input.now ?? new Date();
      const failOpenAfterHours = input.failOpenAfterHours ?? 24;
      const cutoff = new Date(now.getTime() - failOpenAfterHours * 60 * 60 * 1000);

      const rows = await db
        .select()
        .from(approvals)
        .where(and(
          eq(approvals.companyId, input.companyId),
          eq(approvals.type, RISK_GATED_ACTION_APPROVAL_TYPE),
          eq(approvals.status, "pending"),
        ))
        .then((results: Array<typeof approvals.$inferSelect>) => results);

      const failedOpen: string[] = [];
      const heldClosed: string[] = [];
      for (const row of rows) {
        if (new Date(row.createdAt as unknown as string).getTime() > cutoff.getTime()) continue;
        const payload = row.payload as ApprovalGatePayload;
        if (payload.defaultOnTimeout === "fail_open") {
          const updated = await db
            .update(approvals)
            .set({
              status: "approved",
              decidedByUserId: "system:timeout-fail-open",
              decisionNote: `Fail-open after ${failOpenAfterHours}h without a decision (Policy v1 §4)`,
              decidedAt: now,
              updatedAt: now,
            })
            .where(and(eq(approvals.id, row.id), eq(approvals.status, "pending")))
            .returning()
            .then((results: Array<typeof approvals.$inferSelect>) => results[0] ?? null);
          if (!updated) continue;
          failedOpen.push(row.id);
          await logActivity(db, {
            companyId: input.companyId,
            actorType: "system",
            actorId: "approval-gate",
            action: "approval_gate.timeout_fail_open",
            entityType: "approval",
            entityId: row.id,
            agentId: payload.initiatorAgentId ?? null,
            details: { action: payload.action, riskTier: payload.riskTier, failOpenAfterHours },
          });
        } else {
          heldClosed.push(row.id);
        }
      }

      return { failedOpen, heldClosed };
    },
  };
}
