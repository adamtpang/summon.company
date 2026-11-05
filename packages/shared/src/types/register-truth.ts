/**
 * Register-truth types: the single home for the shapes the reconciler
 * produces, the server persists (register_reconciliations.receipt), and the
 * UI renders. The server service imports these; nothing re-declares them.
 *
 * A "register" is a customer-written findings document (a P0 table, an issue
 * register, a checklist). Reconciliation answers one question per finding:
 * is this still true of the code today, and what is the evidence either way.
 */

/** What the code says about a finding the register still lists. */
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
   * file growing or shifting; fixed line numbers do not (the P0-8 lesson: an
   * 830-line file growth slid a fixed window onto new content and reported a
   * regression that never happened).
   */
  anchor?: { start: string; end?: string };
  /**
   * Count blank-line separated records whose text matches this regex, and
   * within those, occurrences of `pattern`. The shape a .po catalogue needs.
   */
  blockContext?: string;
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
  /** The customer's own id, e.g. "P0-2". Never renumbered by us. */
  id: string;
  /** Verbatim claim text from the register. */
  claim: string;
  /** Status the register asserts today. */
  claimedStatus: string;
  /** Status the code supports. */
  actualStatus: FindingStatus;
  probes: ProbeResult[];
  /** Why a human must look, when actualStatus is needs_human. */
  humanReason?: string;
}

export interface ReconciliationReceipt {
  /** owner/name of the customer repo. Read-only, always. */
  repo: string;
  /** Repo-relative path of the register that was reconciled. */
  registerPath: string;
  /** Commit the register was last edited at. */
  registerCommit: string;
  registerDate: string;
  /** Commit reconciled against, always a fresh remote default branch. */
  headCommit: string;
  headBranch: string;
  /** Commits between the two, the staleness number a founder reads. */
  commitsSinceRegister: number;
  /**
   * The register text at headCommit, carried on the receipt so consumers
   * (the diff proposer, renderers) never re-fetch at a different commit.
   */
  registerText: string;
  findings: ReconciledFinding[];
  generatedAt: string;
}

/** Per-status finding counts, derived from a receipt in exactly one place. */
export interface FindingStatusCounts {
  closed: number;
  partial: number;
  needsHuman: number;
  open: number;
  contradicted: number;
  total: number;
}
