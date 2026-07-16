# Best Dashboards — What Summon's Master Dashboard Steals, Enforces, and Bans

**Research date:** 2026-07-16
**Board ruling:** the desktop app is too complex. Three surfaces total: **Dashboard** (home), **Chat** (WhatsApp-style), **Decisions** (tab). This doc specifies the Dashboard.
**Doctrine:** "SimCity where the city is a real company." Chat is the territory; the dashboard is the map. The 11x rule: no metric the logs can't prove.
**Inputs:** software-dashboard canon (Bloomberg, Stripe, Linear, Things 3, Superhuman, Activity Rings, glass cockpit, Mixpanel/Amplitude, Geckoboard), management-game HUDs (Football Manager, SimCity, Cities: Skylines, Civilization, RCT, Two Point Hospital, RTS, idle tycoons), and the simplicity canon (Rams, Tufte, Jobs/Segall, Maeda, Norman, Nielsen, Hick/Miller).

The one-sentence synthesis of all three research passes: **the home screen is earned by (1) the number checked reflexively, (2) the thing acted on right now, and (3) deltas demanding intervention — everything else lives exactly one hop deep, and that demotion only works if the hop is near-free (<100ms).** Every great management HUD implements the same three layers: ambient vitals, spatially-anchored escalating problems, and a single forced-decision queue. The dashboard below is those three layers over real company data.

---

## 1. The 12 Stolen Ideas

### 1. Geckoboard — top-left is the single premium slot; exclusion is ruthless
- **Idea:** Eyes land top-left first; put THE metric there. Size and position encode importance. Cut any metric that doesn't vary or that the viewer can't influence; if content doesn't fit, make a second screen — never shrink tiles. ([geckoboard.com/best-practice/dashboard-design](https://www.geckoboard.com/best-practice/dashboard-design/))
- **Lands in Summon:** The **EKG scoreboard owns the top-left corner** of the vitals strip — the company heartbeat (revenue events pulsing as beats) is the reflexive-check object. Everything else in the strip is sized strictly by decision-importance. Replaces: the current costs/quota panels' equal-weight tile grid, where quota meters got the same visual rank as revenue.

