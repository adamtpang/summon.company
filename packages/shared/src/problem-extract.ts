/**
 * Problem extractor — the heart of the org-ingestion core loop.
 * @see doc/ORG-INGESTION-PLAN.md steps 3–4.
 *
 * The board's prompt: point Summon at a company's repos and surface the problems
 * the company ALREADY documented — never invent one. This module parses file
 * text (docs-first) for named problem signals (P0/P1/P2, Sev1, critical,
 * blocker, gap, audit, finding, remediation, known issue, tech debt, TODO/FIXME,
 * …) and returns ranked {@link ExtractedProblem}s. Every entry cites a real file
 * and line and quotes the evidence verbatim; an empty scan says so out loud.
 *
 * DOCTRINE (kept verbatim in spirit from the ticket):
 *   1. Never invent a finding. A problem exists only where the source text names
 *      it. `title`, `evidenceQuote`, `estimatedEffort`, and `businessImpact` are
 *      all DERIVED from cited text — when the source is silent we say "not stated
 *      in source", never a guessed number.
 *   2. Every entry cites `sourceFile` + `line` (1-based) and carries the exact
 *      `evidenceQuote` it was drawn from, so a human can verify in one click.
 *   3. Guardrails are behavior, not options: {@link extractProblemsFromFiles}
 *      refuses env files and PII-looking files by default and reports each
 *      refusal. Callers respect `.gitignore` via {@link compileGitignore} +
 *      {@link filterIgnored} before handing files in.
 *
 * Everything here is pure (no I/O): callers read files, then pass
 * {@link SourceFile}s in. That keeps the heart fixture-testable and lets the
 * ingest layer own disk access, token scopes, and clone paths.
 *
 * Findings land on the board as issues and rank through the existing scoreboard
 * (ui/src/lib/scoreboard.ts). {@link problemTier} mirrors that S–F ladder so a
 * ranked list reads the same before the issues are even created.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/** A file handed to the extractor. `path` is repo-relative, forward-slashed. */
export interface SourceFile {
  path: string;
  content: string;
}

/** Severity a documented signal implies. Maps 1:1 onto board priority. */
export type ProblemSeverity = "critical" | "high" | "medium" | "low";

/** Effort estimate — ONLY ever inferred from words in the source, else unknown. */
export type ProblemEffort = "small" | "medium" | "large" | "unknown";

/**
 * Tier ladder, mirroring ui `ScoreboardTier` (VIT-113 lineage): S = drop
 * everything, F = shouldn't be on the board. Redeclared here (not imported)
 * because shared must not depend on ui; {@link problemTier} keeps them aligned.
 */
export type ProblemTier = "S" | "A" | "B" | "C" | "D" | "F";

/** One documented problem, fully traceable to its source. */
export interface ExtractedProblem {
  /** Concise human title, cleaned from the real evidence line — never invented. */
  title: string;
  severity: ProblemSeverity;
  /** Repo-relative source path. */
  sourceFile: string;
  /** 1-based line number of the evidence. */
  line: number;
  /** The verbatim source line the signal was found on (trimmed, length-capped). */
  evidenceQuote: string;
  /** Which documented signal fired (e.g. "P0", "TODO", "audit finding"). */
  matchedSignal: string;
  /** Effort inferred from source wording; "unknown" when the source is silent. */
  estimatedEffort: ProblemEffort;
  /** Plain-English impact drawn from evidence keywords, or an honest fallback. */
  businessImpact: string;
  /** 0..1 — how unambiguous the signal is (structured markers score higher). */
  confidence: number;
  /** S–F rank, consistent with the board scoreboard. */
  tier: ProblemTier;
}

/** A file the guardrails refused to scan, with the reason. */
export interface RefusedFile {
  path: string;
  reason: string;
}

