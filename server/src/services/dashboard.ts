import { and, eq, gte, inArray, isNull, lt, sql } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import {
  agents,
  approvals,
  companies,
  companyFinanceConnections,
  companyPaymentAccounts,
  companyAiGatewayTranscriptions,
  costEvents,
  financeEvents,
  heartbeatRuns,
  issueOutcomes,
  issues,
} from "@paperclipai/db";
import { outcomeTimeValueCents, type DashboardSummary } from "@paperclipai/shared";
import { notFound } from "../errors.js";
import { budgetService } from "./budgets.js";
import { visibleIssueCondition } from "./issue-visibility.js";

const DASHBOARD_RUN_ACTIVITY_DAYS = 14;
const OUTCOMES_ROLLUP_DAYS = 30;
const REVENUE_EVIDENCE_STALE_MS = 45 * 60 * 1_000;

function formatUtcDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function getUtcMonthStart(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

export function getNextUtcMonthStart(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
}

export const DASHBOARD_OPERATING_EXPENSE_KINDS = [
  "inference_charge",
  "platform_fee",
  "credit_expiry",
  "byok_fee",
  "gateway_overhead",
  "log_storage_charge",
  "logpush_charge",
  "provisioned_capacity_charge",
  "training_charge",
  "custom_model_import_charge",
  "custom_model_storage_charge",
  "operating_expense",
] as const;

export interface DashboardExpenseEvidence {
  aiExpenseCents: number;
  transcriptionExpenseMicrousd: number;
  transcriptionExpenseEvents: number;
  operatingExpenseCents: number;
  estimatedOperatingExpenseCents: number;
  recordedOperatingExpenseEvents: number;
  statementOperatingExpenseEvents: number;
  statementOperatingExpenseCents?: number;
  boardRecordedOperatingExpenseCents?: number;
}

export interface DashboardBankEvidence {
  environment: "sandbox" | "production";
  connectionStatus: string;
  syncStatus: string;
  syncCoverage: string;
  currentMonthExpenseCents: number;
  currentMonthExpenseTransactionCount: number;
  availableCashCents: number | null;
  currentCashCents: number | null;
  cashCurrency: string | null;
  lastSyncedAt: Date | string | null;
  nextSyncAt: Date | string | null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function nonNegativeInteger(value: unknown): number | null {
  return Number.isSafeInteger(value) && (value as number) >= 0 ? value as number : null;
}

export function deriveCompanyFinance(
  expenseEvidence: DashboardExpenseEvidence,
  accounts: Array<{
    mode: "test" | "live";
    connectionStatus: string;
    evidence: Record<string, unknown>;
    lastSyncedAt?: Date | string | null;
    revenueSyncStatus?: string;
    nextRevenueSyncAt?: Date | string | null;
  }>,
  now = new Date(),
  bankConnections: DashboardBankEvidence[] = [],
): DashboardSummary["finance"] {
  const {
    aiExpenseCents,
    transcriptionExpenseMicrousd,
    transcriptionExpenseEvents,
    operatingExpenseCents,
    estimatedOperatingExpenseCents,
    recordedOperatingExpenseEvents,
    statementOperatingExpenseEvents,
  } = expenseEvidence;
  const boardRecordedOperatingExpenseEvents = Math.max(
    0,
    recordedOperatingExpenseEvents - statementOperatingExpenseEvents,
  );
  const statementOperatingExpenseCents = expenseEvidence.statementOperatingExpenseCents ?? 0;
  const boardRecordedOperatingExpenseCents = expenseEvidence.boardRecordedOperatingExpenseCents
    ?? Math.max(0, operatingExpenseCents - statementOperatingExpenseCents);
  const transcriptionExpenseCents = Math.ceil(transcriptionExpenseMicrousd / 10_000);
  const totalAiExpenseCents = aiExpenseCents + transcriptionExpenseCents;
  const activeBanks = bankConnections.filter((candidate) => candidate.connectionStatus !== "revoked");
  const productionBanks = activeBanks.filter((candidate) => candidate.environment === "production");
  const selectedBanks = productionBanks.length > 0 ? productionBanks : activeBanks;
  const bankConnected = selectedBanks.length > 0;
  const bankEnvironment = productionBanks.length > 0 ? "production" as const : activeBanks.length > 0 ? "sandbox" as const : null;
  const bankDates = selectedBanks
    .flatMap((candidate) => candidate.lastSyncedAt ? [new Date(candidate.lastSyncedAt)] : [])
    .filter((date) => Number.isFinite(date.getTime()));
  const expenseAsOf = bankDates.length === selectedBanks.length && bankDates.length > 0
    ? new Date(Math.min(...bankDates.map((date) => date.getTime()))).toISOString()
    : null;
  const nextExpenseDates = selectedBanks
    .flatMap((candidate) => candidate.nextSyncAt ? [new Date(candidate.nextSyncAt)] : [])
    .filter((date) => Number.isFinite(date.getTime()));
  const nextExpenseSyncAt = nextExpenseDates.length > 0
    ? new Date(Math.min(...nextExpenseDates.map((date) => date.getTime()))).toISOString()
    : null;
  const bankHasError = selectedBanks.some((candidate) => candidate.connectionStatus === "error" || candidate.syncStatus === "error");
  const bankHasCurrencyMismatch = selectedBanks.some((candidate) => candidate.syncCoverage === "foreign_currency");
  const bankHasIncompleteCoverage = selectedBanks.some((candidate) => candidate.syncCoverage !== "complete");
  const bankStale = expenseAsOf
    ? now.getTime() - new Date(expenseAsOf).getTime() > REVENUE_EVIDENCE_STALE_MS
    : false;
  const expenseFreshness: NonNullable<DashboardSummary["finance"]["expenseFreshness"]> = !bankConnected
    ? "unavailable"
    : bankEnvironment === "sandbox"
      ? "test_mode"
      : bankHasError
        ? "error"
        : bankHasCurrencyMismatch
          ? "currency_mismatch"
          : !expenseAsOf
            ? "unavailable"
            : bankStale
              ? "stale"
              : bankHasIncompleteCoverage
                ? "error"
                : "fresh";
  const bankOperatingExpenseCents = selectedBanks.reduce((total, candidate) => total + candidate.currentMonthExpenseCents, 0);
  const bankOperatingExpenseEvents = selectedBanks.reduce((total, candidate) => total + candidate.currentMonthExpenseTransactionCount, 0);
  const useBankExpenses = expenseFreshness === "fresh";
  const authoritativeOperatingExpenseCents = useBankExpenses
    ? bankOperatingExpenseCents + boardRecordedOperatingExpenseCents
    : operatingExpenseCents;
  const authoritativeOperatingExpenseEvents = useBankExpenses
    ? bankOperatingExpenseEvents + boardRecordedOperatingExpenseEvents
    : recordedOperatingExpenseEvents;
  const expenseCents = totalAiExpenseCents + authoritativeOperatingExpenseCents;
  const account = accounts
    .filter((candidate) => candidate.connectionStatus !== "revoked")
    .sort((left, right) => Number(right.mode === "live") - Number(left.mode === "live"))[0] ?? null;
  const revenueEvidence = asRecord(asRecord(account?.evidence)?.revenue);
  const lastSyncedAt = account?.lastSyncedAt ? new Date(account.lastSyncedAt) : null;
  const revenueAsOf = lastSyncedAt && Number.isFinite(lastSyncedAt.getTime())
    ? lastSyncedAt.toISOString()
    : null;
  const revenueFreshness: DashboardSummary["finance"]["revenueFreshness"] = !revenueEvidence || !revenueAsOf
    ? "unavailable"
    : account?.mode === "test"
      ? "test_mode"
      : account?.revenueSyncStatus === "error"
        ? "error"
        : now.getTime() - new Date(revenueAsOf).getTime() > REVENUE_EVIDENCE_STALE_MS
          ? "stale"
          : "fresh";
  const nextRevenueSyncAt = account?.nextRevenueSyncAt
    ? new Date(account.nextRevenueSyncAt).toISOString()
    : null;
  const monthGrossCents = nonNegativeInteger(revenueEvidence?.monthGrossCents);
  const currency = typeof revenueEvidence?.monthCurrency === "string"
    ? revenueEvidence.monthCurrency.toLowerCase()
    : null;
  const bounded = revenueEvidence?.checkoutSessionsHasMore === true;
  const arrCents = nonNegativeInteger(revenueEvidence?.annualRecurringRevenueCents);
  const arrCurrency = typeof revenueEvidence?.recurringCurrency === "string"
    ? revenueEvidence.recurringCurrency.toLowerCase()
    : null;
  const payingCustomerCount = nonNegativeInteger(revenueEvidence?.recurringCustomerCount);
  const arrBounded = revenueEvidence?.subscriptionsHasMore === true;
  const stripeAvailableCashCents = nonNegativeInteger(revenueEvidence?.availableBalanceCents);
  const stripePendingCashCents = nonNegativeInteger(revenueEvidence?.pendingBalanceCents);
  const bankCashCurrencies = new Set(selectedBanks.map((candidate) => candidate.cashCurrency ?? "unavailable"));
  const bankCashCurrency = bankCashCurrencies.size === 1 ? [...bankCashCurrencies][0]! : null;
  const bankAvailableCashCents = selectedBanks.every((candidate) => candidate.availableCashCents !== null)
    ? selectedBanks.reduce((total, candidate) => total + (candidate.availableCashCents ?? 0), 0)
    : null;
  const cashSource = bankConnected ? "bank" as const : account ? "stripe" as const : null;
  const cashStatus: DashboardSummary["finance"]["cashStatus"] = bankConnected
    ? bankEnvironment === "sandbox"
      ? "test_mode"
      : bankHasError
        ? "error"
        : bankHasCurrencyMismatch || (bankCashCurrency !== null && bankCashCurrency !== "USD")
          ? "currency_mismatch"
          : !expenseAsOf || bankAvailableCashCents === null
            ? "unavailable"
            : bankStale
              ? "stale"
              : "measured"
    : account?.mode === "test"
      ? "test_mode"
      : stripeAvailableCashCents === null
        ? "unavailable"
        : "measured";
  const availableCashCents = cashStatus === "measured"
    ? bankConnected ? bankAvailableCashCents : stripeAvailableCashCents
    : null;
  const pendingCashCents = bankConnected ? null : stripePendingCashCents;
  const cashCurrency = bankConnected ? bankCashCurrency?.toLowerCase() ?? null : currency;
  const hasLiveRevenueValue = account?.mode === "live" && monthGrossCents !== null;
  const liveMeasured = account?.mode === "live" && monthGrossCents !== null && revenueFreshness === "fresh";
  const currencyCompatible = currency === "usd";
  const expenseCurrent = !bankConnected || expenseFreshness === "fresh";
  const profitCents = liveMeasured && currencyCompatible && expenseCurrent ? monthGrossCents - expenseCents : null;
  const monthlyBurnCents = profitCents === null ? null : Math.max(0, -profitCents);
  const runwayMonths = monthlyBurnCents !== null && monthlyBurnCents > 0 && availableCashCents !== null
    ? Number((availableCashCents / monthlyBurnCents).toFixed(1))
    : null;

  return {
    period: "current_calendar_month_utc",
    stripeConnected: Boolean(account),
    stripeMode: account?.mode ?? null,
    revenueAsOf,
    revenueFreshness,
    nextRevenueSyncAt,
    currency,
    revenueCents: monthGrossCents,
    revenueCoverage: monthGrossCents === null
      ? "unavailable"
      : bounded
        ? "bounded_latest_100"
        : "complete",
    arrCents,
    arrCurrency,
    arrCoverage: arrCents === null
      ? "unavailable"
      : arrBounded
        ? "bounded_latest_100"
        : "complete",
    payingCustomerCount,
    aiExpenseCents: totalAiExpenseCents,
    transcriptionExpenseMicrousd,
    transcriptionExpenseEvents,
    operatingExpenseCents: authoritativeOperatingExpenseCents,
    estimatedOperatingExpenseCents,
    recordedOperatingExpenseEvents: authoritativeOperatingExpenseEvents,
    statementOperatingExpenseEvents,
    boardRecordedOperatingExpenseEvents,
    bankConnected,
    bankEnvironment,
    expenseAsOf,
    expenseFreshness,
    nextExpenseSyncAt,
    bankOperatingExpenseCents,
    bankOperatingExpenseEvents,
    expenseEvidenceSource: useBankExpenses
      ? boardRecordedOperatingExpenseEvents > 0 ? "bank_and_board" : "bank_sync"
      : statementOperatingExpenseEvents > 0
        ? boardRecordedOperatingExpenseEvents > 0
          ? "mixed"
          : "statement_import"
        : boardRecordedOperatingExpenseEvents > 0
          ? "board_recorded"
          : "ai_only",
    expenseCents,
    expenseCurrency: "usd",
    expenseCoverage: useBankExpenses
      ? "ai_and_bank_operating"
      : recordedOperatingExpenseEvents > 0
        ? "ai_and_recorded_operating"
        : "summon_ai_costs_only",
    profitCents,
    profitStatus: account?.mode === "test"
      ? "test_mode"
      : hasLiveRevenueValue && !currencyCompatible
        ? "currency_mismatch"
        : profitCents === null
          ? "unproven"
          : "measured_proxy",
    availableCashCents,
    pendingCashCents,
    cashSource,
    cashCurrency,
    cashStatus,
    monthlyBurnCents,
    runwayMonths,
    runwayStatus: account?.mode === "test"
      ? "test_mode"
      : hasLiveRevenueValue && !currencyCompatible
        ? "currency_mismatch"
      : profitCents === null || cashStatus !== "measured"
          ? "unproven"
          : profitCents >= 0
            ? "profitable"
            : runwayMonths === null
              ? "unproven"
              : "measured",
  };
}

function getRecentUtcDateKeys(now: Date, days: number): string[] {
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Array.from({ length: days }, (_, index) => {
    const dayOffset = index - (days - 1);
    return formatUtcDateKey(new Date(todayUtc + dayOffset * 24 * 60 * 60 * 1000));
  });
}

export function dashboardService(db: Db) {
  const budgets = budgetService(db);
  return {
    summary: async (companyId: string) => {
      const company = await db
        .select()
        .from(companies)
        .where(eq(companies.id, companyId))
        .then((rows) => rows[0] ?? null);

      if (!company) throw notFound("Company not found");

      const agentRows = await db
        .select({ status: agents.status, count: sql<number>`count(*)` })
        .from(agents)
        .where(eq(agents.companyId, companyId))
        .groupBy(agents.status);

      const taskRows = await db
        .select({ status: issues.status, count: sql<number>`count(*)` })
        .from(issues)
        .where(and(eq(issues.companyId, companyId), visibleIssueCondition()))
        .groupBy(issues.status);

      const pendingApprovals = await db
        .select({ count: sql<number>`count(*)` })
        .from(approvals)
        .where(and(eq(approvals.companyId, companyId), eq(approvals.status, "pending")))
        .then((rows) => Number(rows[0]?.count ?? 0));

      const agentCounts: Record<string, number> = {
        active: 0,
        running: 0,
        paused: 0,
        error: 0,
      };
      for (const row of agentRows) {
        const count = Number(row.count);
        // "idle" agents are operational — count them as active
        const bucket = row.status === "idle" ? "active" : row.status;
        agentCounts[bucket] = (agentCounts[bucket] ?? 0) + count;
      }

      const taskCounts: Record<string, number> = {
        open: 0,
        inProgress: 0,
        blocked: 0,
        done: 0,
      };
      for (const row of taskRows) {
        const count = Number(row.count);
        if (row.status === "in_progress") taskCounts.inProgress += count;
        if (row.status === "blocked") taskCounts.blocked += count;
        if (row.status === "done") taskCounts.done += count;
        if (row.status !== "done" && row.status !== "cancelled") taskCounts.open += count;
      }

      const now = new Date();
      const monthStart = getUtcMonthStart(now);
      const nextMonthStart = getNextUtcMonthStart(now);
      const runActivityDays = getRecentUtcDateKeys(now, DASHBOARD_RUN_ACTIVITY_DAYS);
      const runActivityStart = new Date(`${runActivityDays[0]}T00:00:00.000Z`);
      const [[{ monthSpend }], [transcriptionExpenseRow]] = await Promise.all([
        db
          .select({
            monthSpend: sql<number>`coalesce(sum(${costEvents.costCents}), 0)::double precision`,
          })
          .from(costEvents)
          .where(
            and(
              eq(costEvents.companyId, companyId),
              gte(costEvents.occurredAt, monthStart),
              lt(costEvents.occurredAt, nextMonthStart),
            ),
          ),
        db
          .select({
            microusd: sql<number>`coalesce(sum(${companyAiGatewayTranscriptions.costMicrousd}), 0)::double precision`,
            eventCount: sql<number>`count(*)::int`,
          })
          .from(companyAiGatewayTranscriptions)
          .where(and(
            eq(companyAiGatewayTranscriptions.companyId, companyId),
            eq(companyAiGatewayTranscriptions.status, "succeeded"),
            gte(companyAiGatewayTranscriptions.createdAt, monthStart),
            lt(companyAiGatewayTranscriptions.createdAt, nextMonthStart),
          )),
      ]);

      const transcriptionExpenseMicrousd = Number(transcriptionExpenseRow?.microusd ?? 0);
      const transcriptionExpenseCents = Math.ceil(transcriptionExpenseMicrousd / 10_000);
      const monthSpendCents = Number(monthSpend) + transcriptionExpenseCents;
      const [operatingExpenseRow] = await db
        .select({
          debitCents: sql<number>`coalesce(sum(case when ${financeEvents.direction} = 'debit' then ${financeEvents.amountCents} else 0 end), 0)::double precision`,
          creditCents: sql<number>`coalesce(sum(case when ${financeEvents.direction} = 'credit' then ${financeEvents.amountCents} else 0 end), 0)::double precision`,
          estimatedDebitCents: sql<number>`coalesce(sum(case when ${financeEvents.estimated} = true and ${financeEvents.direction} = 'debit' then ${financeEvents.amountCents} else 0 end), 0)::double precision`,
          estimatedCreditCents: sql<number>`coalesce(sum(case when ${financeEvents.estimated} = true and ${financeEvents.direction} = 'credit' then ${financeEvents.amountCents} else 0 end), 0)::double precision`,
          eventCount: sql<number>`count(*)::int`,
          statementEventCount: sql<number>`count(*) filter (where ${financeEvents.metadataJson}->>'source' = 'statement_import')::int`,
          statementDebitCents: sql<number>`coalesce(sum(case when ${financeEvents.metadataJson}->>'source' = 'statement_import' and ${financeEvents.direction} = 'debit' then ${financeEvents.amountCents} when ${financeEvents.metadataJson}->>'source' = 'statement_import' and ${financeEvents.direction} = 'credit' then -${financeEvents.amountCents} else 0 end), 0)::double precision`,
          boardDebitCents: sql<number>`coalesce(sum(case when coalesce(${financeEvents.metadataJson}->>'source', 'board_recorded') <> 'statement_import' and ${financeEvents.direction} = 'debit' then ${financeEvents.amountCents} when coalesce(${financeEvents.metadataJson}->>'source', 'board_recorded') <> 'statement_import' and ${financeEvents.direction} = 'credit' then -${financeEvents.amountCents} else 0 end), 0)::double precision`,
        })
        .from(financeEvents)
        .where(and(
          eq(financeEvents.companyId, companyId),
          gte(financeEvents.occurredAt, monthStart),
          lt(financeEvents.occurredAt, nextMonthStart),
          isNull(financeEvents.costEventId),
          inArray(financeEvents.eventKind, [...DASHBOARD_OPERATING_EXPENSE_KINDS]),
          sql`lower(${financeEvents.currency}) = 'usd'`,
        ));
      const operatingExpenseCents = Number(operatingExpenseRow?.debitCents ?? 0)
        - Number(operatingExpenseRow?.creditCents ?? 0);
      const estimatedOperatingExpenseCents = Number(operatingExpenseRow?.estimatedDebitCents ?? 0)
        - Number(operatingExpenseRow?.estimatedCreditCents ?? 0);
      const paymentAccounts = await db
        .select({
          mode: companyPaymentAccounts.mode,
          connectionStatus: companyPaymentAccounts.connectionStatus,
          evidence: companyPaymentAccounts.evidence,
          lastSyncedAt: companyPaymentAccounts.lastSyncedAt,
          revenueSyncStatus: companyPaymentAccounts.revenueSyncStatus,
          nextRevenueSyncAt: companyPaymentAccounts.nextRevenueSyncAt,
        })
        .from(companyPaymentAccounts)
        .where(eq(companyPaymentAccounts.companyId, companyId));
      const bankConnections = await db
        .select({
          environment: companyFinanceConnections.environment,
          connectionStatus: companyFinanceConnections.connectionStatus,
          syncStatus: companyFinanceConnections.syncStatus,
          syncCoverage: companyFinanceConnections.syncCoverage,
          currentMonthExpenseCents: companyFinanceConnections.currentMonthExpenseCents,
          currentMonthExpenseTransactionCount: companyFinanceConnections.currentMonthExpenseTransactionCount,
          availableCashCents: companyFinanceConnections.availableCashCents,
          currentCashCents: companyFinanceConnections.currentCashCents,
          cashCurrency: companyFinanceConnections.cashCurrency,
          lastSyncedAt: companyFinanceConnections.lastSyncedAt,
          nextSyncAt: companyFinanceConnections.nextSyncAt,
        })
        .from(companyFinanceConnections)
        .where(eq(companyFinanceConnections.companyId, companyId));
      const finance = deriveCompanyFinance({
        aiExpenseCents: Number(monthSpend),
        transcriptionExpenseMicrousd,
        transcriptionExpenseEvents: Number(transcriptionExpenseRow?.eventCount ?? 0),
        operatingExpenseCents,
        estimatedOperatingExpenseCents,
        recordedOperatingExpenseEvents: Number(operatingExpenseRow?.eventCount ?? 0),
        statementOperatingExpenseEvents: Number(operatingExpenseRow?.statementEventCount ?? 0),
        statementOperatingExpenseCents: Number(operatingExpenseRow?.statementDebitCents ?? 0),
        boardRecordedOperatingExpenseCents: Number(operatingExpenseRow?.boardDebitCents ?? 0),
      }, paymentAccounts, now, bankConnections);
      // Per-day run breakdown. A run is "recovered" when its retry chain later
      // succeeded (recovered_runs = all ancestors of a succeeded retry), so a
      // restart-killed run whose retry succeeded is pulled out of the headline
      // failed count. error_code is carried through so a failure spike can be
      // attributed to an error class (e.g. process_lost, provider_quota).
      const runActivityRows = (await db.execute(sql`
        WITH RECURSIVE recovered_runs(id) AS (
          SELECT parent.id
          FROM ${heartbeatRuns} AS child
          JOIN ${heartbeatRuns} AS parent ON parent.id = child.retry_of_run_id
          WHERE child.company_id = ${companyId}
            AND child.status = 'succeeded'
          UNION
          SELECT parent.id
          FROM recovered_runs rr
          JOIN ${heartbeatRuns} AS child ON child.id = rr.id
          JOIN ${heartbeatRuns} AS parent ON parent.id = child.retry_of_run_id
        )
        SELECT
          to_char(run.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS date,
          run.status AS status,
          run.error_code AS error_code,
          (run.id IN (SELECT id FROM recovered_runs)) AS recovered,
          count(*)::double precision AS count
        FROM ${heartbeatRuns} AS run
        WHERE run.company_id = ${companyId}
          AND run.created_at >= ${runActivityStart.toISOString()}::timestamptz
        GROUP BY date, run.status, run.error_code, recovered
      `)) as unknown as Iterable<{
        date: string;
        status: string;
        error_code: string | null;
        recovered: boolean | string;
        count: number | string;
      }>;

      const runActivity = new Map(
        runActivityDays.map((date) => [
          date,
          {
            date,
            succeeded: 0,
            failed: 0,
            recovered: 0,
            other: 0,
            total: 0,
            failedByErrorCode: {} as Record<string, number>,
          },
        ]),
      );
      for (const row of runActivityRows) {
        const bucket = runActivity.get(String(row.date));
        if (!bucket) continue;
        const count = Number(row.count);
        const status = String(row.status);
        // Postgres booleans can arrive as JS boolean or "t"/"true" depending on driver.
        const recovered = row.recovered === true || row.recovered === "t" || row.recovered === "true";
        if (status === "succeeded") {
          bucket.succeeded += count;
        } else if (status === "failed" || status === "timed_out") {
          if (recovered) {
            bucket.recovered += count;
          } else {
            bucket.failed += count;
            const code =
              typeof row.error_code === "string" && row.error_code.length > 0
                ? row.error_code
                : "unknown";
            bucket.failedByErrorCode[code] = (bucket.failedByErrorCode[code] ?? 0) + count;
          }
        } else {
          bucket.other += count;
        }
        bucket.total += count;
      }

      // Outcomes (30d) rollup — sourced ONLY from persisted receipts on tasks
      // completed within the window (OUTCOME-RECEIPTS.md §3). A single indexed
      // scan over (company_id, completed_at); the numeric levers are summed only
      // over measured/estimated receipts, while `unmeasurable` receipts are
      // counted separately as the honest denominator. GUARDRAIL: time-value
      // dollars are computed off timeSavedMinutes below and kept out of money.
      const outcomesStart = new Date(now.getTime() - OUTCOMES_ROLLUP_DAYS * 24 * 60 * 60 * 1000);
      const outcomeRows = (await db.execute(sql`
        SELECT
          coalesce(sum(money_saved_cents) FILTER (WHERE confidence <> 'unmeasurable'), 0)::double precision AS money_saved_cents,
          coalesce(sum(time_saved_minutes) FILTER (WHERE confidence <> 'unmeasurable'), 0)::double precision AS time_saved_minutes,
          coalesce(sum(revenue_moved_cents) FILTER (WHERE confidence <> 'unmeasurable'), 0)::double precision AS revenue_moved_cents,
          count(*) FILTER (WHERE risk_avoided IS NOT NULL)::double precision AS risks_avoided,
          count(*) FILTER (WHERE confidence <> 'unmeasurable')::double precision AS receipt_count,
          count(*) FILTER (WHERE confidence = 'unmeasurable')::double precision AS unmeasurable_count
        FROM ${issueOutcomes}
        WHERE company_id = ${companyId}
          AND completed_at IS NOT NULL
          AND completed_at >= ${outcomesStart.toISOString()}::timestamptz
      `)) as unknown as Iterable<{
        money_saved_cents: number | string;
        time_saved_minutes: number | string;
        revenue_moved_cents: number | string;
        risks_avoided: number | string;
        receipt_count: number | string;
        unmeasurable_count: number | string;
      }>;
      const outcomeRow = Array.from(outcomeRows)[0];
      const timeSavedMinutes = Number(outcomeRow?.time_saved_minutes ?? 0);
      const outcomes = {
        receiptCount: Number(outcomeRow?.receipt_count ?? 0),
        unmeasurableCount: Number(outcomeRow?.unmeasurable_count ?? 0),
        moneySavedCents: Number(outcomeRow?.money_saved_cents ?? 0),
        timeSavedMinutes,
        timeValueCents: outcomeTimeValueCents(timeSavedMinutes),
        revenueMovedCents: Number(outcomeRow?.revenue_moved_cents ?? 0),
        risksAvoided: Number(outcomeRow?.risks_avoided ?? 0),
      };

      const utilization =
        company.budgetMonthlyCents > 0
          ? (monthSpendCents / company.budgetMonthlyCents) * 100
          : 0;
      const budgetOverview = await budgets.overview(companyId);

      return {
        companyId,
        agents: {
          active: agentCounts.active,
          running: agentCounts.running,
          paused: agentCounts.paused,
          error: agentCounts.error,
        },
        tasks: taskCounts,
        costs: {
          monthSpendCents,
          monthBudgetCents: company.budgetMonthlyCents,
          monthUtilizationPercent: Number(utilization.toFixed(2)),
        },
        finance,
        pendingApprovals,
        budgets: {
          activeIncidents: budgetOverview.activeIncidents.length,
          pendingApprovals: budgetOverview.pendingApprovalCount,
          pausedAgents: budgetOverview.pausedAgentCount,
          pausedProjects: budgetOverview.pausedProjectCount,
        },
        runActivity: Array.from(runActivity.values()),
        outcomes,
      };
    },
  };
}
