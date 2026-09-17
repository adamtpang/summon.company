/**
 * SUM-102: Desired-state company reconciler.
 *
 * The company config is the desired state: every Core-8 department must have
 * at least one active (non-terminated, non-pending) agent, the company budget
 * ceiling must cover active agent budgets, and roadmap stages should have
 * owning agents. Each CEO heartbeat calls reconcileCompanyDesiredState() to
 * diff desired vs actual and file the minimum fix tasks, one per violation,
 * deduplicated by originFingerprint so they are never double-filed.
 *
 * Counterfactual rendering: computeHireCounterfactual() and
 * computeSpendCounterfactual() return the budget impact of a proposed change
 * before the board decides, so proposals show "approving this puts Engineering
 * over budget by $X/mo" rather than requiring argument.
 *
 * Config export/import: exportCompanyConfig() serialises the current desired
 * state to a plain JSON document; importCompanyConfig() validates and returns
 * it. Round-trip fidelity is guaranteed by a shared Zod schema.
 */

import { and, eq, inArray, isNull, ne, notInArray, sql } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { agents, approvals, companies, issues } from "@paperclipai/db";
import { VITALS_DEPARTMENTS, type VitalsDepartment } from "@paperclipai/shared";
import { z } from "zod";
import { issueService } from "./issues.js";
import { logger } from "../middleware/logger.js";

// ---------------------------------------------------------------------------
// Desired-state schema (export/import round-trip)
// ---------------------------------------------------------------------------

export const formationSeatConfigSchema = z.object({
  department: z.string(),
  hasActiveOwner: z.boolean(),
  activeAgentIds: z.array(z.string()),
  desiredBudgetMonthlyCents: z.number().int().nonnegative(),
});

export const companyConfigSchema = z.object({
  schemaVersion: z.literal(1),
  exportedAt: z.string().datetime(),
  companyId: z.string().uuid(),
  goal: z.string().nullable(),
  budgetCeilingMonthlyCents: z.number().int().nonnegative(),
  formation: z.array(formationSeatConfigSchema),
});

export type CompanyConfig = z.infer<typeof companyConfigSchema>;

// ---------------------------------------------------------------------------
// Violation types
// ---------------------------------------------------------------------------

export type FormationViolation =
  | { kind: "unowned_department"; department: VitalsDepartment; details: string }
  | { kind: "budget_ceiling_too_low"; overage: number; details: string }
  | { kind: "pending_formation_blocking"; approvalId: string; details: string };

export type ReconcileResult = {
  violations: FormationViolation[];
  tasksCreated: string[];
  tasksSkipped: string[];
};

// Origin kinds for reconciler-filed tasks.
const RECONCILE_ORIGIN_KIND = "desired_state_reconcile";

function violationFingerprint(companyId: string, violation: FormationViolation): string {
  if (violation.kind === "unowned_department") {
    return `${companyId}:unowned:${violation.department}`;
  }
  if (violation.kind === "budget_ceiling_too_low") {
    return `${companyId}:budget_ceiling_too_low`;
  }
  return `${companyId}:pending_formation:${violation.approvalId}`;
}

function violationTitle(violation: FormationViolation): string {
  if (violation.kind === "unowned_department") {
    const dept = violation.department.charAt(0).toUpperCase() + violation.department.slice(1);
    return `Assign an active ${dept} employee (formation violation)`;
  }
  if (violation.kind === "budget_ceiling_too_low") {
    return `Raise the company budget ceiling to cover active employees`;
  }
  return `Review pending formation decision blocking company staffing`;
}

function violationDescription(violation: FormationViolation): string {
  return violation.details;
}

// ---------------------------------------------------------------------------
// Core reconciler
// ---------------------------------------------------------------------------