/** Result of scanning a set of files: ranked problems + guardrail accounting. */
export interface ExtractionResult {
  /** Ranked highest-first. Empty array when nothing documented was found. */
  problems: ExtractedProblem[];
  filesScanned: number;
  /** Files skipped by guardrails (env / PII / secret material). */
  filesRefused: RefusedFile[];
  /** True when zero problems were found — the caller must surface this honestly. */
  empty: boolean;
  /** One-line human summary, including the explicit empty statement. */
  note: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Signal taxonomy
// ─────────────────────────────────────────────────────────────────────────────

interface SignalDef {
  /** Display label recorded on the finding. */
  label: string;
  /** Per-line matcher. Must be anchored/word-bounded to avoid noise. */
  test: RegExp;
  severity: ProblemSeverity;
  /** Base confidence 0..1: structured markers high, generic prose words low. */
  confidence: number;
}

/**
 * Ordered strongest→weakest. Each line yields at most ONE finding — the first
 * (highest-priority) signal that matches wins — so a line tagged "P0 blocker"
 * isn't double-counted. Precise anchoring matters more than breadth: a false
 * finding violates "never invent" just as badly as a missed real one.
 */
const SIGNALS: SignalDef[] = [
  // Structured severity markers — highest confidence, unambiguous.
  { label: "P0", test: /(?<![A-Za-z0-9])P0(?![A-Za-z0-9])/, severity: "critical", confidence: 0.9 },
  // "sev1"/"severity 1"/"sev-1" only — NOT bare "s1", which collides with
  // mermaid node ids and spec section refs like "S1.2.1".
  { label: "Sev1", test: /(?<![A-Za-z0-9])sev(?:erity)?[-\s]?1(?![A-Za-z0-9.])/i, severity: "critical", confidence: 0.9 },
  { label: "CVE", test: /(?<![A-Za-z0-9])CVE-\d{4}-\d{4,}/, severity: "high", confidence: 0.9 },
  { label: "P1", test: /(?<![A-Za-z0-9])P1(?![A-Za-z0-9])/, severity: "high", confidence: 0.85 },
  { label: "Sev2", test: /(?<![A-Za-z0-9])sev(?:erity)?[-\s]?2(?![A-Za-z0-9.])/i, severity: "high", confidence: 0.8 },
  { label: "P2", test: /(?<![A-Za-z0-9])P2(?![A-Za-z0-9])/, severity: "medium", confidence: 0.8 },

  // Named documented-problem phrases.
  { label: "data loss", test: /\bdata[-\s]?loss\b|\bdata corruption\b/i, severity: "critical", confidence: 0.65 },
  { label: "not production ready", test: /\bnot production[-\s]?ready\b|\bnot ready for production\b/i, severity: "high", confidence: 0.75 },
  { label: "vulnerability", test: /\bvulnerabilit(?:y|ies)\b|\bexploit(?:able)?\b/i, severity: "high", confidence: 0.7 },
  { label: "security issue", test: /\bsecurity (?:issue|risk|hole|flaw|concern)\b/i, severity: "high", confidence: 0.7 },
  { label: "blocker", test: /\bblock(?:er|ing|ed)\b/i, severity: "high", confidence: 0.6 },
  { label: "FIXME", test: /\bFIXME\b/, severity: "medium", confidence: 0.75 },
  { label: "known issue", test: /\bknown[-\s]issues?\b/i, severity: "medium", confidence: 0.7 },
  { label: "regression", test: /\bregression\b/i, severity: "medium", confidence: 0.55 },
  { label: "tech debt", test: /\btech(?:nical)?[-\s]debt\b/i, severity: "medium", confidence: 0.65 },
  { label: "audit finding", test: /\baudit (?:finding|item|note)\b|\bfinding\s*#?\d/i, severity: "medium", confidence: 0.6 },
  { label: "remediation", test: /\bremediat(?:e|ion|ing)\b/i, severity: "medium", confidence: 0.6 },
  { label: "TODO", test: /\bTODO\b/, severity: "low", confidence: 0.7 },
  { label: "HACK", test: /\b(?:HACK|XXX)\b/, severity: "low", confidence: 0.55 },
  { label: "deprecated", test: /\bdeprecat(?:ed|ion)\b/i, severity: "low", confidence: 0.45 },

  // Generic single words — LOW confidence: real signal in prose but easily noisy,
  // so they surface for a human but never dominate the top of the ranking.
  { label: "critical", test: /\bcritical\b/i, severity: "high", confidence: 0.4 },
  { label: "finding", test: /\bfindings?\b/i, severity: "medium", confidence: 0.35 },
  { label: "gap", test: /\bgaps?\b/i, severity: "medium", confidence: 0.35 },
];

// ─────────────────────────────────────────────────────────────────────────────
// Guardrails (pure predicates — enforced by extractProblemsFromFiles)
// ─────────────────────────────────────────────────────────────────────────────

/** True for `.env`, `.env.local`, `foo/.env.production`, etc. Never scan these. */
export function isEnvFile(path: string): boolean {
  const base = basename(path);
  return /^\.env(\.[^/]*)?$/.test(base) || /(^|\/)\.env(\.[^/]*)?$/.test(path);
}

/**
 * True when a PATH denotes secret/key material or a likely PII data dump. Kept
 * conservative and file-level: a repo merely NAMED `pii-service` is fine to read
 * (its README is not PII); a `patients.csv` or `id_rsa` is not.
 */
export function looksLikePiiPath(path: string): boolean {
  const base = basename(path).toLowerCase();
  // Secret / key material.
  if (/\.(pem|key|p12|pfx|keystore|jks|ppk)$/.test(base)) return true;
  if (/(^|[._-])(id_rsa|id_dsa|id_ecdsa|id_ed25519)([._-]|$)/.test(base)) return true;
  if (/(^|[._-])(secret|secrets|credential|credentials|password|passwd)([._-]|$)/.test(base)) return true;
  // Tabular data files that commonly carry PII (schemas end in .sql and stay).
  if (/\.(csv|tsv|xlsx?|db|sqlite3?|mdb|parquet)$/.test(base)) return true;
  return false;
}

/** Regexes for raw PII / secret material embedded in file CONTENT. */
const PII_CONTENT_PATTERNS: RegExp[] = [
  /-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----/, // private keys
  /\bAKIA[0-9A-Z]{16}\b/,                                        // AWS access key id
  /\b\d{3}-\d{2}-\d{4}\b/,                                       // US SSN
  /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14})\b/,            // Visa/Mastercard PAN
];

