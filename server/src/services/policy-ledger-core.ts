/**
 * Per-employee policy / credential / cost-ledger decision core (VIT-46).
 *
 * @see doc/research/OPENCLAW-LEARNINGS.md §2.4 (clawrouter pattern)
 * @see doc/finance/POLICY-LEDGER.md
 *
 * A clean-room reimplementation of the accounting SHAPE clawrouter proved at
 * scale: each employee holds one Summon-issued credential bound to a policy
 * (allowed adapters/models, monthly budget, capability scopes) — never a raw
 * provider key. Every adapter call is authorized against the policy and the
 * live ledger BEFORE it runs (an upper-bound reservation) and settled AFTER, in
 * normalized usage units for subscription adapters today and microdollars when
 * API adapters land.
 *
 * This module is deliberately PURE and dependency-free: no DB, no clock, no IO.
 * Every enforcement rule is a total function over plain data so the smallest
 * figure can be pinned in a unit test. The DB service layer
 * ({@link ./policy-ledger.ts}) persists ledger rows and computes the snapshots;
 * this core decides.
 *
 * Doctrine (Rockefeller): measure every cent, respect the smallest figure, and
 * never let an unmeasured call through — a call without a priced route FAILS
 * CLOSED, because you cannot control what you do not count.
 */

/** The unit a policy/adapter denominates cost in. */
export type BillingUnit = "normalized_units" | "microdollars";

/**
 * A single priced route within an adapter manifest. A route is what makes a
 * (adapter, model) pair spendable: no route → the call fails closed. Providers
 * are declared as data (manifests), never as per-provider code, so a new vendor
 * is a manifest entry plus its adapter module and touches no enforcement logic.
 */
export interface AdapterRoute {
  model: string;
  /**
   * Upper-bound cost of one call on this route, in the manifest's unit. Used as
   * the pre-request RESERVATION. Must be a finite number > 0 for the route to be
   * priced; anything else (missing/NaN/<=0) makes the route unpriced → closed.
   */
  reserveUnits: number;
}

/** A provider/adapter declared as data, not code. */
export interface AdapterManifest {
  key: string;
  displayName: string;
  billingModel: "subscription" | "api";
  unit: BillingUnit;
  routes: AdapterRoute[];
  /** Capability tokens this adapter is able to satisfy (e.g. "code", "chat"). */
  capabilities: string[];
  isActive?: boolean;
}

/** An entry in an employee policy's allow-list of adapters + models. */
export interface PolicyAdapterGrant {
  adapterKey: string;
  /** Explicit model allow-list, or "*" for every model the manifest prices. */
  models: string[] | "*";
}

/**
 * The policy an employee's credential is bound to. Mirrors clawrouter's Policy:
 * allowed providers/models + a hard monthly budget + capability roles.
 */
export interface EmployeePolicy {
  allowedAdapters: PolicyAdapterGrant[];
  /**
   * Hard monthly spend ceiling for this employee, in {@link unit}. A reservation
   * that would push the month's (settled + open) spend over this is blocked and
   * raises a board alert. `null` = uncapped (still metered, never auto-blocked).
   */
  monthlyBudgetUnits: number | null;
  unit: BillingUnit;
  /** Capability scopes the employee is permitted to invoke. */
  capabilityScopes: string[];
}

/** The decision-relevant view of a credential (the DB row hashes the secret). */
export interface CredentialView {
  status: "active" | "revoked";
  /**
   * Monotonic generation number. Revocation bumps it; a call must present the
   * current generation. A stale generation fails closed on the very next call,
   * which is what makes revocation take effect immediately despite any caching.
   */
  generation: number;
}

/** What the runtime presents when it wants to make one adapter call. */
export interface AdapterCallRequest {
  adapterKey: string;
  model: string;
  /** Capability this specific call needs, checked against the policy scopes. */
  capability?: string;
  /** Generation the caller holds; must equal the live credential generation. */
  presentedGeneration: number;
  /**
   * Caller's own upper-bound estimate for this call, in the policy unit. When
   * omitted the route's `reserveUnits` is used. A caller may reserve MORE than
   * the route default (e.g. a long run) but never less than 1 unit.
   */
  estimatedUnits?: number;
}

/** Live ledger rollups the decision needs, all in the policy unit. */
export interface LedgerSnapshot {
  /** Settled − refunded for this employee in the current month. */
  monthlySettledUnits: number;
  /** Currently-open (reserved, not yet settled) for this employee this month. */
  monthlyReservedUnits: number;
  /** Open + settled for the CURRENT RUN (drives the per-run cost_limit). */
  runCommittedUnits: number;
}

export interface AuthorizeOptions {
  /**
   * The run's cost_limit in the policy unit (lobster's per-run cost_limit). When
   * a reservation would push the run over this, the run STOPS and reports its
   * partial results as a proposal rather than spending more.
   */
  runCostLimitUnits?: number | null;
}

export type DenyReason =
  | "credential_revoked"
  | "credential_stale_generation"
  | "adapter_unknown"
  | "adapter_inactive"
  | "adapter_not_allowed"
  | "model_not_allowed"
  | "capability_out_of_scope"
  | "no_priced_route"
  | "monthly_budget_exceeded"
  | "run_cost_limit_exceeded";

export interface AuthorizeDecision {
  ok: boolean;
  reason?: DenyReason;
  /** Units that WOULD be reserved (on ok) or that were requested (on deny). */
  reserveUnits: number;
  /** AC1: an employee over its monthly budget must raise a board alert. */
  boardAlert: boolean;
  /** AC2: a run at its cost_limit must stop and propose partial results. */
  runStop: boolean;
}

