import type { Issue, IssueLabel, IssuePriority, IssueStatus } from "@paperclipai/shared";

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

/* ------------------------------------------------------------------------- *
 * SUM-148 — four-input Inbox scoring, work-type tags, and agent routing.
 *
 * The board asked for every inbox task to carry IMPORTANCE, URGENCY, TIME
 * involved, and MONEY involved; a tier letter; a work-type tag; and a routed
 * agent. Importance and urgency already have honest backfills above. The two
 * genuinely new inputs (time, money) plus the work-type tag have no proxy on
 * the issue lifecycle — they are human triage judgments.
 *
 * First-principles choice (SUM-148): rather than a cross-package DB migration
 * for two new columns, we persist these judgments in the EXISTING label system,
 * which is already durable AND board-editable ("board can override"). The CEO
 * triage skill writes namespaced labels; the board overrides by editing labels.
 * Nothing here is self-reported by a run — a human/CEO wrote the label.
 *
 * Label conventions (case-insensitive, `namespace:value`, bare fallback too):
 *   time:xs|s|m|l|xl     — time involved (xs = minutes, xl = weeks)
 *   money:xs|s|m|l|xl    — money involved (xs = negligible, xl = company-making)
 *   dept:<work-type>     — work type; a bare label named after a department also
 *                          counts, so "engineering" or "dept:engineering" both work.
 *
 * All functions stay pure so they unit-test without React, matching the file.
 * ------------------------------------------------------------------------- */

/** The eight work-type buckets the board triages into. */
export type WorkTypeTag =
  | "engineering"
  | "design"
  | "marketing"
  | "sales"
  | "finance"
  | "ops"
  | "legal"
  | "support";

const TIME_LABEL_PREFIX = "time:";
const MONEY_LABEL_PREFIX = "money:";
const DEPT_LABEL_PREFIX = "dept:";

/** t-shirt size token -> 1..5 stars. xs is the smallest, xl the largest. */
const SIZE_STARS: Record<string, number> = { xs: 1, s: 2, m: 3, l: 4, xl: 5 };

/** Neutral star value used when the board has not tagged the input yet. */
const NEUTRAL_STARS = 3;

/** Accept a few common synonyms so triage labels don't have to be exact. */
const WORK_TYPE_ALIASES: Record<string, WorkTypeTag> = {
  engineering: "engineering",
  eng: "engineering",
  dev: "engineering",
  design: "design",
  ux: "design",
  marketing: "marketing",
  growth: "marketing",
  sales: "sales",
  finance: "finance",
  fin: "finance",
  ops: "ops",
  operations: "ops",
  legal: "legal",
  support: "support",
};

/**
 * The responsible AI employee per work type (SUM-148 routing table). The board
 * named seven department agents; `agentNameKey` is matched against the live
 * company agent roster by the UI to resolve a real id for one-click dispatch.
 * `legal` has no dedicated agent yet, so it routes to null (board dispatches).
 */
export interface WorkTypeRoute {
  workType: WorkTypeTag;
  department: string;
  /** First-name key to match against `agent.name`; null when unrouted. */
  agentNameKey: string | null;
}

const ROUTES: Record<WorkTypeTag, WorkTypeRoute> = {
  engineering: { workType: "engineering", department: "Engineering", agentNameKey: "Forge" },
  design: { workType: "design", department: "Design", agentNameKey: "Ink" },
  marketing: { workType: "marketing", department: "Marketing", agentNameKey: "Echo" },
  sales: { workType: "sales", department: "Sales", agentNameKey: "Vector" },
  finance: { workType: "finance", department: "Finance", agentNameKey: "Ledger" },
  ops: { workType: "ops", department: "Operations", agentNameKey: "Atlas" },
  support: { workType: "support", department: "Support", agentNameKey: "Pulse" },
  legal: { workType: "legal", department: "Legal", agentNameKey: null },
};

/** Lower-cased label names for an issue, from either compact or full payloads. */
function labelNames(issue: Pick<Issue, "labels">): string[] {
  return (issue.labels ?? []).map((l: IssueLabel) => l.name.trim().toLowerCase());
}

