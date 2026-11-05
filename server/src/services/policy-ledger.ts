import { createHash, randomBytes } from "node:crypto";
import { and, desc, eq, gte, lt, sql } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import {
  adapterManifests,
  agents,
  companies,
  costLedgerEntries,
  employeeCredentials,
  employeePolicies,
} from "@paperclipai/db";
import { badRequest, notFound, unprocessable } from "../errors.js";
import {
  authorizeCall,
  settleReservation,
  type AdapterManifest,
  type AuthorizeDecision,
  type CredentialView,
  type EmployeePolicy,
  type LedgerSnapshot,
} from "./policy-ledger-core.js";

/**
 * Per-employee policy / credential / cost-ledger service (VIT-46).
 *
 * @see doc/finance/POLICY-LEDGER.md
 * @see ./policy-ledger-core.ts (the pure enforcement decision core)
 *
 * The DB gateway around the pure core: it issues policy-bound credentials,
 * revokes them (instantly, via generation bump), authorizes each adapter call
 * against the live ledger (upper-bound reservation) and settles it after, and
 * answers per-employee spend. All money math lives in the pure core; this layer
 * only persists movements and computes the snapshots the core decides on.
 *
 * Doctrine (Rockefeller): every adapter call is pre-reserved and settled, in
 * the smallest figure the adapter meters; a call without a priced route never
 * runs. You cannot control what you do not count.
 */

export type PolicyLedgerScope = {
  companyId: string;
  scopeType: "agent";
  scopeId: string;
};

export type BoardAlert = {
  companyId: string;
  agentId: string;
  reason: "monthly_budget_exceeded";
  policyId: string | null;
  monthlyBudgetUnits: number | null;
  unit: string;
};

export type PolicyLedgerHooks = {
  /** Cancels in-flight work for a scope — same shape the budget guard uses. */
  cancelWorkForScope?: (scope: PolicyLedgerScope) => Promise<void>;
  /** Fired when an employee crosses its monthly budget (VIT-46 AC1). */
  onBoardAlert?: (alert: BoardAlert) => Promise<void>;
};

type ManifestRow = typeof adapterManifests.$inferSelect;
type PolicyRow = typeof employeePolicies.$inferSelect;
type CredentialRow = typeof employeeCredentials.$inferSelect;
type LedgerRow = typeof costLedgerEntries.$inferSelect;

export interface AdapterManifestInput {
  key: string;
  displayName: string;
  billingModel?: "subscription" | "api";
  unit?: "normalized_units" | "microdollars";
  routes: Array<{ model: string; reserveUnits: number }>;
  capabilities?: string[];
  isActive?: boolean;
}

export interface PolicyInput {
  name: string;
  allowedAdapters: Array<{ adapterKey: string; models: string[] | "*" }>;
  monthlyBudgetUnits?: number | null;
  unit?: "normalized_units" | "microdollars";
  capabilityScopes?: string[];
}

export interface AuthorizeInput {
  adapterKey: string;
  model: string;
  capability?: string;
  /** Generation the caller presents; must match the live credential. */
  presentedGeneration: number;
  estimatedUnits?: number;
  runId?: string | null;
  runCostLimitUnits?: number | null;
  issueId?: string | null;
  heartbeatRunId?: string | null;
}

export interface SettleInput {
  reservationId: string;
  actualUnits: number;
  costEventId?: string | null;
  description?: string | null;
}

function sha256(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function currentUtcMonthWindow(now = new Date()) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0));
  return { start, end };
}

function manifestRowToCore(row: ManifestRow): AdapterManifest {
  return {
    key: row.key,
    displayName: row.displayName,
    billingModel: row.billingModel === "api" ? "api" : "subscription",
    unit: row.unit === "microdollars" ? "microdollars" : "normalized_units",
    routes: (row.routesJson ?? []).map((r) => ({ model: r.model, reserveUnits: r.reserveUnits })),
    capabilities: row.capabilitiesJson ?? [],
    isActive: row.isActive,
  };
}

function policyRowToCore(row: PolicyRow): EmployeePolicy {
  return {
    allowedAdapters: row.allowedAdaptersJson ?? [],
    monthlyBudgetUnits: row.monthlyBudgetUnits,
    unit: row.unit === "microdollars" ? "microdollars" : "normalized_units",
    capabilityScopes: row.capabilityScopesJson ?? [],
  };
}

