import { and, eq, gte, inArray } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { activityLog } from "@paperclipai/db";
import {
  HEARTBEAT_ALERT_ACTIVITY_ACTION,
  parseCadenceTier,
  resolveWorkItemCadence,
  type AttentionCadence,
} from "@paperclipai/shared";

/**
 * Issue attention-cadence wiring (VIT-44 §4). The deterministic tier decision
 * lives in `resolveWorkItemCadence` (packages/shared); this module maps an issue
 * row + live signals onto that decision and surfaces the resolved
 * {@link AttentionCadence} on every issue read so the tier is both visible
 * (returned by the existing API) and configurable (per-item `cadenceOverride`,
 * which always wins).
 *
 * The `isHot` signal — pins an item to the hourly tier — is an active run or an
 * unresolved heartbeat alert. An active run is known from the issue's execution
 * run; the heartbeat-alert half is a `heartbeat.alert` activity row (VIT-44 §2,
 * SUM-231) emitted within the alert window and not yet aged out.
 */

/** A `heartbeat.alert` within this window keeps an issue on the hot tier. */
export const ISSUE_HEARTBEAT_ALERT_HOT_WINDOW_MS = 7 * 86_400_000;

/** Minimal issue shape the cadence resolver needs. */
export interface IssueCadenceRow {
  cadenceOverride: string | null;
  createdAt: Date | string | number | null;
  updatedAt: Date | string | number | null;
  lastActivityAt?: Date | string | number | null;
}

/**
 * Resolve one issue's attention cadence. `lastActivityAt` falls back to
 * `updatedAt`; `isHot` is the caller-supplied active-run-or-unresolved-alert
 * signal. A valid `cadenceOverride` always wins (see `resolveWorkItemCadence`).
 */
export function resolveIssueCadence(
  row: IssueCadenceRow,
  opts: { now: Date | number; isHot: boolean },
): AttentionCadence {
  return resolveWorkItemCadence({
    now: opts.now,
    lastActivityAt: row.lastActivityAt ?? row.updatedAt,
    createdAt: row.createdAt,
    isHot: opts.isHot,
    override: parseCadenceTier(row.cadenceOverride),
  });
}

/**
 * Issue ids carrying an unresolved heartbeat alert: a board-visible
 * `heartbeat.alert` activity row logged against the issue within the hot
 * window. One grouped, index-backed query so it batches over a whole feed page.
 */
export async function issueHeartbeatAlertHotSet(
  db: Db,
  companyId: string,
  issueIds: string[],
  now: Date | number,
): Promise<Set<string>> {
  if (issueIds.length === 0) return new Set<string>();
  const nowMs = typeof now === "number" ? now : now.getTime();
  const since = new Date(nowMs - ISSUE_HEARTBEAT_ALERT_HOT_WINDOW_MS);
  const rows = await db
    .select({ issueId: activityLog.entityId })
    .from(activityLog)
    .where(and(
      eq(activityLog.companyId, companyId),
      eq(activityLog.action, HEARTBEAT_ALERT_ACTIVITY_ACTION),
      eq(activityLog.entityType, "issue"),
      inArray(activityLog.entityId, [...new Set(issueIds)]),
      gte(activityLog.createdAt, since),
    ));
  return new Set(rows.map((row) => row.issueId));
}
