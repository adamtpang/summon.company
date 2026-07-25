/**
 * Pure attention-cadence classification (VIT-44, clawsweeper cadence tiers).
 *
 * Clean-room reimplementation of the OpenClaw/clawsweeper "attention is
 * budgeted, not uniform" model (doc/research/OPENCLAW-LEARNINGS.md 2.1): every
 * work item lands in one of three cadence tiers that decide how often a
 * heartbeat should look at it.
 *
 *   hot    -> hourly   (actively worked, or holds an unresolved alert)
 *   recent -> daily    (touched within the last 30 days)
 *   stale  -> weekly   (older / inactive)
 *
 * The tier is derived from the item's age and an `isHot` signal, but an
 * explicit operator/board `override` always wins so a tier is both visible
 * (returned on every item) and configurable (per-item override). This module
 * holds only the deterministic decision; the runtime scheduler and the board
 * feed consume it. No clocks, no I/O -- callers pass `now`.
 */

export type AttentionCadenceTier = "hot" | "recent" | "stale";

/** Why a tier was chosen, for inspectability in the feed / task records. */
export type AttentionCadenceSource = "override" | "hot_signal" | "age";

export interface AttentionCadence {
  tier: AttentionCadenceTier;
  /** scheduling interval for the tier, in seconds */
  intervalSec: number;
  /** reader-facing label, e.g. "Hourly (hot)" */
  label: string;
  /** what decided the tier */
  source: AttentionCadenceSource;
}

export const CADENCE_HOT_INTERVAL_SEC = 3_600; // 1 hour
export const CADENCE_RECENT_INTERVAL_SEC = 86_400; // 24 hours
export const CADENCE_STALE_INTERVAL_SEC = 604_800; // 7 days

/** clawsweeper boundary: items touched within 30 days get daily attention. */
export const CADENCE_RECENT_MAX_AGE_DAYS = 30;

const DAY_MS = 86_400_000;

const CADENCE_TIERS: readonly AttentionCadenceTier[] = ["hot", "recent", "stale"];

const INTERVAL_BY_TIER: Record<AttentionCadenceTier, number> = {
  hot: CADENCE_HOT_INTERVAL_SEC,
  recent: CADENCE_RECENT_INTERVAL_SEC,
  stale: CADENCE_STALE_INTERVAL_SEC,
};

const LABEL_BY_TIER: Record<AttentionCadenceTier, string> = {
  hot: "Hourly (hot)",
  recent: "Daily (recent)",
  stale: "Weekly (stale)",
};

export interface WorkItemCadenceInput {
  /** reference time; callers pass their own clock so this stays pure */
  now: Date | string | number;
  /** last time the item saw activity; falls back to createdAt when absent */
  lastActivityAt?: Date | string | number | null;
  createdAt?: Date | string | number | null;
  /**
   * true when the item is actively being worked or carries an unresolved
   * alert. A hot signal pins the item to the hourly tier regardless of age.
   */
  isHot?: boolean;
  /** explicit operator/board override; wins over any derived tier */
  override?: AttentionCadenceTier | null | undefined;
}

function toMs(value: Date | string | number | null | undefined): number | null {
  if (value == null) return null;
  const ms = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
}

/** Narrows an arbitrary value (config/API input) to a valid tier or null. */
export function parseCadenceTier(value: unknown): AttentionCadenceTier | null {
  return typeof value === "string" && (CADENCE_TIERS as readonly string[]).includes(value)
    ? (value as AttentionCadenceTier)
    : null;
}

export function cadenceIntervalSec(tier: AttentionCadenceTier): number {
  return INTERVAL_BY_TIER[tier];
}

export function cadenceLabel(tier: AttentionCadenceTier): string {
  return LABEL_BY_TIER[tier];
}

function cadenceForTier(tier: AttentionCadenceTier, source: AttentionCadenceSource): AttentionCadence {
  return { tier, intervalSec: INTERVAL_BY_TIER[tier], label: LABEL_BY_TIER[tier], source };
}

/**
 * Resolves a work item's cadence tier. Precedence:
 *   1. a valid explicit `override`            -> that tier    (source "override")
 *   2. an `isHot` signal                       -> hot          (source "hot_signal")
 *   3. age of lastActivityAt (else createdAt)  -> recent/stale (source "age")
 *
 * With no usable timestamp and no hot signal the item defaults to `recent`, so
 * an item never silently drops to weekly attention just because its activity
 * time is missing.
 */
export function resolveWorkItemCadence(input: WorkItemCadenceInput): AttentionCadence {
  const override = parseCadenceTier(input.override);
  if (override) return cadenceForTier(override, "override");

  if (input.isHot) return cadenceForTier("hot", "hot_signal");

  const nowMs = toMs(input.now);
  const activityMs = toMs(input.lastActivityAt) ?? toMs(input.createdAt);
  if (nowMs == null || activityMs == null) return cadenceForTier("recent", "age");

  const ageDays = Math.max(0, nowMs - activityMs) / DAY_MS;
  const tier: AttentionCadenceTier = ageDays <= CADENCE_RECENT_MAX_AGE_DAYS ? "recent" : "stale";
  return cadenceForTier(tier, "age");
}
