# VIT-40 — Conversation continuity (thread transcript + CLAUDE.md context)

Status: implementation. Owner: Vitals Engineer.
Last updated: 2026-07-16.

## TL;DR

Talking to an employee should feel continuous — reopen a chat days later, ask
"what did we decide about X", and the agent answers from the thread, not from
zero. This doc records what the engine already guarantees, and the additive
Vitals slice that closes the last gap: making resume **observable** in the UI.

Finding, with evidence below:

1. **Thread → session binding — already implemented** in the Paperclip engine.
   A durable session is bound per conversation thread (issue/agent chat) via the
   `agentTaskSessions` table, keyed on the task/issue, not merely the agent's
   last run.
2. **Context re-injection on resume — already implemented.** On every resumed
   turn the adapter injects a "Resume Delta" (the wake payload + the thread's
   session-handoff + task markdown). The standing instruction bundle
   (AGENTS.md / CLAUDE.md) rides the resumed session cache; on any fallback to a
   fresh session it is deliberately re-materialized.
3. **Graceful fallback — already implemented and tested.** Invalid UUID, cwd
   mismatch, prompt-bundle change, poisoned transcript → fall back to a fresh
   session with a one-line reason and rebuilt instructions.
4. **Observable in the UI — the genuine gap, now closed additively.** A subtle
   "Resumed · N earlier messages in this conversation" marker renders at the run
   boundary in the chat thread. Nothing is ever silently dropped.

## Evidence — the engine already carries the transcript + context

### 1. Thread → session binding (`agentTaskSessions`)

- `server/src/services/heartbeat.ts` — `getTaskSession(companyId, agentId, adapterType, taskKey)`
  loads the session row bound to a conversation thread; `taskKey` derives from
  the issue/thread id (`deriveTaskKey` → `contextSnapshot.issueId` / `taskId`).
- Timer/heartbeat wakes with no issue get a stable synthetic key
  (`HEARTBEAT_TASK_KEY = "__heartbeat__"`) so they too participate in durable
  resume rather than the weaker `agentRuntimeState.sessionId` fallback.
- `buildExplicitResumeSessionOverride(...)` reconciles the task-session row with
  an explicit `resumeFromRunId`, preferring the thread's own bound session.

So opening a thread resumes **that thread's** Claude/Codex session. This is
upstream Paperclip infrastructure; Vitals preserves it (`@paperclipai/*`,
protocol, DB names untouched).

### 2. Context re-injection on resume (`claude-local` adapter)

- `packages/adapters/claude-local/src/server/execute.ts:643-716`:
  - `canResumeSession` guards resume on a valid UUID, matching cwd, matching
    prompt-bundle key, and matching remote-execution identity.
  - On resume it builds a **Resume Delta** prompt via
    `renderPaperclipWakePrompt(context.paperclipWake, { resumedSession: true })`
    and appends `paperclipSessionHandoffMarkdown` + `paperclipTaskMarkdown` —
    i.e. the thread's own history and task context, re-injected every turn.
- `packages/adapter-utils/src/server-utils.ts:1264-1396`
  (`renderPaperclipWakePrompt`): on a resumed session it emits a
  `## Paperclip Resume Delta` block and **includes the execution contract**
  (which the fresh-session template would otherwise carry).
- Instruction bundle (AGENTS.md / CLAUDE.md): `execute.ts:754-758` intentionally
  omits `--append-system-prompt-file` on a resumed session because those
  instructions are already in the resumed session cache — re-sending them wastes
  5–10K tokens/turn and the CLI may reject the combination. On any fallback to a
  fresh session the combined instructions file is rebuilt (see test below).

### 3. Graceful fallback + one-line reason

`execute.ts:662-699` logs a precise, human-readable reason and starts fresh for
each guard case: non-UUID session id, remote-identity mismatch, cwd mismatch,
prompt-bundle change. Poisoned `previous_message_id` transcripts force a
`clearSession` so the next turn does not re-resume a known-bad transcript
(`claude-local-execute.test.ts:229-231`).

### Existing engine test coverage (acceptance's "tests for…")