/** True when file content contains raw secrets or PII patterns. */
export function looksLikePiiContent(content: string): boolean {
  return PII_CONTENT_PATTERNS.some((re) => re.test(content));
}

/** Guardrail verdict for a single file. */
export function refuseReason(file: SourceFile): string | null {
  if (isEnvFile(file.path)) return "env file (never read)";
  if (looksLikePiiPath(file.path)) return "path looks like secret/PII material";
  if (looksLikePiiContent(file.content)) return "content contains secret/PII patterns";
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// .gitignore matcher (pure — respect the repo's ignore rules before ingest)
// ─────────────────────────────────────────────────────────────────────────────

interface IgnoreRule {
  re: RegExp;
  negated: boolean;
  dirOnly: boolean;
}

/** A compiled `.gitignore`; feed paths to {@link isIgnored}. */
export interface GitignoreMatcher {
  rules: IgnoreRule[];
}

/**
 * Compile `.gitignore` text into a matcher. Supports the common subset: blank/
 * comment lines, `!` negation, trailing `/` (dir-only), leading `/` (root-
 * anchored), `*` (within a segment), `**` (across segments), and basename
 * matching for slash-less patterns. Last matching rule wins, per git.
 */
export function compileGitignore(text: string): GitignoreMatcher {
  const rules: IgnoreRule[] = [];
  for (const raw of text.split(/\r?\n/)) {
    let line = raw.replace(/\s+$/, "");
    if (line === "" || line.startsWith("#")) continue;
    let negated = false;
    if (line.startsWith("!")) {
      negated = true;
      line = line.slice(1);
    }
    let dirOnly = false;
    if (line.endsWith("/")) {
      dirOnly = true;
      line = line.slice(0, -1);
    }
    const anchored = line.startsWith("/");
    if (anchored) line = line.slice(1);
    rules.push({ re: gitignoreToRegExp(line, anchored), negated, dirOnly });
  }
  return { rules };
}

function gitignoreToRegExp(pattern: string, anchored: boolean): RegExp {
  let re = "";
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i];
    if (c === "*") {
      if (pattern[i + 1] === "*") {
        re += ".*"; // ** — spans path separators
        i++;
        if (pattern[i + 1] === "/") i++; // consume trailing slash of **/
      } else {
        re += "[^/]*"; // * — within a single segment
      }
    } else if (c === "?") {
      re += "[^/]";
    } else {
      re += c.replace(/[.+^${}()|[\]\\]/g, "\\$&");
    }
  }
  // Anchored patterns and patterns containing a slash match from the path root;
  // a slash-less pattern matches the basename at any depth.
  const hasSlash = pattern.includes("/");
  const prefix = anchored || hasSlash ? "^" : "(?:^|/)";
  // Allow the pattern to match a file OR a directory prefix (so `build` ignores
  // `build/x.js`); the trailing group covers "this path or anything beneath it".
  return new RegExp(prefix + re + "(?:/|$)");
}

