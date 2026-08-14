import { describe, expect, it } from "vitest";
import {
  compileGitignore,
  docFirstSort,
  extractProblemsFromFile,
  extractProblemsFromFiles,
  filterIgnored,
  formatProblemLine,
  inferBusinessImpact,
  inferEffort,
  isDocFile,
  filterTranslationMirrors,
  isEnvFile,
  isIgnored,
  isTranslationMirror,
  looksLikeCodeToken,
  looksLikePiiContent,
  looksLikePiiPath,
  looksResolved,
  problemTier,
  refuseReason,
  type SourceFile,
} from "./problem-extract.js";

// ── Fixtures: representative documented-problem docs ────────────────────────

const AUDIT_DOC: SourceFile = {
  path: "docs/security-audit.md",
  content: [
    "# Security Audit — 2026 Q2",
    "",
    "## Findings",
    "- P0: authentication bypass on the admin API allows privilege escalation.",
    "- Sev1 vulnerability: unsalted password hashes (major rewrite required).",
    "- P2: rate limiting missing on the login endpoint.",
    "- Known issue: session tokens never expire.",
    "",
    "Everything else looked clean this quarter.",
  ].join("\n"),
};

const README_WITH_TODOS: SourceFile = {
  path: "README.md",
  content: [
    "# Service",
    "This service is not production-ready yet.",
    "",
    "Known technical debt in the billing module puts revenue at risk.",
  ].join("\n"),
};

const CODE_FILE: SourceFile = {
  path: "src/retry.ts",
  content: [
    "export function retry() {",
    "  // TODO: add exponential backoff, this is a quick fix",
    "  // FIXME: deadlock when the queue is full — production down risk",
    "  return true;",
    "}",
  ].join("\n"),
};

const CLEAN_DOC: SourceFile = {
  path: "docs/overview.md",
  content: "# Overview\nThis document explains the architecture. All systems nominal.",
};

// ── Core extraction ─────────────────────────────────────────────────────────

describe("extractProblemsFromFile", () => {
  it("cites the exact file and 1-based line for every finding", () => {
    const problems = extractProblemsFromFile(AUDIT_DOC);
    expect(problems.length).toBeGreaterThan(0);
    for (const p of problems) {
      expect(p.sourceFile).toBe("docs/security-audit.md");
      expect(p.line).toBeGreaterThanOrEqual(1);
      // Evidence must be a verbatim slice of the cited line.
      const actualLine = AUDIT_DOC.content.split("\n")[p.line - 1];
      expect(actualLine).toContain(p.evidenceQuote.replace(/…$/, "").trim().slice(0, 20));
    }
  });

  it("catches the P0 as critical and tiers it S", () => {
    const p0 = extractProblemsFromFile(AUDIT_DOC).find((p) => p.matchedSignal === "P0");
    expect(p0).toBeDefined();
    expect(p0!.severity).toBe("critical");
    expect(p0!.tier).toBe("S");
    expect(p0!.line).toBe(4);
  });

  it("derives a clean title from the evidence, not the marker", () => {
    const todo = extractProblemsFromFile(CODE_FILE).find((p) => p.matchedSignal === "TODO");
    expect(todo!.title).toBe("add exponential backoff, this is a quick fix");
    expect(todo!.severity).toBe("low");
  });

  it("infers effort and business impact ONLY from source words", () => {
    const problems = extractProblemsFromFile(README_WITH_TODOS);
    const debt = problems.find((p) => p.matchedSignal === "tech debt")!;
    expect(debt.businessImpact).toContain("revenue/billing risk");
    const notReady = problems.find((p) => p.matchedSignal === "not production ready")!;
    // Source says nothing about impact on that line → honest fallback.
    expect(notReady.businessImpact).toBe("Impact not stated in source.");
  });

  it("returns nothing for a clean doc — never invents a finding", () => {
    expect(extractProblemsFromFile(CLEAN_DOC)).toEqual([]);
  });

  it("takes at most one (strongest) signal per line", () => {
    const file: SourceFile = { path: "a.md", content: "P0 blocker: everything is on fire" };
    const problems = extractProblemsFromFile(file);
    expect(problems).toHaveLength(1);
    expect(problems[0].matchedSignal).toBe("P0"); // P0 outranks blocker
  });
});

// ── Aggregation, ranking, empty statement ───────────────────────────────────

