import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import postgres from "postgres";
import { parseOutcomeReceipt } from "@paperclipai/shared";
import { inspectMigrations } from "./client.js";
import {
  getEmbeddedPostgresTestSupport,
  startEmbeddedPostgresTestDatabase,
} from "./test-embedded-postgres.js";

/**
 * Real-database proof for SUM-162: the 0149_issue_outcomes migration applies on
 * a fresh install, the honesty-enforcing schema exists, and the canonical §5
 * VIT-62 receipt round-trips through a real Postgres exactly as the server
 * persist path would write it. @see doc/finance/OUTCOME-RECEIPTS.md.
 */

// The worked example from OUTCOME-RECEIPTS.md §5 (VIT-62), verbatim in a
// closing comment body — the same input the server's addComment path parses.
const VIT62_CLOSING_COMMENT = `Closing VIT-62 — the local AI SDR loop shipped.

\`\`\`outcome
{
  "outcome": {
    "timeSavedMinutes": 60,
    "revenueMovedCents": 0,
    "riskAvoided": "un-gated outbound send prevented — every draft held in pending_board_approval; no live sender wired"
  },
  "confidence": "estimated",
  "method": "Time: industry-standard 1:1 SDR research+personalized-draft baseline of ~30 min/prospect × 2 real prospects (summon.company, quantus.com) = 60 min. Revenue: 0 — nothing was sent. Risk: qualitative. Time value ≈ $60 @ $60/h, shown separately."
}
\`\`\`
`;

const cleanups: Array<() => Promise<void>> = [];
const embeddedPostgresSupport = await getEmbeddedPostgresTestSupport();
const describeEmbeddedPostgres = embeddedPostgresSupport.supported ? describe : describe.skip;

async function createTempDatabase(): Promise<string> {
  const db = await startEmbeddedPostgresTestDatabase("paperclip-issue-outcomes-");
  cleanups.push(db.cleanup);
  return db.connectionString;
}

async function seedCompletedIssueWithComment(sql: ReturnType<typeof postgres>) {
  const companyId = randomUUID();
  const agentId = randomUUID();
  const issueId = randomUUID();
  const runId = randomUUID();
  const commentId = randomUUID();

  await sql`
    INSERT INTO "companies" ("id", "name", "issue_prefix")
    VALUES (${companyId}, 'Vitals', 'VIT')
  `;
  await sql`
    INSERT INTO "agents" ("id", "company_id", "name", "role", "adapter_type", "adapter_config")
    VALUES (${agentId}, ${companyId}, 'Vector', 'engineer', 'process', '{}'::jsonb)
  `;
  await sql`
    INSERT INTO "issues" ("id", "company_id", "title", "identifier", "status", "completed_at")
    VALUES (${issueId}, ${companyId}, 'AI SDR loop', 'VIT-62', 'done', now())
  `;
  await sql`
    INSERT INTO "heartbeat_runs" ("id", "company_id", "agent_id", "status")
    VALUES (${runId}, ${companyId}, ${agentId}, 'succeeded')
  `;
  await sql`
    INSERT INTO "issue_comments" ("id", "company_id", "issue_id", "author_agent_id", "created_by_run_id", "body")
    VALUES (${commentId}, ${companyId}, ${issueId}, ${agentId}, ${runId}, ${VIT62_CLOSING_COMMENT})
  `;

  return { companyId, agentId, issueId, runId, commentId };
}

afterEach(async () => {
  while (cleanups.length > 0) {
    const cleanup = cleanups.pop();
    await cleanup?.();
  }
});

if (!embeddedPostgresSupport.supported) {
  console.warn(
    `Skipping embedded Postgres issue_outcomes tests on this host: ${embeddedPostgresSupport.reason ?? "unsupported environment"}`,
  );
}

