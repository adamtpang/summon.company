// Codemod: user-facing "Paperclip" -> "Summon" in ui/src COPY only (VIT-1 / VIT-52).
// Idempotent. Run: node scripts/codemod-summon-rename.mjs [--dry]
//
// USES THE TYPESCRIPT AST — not regex. This is deliberate and was learned the hard way:
//   * A naive /\bPaperclip\b/ replace renamed `import { Paperclip } from "lucide-react"`
//     (the attachment icon 📎) and the build died with TS2305 across 11 files.
//   * A regex that tried to scope itself to "string literals" DESYNCED inside the
//     4k-line IssueChatThread.tsx and corrupted 3 icon identifiers (TS2304).
// Only a real parser knows a string from an identifier, so we ask one.
//
// RENAMES: text inside StringLiteral, template literals, JsxText, and comments.
// STRUCTURALLY CANNOT TOUCH:
//   * `Paperclip` the lucide-react icon (Identifier node — never visited)
//   * `usePaperclipIssueRuntime`, `PaperclipIssueRuntimeReassignment` (Identifiers, and
//     \b would fail anyway)
//   * the golden-rule identifiers `@paperclipai/*`, `paperclipai`, `PAPERCLIP_*`,
//     `~/.paperclip` — case-sensitivity + the (?!ai) guard + \b anchoring exclude them.
//     Renaming those would break every import, the running server, and upstream merges.
// Import specifiers ARE StringLiterals ("lucide-react", "../hooks/usePaperclipIssueRuntime")
// but none contain the standalone word `Paperclip`, so scoping to strings is safe there.

import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ts = require("typescript");

const ROOT = path.resolve(import.meta.dirname, "..", "ui", "src");
const DRY = process.argv.includes("--dry");
const WORD = /\bPaperclip\b(?!ai)/g;

// Tests are NOT copy — never rewrite them. Two reasons, both learned from a real break:
//   1. A test that a codemod rewrites alongside the product is self-fulfilling: it can no
//      longer fail, so it stops being evidence. Brand assertions get updated BY HAND so each
//      one is a reviewed decision.
//   2. Test fixtures are arbitrary strings whose RELATIONSHIPS carry meaning. Renaming
//      `name: "Paperclip"` beside `issuePrefix: "PAP"` orphans the prefix; renaming a
//      mention fixture to "Summon App" makes the "@Pap" query in the same test match
//      nothing. \b-anchored renames silently break substring/offset invariants.
const IS_TEST = /\.(test|spec)\.(ts|tsx)$|[\\/]__tests__[\\/]|[\\/]test-utils[\\/]|\.stories\.tsx$/;

// NOT COPY — these strings are DATA. They look like prose but are compared for equality
// against rows the server already wrote, so renaming them is a silent data-corruption bug,
// not a rebrand. Covered by the golden rule ("preserve database, API, and protocol names").
//
// successful-run-handoff.ts: SUCCESSFUL_RUN_HANDOFF_*_NOTICE_BODY are matched with `===` in
//   ui/src/lib/successful-run-handoff.ts:62 AND interpolated into a live SQL WHERE clause in
//   server/src/services/heartbeat.ts:7487 (`issueComments.body = ${...}`). The server's own
//   copy (server/src/services/recovery/successful-run-handoff.ts) must stay byte-identical.
//   Renaming the UI side alone => UI stops recognising server comments. Renaming BOTH sides
//   => every EXISTING comment row still says "Paperclip …" and silently stops matching, so
//   blocked issues are never detected as needing disposition. Changing it at all requires a
//   data migration + a matcher that accepts both spellings. Tracked separately; not a rename.
// systemNoticeFixtures.ts: mirrors those sentinels verbatim; must not drift from them.
const SENTINEL_FILES = [
  path.join("lib", "successful-run-handoff.ts"),
  path.join("fixtures", "systemNoticeFixtures.ts"),
];
const isSentinel = (full) => SENTINEL_FILES.some((s) => full.endsWith(s));

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.(ts|tsx)$/.test(entry) && !IS_TEST.test(full) && !isSentinel(full)) out.push(full);
  }
  return out;
}

/** Collect [start,end) spans of every node/comment whose text is human copy. */
function copySpans(source, text) {
  const spans = [];
  const seen = new Set();
  const push = (start, end) => {
    const key = `${start}:${end}`;
    if (!seen.has(key)) { seen.add(key); spans.push([start, end]); }
  };

  const visit = (node) => {
    if (
      ts.isStringLiteral(node) ||
      ts.isNoSubstitutionTemplateLiteral(node) ||
      ts.isTemplateHead(node) ||
      ts.isTemplateMiddle(node) ||
      ts.isTemplateTail(node) ||
      ts.isJsxText(node)
    ) {
      push(node.getStart(source), node.getEnd());
    }
    ts.forEachChild(node, visit);
  };
  visit(source);

  // Comments are trivia — walk them separately.
  const scanner = ts.createScanner(ts.ScriptTarget.Latest, false, ts.LanguageVariant.JSX, text);
  scanner.setText(text);
  let token = scanner.scan();
  while (token !== ts.SyntaxKind.EndOfFileToken) {
    if (token === ts.SyntaxKind.SingleLineCommentTrivia || token === ts.SyntaxKind.MultiLineCommentTrivia) {
      push(scanner.getTokenStart(), scanner.getTokenEnd());
    }
    token = scanner.scan();
  }
  const leading = /\/\/[^\n]*|\/\*[\s\S]*?\*\//g;
  let m;
  while ((m = leading.exec(text))) push(m.index, m.index + m[0].length);

  return spans.sort((a, b) => a[0] - b[0]);
}

let filesChanged = 0;
let sitesChanged = 0;
const touched = [];

for (const file of walk(ROOT)) {
  const text = readFileSync(file, "utf8");
  WORD.lastIndex = 0;
  if (!WORD.test(text)) continue;

  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const spans = copySpans(source, text);

  // Rewrite right-to-left so earlier offsets stay valid.
  let out = text;
  let hits = 0;
  for (let i = spans.length - 1; i >= 0; i--) {
    const [start, end] = spans[i];
    const slice = out.slice(start, end);
    WORD.lastIndex = 0;
    if (!WORD.test(slice)) continue;
    WORD.lastIndex = 0;
    const replaced = slice.replace(WORD, () => { hits++; return "Summon"; });
    out = out.slice(0, start) + replaced + out.slice(end);
  }

  if (hits > 0) {
    sitesChanged += hits;
    filesChanged++;
    touched.push(`${path.relative(ROOT, file)} (${hits})`);
    if (!DRY) writeFileSync(file, out, "utf8");
  }
}

console.log(`${DRY ? "[dry] would change" : "changed"}: ${sitesChanged} copy sites across ${filesChanged} files`);
for (const t of touched.slice(0, 12)) console.log("  " + t);
if (touched.length > 12) console.log(`  …and ${touched.length - 12} more`);