describe("extractProblemsFromFiles", () => {
  it("ranks critical findings above low ones", () => {
    const { problems } = extractProblemsFromFiles([CODE_FILE, AUDIT_DOC, README_WITH_TODOS]);
    const severities = problems.map((p) => p.severity);
    expect(severities[0]).toBe("critical");
    // Monotonic non-increasing severity across the ranked list.
    const rank = { critical: 4, high: 3, medium: 2, low: 1 } as const;
    for (let i = 1; i < problems.length; i++) {
      expect(rank[severities[i]]).toBeLessThanOrEqual(rank[severities[i - 1]]);
    }
  });

  it("states plainly when nothing is found", () => {
    const result = extractProblemsFromFiles([CLEAN_DOC]);
    expect(result.empty).toBe(true);
    expect(result.problems).toEqual([]);
    expect(result.note).toMatch(/no documented problems/i);
  });

  it("is deterministic across runs", () => {
    const files = [CODE_FILE, AUDIT_DOC, README_WITH_TODOS];
    const a = extractProblemsFromFiles(files).problems.map(formatProblemLine);
    const b = extractProblemsFromFiles([...files].reverse()).problems.map(formatProblemLine);
    expect(a).toEqual(b);
  });
});

// ── Guardrails ──────────────────────────────────────────────────────────────

describe("guardrails", () => {
  it("never scans env files", () => {
    expect(isEnvFile(".env")).toBe(true);
    expect(isEnvFile("app/.env.production")).toBe(true);
    expect(isEnvFile("src/environment.ts")).toBe(false);
    const result = extractProblemsFromFiles([
      { path: ".env", content: "SECRET=P0 blocker in here" },
      AUDIT_DOC,
    ]);
    expect(result.filesRefused).toContainEqual({ path: ".env", reason: "env file (never read)" });
    expect(result.problems.every((p) => p.sourceFile !== ".env")).toBe(true);
  });

  it("refuses secret/PII-looking paths but not repos merely named pii", () => {
    expect(looksLikePiiPath("keys/id_rsa")).toBe(true);
    expect(looksLikePiiPath("data/patients.csv")).toBe(true);
    expect(looksLikePiiPath("server.pem")).toBe(true);
    // A repo NAMED pii-service is still readable — its README is not PII.
    expect(looksLikePiiPath("pii-service/README.md")).toBe(false);
  });

  it("refuses files whose content carries raw secrets/PII", () => {
    expect(looksLikePiiContent("-----BEGIN RSA PRIVATE KEY-----\nMIIE...")).toBe(true);
    expect(looksLikePiiContent("ssn is 123-45-6789")).toBe(true);
    expect(looksLikePiiContent("just some prose about a finding")).toBe(false);
    const decision = refuseReason({ path: "notes.md", content: "AKIAIOSFODNN7EXAMPLE" });
    expect(decision).toMatch(/secret\/PII/i);
  });
});

// ── .gitignore matcher ──────────────────────────────────────────────────────

describe("gitignore", () => {
  const matcher = compileGitignore(
    ["# comment", "node_modules/", "*.log", "/dist", "!important.log", "build/**/*.tmp"].join("\n"),
  );

  it("ignores directory contents and glob extensions", () => {
    expect(isIgnored(matcher, "node_modules/react/index.js")).toBe(true);
    expect(isIgnored(matcher, "server/app.log")).toBe(true);
    expect(isIgnored(matcher, "dist/bundle.js")).toBe(true);
    expect(isIgnored(matcher, "build/x/y/tmp.tmp")).toBe(true);
  });

  it("honors negation (last match wins)", () => {
    expect(isIgnored(matcher, "important.log")).toBe(false);
  });

  it("keeps non-ignored files", () => {
    expect(isIgnored(matcher, "src/index.ts")).toBe(false);
    const files: SourceFile[] = [
      { path: "src/index.ts", content: "" },
      { path: "node_modules/x/i.js", content: "" },
    ];
    expect(filterIgnored(files, matcher).map((f) => f.path)).toEqual(["src/index.ts"]);
  });
});

// ── Docs-first ordering & pure helpers ──────────────────────────────────────

describe("helpers", () => {
  it("sorts docs before code, stably", () => {
    const files: SourceFile[] = [
      { path: "src/a.ts", content: "" },
      { path: "README.md", content: "" },
      { path: "src/b.ts", content: "" },
      { path: "docs/x.md", content: "" },
    ];
    expect(docFirstSort(files).map((f) => f.path)).toEqual([
      "README.md",
      "docs/x.md",
      "src/a.ts",
      "src/b.ts",
    ]);
  });

  it("recognizes doc files", () => {
    expect(isDocFile("README.md")).toBe(true);
    expect(isDocFile("docs/plan.txt")).toBe(true);
    expect(isDocFile("src/index.ts")).toBe(false);
  });

  it("tiers blend severity and confidence like the scoreboard", () => {
    expect(problemTier("critical", 0.9)).toBe("S");
    expect(problemTier("high", 1)).toBe("A");
    expect(problemTier("high", 0.5)).toBe("B");
    expect(problemTier("medium", 0.6)).toBe("C");
    expect(problemTier("low", 0.1)).toBe("F");
  });

  it("infers effort from wording only", () => {
    expect(inferEffort("this needs a major rewrite")).toBe("large");
    expect(inferEffort("a quick one-line fix")).toBe("small");
    expect(inferEffort("the thing is broken")).toBe("unknown");
  });

  it("infers impact from keywords, else says so", () => {
    expect(inferBusinessImpact("this leaks PII")).toContain("sensitive-data exposure");
    expect(inferBusinessImpact("nothing notable here")).toBe("Impact not stated in source.");
  });
});

