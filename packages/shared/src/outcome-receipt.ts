import {
  OUTCOME_CONFIDENCE_TIERS,
  OUTCOME_TIME_VALUE_CENTS_PER_MINUTE,
  type OutcomeConfidence,
} from "./constants.js";

/**
 * Outcome receipt parsing + validation — the finance standard for what a
 * completed task was WORTH.
 *
 * @see doc/finance/OUTCOME-RECEIPTS.md (Vitals CFO, SUM-143) §1–2.
 *
 * Every closing/completion comment carries one structured `OUTCOME` block,
 * fenced as ```outcome json so Mission Control (SUM-158) can roll it up and the
 * founder can read it in the thread. This module is the single source of truth
 * for extracting, validating, and normalizing that block. It has no I/O and no
 * dependencies beyond constants so it stays trivially unit-testable and usable
 * from both the server persist path and any future UI/rollup consumer.
 */

/**
 * The four levers + confidence + method that every outcome statement shares.
 * A completed-task *receipt* and a pre-dispatch *forecast* (OUTCOME-RECEIPTS.md
 * §4) carry the identical core so the promise can be compared to the result;
 * this is the single validated shape both build on. @see outcome-forecast.ts.
 */
export interface OutcomeCore {
  /** Costs removed/avoided that recur or were spent, in cents. `null` = n/a. */
  moneySavedCents: number | null;
  /** Human minutes not spent because the agent did the work. `null` = n/a. */
  timeSavedMinutes: number | null;
  /** New revenue caused or advanced, in cents. `null` = n/a. */
  revenueMovedCents: number | null;
  /** A concrete downside removed (qualitative), or `null`. */
  riskAvoided: string | null;
  /** The 11x confidence tier. */
  confidence: OutcomeConfidence;
  /** One honest sentence stating HOW each number was derived. Mandatory. */
  method: string;
}

/** A parsed, normalized, honesty-checked receipt. */
export interface OutcomeReceipt extends OutcomeCore {
  /** The block exactly as authored (audit trail / forward-compat). */
  raw: Record<string, unknown>;
}

export type OutcomeReceiptParseResult =
  /** No ```outcome block was present in the body. */
  | { present: false }
  /** A block was present but failed validation — reject it loudly. */
  | { present: true; ok: false; error: string }
  /** A valid receipt. */
  | { present: true; ok: true; receipt: OutcomeReceipt };

/**
 * Extract the inner text of the first fenced ```<tag> block, or `null`.
 * Accepts any info-string that starts with `<tag>` (e.g. ```outcome json).
 * Shared by the receipt (`outcome`) and the forecast (`forecast`) parsers so
 * both honor the exact same fence grammar.
 */
export function extractFencedBlock(body: string, tag: string): string | null {
  if (!body) return null;
  // Fence opener: ``` optionally followed by `<tag>` + anything to EOL.
  const opener = new RegExp("```[ \\t]*" + tag + "[^\\n]*\\n([\\s\\S]*?)```", "i");
  const match = body.match(opener);
  return match ? match[1] : null;
}

/**
 * Extract the inner text of the first fenced ```outcome block, or `null`.
 * Accepts any info-string that starts with `outcome` (e.g. ```outcome json).
 */
export function extractOutcomeBlock(body: string): string | null {
  return extractFencedBlock(body, "outcome");
}

function normalizeIntLever(
  value: unknown,
  label: string,
): { value: number | null } | { error: string } {
  if (value === undefined || value === null) return { value: null };
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return { error: `${label} must be an integer number of cents/minutes` };
  }
  if (!Number.isInteger(value)) {
    return { error: `${label} must be an integer, got ${value}` };
  }
  if (value < 0) {
    return { error: `${label} must not be negative, got ${value}` };
  }
  // 0 is a valid "not populated" sentinel; the spec says omit or 0 for n/a.
  return { value: value === 0 ? null : value };
}

function normalizeRisk(value: unknown): { value: string | null } | { error: string } {
  if (value === undefined || value === null) return { value: null };
  if (typeof value !== "string") return { error: "riskAvoided must be a string or null" };
  const trimmed = value.trim();
  return { value: trimmed.length > 0 ? trimmed : null };
}

