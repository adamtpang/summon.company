# Shopify OS → Summon: the desired-state company

Source: Tobi Lütke on David Senra's podcast (Jan 2026, "21 Years of Building Shopify"),
board-supplied transcript, extracted 2026-07-15. Tobi built "Shopify OS" — config files
+ a SAT solver that computes what the company SHOULD look like — during his post-COVID
rederive. Summon's SKILL.md already cites the config-file idea; this doc captures the
deeper mechanics and what Summon adopts.

## The core mechanic: desired state + reconciler

Tobi: config files (titles, levels, span-of-control, comp data, market data) → a solver
computes what Shopify should look like → "you hold that up to what is... and the job of
HR is to be this reconciler. How do you take the minimum steps to get from here to
there?" Like React: compute should-be, diff against is, apply minimum steps.

**Summon adoption (this IS the product, named properly):**
- The company config (VITALS_COMPANY_STANDARD: goal, formation, roadmap, budgets,
  policies) = the DESIRED STATE.
- The control plane = the RECONCILER: continuously diff desired vs actual (departments
  without owners, stages without evidence, budgets vs spend, tasks without stars) and
  emit the minimum steps as tasks.
- The diagnosis loop (VIT-11/71) = the diff computation. The CEO autopilot is the
  reconciler's voice.
- Killer property Tobi names: LEGIBILITY REMOVES POLITICS. "I need 50 salespeople" →
  the system shows the counterfactual cost ("that means losing engineers"). Summon
  equivalent: every hire/spend proposal renders its counterfactual from the config
  (budget math, formation balance) before the board decides. Decisions get easy
  because consequences are computed, not argued.

## The mechanics worth stealing (ranked)

1. **Phase transitions with AI-predicted reviews.** Shopify projects move
   prototype → proposal → build → release through explicit gate MEETINGS, and teams
   "can use an AI to preview what the transition will be like because it's trained on
   all the other reviews I've ever done... they can mock-do it and figure out what I
   will probably say." → Summon: agents pre-check their evidence against the BOARD'S
   DECISION LOG before requesting review; the CEO's packaging (VIT-72) predicts the
   board's answer and says so on the card ("board approved 4 similar; likely yes").
   The decision log becomes training data for faster decisions. Autonomy is traded
   for accountability at phase gates — exactly Summon's approval doctrine.
2. **Rederive from axioms when an assumption breaks.** COVID: "all plans are
   invalidated... prune back the decision tree and rederive." → Summon: the config
   records WHY (decisions log with revisit conditions — already in the vitals schema);
   when a revisit condition fires, the CEO re-runs diagnosis from the goal down, not
   from the backlog forward.
3. **Teams of five.** "Shopify loves the five-person team... best team size is one...
   each gradation is a 10x loss of productivity." → Summon: one accountable agent per
   problem (already doctrine); sub-agent squads cap at ~5 per mission (VIT-43
   delegation); the formation view shows squad size as a health signal.
4. **Attention is the resource (StarCraft).** "Attacking other people's attention is
   more profitable than attacking their base... I have six agents going; my attention
   is paid to the one working on what I really need, with a critic watching all of
   them." → Summon: the board's attention is the scarcest input. The scoreboard +
   decision queue ARE the attention router: one critic surface (CEO autopilot)
   watching all lanes, the board zooming into exactly one. Never present the board
   two surfaces that compete for the same decision.
5. **Comp sliders → budget agency.** Shopify lets employees re-slider salary/stock/
   cash quarterly ("full agency"). → Summon: per-employee budget caps + model chains
   are the board's sliders; later, customer-facing: each hired AI employee's
   spend/effort slider with computed consequences.
6. **"Company engineer" + irritants on top.** Executives must articulate yearly how
   their function is done DIFFERENTLY and why better; founders/irritants get put in
   charge, not in daycare. → Summon: each department agent's instructions require a
   stated differentiation thesis for its craft; agents that surface uncomfortable
   evidence get routed to the board, never suppressed (the 11x honesty rule).
7. **Write hit pieces on the past.** Tobi trashes prior systems (his own included) to
   strip deference before rebuilds. → Summon: before any Run-N rebuild, the owning
   agent writes a short hit piece on the current system's failures as part of the
   proposal (energy without blame — work is in the commons, stewardship not ownership).

## What NOT to copy

- 8,000-person problems (title taxonomies, span-of-control solving) — Summon companies
  are tiny; the solver's value here is formation/budget/roadmap math, not org charts.
- Physical-space mechanics (pods, noise design) — the desktop app IS the office;
  the analog is surface design, not floor plans.
- Public-company machinery (IPO videos, comp legal blueprints) — later, if ever.

## The one-line takeaway

Summon = a desired-state system for companies, sold as AI employees. Tobi hand-built
one for Shopify and calls it "a large part of Shopify now" — the market's biggest
commerce company validated the category Summon productizes for everyone else.
