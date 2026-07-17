// Codemod: update STALE BRAND ASSERTIONS in ui/src tests after codemod-summon-rename.mjs
// renamed the product copy. Idempotent. Run: node scripts/codemod-summon-rename-tests.mjs [--dry]
//
// WHY THIS IS A SEPARATE SCRIPT WITH A NARROWER RULE:
// The product codemod deliberately skips tests, because rewriting a test alongside the code
// it checks makes it self-fulfilling. But once the product's copy legitimately changes, the
// assertions that encode the OLD copy are genuinely stale and must move with it.
//
// The distinction that matters, and the one this script encodes:
//   * FIXTURE  = a value fed INTO the system (mock data, object literals, fn inputs).
//                NEVER rewritten. Fixtures are arbitrary strings whose RELATIONSHIPS carry
//                meaning: renaming `name: "Paperclip"` orphans its `issuePrefix: "PAP"`, and
//                renaming a mention fixture to "Summon App" makes the sibling "@Pap" query
//                match nothing. A \b-anchored rename silently breaks those invariants — this
//                is not hypothetical, it broke 7 MarkdownEditor + 3 CompanySettings tests.
//   * ASSERTION = a value expected OUT of the system (matcher args, RTL query args) or the
//                behaviour description in it()/describe(). These SHOULD track product copy.
//
// So we rewrite the brand ONLY inside:
//   (a) arguments to assertion matchers + Testing-Library queries (allowlist below)
//   (b) the first argument of it/test/describe (the behaviour description)
// Everything else in a test file — every fixture, every input — is left exactly alone.
//
// Same AST guarantees as the product codemod: the lucide-react `Paperclip` icon and the
// golden-rule identifiers (@paperclipai/*, PAPERCLIP_*, paperclipai, ~/.paperclip) are
// Identifiers/lowercase and are structurally unreachable from these spans.

import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ts = require("typescript");

const ROOT = path.resolve(import.meta.dirname, "..", "ui", "src");
const DRY = process.argv.includes("--dry");
const IS_TEST = /\.(test|spec)\.(ts|tsx)$/;

// Old brand -> new. Ordered: longest/most specific first.
const RULES = [
  [/\bPaperclip\b(?!ai)/g, "Summon"],
  [/\bvitals\.run\b/g, "summon.company"],
];

// Values expected OUT of the system.
const MATCHERS = new Set([
  "toBe", "toEqual", "toStrictEqual", "toContain", "toContainEqual", "toMatch",
  "toThrow", "toThrowError", "toHaveTextContent", "toHaveBeenCalledWith",
  "toHaveAccessibleName", "toHaveAttribute", "toHaveValue",
  "stringContaining", "stringMatching",
]);
const QUERIES = new Set([
  "getByText", "findByText", "queryByText", "getAllByText", "findAllByText", "queryAllByText",
  "getByRole", "findByRole", "queryByRole", "getAllByRole",
  "getByLabelText", "findByLabelText", "queryByLabelText",
  "getByPlaceholderText", "getByTitle", "getByAltText", "getByTestId",
]);
const DOCS = new Set(["it", "test", "describe"]); // first arg only = behaviour description

// THE WORK LIST IS EVIDENCE, NOT A SWEEP.
// Pass the failing test files explicitly. Matcher-scoping alone is NOT sufficient, because an
// assertion's expected value can be DERIVED FROM A FIXTURE in the same expression:
//     expect(findMentionMatch("Ping @Paperclip App", ...)).toEqual({ query: "Paperclip App" })
//                             ^ fixture, never renamed        ^ matcher arg — renaming it here
// would assert "Summon App" against a fixture still producing "Paperclip App", breaking a test
// that currently passes. No static rule distinguishes that from a genuine brand assertion.
// So the only sound work list is the set of tests the product rename ACTUALLY invalidated:
// run the suite, pass the failures here. A test that passes is a test we have no reason to edit.
function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (IS_TEST.test(entry)) out.push(full);
  }
  return out;
}

function targets() {
  const explicit = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  if (explicit.length === 0) {
    console.error("refusing to sweep every test file — pass the failing test files explicitly.");
    console.error("usage: node scripts/codemod-summon-rename-tests.mjs <file...> [--dry]");
    process.exit(2);
  }
  return explicit.map((f) => path.resolve(f));
}

function calleeName(node) {
  const c = node.expression;
  if (ts.isPropertyAccessExpression(c)) return c.name.text; // expect(x).toContain / expect.stringContaining
  if (ts.isIdentifier(c)) return c.text; // it / describe / screen-less queries
  return null;
}

function isLiteral(n) {
  return (
    ts.isStringLiteral(n) ||
    ts.isNoSubstitutionTemplateLiteral(n) ||
    ts.isTemplateHead(n) ||
    ts.isTemplateMiddle(n) ||
    ts.isTemplateTail(n) ||
    ts.isRegularExpressionLiteral(n)
  );
}

function assertionSpans(source) {
  const spans = [];
  const seen = new Set();
  const push = (n) => {
    const key = `${n.getStart(source)}:${n.getEnd()}`;
    if (!seen.has(key)) { seen.add(key); spans.push([n.getStart(source), n.getEnd()]); }
  };
  // Collect literals within a subtree, but never descend into a function body —
  // that would swallow the whole it() callback and every fixture inside it.
  const collect = (n) => {
    if (ts.isArrowFunction(n) || ts.isFunctionExpression(n)) return;
    if (isLiteral(n)) push(n);
    ts.forEachChild(n, collect);
  };

  const visit = (node) => {
    if (ts.isCallExpression(node)) {
      const name = calleeName(node);
      if (name && DOCS.has(name)) {
        if (node.arguments[0]) collect(node.arguments[0]);
      } else if (name && (MATCHERS.has(name) || QUERIES.has(name))) {
        for (const arg of node.arguments) collect(arg);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return spans.sort((a, b) => a[0] - b[0]);
}

let filesChanged = 0, sitesChanged = 0;
const touched = [];

for (const file of targets()) {
  const text = readFileSync(file, "utf8");
  if (!RULES.some(([re]) => { re.lastIndex = 0; return re.test(text); })) continue;

  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const spans = assertionSpans(source);

  let out = text, hits = 0;
  for (let i = spans.length - 1; i >= 0; i--) {
    const [start, end] = spans[i];
    let slice = out.slice(start, end);
    const before = slice;
    for (const [re, to] of RULES) { re.lastIndex = 0; slice = slice.replace(re, to); }
    if (slice === before) continue;
    for (const [re] of RULES) { re.lastIndex = 0; const m = before.match(re); if (m) hits += m.length; }
    out = out.slice(0, start) + slice + out.slice(end);
  }

  if (hits > 0) {
    sitesChanged += hits; filesChanged++;
    touched.push(`${path.relative(ROOT, file)} (${hits})`);
    if (!DRY) writeFileSync(file, out, "utf8");
  }
}

console.log(`${DRY ? "[dry] would change" : "changed"}: ${sitesChanged} assertions across ${filesChanged} test files`);
for (const t of touched) console.log("  " + t);