### 2. Stripe — the hero-number card grammar
- **Idea:** 3–4 hero numbers max, each rendered as absolute number + trend delta + sparkline in ~60px of vertical height; the explaining chart is one level below; neutral cards, semantic color reserved for status only. Defeats metric soup. ([support.stripe.com dashboard charts](https://support.stripe.com/questions/dashboard-home-page-charts-for-business-insights?locale=en-GB), [925studios teardown](https://www.925studios.co/blog/saas-dashboard-design-examples-2026))
- **Lands in Summon:** The **market cap panel is one Stripe-grammar hero card**: valuation number + Δ since yesterday + 30-day sparkline. The vitals strip holds at most four heroes total (see Zone A). Replaces: any ambition to give market cap its own page or chart region — the full valuation model is the one-click drill-down, not home-screen furniture.

### 3. Mixpanel Metric Trees / Amplitude North Star — the vitals strip is a causal tree, not a list
- **Idea:** North Star on top at full prominence; input metrics below it, each positioned as an explanation of the layer above, so every number answers "why did the number above me move." Drill-down becomes structural, not ad hoc. ([mixpanel.com/blog/metric-tree](https://mixpanel.com/blog/metric-tree/), [amplitude.com North Star](https://amplitude.com/books/north-star/amplitudes-north-star-metric-and-inputs))
- **Lands in Summon:** The vitals strip is **ordered causally left→right: Market Cap ← MRR (EKG) ← pipeline/tasks-shipped ← agent utilization**. Clicking any hero opens its input breakdown (level 2), and each input is itself log-provable. Replaces: the flat, disconnected KPI tiles of the current costs panel — numbers that showed WHAT but never WHY.

### 4. SimCity RCI bars — ambient pressure bars, deliberately vague
- **Idea:** Three demand bars displayed at all times at the bottom of the screen; a glanceable trend indicator by design — direction of pressure, not precision. Detail lives in advisor panels. ([RCI bar](https://gamefaqs.gamespot.com/ds/946603-simcity-creator/answers/7416-what-is-the-rci-bar), [Simtropolis on RCI vagueness](https://community.simtropolis.com/forums/topic/761478-those-stretchy-rci-graph-demand-bars/))
- **Lands in Summon:** The EKG scoreboard's supporting row: **3 always-on pressure bars — Demand (open pipeline), Capacity (agent load), Cash (runway direction)** — rendered as bars, not numbers. They answer "where is pressure building" at a glance; exact figures are one click deep. Replaces: precise-but-ignored quota percentages scattered across panels. Direction beats decimals on the glance layer.

### 5. Glass cockpit PFD — fixed spatial hierarchy; mission-critical info never moves
- **Idea:** The Primary Flight Display keeps every basic-T instrument in the same relative position across decades, so the scan pattern becomes muscle memory: "quicker scan patterns, lower workload." Tesla is the counterexample — menu-buried controls force visual search and eyes-off-road. ([skybrary.aero/glass-cockpit](https://skybrary.aero/articles/glass-cockpit), [nngroup.com Tesla case study](https://www.nngroup.com/articles/tesla-big-touchscreen/))
- **Lands in Summon:** The five zones (§3) have **fixed, never-rearranged positions**. No drag-and-drop panes, no customizable layout, no responsive re-flow that moves zones. The founder's morning scan becomes muscle memory in a week. Replaces: the desktop app's 8-pane-type drag-and-drop layout — configurability was the complexity the board killed.

### 6. Bloomberg + Linear — temporal density: speed IS hierarchy
- **Idea:** Bloomberg's real superpower is that dense screens load with zero latency and keyboard commands navigate dozens of views in milliseconds ([mattstromawn.com/writing/ui-density](https://mattstromawn.com/writing/ui-density/)). Linear's sub-100ms transitions let a plain triaged list be the home screen, because moving anywhere is free ([performance.dev Linear breakdown](https://performance.dev/how-is-linear-so-fast-a-technical-breakdown)). Demoting anything to level 2 is only legitimate when retrieval is near-free.
- **Lands in Summon:** A hard **100ms budget on every hop**: Dashboard↔Chat↔Decisions tab switches, and every level-2 drill (agent card → agent detail, hero → inputs). All dashboard data is pushed/cached — the home screen never shows a spinner. Replaces: nothing visible — it's the invisible contract that makes the whole 3-surface consolidation viable. If hops are slow, everything creeps back onto one screen and we rebuild the monster the board just killed.

### 7. Civilization tech tree — the roadmap is a tech tree with staggered, visible ETAs
- **Idea:** The tech tree is "the heartbeat that keeps players moving" — always something desirable within a couple of turns; one-more-turn compulsion comes from overlapping timers so a new thing is always about to complete just before a natural stopping point. ([gamedeveloper.com Techs of Civilization](https://www.gamedeveloper.com/design/techs-of-civilization), [one-more-turn analysis](https://kangmu.wordpress.com/2017/04/02/whats-the-basis-of-one-more-turn-syndrome/))
- **Lands in Summon:** The **8-stage roadmap zone**: eight identical progress bars, each with a log-derived % and a projected ETA ("Stage 3 — 71% — ~4 days"). Stages are decomposed so milestone ETAs **stagger** — something is always about to finish. Replaces: the standalone roadmap *page*. The roadmap is now a zone you glance at, not a place you visit.

### 8. Apple Watch Activity Rings — convert continuous metrics into closable shapes
- **Idea:** "A ring is either closed or not closed" — binary completion states create the loop; raw counters that always grow never resolve and never motivate. Three rings max at glance distance; the numbers live one tap deeper. ([developer.apple.com activity rings HIG](https://developer.apple.com/design/human-interface-guidelines/activity-rings), [apple.com/watch/close-your-rings](https://www.apple.com/watch/close-your-rings/))
- **Lands in Summon:** Two applications: (a) each **roadmap stage bar closes** — hits 100%, seals with a completion state, permanent; (b) the EKG scoreboard carries **one daily ring: "green day"** (revenue event logged today, from Stripe webhooks — provable). The glance layer answers done/not-done; how-much is the tap layer. Replaces: ever-growing counters ("1,204 tasks completed") that resolve nothing.

### 9. Football Manager squad screen — the org chart is a formation with star-rated player cards
- **Idea:** FM's pull is the manager fantasy: a squad screen where each player card carries 1–20 attributes surfaced by assigned position, formations are drag-and-drop, and SI's own telemetry showed players live in the Inbox, not the Home screen — so FM26 merged them into the Portal with action panels. ([footballmanager.com FM26 UI](https://www.footballmanager.com/fm26/features/fm26s-reimagined-user-interface), [passion4fm attributes](https://www.passion4fm.com/football-manager-player-attributes/))
- **Lands in Summon:** The **formation zone: 8 departments as a squad formation**, each department card = agent avatar + status dot + current task line + star ratings (0–5, matching the Summon Score scales) for output, reliability, cost-efficiency — every star computed from run logs (11x rule). Clicking a card opens agent detail as the level-2 drill. The FM telemetry lesson also validates the 3-surface split: decisions live in the **Decisions tab** (the Portal), not buried in the dashboard. Replaces: the formation *page* and the separate agent-detail *page* as top-level destinations.

### 10. Cities: Skylines iconology + RTS idle-worker alert — problems anchored where they live, escalating if ignored
- **Idea:** Skylines floats problem icons above the specific affected building; prolonged neglect turns them red and the building is abandoned; no icon = healthy ([skylines.fandom.com/wiki/Iconology](https://skylines.fandom.com/wiki/Iconology)). RTS design's most transferable mechanic is the idle-worker alert — wasted capacity screams ([gamedeveloper.com strategy UI dos and don'ts](https://www.gamedeveloper.com/design/ui-strategy-game-design-dos-and-don-ts)).
- **Lands in Summon:** Problems render as **badges on the exact department card in the formation** — never in a global notification tray. Age-based escalation: yellow at 1h unresolved, red at 24h, and a red-24h problem visibly stalls the linked roadmap bar (real consequence). An **idle agent gets an idle badge** — paid-for AI capacity doing nothing is the #1 waste signal. Absence of badges IS the "all green" report. Replaces: toast notifications and a notification center; spatial anchoring replaces the tray.

### 11. Civilization's morphing Next Turn button — the Decision badge is one primary action
- **Idea:** Civ's End Turn button morphs into the pending required decision ("choose research," "unit needs orders"), is disabled until decisions are made, and clicking it teleports you to the decision. One control turns a dashboard into a game loop. ([steamcommunity Civ discussion](https://steamcommunity.com/app/289070/discussions/0/312265327165650851/), [civfanatics](https://forums.civfanatics.com/threads/end-turn-instead-of-next-turn-problem.622711/))
- **Lands in Summon:** The **Decision badge — the dashboard's single primary action**, fixed top-right. It morphs to show the next blocking decision by name ("Approve pricing-page PR" / "3 decisions waiting") and clicking it jumps straight into the Decisions tab at that item. When the queue is empty it reads "All clear — advance" and shows the next staggered ETA. Replaces: per-panel action buttons and approval prompts scattered through issue threads. One button, one loop.

### 12. Idle-tycoon return loop — the "while you were gone" recap, honest edition
- **Idea:** The idle-game loop is passive accrual while away plus a return recap; progress bars to attainable milestones make goals feel near; loss aversion powers retention. ([thebillionaireempire.org idle psychology](https://thebillionaireempire.org/blogs/how-idle-games-use-psychology), [designthegame idle deep-dive](https://www.designthegame.com/learning/courses/course/designing-mobile-idle-genre/a-deep-dive-idle-genre-game-design))
- **Lands in Summon:** An AI company literally runs while the founder sleeps — so the dashboard's return state is a **"While you were gone" strip across the vitals zone on first open of the day**: revenue events, tasks shipped, decisions queued, all pulled from logs (this is the HONEST version of idle-game offline earnings — Summon is the rare product where it's true). One dismiss, then normal vitals. Replaces: cold-opening onto a static dashboard and making the founder reconstruct the night from chat scrollback.

---

## 2. Simplicity Gates (mechanical — a design agent applies these as pass/fail)

Every element proposed for the Dashboard must pass ALL gates. Failing one gate means shrink, demote, or delete — in that order of preference reversed: prefer delete (Maeda SHE + Segall's Simple Stick, [lawsofsimplicity.com](https://lawsofsimplicity.com/), [Simple Stick](https://medium.com/@PRHDigital/the-simple-stick-ec0ddd4f7005)).

| # | Gate | Test | Source |
|---|------|------|--------|
| G1 | **Daily-action test** | Does the founder act on or check this element daily? No → not on the home screen; demote to level 2 or delete. | Nielsen frequency rule + Jobs' "saying no to a thousand things" ([nngroup progressive disclosure](https://www.nngroup.com/articles/progressive-disclosure/)) |
| G2 | **Data-ink test** | Erase the pixel: is data or an affordance lost? No → erase it. Card borders, shadows, chart backgrounds, duplicate legends, icons restating labels all fail. | Tufte ([data-ink principles](https://jtr13.github.io/cc19/tuftes-principles-of-data-ink.html)) |
| G3 | **Two-level max** | Dashboard = level 1. One labeled drill-down = level 2. Anything needing level 3 means the design is wrong — restructure, don't nest. | Nielsen ([progressive disclosure](https://www.nngroup.com/articles/progressive-disclosure/)) |
| G4 | **Choice-count caps** | Max 5 zones on the dashboard. Max 7 visible chunks per zone (a chunk = one visually grouped unit). Max 4 hero numbers in the vitals strip. Exactly 1 primary action (the Decision badge). Lists >7 get grouped or truncated with "+N more", never rendered flat. | Hick/Miller ([lawsofux.com/millers-law](https://lawsofux.com/millers-law/), [Hick's law](https://euleinstitute.com/en/blog/hicks-law/)) |
| G5 | **Norman-door test** | If an element needs a tooltip, label, or onboarding hint to explain HOW to use it, it's a Norman door — fix the signifier or cut the element. Clickable things look clickable; nothing is hover-only. | Norman + Rams #4 "self-explanatory" ([ixdf Norman doors](https://ixdf.org/literature/article/your-gateway-to-ux-design-norman-doors), [vitsoe.com/us/about/good-design](https://www.vitsoe.com/us/about/good-design)) |
| G6 | **Shrink before hide, hide before keep** | Feature under pressure? First try shrinking it (sparkline instead of chart, badge instead of panel). Then hiding it (level 2). Deleting beats both. Track a **removal ledger** in the PR description — being proud of what was removed is the KPI. | Maeda SHE + Segall ([lawsofsimplicity.com](https://lawsofsimplicity.com/)) |
| G7 | **Small-multiples rule** | Repeated data renders as the SAME component at the SAME scale: 8 roadmap bars identical, 8 department cards identical, all sparklines share axis rules. Never 8 bespoke widgets. | Tufte small multiples ([visualization handbook](https://garygisclair.github.io/visualization-design-handbook/index.html)) |
| G8 | **Time-to-answer metric** | The #1 daily question — "is the company okay and what needs me?" — must be answered in 0 clicks and under 5 seconds from app focus. Measure it; perceived simplicity = time-to-answer, not whitespace. | Maeda Law 3 TIME ([lawsofsimplicity.com](https://lawsofsimplicity.com/)) |
| G9 | **Decision-critical numbers stay on level 1** | Any number the founder must see BEFORE acting on a queued decision (cost of the run, quota remaining, blast radius) is never behind disclosure. | Nielsen ([progressive disclosure](https://www.nngroup.com/articles/progressive-disclosure/)) |
| G10 | **11x gate (log-provable)** | Every number, star, bar-%, streak, and badge on the dashboard must be traceable to a log query. If the logs can't prove it, it doesn't render. No vibes-based stats, no estimated XP. | Summon doctrine |
| G11 | **Speed budget** | Surface switches and level-2 drills complete in <100ms perceived. A demotion to level 2 is only approved if this budget holds; otherwise the element stays on level 1 or dies. | Bloomberg/Linear/Superhuman ([ui-density](https://mattstromawn.com/writing/ui-density/), [Linear breakdown](https://performance.dev/how-is-linear-so-fast-a-technical-breakdown), [Superhuman speed](https://blog.superhuman.com/superhuman-is-built-for-speed/)) |
| G12 | **80% rule** | The founder's daily loop (check vitals → scan formation → clear decisions) completes without opening any drawer, menu, or level-2 view. Drills are for investigation, never for the routine. | Nielsen ([Substack: progressive disclosure](https://jakobnielsenphd.substack.com/p/progressive-disclosure)) |

Regime call (from the cross-cutting synthesis): Summon's founder checks this screen dozens of times a day and will be highly trained within a week → the dashboard earns **fixed-position density** (Bloomberg/PFD regime) at the layout level, but each zone internally follows **consumer-calm restraint** (Stripe/Things regime: few numbers, closable shapes). Density is fine; hunting is not.

---

## 3. The One-Screen Mission Control Layout

```
┌──────────────────────────────────────────────────────────────────────────┐
│ ZONE A · VITALS STRIP                                    [E] DECISION ◉  │
│ ┌EKG───────────┐ ┌MARKET CAP──┐ ┌MRR────────┐ ┌RUNWAY─────┐  "Approve   │
│ │ ♥ heartbeat  │ │ $X  Δ  ⎍⎍⎍ │ │ $X Δ ⎍⎍⎍  │ │ Nd Δ ⎍⎍⎍  │   pricing   │
│ │ ▂▅▂▇▂ +ring○ │ └────────────┘ └───────────┘ └───────────┘   PR" →     │
│ │ D▓▓ C▓ $▓▓   │  (while-you-were-gone strip renders here on first open) │
│ └──────────────┘                                                         │
├───────────────────────────────────────────┬──────────────────────────────┤
│ ZONE B · FORMATION (8 departments)        │ ZONE C · ROADMAP (8 stages)  │
│  ┌ENG ●┐ ┌DES ●┐ ┌PRD ●┐ ┌MKT ⚠┐         │  1 ████████████ closed ✓     │
│  │★★★★ │ │★★★  │ │★★★★ │ │★★   │         │  2 ████████████ closed ✓     │
│  └─────┘ └─────┘ └─────┘ └─────┘         │  3 ████████▁▁▁ 71% ~4d       │
│  ┌SLS ●┐ ┌FIN ●┐ ┌OPS zZ┐ ┌SUP ●┐        │  4 ███▁▁▁▁▁▁▁▁ 24% ~9d       │
│  │★★★  │ │★★★★ │ │★★ idle│ │★★★ │        │  5–8 ▁▁▁ locked              │
│  └─────┘ └─────┘ └──────┘ └─────┘        │                              │
│  card = avatar·status dot·current task    │  identical bars, staggered   │
│  line·star ratings·problem badges         │  ETAs, stages close forever  │
├───────────────────────────────────────────┴──────────────────────────────┤
│ ZONE D · TASK QUEUE (top 7 by Summon Score)                              │
│  1. ▸ Ship pricing page      ★4.6  ENG   [→chat]                         │
│  2. ▸ Outbound batch #3      ★4.1  SLS   [→chat]        ...+12 more →   │
└──────────────────────────────────────────────────────────────────────────┘
```

Fixed grid, never rearranged (glass cockpit, idea #5). Five zones (G4). Every number log-backed (G10).

### Zone A — Vitals Strip (top edge, full width)
- **Top-left premium slot: the EKG scoreboard** (idea #1) — live company heartbeat: each revenue/major event from the logs draws a pulse; flatline is visible truth. Beneath it, the 3 SimCity pressure bars (idea #4): Demand / Capacity / Cash direction. One daily "green day" ring (idea #8).
- **Right of EKG: max 3 more hero cards** in Stripe grammar (idea #2): **Market Cap** (number + Δ + sparkline), **MRR**, **Runway**. Ordered causally left→right per the metric-tree rule (idea #3); clicking a hero opens its input breakdown (level 2).
- First open of the day: the **"While you were gone" strip** (idea #12) overlays here, one dismiss.
- Hard cap: 4 heroes (G4). Anything else that wants in must evict one.

### Zone B — Formation (center-left, largest zone)
- **8 department cards in a squad formation** (idea #9), identical component (G7): agent avatar, status dot (working / idle / blocked / awaiting-review), one live line of current work ("editing `pricing.ts`"), 0–5 star ratings computed from run logs.
- **Problem badges anchor here** (idea #10): yellow→red age escalation on the affected card; idle agents get the idle badge; no badge = healthy. There is no separate notification tray.
- Click a card → agent detail (level 2): full attributes, spend by task/model, permission tier, run history.

### Zone C — Roadmap (right column)
- **8 identical progress bars** for the 8 stages (ideas #7, #8): log-derived %, projected ETA, deliberately staggered so something is always ~days from closing. Completed stages seal with a closed state and never reopen.
- Current stage visually dominant; future stages dim/locked (tech-tree grammar). Click a stage → its task breakdown (level 2).

### Zone D — Task Queue (bottom strip)
- **Top 7 tasks by Summon Score** — `(money + time + importance) × urgency / (effort × human attention)`, all 0–5 — shown as one composite star number per row + owning department + jump-to-chat affordance. This is Things 3's "Today" ([culturedcode.com/things/features](https://culturedcode.com/things/features/)): a **decision already made**, not an inventory. The full ranked backlog and per-factor star breakdown are level 2 ("+N more").
- Never render the whole backlog here (G4); the queue re-sorts as logs update scores.

### Zone E — Decision Badge (fixed top-right)
- **The single primary action** (idea #11): morphs to name the next blocking decision, shows queue count, one click jumps into the Decisions tab at that item. Empty state: "All clear — advance" + next staggered ETA. FM's telemetry says this is where the founder will actually live ([FM26 Portal](https://www.footballmanager.com/fm26/features/fm26s-reimagined-user-interface)) — the badge is the bridge from map to loop.

### What got DELETED from the current IA, and why

| Deleted | Was | Why it dies |
|---|---|---|
| **Formation page** | Top-level view | Becomes Zone B. A monitoring surface you glance at doesn't earn navigation (G1); Tesla lesson — always-needed state never goes behind a menu (idea #5). |
| **Roadmap page** | Top-level view | Becomes Zone C, same reason. |
| **Costs/quota panels** | Top-level panels | Folded: direction-of-pressure into Zone A bars; per-agent spend into agent detail (level 2). Precise quota percentages failed G1 — checked rarely, actioned rarer. |
| **Agent detail page** | Top-level destination | Demoted to level-2 drill from a formation card. Legitimate only because of the 100ms budget (G11). |
| **Issue chat threads as entry points** | Primary work surface | Move under the **Chat surface** (the territory). The dashboard links into chat; chat is not dashboard furniture. |
| **Notification tray / toasts** | Global overlay | Replaced by spatially-anchored badges on formation cards (idea #10) + the Decision badge. Two attention channels, both anchored. |
| **Drag-and-drop pane layout** | 8 pane types, configurable | Killed outright. Fixed spatial hierarchy (idea #5) — configurability was the complexity. Users compose in Chat, not in layout. |
| **Sidebar navigation** | Session/view list | Three surfaces = three tabs. Hick's law: 3 < 7 (G4). |
| **Model/effort/permission chrome on the dashboard** | Composer-adjacent controls | Lives only inside Chat composers and agent detail. Dashboard is read-and-decide, not configure (Rams #6: a tool, not a cockpit for settings). |

---

## 4. The Gamification Line

The compulsion is legitimate exactly when the meter maps to a real business variable and curdles into a dark pattern the moment it detaches ([Decision Lab, streak creep](https://thedecisionlab.com/insights/consumer-insights/streak-creep-the-perils-of-too-much-gamification)). Summon's structural advantage: the game state IS the company state, so honest gamification is available for free. The 11x gate (G10) is the line-enforcer — if the logs can't prove it, it can't compel with it.

### Compels (allowed — all log-backed)
- **Real progress bars to attainable milestones:** roadmap stage %, "next customer," "$1K MRR — 68%." Idle-game psychology on real numbers ([idle psychology](https://thebillionaireempire.org/blogs/how-idle-games-use-psychology)).
- **Closable shapes:** stages that seal, the daily green-day ring. Done/not-done at glance distance ([Apple rings HIG](https://developer.apple.com/design/human-interface-guidelines/activity-rings)).
- **Streaks only where the streak IS the business metric:** consecutive green-revenue days straight from Stripe webhooks. Never streaks of app opens.
- **Rank flips:** department star ratings re-sort the formation when log-proven output changes — FM squad dynamics on real work (idea #9).
- **Staggered ETAs:** something always about to complete (Civ's carrot, idea #7) — engineered by decomposing stages, not by inventing timers.
- **The morphing Decision badge:** the loop comes to the founder; clearing the queue is the "turn" ([Civ Next Turn](https://steamcommunity.com/app/289070/discussions/0/312265327165650851/)).
- **"While you were gone":** the honest offline-earnings screen — true for an AI company (idea #12).
- **Visible happiness→revenue chains:** if customer sentiment is instrumented later, RCT-style — each complaint names its fix, composite rating from real inputs ([RCT guest thoughts](https://mechanicsingames.wordpress.com/2019/07/12/guest-thoughts-roller-coaster-tycoon/)).

### Banned (dark patterns)
- **Fake urgency:** countdowns, accelerating flame animations, end-of-day guilt pushes. Urgency indicators render ONLY when a real external deadline exists in the logs ([Duolingo critique](https://dev.to/pocket_linguist/why-duolingos-gamification-works-and-when-it-doesnt-1d4)).
- **Decorative XP / points / levels:** any number not convertible to money, time, or shipped work. Fails G10 by definition.
- **Streak-freeze mechanics / monetized anxiety:** never sell relief from a meter we invented ([screenwise on streak anxiety](https://screenwiseapp.com/guides/duolingo-streaks-and-anxiety-in-kids)).
- **Illusory progress counters:** "566 sessions"-style activity metrics that mask zero outcome growth. Counters that only ever grow are banned on level 1 (idea #8's inverse).
- **Punishing disengagement:** no progress resets, no red shame badges for days away — Things 3 rolls unfinished work forward silently ([culturedcode](https://culturedcode.com/things/features/)). The founder stepping back is a feature of owning an AI company, not a sin.
- **Mascot guilt / notification nagging:** notifications fire on done / blocked / question only (the Codex three-class taxonomy from the prior research pass), never on "you haven't visited."

**The test in one line:** would the meter still make sense printed in a board report? Revenue streak yes; login streak no.

---

## 5. Anti-Patterns (from all three research passes — each one a way this project fails)

1. **Metric soup:** a wall of equal-weight widgets where nothing is the headline. Stripe's grammar and the 4-hero cap exist to kill this ([925studios](https://www.925studios.co/blog/saas-dashboard-design-examples-2026)).
2. **The Tesla move:** burying always-needed state behind menus or making layout rearrangeable — forces visual search on every glance ([nngroup Tesla](https://www.nngroup.com/articles/tesla-big-touchscreen/)).
3. **The Jira regime:** every deeper view costs a click plus a wait, so everything crowds onto one screen. Slow hops recreate the complexity the board killed ([Linear vs Jira](https://performance.dev/how-is-linear-so-fast-a-technical-breakdown)).
4. **The 'clean redesign' trap:** whitespace-driven redesigns that look better and answer slower. Bloomberg's users defend density because value density = value per unit of user time ([ui-density](https://mattstromawn.com/writing/ui-density/)).
5. **Scatter (Planetary Annihilation):** information spread across the screen with no fixed grammar — consolidate; reserve a stable region per concern ([strategy UI dos/don'ts](https://www.gamedeveloper.com/design/ui-strategy-game-design-dos-and-don-ts)).
6. **Dashboard-as-destination when the inbox is the loop:** FM's telemetry showed the Home screen "saw limited use" — a vitals-only dashboard with no Decision badge would be a screen people admire once and never revisit ([FM26](https://www.footballmanager.com/fm26/features/fm26s-reimagined-user-interface)). The badge is not optional.
7. **8 bespoke widgets:** differently-styled charts per department/stage — comparison becomes mental math. Small multiples or nothing (G7).
8. **3+ disclosure levels:** users get lost; if a design needs level 3, the structure is wrong (G3) ([nngroup](https://www.nngroup.com/articles/progressive-disclosure/)).
9. **Hiding decision-critical numbers:** an approval card whose cost/blast-radius lives one click away trains rubber-stamping (G9).
10. **Streak creep:** users optimizing the streak instead of the business; a broken streak causing product abandonment ([Decision Lab](https://thedecisionlab.com/insights/consumer-insights/streak-creep-the-perils-of-too-much-gamification)).
11. **Raw ever-growing counters as motivation:** no completion state → no loop, no glanceability ([Apple rings](https://developer.apple.com/design/human-interface-guidelines/activity-rings)).
12. **Norman doors:** cards that don't look clickable, hover-only actions, icon mysteries needing tooltips (G5) ([ixdf](https://ixdf.org/literature/article/your-gateway-to-ux-design-norman-doors)).
13. **Vibes-backed stats:** any dashboard number an engineer can't reproduce with a log query. Breaks the 11x rule and, worse, breaks founder trust in the whole map the first time it's caught lying.

---

## Research caveats
- Linear's "3.7x faster than Jira," Superhuman's <50ms internal target, and Stripe's exact home-card layout come from secondary teardowns, not verified primary sources; treat as directional.
- The Apple "ring is either closed or not closed" quote circulates via secondary coverage (Jay Blahnik era); primary interview not located.
- Nielsen's "80% of tasks without opening anything" is a rule of thumb from his 2026 progressive-disclosure piece, not a measured constant.
- Miller's 7±2 is revised downward by later research (Cowan 2001: ~4 chunks) — use it as a chunking heuristic, not a memory law.
- No A/B or retention data exists on which HUD mechanic drives engagement most; all compulsion claims are design-analysis based.
- Stephen Few's *Information Dashboard Design* (single-screen rule, bullet graphs) was not covered and would strengthen §2 in a follow-up pass.
