// P1 step 2: restore the live backup into the isolated clone, then run the SOURCE
// migrator against it. Acceptance: exactly the 12 tail migrations apply (0136-0147).
// Read-only against live; writes only to the scratch cluster on :54399.
import { runDatabaseRestore } from "../packages/db/src/backup-lib.js";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(
  fileURLToPath(new URL("../packages/db/package.json", import.meta.url)),
);
const postgres = require("postgres");

const CLONE = "postgres://paperclip@127.0.0.1:54399/paperclip";
const BACKUP = `${process.env.USERPROFILE}\\.paperclip\\instances\\default\\data\\backups\\paperclip-20260716-180439.sql.gz`;

console.log("[1/3] restoring backup into clone...");
await runDatabaseRestore({ backupFile: BACKUP, connectionString: CLONE });
console.log("restore complete");

const sql = postgres(CLONE, { max: 1 });
const before = await sql`SELECT count(*)::int AS n FROM drizzle.__drizzle_migrations`;
console.log(`[2/3] clone ledger after restore: ${before[0].n} (expect 135)`);

console.log("[3/3] running SOURCE migrator against the clone...");
const { drizzle } = require("drizzle-orm/postgres-js");
const { migrate } = require("drizzle-orm/postgres-js/migrator");
const migClient = postgres(CLONE, { max: 1 });
const db = drizzle(migClient);
const migrationsFolder = fileURLToPath(new URL("../packages/db/src/migrations", import.meta.url));
await migrate(db, { migrationsFolder, migrationsSchema: "drizzle" });
await migClient.end();

const after = await sql`SELECT count(*)::int AS n FROM drizzle.__drizzle_migrations`;
const applied = after[0].n - before[0].n;
console.log(`ledger after migrate: ${after[0].n} | newly applied: ${applied}`);
console.log(applied === 12 ? "VERDICT: PASS — exactly the 12-tail append. Cutover-safe." : `VERDICT: UNEXPECTED — applied ${applied}, expected 12. Investigate before any cut.`);

// spot-check: new tables from the tail exist
const spot = await sql`SELECT table_name FROM information_schema.tables WHERE table_name IN ('cases','cost_events') ORDER BY table_name`;
console.log("spot-check new tables:", spot.map((r) => r.table_name).join(", ") || "(none found)");
await sql.end();