/** Read a `prefix:size` label (e.g. `time:l`) into 1..5 stars, neutral if absent. */
function sizeStarsFromLabels(names: string[], prefix: string): number {
  for (const name of names) {
    if (!name.startsWith(prefix)) continue;
    const token = name.slice(prefix.length).trim();
    if (token in SIZE_STARS) return SIZE_STARS[token];
  }
  return NEUTRAL_STARS;
}

/**
 * TIME involved as 1..5 stars (xs=1 quick, xl=5 heavy). More stars means MORE
 * time, which is a COST — {@link tierForFour} treats it as effort, not value.
 * Honest backfill: neutral until the board tags `time:<size>`.
 */
export function timeInvolvedStarsFor(issue: Pick<Issue, "labels">): number {
  return sizeStarsFromLabels(labelNames(issue), TIME_LABEL_PREFIX);
}

/**
 * MONEY involved as 1..5 stars (xs=1 negligible, xl=5 company-making). More
 * stars means more money at stake, which pulls the tier UP. Neutral until the
 * board tags `money:<size>`.
 */
export function moneyInvolvedStarsFor(issue: Pick<Issue, "labels">): number {
  return sizeStarsFromLabels(labelNames(issue), MONEY_LABEL_PREFIX);
}

/**
 * Resolve the work-type tag from labels: a `dept:<x>` label wins, else the
 * first bare label whose name matches a known department (or synonym). Returns
 * null when the board has not tagged a work type yet.
 */
export function workTypeTagFor(issue: Pick<Issue, "labels">): WorkTypeTag | null {
  const names = labelNames(issue);
  for (const name of names) {
    if (name.startsWith(DEPT_LABEL_PREFIX)) {
      const token = name.slice(DEPT_LABEL_PREFIX.length).trim();
      if (token in WORK_TYPE_ALIASES) return WORK_TYPE_ALIASES[token];
    }
  }
  for (const name of names) {
    if (name in WORK_TYPE_ALIASES) return WORK_TYPE_ALIASES[name];
  }
  return null;
}

/** The routing target for a work type, or null when untagged. */
export function routeFor(workType: WorkTypeTag | null): WorkTypeRoute | null {
  return workType ? ROUTES[workType] : null;
}

/**
 * Four-input tier. Importance, urgency, and money are VALUE (pull the tier up);
 * time is EFFORT (pulls it down), so the score rewards high-value quick wins and
 * penalizes heavy lifts. Each input is 1..5; we invert time as `6 - time` so all
 * four terms read "more is better", giving a 4..20 band:
 *
 *   >=18 S · >=15 A · >=12 B · >=9 C · >=6 D · else F
 *
 * The S band stays narrow (needs near-max value at low effort) per the Thiel
 * doctrine already encoded in {@link tierFor}.
 */
export function tierForFour(
  importanceStars: number,
  urgencyStars: number,
  timeStars: number,
  moneyStars: number,
): ScoreboardTier {
  const score = importanceStars + urgencyStars + moneyStars + (6 - timeStars);
  if (score >= 18) return "S";
  if (score >= 15) return "A";
  if (score >= 12) return "B";
  if (score >= 9) return "C";
  if (score >= 6) return "D";
  return "F";
}

/** One inbox item's full four-input score, tier, tag, and route — all derived. */
export interface InboxScore {
  importanceStars: number;
  urgencyStars: number;
  timeStars: number;
  moneyStars: number;
  tier: ScoreboardTier;
  /** Ordering weight: value up, effort down (matches {@link tierForFour}). */
  score: number;
  workType: WorkTypeTag | null;
  route: WorkTypeRoute | null;
}