/**
 * Validate the shared core (four levers + confidence + method) of a parsed
 * outcome object, enforcing the honesty rules from OUTCOME-RECEIPTS.md §1:
 * - `method` is mandatory and non-empty.
 * - `confidence` is one of measured|estimated|unmeasurable.
 * - at least one lever is populated OR `confidence === "unmeasurable"`.
 * - numeric levers are non-negative integers; a 0/omitted lever is "not populated".
 *
 * `noun` names the artifact in error messages ("receipt" or "forecast"). Both
 * the completion receipt and the pre-dispatch forecast run through this one
 * validator so a promise and a result are graded on the identical bar.
 */
export function parseOutcomeCore(
  root: Record<string, unknown>,
  noun = "receipt",
): { ok: true; core: OutcomeCore } | { ok: false; error: string } {
  const confidence = root.confidence;
  if (
    typeof confidence !== "string" ||
    !(OUTCOME_CONFIDENCE_TIERS as readonly string[]).includes(confidence)
  ) {
    return { ok: false, error: `confidence must be one of ${OUTCOME_CONFIDENCE_TIERS.join(" | ")}` };
  }

  const method = root.method;
  if (typeof method !== "string" || method.trim().length === 0) {
    return { ok: false, error: "method is mandatory and must be a non-empty string" };
  }

  const outcome = root.outcome;
  if (outcome !== undefined && (typeof outcome !== "object" || outcome === null || Array.isArray(outcome))) {
    return { ok: false, error: "outcome must be a JSON object of levers" };
  }
  const levers = (outcome ?? {}) as Record<string, unknown>;

  const money = normalizeIntLever(levers.moneySavedCents, "moneySavedCents");
  if ("error" in money) return { ok: false, error: money.error };
  const time = normalizeIntLever(levers.timeSavedMinutes, "timeSavedMinutes");
  if ("error" in time) return { ok: false, error: time.error };
  const revenue = normalizeIntLever(levers.revenueMovedCents, "revenueMovedCents");
  if ("error" in revenue) return { ok: false, error: revenue.error };
  const risk = normalizeRisk(levers.riskAvoided);
  if ("error" in risk) return { ok: false, error: risk.error };

  const hasLever =
    money.value !== null || time.value !== null || revenue.value !== null || risk.value !== null;

  if (!hasLever && confidence !== "unmeasurable") {
    return {
      ok: false,
      error: `${noun} must populate at least one lever (money/time/revenue/risk) or set confidence=unmeasurable`,
    };
  }

  return {
    ok: true,
    core: {
      moneySavedCents: money.value,
      timeSavedMinutes: time.value,
      revenueMovedCents: revenue.value,
      riskAvoided: risk.value,
      confidence: confidence as OutcomeConfidence,
      method: method.trim(),
    },
  };
}

/**
 * Parse and validate the outcome block from a comment body.
 *
 * Enforces the honesty rules from OUTCOME-RECEIPTS.md §1 via {@link parseOutcomeCore}.
 */
export function parseOutcomeReceipt(body: string): OutcomeReceiptParseResult {
  const block = extractOutcomeBlock(body);
  if (block === null) return { present: false };

  let parsed: unknown;
  try {
    parsed = JSON.parse(block);
  } catch (err) {
    return {
      present: true,
      ok: false,
      error: `outcome block is not valid JSON: ${(err as Error).message}`,
    };
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return { present: true, ok: false, error: "outcome block must be a JSON object" };
  }
  const root = parsed as Record<string, unknown>;

  const core = parseOutcomeCore(root, "receipt");
  if (!core.ok) return { present: true, ok: false, error: core.error };

  return { present: true, ok: true, receipt: { ...core.core, raw: root } };
}

/**
 * Dollar-ize time saved at the single documented rate ($60/h). GUARDRAIL: this
 * value is NEVER added into moneySavedCents — it is a separate parenthetical
 * line in the rollup. @see OUTCOME-RECEIPTS.md §2.
 */
export function outcomeTimeValueCents(timeSavedMinutes: number | null | undefined): number {
  if (!timeSavedMinutes || timeSavedMinutes <= 0) return 0;
  return Math.round(timeSavedMinutes * OUTCOME_TIME_VALUE_CENTS_PER_MINUTE);
}
