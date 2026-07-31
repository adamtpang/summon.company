/**
 * Register-truth reconciler.
 *
 * Answers one question per finding: is this still true of the code today, and
 * what is the evidence either way. Customer repos are READ-ONLY; every git
 * command here reads, none write.
 *
 * The classification rules below were learned the hard way during the manual
 * run against regain-inc/miss on 2026-07-30 (outbound/regain-register/).
 *
 * Design: doc/REGISTER-TRUTH-AGENT.md
 */

import { spawnSync } from "node:child_process";

import { parseRegister, type ParsedFinding } from "./register-truth-parsers.js";

export type FindingStatus = "closed" | "open" | "partial" | "contradicted" | "needs_human";

export interface Probe {
  /** Repo-relative path to look in. */
  file: string;
  /** Literal text whose appearance proves the fix landed. */
  needle?: string;
  /**
   * Regex counted instead of a literal. Needed for findings measured as a
   * quantity rather than a presence, e.g. "53 empty translations", where the
   * file uses hashed ids and no literal string can stand in.
   */
  pattern?: string;
  /**
   * Restrict a pattern count to a marker-anchored region. Anchors survive the
   * file growing or shifting; line numbers do not. A fixed range on
   * regain's ru.po reported a 37 -> 60 regression that was really the window
   * sliding over new content as the file grew by 830 lines.
   */
  anchor?: { start: string; end?: string };
  /**
   * Count blocks (blank-line separated records) whose text matches
   * `blockContext`, and within those, occurrences of `pattern`. This is how a
   * finding scoped to "the surfaces referenced by X" is measured in a file
   * that has no stable line ordering, e.g. a .po catalogue.
   */
  blockContext?: string;
  /**
   * Deprecated: a 1-indexed line range. Kept so existing probe files still
   * load, but it drifts the moment the file changes. Prefer `anchor`.
   */
  lines?: [number, number];
  /**
   * Which direction proves the fix. Presence probes expect the evidence to
   * appear; quantity probes usually expect it to drain toward zero.
   */
  goal?: "increase" | "decrease";
}

export interface ProbeResult extends Probe {
  /** null when the probe could not be evaluated at that revision. */
  countAtRegister: number | null;
  countAtHead: number | null;
  /**
   * satisfied means the goal was fully met, improved means it moved the right
   * way, unmeasurable means an anchor was missing and no count was possible.
   */
  verdict: "satisfied" | "improved" | "unchanged" | "regressed" | "unmeasurable";
  firstPresent?: { sha: string; date: string };
}

export interface ReconciledFinding {
  id: string;
  claim: string;
  claimedStatus: string;
  actualStatus: FindingStatus;
  probes: ProbeResult[];
  humanReason?: string;
}

export interface ReconciliationReceipt {
  repo: string;
  registerPath: string;
  registerCommit: string;
  registerDate: string;
  headCommit: string;
  headBranch: string;
  commitsSinceRegister: number;
  findings: ReconciledFinding[];
  generatedAt: string;
}

/**
 * Findings touching authorization, PHI, secrets or money never auto-close even
 * when the code reads fixed. P0-1 came back "closed" while the front-desk route
 * had landed a different permission than the register asked for; a wrong
 * "closed" on a PHI row is worse than no reconciliation at all.
 */
const NEVER_AUTO_CLOSE =
  /\b(authz|authoriz\w*|rbac|permission|phi|pii|secret|token|credential|payment|billing)\b/i;

export function requiresHumanReview(claim: string): boolean {
  return NEVER_AUTO_CLOSE.test(claim);
}

// ── git, read-only ──────────────────────────────────────────────────────────

function git(repoDir: string, args: string[]): string {
  const res = spawnSync("git", args, {
    cwd: repoDir,
    encoding: "utf-8",
    maxBuffer: 64 * 1024 * 1024,
  });
  if (res.status !== 0) return "";
  return res.stdout ?? "";
}

export interface GitReader {
  /** Fetch, then resolve the remote default branch. Never trust a local HEAD. */
  resolveHead(): { sha: string; branch: string };
  readFileAtRef(ref: string, path: string): string | null;
  countCommitsBetween(fromRef: string, toRef: string): number;
  lastCommitForPath(ref: string, path: string): { sha: string; date: string } | null;
  commitsTouchingSince(path: string, sinceRef: string, headRef: string): string[];
  commitMeta(sha: string): { sha: string; date: string };
}

