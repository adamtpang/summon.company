// P1 step 2 (final): run the SOURCE migrator against the restored clone.
// Acceptance: exactly 12 new ledger rows (0136-0147), zero errors.
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(
  fileURLToPath(new URL("../packages/db/package.json", import.meta.url)),
);
const postgres = require("postgres");
const { drizzle } = require("drizzle-orm/postgres-js");
const { migrate } = require("drizzle-orm/postgres-js/migrator");

const CLONE = "postgres://paperclip@127.0.0.1:54399/paperclip";

const check = postgres(CLONE, { max: 1 });
const before = await check`SELECT count(*)::int AS n FROM drizzle.__drizzle_migrations`;
console.log("ledger before:", before[0].n);

const migClient = postgres(CLONE, { max: 1 });
const db = drizzle(migClient);
const migrationsFolder = fileURLToPath(new URL("../packages/db/src/migrations", import.meta.url));
await migrate(db, { migrationsFolder, migrationsSchema: "drizzle" });
await migClient.end();

const after = await check`SELECT count(*)::int AS n FROM drizzle.__drizzle_migrations`;
const applied = after[0].n - before[0].n;
console.log(`ledger after: ${after[0].n} | newly applied: ${applied}`);
console.log(
  applied === 12
    ? "VERDICT: PASS — exactly the 12-tail append. Cutover-safe."
    : `VERDICT: UNEXPECTED — applied ${applied}, expected 12.`,
);
const spot = await check`SELECT table_name FROM information_schema.tables WHERE table_name IN ('cases','cost_events') ORDER BY table_name`;
console.log("spot-check new tables:", spot.map((r: { table_name: string }) => r.table_name).join(", ") || "(none)");
await check.end();
