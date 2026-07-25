import {
  extractFencedBlock,
  parseOutcomeCore,
  type OutcomeCore,
} from "./outcome-receipt.js";

/**
 * Outcome forecast — the pre-dispatch promise a decision card quotes BEFORE the
 * work runs. @see doc/finance/OUTCOME-RECEIPTS.md §4.
 *
 * A decision card is an investment proposal that should read "cost X, expect Y".
 * The forecast carries the *same* four levers + confidence + mandatory `method`
 * as the completion receipt (SUM-162), plus an ETA, so on completion the actual
 * receipt can be read next to the promise (promise vs. result). This module has
 * no I/O and reuses the receipt validator, so a forecast is graded on the exact
 * same honesty bar: an honest "unmeasurable — this de-risks" beats an invented
 * ROI, and the 11x rule governs every number here too.
 */

/** A parsed, normalized, honesty-checked forecast: the receipt core + an ETA. */
export interface OutcomeForecast extends OutcomeCore {
  /** Expected wall-clock to completion, in minutes. `null` = no ETA quoted. */
  etaMinutes: number | null;
}

export type OutcomeForecastParseResult =
  /** No ```forecast block was present in the body. */
  | { present: false }
  /** A block was present but failed validation — reject it loudly. */
  | { present: true; ok: false; error: string }
  /** A valid forecast. */
  | { present: true; ok: true; forecast: OutcomeForecast };

/**
 * Parse and validate a ```forecast block from an issue/card body. Enforces the
 * same core honesty rules as a receipt (via `parseOutcomeCore`) plus an optional
 * non-negative integer `etaMinutes`.
 */
export function parseOutcomeForecast(body: string): OutcomeForecastParseResult {
  const block = extractFencedBlock(body, "forecast");
  if (block === null) return { present: false };

  let parsed: unknown;
  try {
    parsed = JSON.parse(block);
  } catch (err) {
    return { present: true, ok: false, error: `forecast block is not valid JSON: ${(err as Error).message}` };
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return { present: true, ok: false, error: "forecast block must be a JSON object" };
  }
  const root = parsed as Record<string, unknown>;

  const rawEta = root.etaMinutes;
  let etaMinutes: number | null = null;
  if (rawEta !== undefined && rawEta !== null) {
    if (typeof rawEta !== "number" || !Number.isInteger(rawEta) || rawEta < 0) {
      return { present: true, ok: false, error: "etaMinutes must be a non-negative integer number of minutes" };
    }
    etaMinutes = rawEta === 0 ? null : rawEta;
  }

  const core = parseOutcomeCore(root, "forecast");
  if (!core.ok) return { present: true, ok: false, error: core.error };

  return { present: true, ok: true, forecast: { ...core.core, etaMinutes } };
}

/**
 * Humanize a minute count as a compact, honestly-approximate duration:
 * `~40 min`, `~2 h`, `~1 h 30 min`. Prefixed `~` because these are estimates,
 * never a stopwatch. Returns `null` for null/zero so callers can omit the line.
 */
export function humanizeDurationMinutes(minutes: number | null | undefined): string | null {
  if (!minutes || minutes <= 0) return null;
  if (minutes < 60) return `~${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rem = minutes % 60;
  return rem === 0 ? `~${hours} h` : `~${hours} h ${rem} min`;
}

/** Cents → a short dollar string: `$60`, `$1,250`, `$4.50` (2dp only when needed). */
function formatDollars(cents: number): string {
  const dollars = cents / 100;
  const whole = Number.isInteger(dollars);
  const body = whole
    ? Math.round(dollars).toLocaleString("en-US")
    : dollars.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `$${body}`;
}

/** Trim a qualitative risk string to a card-friendly length. */
function shortRisk(risk: string): string {
  const trimmed = risk.trim();
  return trimmed.length > 80 ? `${trimmed.slice(0, 77).trimEnd()}…` : trimmed;
}

/**
 * The `<lever summary>` half of the card line — the human-readable "expect Y".
 * Most tasks move exactly one lever, so this is usually one phrase; multiple
 * populated levers join with " · ". When nothing is populated the forecast is
 * `unmeasurable` and we say so honestly rather than inventing a number.
 */
export function summarizeForecastLevers(forecast: OutcomeForecast): string {
  const parts: string[] = [];
  if (forecast.timeSavedMinutes) {
    parts.push(`${humanizeDurationMinutes(forecast.timeSavedMinutes)} time saved`);
  }
  if (forecast.moneySavedCents) {
    parts.push(`${formatDollars(forecast.moneySavedCents)} saved`);
  }
  if (forecast.revenueMovedCents) {
    parts.push(`${formatDollars(forecast.revenueMovedCents)} revenue moved`);
  }
  if (forecast.riskAvoided) {
    parts.push(`de-risks: ${shortRisk(forecast.riskAvoided)}`);
  }
  if (parts.length === 0) {
    // No defensible number — the 11x rule requires we say this plainly.
    return "unmeasurable — this de-risks, not sells";
  }
  return parts.join(" · ");
}

/**
 * The full decision-card line, per OUTCOME-RECEIPTS.md §4:
 *   `ETA <duration> · Expect: <lever summary> (<confidence>)`
 * The ETA segment is dropped when no ETA was quoted. The `method` is NOT inlined
 * here (it can be long); surface it as a tooltip/expander alongside this line.
 */
export function formatForecastLine(forecast: OutcomeForecast): string {
  const segments: string[] = [];
  const eta = humanizeDurationMinutes(forecast.etaMinutes);
  if (eta) segments.push(`ETA ${eta}`);
  segments.push(`Expect: ${summarizeForecastLevers(forecast)} (${forecast.confidence})`);
  return segments.join(" · ");
}
