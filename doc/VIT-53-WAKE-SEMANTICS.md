# VIT-53: Comment-wake semantics on terminal issues

Last updated: 2026-07-15 by Vitals CTO.

## The bug

Queued comment wakeups could reopen TERMINAL (`done`/`cancelled`) issues after a
packaged-runtime restart. A wake enqueued while an issue was still open survived the
restart in `agent_wakeup_requests` / queued `heartbeat_runs`; when the runtime came back
up, delivery trusted the issue status from **enqueue time**, so the wake executed against
work that had since closed, and the harness checkout dragged the issue back to
`in_progress`. This is the hazard that forced pausing the Vitals CTO and Design Director
(see `CLAUDE.md`, "Company Zero live state").

Two delivery-time surfaces were leaky:

1. **Queued-run claim gate** (`evaluateQueuedRunStaleness` in
   `server/src/services/heartbeat.ts`): a terminal issue only cancelled the queued run
   when the wake carried *no* comment id — any comment wake bypassed the terminal check.
2. **Deferred-wake promotion** (`releaseIssueExecutionAndPromote`, same file): a deferred
   comment wake authored by any `user` actor reopened a terminal issue at promotion time,
   even without reopen intent. Local-board comments are user-authored, so ordinary board
   conversation resurrected closed work.

## The semantics (now enforced)

- **Wake delivery re-checks issue status at delivery time, never trusts enqueue time.**
- **Comments on terminal issues are recorded conversation, never execution.** A comment
  wake arriving at a `done`/`cancelled` issue is dropped, and the drop is recorded as an
  audit event (`activity_log` action `issue.wake_dropped_terminal`, plus a run lifecycle
  event and the wakeup request marked `skipped` with the drop reason).
- **A deliberate reopen requires the explicit flag.** Delivery proceeds against a
  terminal issue only when the wake carries `wakeReason: "issue_reopened_via_comment"`
  (set by the comment routes when `reopen`/`resume` was requested and allowed) or
  `resumeIntent`/`followUpRequested` context. Mere user authorship is not reopen intent.
- **Mention notifications still deliver, as conversation.** A
  `issue_comment_mentioned` wake (an agent @-mentioned in a comment) is a notification
  to the mentioned agent, not issue execution: it delivers with the issue's current
  (terminal) status and no execution payload, and it cannot reopen the issue. Only
  `issue_commented` follow-up wakes are execution hazards and get dropped.
- Enqueue-time behavior of the comment routes is unchanged (additive fix): a permitted
  reopen still moves the issue to `todo` synchronously at comment time, where the board
  can see it. What changed is that stale queued/deferred wakes can no longer do this
  invisibly after a restart.

## Audit trail for dropped wakes

Dropped wakes are visible in three places:

- `activity_log`: action `issue.wake_dropped_terminal`, entity = the issue, details
  include `currentStatus`, `droppedCommentWake: true`, the comment id(s), and the wakeup
  request id.
- `agent_wakeup_requests.status = "skipped"` with an `error` explaining the drop.
- Queued-run drops also cancel the run with `errorCode: "issue_terminal_status"` and a
  lifecycle run event.

## Regression coverage

`server/src/__tests__/heartbeat-stale-queue-invalidation.test.ts`:

- "drops queued comment wakes when the issue reached a terminal status before delivery
  (restart repro)" — the repro: done issue + queued board comment wake + delivery via
  `resumeQueuedRuns()` (the restart path). Asserts cancel, skip, audit event, issue stays
  `done`, adapter never invoked.
- "still delivers queued comment wakes that carry explicit reopen intent on terminal
  issues" — reopen-flagged wakes still run.
- "drops deferred comment wakes at promotion time when the issue reached a terminal
  status" — user-authored deferred comment wake on a done issue is dropped with audit.
- "still promotes and reopens deferred comment wakes that carry the explicit reopen
  flag" — deliberate reopens still promote and move the issue out of `done`.

`server/src/__tests__/heartbeat-comment-wake-batching.test.ts`:

- "drops deferred comment wakes without explicit reopen intent after the active run
  closes the issue" — a plain board follow-up comment no longer reopens; the deferred
  wake is skipped and no second run is delivered.
- "does not reopen a finished issue when the deferred comment wake is self-authored by
  the closing run" — a run's own closing comment cannot wake it again.
- "does not reopen a finished issue when the deferred comment wake came from another
  agent" — a mention wake to a different agent still delivers (as conversation, with the
  issue shown `done` and no execution payload) and the issue stays `done`.

## Unpause criteria for Vitals CTO and Design Director

The pause existed only because board comments on closed issues could resurrect them
through queued wakes. Unpause both agents when ALL of the following hold:

1. The Company Zero control plane is running a build that includes this fix (the live
   packaged runtime `2026.707.0` predates it; rollout rides the VIT-14 packaged-runtime
   cutover — do not restart the live control plane outside that process).
2. The four regression tests above pass in that build's source tree.
3. A canary: post a plain (no `reopen`/`resume`) board comment on one already-`done`
   issue owned by the unpaused agent, restart nothing, and confirm within one heartbeat
   cycle that the issue stays `done` and an `issue.wake_dropped_terminal` audit event
   appears instead of a run.
4. Zero unexplained `queued` rows in `agent_wakeup_requests` targeting terminal issues at
   unpause time.

Until (1) is possible, the pause stays; the fix removes the wake-storm risk for any
runtime built from this source.