/** Derive the complete four-input Inbox score for one issue. */
export function deriveInboxScore(issue: Issue): InboxScore {
  const importanceStars = importanceStarsFor(issue.priority);
  const urgencyStars = urgencyStarsFor(issue);
  const timeStars = timeInvolvedStarsFor(issue);
  const moneyStars = moneyInvolvedStarsFor(issue);
  const workType = workTypeTagFor(issue);
  return {
    importanceStars,
    urgencyStars,
    timeStars,
    moneyStars,
    tier: tierForFour(importanceStars, urgencyStars, timeStars, moneyStars),
    score: importanceStars + urgencyStars + moneyStars + (6 - timeStars),
    workType,
    route: routeFor(workType),
  };
}

/** Tier rank for ordering — S is highest (0), F lowest. */
const TIER_RANK: Record<ScoreboardTier, number> = { S: 0, A: 1, B: 2, C: 3, D: 4, F: 5 };

export function tierRank(tier: ScoreboardTier): number {
  return TIER_RANK[tier];
}

/**
 * Rank inbox issues by tier first, then by four-input score descending, then by
 * title — the "rank-ordered in S-F tiers" the board asked for. Pure and stable.
 */
export function sortIssuesByInboxScore(issues: Issue[]): Issue[] {
  return [...issues]
    .map((issue) => ({ issue, s: deriveInboxScore(issue) }))
    .sort((a, b) => {
      const tierDelta = tierRank(a.s.tier) - tierRank(b.s.tier);
      if (tierDelta !== 0) return tierDelta;
      if (a.s.score !== b.s.score) return b.s.score - a.s.score;
      return a.issue.title.localeCompare(b.issue.title);
    })
    .map((entry) => entry.issue);
}

/* ------------------------------------------------------------------------- *
 * SUM-229 — win-condition progress for the Factory Floor dish cards.
 *
 * The board's rule: every dish shows a PROGRESS BAR toward its WIN CONDITION,
 * and progress must be EARNED, never vibes. Two honest sources, in order:
 *
 *   1. A declared win condition — a markdown task list ("- [ ]" / "- [x]") the
 *      agent writes into the issue description or plan and checks off as each
 *      acceptance criterion is met. Progress = criteria checked / total. This is
 *      the real signal and needs no schema change: the checkboxes already live
 *      in text the agent edits as it works.
 *   2. Where no checklist exists yet, a COARSE ladder from lifecycle state alone
 *      (the board's numbers): queued 5, assigned 15, cooking 55, plated 90,
 *      done 100 — and a blocked dish shows its blocker instead of a bar.
 *
 * Pure, so the parser and the ladder unit-test without React.
 * ------------------------------------------------------------------------- */

/** One acceptance criterion parsed from a markdown task list. */
export interface WinConditionItem {
  text: string;
  checked: boolean;
}

/** Matches a GitHub-style task line: "- [ ] do a thing" / "* [x] done". */
const TASK_ITEM_RE = /^[ \t]*[-*][ \t]+\[([ xX])\][ \t]+(.+?)[ \t]*$/;

/**
 * Parse a markdown task list into win-condition items. Only genuine checkbox
 * lines count — prose and plain bullets are ignored, so a stray "-" never reads
 * as an unmet criterion.
 */
export function parseWinConditionItems(text: string | null | undefined): WinConditionItem[] {
  if (!text) return [];
  const items: WinConditionItem[] = [];
  for (const line of text.split(/\r?\n/)) {
    const match = TASK_ITEM_RE.exec(line);
    if (!match) continue;
    items.push({ text: match[2].trim(), checked: match[1].toLowerCase() === "x" });
  }
  return items;
}

export type WinConditionMode = "checklist" | "coarse" | "blocked";

export interface WinConditionProgress {
  mode: WinConditionMode;
  /** 0..100; a real target for checklist/coarse, last-reached stage for blocked. */
  progress: number;
  items: WinConditionItem[];
  checkedCount: number;
  totalCount: number;
  /** "3/5 criteria" for a checklist, else the coarse state name / "Blocked". */
  label: string;
  /** Human blocker line when mode === "blocked", else null. */
  blocker: string | null;
}

/**
 * The board's coarse ladder, used only when a dish has NOT declared a checklist:
 * queued 5 · assigned 15 · cooking 55 · plated 90 · done 100. "Cooking" needs a
 * live burner (passed in) — an in-progress dish with no live run is only
 * "assigned", so the bar never overstates a stalled ticket.
 */
