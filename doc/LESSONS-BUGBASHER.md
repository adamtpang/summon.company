# Lessons from BugBasher: reality is the best eval

Source: Ramp's write-up of BugBasher, a Devin-run exterminator-referral business
that made $75 in four weeks (July to September 2026). Roughly $3,000 of spend and
10,929 calls for one sale. Read 2026-09-18 at Adam's direction.

## What happened, in one paragraph

An agent with a card, a phone, an email, a Stripe link, and a shared text-file
brain ran a 20-minute heartbeat loop: check blockers, make calls, review
transcripts, rewrite its own instructions, and once a day review the whole
business. It was relentless on narrow problems it could measure and weak on the
open goal. Its first sale came only after reality killed four of its ideas in a
row.

## The lessons that apply to Summon

1. **Reality is the eval.** Every idea BugBasher started with was wrong about how
   people behave: free leads got no replies, receptionists did not want
   partnerships. What worked came out of trying, measuring, and writing down why
   it failed. Summon's version: no department's work counts until it has touched
   the real artifact, the real site, the real buyer. A plan is not a result.
2. **Hill-climbing works, open goals do not.** Given "stop reading the prompt
   aloud" or "reach a human", it iterated fast. Given "make money", it spent four
   weeks. Summon already answers this with one binding constraint at a time. Keep
   every department's brief concrete and measurable, never "grow revenue".
3. **Human approval throughput is a real bottleneck.** Nine PRs and a signing
   decision sat for days. The agent finally mined git log for emails. Summon's
   board queue must stay short, and a blocker older than a day should escalate
   through a channel the founder actually reads, not pile up.
4. **Lead with a specific, real thing.** "Free leads" failed. "I have a restaurant
   on Clarkson Avenue that wants a quote, who do I send it to?" worked. Outreach
   copy names the concrete item, not the category.
5. **Charge up front, and wait longer than an hour.** Giving leads away got
   nothing. The $75 Stripe link converted, eight hours after the agent had
   declared the experiment a failure. Give experiments a real window before
   judging them.
6. **Re-sell to the buyer who already paid.** The one customer asked for more
   leads and the agent never thought to offer them. After any first sale, the
   next task is the same buyer.
7. **Some failures need a human, and the agent should say so.** Prompt edits never
   stopped the phone agent reading its reasoning aloud. After five tries it
   escalated. Cap self-fix attempts and escalate with evidence.
8. **A shared brain on disk works.** Memory, open decisions, a do-not-call list,
   transcripts, run logs, and skills in plain files let many short sessions
   continue one piece of work. Summon's per-department MEMORY.md (SUM-47) is the
   same idea; keep it curated, with archives rolled up monthly.

## What changed in Summon because of this (2026-09-18)

- `/api/diagnose` used to tell the model to "reason from what that kind of
  business plainly is". It now fetches the business's homepage, `/pricing`, and
  `robots.txt` first and must ground every claim in what it found (issue #28).
  The first live run caught a real gap in the extractor itself: it missed Anchor
  Marianas's "Start a project" link until link-based detection was added.
- The SUM-297 analyzer exists (issue #27): four checks on real fetched facts,
  each with source URLs, and "unknown" instead of a guess when a site cannot be
  read.
- A company can be audited on demand against its live site (issue #29).

## Open, for Adam

- The "one sale, then re-sell" rule belongs in Sales's instructions.
- The one-day blocker escalation belongs in Operations's heartbeat.
- A self-fix cap (for example three tries, then escalate) belongs in every
  department's instructions.