// ── v2 noise fixes (first-corpus run, 2026-07-24) ───────────────────────────
// The board's first real run over the 28 regain-inc clones flagged three noise
// sources; each fix is a pure predicate with a fixture below.

describe("resolved rows are not open problems (fix: struck-through / DONE)", () => {
  it("detects strikethrough, checked boxes, and DONE-family status", () => {
    expect(looksResolved("- ~~P0: auth bypass on admin API~~")).toBe(true);
    expect(looksResolved("- [x] P0: session tokens never expire")).toBe(true);
    expect(looksResolved("| P0 | Auth bypass | DONE |")).toBe(true);
    expect(looksResolved("P1: rate limiting missing — RESOLVED in v2")).toBe(true);
    expect(looksResolved("Sev1 leak ✅")).toBe(true);
    // Still open — no resolved marker, and lowercase prose stays a problem.
    expect(looksResolved("- [ ] P0: auth bypass on admin API")).toBe(false);
    expect(looksResolved("we fixed the earlier typo, but P0 auth bypass remains")).toBe(false);
  });

  it("excludes resolved rows from findings but keeps the open ones", () => {
    const register: SourceFile = {
      path: "docs/issue-register.md",
      content: [
        "# Production Readiness — Issue Register",
        "- ~~P0: unsalted password hashes~~ (fixed 2026-02)",
        "- [x] P1: rate limiting missing on login",
        "- P0: authentication bypass on the admin API is still open.",
        "| P2 | session expiry | DONE |",
      ].join("\n"),
    };
    const problems = extractProblemsFromFile(register);
    // Only the one genuinely-open P0 survives.
    expect(problems).toHaveLength(1);
    expect(problems[0].matchedSignal).toBe("P0");
    expect(problems[0].line).toBe(4);
  });
});

describe("UI-copy uses of generic words are not problems (fix: context filter)", () => {
  it("flags quoted enum values and kebab/snake identifiers as code tokens", () => {
    expect(looksLikeCodeToken('<Badge variant="critical" />', "critical")).toBe(true);
    expect(looksLikeCodeToken("severity: 'critical',", "critical")).toBe(true);
    expect(looksLikeCodeToken('className="alert-critical"', "critical")).toBe(true);
    expect(looksLikeCodeToken('t("critical_error")', "critical")).toBe(true);
    // Real doc prose and label headings are NOT code tokens.
    expect(looksLikeCodeToken("This bug is critical and blocks launch.", "critical")).toBe(false);
    expect(looksLikeCodeToken("Critical: the payment path is down.", "critical")).toBe(false);
  });

  it("does not emit a finding from UI-copy critical, but does from prose", () => {
    const uiCopy: SourceFile = {
      path: "docs/components.md",
      content: [
        "# Components",
        'Render `<Toast variant="critical">` to style urgent notices.',
        "The `alert-critical` class paints the banner red.",
      ].join("\n"),
    };
    expect(extractProblemsFromFile(uiCopy)).toEqual([]);

    const prose: SourceFile = {
      path: "docs/status.md",
      content: "The auth outage is a critical problem for every tenant.",
    };
    const found = extractProblemsFromFile(prose);
    expect(found).toHaveLength(1);
    expect(found[0].matchedSignal).toBe("critical");
  });
});

describe("translation mirrors are deduped (fix: dedupe _translations/)", () => {
  it("recognizes _translations/ and non-English locale mirror dirs", () => {
    expect(isTranslationMirror("docs/_translations/ru/issue-register.md")).toBe(true);
    expect(isTranslationMirror("i18n/de/readme.md")).toBe(true);
    expect(isTranslationMirror("locales/fr/plan.md")).toBe(true);
    // English source and ordinary paths are kept.
    expect(isTranslationMirror("docs/issue-register.md")).toBe(false);
    expect(isTranslationMirror("i18n/en/readme.md")).toBe(false);
    expect(isTranslationMirror("src/i18n/format.ts")).toBe(false);
  });

  it("drops mirror files so findings are not double-counted", () => {
    const source: SourceFile = { path: "docs/register.md", content: "- P0: auth bypass open" };
    const mirror: SourceFile = { path: "docs/_translations/ru/register.md", content: "- P0: обход аутентификации" };
    const kept = filterTranslationMirrors([source, mirror]);
    expect(kept.map((f) => f.path)).toEqual(["docs/register.md"]);
  });
});
