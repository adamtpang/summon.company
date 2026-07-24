---
name: offer
description: >
  The grand slam deal desk. Run every deal, quote, or proposal through four
  gates before it leaves the building: the value equation (dream outcome,
  likelihood, time delay, effort), the price-to-value spread (10x or fix it),
  the budget check (the lead can actually pay), and a GO / FIX / WALK
  verdict. Trigger on /offer, "pitch <lead>", "what should I charge",
  "review this deal", "is this offer good", or any proposal about to be sent.
---

# /offer: the grand slam deal desk

Every deal Adam proposes passes four gates before it leaves the building.
The bar is Hormozi's: an offer so good the lead feels stupid saying no, at a
price that is still a fraction of the value, made to a lead who can actually
pay. Sibling of /invoice: offer sells the deal forward; invoice bills the
work after it lands.

Trigger on: /offer, "pitch <lead>", "what should I charge", "should I
propose", "review this deal", "is this offer good enough", any quote or
proposal about to be sent.

## Inputs (ask for what is missing; draft anyway with [assumption] tags)

- The lead: who, business, size, and what they already spend to solve this
  problem (payroll, contractors, agencies, tools).
- The problem in the lead's own words, and what it costs them per month.
- What Adam would deliver, and the first visible result.
- The price he has in mind, or the word "estimate" to work one out.

## Gate 1: the value equation

    Value = (Dream Outcome × Likelihood) ÷ (Time Delay × Effort)

Score each lever 0 to 5. Anything under 4 gets a forced fix before the deal
moves on.

- **Dream outcome**: stated as the thing the lead would brag about, in their
  words, in money or status. "Your backlog worked; your mornings a review
  queue," never a feature list. Weak: rewrite until the lead would say it
  themselves.
- **Perceived likelihood**: receipts, a named process, a guarantee. Every
  claim carries a receipt the lead can check; no receipt, no claim. Weak:
  add proof or a risk-reversing guarantee, never adjectives.
- **Time delay**: what does the lead SEE inside 7 days? Name the first
  visible win and its date. Weak: restructure delivery so something real
  lands in week one.
- **Effort and sacrifice**: list everything the lead must do. The list
  should be embarrassingly short (approve, reject, pay). Weak: move items
  from their side to ours.

The bottom of the equation is where deals are won: cut delay and effort
toward zero and value runs toward infinite. Raising the top is marketing;
cutting the bottom is engineering.

## Gate 2: the price-to-value spread

1. Total the yearly money value of the outcome, conservatively, line by
   line: money made + money saved + time saved priced at what the lead's
   time actually costs. Every line traces to an input; anything guessed is
   marked [estimate].
2. **Rule: value ≥ 10x price.** Under 10x: raise value or cut scope. A
   price cut is the last resort, never the first move.
3. Anchor against the incumbent fix (payroll, contractor, agency) in the
   same sentence as the price.
4. Premium, never cheapest: second-cheapest has no strategic value; most
   expensive with receipts does. If the deal stalls, add certainty (a
   stronger guarantee, a faster first win); do not subtract price.

## Gate 3: the budget check

A lead who cannot pay is an audience member, not a lead.

- Evidence of ability to pay, strongest first: they already pay someone for
  this problem (payroll, contractor, agency, tools) · revenue or funding
  covers the price without pain · a stated budget.
- Map the price to a budget line the lead ALREADY has. "$392/mo against the
  $5k/mo contractor line" closes; a brand-new budget line stalls.
- The money question comes before the pitch, not after: "what is this
  problem costing you per month right now?"
- No budget evidence: WALK, or downshift to the free tier and let receipts
  build the budget case. Never discount to fit a budget that does not
  exist.

## Gate 4: the verdict

- **GO**: every lever ≥ 4, spread ≥ 10x, budget line named. Produce the
  offer sheet below.
- **FIX**: name the single weakest lever and the one change that fixes it.
  One fix per round; re-run the gates after.
- **WALK**: no budget evidence, or the honest spread is under 3x, or the
  dream outcome cannot be stated in the lead's words. Say so plainly and
  file the lead for when receipts exist.

## The offer sheet (what a GO produces)

    LEAD: {name, one line}
    DREAM OUTCOME: {their words}
    DELIVERABLES: {named and dated; first visible win inside 7 days}
    PROOF: {receipts + the guarantee}
    THEIR ONLY JOBS: {the embarrassingly short list}
    VALUE MATH: {lines + conservative yearly total}
    PRICE: {number} against {their existing budget line} · spread {n}x
    GUARANTEE: {risk reversal in one line}
    DECIDE BY: {one honest reason to decide now, or omit the line}

## Rules (hard)

- Never send a price without the value math beside it.
- Never compete on price; compete on certainty, speed, and ease.
- Guarantee before discount, always.
- Scarcity and urgency only when true; a fake deadline burns the list.
- One named offer per lead (the OFFER.md anti-dilution rule); a segment
  earns a named offer only after a receipt exists in that segment.
- Ground every number in inputs or receipts. Unsure: ask, never fill.
- No em dashes in anything the lead sees.

## Summon wiring

Inside Summon this gate is shared doctrine: Marketing shapes the value
equation, Sales closes from the offer sheet, Finance owns the price floor
and checks the spread math. The company's own live offer is
company/OFFER.md and must pass these gates like any outside deal. A GO that
lands becomes /invoice input once the work is done, which turns into a
money-in outcome receipt (SUM-143).