`server/src/__tests__/claude-local-execute.test.ts`:

- `passes --append-system-prompt-file on a fresh session …` — fresh-session
  context injection.
- `omits --append-system-prompt-file on a resumed session …` — resume reuses
  cached instructions (asserts `--resume` present).
- `rebuilds the combined instructions file when an unknown resumed session falls
  back to fresh` — **graceful fallback re-injects context** (asserts first
  attempt has `--resume`, retry does not).
- `allows remote session resumes when saved cwd is the host workspace`,
  `reuses a stable Paperclip-managed Claude prompt bundle across equivalent
  runs` — binding stability.
- `forces clearSession when the recovery retry also reports a poisoned
  previous_message_id` — poisoned-transcript recovery.

`server/src/__tests__/heartbeat-workspace-session.test.ts` covers workspace/cwd
guards that gate resume.

> Note: these fixtures spawn a fake `claude` shell script and do not execute on
> Windows dev checkouts ("Failed to start command … \bin\claude"); they are the
> spec/evidence and run green in the engine's Linux CI. This is an environment
> limitation of the local box, not a logic failure.

## The additive Vitals slice — make resume observable (this change)

New, self-contained, token-gated, additive files (no engine/protocol changes):

- `ui/src/lib/resume-affordance.ts` — pure helper. `deriveResumeAffordances()`
  maps each run to `{ resumed, priorMessageCount, label }` from the thread's own
  message list (data the chat surface already holds — no new server plumbing,
  cannot drift from what the user sees). The **first** run of a thread is never
  "resumed" (a fresh chat shows nothing, even behind a user opener); a later run
  is resumed and reports how many prior conversational turns it carries. System
  notices are excluded from the count. `resumeAffordanceForRun()` is a graceful
  single-run lookup (null for missing/unknown/empty runId).
- `ui/src/components/ResumeAffordanceNotice.tsx` — a quiet, centered divider row
  ("⟲ Resumed · N earlier messages in this conversation"), `role="note"`, muted
  tokens only. Renders nothing unless `resumed && label`.
- Wiring in `ui/src/components/IssueChatThread.tsx`: `resumeNoticeByMessageId`
  memo maps the first message id of each resumed run to its affordance; the
  non-virtualized message map renders the notice above that row.

### Tests (this change)

- `ui/src/lib/resume-affordance.test.ts` — 12 tests: empty thread, fresh first
  run, no-predecessor run, resumed later run with count, system-notice
  exclusion, defensive time-ordering, single-run lookup, graceful missing/empty
  runId, label pluralization.
- `ui/src/components/ResumeAffordanceNotice.test.tsx` — 3 tests: renders label
  when resumed; renders nothing when not resumed or label empty.
- Regression: `ui/src/components/IssueChatThread.test.tsx` includes 73 tests,
  including a direct long-thread assertion for the virtualized resume marker.
- UI typecheck adds zero errors (one pre-existing unrelated error in
  `src/lib/issue-age.test.ts`).

## Before / after (acceptance evidence)

- **Before:** reopen a chat with prior history and send a new message → the
  agent's reply appears with no indication that it resumed prior context; a
  fallback-to-fresh was silent to the user.
- **After:** the same reopened chat shows a subtle
  "Resumed · N earlier messages in this conversation" marker at the boundary
  where the new run picks up the thread. The engine already answered from the
  thread (sections 1–2); the UI now makes that continuity legible instead of
  silent.

## Remaining live proof

- **Virtualized thread path is now covered**: threads at/above
  `VIRTUALIZED_THREAD_ROW_THRESHOLD` pass `resumeNoticeByMessageId` into each
  measured row and render the same marker as the direct path.
- **Codex adapter parity**: the same Resume Delta pattern exists in
  `packages/adapters/codex-local/src/server/execute.ts`; the UI affordance is
  adapter-agnostic (derived from thread messages) and already covers it.
- **48-hour desktop canary**: reopen one packaged Claude thread and one packaged
  Codex thread after 48 hours, ask for a prior decision without re-briefing, and
  record the answer plus marker in each thread. This is required before calling
  G2 100%.