export function companyDesiredStateService(db: Db) {
  const issueSvc = issueService(db);

  /**
   * Compute all active (non-terminated) agents for a company and detect
   * desired-state violations against the Core-8 formation contract.
   */
  async function computeViolations(companyId: string): Promise<FormationViolation[]> {
    const [agentRows, companyRow, pendingFormation] = await Promise.all([
      db
        .select({
          id: agents.id,
          role: agents.role,
          status: agents.status,
          metadata: agents.metadata,
          budgetMonthlyCents: agents.budgetMonthlyCents,
        })
        .from(agents)
        .where(
          and(
            eq(agents.companyId, companyId),
            notInArray(agents.status, ["terminated"]),
          ),
        ),
      db
        .select({ description: companies.description, budgetMonthlyCents: companies.budgetMonthlyCents })
        .from(companies)
        .where(eq(companies.id, companyId))
        .then((rows) => rows[0] ?? null),
      db
        .select({ id: approvals.id })
        .from(approvals)
        .where(
          and(
            eq(approvals.companyId, companyId),
            eq(approvals.type, "staff_formation"),
            eq(approvals.status, "pending"),
          ),
        )
        .then((rows) => rows[0] ?? null),
    ]);

    if (!companyRow) return [];

    const violations: FormationViolation[] = [];

    // A pending staff_formation blocks the whole formation from being correct;
    // surface it as a violation so the board is nudged to decide.
    if (pendingFormation) {
      violations.push({
        kind: "pending_formation_blocking",
        approvalId: pendingFormation.id,
        details:
          `The Core-8 formation proposal (approval ${pendingFormation.id}) is still pending. ` +
          `Review it so employees can be activated and the company can run.`,
      });
      // When the formation is pending nothing is active yet, so department
      // owner checks would generate noise. Return early.
      return violations;
    }

    // Build a map from department -> active agent ids.
    const activeByDept = new Map<string, string[]>();
    for (const agent of agentRows) {
      if (agent.status !== "active") continue;
      const dept = (agent.metadata as Record<string, unknown> | null)
        ?.vitalsFormation as Record<string, unknown> | null;
      const department = dept?.department as string | undefined;
      if (!department) continue;
      const current = activeByDept.get(department) ?? [];
      current.push(agent.id);
      activeByDept.set(department, current);
    }

    for (const dept of VITALS_DEPARTMENTS) {
      const owners = activeByDept.get(dept) ?? [];
      if (owners.length === 0) {
        violations.push({
          kind: "unowned_department",
          department: dept,
          details:
            `The ${dept} department has no active owner. ` +
            `Hire or activate an employee for this department so work can be assigned.`,
        });
      }
    }

    // Budget ceiling check: active agent budgets must not exceed the ceiling.
    const activeBudgetSum = agentRows
      .filter((a) => a.status === "active")
      .reduce((sum, a) => sum + (a.budgetMonthlyCents ?? 0), 0);
    if (activeBudgetSum > (companyRow.budgetMonthlyCents ?? 0)) {
      const overage = activeBudgetSum - (companyRow.budgetMonthlyCents ?? 0);
      violations.push({
        kind: "budget_ceiling_too_low",
        overage,
        details:
          `Active employee budgets total $${(activeBudgetSum / 100).toFixed(2)}/mo but the ` +
          `company ceiling is $${((companyRow.budgetMonthlyCents ?? 0) / 100).toFixed(2)}/mo ` +
          `(overage: $${(overage / 100).toFixed(2)}/mo). Raise the ceiling or reduce employee budgets.`,
      });
    }

    return violations;
  }

  /**
   * Reconcile the company's desired state against actual state.
   * Files one fix task per violation, skipping any violation whose
   * originFingerprint already has an open task (dedup per VIT-71 rules).
   * Called by the CEO heartbeat once per cycle.
   */
  async function reconcileCompanyDesiredState(
    companyId: string,
    options: {
      assigneeAgentId?: string | null;
      createdByUserId?: string | null;
    } = {},
  ): Promise<ReconcileResult> {
    const violations = await computeViolations(companyId);
    const tasksCreated: string[] = [];
    const tasksSkipped: string[] = [];

    for (const violation of violations) {
      const fingerprint = violationFingerprint(companyId, violation);

      // Dedup: is there already an open (non-terminal) task with this fingerprint?
      const existing = await db
        .select({ id: issues.id, status: issues.status })
        .from(issues)
        .where(
          and(
            eq(issues.companyId, companyId),
            eq(issues.originKind, RECONCILE_ORIGIN_KIND),
            eq(issues.originFingerprint, fingerprint),
            notInArray(issues.status, ["done", "cancelled", "archived"]),
          ),
        )
        .then((rows) => rows[0] ?? null);

      if (existing) {
        tasksSkipped.push(existing.id);
        continue;
      }

      try {
        const issue = await issueSvc.create(companyId, {
          title: violationTitle(violation),
          description: violationDescription(violation),
          status: "todo",
          priority: "high",
          assigneeAgentId: options.assigneeAgentId ?? null,
          createdByUserId: options.createdByUserId ?? null,
          originKind: RECONCILE_ORIGIN_KIND,
          originId: fingerprint,
          originFingerprint: fingerprint,
        });
        tasksCreated.push(issue.id);
        logger.info({ companyId, violationKind: violation.kind, issueId: issue.id },
          "desired-state reconciler filed fix task");
      } catch (err) {
        logger.warn({ err, companyId, violationKind: violation.kind },
          "desired-state reconciler failed to file fix task");
      }
    }

    return { violations, tasksCreated, tasksSkipped };
  }

  // ---------------------------------------------------------------------------
  // Counterfactual computation
  // ---------------------------------------------------------------------------

  /**
   * Given a proposed hire (new agent with budgetMonthlyCents), compute the
   * budget impact against the current company ceiling. Returns the remaining
   * headroom after the hire (negative = over budget), plus context.
   */
  async function computeHireCounterfactual(
    companyId: string,
    proposedBudgetMonthlyCents: number,
  ): Promise<{
    currentCeilingCents: number;
    currentActiveBudgetCents: number;
    proposedTotalCents: number;
    headroomAfterCents: number;
    overBudget: boolean;
    summary: string;
  }> {
    const [companyRow, agentRows] = await Promise.all([
      db
        .select({ budgetMonthlyCents: companies.budgetMonthlyCents })
        .from(companies)
        .where(eq(companies.id, companyId))
        .then((rows) => rows[0] ?? null),
      db
        .select({ budgetMonthlyCents: agents.budgetMonthlyCents, status: agents.status })
        .from(agents)
        .where(and(eq(agents.companyId, companyId), eq(agents.status, "active"))),
    ]);

    const ceiling = companyRow?.budgetMonthlyCents ?? 0;
    const currentActive = agentRows.reduce((sum, a) => sum + (a.budgetMonthlyCents ?? 0), 0);
    const proposedTotal = currentActive + proposedBudgetMonthlyCents;
    const headroom = ceiling - proposedTotal;
    const overBudget = headroom < 0;

    const summary = overBudget
      ? `Approving this hire puts active employee spend $${(Math.abs(headroom) / 100).toFixed(2)}/mo over the $${(ceiling / 100).toFixed(2)}/mo company ceiling.`
      : `$${(headroom / 100).toFixed(2)}/mo headroom remains after this hire (ceiling $${(ceiling / 100).toFixed(2)}/mo).`;

    return {
      currentCeilingCents: ceiling,
      currentActiveBudgetCents: currentActive,
      proposedTotalCents: proposedTotal,
      headroomAfterCents: headroom,
      overBudget,
      summary,
    };
  }

  /**
   * Given a proposed one-time or monthly spend (e.g. a budget increase for an
   * existing agent), compute headroom and impact against the current ceiling.
   */
  async function computeSpendCounterfactual(
    companyId: string,
    additionalMonthlyCents: number,
  ): Promise<{
    currentCeilingCents: number;
    currentActiveBudgetCents: number;
    proposedTotalCents: number;
    headroomAfterCents: number;
    overBudget: boolean;
    summary: string;
  }> {
    return computeHireCounterfactual(companyId, additionalMonthlyCents);
  }

  // ---------------------------------------------------------------------------
  // Config export / import (round-trip)
  // ---------------------------------------------------------------------------

  async function exportCompanyConfig(companyId: string): Promise<CompanyConfig> {
    const [companyRow, agentRows] = await Promise.all([
      db
        .select({
          description: companies.description,
          budgetMonthlyCents: companies.budgetMonthlyCents,
        })
        .from(companies)
        .where(eq(companies.id, companyId))
        .then((rows) => rows[0] ?? null),
      db
        .select({
          id: agents.id,
          status: agents.status,
          metadata: agents.metadata,
          budgetMonthlyCents: agents.budgetMonthlyCents,
        })
        .from(agents)
        .where(and(eq(agents.companyId, companyId), notInArray(agents.status, ["terminated"]))),
    ]);

    const activeByDept = new Map<VitalsDepartment, { ids: string[]; budgetCents: number }>();
    for (const agent of agentRows) {
      const dept = ((agent.metadata as Record<string, unknown> | null)
        ?.vitalsFormation as Record<string, unknown> | null)
        ?.department as VitalsDepartment | undefined;
      if (!dept || !VITALS_DEPARTMENTS.includes(dept)) continue;
      if (agent.status !== "active") continue;
      const current = activeByDept.get(dept) ?? { ids: [], budgetCents: 0 };
      current.ids.push(agent.id);
      current.budgetCents += agent.budgetMonthlyCents ?? 0;
      activeByDept.set(dept, current);
    }

    const formation = VITALS_DEPARTMENTS.map((dept) => {
      const slot = activeByDept.get(dept);
      return {
        department: dept,
        hasActiveOwner: (slot?.ids.length ?? 0) > 0,
        activeAgentIds: slot?.ids ?? [],
        desiredBudgetMonthlyCents: slot?.budgetCents ?? 0,
      };
    });

    return {
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      companyId,
      goal: companyRow?.description ?? null,
      budgetCeilingMonthlyCents: companyRow?.budgetMonthlyCents ?? 0,
      formation,
    };
  }

  /**
   * Validate a company config document (e.g. after import/upload).
   * Returns the parsed config or throws a ZodError.
   */
  function importCompanyConfig(raw: unknown): CompanyConfig {
    return companyConfigSchema.parse(raw);
  }

  return {
    computeViolations,
    reconcileCompanyDesiredState,
    computeHireCounterfactual,
    computeSpendCounterfactual,
    exportCompanyConfig,
    importCompanyConfig,
  };
}
