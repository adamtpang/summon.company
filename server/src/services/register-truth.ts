/**
 * Register-truth reconciler (SCAFFOLD, not wired).
 *
 * Nothing here is exported through services/index.ts yet and no route mounts
 * it. It exists so the shape is reviewable before it is built. The one-shot
 * version of this logic was run by hand against regain-inc/miss on 2026-07-30;
 * its output is in outbound/regain-register/ and its lessons are the guard
 * comments below.
 *
 * Design: doc/REGISTER-TRUTH-AGENT.md
 * Customer repos are READ-ONLY. This service must never write to one.
 */

import type {
  Finding,
  ReconciliationReceipt,
  RegisterTruthRunRequest,
} from "@paperclipai/shared";

/**
 * Findings whose claim touches authorization, PHI, secrets, or payments never
 * auto-close, even when the code reads fixed. The manual run proved why: P0-1
 * came back "closed" while the front-desk route had landed a different
 * permission than the register asked for. A wrong "closed" on a security row
 * is worse than no reconciliation at all.
 */
const NEVER_AUTO_CLOSE = /\b(authz|authorization|rbac|permission|phi|pii|secret|token|payment|billing)\b/i;

export interface RegisterTruthDeps {
  /**
   * Resolve a fresh remote default branch. MUST fetch: the manual run started
   * against a clone 41 commits stale and would have reported the wrong state.
   */
  resolveHead(repo: string): Promise<{ sha: string; branch: string }>;
  /** Read a file at a ref without checking out the customer's tree. */
  readFileAtRef(repo: string, ref: string, path: string): Promise<string | null>;
  /** Commits between two refs, for the staleness count. */
  countCommitsBetween(repo: string, fromRef: string, toRef: string): Promise<number>;
  /** Commit that last touched a path, for register age. */
  lastCommitForPath(repo: string, ref: string, path: string): Promise<{ sha: string; date: string } | null>;
  /**
   * Walk forward from the register commit to find the first commit where a
   * symbol becomes present. Deliberately not `git log -S` alone: on a renamed
   * file the pickaxe returned a March commit for a July fix.
   */
  firstCommitWherePresent(
    repo: string,
    path: string,
    needle: string,
    sinceRef: string,
  ): Promise<{ sha: string; date: string } | null>;
}

/**
 * Reconcile one register against HEAD.
 *
 * TODO(SUM-276): implement. Order of operations that the manual run validated:
 *   1. resolveHead, never trust a local checkout
 *   2. locate the register, record its own last-edit commit
 *   3. parse findings (see register-truth-parsers.ts)
 *   4. per finding: count occurrences at the register commit AND at head.
 *      zero-then-present is closed; present-then-present is contradicted;
 *      present-then-absent needs the claim re-read, not an auto-close
 *   5. measure inside the boundary the finding names, not repo-wide. "2,671
 *      empty strings" was repo-wide noise; inside the cited line range the
 *      real number was 7
 *   6. mark NEVER_AUTO_CLOSE matches as needs_human regardless of evidence
 *   7. render the corrected register and diff it against the original
 */
export async function reconcileRegister(
  _req: RegisterTruthRunRequest,
  _deps: RegisterTruthDeps,
): Promise<ReconciliationReceipt> {
  throw new Error("register-truth: not implemented (scaffold only, see SUM-276)");
}

/** Classify one finding. Exported for tests before the caller exists. */
export function classifyFinding(_finding: Finding): Finding["actualStatus"] {
  throw new Error("register-truth: not implemented (scaffold only, see SUM-276)");
}

export function requiresHumanReview(claim: string): boolean {
  return NEVER_AUTO_CLOSE.test(claim);
}
