import { describe, expect, it, vi } from "vitest";
import {
  createPolicyLedgerRuntime,
  isPolicyLedgerAdapter,
  type PolicyLedgerServiceLike,
} from "./policy-ledger-runtime.js";

/**
 * VIT-46 adapter call-site interception (the runtime half Engineering owns).
 *
 * The pure enforcement (policy-ledger-core) and the DB gateway (policy-ledger)
 * are tested elsewhere. These cases pin the RUNTIME contract at the call site:
 *   - only metered adapters with an active policy engage (opt-in passthrough);
 *   - the live credential generation is presented (so revoke blocks next call);
 *   - a decision maps to the right runtime action (stop vs block);
 *   - settle keys off the runId and settles the full turn on spend / zero on none.
 *
 * The ledger service is injected as a fake so this stays a fast unit test with
 * no database — the DB paths it calls are already covered by the service tests.
 */

const OK_DECISION = {
  ok: true as const,
  reason: undefined,
  reserveUnits: 10,
  boardAlert: false,
  runStop: false,
  reservationId: "res-1",
  unit: "normalized_units",
};

function fakeLedger(overrides: Partial<PolicyLedgerServiceLike> = {}): PolicyLedgerServiceLike {
  return {
    getActivePolicy: vi.fn(async () => ({ id: "pol-1" }) as never),
    getActiveCredentialGeneration: vi.fn(async () => 3),
    authorize: vi.fn(async () => OK_DECISION as never),
    findOpenRunReservation: vi.fn(async () => ({ id: "res-1", units: 10 }) as never),
    settle: vi.fn(async () => ({ settledUnits: 10, refundUnits: 0 }) as never),
    ...overrides,
  };
}

describe("isPolicyLedgerAdapter", () => {
  it("meters claude_local and codex_local, nothing else", () => {
    expect(isPolicyLedgerAdapter("claude_local")).toBe(true);
    expect(isPolicyLedgerAdapter("codex_local")).toBe(true);
    expect(isPolicyLedgerAdapter("cursor")).toBe(false);
    expect(isPolicyLedgerAdapter("gemini_local")).toBe(false);
  });
});

describe("reserveAdapterCall — opt-in gating", () => {
  it("passes through unmetered adapters without touching the ledger", async () => {
    const ledger = fakeLedger();
    const runtime = createPolicyLedgerRuntime({} as never, {}, { ledger });
    const outcome = await runtime.reserveAdapterCall({
      companyId: "c1",
      agentId: "a1",
      adapterType: "cursor",
      model: "auto",
    });
    expect(outcome).toEqual({ enforced: false });
    expect(ledger.getActivePolicy).not.toHaveBeenCalled();
    expect(ledger.authorize).not.toHaveBeenCalled();
  });

  it("passes through a metered adapter whose employee has no active policy", async () => {
    const ledger = fakeLedger({ getActivePolicy: vi.fn(async () => null) });
    const runtime = createPolicyLedgerRuntime({} as never, {}, { ledger });
    const outcome = await runtime.reserveAdapterCall({
      companyId: "c1",
      agentId: "a1",
      adapterType: "claude_local",
      model: "claude-opus-4-8",
    });
    expect(outcome).toEqual({ enforced: false });
    expect(ledger.authorize).not.toHaveBeenCalled();
  });
});

