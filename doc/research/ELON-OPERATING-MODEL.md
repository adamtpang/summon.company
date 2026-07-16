# The Elon Operating Model, applied to Summon

Source: *The Book of Elon* (Jorgenson, 2026) — board-directed extraction, 2026-07-15.
Principles paraphrased from the primary sections (The Algorithm p130; Remove
Organizational Boundaries p112; Simple Communication p117; Do Things in Parallel p143;
Break Down the "Impossible" p146; Set Aggressive Timelines p148; Attack the Constraint
p156). Applied to how Summon RUNS (the control plane) and how it LOOKS (UI/UX).

## 1. The seven principles, translated

| # | Elon principle | Summon translation |
|---|---|---|
| 1 | **The Algorithm** — question requirements → delete → simplify → accelerate → automate, IN ORDER. "The most common mistake of smart engineers is to optimize a thing that should not exist." Automation comes LAST. | Every ticket passes the five gates before an agent builds. Gate 1-2 are boardable: "should this exist at all?" is a legitimate agent response to its own assignment. If ~1 in 10 deleted things doesn't come back, we're not deleting enough. |
| 2 | **Requirements come from a PERSON, not a department.** "You must know the name of the real person who made every requirement." | Every ticket carries a named requirement owner (the board, or a named agent). "The standard requires it" is not a source; VITALS_COMPANY_STANDARD.md cites its author (the board). |
| 3 | **Remove organizational boundaries** — anyone talks to anyone, shortest path; org errors manifest in the product ("box in a box"). | Agents message each other directly across departments (no CEO-mediated chain-of-command). The chat surface (NORTH_STAR "The interface") IS this principle as product. Watch for box-in-a-box in the UI itself: duplicated surfaces = two teams enclosing the same thing. |
| 4 | **Simple communication** — no made-up acronyms/jargon; anything requiring a glossary inhibits flow. | UI copy speaks plain language (VIT-54 issue→task is this principle). Agent reports lead with outcomes in one sentence, not process. VIT is a prefix, not a vocabulary. |
| 5 | **Do things in parallel** — "Avoid serialized dependencies... put as many gestating elements in parallel as possible. If a timeline is long, it's wrong." | The queue is not a line; it's a formation. Every problem has its own accountable agent gestating simultaneously. Serialization is allowed ONLY for true dependencies (Run 4 → Run 5 token remap is real; most others are not). |
| 6 | **Attack the constraint** — "the production line moves as fast as the slowest and least lucky part"; the production SYSTEM is the product. | Summon's production system = the control plane + adapters. Its current slowest part is PROVIDER QUOTA (Codex exhausted to Jul 22; Claude shared with the board's own sessions). Therefore VIT-48 (usage monitor) and VIT-49 (fallback chains) are constraint-attackers, priority critical — they set everyone's rate. |
| 7 | **Time is the metric.** "It's okay to scrap equipment or money. It's not okay to scrap time." | Every surface shows time-in-state. Aging tickets are visually loud. Money (budget caps) protects downside; time is what the board optimizes. |

## 2. Structural changes (executed 2026-07-15)

1. **One agent per problem, all gestating in parallel.** All eight department agents on
   `claude_local` (Codex quota made provider choice a constraint; modularity is the fix —
   flip back per VIT-49 policy when Codex resets). Tickets redistributed off the
   Engineer's pile to true department owners: usage/spend → CFO, runtime → CTO,
   brand/language/users → CMO, governance/approvals + standardization → COO.
2. **Wake throttle = the real constraint.** Concurrent runs are bounded by subscription
   throughput, not by ceremony. As runs finish, the next ticket in that agent's queue
   wakes. (Waking everything at once would just move the queue inside the rate limiter —
   accelerating a thing that should be deleted.)
3. **CEO stays unassigned-free** as the routing front door (VIT-57), per the Dispatch
   pattern — a router with a task list is a bottleneck wearing a crown.

## 3. UI/UX changes (ticketed)

1. **The Algorithm as the ticket spine**: a five-gate strip on task detail
   (Requirements? → Delete? → Simplify → Accelerate → Automate), with gate 1 showing the
   NAMED requirement owner and gate 2 offering "propose deletion" as a first-class agent
   action. Board sees which gate every task is at.
2. **Parallel lanes, not a list**: the board's default work view is per-agent lanes
   (everything gestating at once), with true dependencies drawn as explicit edges —
   serialization must be visible to be killed.
3. **Time-in-state everywhere**: every task chip shows its age; aging escalates visually.
   "If a timeline is long, it's wrong" is a render rule, not a poster.
4. **Box-in-a-box audit**: one settings surface, one inbox, one status vocabulary —
   duplicated enclosures in the UI are org errors made visible (feeds Run 4/5 and the
   component-convergence discipline already in DECISION-SHEET).
5. **Plain-language sweep**: no invented acronyms in UI copy; agent reports are
   outcome-first one-liners (ties VIT-54, VIT-41's steer).

## 4. What we deliberately did NOT copy

- **"Managers enforcing chain of command get fired"** — Summon has no middle managers to
  fire; the equivalent rule: no agent may require routing through itself (incl. the CEO).
- **Sleeping on the factory floor** — the board's version is dogfooding in the desktop
  app daily (VIT-56), not heroics.
- **Aggressive public deadlines** — agents get aggressive *internal* timelines via
  time-in-state pressure; public promises stay 11x-rule honest (NORTH_STAR graveyard).
