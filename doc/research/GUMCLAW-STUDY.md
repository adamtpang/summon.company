# Gumclaw: the closest thing to Summon that already runs a real company

Studied 2026-08-01 from [antiwork/skills](https://github.com/antiwork/skills)
(the redacted showcase), [antiwork.com](https://antiwork.com), and the
antiwork GitHub org (23 public repos, gumroad at 9.5k stars).

## What it is

One autonomous agent, "Gumclaw", running on Hermes Agent, operating Gumroad:
support queues, fraud investigation, refunds, shipping code, reconciling
finances, filing compliance. Their claim: it runs **99.99% of Gumroad**, with
five humans setting direction and the founder spending about **one hour a week**
on company operations while employed full-time elsewhere.

This matters more than any competitor analysis: it is external, operating proof
that the Summon thesis works at revenue scale. Not a demo, a payroll.

## The architecture, three layers

| Layer | Theirs | Summon today |
|---|---|---|
| **Skills** (procedural memory) | 273 `SKILL.md` files: 146 Gumroad domain (support, fraud, refunds, KYC, payouts, compliance, GDPR, tax), 22 software dev, 20 creative, 85 other | ~10 skills plus 27 vendored gstack. Same idea, an order of magnitude thinner |
| **Cron loops** (continuous operation) | 78 scheduled jobs, 2 minutes to monthly. "Most operate silently, surfacing issues only when human attention is warranted" | `routines` and heartbeats exist and are barely used. **This is the biggest gap** |
| **Memory** (persistent context) | Exactly 2 files: `MEMORY.md` (environment facts, operational lessons) and `USER.md` (operator preferences and corrections), injected into every session | No per-company equivalent. Agent instructions are static; nothing accumulates |

## The cron manifest, which is really a department cadence library

Their published categories map almost exactly onto Summon's departments:

- **Support**: auto-triage (every 15 min), webhook reconcile sweep (20 min),
  closed-ticket safety net (twice daily), daily briefing (9 and 15), stale
  ticket detector (hourly), CSAT dissatisfaction notify
- **Risk and fraud**: hourly risk queue review, autonomous flag review, daily
  card-testing autorefund, velocity spike detector (every 4h), weekly refund
  abuse detection, weekly financial fingerprint
- **Finance**: weekly WIP close (Mondays 10:00), monthly state tax journal
  entries, tax upload verifier, token keepalive, weekly spend digest, monthly
  connected account balances, daily finance dashboard (weekdays)
- **Engineering**: security review (daily 10:00), CI monitor, pipeline actor
  (every 2h), release issue close backstop, dashboards refresh
- **Watchdogs**: pool watchdog (2 min), sentry proxy (5 min), voice bridge
  (10 min), disk janitor, reclaim memory (30 min)
- **Reports**: weekly performance review, weekly team briefing, monthly update,
  planning issue meetings (Fridays 17:00), material moves watcher

The lesson: **the loop is the product; chat is only the interface.** A company
that runs on cadence needs a cadence library, not a chat box.

## Three autonomy tiers, per action type

Sharper than Summon's per-company `manual` vs `always_on`:

- **Autonomous**: support replies, refunds, fraud suspension, KYC
- **Gated**: code deployment, payouts, public communications (verified first)
- **Human-only**: tax filing, irreversible financial commitments

Their line on the last tier: tax filing is "the one irreversible,
judgment-and-liability call that stays with a human on purpose." The agent
prepares everything and still does not file.

## Guardrails that match Summon's doctrine almost word for word

- **Anti-fabrication**: facts require live sources pulled in the current
  session; IDs and amounts are copied, never recalled.
- **Confirm before every payment**: no autonomous spending; vendor changes
  trigger an out-of-band check.
- **Independent critic pass** re-verifies every action on a timer.
- **Customer communications must read as human-authored.**
- **"No sign-off, no apology theater, no em-dashes, no emoji"** appears
  verbatim in their production support skill. Convergent evolution on the
  house voice rule.

## Their skill file shape, better than ours

From the one unredacted skill (`gumroad-support-refund-request`):

1. `name` and `description` frontmatter (kebab-case, with trigger phrases)
2. **Rule 0 (PRE)**: an eligibility gate before any action. "A refund is issued
   ONLY for: billing error, fraud, duplicate charge, seller-unresponsive."
   Plus the inverse: "Never refund our-pocket on a valid charge for a delivered
   product."
3. **Numbered steps** with exact commands and conditional branches
4. **Pitfalls**: the specific ways this goes wrong ("A duplicate-charge refund
   is the SECOND charge only; never refund the legitimate one")
5. **Verify**: a closing checklist that proves the work landed

Summon skills have 1, 3 and sometimes 4. **Rule 0 and Verify are the missing
halves**: the gate that prevents wrong action, and the check that proves right
action.

## What Summon adopts

1. **A cadence library per department** (the biggest gap). Ship default
   routines per department the way we ship the org standard, so a company that
   onboards gets a heartbeat, not just a board.
2. **Autonomy tiers per action type**, replacing the per-company toggle:
   autonomous, gated, human-only, with money and irreversibility always
   human-only.
3. **Two memory files per company**, `MEMORY.md` and `USER.md`, injected into
   every agent session so corrections accumulate instead of evaporating.
4. **Rule 0 and Verify sections** in the skill template.

## What we do not copy

Their model is one agent with many skills; Summon is many agents with
departments and a board. Theirs is proven at one company that owns its own
product; ours is aimed at running many companies from outside. The tiering and
cadence transfer; the single-agent topology does not.

## Also worth knowing in that org

- `antiwork/shortest` (5.6k stars): QA via natural-language AI tests. Relevant
  to the verification layer, since register-truth is a verification product.
- Helper, their support product: "built to scale ourselves down, and we're our
  own first customer." Same dogfood doctrine as Company Zero.

## Honest limits of this study

The repo is a deliberately redacted showcase: one skill published of 273, and
"30+ additional loops" withheld. We learn the shape, the tiering, the cadences
and the guardrails, not the contents. Nothing here is copied; the lessons are
structural.