describe("reserveAdapterCall — enforced path", () => {
  it("presents the live credential generation and returns the reservation on ok", async () => {
    const ledger = fakeLedger();
    const runtime = createPolicyLedgerRuntime({} as never, {}, { ledger });
    const outcome = await runtime.reserveAdapterCall({
      companyId: "c1",
      agentId: "a1",
      adapterType: "claude_local",
      model: "claude-opus-4-8",
      runId: "run-1",
      runCostLimitUnits: 50,
    });
    expect(outcome).toEqual({
      enforced: true,
      ok: true,
      reservationId: "res-1",
      reserveUnits: 10,
      generation: 3,
      unit: "normalized_units",
    });
    expect(ledger.authorize).toHaveBeenCalledWith(
      "c1",
      "a1",
      expect.objectContaining({
        adapterKey: "claude_local",
        model: "claude-opus-4-8",
        presentedGeneration: 3,
        runId: "run-1",
        runCostLimitUnits: 50,
      }),
    );
  });

  it("maps a run cost_limit deny to stop_run_partial_proposal (AC2)", async () => {
    const ledger = fakeLedger({
      authorize: vi.fn(async () => ({
        ok: false,
        reason: "run_cost_limit_exceeded",
        reserveUnits: 10,
        boardAlert: false,
        runStop: true,
        reservationId: null,
        unit: "normalized_units",
      }) as never),
    });
    const runtime = createPolicyLedgerRuntime({} as never, {}, { ledger });
    const outcome = await runtime.reserveAdapterCall({
      companyId: "c1",
      agentId: "a1",
      adapterType: "claude_local",
      model: "claude-opus-4-8",
    });
    expect(outcome).toMatchObject({
      enforced: true,
      ok: false,
      action: "stop_run_partial_proposal",
      reason: "run_cost_limit_exceeded",
    });
  });

  it("maps a monthly-budget deny to block (AC1)", async () => {
    const ledger = fakeLedger({
      authorize: vi.fn(async () => ({
        ok: false,
        reason: "monthly_budget_exceeded",
        reserveUnits: 10,
        boardAlert: true,
        runStop: false,
        reservationId: null,
        unit: "normalized_units",
      }) as never),
    });
    const runtime = createPolicyLedgerRuntime({} as never, {}, { ledger });
    const outcome = await runtime.reserveAdapterCall({
      companyId: "c1",
      agentId: "a1",
      adapterType: "codex_local",
      model: "gpt-5-codex",
    });
    expect(outcome).toMatchObject({ enforced: true, ok: false, action: "block", reason: "monthly_budget_exceeded" });
  });

  it("maps a revoked credential deny to block (AC3)", async () => {
    const ledger = fakeLedger({
      getActiveCredentialGeneration: vi.fn(async () => -1),
      authorize: vi.fn(async () => ({
        ok: false,
        reason: "credential_revoked",
        reserveUnits: 10,
        boardAlert: false,
        runStop: false,
        reservationId: null,
        unit: "normalized_units",
      }) as never),
    });
    const runtime = createPolicyLedgerRuntime({} as never, {}, { ledger });
    const outcome = await runtime.reserveAdapterCall({
      companyId: "c1",
      agentId: "a1",
      adapterType: "claude_local",
      model: "claude-opus-4-8",
    });
    expect(outcome).toMatchObject({ enforced: true, ok: false, action: "block", reason: "credential_revoked" });
    expect(ledger.authorize).toHaveBeenCalledWith(
      "c1",
      "a1",
      expect.objectContaining({ presentedGeneration: -1 }),
    );
  });
});

describe("settleAdapterCall", () => {
  it("settles the full reserved turn and ties the cost event when the run spent", async () => {
    const ledger = fakeLedger();
    const runtime = createPolicyLedgerRuntime({} as never, {}, { ledger });
    const result = await runtime.settleAdapterCall({
      companyId: "c1",
      runId: "run-1",
      costEventId: "evt-9",
      hadSpend: true,
    });
    expect(result).toEqual({ settled: true, settledUnits: 10, refundUnits: 0 });
    expect(ledger.settle).toHaveBeenCalledWith("c1", {
      reservationId: "res-1",
      actualUnits: 10,
      costEventId: "evt-9",
    });
  });

  it("settles to zero (full refund) when the run produced no metered spend", async () => {
    const ledger = fakeLedger({ settle: vi.fn(async () => ({ settledUnits: 0, refundUnits: 10 }) as never) });
    const runtime = createPolicyLedgerRuntime({} as never, {}, { ledger });
    await runtime.settleAdapterCall({ companyId: "c1", runId: "run-1", costEventId: null, hadSpend: false });
    expect(ledger.settle).toHaveBeenCalledWith("c1", {
      reservationId: "res-1",
      actualUnits: 0,
      costEventId: null,
    });
  });

  it("is a no-op when the run has no open reservation", async () => {
    const ledger = fakeLedger({ findOpenRunReservation: vi.fn(async () => null) });
    const runtime = createPolicyLedgerRuntime({} as never, {}, { ledger });
    const result = await runtime.settleAdapterCall({
      companyId: "c1",
      runId: "run-unmetered",
      hadSpend: true,
    });
    expect(result).toEqual({ settled: false });
    expect(ledger.settle).not.toHaveBeenCalled();
  });
});
