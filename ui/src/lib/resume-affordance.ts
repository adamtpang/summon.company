// VIT-40 — Conversation continuity: make session resume observable in the UI.
//
// The Paperclip engine already binds a durable session per conversation thread
// (agentTaskSessions, keyed on the issue/task) and re-injects the standing
// context bundle as a "Resume Delta" on every turn. What was missing was a
// subtle, truthful affordance so a reopened chat never *silently* resumes.
//
// This module derives that affordance purely from the thread's own message
// list — data the chat surface already has — so it needs no new server plumbing
// and cannot drift from what the user actually sees. When an agent run produces
// its first message in a thread that already carried earlier conversational
// turns, that run resumed with prior context; we surface "Resumed · N earlier
// messages in this conversation" at that run boundary.

/**
 * Minimal structural view of a thread message. Kept decoupled from
 * `@assistant-ui/react`'s `ThreadMessage` so this stays a pure, trivially
 * testable function. Callers map their message objects into this shape.
 */
export interface ResumeAffordanceMessage {
  /** Conversational role. "system" notices are excluded from the prior-turn count. */
  role: "user" | "assistant" | "system";
  /** The heartbeat run that produced this message, or null for user/system rows. */
  runId: string | null;
  /** Creation time in epoch milliseconds. */
  createdAtMs: number;
}

export interface ResumeAffordance {
  /** The run whose first message opens a resumed segment of the conversation. */
  runId: string;
  /** True when earlier conversational turns preceded this run. */
  resumed: boolean;
  /** Count of prior user/assistant turns the resumed run carries as context. */
  priorMessageCount: number;
  /** Ready-to-render, human label; empty when not resumed. */
  label: string;
}

function isConversationalTurn(message: ResumeAffordanceMessage): boolean {
  return message.role === "user" || message.role === "assistant";
}

/**
 * Build the resume label for a given prior-turn count. Exported for reuse in
 * tests and any surface that renders the affordance directly.
 */
export function formatResumeAffordanceLabel(priorMessageCount: number): string {
  if (priorMessageCount <= 0) return "";
  const noun = priorMessageCount === 1 ? "message" : "messages";
  return `Resumed · ${priorMessageCount} earlier ${noun} in this conversation`;
}

/**
 * Compute, for every run present in `messages`, whether that run resumed an
 * existing conversation and how many prior conversational turns it carried.
 *
 * A run is a "resume boundary" when its earliest message is preceded (strictly
 * earlier in time) by at least one user/assistant turn. The very first run in a
 * thread is never a resume (`resumed: false`, no label), so a genuinely fresh
 * chat shows nothing.
 *
 * Input need not be pre-sorted; ordering is computed defensively by
 * `createdAtMs`. Returns a Map keyed by runId so the caller can look up the
 * affordance when it renders the first row of each run.
 */
export function deriveResumeAffordances(
  messages: readonly ResumeAffordanceMessage[],
): Map<string, ResumeAffordance> {
  const affordances = new Map<string, ResumeAffordance>();
  if (messages.length === 0) return affordances;

  // Stable ascending order by time; ties preserve input order.
  const ordered = messages
    .map((message, index) => ({ message, index }))
    .sort((a, b) => {
      const diff = a.message.createdAtMs - b.message.createdAtMs;
      return diff !== 0 ? diff : a.index - b.index;
    })
    .map((entry) => entry.message);

  // Count of conversational turns seen strictly before each run's first
  // message, in arrival order. The earliest run in the thread is the "fresh"
  // one — even though a user opener precedes it, nothing was resumed; only a
  // subsequent run (a new visit / new session turn) resumes prior context.
  const priorTurnsAtRunStart = new Map<string, number>();
  let firstRunId: string | null = null;
  let conversationalTurnsSoFar = 0;

  for (const message of ordered) {
    const runId = message.runId;
    if (runId && !priorTurnsAtRunStart.has(runId)) {
      priorTurnsAtRunStart.set(runId, conversationalTurnsSoFar);
      if (firstRunId === null) firstRunId = runId;
    }
    if (isConversationalTurn(message)) {
      conversationalTurnsSoFar += 1;
    }
  }

  for (const [runId, priorMessageCount] of priorTurnsAtRunStart) {
    const resumed = runId !== firstRunId && priorMessageCount > 0;
    affordances.set(runId, {
      runId,
      resumed,
      priorMessageCount,
      label: resumed ? formatResumeAffordanceLabel(priorMessageCount) : "",
    });
  }

  return affordances;
}

/**
 * Convenience lookup: the resume affordance for a single run, or null when the
 * run is absent or opened a fresh conversation. Graceful by construction — an
 * unknown or empty `runId` yields null rather than throwing.
 */
export function resumeAffordanceForRun(
  messages: readonly ResumeAffordanceMessage[],
  runId: string | null | undefined,
): ResumeAffordance | null {
  if (!runId) return null;
  const affordance = deriveResumeAffordances(messages).get(runId);
  if (!affordance || !affordance.resumed) return null;
  return affordance;
}
