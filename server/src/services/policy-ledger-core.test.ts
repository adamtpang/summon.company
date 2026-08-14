import { describe, expect, it } from "vitest";
import {
  authorizeCall,
  openReservedUnits,
  priceRoute,
  reservationUnits,
  settleFailure,
  settleReservation,
  spentUnits,
  type AdapterManifest,
  type CredentialView,
  type EmployeePolicy,
  type LedgerSnapshot,
} from "./policy-ledger-core.js";

/**
 * VIT-46 — per-employee policy/credential/cost-ledger decision core.
 *
 * These cases pin the five acceptance criteria mechanically, at the unit the
 * enforcement actually happens (Rockefeller: respect the smallest figure):
 *   AC1 monthly-budget over → blocked + boardAlert
 *   AC2 run cost_limit hit → stop + runStop (propose partial)
 *   AC3 revocation blocks the very next call (generation match)
 *   AC4 per-employee spend = netSettledUnits(ledger) (reconciles with events)
 *   AC5 a new adapter is a manifest entry only — no core change
 */

const CLAUDE_LOCAL: AdapterManifest = {
  key: "claude_local",
  displayName: "Claude (local subscription)",
  billingModel: "subscription",
  unit: "normalized_units",
  capabilities: ["code", "chat"],
  routes: [
    { model: "claude-opus-4-8", reserveUnits: 10 },
    { model: "claude-haiku-4-5", reserveUnits: 2 },
    // A model with no price → fail closed.
    { model: "unpriced-preview", reserveUnits: 0 },
  ],
};

const MANIFESTS = new Map<string, AdapterManifest>([[CLAUDE_LOCAL.key, CLAUDE_LOCAL]]);

function policy(overrides: Partial<EmployeePolicy> = {}): EmployeePolicy {
  return {
    allowedAdapters: [{ adapterKey: "claude_local", models: "*" }],
    monthlyBudgetUnits: 1000,
    unit: "normalized_units",
    capabilityScopes: ["code", "chat"],
    ...overrides,
  };
}

const ACTIVE: CredentialView = { status: "active", generation: 1 };

function snapshot(overrides: Partial<LedgerSnapshot> = {}): LedgerSnapshot {
  return {
    monthlySettledUnits: 0,
    monthlyReservedUnits: 0,
    runCommittedUnits: 0,
    ...overrides,
  };
}

describe("priceRoute / reservationUnits", () => {
  it("prices a known route and refuses an unpriced one (fail closed)", () => {
    expect(priceRoute(CLAUDE_LOCAL, "claude-opus-4-8")?.reserveUnits).toBe(10);
    expect(priceRoute(CLAUDE_LOCAL, "unpriced-preview")).toBeNull();
    expect(priceRoute(CLAUDE_LOCAL, "does-not-exist")).toBeNull();
  });

  it("reserves at least the route price, honoring a larger caller estimate", () => {
    const route = { model: "m", reserveUnits: 10 };
    expect(reservationUnits(route)).toBe(10);
    expect(reservationUnits(route, 3)).toBe(10); // floored at the route price
    expect(reservationUnits(route, 25)).toBe(25); // larger estimate honored
  });
});

describe("authorizeCall — happy path", () => {
  it("allows a well-formed, in-budget call and reserves the route price", () => {
    const d = authorizeCall(
      MANIFESTS,
      policy(),
      ACTIVE,
      { adapterKey: "claude_local", model: "claude-opus-4-8", capability: "code", presentedGeneration: 1 },
      snapshot(),
      { runCostLimitUnits: 100 },
    );
    expect(d.ok).toBe(true);
    expect(d.reserveUnits).toBe(10);
    expect(d.boardAlert).toBe(false);
    expect(d.runStop).toBe(false);
  });
});

describe("AC3 — credential revocation blocks the very next call", () => {
  it("denies a revoked credential", () => {
    const d = authorizeCall(
      MANIFESTS,
      policy(),
      { status: "revoked", generation: 1 },
      { adapterKey: "claude_local", model: "claude-opus-4-8", presentedGeneration: 1 },
      snapshot(),
    );
    expect(d.ok).toBe(false);
    expect(d.reason).toBe("credential_revoked");
  });

  it("denies a stale generation even if status still reads active (cache-safe)", () => {
    // Credential was rotated to gen 2; a caller still holding gen 1 is refused.
    const d = authorizeCall(
      MANIFESTS,
      policy(),
      { status: "active", generation: 2 },
      { adapterKey: "claude_local", model: "claude-opus-4-8", presentedGeneration: 1 },
      snapshot(),
    );
    expect(d.ok).toBe(false);
    expect(d.reason).toBe("credential_stale_generation");
  });
});