export function createGitReader(repoDir: string): GitReader {
  return {
    resolveHead() {
      // Read-only network op. A stale clone silently reports the wrong state:
      // the first manual run was 41 commits behind and would have lied.
      git(repoDir, ["fetch", "origin", "--quiet"]);
      const head =
        git(repoDir, ["symbolic-ref", "refs/remotes/origin/HEAD"]).trim() ||
        "refs/remotes/origin/main";
      const branch = head.replace("refs/remotes/origin/", "").trim() || "main";
      const sha = git(repoDir, ["rev-parse", "--short", `origin/${branch}`]).trim();
      return { sha, branch };
    },
    readFileAtRef(ref, path) {
      const out = git(repoDir, ["show", `${ref}:${path}`]);
      return out === "" ? null : out;
    },
    countCommitsBetween(fromRef, toRef) {
      const out = git(repoDir, ["rev-list", "--count", `${fromRef}..${toRef}`]).trim();
      return Number.parseInt(out, 10) || 0;
    },
    lastCommitForPath(ref, path) {
      const out = git(repoDir, [
        "log", "-1", "--format=%h|%cd", "--date=short", ref, "--", path,
      ]).trim();
      if (!out) return null;
      const [sha, date] = out.split("|");
      return { sha, date };
    },
    commitsTouchingSince(path, sinceRef, headRef) {
      const out = git(repoDir, [
        "log", `${sinceRef}..${headRef}`, "--format=%h", "--reverse", "--", path,
      ]).trim();
      return out ? out.split(/\r?\n/) : [];
    },
    commitMeta(sha) {
      const out = git(repoDir, ["log", "-1", "--format=%h|%cd", "--date=short", sha]).trim();
      const [s, date] = out.split("|");
      return { sha: s, date };
    },
  };
}

// ── probes ──────────────────────────────────────────────────────────────────

function countOccurrences(haystack: string, needle: string): number {
  if (!needle) return 0;
  let count = 0;
  let index = haystack.indexOf(needle);
  while (index !== -1) {
    count += 1;
    index = haystack.indexOf(needle, index + needle.length);
  }
  return count;
}

/**
 * Resolve a marker-anchored region to text.
 *
 * Returns null when the start marker is absent, which the caller must treat as
 * "unmeasurable", never as zero. A missing anchor silently counting zero is how
 * a probe turns into a false "closed".
 */
export function resolveAnchoredRegion(
  content: string,
  anchor: { start: string; end?: string },
): string | null {
  const startIndex = content.indexOf(anchor.start);
  if (startIndex === -1) return null;
  if (!anchor.end) return content.slice(startIndex);
  const endIndex = content.indexOf(anchor.end, startIndex + anchor.start.length);
  if (endIndex === -1) return content.slice(startIndex);
  return content.slice(startIndex, endIndex + anchor.end.length);
}

/** Blank-line separated records, the shape of .po catalogues and many configs. */
function splitBlocks(content: string): string[] {
  return content.split(/\r?\n\s*\r?\n/);
}

/**
 * Measure one probe against one file revision.
 *
 * Returns null when the probe cannot be evaluated (missing anchor), so the
 * caller can report "unmeasurable" rather than inventing a count.
 */
export function measure(content: string, probe: Probe): number | null {
  if (probe.blockContext) {
    const contextRe = new RegExp(probe.blockContext, "m");
    const matchRe = probe.pattern ? new RegExp(probe.pattern, "gm") : null;
    let total = 0;
    for (const block of splitBlocks(content)) {
      if (!contextRe.test(block)) continue;
      total += matchRe ? (block.match(matchRe) ?? []).length : 1;
    }
    return total;
  }

  if (probe.pattern) {
    let body: string | null = content;
    if (probe.anchor) {
      body = resolveAnchoredRegion(content, probe.anchor);
      if (body === null) return null;
    } else if (probe.lines) {
      body = content.split(/\r?\n/).slice(probe.lines[0] - 1, probe.lines[1]).join("\n");
    }
    const re = new RegExp(probe.pattern, "gm");
    return (body.match(re) ?? []).length;
  }

  return countOccurrences(content, probe.needle ?? "");
}

function verdictFor(
  probe: Probe,
  before: number | null,
  after: number | null,
): ProbeResult["verdict"] {
  if (before === null || after === null) return "unmeasurable";
  const goal = probe.goal ?? (probe.pattern ? "decrease" : "increase");
  if (goal === "decrease") {
    if (after === 0 && before > 0) return "satisfied";
    if (after < before) return "improved";
    if (after > before) return "regressed";
    return "unchanged";
  }
  if (before === 0 && after > 0) return "satisfied";
  if (after > before) return "improved";
  if (after < before) return "regressed";
  return "unchanged";
}

/**
 * Derive probe candidates from a parsed row: every (file, symbol) pair the row
 * names. Coarse on purpose. A curated probe from the overrides file beats these
 * every time, which is why overrides win in reconcile().
 */
export function deriveProbes(finding: ParsedFinding): Probe[] {
  const probes: Probe[] = [];
  for (const file of finding.files) {
    for (const symbol of finding.symbols) probes.push({ file, needle: symbol });
  }
  return probes.slice(0, 12);
}

/**
 * Classify from probe evidence.
 *
 * absent-then-present is the signal that a fix landed. Everything else is
 * deliberately conservative: an unchanged count means we did not observe the
 * fix, not that the finding is closed.
 */
