import type { Db } from "@paperclipai/db";
import type { AttentionSeverity } from "@paperclipai/shared";
import {
  DEFAULT_HEARTBEAT_ALERT_SEVERITY,
  HEARTBEAT_ALERT_ACTIVITY_ACTION,
  HEARTBEAT_OK_ACTIVITY_ACTION,
  type HeartbeatSignal,
} from "@paperclipai/shared";
import { logActivity, type LogActivityInput } from "./activity-log.js";
import { logger } from "../middleware/logger.js";

/**
 * Heartbeat alert emit/read plumbing (VIT-44 criterion 2, SUM-231).
 *
 * The runtime classifies a successful heartbeat turn's final output with
 * {@link parseHeartbeatSignal}. An explicit `HEARTBEAT_OK` records a silent
 * `heartbeat.ok` audit row; an evidence-backed ```heartbeat-alert block records
 * a board-visible `heartbeat.alert` row. The attention feed reads only the
 * latter — so OK stays silent while a found problem surfaces exactly once. This
 * module is the single source of truth for the activity-log shape both the emit
 * path (heartbeat.ts) and the reader (attention.ts) agree on.
 */

export interface HeartbeatAlertEmitContext {
  companyId: string;
  agentId: string;
  agentName: string;
  runId: string;
  issueId: string | null;
}

/** Normalized `heartbeat.alert` activity details, or null when malformed. */
export interface HeartbeatAlertDetails {
  title: string;
  severity: AttentionSeverity;
  evidence: string;
  issueId: string | null;
  agentId: string | null;
  agentName: string | null;
}

const SEVERITIES: readonly AttentionSeverity[] = ["critical", "high", "medium", "low"];

function readNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Pure: map a classified signal to the activity to log, or null to stay silent.
 * `alert` → a board-visible `heartbeat.alert`; `ok` → a silent `heartbeat.ok`
 * audit row (the feed ignores it); `none`/`invalid` → nothing.
 */
export function heartbeatSignalActivity(
  signal: HeartbeatSignal,
  ctx: HeartbeatAlertEmitContext,
): LogActivityInput | null {
  const entity = ctx.issueId
    ? { entityType: "issue", entityId: ctx.issueId }
    : { entityType: "agent", entityId: ctx.agentId };
  const base = {
    companyId: ctx.companyId,
    actorType: "agent" as const,
    actorId: ctx.agentId,
    agentId: ctx.agentId,
    runId: ctx.runId,
    ...entity,
  };

  if (signal.kind === "alert") {
    return {
      ...base,
      action: HEARTBEAT_ALERT_ACTIVITY_ACTION,
      details: {
        agentId: ctx.agentId,
        agentName: ctx.agentName,
        issueId: ctx.issueId,
        title: signal.alert.title,
        severity: signal.alert.severity,
        evidence: signal.alert.evidence,
      },
    };
  }
  if (signal.kind === "ok") {
    return {
      ...base,
      action: HEARTBEAT_OK_ACTIVITY_ACTION,
      details: { agentId: ctx.agentId, agentName: ctx.agentName, issueId: ctx.issueId },
    };
  }
  return null;
}

/** Emit the classified signal: log the alert/ok activity, warn on invalid. */
export async function emitHeartbeatSignalActivity(
  db: Db,
  signal: HeartbeatSignal,
  ctx: HeartbeatAlertEmitContext,
): Promise<void> {
  if (signal.kind === "invalid") {
    logger.warn(
      { runId: ctx.runId, agentId: ctx.agentId, error: signal.error },
      "heartbeat-alert block rejected; no board alert emitted",
    );
    return;
  }
  const activity = heartbeatSignalActivity(signal, ctx);
  if (activity) await logActivity(db, activity);
}

/** Read a `heartbeat.alert` activity row's details into a normalized shape. */
export function readHeartbeatAlertDetails(details: unknown): HeartbeatAlertDetails | null {
  if (!details || typeof details !== "object" || Array.isArray(details)) return null;
  const record = details as Record<string, unknown>;
  const title = readNonEmptyString(record.title);
  const evidence = readNonEmptyString(record.evidence);
  if (!title || !evidence) return null;
  const rawSeverity = record.severity;
  const severity = SEVERITIES.includes(rawSeverity as AttentionSeverity)
    ? (rawSeverity as AttentionSeverity)
    : DEFAULT_HEARTBEAT_ALERT_SEVERITY;
  return {
    title,
    evidence,
    severity,
    issueId: readNonEmptyString(record.issueId),
    agentId: readNonEmptyString(record.agentId),
    agentName: readNonEmptyString(record.agentName),
  };
}
