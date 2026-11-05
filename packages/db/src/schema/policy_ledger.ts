import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { agents } from "./agents.js";
import { issues } from "./issues.js";
import { heartbeatRuns } from "./heartbeat_runs.js";
import { costEvents } from "./cost_events.js";

/**
 * Per-employee policy / credential / cost-ledger (VIT-46).
 *
 * @see doc/finance/POLICY-LEDGER.md
 * @see doc/research/OPENCLAW-LEARNINGS.md §2.4 (clawrouter pattern)
 *
 * A clean-room reimplementation of clawrouter's accounting shape so per-employee
 * COGS is enforced MECHANICALLY at the gateway, not hoped-for in a prompt. Four
 * tables, in order:
 *   1. adapter_manifests    — providers/adapters declared as DATA (not code), so
 *                             a new vendor is a manifest row + its adapter module.
 *   2. employee_policies    — the allowed adapters/models + monthly budget +
 *                             capability scopes an employee's credential is bound to.
 *   3. employee_credentials — one Summon-issued, policy-bound credential per
 *                             employee (never a raw provider key); `generation`
 *                             drives instant revocation.
 *   4. cost_ledger_entries  — the append-only reservation → settlement → refund
 *                             ledger, in normalized units today / microdollars
 *                             when API adapters land.
 *
 * Additive to the existing cost/finance/budget domain: {@link costEvents} stays
 * the raw COGS record and each settled ledger entry can point back to one.
 */

/**
 * A provider/adapter declared as data. Adding a new adapter is a row here plus
 * its adapter module — the policy engine never changes (VIT-46 AC5). Global
 * catalog (not company-scoped): an adapter is a platform capability.
 */
export const adapterManifests = pgTable(
  "adapter_manifests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Stable adapter key, e.g. "claude_local", "codex_local", "gemini_api".
    key: text("key").notNull(),
    displayName: text("display_name").notNull(),
    // subscription (normalized-unit metering today) | api (microdollars).
    billingModel: text("billing_model").notNull().default("subscription"),
    // normalized_units | microdollars — the unit every route price is in.
    unit: text("unit").notNull().default("normalized_units"),
    // Priced routes: [{ model, reserveUnits }]. A model absent here / with a
    // non-positive price is UNPRICED and fails closed at authorize time.
    routesJson: jsonb("routes_json")
      .$type<Array<{ model: string; reserveUnits: number }>>()
      .notNull()
      .default([]),
    // Capability tokens this adapter can satisfy, e.g. ["code","chat"].
    capabilitiesJson: jsonb("capabilities_json").$type<string[]>().notNull().default([]),
    isActive: boolean("is_active").notNull().default(true),
    metadataJson: jsonb("metadata_json").$type<Record<string, unknown> | null>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    keyUniqueIdx: uniqueIndex("adapter_manifests_key_unique_idx").on(table.key),
    activeIdx: index("adapter_manifests_active_idx").on(table.isActive),
  }),
);

/**
 * The policy an employee's credential is bound to: which adapters/models it may
 * call, its hard monthly budget, and its capability scopes. One active policy
 * per (company, agent); superseded policies are retained inactive for audit.
 */
export const employeePolicies = pgTable(
  "employee_policies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    agentId: uuid("agent_id").notNull().references(() => agents.id),
    name: text("name").notNull(),
    // Allowed adapters/models: [{ adapterKey, models: "*" | string[] }].
    allowedAdaptersJson: jsonb("allowed_adapters_json")
      .$type<Array<{ adapterKey: string; models: string[] | "*" }>>()
      .notNull()
      .default([]),
    // Hard monthly spend ceiling in `unit`. NULL = uncapped (metered, not blocked).
    monthlyBudgetUnits: integer("monthly_budget_units"),
    unit: text("unit").notNull().default("normalized_units"),
    // Capability scopes the employee may invoke, e.g. ["code","chat"].
    capabilityScopesJson: jsonb("capability_scopes_json").$type<string[]>().notNull().default([]),
    isActive: boolean("is_active").notNull().default(true),
    metadataJson: jsonb("metadata_json").$type<Record<string, unknown> | null>(),
    createdByUserId: text("created_by_user_id"),
    updatedByUserId: text("updated_by_user_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyAgentIdx: index("employee_policies_company_agent_idx").on(
      table.companyId,
      table.agentId,
    ),
    // One active policy per employee; enforced in the service layer.
    companyAgentActiveUniqueIdx: uniqueIndex("employee_policies_company_agent_active_unique_idx").on(
      table.companyId,
      table.agentId,
    ),
  }),
);

