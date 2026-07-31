import { index, jsonb, integer, pgTable, text, timestamp, uuid, uniqueIndex } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { issues } from "./issues.js";

/**
 * One reconciliation of one customer register against one commit.
 *
 * Two jobs: history (what did the register say, what did the code say, when),
 * and idempotency. The unique index on (company, repo, register, head commit)
 * is what stops a redelivered webhook filing the same drift task twice.
 *
 * Customer repos are read-only; nothing here implies write access to them.
 */
export const registerReconciliations = pgTable(
  "register_reconciliations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    /** owner/name of the customer repo. */
    repo: text("repo").notNull(),
    /** Repo-relative path of the register that was reconciled. */
    registerPath: text("register_path").notNull(),
    /** Commit the register itself was last edited at. */
    registerCommit: text("register_commit").notNull(),
    /** Commit reconciled against, always a fresh remote default branch. */
    headCommit: text("head_commit").notNull(),
    headBranch: text("head_branch"),
    /** The staleness number a founder actually reads. */
    commitsSinceRegister: integer("commits_since_register").notNull().default(0),
    findingsTotal: integer("findings_total").notNull().default(0),
    findingsClosed: integer("findings_closed").notNull().default(0),
    findingsPartial: integer("findings_partial").notNull().default(0),
    findingsNeedsHuman: integer("findings_needs_human").notNull().default(0),
    /** Full receipt: per-finding status, probes, counts, closing commits. */
    receipt: jsonb("receipt").$type<Record<string, unknown>>(),
    /** Proposed register edit, unified diff. Never applied automatically. */
    proposedDiff: text("proposed_diff"),
    /** propose_only | write_enabled. Defaults to propose_only, deliberately. */
    mode: text("mode").notNull().default("propose_only"),
    /** pending | completed | failed */
    status: text("status").notNull().default("completed"),
    /** webhook | routine | manual */
    trigger: text("trigger").notNull().default("manual"),
    /** Task filed for the drift, when one was filed. */
    issueId: uuid("issue_id").references(() => issues.id, { onDelete: "set null" }),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyCreatedIdx: index("register_reconciliations_company_created_idx").on(
      table.companyId,
      table.createdAt,
    ),
    repoRegisterIdx: index("register_reconciliations_repo_register_idx").on(
      table.repo,
      table.registerPath,
    ),
    /** Idempotency: one row per register per head commit. */
    uniqueRunIdx: uniqueIndex("register_reconciliations_unique_run_idx").on(
      table.companyId,
      table.repo,
      table.registerPath,
      table.headCommit,
    ),
  }),
);