/** True when `path` is ignored by the compiled `.gitignore`. */
export function isIgnored(matcher: GitignoreMatcher, path: string): boolean {
  let ignored = false;
  for (const rule of matcher.rules) {
    // dirOnly rules only match if the path is (under) that directory; our regex
    // already ends in `(?:/|$)`, so a dirOnly rule simply never matches a plain
    // file basename with no trailing segment — accept the match either way since
    // callers pass file paths and we want `node_modules/` to hide its contents.
    if (rule.re.test(path)) ignored = !rule.negated;
  }
  return ignored;
}

/** Drop ignored files. Pure convenience wrapper over {@link isIgnored}. */
export function filterIgnored(files: SourceFile[], matcher: GitignoreMatcher): SourceFile[] {
  return files.filter((f) => !isIgnored(matcher, f.path));
}

/**
 * True when `path` is a non-English TRANSLATION MIRROR of source docs — those
 * directories duplicate every documented problem in another language and would
 * double-count findings (the Regain corpus mirrors its registers under
 * `_translations/ru/…`). Matched:
 *   - any `_translations/` segment (the corpus convention), and
 *   - a locale-scoped mirror dir (`i18n/ru/…`, `locales/de/…`, `lang/fr/…`),
 *     excluding the English/default source so we keep the canonical copy.
 * Callers drop these BEFORE handing files in, exactly like `.gitignore`.
 */
export function isTranslationMirror(path: string): boolean {
  if (/(^|\/)_translations(\/|$)/i.test(path)) return true;
  const m = path.match(/(^|\/)(?:i18n|locales?|translations?|lang)\/([a-z]{2})(?:[-_][a-z]{2,4})?(\/|$)/i);
  return !!m && m[2].toLowerCase() !== "en";
}

/** Drop translation-mirror files. Pure convenience wrapper over {@link isTranslationMirror}. */
export function filterTranslationMirrors(files: SourceFile[]): SourceFile[] {
  return files.filter((f) => !isTranslationMirror(f.path));
}

// ─────────────────────────────────────────────────────────────────────────────
// Docs-first ordering
// ─────────────────────────────────────────────────────────────────────────────

