import { describe, it, expect } from "vitest";
import {
  CADENCE_HOT_INTERVAL_SEC,
  CADENCE_RECENT_INTERVAL_SEC,
  CADENCE_STALE_INTERVAL_SEC,
} from "@paperclipai/shared";
import { resolveIssueCadence } from "./issue-cadence.js";

/**
 * VIT-44 §4 — the read-path adapter over the deterministic classifier. Proves
 * the precedence the API contract depends on: override > hot signal > activity
 * age, with `lastActivityAt` falling back to `updatedAt`, and an invalid stored
 * override ignored rather than trusted.
 */

const NOW = new Date("2026-07-23T00:00:00.000Z").getTime();
const DAY_MS = 86_400_000;

function row(overrides: Partial<Parameters<typeof resolveIssueCadence>[0]> = {}) {
  return {
    cadenceOverride: null,
    createdAt: new Date(NOW - 5 * DAY_MS),
    updatedAt: new Date(NOW - 5 * DAY_MS),
    ...overrides,
  };
}

describe("resolveIssueCadence", () => {
  it("a valid override wins over hot signal and age", () => {
    const cadence = resolveIssueCadence(
      row({ cadenceOverride: "stale", updatedAt: new Date(NOW) }),
      { now: NOW, isHot: true },
    );
    expect(cadence.tier).toBe("stale");
    expect(cadence.source).toBe("override");
    expect(cadence.intervalSec).toBe(CADENCE_STALE_INTERVAL_SEC);
  });

  it("the hot signal pins the hourly tier regardless of age", () => {
    const cadence = resolveIssueCadence(
      row({ updatedAt: new Date(NOW - 400 * DAY_MS) }),
      { now: NOW, isHot: true },
    );
    expect(cadence.tier).toBe("hot");
    expect(cadence.source).toBe("hot_signal");
    expect(cadence.intervalSec).toBe(CADENCE_HOT_INTERVAL_SEC);
  });

  it("recent activity with no hot signal is the daily tier", () => {
    const cadence = resolveIssueCadence(
      row({ lastActivityAt: new Date(NOW - 3 * DAY_MS) }),
      { now: NOW, isHot: false },
    );
    expect(cadence.tier).toBe("recent");
    expect(cadence.source).toBe("age");
    expect(cadence.intervalSec).toBe(CADENCE_RECENT_INTERVAL_SEC);
  });

  it("stale activity with no hot signal is the weekly tier", () => {
    const cadence = resolveIssueCadence(
      row({ lastActivityAt: new Date(NOW - 60 * DAY_MS) }),
      { now: NOW, isHot: false },
    );
    expect(cadence.tier).toBe("stale");
    expect(cadence.source).toBe("age");
  });

  it("falls back to updatedAt when lastActivityAt is absent", () => {
    const cadence = resolveIssueCadence(
      row({ lastActivityAt: undefined, updatedAt: new Date(NOW - 60 * DAY_MS) }),
      { now: NOW, isHot: false },
    );
    expect(cadence.tier).toBe("stale");
  });

  it("ignores an invalid stored override and derives from age instead", () => {
    const cadence = resolveIssueCadence(
      row({ cadenceOverride: "urgent", lastActivityAt: new Date(NOW - 2 * DAY_MS) }),
      { now: NOW, isHot: false },
    );
    expect(cadence.tier).toBe("recent");
    expect(cadence.source).toBe("age");
  });
});
