// Rename legacy VIT-* issue identifiers to SUM-* for the Summon company.
// Zero number collisions were verified via the API before this run.
// issue_tree_hold_members.issue_identifier is the one denormalized copy.
import { createRequire } from "node:module";

// pnpm keeps the postgres driver under packages/db (its direct dependent),
// so resolve from there, with the repo root as fallback.
const dbPkg = new URL("../../packages/db/package.json", import.meta.url);
const require2 = createRequire(dbPkg);
const postgres = require2("postgres");

const sql = postgres("postgres://paperclip:paperclip@127.0.0.1:54329/paperclip", { max: 1 });
const COMPANY = "4a46da88-eb15-40d5-98a8-10739d4fa310";

try {
  const result = await sql.begin(async (tx) => {
    const before = await tx`
      select count(*)::int as n from issues
      where company_id = ${COMPANY} and identifier like 'VIT-%'`;
    const collisions = await tx`
      select count(*)::int as n from issues a
      join issues b on b.company_id = a.company_id
        and b.identifier = 'SUM-' || substring(a.identifier from 5)
      where a.company_id = ${COMPANY} and a.identifier like 'VIT-%'`;
    if (collisions[0].n > 0) throw new Error(`collision count ${collisions[0].n}, aborting`);
    const updated = await tx`
      update issues
      set identifier = 'SUM-' || substring(identifier from 5)
      where company_id = ${COMPANY} and identifier like 'VIT-%'`;
    const holds = await tx`
      update issue_tree_hold_members
      set issue_identifier = 'SUM-' || substring(issue_identifier from 5)
      where issue_identifier like 'VIT-%'
        and issue_id in (select id from issues where company_id = ${COMPANY})`;
    return { before: before[0].n, updated: updated.count, holds: holds.count };
  });
  console.log("VIT rows before:", result.before, "| issues renamed:", result.updated, "| hold rows renamed:", result.holds);
  const remaining = await sql`
    select count(*)::int as n from issues where company_id = ${COMPANY} and identifier like 'VIT-%'`;
  console.log("VIT remaining:", remaining[0].n);
} finally {
  await sql.end();
}
