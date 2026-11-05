# Davron demo-truth sheet

Prepared 2026-08-01 against regain-inc/miss origin/main `c1b1701a2`, read-only.
Their own gap assessment (22-production-readiness-gap.md, 2026-07-14) framed the
risk: the buyer is Nodira, the validator is Davron, who wrote the CRM,
telephony, fiscal and finance modules and knows the real numbers. "A demo that
contradicts the buyer's own operational system is worse than no demo."

That assessment is now 269 commits stale. Verified line by line, most of its
fears are dead. What remains is a short disclosure list, not a rebuild.

## The three pipelines the gap doc called broken

| Pipeline | Gap doc said | Truth today |
|---|---|---|
| Batch BI ETL | DEAD, never invoked (P0-2) | **Runs.** Wired and awaited, closed `b4af6e64c` 2026-07-14 |
| Streaming ETL | Wrong prefix, silent loss (P0-3, P0-5) | **Fixed.** Clinical prefix matched (`68408a583`), retry/DLQ ladder on XPENDING (`b1baa70cb`) |
| Daily rollups | Assumed an ETL that never ran | **Foundation restored** by the above; P1-3/P1-4 tail not re-verified [TBD] |

## Field-level: seed-only then, real now

| Field the demo shows | Gap doc said | Truth today |
|---|---|---|
| Clinic and provider revenue (`total_charges`) | No production writer, reads 0 | **Real writer** (`b4af6e64c`) |
| Front-desk amounts (`expected_revenue`) | No production writer, reads 0 | **Real writer** (`b4af6e64c`) |
| Operator CSAT | Nothing writes it | **Survey path exists now** (`crm/surveys-controller.ts`, `survey-review-controller.ts`); one-line confirm that it feeds `telephony_calls.csat_score` [verify] |
| Call-center `callbackBreaches` | Hardcoded 0 (P1-18) | **Real computation**: tests now assert it counts missed inbound calls still marked lost |
| Finance `fiscalBoxStatus` | Hardcoded "unknown" (P1-9) | **Real mapping**: healthy / degraded / unavailable from the live fiscal connection (`finance.ts:262`) |
| Corporate collections split (d6) | Hardcoded 0, folded into insurance | **Still folded, now documented in code**: payer enum is two-value by design. DISCLOSE, don't hide |
| Marketing cockpit (funnel, CAC) | Fixture-only, live connector out of scope | **Still fixture** as far as verifiable [TBD]. DISCLOSE or keep out of the demo path |

## The three contradictions Davron could catch live

1. **Three disagreeing revenue numbers**: FIXED. Single net-collected contract,
   commit `6513ff3f4` names P0-6; per-branch and per-provider now period-match
   the headline.
2. **Two CRM lead ledgers** (Marketing vs Cortex vs Executive counting
   different lead populations): **no unification commit found. Treat as OPEN.**
   This is the one live tripwire: do not show lead counts on two surfaces in
   the same demo, or disclose the split up front.
3. **Finance says "unknown" while the fiscal page shows real state**: FIXED
   (real status mapping).

## The honest demo script

- **Lead with what their own audit calls production-real:** doctor earnings,
  cashier volume and refunds, workforce turnover and coverage, call-center
  offered/answered/abandoned/SLA from real telephony, lab bottleneck,
  registration wait, days-in-AR, denial and clean-claim rates.
- **Disclose two things proactively:** marketing cockpit runs on fixture data
  pending the live connector, and corporate collections fold into insurance by
  enum design. Disclosure is what makes Davron an ally instead of an auditor.
- **Park one thing:** lead counts across surfaces, until the ledger split is
  unified or explained.
- **The power move:** show Davron the register receipt itself. He wrote these
  modules; handing him the commit hashes that fixed the revenue truth is the
  fastest trust-builder in the room.

## Pre-demo checklist (all small)

1. Merge the one-line RU patch (P0-8 to zero on executive surfaces).
2. Answer the P0-1 front-desk permission question (five minutes, their team).
3. One-line confirm the CSAT survey path writes `telephony_calls.csat_score`.
4. Decide: unify or disclose the lead ledgers (the only open contradiction).
5. Rerun the register; walk in with 9 of 9 green and the receipt in hand.

Sources: their register (21), their gap assessment (22), their waves plan (23),
all verified against origin/main c1b1701a2. Nothing here was written to their
repo.
