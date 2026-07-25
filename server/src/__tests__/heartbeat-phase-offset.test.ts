import { describe, expect, it } from "vitest";
import { computeHeartbeatTimerDue } from "../services/heartbeat.ts";

const SEC = 1000;
const INTERVAL = 900; // matches Operations' current kitchen cadence (15m)
const createdAt = Date.UTC(2026, 0, 1, 0, 0, 0); // arbitrary immutable anchor

describe("computeHeartbeatTimerDue — legacy drift-based mode (phaseOffsetSec = null)", () => {
  it("does not fire before a full interval has elapsed since the last wake", () => {
    const last = Date.UTC(2026, 6, 1, 12, 0, 0);
    expect(
      computeHeartbeatTimerDue({
        now: last + (INTERVAL - 1) * SEC,
        intervalSec: INTERVAL,
        phaseOffsetSec: null,
        lastHeartbeatAt: last,
        createdAt,
      }),
    ).toBe(false);
  });

  it("fires once a full interval has elapsed since the last wake", () => {
    const last = Date.UTC(2026, 6, 1, 12, 0, 0);
    expect(
      computeHeartbeatTimerDue({
        now: last + INTERVAL * SEC,
        intervalSec: INTERVAL,
        phaseOffsetSec: null,
        lastHeartbeatAt: last,
        createdAt,
      }),
    ).toBe(true);
  });

  it("falls back to createdAt when the agent has never heartbeated", () => {
    expect(
      computeHeartbeatTimerDue({
        now: createdAt + INTERVAL * SEC,
        intervalSec: INTERVAL,
        phaseOffsetSec: null,
        lastHeartbeatAt: null,
        createdAt,
      }),
    ).toBe(true);
  });
});

describe("computeHeartbeatTimerDue — deterministic epoch-anchored phase grid", () => {
  // Scheduled wakes land at epoch seconds t where (t - phaseOffsetSec) % intervalSec === 0.
  const slotStart = (phaseOffsetSec: number, k: number) =>
    (phaseOffsetSec + k * INTERVAL) * SEC;

  it("is independent of lastHeartbeatAt drift: same grid regardless of last wake time", () => {
    const phaseOffsetSec = 0;
    const boundary = slotStart(phaseOffsetSec, 1_000_000);
    // Two different, drifted last-wake times inside the SAME slot both stay not-due until the
    // next boundary — the phase does not move with lastHeartbeatAt.
    for (const drift of [1 * SEC, 137 * SEC, (INTERVAL - 1) * SEC]) {
      expect(
        computeHeartbeatTimerDue({
          now: boundary - SEC,
          intervalSec: INTERVAL,
          phaseOffsetSec,
          lastHeartbeatAt: boundary - INTERVAL * SEC + drift,
          createdAt,
        }),
      ).toBe(false);
      expect(
        computeHeartbeatTimerDue({
          now: boundary,
          intervalSec: INTERVAL,
          phaseOffsetSec,
          lastHeartbeatAt: boundary - INTERVAL * SEC + drift,
          createdAt,
        }),
      ).toBe(true);
    }
  });

  it("fires exactly once per boundary crossed since the last wake", () => {
    const phaseOffsetSec = 100;
    const last = slotStart(phaseOffsetSec, 5) + 10 * SEC; // just after slot 5 boundary
    // Not due until slot 6 boundary.
    expect(
      computeHeartbeatTimerDue({
        now: slotStart(phaseOffsetSec, 6) - SEC,
        intervalSec: INTERVAL,
        phaseOffsetSec,
        lastHeartbeatAt: last,
        createdAt,
      }),
    ).toBe(false);
    // Due at slot 6 boundary.
    expect(
      computeHeartbeatTimerDue({
        now: slotStart(phaseOffsetSec, 6),
        intervalSec: INTERVAL,
        phaseOffsetSec,
        lastHeartbeatAt: last,
        createdAt,
      }),
    ).toBe(true);
  });

  it("suppresses the boundary an event wake already landed on (no immediate double-wake)", () => {
    const phaseOffsetSec = 100;
    const boundary = slotStart(phaseOffsetSec, 42);
    // Event wake set lastHeartbeatAt exactly on the boundary; a tick 1s later must not re-fire.
    expect(
      computeHeartbeatTimerDue({
        now: boundary + SEC,
        intervalSec: INTERVAL,
        phaseOffsetSec,
        lastHeartbeatAt: boundary,
        createdAt,
      }),
    ).toBe(false);
  });

  it("gives 8 evenly-spaced offsets non-colliding phases across the interval", () => {
    // Backfill plan: interval/8 = 112.5s → 8 integer offsets ~112s apart.
    const N = 8;
    const step = Math.floor(INTERVAL / N); // 112
    const offsets = Array.from({ length: N }, (_, i) => i * step);

    // Faithful steady-state simulation: each agent carries its own lastHeartbeatAt, updated to
    // `now` whenever it fires (exactly as the scheduler updates it). Tick every second across
    // two full intervals and count how many of the 8 agents fire on the same tick.
    const base = createdAt + 2_000_000 * SEC;
    // Start each agent in steady state: last wake = its most recent grid boundary before `base`
    // (avoids the cold-start tick where every idle agent fires at once).
    const priorBoundary = (o: number) => {
      const k = Math.floor((base / SEC - o) / INTERVAL);
      return (o + k * INTERVAL) * SEC;
    };
    const lastHeartbeatAt = new Map<number, number | null>(offsets.map((o) => [o, priorBoundary(o)]));
    let maxDuePerTick = 0;
    let totalFires = 0;
    for (let s = 0; s < 2 * INTERVAL; s += 1) {
      const now = base + s * SEC;
      let dueThisTick = 0;
      for (const phaseOffsetSec of offsets) {
        if (
          computeHeartbeatTimerDue({
            now,
            intervalSec: INTERVAL,
            phaseOffsetSec,
            lastHeartbeatAt: lastHeartbeatAt.get(phaseOffsetSec) ?? null,
            createdAt,
          })
        ) {
          lastHeartbeatAt.set(phaseOffsetSec, now);
          dueThisTick += 1;
          totalFires += 1;
        }
      }
      maxDuePerTick = Math.max(maxDuePerTick, dueThisTick);
    }
    // Distinct offsets → at most one agent is due on any given 1s tick (deterministic stagger).
    expect(maxDuePerTick).toBeLessThanOrEqual(1);
    // Sanity: every agent fired roughly once per interval (≈2 fires each over two intervals).
    expect(totalFires).toBeGreaterThanOrEqual(N);
  });

  it("normalizes an out-of-range phaseOffsetSec modulo the interval", () => {
    // phaseOffsetSec === intervalSec is equivalent to 0.
    const now = (5 * INTERVAL) * SEC;
    const withZero = computeHeartbeatTimerDue({
      now,
      intervalSec: INTERVAL,
      phaseOffsetSec: 0,
      lastHeartbeatAt: now - INTERVAL * SEC,
      createdAt,
    });
    const withInterval = computeHeartbeatTimerDue({
      now,
      intervalSec: INTERVAL,
      phaseOffsetSec: INTERVAL,
      lastHeartbeatAt: now - INTERVAL * SEC,
      createdAt,
    });
    expect(withInterval).toBe(withZero);
  });

  it("never fires when intervalSec is zero (disabled cadence)", () => {
    expect(
      computeHeartbeatTimerDue({
        now: createdAt + 10_000_000,
        intervalSec: 0,
        phaseOffsetSec: 0,
        lastHeartbeatAt: null,
        createdAt,
      }),
    ).toBe(false);
  });
});
