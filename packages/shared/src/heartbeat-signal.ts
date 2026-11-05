import { extractFencedBlock } from "./outcome-receipt.js";
import type { AttentionSeverity } from "./types/attention.js";

/**
 * Heartbeat signal — the convention a HEARTBEAT turn uses to tell the runtime
 * whether it found nothing (OK, stays silent) or found a board-worthy problem
 * (alert, surfaces on the feed). VIT-44 criterion 2 (SUM-231).
 *
 * A HEARTBEAT turn runs a checklist and, by construction, an OK turn produces
 * NO attention row. The gap this closes: an OK-*completing* turn that FINDS a
 * problem had no first-class path to raise the board. This module is the single
 * source of truth for classifying a heartbeat turn's FINAL OUTPUT TEXT into
 * exactly one of:
 *   - ok:      an explicit `HEARTBEAT_OK` marker → recognized, silent, no attention.
 *   - alert:   a fenced ```heartbeat-alert JSON block → one evidence-backed board alert.
 *   - none:    neither convention present → unclassified (silent; not an alert).
 *   - invalid: an alert block was present but malformed → reject loudly, do NOT emit.
 *
 * No I/O; trivially unit-testable and shared by the runtime emit path
 * (server/src/services/heartbeat.ts) and the attention reader
 * (server/src/services/attention.ts).
 */

/** Board-alert severities a heartbeat turn may request, defaulting to `high`. */
const HEARTBEAT_ALERT_SEVERITIES: readonly AttentionSeverity[] = [
  "critical",
  "high",
  "medium",
  "low",
];

/** An OK-completing turn that finds a problem is board-worthy by default. */
export const DEFAULT_HEARTBEAT_ALERT_SEVERITY: AttentionSeverity = "high";

/**
 * The activity-log action a heartbeat alert is written under (mirrors the
 * model-failover board-alert pattern the attention feed already reads). A single
 * source of truth so the emit path and the reader can never drift.
 */
export const HEARTBEAT_ALERT_ACTIVITY_ACTION = "heartbeat.alert";

/** The audit action recorded when a turn is recognized OK. Silent on the board. */
export const HEARTBEAT_OK_ACTIVITY_ACTION = "heartbeat.ok";

export interface HeartbeatAlert {
  /** One-line board headline for the finding. Required, non-empty. */
  title: string;
  /** The concrete evidence + where to look. Required, non-empty. */
  evidence: string;
  /** Requested severity; defaults to `high` when omitted. */
  severity: AttentionSeverity;
}

export type HeartbeatSignal =
  /** Explicit `HEARTBEAT_OK` marker — recognized OK, stays silent. */
  | { kind: "ok" }
  /** A valid, evidence-backed alert to surface on the board feed. */
  | { kind: "alert"; alert: HeartbeatAlert }
  /** Neither convention present. Silent — an unclassified turn is not an alert. */
  | { kind: "none" }
  /** An alert block was present but failed validation — reject it loudly. */
  | { kind: "invalid"; error: string };

// `HEARTBEAT_OK` as a standalone token — not a substring of a longer identifier
// (so `HEARTBEAT_OKAY` or `MY_HEARTBEAT_OKISH` never counts as OK).
const OK_MARKER = /(?<![A-Za-z0-9_])HEARTBEAT_OK(?![A-Za-z0-9_])/;

function readNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Classify a heartbeat turn's final output text. A valid alert block always
 * wins over an OK marker: finding a problem is never silent, even if the turn
 * also declared OK. A malformed alert block is `invalid` (the runtime logs it
 * and emits nothing) rather than silently dropping a real finding as `none`.
 */
export function parseHeartbeatSignal(text: string | null | undefined): HeartbeatSignal {
  if (!text) return { kind: "none" };

  const block = extractFencedBlock(text, "heartbeat-alert");
  if (block !== null) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(block);
    } catch (err) {
      return { kind: "invalid", error: `heartbeat-alert block is not valid JSON: ${(err as Error).message}` };
    }
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return { kind: "invalid", error: "heartbeat-alert block must be a JSON object" };
    }
    const root = parsed as Record<string, unknown>;

    const title = readNonEmptyString(root.title);
    if (!title) return { kind: "invalid", error: "heartbeat-alert requires a non-empty title" };

    const evidence = readNonEmptyString(root.evidence);
    if (!evidence) {
      return { kind: "invalid", error: "heartbeat-alert requires non-empty evidence — an alert must be evidence-backed" };
    }

    let severity: AttentionSeverity = DEFAULT_HEARTBEAT_ALERT_SEVERITY;
    if (root.severity !== undefined && root.severity !== null) {
      if (!HEARTBEAT_ALERT_SEVERITIES.includes(root.severity as AttentionSeverity)) {
        return {
          kind: "invalid",
          error: `heartbeat-alert severity must be one of ${HEARTBEAT_ALERT_SEVERITIES.join(" | ")}`,
        };
      }
      severity = root.severity as AttentionSeverity;
    }

    return { kind: "alert", alert: { title, evidence, severity } };
  }

  if (OK_MARKER.test(text)) return { kind: "ok" };

  return { kind: "none" };
}