/**
 * One Summon-issued credential per employee, bound to a policy. Stores only a
 * HASH of the secret plus a display prefix — never a raw provider key or an
 * unmediated subscription session. `generation` is bumped on rotation/revoke;
 * a call must present the live generation, so revocation blocks the very next
 * adapter call regardless of caching (VIT-46 AC3).
 */
export const employeeCredentials = pgTable(
  "employee_credentials",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    agentId: uuid("agent_id").notNull().references(() => agents.id),
    policyId: uuid("policy_id").notNull().references(() => employeePolicies.id),
    // Hash of the issued secret; the plaintext is returned once at issue time.
    credentialHash: text("credential_hash").notNull(),
    // Short non-secret prefix for display/lookup, e.g. "empc_a1b2".
    prefix: text("prefix").notNull(),
    // Monotonic generation; the presented generation must match to authorize.
    generation: integer("generation").notNull().default(1),
    // active | revoked
    status: text("status").notNull().default("active"),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    revokedReason: text("revoked_reason"),
    metadataJson: jsonb("metadata_json").$type<Record<string, unknown> | null>(),
    createdByUserId: text("created_by_user_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    hashIdx: index("employee_credentials_hash_idx").on(table.credentialHash),
    companyAgentIdx: index("employee_credentials_company_agent_idx").on(
      table.companyId,
      table.agentId,
    ),
    prefixIdx: index("employee_credentials_prefix_idx").on(table.prefix),
  }),
);

/**
 * Append-only cost ledger: the reservation → settlement → refund movements that
 * enforce per-employee COGS. Per-employee spend = Σ settlements; open budget =
 * Σ reservations − Σ settlements − Σ refunds. Each settled entry can point to a
 * {@link costEvents} row so the ledger reconciles with the metered event log
 * (VIT-46 AC4).
 */
export const costLedgerEntries = pgTable(
  "cost_ledger_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    agentId: uuid("agent_id").notNull().references(() => agents.id),
    credentialId: uuid("credential_id").references(() => employeeCredentials.id),
    policyId: uuid("policy_id").references(() => employeePolicies.id),
    // The run this movement belongs to (PAPERCLIP_RUN_ID); drives cost_limit.
    runId: text("run_id"),
    issueId: uuid("issue_id").references(() => issues.id),
    heartbeatRunId: uuid("heartbeat_run_id").references(() => heartbeatRuns.id),
    // Groups a settlement/refund back to the reservation entry they close.
    reservationId: uuid("reservation_id"),
    adapterKey: text("adapter_key").notNull(),
    model: text("model").notNull(),
    // reservation | settlement | refund
    kind: text("kind").notNull(),
    unit: text("unit").notNull().default("normalized_units"),
    // Amount of this movement, in `unit`. Always non-negative.
    units: integer("units").notNull(),
    // open | settled | refunded | void — the state of the reservation this row
    // heads (reservation rows only; settlement/refund rows are terminal).
    status: text("status").notNull().default("open"),
    // Provenance to the raw metered COGS event, when one exists (settlements).
    costEventId: uuid("cost_event_id").references(() => costEvents.id),
    description: text("description"),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyAgentOccurredIdx: index("cost_ledger_entries_company_agent_occurred_idx").on(
      table.companyId,
      table.agentId,
      table.occurredAt,
    ),
    agentKindIdx: index("cost_ledger_entries_agent_kind_idx").on(table.agentId, table.kind),
    runIdx: index("cost_ledger_entries_run_idx").on(table.runId),
    reservationIdx: index("cost_ledger_entries_reservation_idx").on(table.reservationId),
    credentialIdx: index("cost_ledger_entries_credential_idx").on(table.credentialId),
    costEventIdx: index("cost_ledger_entries_cost_event_idx").on(table.costEventId),
  }),
);