export function coarseDishProgress(
  issue: Pick<Issue, "status" | "assigneeAgentId">,
  cooking: boolean,
): { progress: number; label: string } {
  switch (issue.status) {
    case "done":
      return { progress: 100, label: "Done" };
    case "in_review":
      return { progress: 90, label: "Plated" };
    case "cancelled":
      return { progress: 0, label: "Cancelled" };
    case "in_progress":
      return cooking
        ? { progress: 55, label: "Cooking" }
        : { progress: 15, label: "Assigned" };
    default:
      return issue.assigneeAgentId
        ? { progress: 15, label: "Assigned" }
        : { progress: 5, label: "Queued" };
  }
}

/** Short, human blocker lines from the inbox-attention reason codes. */
const BLOCKED_REASON_LABEL: Record<string, string> = {
  blocked_by_unassigned_issue: "Waiting on an unassigned blocker",
  blocked_by_assigned_backlog_issue: "Blocker still in backlog",
  blocked_by_uninvokable_assignee: "Blocker's assignee can't run",
  blocked_by_cancelled_issue: "Blocked by a cancelled issue",
  blocked_chain_stalled: "Blocker chain stalled",
  invalid_review_participant: "Review has no valid participant",
  in_review_without_action_path: "In review with no action path",
  missing_successful_run_disposition: "Run finished, needs disposition",
  pending_board_decision: "Awaiting a board decision",
  pending_user_decision: "Awaiting a user decision",
  external_owner_action: "Waiting on an external owner",
  open_recovery_issue: "Open recovery issue",
};

/**
 * The most specific blocker line available: the inbox-attention action (with its
 * owner) when the engine computed one, else a humanized reason code, else a
 * plain "Blocked". Never invents detail the payload doesn't carry.
 */
export function dishBlockerText(issue: Pick<Issue, "blockedInboxAttention">): string {
  const att = issue.blockedInboxAttention;
  if (!att) return "Blocked";
  const action = att.action?.label?.trim();
  if (action) {
    const owner = att.owner?.label?.trim();
    return owner ? `${action} · ${owner}` : action;
  }
  return BLOCKED_REASON_LABEL[att.reason] ?? "Blocked";
}

/**
 * Resolve a dish's win-condition progress. Blocked dishes short-circuit to the
 * blocker. Otherwise a declared checklist (>= 2 criteria, matching the board's
 * "2-6 items") wins and progress is the checked fraction; a done dish reads 100
 * even mid-checklist. With no checklist we fall back to the coarse ladder.
 *
 * `extraText` lets the detail drawer fold the plan document in alongside the
 * description; a card passes only the description it already holds.
 */
export function deriveWinCondition(
  issue: Pick<Issue, "status" | "description" | "assigneeAgentId" | "blockedInboxAttention">,
  opts: { cooking: boolean; extraText?: string | null } = { cooking: false },
): WinConditionProgress {
  if (issue.status === "blocked") {
    return {
      mode: "blocked",
      progress: 25,
      items: [],
      checkedCount: 0,
      totalCount: 0,
      label: "Blocked",
      blocker: dishBlockerText(issue),
    };
  }

  const source = [issue.description, opts.extraText].filter(Boolean).join("\n\n");
  const items = parseWinConditionItems(source);
  if (items.length >= 2) {
    const checkedCount = items.filter((i) => i.checked).length;
    const progress =
      issue.status === "done" ? 100 : Math.round((checkedCount / items.length) * 100);
    return {
      mode: "checklist",
      progress,
      items,
      checkedCount,
      totalCount: items.length,
      label: `${checkedCount}/${items.length} criteria`,
      blocker: null,
    };
  }

  const coarse = coarseDishProgress(issue, opts.cooking);
  return {
    mode: "coarse",
    progress: coarse.progress,
    items: [],
    checkedCount: 0,
    totalCount: 0,
    label: coarse.label,
    blocker: null,
  };
}
