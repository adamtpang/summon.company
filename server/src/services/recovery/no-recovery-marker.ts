// SUM-173 (SUM-144 D2): durable "no-recovery" provenance marker.
//
// A board/user cancel is TERMINAL. Without this marker the recovery reconciler
// treats every unsuccessful terminal run status as recoverable and may
// re-dispatch the same work to another agent (the "hydra"). Board/user cancels
// stamp this durable marker onto the run's resultJson; recovery reads it,
// SKIPS, and LOGS instead of re-dispatching. Agent/system cancels do NOT carry
// the marker and keep today's recovery behaviour.
//
// Self-contained on purpose (no db / drizzle imports) so it can be imported from
// heartbeat, recovery, and scratch harnesses without booting the server.

export const NO_RECOVERY_RESULT_KEY = "recoverySuppressed";

/** Actor provenance that makes a cancel terminal (no auto-recovery). */
export const NO_RECOVERY_CANCEL_ACTOR_TYPES = new Set(["user", "board"]);

function parseResultJson(value: unknown): Record<string, unknown> {
  if (!value) return {};
  if (typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {};
    } catch {
      return {};
    }
  }
  return {};
}

export type NoRecoveryMarker = {
  reason: string;
  actorType: string | null;
  actorId: string | null;
};

export type BuildNoRecoveryMarkerInput = {
  reason?: string | null;
  actorType?: string | null;
  actorId?: string | null;
};

/** Build the resultJson fragment that marks a run as non-recoverable. */
export function buildNoRecoveryMarker(
  input: BuildNoRecoveryMarkerInput = {},
): Record<string, NoRecoveryMarker & { suppressed: true }> {
  return {
    [NO_RECOVERY_RESULT_KEY]: {
      suppressed: true,
      reason: input.reason ?? "board_cancel",
      actorType: input.actorType ?? null,
      actorId: input.actorId ?? null,
    },
  };
}

/** Read the marker off a run row (expects `run.resultJson`). */
export function readNoRecoveryMarker(
  run: { resultJson?: unknown } | null | undefined,
): NoRecoveryMarker | null {
  if (!run) return null;
  const marker = parseResultJson(run.resultJson)[NO_RECOVERY_RESULT_KEY];
  if (marker && typeof marker === "object" && !Array.isArray(marker)) {
    const record = marker as Record<string, unknown>;
    if (record.suppressed === true) {
      return {
        reason: typeof record.reason === "string" ? record.reason : "board_cancel",
        actorType: typeof record.actorType === "string" ? record.actorType : null,
        actorId: typeof record.actorId === "string" ? record.actorId : null,
      };
    }
  }
  return null;
}

/** True when a cancel actor type should suppress automatic recovery. */
export function isNoRecoveryCancelActor(actorType: unknown): boolean {
  return NO_RECOVERY_CANCEL_ACTOR_TYPES.has(String(actorType || ""));
}
