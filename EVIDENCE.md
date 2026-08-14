# EVIDENCE: summon.company

Numbers only. A zero is data and gets logged as a zero. No gate passes without a
number or a dated receipt.

## Baseline (as of 2026-08-01, from live Stripe and live HTTP reads)

| Metric | Value | Source | As-of |
| --- | --- | --- | --- |
| Revenue (stranger $) | **$0** for Summon | Stripe API | 2026-08-01 |
| MRR | **$0** | Stripe API | 2026-08-01 |
| Subscriptions, all statuses, ever | **0** | Stripe API, `subscriptions?status=all` returned 0 | 2026-08-01 |
| Active customers | **0** | Stripe | 2026-08-01 |
| Named verbal yes, never sent a link | **1** (Anton, Regain Inc) | ANTON_GIVE.md | 2026-08-01 |
| Warm second, never contacted | **1** (Michael, Hawaii Tech Week) | company/sales/FOUNDING-PIPELINE-LEDGER.md | 2026-08-01 |
| Public rail on the site | **1**, live and verified | buy.stripe.com/8x2eVd1ACfJb5kc1q9aMU19 | 2026-08-01 |
| Weekly active usage | Company Zero dogfood only | control plane | 2026-08-01 |
| Time to first value | 60 seconds via /diagnose, unproven on a stranger | verified working, see below | 2026-08-01 |
| Top risk | **The ask has never been sent.** Product risk is second to that. | this file | 2026-08-01 |

## What was actually broken on 2026-08-01, found by checking

The brief said the public face was unclear because `.vercel` pointed at the
wrong project. That was wrong on both counts, and the real problem was worse.

| Claim in the brief | What was actually true |
| --- | --- |
| `.vercel` wrongly points at vitals.run | **Correct as-is.** `vercel domains inspect summon.company` shows the Vercel project named `vitals.run` serves both summon.company and design.summon.company. Only the project's display name is stale, from the pre-Summon rename. See PUBLIC_FACE.md. |
| The Stripe rail is live and correct | True of the rail, but **the rail was not on the site.** The live page carried 8 buy buttons and **all 8 were dead**: 8 of 8 payment links inactive, 8 of 8 prices archived. summon.company could not take a single dollar. |
| n/a | The live page also sold a **superseded $99/mo offer** and shipped JSON-LD to search engines quoting `"price":"99.00"`. |

## The rail, verified 2026-08-01

Checked against the Stripe API and rendered in a browser, not assumed.

| Object | ID | State |
| --- | --- | --- |
| Public product | `prod_Uvlz1aAKZ86BVm` Summon Founding Seat | active |
| Public price | `price_1TvuRZFL7C10dNyGWfMlpC7b` | active, $500/mo, nickname "Summon Founding Seat - $500/mo", `keep: true` |
| Public buy URL | https://buy.stripe.com/8x2eVd1ACfJb5kc1q9aMU19 | renders "Subscribe to Summon Founding Seat", SGD 667.04/mo at 1 USD = 1.3341 SGD |
| Anton setup | `price_1TzWS2FL7C10dNyGIixanuvB` | active, $500 one-time, labeled, `keep: true` |
| Anton monthly | `price_1TzWSKFL7C10dNyGYNNcZnku` | active, $99/mo, labeled, `keep: true` |

**Duplicate resolved.** A second founding rail with identical economics
(`prod_UzZ8krCO3LnwKC`, $500 once + $99/mo on one link
`6oUaEX2EG2Wp9Asgl3aMU1g`) was minted hours after the pair above. Board decision
2026-08-01: keep the two-link pair that `outbound/anton-founding-send.md`
actually references, archive the single-link version. Product, both prices, and
the payment link are now `active: false`. Three active Summon products remain,
one price each.

## Verified results log

| Date | Change | Before | After | Evidence |
| --- | --- | --- | --- | --- |
| 2026-07-26 | Fleet bootstrap created this baseline | n/a | file exists | this file |
| 2026-07-31 | The Anton give: fixed surviving P0-9 in regain/miss | 16 tests, bug live on main | 19 pass 0 fail, tsc clean, +70/-6 on a local branch, never pushed | ANTON_GIVE.md, anton-give.diff, commit dc24ee54c |
| 2026-08-01 | Re-verified the Anton give on the real repo | claimed done | branch `fix/exec-alerts-dataasof-watermark` exists, `dc24ee54c` is 2 files +70/-6, `git branch -r --contains` empty so their remote is untouched | regain/miss |
| 2026-08-01 | OFFER.md filled for real, no brackets | template with `[buyer]` | real buyer, pain, cure, alternative, proof, price, risk reversal | OFFER.md |
| 2026-08-01 | Public face decided and documented | ambiguous, agents kept "fixing" a correct .vercel link | explicit decision recorded, landing stays in apps/landing under the vitals.run project | PUBLIC_FACE.md |
| 2026-08-01 | Landing rewired to the live rail | 8 dead buy buttons, $99/mo copy, JSON-LD price 99.00 | 1 live link in 4 CTAs, $500/mo founding seat, JSON-LD price 500.00 | apps/landing/index.html |
| 2026-08-01 | Stale price copy swept across the funnel | $99/mo on diagnose, blog, kit, and 9 generated role pages | all updated, generator `build-roles.mjs` fixed at source and roles regenerated | apps/landing |
| 2026-08-01 | Stripe duplicate founding rail archived | 2 competing founding offers | 1 archived, 3 active products with 1 price each, all labeled `keep: true` | Stripe API |
| 2026-08-01 | Onboarding written for the first 30 minutes | none existed | ONBOARDING.md, with the verified zero-install path first | ONBOARDING.md |
| 2026-08-01 | /diagnose verified working end to end | unverified | POST returned stage 7, a named binding constraint, a precedent, and a first move for a test business | live API |
| 2026-08-01 | Fleet ring added to the landing footer | none | hub plus everybot.fun and summon.guide, renders at 375px with no overflow | apps/landing/index.html |
| 2026-08-01 | fleet.json status corrected | "code" | "live", the site returns HTTP 200 | Aether/fleet.json |
| 2026-08-01 | Deployed to production on Adam's instruction | live site had 8 dead buy buttons and sold a superseded $99/mo offer | live site sells the $500/mo founding seat through the one working rail. 14 mentions of $500, zero of $99/mo, JSON-LD price 500.00. design.summon.company, vitals.run, /diagnose, /roles/, /blog.html, /changelog.html, /terms.html all still 200 | deploy `dpl_9oJyZUGxYouc36MwHZChH8cNwjwe` |
| 2026-08-01 | Michael follow-up drafted | none | outbound/michael-followup.md, unsent, with the Haven precondition flagged | outbound/ |

## What changes the zero

Only one thing, and it is not code: **Anton has said yes and has never been sent
a link.** The give is finished, tested, and sitting in the repo. Everything in
this file is preparation for one message that has not gone out.

Order of operations that moves MRR off zero:

1. Adam sends the Anton give (ANTON_GIVE.md has the message and the diff).
2. On his reply, the founding offer with the two links in
   `outbound/anton-founding-send.md`.
3. Loop Haven, then send Michael (`outbound/michael-followup.md`).
4. Deploy the landing so the public rail is reachable by a stranger.

## Rules

- A gate is not PASS without a number or a dated receipt.
- Self-payments and test charges do not count as stranger revenue.
- After every meaningful ship, add one row to the results log.
- Log zeros. Zero is the true number here and hiding it is lying.