describe("policy allow-list", () => {
  it("denies an adapter not in the policy", () => {
    const d = authorizeCall(
      MANIFESTS,
      policy({ allowedAdapters: [{ adapterKey: "codex_local", models: "*" }] }),
      ACTIVE,
      { adapterKey: "claude_local", model: "claude-opus-4-8", presentedGeneration: 1 },
      snapshot(),
    );
    expect(d.reason).toBe("adapter_not_allowed");
  });

  it("denies a model outside an explicit allow-list", () => {
    const d = authorizeCall(
      MANIFESTS,
      policy({ allowedAdapters: [{ adapterKey: "claude_local", models: ["claude-haiku-4-5"] }] }),
      ACTIVE,
      { adapterKey: "claude_local", model: "claude-opus-4-8", presentedGeneration: 1 },
      snapshot(),
    );
    expect(d.reason).toBe("model_not_allowed");
  });

  it("denies a capability outside the policy scopes", () => {
    const d = authorizeCall(
      MANIFESTS,
      policy({ capabilityScopes: ["chat"] }),
      ACTIVE,
      { adapterKey: "claude_local", model: "claude-opus-4-8", capability: "code", presentedGeneration: 1 },
      snapshot(),
    );
    expect(d.reason).toBe("capability_out_of_scope");
  });

  it("denies an unknown adapter", () => {
    const d = authorizeCall(
      MANIFESTS,
      policy({ allowedAdapters: [{ adapterKey: "ghost", models: "*" }] }),
      ACTIVE,
      { adapterKey: "ghost", model: "x", presentedGeneration: 1 },
      snapshot(),
    );
    expect(d.reason).toBe("adapter_unknown");
  });
});

describe("fail-closed pricing", () => {
  it("denies a route with no price rather than letting an unmetered call through", () => {
    const d = authorizeCall(
      MANIFESTS,
      policy(),
      ACTIVE,
      { adapterKey: "claude_local", model: "unpriced-preview", presentedGeneration: 1 },
      snapshot(),
    );
    expect(d.ok).toBe(false);
    expect(d.reason).toBe("no_priced_route");
  });
});

describe("AC1 — monthly budget over → blocked + board alert", () => {
  it("blocks the call that would cross the monthly budget and flags a board alert", () => {
    // Budget 1000; 995 already committed (settled+reserved); a 10-unit call crosses.
    const d = authorizeCall(
      MANIFESTS,
      policy({ monthlyBudgetUnits: 1000 }),
      ACTIVE,
      { adapterKey: "claude_local", model: "claude-opus-4-8", presentedGeneration: 1 },
      snapshot({ monthlySettledUnits: 990, monthlyReservedUnits: 5 }),
    );
    expect(d.ok).toBe(false);
    expect(d.reason).toBe("monthly_budget_exceeded");
    expect(d.boardAlert).toBe(true);
  });

  it("allows the last call that exactly fills the budget (respect the smallest figure)", () => {
    const d = authorizeCall(
      MANIFESTS,
      policy({ monthlyBudgetUnits: 1000 }),
      ACTIVE,
      { adapterKey: "claude_local", model: "claude-opus-4-8", presentedGeneration: 1 },
      snapshot({ monthlySettledUnits: 990, monthlyReservedUnits: 0 }),
    );
    expect(d.ok).toBe(true); // 990 + 10 = 1000, not over
  });

  it("never auto-blocks an uncapped (null budget) employee", () => {
    const d = authorizeCall(
      MANIFESTS,
      policy({ monthlyBudgetUnits: null }),
      ACTIVE,
      { adapterKey: "claude_local", model: "claude-opus-4-8", presentedGeneration: 1 },
      snapshot({ monthlySettledUnits: 10_000_000 }),
    );
    expect(d.ok).toBe(true);
  });
});

