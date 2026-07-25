import { pgTable, uuid, text, timestamp, integer, index, uniqueIndex, jsonb } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { issues } from "./issues.js";
import { issueComments } from "./issue_comments.js";
import { agents } from "./agents.js";
import { heartbeatRuns } from "./heartbeat_runs.js";

/**
 * Outcome receipts — one persisted receipt per completed task, parsed from the
 * fenced ```outcome block on the closing comment.
 *
 * @see doc/finance/OUTCOME-RECEIPTS.md (Vitals CFO, SUM-143) §1–2.
 *
 * Kept in a dedicated table (not on issue_comments) so Mission Control's 30-day
 * rollup (SUM-158) is a clean indexed scan over (company_id, completed_at), and
 * so re-closing an issue upserts its single receipt rather than accumulating
 * duplicates. GUARDRAIL: the four levers are stored as separate columns —
 * time-saved dollars are NEVER merged into money_saved_cents.
 */
export const issueOutcomes = pgTable(
  "issue_outcomes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    issueId: uuid("issue_id").notNull().references(() => issues.id),
    // The receipt-bearing comment; kept for provenance/deep-link. Nullable so a
    // receipt survives comment deletion.
    commentId: uuid("comment_id").references(() => issueComments.id, { onDelete: "set null" }),
    authorAgentId: uuid("author_agent_id").references(() => agents.id, { onDelete: "set null" }),
    createdByRunId: uuid("created_by_run_id").references(() => heartbeatRuns.id, { onDelete: "set null" }),
    // The four levers. NULL = "not populated" (n/a); the parser normalizes 0 to
    // NULL so a zeroed lever never inflates a rollup count.
    moneySavedCents: integer("money_saved_cents"),
    timeSavedMinutes: integer("time_saved_minutes"),
    revenueMovedCents: integer("revenue_moved_cents"),
    riskAvoided: text("risk_avoided"),
    // measured | estimated | unmeasurable (OutcomeConfidence).
    confidence: text("confidence").notNull(),
    method: text("method").notNull(),
    // The block exactly as authored (audit trail / forward-compat).
    rawJson: jsonb("raw_json").$type<Record<string, unknown> | null>(),
    // Snapshot of issue.completedAt at persist time — the axis the 30d rollup
    // filters on, so the rollup never has to join back to issues.
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    // One receipt per completed task; re-close upserts on this key.
    issueUniqueIdx: uniqueIndex("issue_outcomes_issue_unique_idx").on(table.issueId),
    companyCompletedAtIdx: index("issue_outcomes_company_completed_at_idx").on(
      table.companyId,
      table.completedAt,
    ),
    companyConfidenceIdx: index("issue_outcomes_company_confidence_idx").on(
      table.companyId,
      table.confidence,
    ),
  }),
);
