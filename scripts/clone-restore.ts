// Sequential dump restorer for the paperclip .sql.gz backup format, handling
// COPY ... FROM stdin blocks via postgres.js writable streams. Clone-only tool.
import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import { createGunzip } from "node:zlib";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(
  fileURLToPath(new URL("../packages/db/package.json", import.meta.url)),
);
const postgres = require("postgres");

const CLONE = "postgres://paperclip@127.0.0.1:54399/paperclip";
const BACKUP = `${process.env.USERPROFILE}\\.paperclip\\instances\\default\\data\\backups\\paperclip-20260716-180439.sql.gz`;

const sql = postgres(CLONE, { max: 1 });

const rl = createInterface({
  input: createReadStream(BACKUP).pipe(createGunzip()),
  crlfDelay: Infinity,
});

let statements = 0;
let copies = 0;
let buffer: string[] = [];
let dollarTag: string | null = null;
let copyStream: import("node:stream").Writable | null = null;

async function finishCopy(stream: import("node:stream").Writable) {
  await new Promise<void>((resolvePromise, rejectPromise) => {
    stream.once("error", rejectPromise);
    stream.once("finish", () => resolvePromise());
    stream.once("close", () => resolvePromise());
    stream.end();
  });
}

function scanDollarQuotes(line: string) {
  // toggle dollar-quote state; tags like $$ or $body$
  const re = /\$[A-Za-z_]*\$/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line))) {
    if (dollarTag === null) dollarTag = m[0];
    else if (m[0] === dollarTag) dollarTag = null;
  }
}

async function flushStatement() {
  const text = buffer.join("\n").trim();
  buffer = [];
  if (!text || text === ";") return;
  await sql.unsafe(text);
  statements++;
}

for await (const line of rl) {
  if (copyStream) {
    if (line === "\\.") {
      await finishCopy(copyStream);
      copyStream = null;
    } else {
      copyStream.write(line + "\n");
    }
    continue;
  }
  const trimmed = line.trim();
  if (dollarTag === null) {
    if (trimmed.startsWith("--") || trimmed === "") continue;
    if (/^COPY .* FROM stdin;$/i.test(trimmed)) {
      if (buffer.length) await flushStatement();
      copyStream = await sql.unsafe(trimmed.slice(0, -1)).writable();
      copies++;
      continue;
    }
  }
  buffer.push(line);
  scanDollarQuotes(line);
  if (dollarTag === null && trimmed.endsWith(";")) await flushStatement();
}
if (buffer.length) await flushStatement();

const check = await sql`SELECT count(*)::int AS n FROM drizzle.__drizzle_migrations`;
console.log(`restore done: ${statements} statements, ${copies} COPY blocks`);
console.log(`clone ledger rows: ${check[0].n} (expect 135)`);
const companies = await sql`SELECT count(*)::int AS n FROM companies`;
console.log(`companies in clone: ${companies[0].n}`);
await sql.end();
