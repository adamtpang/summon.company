/**
 * Guard: every .references() call in a schema file must include an explicit
 * { onDelete: ... } option.  A bare .references() defaults to RESTRICT in
 * PostgreSQL and will silently rot company (and other cascade) deletions as new
 * tables ship.  This test fails CI before the bug reaches production.
 *
 * To fix a failure: add { onDelete: "cascade" } for owned children or
 * { onDelete: "set null" } for soft references.  See migration 0205 for
 * the rationale behind each choice.
 */
import { readFileSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCHEMA_DIR = join(__dirname, "schema");

function findBareReferences(source: string, filename: string) {
  const violations: string[] = [];
  const lines = source.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Match a .references( call that is NOT immediately followed by , { onDelete
    // We check the span of the call across up to 4 lines to handle multi-line calls.
    if (!line.includes(".references(")) continue;

    // Collect up to 4 lines starting here to handle wrapped calls.
    const span = lines.slice(i, i + 4).join(" ");

    // Strip AnyPgColumn type hints from (): AnyPgColumn => ...
    // A bare call looks like: .references(() => foo.id) or .references((): AnyPgColumn => foo.id)
    // A good call looks like: .references(() => foo.id, { onDelete: "cascade" })
    const match = span.match(/\.references\([^)]*\)/);
    if (!match) continue;

    const call = match[0];
    // If the call closes with just the fn arg (no second arg), it's bare.
    if (!call.includes("onDelete")) {
      // Allow only if a following , { onDelete appears right after the closing paren of the fn arg.
      // We re-check the wider span up to 8 lines for edge cases.
      const wider = lines.slice(i, i + 8).join(" ");
      const idx = wider.indexOf(".references(");
      const after = wider.slice(idx);
      if (!after.includes("onDelete")) {
        violations.push(`${filename}:${i + 1}  ${line.trim()}`);
      }
    }
  }
  return violations;
}

describe("schema FK guard", () => {
  it("every .references() call has an explicit onDelete option", () => {
    const schemaFiles = readdirSync(SCHEMA_DIR).filter(
      (f) => f.endsWith(".ts") && f !== "index.ts",
    );

    const allViolations: string[] = [];

    for (const file of schemaFiles) {
      const source = readFileSync(join(SCHEMA_DIR, file), "utf-8");
      const violations = findBareReferences(source, file);
      allViolations.push(...violations);
    }

    if (allViolations.length > 0) {
      const msg = [
        `${allViolations.length} FK(s) missing onDelete — add { onDelete: "cascade" } or { onDelete: "set null" }:`,
        ...allViolations,
      ].join("\n  ");
      expect.fail(msg);
    }
  });
});
