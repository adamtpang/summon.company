import { describe, expect, it } from "vitest";
import { applyMarkup } from "./subscriptions.js";

/**
 * Markup-over-COGS math (VIT-5). Rockefeller doctrine: respect the smallest
 * figure and never bill below cost. These cases pin the exact cents.
 */
describe("applyMarkup", () => {
  it("returns 0 for non-positive COGS", () => {
    expect(applyMarkup(0, 2000)).toBe(0);
    expect(applyMarkup(-100, 2000)).toBe(0);
  });

  it("passes through at cost when markup is 0 bps", () => {
    expect(applyMarkup(1234, 0)).toBe(1234);
  });

  it("applies a whole-percent markup exactly", () => {
    // 1000 cents * 1.20 = 1200
    expect(applyMarkup(1000, 2000)).toBe(1200);
    // 5000 cents * 1.50 = 7500
    expect(applyMarkup(5000, 5000)).toBe(7500);
  });

  it("rounds to the nearest cent", () => {
    // 333 * 1.15 = 382.95 -> 383
    expect(applyMarkup(333, 1500)).toBe(383);
    // 101 * 1.005 = 101.505 -> 102 (round half up)
    expect(applyMarkup(101, 50)).toBe(102);
  });

  it("never bills below cost even for a sub-cent markup", () => {
    // 1 cent * 1.0001 = 1.0001 -> rounds to 1, floor guarantees >= cost
    expect(applyMarkup(1, 1)).toBe(1);
    expect(applyMarkup(1, 1)).toBeGreaterThanOrEqual(1);
  });

  it("treats a negative markup as pass-through, not a discount", () => {
    expect(applyMarkup(1000, -5000)).toBe(1000);
  });
});