export function policyLedgerService(db: Db, hooks: PolicyLedgerHooks = {}) {
  async function assertCompany(companyId: string) {
    const row = await db
      .select({ id: companies.id })
      .from(companies)
      .where(eq(companies.id, companyId))
      .then((rows) => rows[0] ?? null);
    if (!row) throw notFound("Company not found");
  }

  async function assertAgent(companyId: string, agentId: string) {
    const row = await db
      .select({ id: agents.id, companyId: agents.companyId })
      .from(agents)
      .where(eq(agents.id, agentId))
      .then((rows) => rows[0] ?? null);
    if (!row) throw notFound("Agent not found");
    if (row.companyId !== companyId) throw unprocessable("Agent does not belong to company");
  }

  /** Load every active adapter manifest as the immutable map the core reads. */
  async function loadManifestMap(): Promise<Map<string, AdapterManifest>> {
    const rows = await db.select().from(adapterManifests).where(eq(adapterManifests.isActive, true));
    return new Map(rows.map((r) => [r.key, manifestRowToCore(r)]));
  }

  async function getActivePolicyRow(companyId: string, agentId: string): Promise<PolicyRow | null> {
    return db
      .select()
      .from(employeePolicies)
      .where(
        and(
          eq(employeePolicies.companyId, companyId),
          eq(employeePolicies.agentId, agentId),
          eq(employeePolicies.isActive, true),
        ),
      )
      .then((rows) => rows[0] ?? null);
  }

  async function getActiveCredentialRow(companyId: string, agentId: string): Promise<CredentialRow | null> {
    return db
      .select()
      .from(employeeCredentials)
      .where(
        and(
          eq(employeeCredentials.companyId, companyId),
          eq(employeeCredentials.agentId, agentId),
          eq(employeeCredentials.status, "active"),
        ),
      )
      .orderBy(desc(employeeCredentials.createdAt))
      .then((rows) => rows[0] ?? null);
  }

  /** Movements grouped by kind for an employee in the current month. */
  async function monthlyRollup(companyId: string, agentId: string) {
    const { start, end } = currentUtcMonthWindow();
    const [row] = await db
      .select({
        reserved: sql<number>`coalesce(sum(case when ${costLedgerEntries.kind} = 'reservation' then ${costLedgerEntries.units} else 0 end), 0)::double precision`,
        settled: sql<number>`coalesce(sum(case when ${costLedgerEntries.kind} = 'settlement' then ${costLedgerEntries.units} else 0 end), 0)::double precision`,
        refunded: sql<number>`coalesce(sum(case when ${costLedgerEntries.kind} = 'refund' then ${costLedgerEntries.units} else 0 end), 0)::double precision`,
      })
      .from(costLedgerEntries)
      .where(
        and(
          eq(costLedgerEntries.companyId, companyId),
          eq(costLedgerEntries.agentId, agentId),
          gte(costLedgerEntries.occurredAt, start),
          lt(costLedgerEntries.occurredAt, end),
        ),
      );
    const reserved = Number(row?.reserved ?? 0);
    const settled = Number(row?.settled ?? 0);
    const refunded = Number(row?.refunded ?? 0);
    return {
      settled,
      // Still-in-flight reservations (open budget hold).
      open: Math.max(0, reserved - settled - refunded),
    };
  }

  /** Committed (settled + still-open) units for a single run. */
  async function runCommitted(companyId: string, runId: string): Promise<number> {
    const [row] = await db
      .select({
        reserved: sql<number>`coalesce(sum(case when ${costLedgerEntries.kind} = 'reservation' then ${costLedgerEntries.units} else 0 end), 0)::double precision`,
        refunded: sql<number>`coalesce(sum(case when ${costLedgerEntries.kind} = 'refund' then ${costLedgerEntries.units} else 0 end), 0)::double precision`,
      })
      .from(costLedgerEntries)
      .where(and(eq(costLedgerEntries.companyId, companyId), eq(costLedgerEntries.runId, runId)));
    return Math.max(0, Number(row?.reserved ?? 0) - Number(row?.refunded ?? 0));
  }

  return {
    // --- Adapter manifests (providers as data) ---------------------------

    upsertManifest: async (input: AdapterManifestInput): Promise<ManifestRow> => {
      if (!input.key?.trim()) throw badRequest("Manifest key is required");
      const values = {
        key: input.key,
        displayName: input.displayName,
        billingModel: input.billingModel ?? "subscription",
        unit: input.unit ?? "normalized_units",
        routesJson: input.routes ?? [],
        capabilitiesJson: input.capabilities ?? [],
        isActive: input.isActive ?? true,
        updatedAt: new Date(),
      };
      const existing = await db
        .select({ id: adapterManifests.id })
        .from(adapterManifests)
        .where(eq(adapterManifests.key, input.key))
        .then((rows) => rows[0] ?? null);
      if (existing) {
        return db
          .update(adapterManifests)
          .set(values)
          .where(eq(adapterManifests.id, existing.id))
          .returning()
          .then((rows) => rows[0]);
      }
      return db
        .insert(adapterManifests)
        .values(values)
        .returning()
        .then((rows) => rows[0]);
    },

    listManifests: async (): Promise<ManifestRow[]> =>
      db.select().from(adapterManifests).orderBy(desc(adapterManifests.isActive), adapterManifests.key),

    // --- Employee policies -----------------------------------------------

    setPolicy: async (
      companyId: string,
      agentId: string,
      input: PolicyInput,
      userId?: string | null,
    ): Promise<PolicyRow> => {
      await assertCompany(companyId);
      await assertAgent(companyId, agentId);
      if (!input.name?.trim()) throw badRequest("Policy name is required");
      const now = new Date();
      const existing = await getActivePolicyRow(companyId, agentId);
      const values = {
        name: input.name,
        allowedAdaptersJson: input.allowedAdapters ?? [],
        monthlyBudgetUnits: input.monthlyBudgetUnits ?? null,
        unit: input.unit ?? "normalized_units",
        capabilityScopesJson: input.capabilityScopes ?? [],
        updatedByUserId: userId ?? null,
        updatedAt: now,
      };
      if (existing) {
        return db
          .update(employeePolicies)
          .set(values)
          .where(eq(employeePolicies.id, existing.id))
          .returning()
          .then((rows) => rows[0]);
      }
      return db
        .insert(employeePolicies)
        .values({ companyId, agentId, createdByUserId: userId ?? null, ...values })
        .returning()
        .then((rows) => rows[0]);
    },

    getActivePolicy: getActivePolicyRow,

    /**
     * Live generation of the employee's active credential, or -1 when none is
     * active. The runtime presents this at authorize time; -1 never matches a
     * live generation, so a policy without a credential fails closed.
     */
    getActiveCredentialGeneration: async (companyId: string, agentId: string): Promise<number> => {
      const row = await getActiveCredentialRow(companyId, agentId);
      return row?.generation ?? -1;
    },

    // --- Credentials (issue / revoke) ------------------------------------

    /**
     * Issue one Summon credential bound to the employee's active policy. Returns
     * the plaintext token exactly once; only its hash is stored. Any prior
     * active credential for the employee is revoked so one is live at a time.
     */
    issueCredential: async (companyId: string, agentId: string, userId?: string | null) => {
      await assertCompany(companyId);
      await assertAgent(companyId, agentId);
      const policy = await getActivePolicyRow(companyId, agentId);
      if (!policy) throw unprocessable("Employee has no active policy to bind a credential to");

      // Retire any existing active credential (single live credential invariant).
      const now = new Date();
      await db
        .update(employeeCredentials)
        .set({ status: "revoked", revokedAt: now, revokedReason: "superseded", updatedAt: now })
        .where(
          and(
            eq(employeeCredentials.companyId, companyId),
            eq(employeeCredentials.agentId, agentId),
            eq(employeeCredentials.status, "active"),
          ),
        );

      const prefix = `empc_${randomBytes(4).toString("hex")}`;
      const secret = randomBytes(24).toString("hex");
      const token = `${prefix}_${secret}`;
      const row = await db
        .insert(employeeCredentials)
        .values({
          companyId,
          agentId,
          policyId: policy.id,
          credentialHash: sha256(token),
          prefix,
          generation: 1,
          status: "active",
          createdByUserId: userId ?? null,
        })
        .returning()
        .then((rows) => rows[0]);

      // Plaintext returned once — never persisted, never logged.
      return { credential: row, token };
    },

    /**
     * Revoke a credential. Bumping the generation and flipping status both make
     * the very next authorize call fail closed (VIT-46 AC3), regardless of any
     * cached credential the runtime may still hold.
     */
    revokeCredential: async (credentialId: string, reason?: string | null): Promise<CredentialRow> => {
      const now = new Date();
      const row = await db
        .update(employeeCredentials)
        .set({
          status: "revoked",
          generation: sql`${employeeCredentials.generation} + 1`,
          revokedAt: now,
          revokedReason: reason ?? "revoked",
          updatedAt: now,
        })
        .where(eq(employeeCredentials.id, credentialId))
        .returning()
        .then((rows) => rows[0] ?? null);
      if (!row) throw notFound("Credential not found");
      return row;
    },

    // --- Authorize / settle (the gateway hot path) -----------------------

    /**
     * Authorize one adapter call for an employee. Loads the live manifest map,
     * policy, and credential, builds the ledger snapshot, and asks the pure core
     * to decide. On allow, writes an OPEN reservation and returns its id. On a
     * monthly-budget block, fires the board alert and cancels in-flight work.
     */
    authorize: async (
      companyId: string,
      agentId: string,
      input: AuthorizeInput,
    ): Promise<AuthorizeDecision & { reservationId: string | null; unit: string }> => {
      const policyRow = await getActivePolicyRow(companyId, agentId);
      if (!policyRow) throw unprocessable("Employee has no active policy");
      const credRow = await getActiveCredentialRow(companyId, agentId);
      const credential: CredentialView = credRow
        ? { status: credRow.status === "active" ? "active" : "revoked", generation: credRow.generation }
        : { status: "revoked", generation: -1 };

      const manifests = await loadManifestMap();
      const policy = policyRowToCore(policyRow);
      const monthly = await monthlyRollup(companyId, agentId);
      const runUsed = input.runId ? await runCommitted(companyId, input.runId) : 0;
      const snapshot: LedgerSnapshot = {
        monthlySettledUnits: monthly.settled,
        monthlyReservedUnits: monthly.open,
        runCommittedUnits: runUsed,
      };

      const decision = authorizeCall(
        manifests,
        policy,
        credential,
        {
          adapterKey: input.adapterKey,
          model: input.model,
          capability: input.capability,
          presentedGeneration: input.presentedGeneration,
          estimatedUnits: input.estimatedUnits,
        },
        snapshot,
        { runCostLimitUnits: input.runCostLimitUnits },
      );

      if (!decision.ok) {
        if (decision.boardAlert) {
          await hooks.onBoardAlert?.({
            companyId,
            agentId,
            reason: "monthly_budget_exceeded",
            policyId: policyRow.id,
            monthlyBudgetUnits: policyRow.monthlyBudgetUnits,
            unit: policyRow.unit,
          });
          await hooks.cancelWorkForScope?.({ companyId, scopeType: "agent", scopeId: agentId });
        }
        return { ...decision, reservationId: null, unit: policyRow.unit };
      }

      const reservation = await db
        .insert(costLedgerEntries)
        .values({
          companyId,
          agentId,
          credentialId: credRow?.id ?? null,
          policyId: policyRow.id,
          runId: input.runId ?? null,
          issueId: input.issueId ?? null,
          heartbeatRunId: input.heartbeatRunId ?? null,
          adapterKey: input.adapterKey,
          model: input.model,
          kind: "reservation",
          unit: policyRow.unit,
          units: decision.reserveUnits,
          status: "open",
          occurredAt: new Date(),
        })
        .returning()
        .then((rows) => rows[0]);

      if (credRow) {
        await db
          .update(employeeCredentials)
          .set({ lastUsedAt: new Date() })
          .where(eq(employeeCredentials.id, credRow.id));
      }

      return { ...decision, reservationId: reservation.id, unit: policyRow.unit };
    },

    /**
     * The still-open reservation for a run, if any. The runtime settles by runId
     * (VIT-46 call-site interception) so the deep heartbeat finalize path doesn't
     * have to thread a reservationId back down; newest open reservation wins.
     */
    findOpenRunReservation: async (companyId: string, runId: string): Promise<LedgerRow | null> =>
      db
        .select()
        .from(costLedgerEntries)
        .where(
          and(
            eq(costLedgerEntries.companyId, companyId),
            eq(costLedgerEntries.runId, runId),
            eq(costLedgerEntries.kind, "reservation"),
            eq(costLedgerEntries.status, "open"),
          ),
        )
        .orderBy(desc(costLedgerEntries.occurredAt))
        .then((rows) => rows[0] ?? null),

    /**
     * Settle an open reservation once the real cost is known. Writes a
     * settlement entry (the actual spend, tied to its cost event) and, when the
     * reservation over-held, a refund entry that releases the unused budget.
     */
    settle: async (companyId: string, input: SettleInput) => {
      const reservation = await db
        .select()
        .from(costLedgerEntries)
        .where(
          and(
            eq(costLedgerEntries.id, input.reservationId),
            eq(costLedgerEntries.companyId, companyId),
            eq(costLedgerEntries.kind, "reservation"),
          ),
        )
        .then((rows) => rows[0] ?? null);
      if (!reservation) throw notFound("Reservation not found");
      if (reservation.status !== "open") throw unprocessable("Reservation is already settled");

      const { settledUnits, refundUnits } = settleReservation(reservation.units, input.actualUnits);
      const now = new Date();

      const settlement = await db
        .insert(costLedgerEntries)
        .values({
          companyId,
          agentId: reservation.agentId,
          credentialId: reservation.credentialId,
          policyId: reservation.policyId,
          runId: reservation.runId,
          issueId: reservation.issueId,
          heartbeatRunId: reservation.heartbeatRunId,
          reservationId: reservation.id,
          adapterKey: reservation.adapterKey,
          model: reservation.model,
          kind: "settlement",
          unit: reservation.unit,
          units: settledUnits,
          status: "settled",
          costEventId: input.costEventId ?? null,
          description: input.description ?? null,
          occurredAt: now,
        })
        .returning()
        .then((rows) => rows[0]);

      let refund: LedgerRow | null = null;
      if (refundUnits > 0) {
        refund = await db
          .insert(costLedgerEntries)
          .values({
            companyId,
            agentId: reservation.agentId,
            credentialId: reservation.credentialId,
            policyId: reservation.policyId,
            runId: reservation.runId,
            issueId: reservation.issueId,
            heartbeatRunId: reservation.heartbeatRunId,
            reservationId: reservation.id,
            adapterKey: reservation.adapterKey,
            model: reservation.model,
            kind: "refund",
            unit: reservation.unit,
            units: refundUnits,
            status: "refunded",
            occurredAt: now,
          })
          .returning()
          .then((rows) => rows[0]);
      }

      await db
        .update(costLedgerEntries)
        .set({ status: "settled" })
        .where(eq(costLedgerEntries.id, reservation.id));

      return { settlement, refund, settledUnits, refundUnits };
    },

    // --- Queries (spend, ledger, reconciliation) -------------------------

    /**
     * Per-employee spend for the current month: settled (actual), open holds,
     * and a reconciliation check that every settlement carries a metered
     * cost-event provenance (VIT-46 AC4).
     */
    employeeSpend: async (companyId: string, agentId: string) => {
      const { start, end } = currentUtcMonthWindow();
      const [row] = await db
        .select({
          reserved: sql<number>`coalesce(sum(case when ${costLedgerEntries.kind} = 'reservation' then ${costLedgerEntries.units} else 0 end), 0)::double precision`,
          settled: sql<number>`coalesce(sum(case when ${costLedgerEntries.kind} = 'settlement' then ${costLedgerEntries.units} else 0 end), 0)::double precision`,
          refunded: sql<number>`coalesce(sum(case when ${costLedgerEntries.kind} = 'refund' then ${costLedgerEntries.units} else 0 end), 0)::double precision`,
          settlements: sql<number>`coalesce(sum(case when ${costLedgerEntries.kind} = 'settlement' then 1 else 0 end), 0)::int`,
          settlementsWithEvent: sql<number>`coalesce(sum(case when ${costLedgerEntries.kind} = 'settlement' and ${costLedgerEntries.costEventId} is not null then 1 else 0 end), 0)::int`,
        })
        .from(costLedgerEntries)
        .where(
          and(
            eq(costLedgerEntries.companyId, companyId),
            eq(costLedgerEntries.agentId, agentId),
            gte(costLedgerEntries.occurredAt, start),
            lt(costLedgerEntries.occurredAt, end),
          ),
        );
      const policy = await getActivePolicyRow(companyId, agentId);
      const settled = Number(row?.settled ?? 0);
      const open = Math.max(0, Number(row?.reserved ?? 0) - settled - Number(row?.refunded ?? 0));
      const settlements = Number(row?.settlements ?? 0);
      const settlementsWithEvent = Number(row?.settlementsWithEvent ?? 0);
      return {
        companyId,
        agentId,
        unit: policy?.unit ?? "normalized_units",
        periodStart: start,
        periodEnd: end,
        spentUnits: settled,
        openReservedUnits: open,
        monthlyBudgetUnits: policy?.monthlyBudgetUnits ?? null,
        budgetRemainingUnits:
          policy?.monthlyBudgetUnits != null
            ? Math.max(0, policy.monthlyBudgetUnits - settled - open)
            : null,
        settlementCount: settlements,
        // AC4: the ledger reconciles with the event log iff every settled unit
        // of spend is backed by a metered cost event.
        reconciled: settlements === settlementsWithEvent,
        unreconciledSettlements: settlements - settlementsWithEvent,
      };
    },

    /** Raw ledger movements for an employee, newest first. */
    listLedger: async (companyId: string, agentId: string, limit = 100): Promise<LedgerRow[]> =>
      db
        .select()
        .from(costLedgerEntries)
        .where(
          and(eq(costLedgerEntries.companyId, companyId), eq(costLedgerEntries.agentId, agentId)),
        )
        .orderBy(desc(costLedgerEntries.occurredAt))
        .limit(Math.min(500, Math.max(1, limit))),
  };
}