describe("AC2 — run cost_limit hit → stop + propose partial", () => {
  it("stops the run when the next reservation would cross the cost_limit", () => {
    const d = authorizeCall(
      MANIFESTS,
      policy(),
      ACTIVE,
      { adapterKey: "claude_local", model: "claude-opus-4-8", presentedGeneration: 1 },
      snapshot({ runCommittedUnits: 95 }),
      { runCostLimitUnits: 100 }, // 95 + 10 = 105 > 100
    );
    expect(d.ok).toBe(false);
    expect(d.reason).toBe("run_cost_limit_exceeded");
    expect(d.runStop).toBe(true);
  });

  it("run cost_limit is checked before the monthly budget (a run stops itself first)", () => {
    // Both would trip; the run-scoped stop wins so the employee isn't globally blocked.
    const d = authorizeCall(
      MANIFESTS,
      policy({ monthlyBudgetUnits: 100 }),
      ACTIVE,
      { adapterKey: "claude_local", model: "claude-opus-4-8", presentedGeneration: 1 },
      snapshot({ runCommittedUnits: 95, monthlySettledUnits: 95 }),
      { runCostLimitUnits: 100 },
    );
    expect(d.reason).toBe("run_cost_limit_exceeded");
    expect(d.runStop).toBe(true);
    expect(d.boardAlert).toBe(false);
  });
});

describe("settlement — reservation → settle/refund", () => {
  it("settles the actual and refunds the unused reservation", () => {
    expect(settleReservation(10, 4)).toEqual({ settledUnits: 4, refundUnits: 6 });
  });

  it("refunds the whole reservation on a failed call", () => {
    expect(settleFailure(10)).toEqual({ settledUnits: 0, refundUnits: 10 });
  });

  it("records an over-run truthfully (actual above reservation refunds nothing)", () => {
    expect(settleReservation(10, 13)).toEqual({ settledUnits: 13, refundUnits: 0 });
  });

  it("clamps negative actuals to zero", () => {
    expect(settleReservation(10, -5)).toEqual({ settledUnits: 0, refundUnits: 10 });
  });
});

describe("AC4 — per-employee spend reconciles from the ledger", () => {
  // Call A reserved 10, settled 4, refunded 6 (closed). Call B reserved 7,
  // settled 7 (closed). Call C reserved 3, still open (in flight).
  const ledger = [
    { kind: "reservation", units: 10 },
    { kind: "settlement", units: 4 },
    { kind: "refund", units: 6 },
    { kind: "reservation", units: 7 },
    { kind: "settlement", units: 7 },
    { kind: "reservation", units: 3 },
  ];

  it("spend is the sum of settlements — reservations and refunds are not spend", () => {
    expect(spentUnits(ledger)).toBe(11); // 4 + 7
  });

  it("open reserved units are the still-in-flight reservations", () => {
    expect(openReservedUnits(ledger)).toBe(3); // only call C is open
  });

  it("a fully-settled ledger nets to zero open units", () => {
    const closed = ledger.slice(0, 5);
    expect(openReservedUnits(closed)).toBe(0);
  });
});

describe("AC5 — a new adapter is data only", () => {
  it("authorizes a brand-new adapter added purely as a manifest entry", () => {
    // No code in the core mentions "gemini_api"; adding the manifest + a policy
    // grant is sufficient for it to route and enforce. Microdollar unit too.
    const geminiApi: AdapterManifest = {
      key: "gemini_api",
      displayName: "Gemini (API)",
      billingModel: "api",
      unit: "microdollars",
      capabilities: ["chat"],
      routes: [{ model: "gemini-3-pro", reserveUnits: 5000 }], // µ$ upper bound
    };
    const manifests = new Map(MANIFESTS);
    manifests.set(geminiApi.key, geminiApi);

    const d = authorizeCall(
      manifests,
      policy({
        allowedAdapters: [{ adapterKey: "gemini_api", models: "*" }],
        monthlyBudgetUnits: 1_000_000,
        unit: "microdollars",
        capabilityScopes: ["chat"],
      }),
      ACTIVE,
      { adapterKey: "gemini_api", model: "gemini-3-pro", capability: "chat", presentedGeneration: 1 },
      snapshot(),
      { runCostLimitUnits: 50_000 },
    );
    expect(d.ok).toBe(true);
    expect(d.reserveUnits).toBe(5000);
  });
});
