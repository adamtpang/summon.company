# Handoff: grand slam offer deal desk (2026-07-24)

Session: Claude Code cloud (mobile), branch `claude/grand-slam-offers-value-v1htkg`,
PR #13 (draft). Written for any fresh session (Claude, Codex, or desktop) to
resume with zero prior context. The originating desktop session died with the
laptop; its transcript was unreachable, so this work was rebuilt from the
board's description: the value equation must be perfect for any deal proposed,
the price must sit far under the value delivered, and the lead must have the
budget.

## What shipped (pushed, in PR #13)

- `skills/offer/SKILL.md`: the /offer grand slam deal desk. Four gates on
  every outgoing deal:
  1. Value equation: score dream outcome, perceived likelihood, time delay,
     and effort 0 to 5; anything under 4 gets a forced fix. Cut the bottom of
     the equation (delay, effort) before polishing the top.
  2. Price-to-value spread: conservative yearly value of the outcome must be
     at least 10x the price, anchored against the incumbent fix. Raise value
     or cut scope before ever cutting price; guarantee before discount.
  3. Budget check: the price must map to a budget line the lead already has;
     the money question comes before the pitch. No budget evidence: walk, or
     free tier until receipts build the case.
  4. Verdict: GO produces a one-page offer sheet; FIX names the single
     weakest lever; WALK says so plainly.
- `company/OFFER.md`: additive "gates" section making /offer mandatory before
  any send, plus the live Anton offer run through the gates as the worked
  example.

Commits: `0b79384` (the work), `16e2634` (empty retrigger). Both carry the
session link in the trailer. New copy follows the no-em-dash house rule; the
em-dash check on additions returned zero.

## Open items, in order

1. **GitHub Actions is blocked at the account level.** On both runs
   (30068759968 and retrigger 30068855882) the `policy` and `review` jobs
   conclude failure about 2 seconds after starting: zero steps execute,
   check-run output is empty, log downloads 404, everything downstream
   skips, and `verify` fails as the fan-in. Two independent workflows, a
   docs-only diff, and the same checks green on 2026-07-14 rule out the
   change itself. Diagnosis: private-repo Actions minutes exhausted or a
   spending-limit / billing block. Fix: GitHub Settings, Billing and plans,
   check Actions usage, spending limit, and payment method, then re-run the
   failed jobs on PR #13 (the Claude GitHub App gets 403 on re-run, so a
   human or a fresh push has to trigger it). Full diagnosis is posted as a
   comment on the PR.
2. **The Anton offer's budget gate is the open item before the send.** It
   passes value and spread (12x to 30x against the $5-12k/mo contractor
   anchor), but nothing confirms what Anton actually spends on the program
   today. Ask "what is this costing you per month right now?" and name the
   budget line the $392/mo comes from. This is written into OFFER.md.
3. **PR #13 is a draft.** Board review, mark ready, merge once CI can run
   green. After merge, /offer is standing doctrine for every outgoing deal.
4. **Nobody is watching the PR after this session is deleted.** The webhook
   subscription dies with the session. A future session can re-subscribe, or
   the board just merges by hand.

## How to resume

- Read `skills/offer/SKILL.md`, then the gates section at the bottom of
  `company/OFFER.md`.
- Branch `claude/grand-slam-offers-value-v1htkg` is pushed and clean; PR #13
  is the only open PR for it.
- To dogfood immediately: run any live deal (Anton, Michael, the founding
  Stripe links in `company/sales/README.md`) through the four gates and file
  the offer sheet.
