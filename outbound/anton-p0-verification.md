# Anton P0 handoff: verification result

Run 2026-07-30 against `regain-inc/miss` at `84fd79f77` (their current `main`).
Nothing was pushed to their remote. No patient or tenant data was read.

## Headline

There is no give-diff to send, because their team already fixed everything the
handoff nominated. Their findings register is dated 2026-07-14 and has not been
touched since, while **214 commits** landed on `main`. Six of the nine P0s are
closed in code and still marked open in the document.

The handoff's own guardrail called this: verify before fixing, never send a diff
for a bug that no longer exists.

## Evidence, P0 by P0

| ID | Register claim | Code truth on `main` |
|---|---|---|
| P0-2 | `scheduleBatchEtl()` defined with a 01:00 cron, zero call sites, nightly BI build never runs | **Fixed.** Imported at `apps/queue/src/index.ts:57`, called at `:269`; definition `bi-etl.ts:2135` |
| P0-3 | Consumer matches `.scheduling.appointment.*` but the state machine emits `com.regain.clinical.appointment.*` | **Fixed.** Consumer now matches both, `bi-etl-stream.ts:344-345`, with a comment at `:341-342` naming the clinical prefix. Emitter unchanged at `appointment-state-machine.ts:102-107` |
| P0-4 | `fact_encounters.total_charges` has no production writer, clinic and provider revenue read 0 | **Fixed.** `totalCharges` threaded into the `factEncounters` insert, `bi-etl.ts:698, 727, 756`, sourced from `rcm_charges.amount` |
| P0-5 | Consumer try/catch only logs, never rethrows, so failed enqueues are ACKed and warehouse updates are lost with no retry or DLQ | **Fixed.** `packages/events/src/consumer.ts` now reclaims unacked messages (`:196-202`) and drives a retry/DLQ ladder off the XPENDING delivery counter (`:249-253`), which survives pod restarts. A throwing handler now skips the ack by design |
| P0-7 | `fact_appointments.expected_revenue` has no production writer | **Fixed.** `expectedRevenue` threaded at `bi-etl.ts:838, 859, 884` |
| P0-9 | `dataAsOf = today.toISOString()` rather than the last successful ETL, so stale data renders as a live zero | **Fixed.** `executive.ts:190` uses `fetchRevenueDataAsOf(tx, organizationId)`. The one remaining clock stamp is `executive-alerts.ts:379` and is deliberate: alerts are computed live per request, documented in the code |
| P0-8 | ~53 empty Russian strings on executive surfaces | **Still open.** 2,671 empty `msgstr` entries in `apps/admin/messages/ru.po` |
| P0-6 | Three disagreeing revenue numbers | Their register already marks this resolved via P0-4 |
| P0-1 | Route authz, patient PHI exposure | Not audited. Out of scope by design: an unrequested RBAC patch on a medical product is a bad first impression |

## Why P0-8 was not taken as the give

It is the only P0 still open, and it is the wrong one to send. Machine-generated
Russian for a medical product's executive UI, unsolicited, is a liability rather
than a credential. Worth naming in conversation, not worth patching blind.

## What this actually proves, and it is better than a patch

Their team is fast and disciplined: a written register, burned down in sixteen
days, with their own AI review gates in the loop (the consumer code credits a
"codex gate"). A pitch built on "we will find your bugs" is weak against that.

What they do not have is a register that stays true. Theirs went stale in
sixteen days and 214 commits, so the document a CEO would read today
misrepresents the state of the product by six P0s. That gap is exactly the loop
Summon runs: surface, rank, route, verify, repeat, continuously rather than once.

## Draft message for Adam to send (never sent by an agent)

> Ran your repo through Summon against your findings register. Good news
> first: your team already closed P0-2, P0-3, P0-4, P0-5, P0-7 and P0-9. I
> verified each one in current main with file and line numbers, happy to send
> the sheet. The catch is the register still lists them as open, and 214
> commits have landed since it was written on July 14. Only P0-8 is genuinely
> still open. Keeping that register true continuously, instead of once a
> fortnight, is the thing I would set up for you. Want the sheet?

## Next move if he says yes

Send the table above as the sheet. The founding offer stays as designed and is
not renegotiated here: $500 one-time setup plus $99 a month founding rate,
cancel anytime, for weekly feedback and case-study rights.