function deny(
  reason: DenyReason,
  reserveUnits: number,
  extra?: { boardAlert?: boolean; runStop?: boolean },
): AuthorizeDecision {
  return {
    ok: false,
    reason,
    reserveUnits,
    boardAlert: extra?.boardAlert ?? false,
    runStop: extra?.runStop ?? false,
  };
}

/** A route is priced iff it exists and carries a finite, positive reserveUnits. */
export function priceRoute(
  manifest: AdapterManifest,
  model: string,
): AdapterRoute | null {
  const route = manifest.routes.find((r) => r.model === model);
  if (!route) return null;
  if (!Number.isFinite(route.reserveUnits) || route.reserveUnits <= 0) return null;
  return route;
}

/** Normalize a requested reservation: caller estimate, floored at the route price, min 1. */
export function reservationUnits(route: AdapterRoute, estimate?: number): number {
  const base = Math.max(1, Math.round(route.reserveUnits));
  if (estimate == null || !Number.isFinite(estimate)) return base;
  return Math.max(base, Math.round(estimate));
}

/**
 * The single enforcement point. Decides whether one adapter call may proceed,
 * and how many units to reserve. Order is deliberate — the cheapest, most
 * security-critical checks first (credential, then policy allow-list, then
 * fail-closed pricing, then the two budgets) so a revoked or out-of-scope call
 * never even reaches a pricing lookup.
 */
export function authorizeCall(
  manifests: ReadonlyMap<string, AdapterManifest>,
  policy: EmployeePolicy,
  credential: CredentialView,
  request: AdapterCallRequest,
  snapshot: LedgerSnapshot,
  opts: AuthorizeOptions = {},
): AuthorizeDecision {
  // 1. Credential validity — revocation takes effect on the next call.
  if (credential.status === "revoked") return deny("credential_revoked", 0);
  if (request.presentedGeneration !== credential.generation) {
    return deny("credential_stale_generation", 0);
  }

  // 2. Adapter must exist as an active manifest (providers are data).
  const manifest = manifests.get(request.adapterKey);
  if (!manifest) return deny("adapter_unknown", 0);
  if (manifest.isActive === false) return deny("adapter_inactive", 0);

  // 3. Policy allow-list: adapter, then model, then capability scope.
  const grant = policy.allowedAdapters.find((g) => g.adapterKey === request.adapterKey);
  if (!grant) return deny("adapter_not_allowed", 0);
  if (grant.models !== "*" && !grant.models.includes(request.model)) {
    return deny("model_not_allowed", 0);
  }
  if (request.capability && !policy.capabilityScopes.includes(request.capability)) {
    return deny("capability_out_of_scope", 0);
  }

  // 4. Fail closed: a call without a priced route is never allowed through.
  const route = priceRoute(manifest, request.model);
  if (!route) return deny("no_priced_route", 0);
  const reserve = reservationUnits(route, request.estimatedUnits);

  // 5. Per-run cost_limit — stop the run and propose partial results (AC2).
  const runLimit = opts.runCostLimitUnits;
  if (runLimit != null && Number.isFinite(runLimit)) {
    if (snapshot.runCommittedUnits + reserve > runLimit) {
      return deny("run_cost_limit_exceeded", reserve, { runStop: true });
    }
  }

  // 6. Monthly budget — block further runs and alert the board (AC1).
  const budget = policy.monthlyBudgetUnits;
  if (budget != null && Number.isFinite(budget)) {
    const projected = snapshot.monthlySettledUnits + snapshot.monthlyReservedUnits + reserve;
    if (projected > budget) {
      return deny("monthly_budget_exceeded", reserve, { boardAlert: true });
    }
  }

  return { ok: true, reserveUnits: reserve, boardAlert: false, runStop: false };
}

export interface Settlement {
  settledUnits: number;
  refundUnits: number;
}

/**
 * Settle a reservation once the real cost is known. Settled is the actual usage
 * (never negative); the unused portion of the reservation is refunded so open
 * reservations don't strand budget. If actual exceeds the reservation (an
 * under-estimate) we settle the actual and refund nothing — the over-run is
 * recorded truthfully rather than hidden.
 */
export function settleReservation(reservedUnits: number, actualUnits: number): Settlement {
  const reserved = Math.max(0, Math.round(reservedUnits));
  const settled = Math.max(0, Math.round(actualUnits));
  const refund = Math.max(0, reserved - settled);
  return { settledUnits: settled, refundUnits: refund };
}

/** A failed call settles to zero and refunds the whole reservation. */
export function settleFailure(reservedUnits: number): Settlement {
  return settleReservation(reservedUnits, 0);
}

/**
 * Actual spend a set of ledger movements represents: the sum of settlements.
 * Reservations hold budget but are not spend, and refunds close reservations —
 * neither moves the spend figure. This is the number that reconciles against
 * the metered cost events (AC4).
 */
export function spentUnits(
  entries: ReadonlyArray<{ kind: string; units: number }>,
): number {
  let spent = 0;
  for (const e of entries) {
    if (e.kind === "settlement") spent += Math.max(0, e.units);
  }
  return spent;
}

/**
 * Units still held by open reservations: reservations not yet closed by a
 * settlement or a refund. Each reservation of R closes to a settlement S plus a
 * refund (R − S), so a fully-settled ledger nets to zero open units.
 */
export function openReservedUnits(
  entries: ReadonlyArray<{ kind: string; units: number }>,
): number {
  let open = 0;
  for (const e of entries) {
    if (e.kind === "reservation") open += Math.max(0, e.units);
    else if (e.kind === "settlement" || e.kind === "refund") open -= Math.max(0, e.units);
  }
  return Math.max(0, open);
}
