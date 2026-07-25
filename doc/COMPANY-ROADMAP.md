# The company roadmap

Every company walks the same road. Summon's job on import is to find where a
company stands on it, then run the Summon algorithm from that spot. The 8
stages here are the same list the /diagnose engine ships
(`apps/landing/api/_precedents.mjs` STAGES), so the free front door, the
product, and this doc never disagree.

The org that walks the road is always the same 9 seats, plain names, no
personas, no C-suite: **Cofounder, Support, Operations, Legal, Finance,
Engineering, Design, Sales, Marketing.** That's it.

## The 8 stages

Each stage has evidence that you are IN it and an exit that proves you are
PAST it. A company's position = the lowest stage whose exit is not proven.
The binding constraint almost always lives at that stage.

| # | Stage | You are here if | Exit evidence |
|---|-------|-----------------|---------------|
| 1 | Initial idea | There is a problem and a guess, nothing owned | A named problem, a named buyer, one sentence of the offer |
| 2 | Found it | Someone with money confirmed the problem hurts | One real conversation or preorder from a stranger, written down |
| 3 | Identity | Nothing to point at | Domain, name, one page that says who it serves and what it costs |
| 4 | Build | The promise exists but the thing does not | A stranger can use the core thing end to end once |
| 5 | Distribute | It works but nobody new arrives | One repeatable channel with real numbers (posts, scans, replies) |
| 6 | Launch | Arrivals but no asks | A price in writing, a live buy link, first money moved |
| 7 | Operate and close | Money moved once, not reliably | Deals close on a cadence; invoices go out and get paid |
| 8 | Scale | The loop works but only by hand | The repeated steps run without the founder in them |

## What import does

When a company is imported (repo, org URL, or /diagnose form):

1. **Place it.** Read the evidence, not the vibes: does a landing page
   exist, does a price exist, is there a Stripe link, are there users, is
   there revenue, is there a channel with numbers. Assign the stage as the
   lowest unproven exit. Anti-fabrication rule: no evidence means
   [TBD: awaiting real data], never a guess.
2. **Name the constraint.** The unproven exit IS the constraint candidate.
   State it in one sentence a stranger understands.
3. **Run the Summon algorithm.**
   - Surface all problems (extractor over the repo, registers, TODOs,
     the diagnose form, the founder's own words).
   - Prioritize: importance times urgency, S to F tiers.
   - Tag each top S-tier task and route it to the correct department of
     the 9-seat org.
   - Solve. Repeat.
4. **Before any department does a routed task**, it runs /elon-algo on it:
   question, delete, optimize, accelerate, automate, in order. Most routed
   work should die at delete. What survives gets done well.

## Rules of the road

- One stage at a time. Work on stage N+2 while stage N is unproven is
  deleted on sight (it fails /elon-algo step 1: no named owner because the
  buyer does not exist yet).
- Stage position must be re-derived after every solved constraint, never
  cached. Companies move backward too (a channel dies, a price stops
  clearing) and the roadmap must say so.
- Money stages (6 to 8) outrank polish on any earlier stage. A company at
  Launch with an ugly logo stays at Launch work.
- The roadmap is for every company Summon touches, including Summon. Its
  own position gets stated in every whole-company diagnosis.