describeEmbeddedPostgres("issue_outcomes migration + receipt persistence", () => {
  it(
    "fresh install has the issue_outcomes table, confidence check, and unique issue index",
    async () => {
      const connectionString = await createTempDatabase();
      const state = await inspectMigrations(connectionString);
      expect(state.status).toBe("upToDate");
      expect(state.availableMigrations).toContain("0149_issue_outcomes.sql");

      const sql = postgres(connectionString, { max: 1, onnotice: () => {} });
      try {
        const cols = await sql<{ column_name: string; is_nullable: string }[]>`
          SELECT "column_name", "is_nullable"
          FROM "information_schema"."columns"
          WHERE "table_schema" = 'public' AND "table_name" = 'issue_outcomes'
            AND "column_name" IN ('money_saved_cents','time_saved_minutes','revenue_moved_cents','risk_avoided','confidence','method','completed_at')
          ORDER BY "column_name"
        `;
        expect(cols.map((c) => c.column_name)).toEqual([
          "completed_at",
          "confidence",
          "method",
          "money_saved_cents",
          "revenue_moved_cents",
          "risk_avoided",
          "time_saved_minutes",
        ]);
        // confidence + method are mandatory (method mandatory per §1).
        const notNull = Object.fromEntries(cols.map((c) => [c.column_name, c.is_nullable]));
        expect(notNull.confidence).toBe("NO");
        expect(notNull.method).toBe("NO");

        const uniqueIdx = await sql<{ indexname: string }[]>`
          SELECT "indexname" FROM "pg_indexes"
          WHERE "schemaname" = 'public' AND "indexname" = 'issue_outcomes_issue_unique_idx'
        `;
        expect(uniqueIdx).toHaveLength(1);
      } finally {
        await sql.end();
      }
    },
    40_000,
  );

  it(
    "persists the §5 VIT-62 receipt exactly as parsed, and upserts on re-close",
    async () => {
      const connectionString = await createTempDatabase();
      const sql = postgres(connectionString, { max: 1, onnotice: () => {} });
      try {
        const seed = await seedCompletedIssueWithComment(sql);

        // Parse the closing comment through the real shared parser — the same
        // call the server persist path makes.
        const result = parseOutcomeReceipt(VIT62_CLOSING_COMMENT);
        expect(result.present).toBe(true);
        if (!(result.present && result.ok)) throw new Error("expected a valid receipt");
        const r = result.receipt;

        const persist = async () =>
          sql`
            INSERT INTO "issue_outcomes" (
              "company_id","issue_id","comment_id","author_agent_id","created_by_run_id",
              "money_saved_cents","time_saved_minutes","revenue_moved_cents","risk_avoided",
              "confidence","method","raw_json","completed_at"
            ) VALUES (
              ${seed.companyId}, ${seed.issueId}, ${seed.commentId}, ${seed.agentId}, ${seed.runId},
              ${r.moneySavedCents}, ${r.timeSavedMinutes}, ${r.revenueMovedCents}, ${r.riskAvoided},
              ${r.confidence}, ${r.method}, ${JSON.stringify(r.raw)}::jsonb, now()
            )
            ON CONFLICT ("issue_id") DO UPDATE SET
              "money_saved_cents" = EXCLUDED."money_saved_cents",
              "time_saved_minutes" = EXCLUDED."time_saved_minutes",
              "revenue_moved_cents" = EXCLUDED."revenue_moved_cents",
              "risk_avoided" = EXCLUDED."risk_avoided",
              "confidence" = EXCLUDED."confidence",
              "method" = EXCLUDED."method",
              "updated_at" = now()
          `;

        await persist();
        await persist(); // re-close: must upsert, not duplicate.

        const rows = await sql<{
          issue_id: string;
          money_saved_cents: number | null;
          time_saved_minutes: number | null;
          revenue_moved_cents: number | null;
          risk_avoided: string | null;
          confidence: string;
          method: string;
        }[]>`
          SELECT "issue_id","money_saved_cents","time_saved_minutes","revenue_moved_cents","risk_avoided","confidence","method"
          FROM "issue_outcomes" WHERE "issue_id" = ${seed.issueId}
        `;

        // One receipt per completed task.
        expect(rows).toHaveLength(1);
        const row = rows[0];
        expect(row.time_saved_minutes).toBe(60);
        expect(row.money_saved_cents).toBeNull();
        // revenueMovedCents:0 normalized to null — 0 is "not populated".
        expect(row.revenue_moved_cents).toBeNull();
        expect(row.risk_avoided).toContain("un-gated outbound send");
        expect(row.confidence).toBe("estimated");
        expect(row.method.length).toBeGreaterThan(0);
      } finally {
        await sql.end();
      }
    },
    40_000,
  );

  it(
    "rejects an out-of-enum confidence via the CHECK constraint",
    async () => {
      const connectionString = await createTempDatabase();
      const sql = postgres(connectionString, { max: 1, onnotice: () => {} });
      try {
        const seed = await seedCompletedIssueWithComment(sql);
        await expect(
          sql`
            INSERT INTO "issue_outcomes" ("company_id","issue_id","confidence","method")
            VALUES (${seed.companyId}, ${seed.issueId}, 'very-confident', 'bogus')
          `,
        ).rejects.toThrow();
      } finally {
        await sql.end();
      }
    },
    40_000,
  );
});
