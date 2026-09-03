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
  finance: {
    period: "current_calendar_month_utc";
    stripeConnected: boolean;
    stripeMode: "test" | "live" | null;
    revenueAsOf: string | null;
    revenueFreshness: "fresh" | "stale" | "error" | "unavailable" | "test_mode";
    nextRevenueSyncAt: string | null;
    currency: string | null;
    revenueCents: number | null;
    revenueCoverage: "complete" | "bounded_latest_100" | "unavailable";
    arrCents: number | null;
    arrCurrency: string | null;
    arrCoverage: "complete" | "bounded_latest_100" | "unavailable";
    payingCustomerCount: number | null;
    aiExpenseCents: number;
    transcriptionExpenseMicrousd: number;
    transcriptionExpenseEvents: number;
    operatingExpenseCents: number;
    estimatedOperatingExpenseCents: number;
    recordedOperatingExpenseEvents: number;
    statementOperatingExpenseEvents: number;
    boardRecordedOperatingExpenseEvents: number;
    bankConnected?: boolean;
    bankEnvironment?: "sandbox" | "production" | null;
    expenseAsOf?: string | null;
    expenseFreshness?: "fresh" | "stale" | "error" | "unavailable" | "test_mode" | "currency_mismatch";
    nextExpenseSyncAt?: string | null;
    bankOperatingExpenseCents?: number;
    bankOperatingExpenseEvents?: number;
    expenseEvidenceSource: "ai_only" | "board_recorded" | "statement_import" | "mixed" | "bank_sync" | "bank_and_board";
    expenseCents: number;
    expenseCurrency: "usd";
    expenseCoverage: "summon_ai_costs_only" | "ai_and_recorded_operating" | "ai_and_bank_operating";
    profitCents: number | null;
    profitStatus: "measured_proxy" | "test_mode" | "currency_mismatch" | "unproven";
    availableCashCents: number | null;
    pendingCashCents: number | null;
    cashSource?: "stripe" | "bank" | null;
    cashCurrency?: string | null;
    cashStatus: "measured" | "test_mode" | "stale" | "error" | "currency_mismatch" | "unavailable";
    monthlyBurnCents: number | null;
    runwayMonths: number | null;
    runwayStatus: "measured" | "profitable" | "test_mode" | "currency_mismatch" | "unproven";
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
