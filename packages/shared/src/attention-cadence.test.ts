import { describe, expect, it } from "vitest";
import {
  CADENCE_HOT_INTERVAL_SEC,
  CADENCE_RECENT_INTERVAL_SEC,
  CADENCE_RECENT_MAX_AGE_DAYS,
  CADENCE_STALE_INTERVAL_SEC,
  cadenceIntervalSec,
  cadenceLabel,
  parseCadenceTier,
  resolveWorkItemCadence,
} from "./attention-cadence.js";

const NOW = new Date("2026-07-23T12:00:00.000Z");
const DAY_MS = 86_400_000;

function daysAgo(days: number): Date {
  return new Date(NOW.getTime() - days * DAY_MS);
}

describe("resolveWorkItemCadence", () => {
  it("uses a valid explicit override above every derived signal", () => {
    const cadence = resolveWorkItemCadence({
      now: NOW,
      lastActivityAt: daysAgo(0),
      isHot: true,
      override: "stale",
    });
    expect(cadence.tier).toBe("stale");
    expect(cadence.source).toBe("override");
    expect(cadence.intervalSec).toBe(CADENCE_STALE_INTERVAL_SEC);
    expect(cadence.label).toBe("Weekly (stale)");
  });

  it("ignores an invalid override and falls through to derivation", () => {
    const cadence = resolveWorkItemCadence({
      now: NOW,
      lastActivityAt: daysAgo(2),
      override: "nonsense" as unknown as never,
    });
    expect(cadence.tier).toBe("recent");
    expect(cadence.source).toBe("age");
  });

  it("pins hot items to the hourly tier regardless of age", () => {
    const cadence = resolveWorkItemCadence({
      now: NOW,
      lastActivityAt: daysAgo(400),
      isHot: true,
    });
    expect(cadence.tier).toBe("hot");
    expect(cadence.source).toBe("hot_signal");
    expect(cadence.intervalSec).toBe(CADENCE_HOT_INTERVAL_SEC);
  });

  it("classifies items touched within 30 days as recent (daily)", () => {
    const cadence = resolveWorkItemCadence({ now: NOW, lastActivityAt: daysAgo(10) });
    expect(cadence.tier).toBe("recent");
    expect(cadence.intervalSec).toBe(CADENCE_RECENT_INTERVAL_SEC);
  });

  it("treats the 30-day boundary as still recent, past it as stale", () => {
    expect(resolveWorkItemCadence({ now: NOW, lastActivityAt: daysAgo(CADENCE_RECENT_MAX_AGE_DAYS) }).tier).toBe(
      "recent",
    );
    expect(resolveWorkItemCadence({ now: NOW, lastActivityAt: daysAgo(CADENCE_RECENT_MAX_AGE_DAYS + 1) }).tier).toBe(
      "stale",
    );
  });

  it("falls back to createdAt when lastActivityAt is missing", () => {
    const cadence = resolveWorkItemCadence({ now: NOW, lastActivityAt: null, createdAt: daysAgo(90) });
    expect(cadence.tier).toBe("stale");
    expect(cadence.source).toBe("age");
  });

  it("defaults to recent when no usable timestamp exists", () => {
    const cadence = resolveWorkItemCadence({ now: NOW, lastActivityAt: null, createdAt: "not-a-date" });
    expect(cadence.tier).toBe("recent");
    expect(cadence.source).toBe("age");
  });

  it("clamps future activity timestamps to age 0 (recent, not negative)", () => {
    const cadence = resolveWorkItemCadence({ now: NOW, lastActivityAt: daysAgo(-5) });
    expect(cadence.tier).toBe("recent");
  });

  it("accepts iso strings and epoch millis for timestamps", () => {
    const iso = resolveWorkItemCadence({ now: NOW.toISOString(), lastActivityAt: daysAgo(1).toISOString() });
    const millis = resolveWorkItemCadence({ now: NOW.getTime(), lastActivityAt: daysAgo(1).getTime() });
    expect(iso.tier).toBe("recent");
    expect(millis.tier).toBe("recent");
  });
});

describe("parseCadenceTier", () => {
  it("accepts the three known tiers and rejects everything else", () => {
    expect(parseCadenceTier("hot")).toBe("hot");
    expect(parseCadenceTier("recent")).toBe("recent");
    expect(parseCadenceTier("stale")).toBe("stale");
    expect(parseCadenceTier("hourly")).toBeNull();
    expect(parseCadenceTier(3)).toBeNull();
    expect(parseCadenceTier(null)).toBeNull();
    expect(parseCadenceTier(undefined)).toBeNull();
  });
});

describe("cadence lookups", () => {
  it("maps every tier to its interval and label", () => {
    expect(cadenceIntervalSec("hot")).toBe(CADENCE_HOT_INTERVAL_SEC);
    expect(cadenceIntervalSec("recent")).toBe(CADENCE_RECENT_INTERVAL_SEC);
    expect(cadenceIntervalSec("stale")).toBe(CADENCE_STALE_INTERVAL_SEC);
    expect(cadenceLabel("hot")).toBe("Hourly (hot)");
    expect(cadenceLabel("recent")).toBe("Daily (recent)");
    expect(cadenceLabel("stale")).toBe("Weekly (stale)");
  });
});
