import type { Db } from "@paperclipai/db";
import {
  policyLedgerService,
  type AuthorizeInput,
  type PolicyLedgerHooks,
} from "./policy-ledger.js";

/** The slice of the ledger service the runtime needs — the injectable seam. */
export type PolicyLedgerServiceLike = Pick<
  ReturnType<typeof policyLedgerService>,
  "getActivePolicy" | "getActiveCredentialGeneration" | "authorize" | "findOpenRunReservation" | "settle"
>;

/**
 * Adapter call-site interception for the per-employee policy/cost ledger (VIT-46,
 * child of the finance layer in doc/finance/POLICY-LEDGER.md).
 *
 * The finance layer (schema, pure core, service, routes) is complete and enforces
 * via the authorize/settle endpoints. This module is the *runtime* half the
 * Engineering department owns: it wraps the single adapter call the heartbeat
 * runtime actually controls — one `adapter.execute()` per heartbeat run — with a
 * reservation before and a settlement after, so per-employee COGS is metered
 * mechanically at the call site rather than hoped-for.
 *
 * Physics of the boundary: the individual provider tokens are spent *inside* the
 * claude/codex CLI subprocess, which Summon cannot see. The atomic, observable
 * unit Summon controls is one adapter execution per run. That is the call site.
 * One run = one reserve → one settle; the settlement carries the run's metered
 * `cost_event_id` so the ledger reconciles with the event log (AC4).
 *
 * Opt-in by construction: enforcement engages only for a metered adapter
 * (`claude_local`/`codex_local`) whose employee has an *active policy*. An agent
 * with no policy is a pure passthrough — zero behaviour change — which keeps this
 * additive to the existing runtime. Once a policy exists, a missing/revoked
 * credential fails closed (the board opted the employee into metering).
 */

/** Adapters metered through the policy ledger. New provider = one more key here. */
export const POLICY_LEDGER_ADAPTER_KEYS = new Set(["claude_local", "codex_local"]);

export function isPolicyLedgerAdapter(adapterType: string): boolean {
  return POLICY_LEDGER_ADAPTER_KEYS.has(adapterType);
}

export interface ReserveAdapterCallInput {
  companyId: string;
  agentId: string;
  adapterType: string;
  model: string | null;
  capability?: string | null;
  runId?: string | null;
  issueId?: string | null;
  heartbeatRunId?: string | null;
  /** The run's cost_limit threaded into the adapter run context, if any. */
  runCostLimitUnits?: number | null;
}

/** What the runtime should do with a reservation outcome at the call site. */
export type ReserveAdapterCallOutcome =
  /** Adapter not metered, or employee has no active policy → run normally. */
  | { enforced: false }
  /** Reserved; make the provider call, then settle this reservationId. */
  | {
      enforced: true;
      ok: true;
      reservationId: string;
      reserveUnits: number;
      generation: number;
      unit: string;
    }
  /**
   * Denied — do NOT make the provider call.
   * - `stop_run_partial_proposal`: run hit its cost_limit (AC2); stop and emit
   *   whatever partial work exists as a proposal.
   * - `block`: monthly budget exceeded or a credential deny (AC1/AC3); the
   *   employee is blocked and (for budget) the board is already alerted.
   */
  | {
      enforced: true;
      ok: false;
      action: "stop_run_partial_proposal" | "block";
      reason: string;
      unit: string;
    };

export interface SettleAdapterCallInput {
  companyId: string;
  runId: string;
  /** Provenance row from the metered COGS event, if one was recorded. */
  costEventId?: string | null;
  /**
   * Whether the run actually spent. A run that produced a metered cost event
   * settles the full reserved turn (subscription unit = one turn); a run that
   * produced none settles to zero, releasing the whole hold (core semantics for
   * a failed/no-op call).
   */
  hadSpend: boolean;
}

export function createPolicyLedgerRuntime(
  db: Db,
  hooks: PolicyLedgerHooks = {},
  deps: { ledger?: PolicyLedgerServiceLike } = {},
) {
  const ledger = deps.ledger ?? policyLedgerService(db, hooks);

  return {
    isPolicyLedgerAdapter,

    /**
     * Reserve one adapter call before the provider runs. Skips silently (returns
     * `enforced:false`) for unmetered adapters or employees without an active
     * policy. When metered, presents the live credential generation so a revoked
     * credential is refused on the very next call (AC3).
     */
    async reserveAdapterCall(input: ReserveAdapterCallInput): Promise<ReserveAdapterCallOutcome> {
      if (!isPolicyLedgerAdapter(input.adapterType)) return { enforced: false };

      const policy = await ledger.getActivePolicy(input.companyId, input.agentId);
      if (!policy) return { enforced: false };

      const presentedGeneration = await ledger.getActiveCredentialGeneration(
        input.companyId,
        input.agentId,
      );
      const authorizeInput: AuthorizeInput = {
        adapterKey: input.adapterType,
        model: input.model ?? "unknown",
        capability: input.capability ?? undefined,
        presentedGeneration,
        runId: input.runId ?? null,
        runCostLimitUnits: input.runCostLimitUnits ?? null,
        issueId: input.issueId ?? null,
        heartbeatRunId: input.heartbeatRunId ?? null,
      };

      const decision = await ledger.authorize(input.companyId, input.agentId, authorizeInput);
      if (decision.ok && decision.reservationId) {
        return {
          enforced: true,
          ok: true,
          reservationId: decision.reservationId,
          reserveUnits: decision.reserveUnits,
          generation: presentedGeneration,
          unit: decision.unit,
        };
      }
      return {
        enforced: true,
        ok: false,
        action: decision.runStop ? "stop_run_partial_proposal" : "block",
        reason: decision.reason ?? "denied",
        unit: decision.unit,
      };
    },

    /**
     * Settle the open reservation for a run after the adapter call completes.
     * Keys off the runId so the deep finalize path doesn't have to thread the
     * reservationId back down. A no-op when the run has no open reservation
     * (unmetered run, or the call was denied before a reservation was written).
     */
    async settleAdapterCall(
      input: SettleAdapterCallInput,
    ): Promise<{ settled: boolean; settledUnits?: number; refundUnits?: number }> {
      const reservation = await ledger.findOpenRunReservation(input.companyId, input.runId);
      if (!reservation) return { settled: false };
      const actualUnits = input.hadSpend ? reservation.units : 0;
      const result = await ledger.settle(input.companyId, {
        reservationId: reservation.id,
        actualUnits,
        costEventId: input.costEventId ?? null,
      });
      return { settled: true, settledUnits: result.settledUnits, refundUnits: result.refundUnits };
    },
  };
}

export type PolicyLedgerRuntime = ReturnType<typeof createPolicyLedgerRuntime>;
