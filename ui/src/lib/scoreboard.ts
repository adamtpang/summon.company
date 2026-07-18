import type { Issue, IssuePriority, IssueStatus } from "@paperclipai/shared";

/**
 * Board scoreboard derivations (VIT-70).
 *
 * The board wants, next to the chat surface, one clean table of every task with
 * IMPORTANCE (0-5 stars), URGENCY (0-5 stars), the assigned AI employee, and a
 * progress bar. Two hard doctrines from the ticket shape everything here:
 *
 *   1. Stars are ADDITIVE, never a repurposing of the existing `priority` enum.
 *      Until board-editable persisted stars land (follow-up), we BACKFILL them
 *      from the current triage mapping so nothing upstream that reads `priority`
 *      breaks. `priority` stays the source of truth; stars are a derived view.
 *
 *   2. Progress is derived from REAL lifecycle signals on the issue, never
 *      self-reported. We read only fields present on the list payload (status,
 *      run locks, timestamps) so the panel needs no per-row detail fetch.
 *
 * All functions here are pure so they can be unit-tested without React.
 */

/** Board tier ladder (VIT-113 lineage): S = the Thiel band ("if you could only
 * do one thing"), F = shouldn't be on the board. Derived from the combined
 * star weight until persisted score fields land — same honest-backfill rule
 * as the stars themselves. */
export type ScoreboardTier = "S" | "A" | "B" | "C" | "D" | "F";

/** A single row in the priorities table, fully derived from an {@link Issue}. */
export interface ScoreboardRow {
  id: string;
  /** Human identifier (e.g. "VIT-70"); falls back to a short id slice. */
  identifier: string;
  /** Route id for the detail link — prefers the identifier, falls back to id. */
  pathId: string;
  title: string;
  status: IssueStatus;
  priority: IssuePriority;
  assigneeAgentId: string | null;
  importanceStars: number;
  urgencyStars: number;
  tier: ScoreboardTier;
  progress: number;
  progressLabel: string;
  reviewNeeded: boolean;
}

export interface ScoreboardSummary {
  /** Rows on the board (cancelled/hidden already excluded). */
  taskCount: number;
  /** Distinct agents with a live run right now. */
  agentsLive: number;
  doneCount: number;
  reviewNeededCount: number;
  /**
   * Overall completion — importance-weighted mean of per-row progress, matching
   * the ticket's "weighted completion of critical+high tasks". Weighting by
   * importance stars makes the highest-priority work dominate the bar. 0 when
   * the board is empty.
   */
  overallProgress: number;
}

export interface Scoreboard {
  rows: ScoreboardRow[];
  summary: ScoreboardSummary;
}

/**
 * Backfill IMPORTANCE stars from the triage priority. This is the "5/5-ish ->
 * critical" mapping run in reverse: it is the honest v1 seed, not a new source
 * of truth. Board-editable persisted overrides supersede this later.
 */
export function importanceStarsFor(priority: IssuePriority): number {
  switch (priority) {
    case "critical":
      return 5;
    case "high":
      return 4;
    case "medium":
      return 3;
    case "low":
      return 2;
    default:
      return 3;
  }
}

/**
 * URGENCY stars start from the same triage base as importance, then bend toward
 * "needs attention NOW" using live lifecycle signals so the two columns carry
 * genuinely different information:
 *   +1 when the task is waiting on the board / stalled / retrying (act now)
 *   -1 when it is still in the backlog (not yet urgent)
 * Clamped to 1..5. Still a derived backfill — no self-reported input.
 */
export function urgencyStarsFor(issue: Pick<Issue, "priority" | "status" | "scheduledRetry" | "blockedInboxAttention">): number {
  let stars = importanceStarsFor(issue.priority);
  const pressing =
    issue.status === "in_review" ||
    issue.status === "blocked" ||
    !!issue.scheduledRetry ||
    !!issue.blockedInboxAttention;
  if (pressing) stars += 1;
  if (issue.status === "backlog") stars -= 1;
  return Math.max(1, Math.min(5, stars));
}

/**
 * Tier from combined star weight (importance + urgency, range 2..10):
 * 10-9 = S (drop everything), 8 = A, 7-6 = B, 5-4 = C, 3 = D, 2 = F.
 * The S band is deliberately narrow — per the Thiel doctrine only a handful of
 * tasks may ever be S, and one agent works one S-tier task at a time.
 */
export function tierFor(importanceStars: number, urgencyStars: number): ScoreboardTier {
  const weight = importanceStars + urgencyStars;
  if (weight >= 9) return "S";
  if (weight >= 8) return "A";
  if (weight >= 6) return "B";
  if (weight >= 4) return "C";
  if (weight >= 3) return "D";
  return "F";
}

/**
 * A run is live when the engine holds an execution/checkout lock on the issue.
 * These are the only "an agent is working this right now" signals available on
 * the list payload.
 */
export function isRunLive(issue: Pick<Issue, "executionRunId" | "checkoutRunId" | "executionLockedAt">): boolean {
  return !!issue.executionRunId || !!issue.checkoutRunId || !!issue.executionLockedAt;
}

