export interface DashboardRunActivityDay {
  date: string;
  succeeded: number;
  /**
   * True failures for the day, excluding process-loss/restart kills that were
   * later recovered by a successful retry (those are surfaced in `recovered`).
   */
  failed: number;
  /**
   * Runs that terminated in a failure state (failed/timed_out) but whose retry
   * chain eventually succeeded — e.g. restart-killed runs that recovered. Kept
   * out of `failed` so the headline failure count reflects true, unrecovered
   * failures.
   */
  recovered: number;
  other: number;
  total: number;
  /**
   * Per-error-code breakdown of the (true) `failed` count for the day, so a
   * spike can be attributed to an error class (e.g. `process_lost`,
   * `provider_quota`, `workspace_validation_failed`). Recovered runs are not
   * included here. Runs with no error code are bucketed under `unknown`.
   */
  failedByErrorCode: Record<string, number>;
}

/**
 * Per-company "Outcomes (30d)" rollup — sourced ONLY from persisted receipts on
 * tasks with `completedAt` within the last 30 days. @see
 * doc/finance/OUTCOME-RECEIPTS.md §3 (Vitals CFO, SUM-143 / SUM-158).
 *
 * GUARDRAIL: the four levers stay in separate fields. `timeValueCents` is the
 * dollar-ized value of `timeSavedMinutes` at the documented $60/h rate and is a
 * parenthetical ONLY — it is NEVER added into `moneySavedCents`.
 */
export interface DashboardOutcomes {
  /**
   * Count of qualifying receipts that back the numeric totals (confidence
   * measured|estimated). This is the `k` in "from k receipts".
   */
  receiptCount: number;
  /**
   * Count of completed tasks whose receipt is `unmeasurable` — the honest
   * denominator (`u`). Showing it is what makes the measured total trustworthy.
   */
  unmeasurableCount: number;
  /** Σ moneySavedCents over qualifying (non-unmeasurable) receipts. */
  moneySavedCents: number;
  /** Σ timeSavedMinutes over qualifying receipts. */
  timeSavedMinutes: number;
  /** `timeSavedMinutes` valued at $60/h — parenthetical only, never in money. */
  timeValueCents: number;
  /** Σ revenueMovedCents over qualifying receipts. */
  revenueMovedCents: number;
  /** Count of receipts with a non-null `riskAvoided` lever. */
  risksAvoided: number;
}

export interface DashboardSummary {
  companyId: string;
  agents: {
    active: number;
    running: number;
    paused: number;
    error: number;
  };
  tasks: {
    open: number;
    inProgress: number;
    blocked: number;
    done: number;
  };
  costs: {
    monthSpendCents: number;
    monthBudgetCents: number;
    monthUtilizationPercent: number;
  };
  pendingApprovals: number;
  budgets: {
    activeIncidents: number;
    pendingApprovals: number;
    pausedAgents: number;
    pausedProjects: number;
  };
  runActivity: DashboardRunActivityDay[];
  outcomes: DashboardOutcomes;
}
