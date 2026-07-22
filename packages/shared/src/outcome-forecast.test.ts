import { describe, it, expect } from "vitest";
import {
  parseOutcomeForecast,
  formatForecastLine,
  summarizeForecastLevers,
  humanizeDurationMinutes,
  type OutcomeForecast,
} from "./outcome-forecast.js";

/**
 * The two worked card lines from OUTCOME-RECEIPTS.md §4. If these stop
 * rendering, the standard and the code have drifted.
 */
const FORECAST_A_BODY = `Proposing the outreach loop.

\`\`\`forecast
{
  "etaMinutes": 40,
  "outcome": { "timeSavedMinutes": 60 },
  "confidence": "estimated",
  "method": "2 outreach drafts @ 30 min each industry SDR baseline = 60 min."
}
\`\`\``;

const FORECAST_B_BODY = `De-risking dispatch.

\`\`\`forecast
{
  "etaMinutes": 120,
  "confidence": "unmeasurable",
  "method": "Revenue impact is unmeasurable pre-send; this hardens the approval gate."
}
\`\`\``;

describe("parseOutcomeForecast", () => {
  it("returns present:false when no forecast block exists", () => {
    expect(parseOutcomeForecast("just a comment")).toEqual({ present: false });
  });

  it("parses the §4 example A (time saved, estimated)", () => {
    const res = parseOutcomeForecast(FORECAST_A_BODY);
    expect(res).toMatchObject({ present: true, ok: true });
    if (res.present && res.ok) {
      expect(res.forecast.etaMinutes).toBe(40);
      expect(res.forecast.timeSavedMinutes).toBe(60);
      expect(res.forecast.confidence).toBe("estimated");
      // 0/omitted levers normalize to null.
      expect(res.forecast.moneySavedCents).toBeNull();
      expect(res.forecast.revenueMovedCents).toBeNull();
    }
  });

  it("parses the §4 example B (no lever, unmeasurable is first-class)", () => {
    const res = parseOutcomeForecast(FORECAST_B_BODY);
    expect(res).toMatchObject({ present: true, ok: true });
    if (res.present && res.ok) {
      expect(res.forecast.etaMinutes).toBe(120);
      expect(res.forecast.confidence).toBe("unmeasurable");
    }
  });

  it("rejects a lever-less forecast that is NOT unmeasurable (11x rule)", () => {
    const body = "```forecast\n{\"confidence\":\"estimated\",\"method\":\"x\"}\n```";
    const res = parseOutcomeForecast(body);
    expect(res).toMatchObject({ present: true, ok: false });
  });

  it("rejects a missing method (method is mandatory)", () => {
    const body = "```forecast\n{\"outcome\":{\"timeSavedMinutes\":30},\"confidence\":\"estimated\"}\n```";
    const res = parseOutcomeForecast(body);
    expect(res).toMatchObject({ present: true, ok: false });
  });

  it("rejects a negative etaMinutes", () => {
    const body = "```forecast\n{\"etaMinutes\":-5,\"confidence\":\"unmeasurable\",\"method\":\"x\"}\n```";
    const res = parseOutcomeForecast(body);
    expect(res).toMatchObject({ present: true, ok: false });
  });
});

describe("humanizeDurationMinutes", () => {
  it("formats sub-hour, whole-hour, and mixed durations", () => {
    expect(humanizeDurationMinutes(40)).toBe("~40 min");
    expect(humanizeDurationMinutes(120)).toBe("~2 h");
    expect(humanizeDurationMinutes(90)).toBe("~1 h 30 min");
  });

  it("returns null for null/zero so the caller omits the line", () => {
    expect(humanizeDurationMinutes(null)).toBeNull();
    expect(humanizeDurationMinutes(0)).toBeNull();
  });
});

describe("formatForecastLine (the §4 card line)", () => {
  it("renders example A: ETA + time saved + confidence", () => {
    const res = parseOutcomeForecast(FORECAST_A_BODY);
    if (!res.present || !res.ok) throw new Error("fixture must parse");
    expect(formatForecastLine(res.forecast)).toBe(
      "ETA ~40 min · Expect: ~1 h time saved (estimated)",
    );
  });

  it("renders example B: honest unmeasurable de-risk over invented ROI", () => {
    const res = parseOutcomeForecast(FORECAST_B_BODY);
    if (!res.present || !res.ok) throw new Error("fixture must parse");
    expect(formatForecastLine(res.forecast)).toBe(
      "ETA ~2 h · Expect: unmeasurable — this de-risks, not sells (unmeasurable)",
    );
  });

  it("drops the ETA segment when no ETA is quoted", () => {
    const forecast: OutcomeForecast = {
      etaMinutes: null,
      moneySavedCents: 6000,
      timeSavedMinutes: null,
      revenueMovedCents: null,
      riskAvoided: null,
      confidence: "measured",
      method: "Cancelled a $60/mo tool.",
    };
    expect(formatForecastLine(forecast)).toBe("Expect: $60 saved (measured)");
  });

  it("summarizes multiple levers joined with a middot", () => {
    const forecast: OutcomeForecast = {
      etaMinutes: 30,
      moneySavedCents: null,
      timeSavedMinutes: 30,
      revenueMovedCents: 125000,
      riskAvoided: null,
      confidence: "estimated",
      method: "x",
    };
    expect(summarizeForecastLevers(forecast)).toBe("~30 min time saved · $1,250 revenue moved");
  });
});
