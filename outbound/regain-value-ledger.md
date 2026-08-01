# Regain value ledger

Every problem has a price. This ledger prices each one Summon touches, in
Anton's numbers, and it is the source for the weekly receipt the $99/mo
guarantee stands on. Labels are honest: VERIFIED traces to a commit, a file,
or Stripe; ESTIMATE is derived arithmetic with the derivation shown.

## Entries

### 1. Register reconciliation (delivered 2026-07-30, free, before any payment)

- What: his P0 register ("fix before any customer sees real data or before
  demo to Davron") reconciled against code. 7 of 9 closed, 1 partial, 1
  needing his team's confirmation. Register 269 commits stale at last run.
  VERIFIED: outbound/regain-register/run-output.txt, commit hashes per row.
- Time saved: 8 to 16 hours of commit archaeology (39 findings, 15 to 25 min
  each). ESTIMATE from finding count.
- Money: $808 to $1,616 at the $101/hr contractor average. ESTIMATE.
- Revenue unlocked: the register was his demo gate, showing 9 red when the
  truth was mostly green. A month of false caution on one 10-clinician
  clinic at his own pricing ($100 to $300/clinician/mo) is $1,000 to $3,000
  of delayed MRR. ESTIMATE using his published pricing model.

### 2. P0-8 closed to zero (patch in hand, 2026-08-01)

- What: the last empty Russian string on his executive surfaces ("SLA
  breached" -> "Нарушение SLA"), a one-line ready-to-merge patch. VERIFIED:
  outbound/regain-register/p0-8-sla-ru.patch; executive-region empty msgstr
  count 53 at register commit, 0 after merge.
- Time saved: minutes, honestly. The value is the register row closing, and
  that the demo-blocking label ("demo-blocking for a Russian-speaking CEO,"
  his team's words) is gone.

### 3. P0-1 five-minute close (memo in hand, 2026-08-01)

- What: the PHI-severity row reduced from "re-audit the routes" to one
  yes/no question his team answers in five minutes. VERIFIED evidence: RBAC
  gates 4 -> 11; the single divergent route named with line numbers.
  outbound/regain-register/p0-1-confirmation-memo.md.
- Time saved: the difference between a route re-audit (hours) and a
  confirmation (minutes). ESTIMATE: 2 to 4 hours.

### 4. The always-on loop (starts on his yes)

- What: register-truth re-run on merges plus a nightly sweep, receipts with
  commit hashes posted to his board. Replaces the reconciliation becoming
  stale again, which took 16 days last time. VERIFIED decay rate.
- Time saved: his docs upkeep is his number one commit type (205 of 904
  commits last month, ~76% authored by him, 6 to 10 minutes each): 4 to 6
  hours a week. ESTIMATE derived from his own commit log.
- Money: $1,500 to $2,000/month of founder time at $75 to $101/hr against
  $99. ESTIMATE.

## Running totals (update weekly, never silently)

| Week | Time saved | Money equivalent | Revenue unlocked | Verified receipts |
|---|---|---|---|---|
| Pre-payment (the give) | 10 to 20 h | $1,000 to $2,000 | demo gate re-lit | run-output.txt, patch, memo |
| Week 1 (on his yes) | [TBD: awaiting real data] | [TBD] | [TBD] | REG-2 receipt |

Rules: no row without an artifact. Estimates stay labeled until Anton
confirms a number (his hourly value, a closed deal), then they upgrade to
VERIFIED with his words as the source. The weekly receipt quotes this table,
and the any-month refund is judged against it.
