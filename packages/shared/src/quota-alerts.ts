import type { ProviderQuotaResult, QuotaWindow } from "./types/quota.js";

/**
 * Pure quota-alert evaluation shared by the server (board attention feed) and
 * the UI (Usage page banners + desktop notifications). Thresholds per VIT-48:
 * warn at 70%, urgent at 90%, exhausted at 100%, plus a pre-exhaustion
 * forecast ("at current burn, the weekly limit hits Thursday ~14:00") derived
 * from linear burn over the elapsed portion of the window.
 */

export type QuotaAlertLevel = "warn" | "urgent" | "exhausted";

export interface QuotaAlert {
  /** provider slug, e.g. "anthropic", "openai" */
  provider: string;
  /** window label as reported by the provider, e.g. "5h", "7d", "Sonnet 7d" */
  windowLabel: string;
  usedPercent: number;
  level: QuotaAlertLevel;
  /** iso timestamp when the window resets, null when the provider does not report it */
  resetsAt: string | null;
  /**
   * iso timestamp when the window is forecast to hit 100% at the current burn
   * rate; null when already exhausted, not computable, or the window resets
   * before exhaustion would occur.
   */
  forecastExhaustAt: string | null;
  /** human sentence ready for the board feed / notification body */
  message: string;
}

export const QUOTA_WARN_PERCENT = 70;
export const QUOTA_URGENT_PERCENT = 90;

const PROVIDER_LABELS: Record<string, string> = {
  anthropic: "Claude",
  openai: "Codex",
};

export function quotaProviderLabel(provider: string): string {
  return PROVIDER_LABELS[provider] ?? provider;
}

/**
 * Extracts a rolling-window duration in milliseconds from a provider window
 * label such as "5h", "24h", "7d", "1w", or "Sonnet 7d". Returns null when the
 * label carries no recognizable duration (e.g. "Credits").
 */
export function parseWindowDurationMs(label: string): number | null {
  const match = /(\d+)\s*(h|d|w)\b/i.exec(label);
  if (!match) return null;
  const amount = Number.parseInt(match[1]!, 10);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const unitMs = { h: 3_600_000, d: 86_400_000, w: 604_800_000 }[
    match[2]!.toLowerCase() as "h" | "d" | "w"
  ];
  return amount * unitMs;
}

/**
 * Forecasts when a window hits 100% assuming the burn observed so far in the
 * window continues linearly. Returns null when the forecast is not computable
 * (missing inputs, nothing consumed yet, or elapsed time unknown) or when the
 * window resets before exhaustion would occur — i.e. only returns a timestamp
 * when the wall will actually be hit.
 */
export function forecastQuotaExhaustion(input: {
  usedPercent: number;
  resetsAt: string | null;
  windowDurationMs: number | null;
  now: Date;
}): string | null {
  const { usedPercent, resetsAt, windowDurationMs, now } = input;
  if (usedPercent <= 0 || usedPercent >= 100) return null;
  if (resetsAt == null || windowDurationMs == null) return null;
  const resetMs = Date.parse(resetsAt);
  if (Number.isNaN(resetMs)) return null;
  const msUntilReset = resetMs - now.getTime();
  if (msUntilReset <= 0) return null;
  const elapsedMs = windowDurationMs - msUntilReset;
  if (elapsedMs <= 0) return null;
  const msPerPercent = elapsedMs / usedPercent;
  const exhaustAtMs = now.getTime() + (100 - usedPercent) * msPerPercent;
  if (exhaustAtMs >= resetMs) return null;
  return new Date(exhaustAtMs).toISOString();
}

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function levelFor(usedPercent: number): QuotaAlertLevel | null {
  if (usedPercent >= 100) return "exhausted";
  if (usedPercent >= QUOTA_URGENT_PERCENT) return "urgent";
  if (usedPercent >= QUOTA_WARN_PERCENT) return "warn";
  return null;
}

function alertForWindow(
  provider: string,
  window: QuotaWindow,
  now: Date,
): QuotaAlert | null {
  if (window.usedPercent == null) return null;
  const level = levelFor(window.usedPercent);
  if (level == null) return null;

  const forecastExhaustAt = forecastQuotaExhaustion({
    usedPercent: window.usedPercent,
    resetsAt: window.resetsAt,
    windowDurationMs: parseWindowDurationMs(window.label),
    now,
  });

  const name = quotaProviderLabel(provider);
  const pct = Math.round(window.usedPercent);
  const resetPart = window.resetsAt ? ` (resets ${formatWhen(window.resetsAt)})` : "";
  let message: string;
  if (level === "exhausted") {
    message = `${name} ${window.label} quota is exhausted${resetPart}.`;
  } else if (forecastExhaustAt) {
    message = `${name} ${window.label} window at ${pct}% — at current burn it exhausts ${formatWhen(forecastExhaustAt)}${resetPart}.`;
  } else {
    message = `${name} ${window.label} window at ${pct}%${resetPart}.`;
  }

  return {
    provider,
    windowLabel: window.label,
    usedPercent: window.usedPercent,
    level,
    resetsAt: window.resetsAt,
    forecastExhaustAt,
    message,
  };
}

/**
 * Evaluates all provider quota windows into threshold alerts, most severe
 * first. Providers whose quota fetch failed are skipped — a fetch error is a
 * visibility problem, not a consumption alert.
 */
export function evaluateQuotaAlerts(
  results: ProviderQuotaResult[],
  now: Date,
): QuotaAlert[] {
  const alerts: QuotaAlert[] = [];
  for (const result of results) {
    if (!result.ok) continue;
    for (const window of result.windows) {
      const alert = alertForWindow(result.provider, window, now);
      if (alert) alerts.push(alert);
    }
  }
  const rank: Record<QuotaAlertLevel, number> = { exhausted: 0, urgent: 1, warn: 2 };
  return alerts.sort(
    (a, b) => rank[a.level] - rank[b.level] || b.usedPercent - a.usedPercent,
  );
}

/**
 * Stable identity for one alert occurrence: one alert per provider window,
 * per severity level, per reset period. A window that crosses 70% then 90%
 * produces two distinct keys (escalation re-notifies); the same alert seen
 * again within the same reset period dedups.
 */
export function quotaAlertDedupKey(alert: QuotaAlert): string {
  return `quota:${alert.provider}:${alert.windowLabel}:${alert.resetsAt ?? "no-reset"}:${alert.level}`;
}
