import type { Issue } from "@paperclipai/shared";

/**
 * Time-in-state derivation ("if a timeline is long, it's wrong" — the render
 * rule from doc/research/ELON-OPERATING-MODEL.md §3.3). There is no
 * statusChangedAt on Issue, so each status uses the best available anchor:
 * in_progress uses startedAt; review/blocked use updatedAt (a lower bound —
 * any later edit resets it, so we under-escalate, never over-escalate);
 * waiting statuses use createdAt.
 */

export type IssueAgeTier = "calm" | "aging" | "wrong";

export type IssueAgeAnchor = "startedAt" | "updatedAt" | "createdAt";

export interface IssueAgeInfo {
  /** Epoch ms the current state is measured from. */
  anchorMs: number;
  anchor: IssueAgeAnchor;
  ageMs: number;
  tier: IssueAgeTier;
  /** Plain-language state the age applies to, e.g. "working". */
  stateLabel: string;
  /** Compact machine-style rendering, e.g. "3h", "5d". */
  compact: string;
}

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const WEEK_MS = 7 * DAY_MS;

/** Active work (working / in review / blocked) escalates fast. */
export const ACTIVE_AGING_MS = DAY_MS;
export const ACTIVE_WRONG_MS = 3 * DAY_MS;
/** Waiting work (backlog / todo) is allowed to gestate longer. */
export const WAITING_AGING_MS = 7 * DAY_MS;
export const WAITING_WRONG_MS = 14 * DAY_MS;

export function formatAgeCompact(ageMs: number): string {
  const clamped = Math.max(0, ageMs);
  if (clamped < MINUTE_MS) return "<1m";
  if (clamped < HOUR_MS) return `${Math.floor(clamped / MINUTE_MS)}m`;
  if (clamped < DAY_MS) return `${Math.floor(clamped / HOUR_MS)}h`;
  if (clamped < 2 * WEEK_MS) return `${Math.floor(clamped / DAY_MS)}d`;
  return `${Math.floor(clamped / WEEK_MS)}w`;
}

function toMs(value: Date | string | null | undefined): number | null {
  if (!value) return null;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
}

type AgeIssueFields = {
  status: Issue["status"];
  startedAt: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
};

/**
 * Returns null for terminal statuses (done / cancelled) — finished work has
 * no time-in-state pressure.
 */
export function deriveIssueAge(issue: AgeIssueFields, nowMs: number = Date.now()): IssueAgeInfo | null {
  const status = issue.status;
  if (status === "done" || status === "cancelled") return null;

  let anchor: IssueAgeAnchor;
  let anchorMs: number | null;
  let stateLabel: string;
  let agingMs: number;
  let wrongMs: number;

  switch (status) {
    case "in_progress":
      anchorMs = toMs(issue.startedAt);
      anchor = anchorMs !== null ? "startedAt" : "createdAt";
      anchorMs = anchorMs ?? toMs(issue.createdAt);
      stateLabel = "working";
      agingMs = ACTIVE_AGING_MS;
      wrongMs = ACTIVE_WRONG_MS;
      break;
    case "in_review":
    case "blocked": {
      anchorMs = toMs(issue.updatedAt);
      anchor = anchorMs !== null ? "updatedAt" : "createdAt";
      anchorMs = anchorMs ?? toMs(issue.createdAt);
      stateLabel = status === "in_review" ? "in review" : "blocked";
      agingMs = ACTIVE_AGING_MS;
      wrongMs = ACTIVE_WRONG_MS;
      break;
    }
    default:
      anchor = "createdAt";
      anchorMs = toMs(issue.createdAt);
      stateLabel = "waiting";
      agingMs = WAITING_AGING_MS;
      wrongMs = WAITING_WRONG_MS;
      break;
  }

  if (anchorMs === null) return null;

  const ageMs = Math.max(0, nowMs - anchorMs);
  const tier: IssueAgeTier = ageMs >= wrongMs ? "wrong" : ageMs >= agingMs ? "aging" : "calm";

  return {
    anchorMs,
    anchor,
    ageMs,
    tier,
    stateLabel,
    compact: formatAgeCompact(ageMs),
  };
}
