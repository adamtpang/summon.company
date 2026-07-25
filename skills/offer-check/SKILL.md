# /offer-check — Grand Slam Offer and value-equation gate

Run this BEFORE striking any deal, quoting any price, or minting any first
invoice. It answers the one question Adam never computes: is the value
delivered to the other side clearly at least the price, with the price at
market rate (not above, not below)? Output is a deterministic scorecard and a
GO or FIX verdict, never vibes.

Trigger on: /offer-check, "check this deal", "check this offer", "can I
charge X for Y", "is this priced right", "value check", and automatically
before /invoice mints a FIRST invoice for a new client or a new offer
(recurring re-bills of an already-checked offer are exempt).

## Inputs (ask for what is missing, max three questions, then label assumptions)

1. Who: the buyer, and what they would do INSTEAD of buying (the alternative).
2. What: the deliverable in outcome language, and the time window.
3. Price: the number Adam wants to charge (or "estimate" to derive one).

## Step 1 — Market rate (mandatory, real searches)

Search for what this buyer would actually pay for the closest substitutes
(2 to 4 searches: contractor, agency, tool, marketplace rate). Produce:
- floor (cheap DIY substitute), anchor (direct done-for-you substitute),
  ceiling (premium option), each with a source.
- RULE: the price belongs inside the market band. Target the anchor. A
  founding discount may sit below anchor; the price never exceeds ceiling.
  Adam's doctrine: market rate, not more, not less.

## Step 2 — Value math (the side Adam never computes)

Compute value delivered through three lenses; keep the MOST DEFENSIBLE one
and show the arithmetic:
- Replacement cost: what the buyer pays a human, agency, or tool for the same
  output over the same window.
- Time value: hours saved x the buyer's loaded hourly value.
- Money moved: revenue unlocked or loss avoided, times an honest probability.

GATE: value >= 3x price for a warm buyer, >= 10x for a cold one. If value
cannot be shown at 3x, the offer or the price is wrong; fix before sending.

## Step 2b — Budget (the gate that kills dead deals early)

Value clearing the bar is not the same as money existing. Name the BUDGET
LINE the price comes out of: a contractor they already pay, a hire they are
trying to avoid, an agency retainer, a tool subscription, an event budget.
- Evidence, not inference: they said it, a job post shows it, a vendor is
  visibly in use, or the spend is on their site or in their repos.
- No budget evidence: ask the money question before sending ("what is this
  costing you per month right now?"), or open with the free artifact until
  receipts build the case.
- NEVER discount into a budget that does not exist. A lower price does not
  create money; it only lowers the ceiling for when the money appears.
GATE: a named budget line with evidence, or the verdict is FIX (ask the
money question), never a price cut.

## Step 3 — Value-equation scorecard (deterministic)

Score each Hormozi variable by its three binary criteria. Score = 4, plus 2
per criterion met (so 4, 6, 8, or 10). No partial credit, no rounding up.

**Dream Outcome**
- [ ] The end state is named in the BUYER's words (not our feature language).
- [ ] It ties to a number the buyer already tracks (revenue, hours, a deadline, a register).
- [ ] The buyer has said they want it (evidence, not assumption).

**Perceived Likelihood of Achievement**
- [ ] Proof the buyer can inspect exists (receipt, demo, shipped work, a PR).
- [ ] A guarantee with teeth is attached (refund, do-not-pay floor, or a performance condition: pick one that is scary to offer).
- [ ] A result-in-advance or trial exists (they see work before or without paying).

**Time Delay**
- [ ] First visible result within 72 hours of "yes".
- [ ] The full-outcome window is stated as a date or day count.
- [ ] Work starts without waiting on the buyer's setup (no onboarding call, no docs from them).

**Effort and Sacrifice**
- [ ] Starting requires one reply (nothing to install, write, or configure).
- [ ] Ongoing ask is 15 minutes a day or less, stated.
- [ ] Exit is one step (cancel by one message; no lock-in).

GATE: every variable >= 8, target 10. For any variable below 10, list the
exact mechanism that adds the missing criterion (guarantee menu, result in
advance, effort trim, named date), from knowledge/books/100m-offers.md.

## Step 4 — Verdict

- **GO**: all gates pass. Print the one-line verdict, the scorecard, and the
  prefilled next command (`node ~/.claude/skills/invoice/scripts/invoice.mjs
  --client <slug> --preset <name>` or the /mint command), plus the under-120-
  word send message on request.
- **FIX**: print only the failing criteria and the shortest mechanism list to
  green. Do not send anything while a gate fails; do not pad the price down
  or up to force a pass, change the OFFER.

## Rules (hard)

- Market rate comes from searches with sources, never recall.
- Value math shows arithmetic; a value claim without a number is a fail.
- Scores come only from the binary criteria; if evidence is missing, the
  criterion is unmet.
- Scarcity and urgency claims must be true (solo capacity, real slot counts,
  real price-lock windows). A fake deadline fails the check outright.
- No em dashes in anything client-facing.

## Worked shape (keep this compact in output)

```
DEAL: <buyer> / <offer> / $<price> (<market anchor: $X, source>)
VALUE: $<value> via <lens> (<arithmetic>)  -> <n>x price  [gate: pass/fail]
Dream 10 | Likelihood 8 | Delay 10 | Effort 10   [gate: pass/fail]
VERDICT: GO -> <next command>   (or FIX -> <mechanisms>)
```
