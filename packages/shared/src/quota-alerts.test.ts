import { describe, expect, it } from "vitest";
import {
  evaluateQuotaAlerts,
  forecastQuotaExhaustion,
  parseWindowDurationMs,
  quotaAlertDedupKey,
  quotaProviderLabel,
} from "./quota-alerts.js";
import type { ProviderQuotaResult, QuotaWindow } from "./types/quota.js";

const NOW = new Date("2026-07-15T12:00:00.000Z");

function win(overrides: Partial<QuotaWindow> = {}): QuotaWindow {
  return {
    label: "7d",
    usedPercent: 50,
    resetsAt: null,
    valueLabel: null,
    ...overrides,
  };
}

function result(overrides: Partial<ProviderQuotaResult> = {}): ProviderQuotaResult {
  return {
    provider: "anthropic",
    ok: true,
    windows: [win()],
    ...overrides,
  };
}

describe("parseWindowDurationMs", () => {
  it("parses hour, day, and week labels", () => {
    expect(parseWindowDurationMs("5h")).toBe(5 * 3_600_000);
    expect(parseWindowDurationMs("24h")).toBe(24 * 3_600_000);
    expect(parseWindowDurationMs("7d")).toBe(7 * 86_400_000);
    expect(parseWindowDurationMs("1w")).toBe(604_800_000);
  });

  it("parses model-prefixed labels like 'Sonnet 7d'", () => {
    expect(parseWindowDurationMs("Sonnet 7d")).toBe(7 * 86_400_000);
  });

  it("returns null for duration-less labels", () => {
    expect(parseWindowDurationMs("Credits")).toBeNull();
    expect(parseWindowDurationMs("")).toBeNull();
  });
});

describe("forecastQuotaExhaustion", () => {
  const weekMs = 7 * 86_400_000;

  it("projects linear burn to the wall when it lands before reset", () => {
    // 3.5 days into a 7d window, 80% used → 100% in ~0.875 more days,
    // well before the reset 3.5 days out.
    const resetsAt = new Date(NOW.getTime() + weekMs / 2).toISOString();
    const iso = forecastQuotaExhaustion({
      usedPercent: 80,
      resetsAt,
      windowDurationMs: weekMs,
      now: NOW,
    });
    expect(iso).not.toBeNull();
    const forecastMs = Date.parse(iso!);
    const expectedMs = NOW.getTime() + (20 / 80) * (weekMs / 2);
    expect(Math.abs(forecastMs - expectedMs)).toBeLessThan(1000);
  });

  it("returns null when the window resets before exhaustion", () => {
    // 6.3 days into a 7d window, 72% used → burn is slow enough that the
    // reset arrives first.
    const resetsAt = new Date(NOW.getTime() + 0.7 * 86_400_000).toISOString();
    expect(
      forecastQuotaExhaustion({
        usedPercent: 72,
        resetsAt,
        windowDurationMs: weekMs,
        now: NOW,
      }),
    ).toBeNull();
  });

  it("returns null without a reset time, duration, or consumption", () => {
    const resetsAt = new Date(NOW.getTime() + weekMs / 2).toISOString();
    expect(
      forecastQuotaExhaustion({ usedPercent: 80, resetsAt: null, windowDurationMs: weekMs, now: NOW }),
    ).toBeNull();
    expect(
      forecastQuotaExhaustion({ usedPercent: 80, resetsAt, windowDurationMs: null, now: NOW }),
    ).toBeNull();
    expect(
      forecastQuotaExhaustion({ usedPercent: 0, resetsAt, windowDurationMs: weekMs, now: NOW }),
    ).toBeNull();
    expect(
      forecastQuotaExhaustion({ usedPercent: 100, resetsAt, windowDurationMs: weekMs, now: NOW }),
    ).toBeNull();
  });

  it("returns null when the reported reset is already in the past", () => {
    const resetsAt = new Date(NOW.getTime() - 60_000).toISOString();
    expect(
      forecastQuotaExhaustion({ usedPercent: 95, resetsAt, windowDurationMs: weekMs, now: NOW }),
    ).toBeNull();
  });
});

describe("evaluateQuotaAlerts", () => {
  it("stays silent below 70%", () => {
    expect(evaluateQuotaAlerts([result({ windows: [win({ usedPercent: 69 })] })], NOW)).toEqual([]);
  });

  it("warns at 70%, urgent at 90%, exhausted at 100%", () => {
    const alerts = evaluateQuotaAlerts(
      [
        result({
          windows: [
            win({ label: "5h", usedPercent: 71 }),
            win({ label: "7d", usedPercent: 92 }),
          ],
        }),
        result({
          provider: "openai",
          windows: [win({ label: "1w", usedPercent: 100, resetsAt: "2026-07-22T00:00:00.000Z" })],
        }),
      ],
      NOW,
    );
    expect(alerts.map((a) => [a.provider, a.windowLabel, a.level])).toEqual([
      ["openai", "1w", "exhausted"],
      ["anthropic", "7d", "urgent"],
      ["anthropic", "5h", "warn"],
    ]);
  });

  it("skips failed providers and windows without usedPercent", () => {
    const alerts = evaluateQuotaAlerts(
      [
        result({ ok: false, error: "boom", windows: [win({ usedPercent: 99 })] }),
        result({ windows: [win({ usedPercent: null, valueLabel: "$4.20 remaining" })] }),
      ],
      NOW,
    );
    expect(alerts).toEqual([]);
  });

  it("includes a burn forecast in the message when the wall lands before reset", () => {
    const weekMs = 7 * 86_400_000;
    const resetsAt = new Date(NOW.getTime() + weekMs / 2).toISOString();
    const [alert] = evaluateQuotaAlerts(
      [result({ windows: [win({ usedPercent: 80, resetsAt })] })],
      NOW,
    );
    expect(alert!.forecastExhaustAt).not.toBeNull();
    expect(alert!.message).toContain("at current burn it exhausts");
    expect(alert!.message).toContain("Claude 7d window at 80%");
  });

  it("names exhaustion with its reset time", () => {
    const [alert] = evaluateQuotaAlerts(
      [
        result({
          provider: "openai",
          windows: [win({ label: "1w", usedPercent: 100, resetsAt: "2026-07-22T00:00:00.000Z" })],
        }),
      ],
      NOW,
    );
    expect(alert!.level).toBe("exhausted");
    expect(alert!.message).toContain("Codex 1w quota is exhausted");
    expect(alert!.message).toContain("resets");
  });
});

describe("quotaAlertDedupKey", () => {
  it("is stable per provider window, level, and reset period", () => {
    const [alert] = evaluateQuotaAlerts(
      [result({ windows: [win({ usedPercent: 91, resetsAt: "2026-07-18T00:00:00.000Z" })] })],
      NOW,
    );
    expect(quotaAlertDedupKey(alert!)).toBe(
      "quota:anthropic:7d:2026-07-18T00:00:00.000Z:urgent",
    );
  });
});

describe("quotaProviderLabel", () => {
  it("maps known slugs and passes through unknown ones", () => {
    expect(quotaProviderLabel("anthropic")).toBe("Claude");
    expect(quotaProviderLabel("openai")).toBe("Codex");
    expect(quotaProviderLabel("mistral")).toBe("mistral");
  });
});
