import { describe, expect, it } from "vitest";
import {
  computeMarketCapSnapshot,
  detectLeverRegressions,
  parseMarketCapSnapshotDocument,
  renderMarketCapSnapshotDocument,
  resolveBindingLever,
  resolveMarketCapStage,
  type MarketCapInputs,
} from "./vitals-market-cap";

const NOW = "2026-07-16T00:00:00.000Z";

function inputs(overrides: Partial<MarketCapInputs> = {}): MarketCapInputs {
  return {
    stripeConnected: false,
    arrCents: null,
    payingCompanies: null,
    totalCompanies: 2,
    totalEmployees: 12,
    retentionRate: null,
    grossMarginPct: null,
    arrGrowth30dPct: null,
    ...overrides,
  };
}

describe("resolveMarketCapStage", () => {
  it("is NOW pre-revenue and with Stripe disconnected", () => {
    expect(resolveMarketCapStage(inputs()).id).toBe("NOW");
    expect(resolveMarketCapStage(inputs({ stripeConnected: true, arrCents: 0, payingCompanies: 0 })).id).toBe("NOW");
  });

  it("moves to S1 on the first real dollar and climbs by paying companies", () => {
    expect(resolveMarketCapStage(inputs({ stripeConnected: true, arrCents: 118800, payingCompanies: 1 })).id).toBe("S1");
    expect(resolveMarketCapStage(inputs({ stripeConnected: true, arrCents: 2_400_000, payingCompanies: 10 })).id).toBe("S2");
    expect(resolveMarketCapStage(inputs({ stripeConnected: true, arrCents: 36_000_000, payingCompanies: 100 })).id).toBe("S3");
    expect(resolveMarketCapStage(inputs({ stripeConnected: true, arrCents: 480_000_000, payingCompanies: 1000 })).id).toBe("S4");
    expect(
      resolveMarketCapStage(inputs({ stripeConnected: true, arrCents: 100_000_000 * 100, payingCompanies: 5000 })).id,
    ).toBe("S5");
  });
});

describe("resolveBindingLever (theory of constraints)", () => {
  it("pre-revenue the binding lever is companies > 0", () => {
    const lever = resolveBindingLever(inputs());
    expect(lever.key).toBe("companies");
    expect(lever.statement).toContain("# companies > 0");
  });

  it("broken retention outranks distribution once revenue exists", () => {
    const lever = resolveBindingLever(
      inputs({ stripeConnected: true, arrCents: 118800, payingCompanies: 1, retentionRate: 0.7 }),
    );
    expect(lever.key).toBe("retention");
  });

  it("companies stays binding through S2 when nothing is broken", () => {
    const lever = resolveBindingLever(
      inputs({ stripeConnected: true, arrCents: 2_400_000, payingCompanies: 10 }),
    );
    expect(lever.key).toBe("companies");
  });
});

describe("computeMarketCapSnapshot (11x rule)", () => {
  it("shows $0 ARR and option-value cap when Stripe is not connected", () => {
    const snap = computeMarketCapSnapshot(inputs(), NOW);
    expect(snap.arrLabel).toBe("$0");
    expect(snap.arrCents).toBeNull();
    expect(snap.capProxyLabel).toBe("option value only");
    expect(snap.multipleLabel).toContain("pre-revenue");
    expect(snap.evidenceGaps.some((g) => g.includes("Stripe not connected"))).toBe(true);
  });

  it("prices real ARR at 5-10x and flags test mode honestly", () => {
    const snap = computeMarketCapSnapshot(
      inputs({ stripeConnected: true, stripeTestMode: true, arrCents: 118800, payingCompanies: 1 }),
      NOW,
    );
    expect(snap.stage.id).toBe("S1");
    expect(snap.arrLabel).toContain("test mode");
    expect(snap.capProxyLabel).toContain("5-10x ARR");
    expect(snap.evidenceGaps.some((g) => g.includes("TEST MODE"))).toBe(true);
  });

  it("renders every lever with a real value and its owner department", () => {
    const snap = computeMarketCapSnapshot(inputs(), NOW);
    expect(snap.levers).toHaveLength(6);
    expect(snap.levers.find((l) => l.key === "retention")?.currentValue).toBe("no data yet");
    expect(snap.levers.find((l) => l.key === "companies")?.currentValue).toContain("2 on plane");
    expect(snap.levers.find((l) => l.key === "grossMargin")?.ownerDepartment).toBe("Finance");
  });
});

describe("detectLeverRegressions (VIT-71 wiring)", () => {
  const paid = (arrCents: number, payingCompanies: number, extra: Partial<MarketCapInputs> = {}) =>
    computeMarketCapSnapshot(
      inputs({ stripeConnected: true, arrCents, payingCompanies, ...extra }),
      NOW,
    );

  it("files a churn event when a paying company leaves", () => {
    const regressions = detectLeverRegressions(paid(237600, 2), paid(118800, 1));
    const churn = regressions.find((r) => r.kind === "churn_event");
    expect(churn).toBeDefined();
    expect(churn?.ownerDepartment).toBe("Support/Success");
    expect(churn?.importanceStars).toBe(5);
    expect(churn?.evidence).toContain("2 -> 1");
  });

  it("files margin drift under the 80% floor", () => {
    const regressions = detectLeverRegressions(null, paid(118800, 1, { grossMarginPct: 62 }));
    const margin = regressions.find((r) => r.kind === "margin_drift");
    expect(margin).toBeDefined();
    expect(margin?.evidence).toContain("62% < 80% floor");
  });

  it("files growth stall only post-revenue", () => {
    expect(
      detectLeverRegressions(paid(118800, 1), paid(118800, 1)).some((r) => r.kind === "growth_stall"),
    ).toBe(true);
    const preRevenuePrev = computeMarketCapSnapshot(inputs(), NOW);
    const preRevenueCurr = computeMarketCapSnapshot(inputs(), NOW);
    expect(
      detectLeverRegressions(preRevenuePrev, preRevenueCurr).some((r) => r.kind === "growth_stall"),
    ).toBe(false);
  });

  it("is quiet when nothing regressed", () => {
    expect(detectLeverRegressions(paid(118800, 1), paid(237600, 2))).toHaveLength(0);
  });
});

describe("snapshot document round-trip", () => {
  it("renders markdown and parses the embedded snapshot back", () => {
    const snap = computeMarketCapSnapshot(inputs(), NOW);
    const body = renderMarketCapSnapshotDocument(snap);
    expect(body).toContain("Binding lever");
    expect(body).toContain("| # companies |");
    const parsed = parseMarketCapSnapshotDocument(body);
    expect(parsed?.stage.id).toBe("NOW");
    expect(parsed?.bindingLever.key).toBe("companies");
  });

  it("returns null on bodies without a snapshot block", () => {
    expect(parseMarketCapSnapshotDocument("# just markdown")).toBeNull();
  });
});
