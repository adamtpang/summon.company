/**
 * Register-truth types (SCAFFOLD, not wired).
 *
 * A "register" is a customer-written findings document (a P0 table, an issue
 * register, a checklist). Reconciliation answers one question per finding: is
 * this still true of the code today, and what is the evidence either way.
 *
 * Design notes and failure modes: doc/REGISTER-TRUTH-AGENT.md
 */

/** What the code says about a finding the register still lists. */
export type FindingStatus =
  /** Fixed in code, with a closing commit. */
  | "closed"
  /** Still reproduces at HEAD. */
  | "open"
  /** Some of the claim is addressed, some is not. */
  | "partial"
  /** The claim did not match the code even when it was written. */
  | "contradicted"
  /** Security-sensitive, or the evidence is ambiguous. Never auto-closed. */
  | "needs_human";

export interface FindingEvidence {
  /** Repo-relative path the claim resolves to. */
  file: string;
  /** 1-indexed lines that carry the proof. */
  lines: number[];
  /** Short commit sha that closed it, when status is closed or partial. */
  closingCommit?: string;
  /** ISO date of the closing commit. */
  closedAt?: string;
  /** Occurrences at the register's own commit, used to tell closed from contradicted. */
  countAtRegisterCommit?: number;
  /** Occurrences at HEAD. */
  countAtHead?: number;
}

export interface Finding {
  /** The customer's own id, e.g. "P0-2". Never renumbered by us. */
  id: string;
  /** Verbatim claim text from the register. */
  claim: string;
  /** Status the register asserts today. */
  claimedStatus: string;
  /** Status the code supports. */
  actualStatus: FindingStatus;
  evidence: FindingEvidence[];
  /** Why a human must look, when actualStatus is needs_human. */
  humanReason?: string;
}

export interface ReconciliationReceipt {
  companyId: string;
  /** owner/repo of the customer repo. Read-only, always. */
  repo: string;
  /** Repo-relative path of the register that was reconciled. */
  registerPath: string;
  /** Commit the register was last edited at. */
  registerCommit: string;
  /** Commit reconciled against, always a fresh remote default branch. */
  headCommit: string;
  /** Commits between the two, the staleness number a CEO reads. */
  commitsSinceRegister: number;
  findings: Finding[];
  /** Unified diff of the corrected register, the thing the customer approves. */
  proposedDiff: string;
  generatedAt: string;
}

export interface RegisterTruthRunRequest {
  companyId: string;
  repo: string;
  /** Omit to auto-discover registers by filename convention. */
  registerPath?: string;
  /** Default true. False is a second, separately enabled mode. */
  suggestOnly?: boolean;
}