/**
 * A row needs BOARD review when it is parked awaiting a human sign-off — the
 * board asked for these to be highlighted and sorted to the top. We keep this
 * deliberately narrow so the highlight stays meaningful: classic `in_review`
 * sign-off, or a blocked-inbox item explicitly awaiting a board/user decision.
 * Broader agent-attention signals (needs_attention, productivity reviews) are
 * NOT board-review and would dilute the band, so they're excluded.
 */
export function isReviewNeeded(
  issue: Pick<Issue, "status" | "blockedInboxAttention">,
): boolean {
  if (issue.status === "in_review") return true;
  return issue.blockedInboxAttention?.state === "awaiting_decision";
}

/**
 * Progress as a percent + a state label, derived from the issue lifecycle:
 *   backlog/todo 0% -> woken 10% -> run started 25% -> in review 90% -> done 100%.
 * Blocked tasks report the furthest stage they reached (25%) with a Blocked
 * label so a stall doesn't read as "no progress". Acceptance-criteria checkbox
 * counting (the ticket's richer signal) needs the detail payload and is a
 * follow-up refinement; the ladder here uses only list-available fields.
 */
export function deriveProgress(
  issue: Pick<Issue, "status" | "startedAt" | "executionRunId" | "checkoutRunId" | "executionLockedAt">,
): { progress: number; label: string } {
  switch (issue.status) {
    case "done":
      return { progress: 100, label: "Done" };
    case "in_review":
      return { progress: 90, label: "In review" };
    case "cancelled":
      return { progress: 0, label: "Cancelled" };
    case "blocked":
      return { progress: 25, label: "Blocked" };
    case "backlog":
      return { progress: 0, label: "Backlog" };
    case "todo":
      return { progress: 0, label: "To do" };
    case "in_progress": {
      if (isRunLive(issue)) return { progress: 25, label: "Run started" };
      if (issue.startedAt) return { progress: 25, label: "Started" };
      return { progress: 10, label: "Woken" };
    }
    default:
      return { progress: 0, label: "To do" };
  }
}

/** Prefer the human identifier, fall back to a short id slice. */
function displayIdentifier(issue: Pick<Issue, "identifier" | "id">): string {
  return issue.identifier ?? issue.id.slice(0, 8);
}

/** Build one derived row from an issue. */
export function toScoreboardRow(issue: Issue): ScoreboardRow {
  const { progress, label } = deriveProgress(issue);
  const importanceStars = importanceStarsFor(issue.priority);
  const urgencyStars = urgencyStarsFor(issue);
  return {
    id: issue.id,
    identifier: displayIdentifier(issue),
    pathId: issue.identifier ?? issue.id,
    title: issue.title,
    status: issue.status,
    priority: issue.priority,
    assigneeAgentId: issue.assigneeAgentId,
    importanceStars,
    urgencyStars,
    tier: tierFor(importanceStars, urgencyStars),
    progress,
    progressLabel: label,
    reviewNeeded: isReviewNeeded(issue),
  };
}

/**
 * Board ordering: review-needed rows first, then by combined star weight
 * (importance + urgency) descending. The progress tiebreak flips by band —
 * within the review band the most-complete items lead (they're the ones ready
 * for the board to act on), while the working band surfaces least-complete
 * first so unfinished work rises above what's already done. Title breaks ties.
 */
export function sortScoreboardRows(rows: ScoreboardRow[]): ScoreboardRow[] {
  return [...rows].sort((a, b) => {
    if (a.reviewNeeded !== b.reviewNeeded) return a.reviewNeeded ? -1 : 1;
    const weightA = a.importanceStars + a.urgencyStars;
    const weightB = b.importanceStars + b.urgencyStars;
    if (weightA !== weightB) return weightB - weightA;
    if (a.progress !== b.progress) {
      // Same band here (reviewNeeded is equal); review band = most-complete
      // first, working band = least-complete first.
      const dir = a.reviewNeeded ? -1 : 1;
      return dir * (a.progress - b.progress);
    }
    return a.title.localeCompare(b.title);
  });
}

/** Issues excluded from the board entirely (terminal-cancelled or hidden). */
function isBoardEligible(issue: Issue): boolean {
  if (issue.status === "cancelled") return false;
  if (issue.hiddenAt) return false;
  // The Board Operations issue is the concierge chat's backing store, not a
  // company task — never surface it on the priorities board.
  if (issue.title === "Board Operations") return false;
  return true;
}

/**
 * Turn a raw issue list into the sorted rows + summary header the panel renders.
 */
export function buildScoreboard(issues: Issue[]): Scoreboard {
  const eligible = issues.filter(isBoardEligible);
  const rows = sortScoreboardRows(eligible.map(toScoreboardRow));

  const liveAgents = new Set<string>();
  for (const issue of eligible) {
    if (isRunLive(issue) && issue.assigneeAgentId) liveAgents.add(issue.assigneeAgentId);
  }

  let weightSum = 0;
  let weightedProgress = 0;
  for (const row of rows) {
    weightSum += row.importanceStars;
    weightedProgress += row.progress * row.importanceStars;
  }

  return {
    rows,
    summary: {
      taskCount: rows.length,
      agentsLive: liveAgents.size,
      doneCount: rows.filter((r) => r.status === "done").length,
      reviewNeededCount: rows.filter((r) => r.reviewNeeded).length,
      overallProgress: weightSum > 0 ? Math.round(weightedProgress / weightSum) : 0,
    },
  };
}