export function classify(
  claim: string,
  probes: ProbeResult[],
): { status: FindingStatus; humanReason?: string } {
  if (requiresHumanReview(claim)) {
    return {
      status: "needs_human",
      humanReason: "Security or money finding: evidence is reported, never auto-closed.",
    };
  }
  if (probes.length === 0) {
    return { status: "needs_human", humanReason: "No probe could be derived from the row." };
  }

  const satisfied = probes.filter((p) => p.verdict === "satisfied");
  const improved = probes.filter((p) => p.verdict === "improved");
  const unchanged = probes.filter((p) => p.verdict === "unchanged");
  const regressed = probes.filter((p) => p.verdict === "regressed");
  const unmeasurable = probes.filter((p) => p.verdict === "unmeasurable");

  if (unmeasurable.length > 0) {
    return {
      status: "needs_human",
      humanReason:
        "A probe anchor no longer resolves, so this row could not be measured. Re-anchor the probe.",
    };
  }
  if (satisfied.length === probes.length) return { status: "closed" };
  if (satisfied.length > 0 || improved.length > 0) return { status: "partial" };
  if (regressed.length > 0) {
    return {
      status: "needs_human",
      humanReason: "Evidence moved the wrong way: the code changed, re-read the claim.",
    };
  }
  if (unchanged.length === probes.length) {
    const anyPresent = probes.some((p) => (p.countAtHead ?? 0) > 0);
    return anyPresent
      ? {
          status: "contradicted",
          humanReason:
            "Nothing changed since the register was written; the claim may never have matched.",
        }
      : { status: "open" };
  }
  return { status: "open" };
}

// ── the reconciler ──────────────────────────────────────────────────────────

export interface ReconcileOptions {
  /** Local path to a READ-ONLY clone of the customer repo. */
  repoDir: string;
  /** owner/repo, for the receipt. */
  repo: string;
  /** Repo-relative path to the register. */
  registerPath: string;
  /** Curated probes by finding id. These beat derived probes. */
  overrides?: Record<string, Probe[]>;
  /** Only reconcile these ids. */
  only?: string[];
}

export function reconcileRegister(opts: ReconcileOptions): ReconciliationReceipt {
  const reader = createGitReader(opts.repoDir);
  const head = reader.resolveHead();
  const headRef = `origin/${head.branch}`;

  const registerAtHead = reader.readFileAtRef(headRef, opts.registerPath);
  if (registerAtHead === null) {
    throw new Error(`register not found at ${headRef}:${opts.registerPath}`);
  }

  const registerCommit = reader.lastCommitForPath(headRef, opts.registerPath);
  if (!registerCommit) throw new Error(`no history for ${opts.registerPath}`);

  const commitsSince = reader.countCommitsBetween(registerCommit.sha, headRef);
  const parsed = parseRegister(registerAtHead).filter(
    (f) => !opts.only || opts.only.includes(f.id),
  );

  const findings: ReconciledFinding[] = parsed.map((finding) => {
    const probes = opts.overrides?.[finding.id] ?? deriveProbes(finding);

    const results: ProbeResult[] = probes.map((probe) => {
      const atRegister = reader.readFileAtRef(registerCommit.sha, probe.file) ?? "";
      const atHead = reader.readFileAtRef(headRef, probe.file) ?? "";
      const countAtRegister = measure(atRegister, probe);
      const countAtHead = measure(atHead, probe);
      const verdict = verdictFor(probe, countAtRegister, countAtHead);

      let firstPresent: { sha: string; date: string } | undefined;
      if (verdict === "satisfied" || verdict === "improved") {
        // Walk forward rather than trusting `git log -S`: on a renamed file the
        // pickaxe returned a March commit for a July fix. This walk found the
        // real closer for P0-3 that the pickaxe missed entirely.
        for (const sha of reader.commitsTouchingSince(probe.file, registerCommit.sha, headRef)) {
          const content = reader.readFileAtRef(sha, probe.file) ?? "";
          const value = measure(content, probe);
          const moved = verdictFor(probe, countAtRegister, value);
          if (moved === "satisfied" || moved === "improved") {
            firstPresent = reader.commitMeta(sha);
            break;
          }
        }
      }

      return { ...probe, countAtRegister, countAtHead, verdict, firstPresent };
    });

    const { status, humanReason } = classify(finding.claim, results);
    return {
      id: finding.id,
      claim: finding.claim,
      claimedStatus: finding.claimedStatus,
      actualStatus: status,
      probes: results,
      humanReason,
    };
  });

  return {
    repo: opts.repo,
    registerPath: opts.registerPath,
    registerCommit: registerCommit.sha,
    registerDate: registerCommit.date,
    headCommit: head.sha,
    headBranch: head.branch,
    commitsSinceRegister: commitsSince,
    findings,
    generatedAt: new Date().toISOString(),
  };
}

/** One-line summary, the sentence a founder actually reads. */
export function summarize(receipt: ReconciliationReceipt): string {
  const closed = receipt.findings.filter((f) => f.actualStatus === "closed").length;
  const partial = receipt.findings.filter((f) => f.actualStatus === "partial").length;
  const human = receipt.findings.filter((f) => f.actualStatus === "needs_human").length;
  const total = receipt.findings.length;
  return (
    `${closed} of ${total} findings are closed in code` +
    (partial ? `, ${partial} partially` : "") +
    (human ? `, ${human} need a human` : "") +
    `, but the register has not been updated in ${receipt.commitsSinceRegister} commits ` +
    `(last edited ${receipt.registerDate}).`
  );
}