/** True for prose/doc files (README, *.md/*.mdx/*.rst/*.txt, docs/**, ADRs). */
export function isDocFile(path: string): boolean {
  const base = basename(path).toLowerCase();
  if (/\.(md|mdx|markdown|rst|txt|adoc)$/.test(base)) return true;
  if (/^readme(\.|$)/.test(base) || /^changelog(\.|$)/.test(base)) return true;
  if (/(^|\/)docs?\//i.test(path)) return true;
  if (/(^|\/)adrs?\//i.test(path)) return true;
  return false;
}

/** Stable sort putting docs before code — the ticket's "parse docs-first". */
export function docFirstSort(files: SourceFile[]): SourceFile[] {
  return files
    .map((f, i) => ({ f, i, doc: isDocFile(f.path) }))
    .sort((a, b) => (a.doc === b.doc ? a.i - b.i : a.doc ? -1 : 1))
    .map((x) => x.f);
}

// ─────────────────────────────────────────────────────────────────────────────
// Effort + business-impact inference (derived from source only)
// ─────────────────────────────────────────────────────────────────────────────

/** Infer effort from wording in the evidence; "unknown" when the source is silent. */
export function inferEffort(context: string): ProblemEffort {
  if (/\b(rewrite|re-?architect|overhaul|major refactor|large refactor|redesign|migration)\b/i.test(context)) return "large";
  if (/\b(quick|trivial|one[-\s]?line|small fix|minor|typo)\b/i.test(context)) return "small";
  if (/\b(refactor|rework|revisit)\b/i.test(context)) return "medium";
  return "unknown";
}

const IMPACT_RULES: { test: RegExp; impact: string }[] = [
  { test: /\b(pii|phi|patient|personal data|ssn)\b/i, impact: "sensitive-data exposure" },
  { test: /\b(security|vulnerab|exploit|cve-|auth(?:entication|orization)?)\b/i, impact: "security exposure" },
  { test: /\bdata[-\s]?loss\b|\bcorrupt/i, impact: "data-loss risk" },
  { test: /\b(outage|downtime|crash|hang|deadlock|production down)\b/i, impact: "availability/outage risk" },
  { test: /\b(revenue|billing|payment|charge|invoice|refund)\b/i, impact: "revenue/billing risk" },
  { test: /\b(compliance|legal|gdpr|hipaa|audit)\b/i, impact: "compliance risk" },
  { test: /\b(slow|latency|performance|timeout|memory leak|throughput)\b/i, impact: "performance degradation" },
];

/**
 * Derive a plain-English business impact from keywords in the evidence line.
 * When the source names no impact we say so — we never invent a consequence.
 */
export function inferBusinessImpact(context: string): string {
  const hits = IMPACT_RULES.filter((r) => r.test.test(context)).map((r) => r.impact);
  if (hits.length === 0) return "Impact not stated in source.";
  return dedupe(hits).join("; ");
}

// ─────────────────────────────────────────────────────────────────────────────
// Tiering (S–F), consistent with ui/src/lib/scoreboard.ts::tierFor
// ─────────────────────────────────────────────────────────────────────────────

function severityRank(severity: ProblemSeverity): number {
  switch (severity) {
    case "critical": return 4;
    case "high": return 3;
    case "medium": return 2;
    case "low": return 1;
  }
}

/**
 * Map a finding to the board's S–F ladder. We blend severity (dominant) with
 * confidence so a hedged generic-word match can't out-rank a structured P0.
 * Score range 2..10, thresholds mirror scoreboard `tierFor`.
 */
export function problemTier(severity: ProblemSeverity, confidence: number): ProblemTier {
  const clamped = Math.max(0, Math.min(1, confidence));
  const score = severityRank(severity) * 2 + Math.round(clamped * 2);
  if (score >= 9) return "S";
  if (score >= 8) return "A";
  if (score >= 6) return "B";
  if (score >= 4) return "C";
  if (score >= 3) return "D";
  return "F";
}

// ─────────────────────────────────────────────────────────────────────────────
// Core extraction
// ─────────────────────────────────────────────────────────────────────────────

const MAX_EVIDENCE_LEN = 240;
const MAX_TITLE_LEN = 100;

/**
 * Scan ONE file's text for documented problems. Pure and side-effect-free; does
 * NOT apply guardrails (that's {@link extractProblemsFromFiles}'s job) so it can
 * be tested in isolation. Returns findings in file order.
 */
export function extractProblemsFromFile(file: SourceFile): ExtractedProblem[] {
  const out: ExtractedProblem[] = [];
  const doc = isDocFile(file.path);
  const lines = file.content.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    if (rawLine.trim() === "") continue;
    // A row the company already CLOSED is not an open problem — struck-through
    // (`~~…~~`), a checked box, or a DONE/RESOLVED status marker means resolved.
    if (looksResolved(rawLine)) continue;
    const signal = firstSignal(rawLine, doc);
    if (!signal) continue;
    const evidenceQuote = truncate(rawLine.trim(), MAX_EVIDENCE_LEN);
    out.push({
      title: deriveTitle(rawLine, signal.label, file.path),
      severity: signal.severity,
      sourceFile: file.path,
      line: i + 1, // 1-based
      evidenceQuote,
      matchedSignal: signal.label,
      estimatedEffort: inferEffort(rawLine),
      businessImpact: inferBusinessImpact(rawLine),
      confidence: signal.confidence,
      tier: problemTier(signal.severity, signal.confidence),
    });
  }
  return out;
}

/**
 * Scan a set of files with guardrails ON and return a ranked, deduped result.
 * This is the entry point: it refuses env/PII/secret files (reporting each),
 * scans the rest docs-first, ranks highest-severity-then-confidence, and states
 * plainly when nothing was found.
 */
export function extractProblemsFromFiles(files: SourceFile[]): ExtractionResult {
  const filesRefused: RefusedFile[] = [];
  const scannable: SourceFile[] = [];
  for (const file of files) {
    const reason = refuseReason(file);
    if (reason) filesRefused.push({ path: file.path, reason });
    else scannable.push(file);
  }

  const ordered = docFirstSort(scannable);
  const problems: ExtractedProblem[] = [];
  for (const file of ordered) problems.push(...extractProblemsFromFile(file));

  rankProblems(problems);

  const empty = problems.length === 0;
  const note = empty
    ? `No documented problems found across ${scannable.length} scanned file(s)` +
      (filesRefused.length ? ` (${filesRefused.length} refused by guardrails).` : ".")
    : `${problems.length} documented problem(s) across ${scannable.length} file(s)` +
      (filesRefused.length ? `, ${filesRefused.length} file(s) refused by guardrails.` : ".");

  return { problems, filesScanned: scannable.length, filesRefused, empty, note };
}

/**
 * Rank in place: severity desc, then confidence desc, then a stable
 * file/line tiebreak so output is deterministic (fixture-testable).
 */
export function rankProblems(problems: ExtractedProblem[]): ExtractedProblem[] {
  problems.sort((a, b) => {
    const sev = severityRank(b.severity) - severityRank(a.severity);
    if (sev !== 0) return sev;
    if (b.confidence !== a.confidence) return b.confidence - a.confidence;
    if (a.sourceFile !== b.sourceFile) return a.sourceFile < b.sourceFile ? -1 : 1;
    return a.line - b.line;
  });
  return problems;
}

/** Render one finding as a single CLI/comment line. */
export function formatProblemLine(p: ExtractedProblem): string {
  return `[${p.tier}] ${p.severity.toUpperCase()} ${p.matchedSignal} — ${p.title} (${p.sourceFile}:${p.line}, conf ${p.confidence.toFixed(2)})`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

/** TODO-family tags ARE comments by nature — fire them anywhere. */
const TODO_FAMILY = new Set(["TODO", "FIXME", "HACK"]);
/** Priority markers that must not be confused with a type/enum declaration. */
const PRIORITY_MARKERS = new Set(["P0", "P1", "P2"]);
/**
 * Low-confidence generic single-word signals. These are the noisy ones that also
 * appear as UI copy / code identifiers, so they run through {@link looksLikeCodeToken}.
 */
const GENERIC_WORD_SIGNALS = new Set(["critical", "finding", "gap"]);

/**
 * True when a line documents an ALREADY-RESOLVED item rather than an open
 * problem. Three signals, matching what real registers use to close a row:
 *   - GitHub strikethrough spanning content: `~~auth bypass~~`;
 *   - a checked task box: `- [x]` / `[X]` / `[✓]`;
 *   - a resolved-status marker: `✅`/`✔`, or an ALL-CAPS status token
 *     (DONE/RESOLVED/CLOSED/FIXED/SHIPPED/COMPLETED/WONTFIX) as used in a
 *     tracker's Status column. Caps-only keeps prose ("we fixed the typo") open.
 */
export function looksResolved(line: string): boolean {
  if (/~~[^~]+~~/.test(line)) return true; // strikethrough
  if (/(^|\s)[-*+]?\s*\[[xX✓✔]\]/.test(line)) return true; // checked box
  if (/[✅✔]/.test(line)) return true; // resolved emoji
  if (/\b(?:DONE|RESOLVED|CLOSED|FIXED|SHIPPED|COMPLETED|WONTFIX)\b/.test(line)) return true;
  if (/\bWON'T\s+FIX\b/i.test(line)) return true;
  return false;
}

/**
 * True when `word` appears on `line` as a CODE / UI-copy token rather than
 * prose — a quoted enum value (`"critical"`, `'critical'`) or a kebab/snake
 * identifier segment (`alert-critical`, `critical_error`, `text-critical`).
 * Deliberately does NOT flag a doc label like `Critical:` (colon-terminated
 * heading) or plain prose ("this is critical"), which remain real signals.
 */
export function looksLikeCodeToken(line: string, word: string): boolean {
  const w = word.toLowerCase();
  const lower = line.toLowerCase();
  // Quoted / backticked bare token — covers attrs (`="critical"`) and object
  // values (`severity: "critical"`) since both quote the value.
  if (new RegExp("[\"'`]" + w + "[\"'`]").test(lower)) return true;
  // Glued into a kebab/snake identifier on either side.
  if (new RegExp("[a-z0-9][-_]" + w + "\\b|\\b" + w + "[-_][a-z0-9]").test(lower)) return true;
  return false;
}

/** A comment leader anywhere on the line (any common language). */
function hasCommentLeader(line: string): boolean {
  return /(?:^|\s)(?:\/\/+|#|\*|;|--|<!--)/.test(line);
}

/**
 * True when a line is DECLARING the priority taxonomy rather than APPLYING it —
 * a type union / enum / record listing two or more of P0..P3
 * (`priority: "P0" | "P1" | "P2"`, `{ P0: 0, P1: 1 }`). Those are schema, not a
 * documented problem, so we never emit a finding from them.
 */
function looksLikePriorityEnum(line: string): boolean {
  const tokens = line.match(/\bP[0-3]\b/g);
  return !!tokens && new Set(tokens).size >= 2;
}

/**
 * The first (strongest) signal that legitimately fires on a line. Precision
 * gates, applied in order:
 *   - a priority-enum declaration line never yields a P-marker finding;
 *   - in NON-doc files a signal only counts inside a comment (or a TODO-family
 *     tag), so `priority: "P0"` in code / `expect(x).toBe("P0")` in tests are
 *     ignored — they are not problems the company documented.
 */
function firstSignal(line: string, isDoc: boolean): SignalDef | null {
  const enumLike = looksLikePriorityEnum(line);
  for (const sig of SIGNALS) {
    if (!sig.test.test(line)) continue;
    if (PRIORITY_MARKERS.has(sig.label) && enumLike) continue;
    if (!isDoc && !TODO_FAMILY.has(sig.label) && !hasCommentLeader(line)) continue;
    // Generic single-word signals (critical/finding/gap) fire on UI copy and
    // code identifiers too — a quoted enum value or a kebab/snake token
    // (`variant="critical"`, `alert-critical`, `critical_error`) is UI copy, not
    // a documented problem. Skip it and let a stronger signal on the line win.
    if (GENERIC_WORD_SIGNALS.has(sig.label) && looksLikeCodeToken(line, sig.label)) continue;
    return sig;
  }
  return null;
}

/**
 * Build a concise title from the REAL evidence line — strips comment syntax,
 * list bullets, and the leading marker, then caps length. Never adds words that
 * aren't in the source; falls back to "<signal> in <file>" (all derived facts)
 * when the line carries only the bare marker.
 */
function deriveTitle(rawLine: string, label: string, sourceFile: string): string {
  let t = rawLine.trim();
  // Strip common comment / markdown lead-ins.
  t = t.replace(/^(?:\/\/+|#+|\*+|<!--|-{1,}|>{1,}|\d+[.)])\s*/, "");
  t = t.replace(/-->\s*$/, "");
  // Strip a leading marker token like "TODO:", "FIXME -", "P0)".
  t = t.replace(/^(?:TODO|FIXME|HACK|XXX|P0|P1|P2|NOTE|BUG)\b[\s:)\-–]*/i, "");
  t = t.replace(/\s+/g, " ").trim();
  if (t === "") return `${label} in ${basename(sourceFile)}`;
  return truncate(t, MAX_TITLE_LEN);
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max - 1).trimEnd() + "…";
}

function basename(path: string): string {
  const parts = path.split(/[\\/]/);
  return parts[parts.length - 1] ?? path;
}

function dedupe<T>(xs: T[]): T[] {
  return Array.from(new Set(xs));
}
