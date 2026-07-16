# Agent Command Center — The Design Spine for summon.company

**Research date:** 2026-07-16
**Board brief:** "Ruthlessly minimal. Signal, not noise. Everything has a reason for being there. And BEAUTIFUL."
**Scope:** the aesthetic + intentionality layer for Summon's three surfaces — **Dashboard / Mission Control** (home), **Chat** (WhatsApp-style), **Decisions** (approval queue). This doc does not re-specify layout; `BEST-DASHBOARDS.md` owns the Dashboard grid and `DESKTOP-UX-SKELETONS.md` owns the IA, Chat, and Decisions mechanics. This doc governs **how all three look, what earns a pixel, and how the DESIGN.md keeps that honest over time.**

**One-sentence thesis:** a command center for a founder supervising AI employees answers ONE question first — *which of my agents needs me right now* — and every design decision below either sharpens that answer or is deleted. Beauty is not decoration here; it is the absence of everything that isn't that answer. The canon and the Sequoia peer set agree on the same move: **the defining decision is almost always a subtraction.**

---

## 1. Sequoia's Command-Center Ideas Worth Adopting

Sequoia publishes no first-party wireframes; its value is the *thesis* plus the peer-convergence signal from its portfolio and the broader 2026 agent-console field. Each idea below maps to a Summon surface with its evidence URL. (Honesty flag: the "Agent Inbox" is LangChain's design surfaced via Sequoia's podcast, not a Sequoia-authored UI; the "agent org chart" is NOT a Sequoia framework — Buhler describes peer-to-peer *swarms*, not hierarchy.)

| # | Sequoia / peer idea | The move to steal | Lands in Summon | Evidence |
|---|---|---|---|---|
| S1 | **The Agent Inbox** (Harrison Chase / LangChain) — inbox-style command center for async human-in-the-loop with **four modes: approve/reject, edit-before-execute, answer-when-stuck, time-travel**. | An approval queue is the home of the relationship, not a notification tray. Four verbs, not one. | **Decisions surface.** The four modes become the verb set: `1` approve, `2` edit (comment-on-diff, resubmit), `3` reject, plus *answer* for agent questions and *time-travel* into a run's step N inside agent detail. | https://sequoiacap.com/podcast/training-data-harrison-chase-2/ · https://github.com/langchain-ai/agent-inbox |
| S2 | **Ambient agents** — agents that "listen to an event stream and act on it," so approval requests *accumulate* because the human isn't watching. | Design for absence. The primary surface must assume the founder was away; requests pile up and must be *prioritized*, never *streamed*. | **Decisions = a drainable queue** with depth + avg time-to-decision in the header; **Dashboard "While you were gone"** strip on first daily open. Both are honest because an AI company literally runs overnight. | https://sequoiacap.com/podcast/training-data-harrison-chase-2/ |
| S3 | **Copilot vs Autopilot / "an autopilot sells the work"** (Services: The New Software) — the customer buys the finished outcome, not the tool. | Show outcomes, not process. The interface sells the *work delivered*, not the machinery. | **Chat defaults to Summary mode** (final deliverable, not tool-by-tool logs); **Dashboard shows shipped work / market-cap**, never token streams. Verbose is one keypress down for audits. | https://sequoiacap.com/article/services-the-new-software/ |
| S4 | **Service-as-a-software + outcome-based pricing** (Generative AI's Act o1) — labor turned into software, priced by outcome not seat. | Frame the numbers as *company value*, not usage. | **Market Cap / MRR / Runway** as the Dashboard's hero grammar; per-employee **$99/mo** economics rendered against outcomes, not raw compute. | https://sequoiacap.com/article/generative-ais-act-o1/ |
| S5 | **Long-horizon agents / "answer engine → action engine"** (2026: This is AGI; AI 50 2025) — agents work autonomously for hours, "making and fixing their mistakes"; reliability measured in minutes-of-autonomous-work. | Surface *duration and reliability* as first-class state — an employee that ran unattended for 3h is the product. | **Formation cards** carry a live activity line + run duration; **agent detail** shows reliability trend (a star from run logs, 11x-provable). | https://sequoiacap.com/article/2026-this-is-agi/ · https://sequoiacap.com/article/ai-50-2025/ |
| S6 | **The Agent Economy — three pillars: persistent identity / communication protocols / trust** (Buhler, AI Ascent 2025); "the people work with the agents." | Persistent, named identities that *earn* trust over time — not anonymous sessions. | **Employees are persistent objects** (the Summon differentiator); the **Trust tab** on agent detail is an accumulating "always-allowed" track record — literally an employee earning autonomy. | https://sequoiacap.com/article/ai-ascent-2025/ |
| S7 | **Roster/Kanban with an explicit STATE machine** — Devin's "Agent Command Center" (Running / Waiting-for-review / Done) where "the command center is what you see first, code comes second." | Make *"waiting for review"* a first-class column so human-attention items can't hide. | **Formation** groups employees by state (Working / Blocked-on-you / Idle / Resting); **Decisions** is the "waiting for review" column promoted to its own surface. | https://devin.ai/desktop |
| S8 | **Collapse parallelism into one surface** — Cursor 3.0 Agents Window: "three agents used to mean three browser tabs… now one panel with three rows." | N parallel agents = one panel, one scan. Never one-window-per-agent. | **Formation is the single panel**; the founder never opens N windows to see N employees. | https://www.learncursor.dev/learn/cursor-agents/agents-window |
| S9 | **Explicit per-session state labels** — Claude Code Agent View's six states (working / waiting-for-input / completed / failed / idle / stopped). | One canonical, small state vocabulary rendered as a dot — no bespoke status strings. | Summon's status-dot vocabulary is fixed and semantic (§4): working / blocked-on-you / idle / resting / failed. Color + shape, never color alone. | https://www.testingcatalog.com/anthropic-adds-agent-view-for-claude-code-for-parralel-work/ |
| S10 | **Replayable timeline / "glass box"** — Manus streams work in the open and lets you roll back the timeline to see exactly how a result was produced. | Trust comes from *replay*, not from a live spinner you're forced to watch. | **Agent detail → Activity** is a replayable run log (time-travel from S1); the Dashboard never streams — it summarizes and lets you drill to the replay. | https://securityboulevard.com/2026/06/what-is-manus-ai-the-general-ai-agent-explained-2026/ |
| S11 | **Task-shaped rendering** — Factory Droids "decide how to present their work" (diagram, table, chart) instead of a uniform log. | Let an employee's output render in its natural form, but only inside the detail level — never as Dashboard chartjunk. | Deliverables render task-appropriately **inside Chat/agent-detail**; the Dashboard stays uniform small-multiples (see §4 borderless-hierarchy rule). | https://factory.ai/product/desktop |
| S12 | **Governance layer + continuous visibility** — Decagon AOPs (plain-language policy + hard guardrails); Cresta keeps supervisor visibility *across* the AI→human handoff; Relevance AI treats cost/credit + an error timeline as first-class views. | Policy and cost are surfaces, not settings buried in a menu; never drop context at escalation. | **Costs** surface = per-employee ring + company meters + error timeline; permission profiles (Intern/Employee/Trusted) are the plain-language AOP layer; a Decision item carries the full run context so nothing is lost at handoff. | https://cresta.com/guides/decagon-vs-sierra · https://relevanceai.com/workforce |

**The synthesis Summon builds on:** every serious 2026 command center reduces to (1) a roster of parallel work, (2) an explicit state whose most important value is *needs-you*, (3) isolation so agents don't collide, (4) trust via replay/time-travel, (5) async approvals handled inbox-style. Summon's three surfaces already are this: **Formation** (roster), **Decisions** (needs-you queue + replay), **Chat** (outcome delivery). This doc's job is to make them *beautiful* by making them *empty of everything else*.

---

## 2. The Canon — One Rule Summon Adopts From Each

For each master, the single decision that makes their product feel *inevitable* — and the one enforceable rule Summon takes.

| Product | The inevitable decision | Rule Summon adopts | Evidence |
|---|---|---|---|
| **Dieter Rams / Braun** | "Less, but better" — concentrate on the essential; "as little design as possible." | **Every element must survive a deletion attempt.** If removing it loses no data and no affordance, it is removed, not shrunk. The removal ledger in each PR is a KPI. | https://www.vitsoe.com/us/about/good-design |
| **Stripe** | Craft is a business input, not decoration — utility × usability × beauty must *all* be right; a typography/layout lift on one email raised conversion **20%**. | **Beauty is load-bearing and measured.** Detail work (type, spacing, the human feel of a status transition) is treated as a conversion lever, not polish-if-time. Fight the "gravitational pull toward mediocrity." | https://creatoreconomy.so/p/how-stripe-crafts-quality-products-katie-dill |
| **Linear** | Speed is a design decision — local-first, sub-100ms transitions, "structure should be felt, not seen." | **Chrome recedes; the work dominates.** Nav, tabs, headers are dimmed/low-contrast; every hop is <100ms so demotion-to-level-2 is legitimate. Soften dividers — rounded, low-contrast, "the last 10%." | https://performance.dev/how-is-linear-so-fast-a-technical-breakdown · https://linear.app/now/behind-the-latest-design-refresh |
| **Vercel / Geist** | Aggressive monochrome — "infrastructure should be invisible"; borders drawn as a 1px shadow; display headlines with negative letter-spacing. | **Monochrome + one accent; borders as shadow, not lines.** Palette is black/white/gray; one color does all the semantic work. `box-shadow: 0 0 0 1px rgba(0,0,0,0.08)` over CSS borders. | https://vercel.com/geist/introduction |
| **Things 3** | Calculated restraint — a tiny fixed vocabulary (Today / Upcoming / Anytime / Someday) refuses configurability. | **Fixed vocabulary, no user-configurable layout.** The Decisions queue is a *decision already made* (ranked), not an inventory to configure. Three surfaces, fixed positions, forever. | https://culturedcode.com/things/features/ |
| **Teenage Engineering** | Constraint as the engine — few controls leverage Hick's Law; a five-color palette, monospaced-only type. | **Cap the choices.** Small palette, one type family, a hard ceiling on colors/controls per surface. Fewer options = faster decisions on a screen checked dozens of times a day. | https://blakecrosley.com/guides/design/teenage-engineering |
| **Apple HIG** | Deference — "the interface should never compete with the content." | **The UI disappears behind the company state.** No decorative gradients, glows, or ornament competing with the numbers and the roster. Adornments minimized; focus on function. | https://developer.apple.com/design/human-interface-guidelines/ |
| **Superhuman** | The 100ms rule as product law — every interaction feels instantaneous. | **No spinners on the home screen.** All console state cached locally; the agent event log streams in the background. Agents may be slow; the console may not. | https://blog.superhuman.com/superhuman-is-built-for-speed/ |
| **Raycast** | "The best interface is no interface" — keyboard-first, native, millisecond latency. | **Every action reachable by keyboard.** Cmd+K palette + one-key verbs in Decisions; the mouse is optional, never required. | https://www.raycast.com/ |
| **Arc (Browser Company)** | Opinion IS the signal — refuses to be neutral. | **Summon is opinionated by default.** One golden path (check vitals → scan formation → clear decisions); no "customize your dashboard." The refusal to be configurable is the taste. | https://mothfund.substack.com/p/mm-josh |
| **Notion** | System-first — everything composes from one block primitive; "when you add a brick, it might pollute the whole thing." | **Every new component must compose into the existing system** (same card, same bar, same dot). No bespoke one-off widget that doesn't reuse a documented primitive. | https://designerfounders.substack.com/p/ivan-zhao-notion |
| **Craft** | Native-platform polish is the whole point — animation quality and visual care signal that "someone cared deeply." | **Motion and polish are the differentiator when features commoditize.** GPU-only transitions, sub-100ms, layout properties never animated (Linear's rule) — the feel is the moat. | https://performance.dev/how-is-linear-so-fast-a-technical-breakdown |

---

## 3. The DESIGN.md Upgrade — A Google-Style Source of Truth

Summon's `DESIGN.md` / `DESIGN_SYSTEM.md` must become the enforceable single source of truth so that "everything has a reason" is *provable*, not aspirational. The discipline is Google's design-doc culture applied to a visual system.

### 3.1 Why this works — writing forces clarity

Malte Ubl's canonical "Design Docs at Google" argues the doc's whole purpose is to **surface trade-offs and alternatives before code**, not to be an implementation manual. Grant Slatton's rule: "the biggest value of a design doc is that it forces a clarity" — fuzzy thinking produces fuzzy prose, so weak decisions get exposed on the page before they become expensive pixels. A DESIGN.md that just lists tokens is the *bad* kind of doc (an implementation manual). A DESIGN.md that lists tokens **with the trade-off each one settled** is the design.

- "Design Docs at Google" (Malte Ubl): https://www.industrialempathy.com/posts/design-docs-at-google/
- The self-referential template: https://www.industrialempathy.com/posts/design-doc-a-design-doc/
- "Writing a good design document" (Slatton): https://grantslatton.com/how-to-design-document
- DESIGN.md-as-source-of-truth practice (structure reference): https://github.com/ItamarZand88/design-skills · https://getdesign.md/
- Design-system-doc archetype (Material's three principles): https://m1.material.io/

### 3.2 The required structure

Adapt Ubl's section set to a visual system (nine areas, mirroring the reference Vercel DESIGN.md):

1. **Context & Atmosphere** — what Summon *feels* like in one paragraph ("a glass cockpit for a company that runs while you sleep") and the non-goals ("not an IDE; the human is the board, not the driver").
2. **Color Palette & Roles** — every color categorized *by function* (background / surface / text / semantic-status / the one accent). Zero decorative colors.
3. **Typography Rules** — the type scale, weights, letter-spacing rules stated as laws (e.g. "display headlines carry negative tracking; body is zero — never positive").
4. **Component Stylings** — the documented primitives (hero card, status dot, progress bar, department card, decision item) — each reused, never re-invented.
5. **Layout Principles** — fixed zones, spacing rhythm, the 100ms hop budget.
6. **Depth & Elevation** — borders-as-shadow rule; when elevation is allowed (drill-in drawer) and when it is banned (never on a Dashboard tile).
7. **Do's & Don'ts** — the guardrails that turn taste into enforceable rules (this is the section that makes deviation a lint error, not an argument).
8. **Motion** — durations, GPU-only, never animate layout properties; the "feels human" transitions.
9. **Agent Prompt Guide** — the block that lets a design agent reproduce a component from the doc alone (Summon's differentiator: the DESIGN.md is executable by the same AI employees it describes).

### 3.3 The Intentionality Gate (the enforcement mechanism)

Ubl's test of a real design decision: **if there was no trade-off, there was no design decision worth documenting.** Encode this as a gate every new token/component must pass before it enters the system:

> **A component or token may be added to DESIGN.md only if its entry states (a) the *reason* it exists, (b) the *trade-off* it settles, and (c) the alternative rejected. If there is no trade-off, it is not a decision — it is a default, and defaults do not get bespoke entries.**

Paired with each entry, a **Do's/Don'ts** line that turns the subjective into the mechanical — e.g. *"Don't put positive letter-spacing on the display face; it's always zero or negative"* (the Vercel example). This is what makes "everything has a reason for being there" auditable: any element on screen must trace to a DESIGN.md entry, and any DESIGN.md entry must carry its rationale + trade-off. No rationale → the entry is deleted → the element is deleted. This is the visual-system twin of the Dashboard's **11x rule** (`BEST-DASHBOARDS.md` G10): if the logs can't prove a number, it doesn't render; if the DESIGN.md can't justify an element, it doesn't ship.

---

## 4. Signal-Not-Noise Deletion Rules (Mechanical Pass/Fail Gates)

A designer or design agent runs each proposed element through these gates. **Failing a gate means shrink → hide → delete, in reverse order of preference: prefer delete.** These extend `BEST-DASHBOARDS.md` §2 (which governs the Dashboard) to all three surfaces.

| # | Gate | Mechanical test | Fail action | Source |
|---|---|---|---|---|
| D1 | **The delete test** | Does a user *act on* this, does it carry a *delta*, or is a *decision* attached? If display-only with no action/delta/decision → it doesn't belong. | Delete | https://customerscience.com.au/customer-experience-2/designing-actionable-dashboards-the-5-second-rule-for-executives/ |
| D2 | **One primary action per screen** | Point to the single most important thing to do here. If you can't, or two elements carry equal primary weight → fail. "If every button screams, none get heard." | Demote all but one to secondary/tertiary | https://uxmag.com/articles/usability-tip-one-main-call-to-action-item-per-task · https://carbondesignsystem.com/components/button/usage/ |
| D3 | **Badge-soup / semantic-color-only** | Is every color carrying meaning? Any red/green used decoratively → fail. Every status color must pair with an icon or label (never color alone). | Strip decorative color; add icon/label | https://startingblockonline.org/dashboard-anti-patterns-12-mistakes-and-the-patterns-that-replace-them/ |
| D4 | **Vanity-KPI gate** | Does each metric tile show *trend + delta-vs-target + a next-step/action link*? A "big number" standing alone → fail. | Add context or delete | https://startingblockonline.org/dashboard-anti-patterns-12-mistakes-and-the-patterns-that-replace-them/ |
| D5 | **One hero, not a wall** | Is there exactly one dominant element per view? "One hero chart beats four competing ones." Twenty widgets = metric soup. | Demote or cut the rest | https://www.setproduct.com/blog/dashboard-ui-design |
| D6 | **Redundant-nav / buried-control** | Are filters/controls *beside* the content they affect, with active scope visible? Buried three clicks deep or hidden state → fail. | Move adjacent; surface active scope | https://startingblockonline.org/dashboard-anti-patterns-12-mistakes-and-the-patterns-that-replace-them/ |
| D7 | **Decorative-chart / chartjunk** | Can any pixel be erased without losing data? Borders, backgrounds, gridlines, 3D, glow, drop-shadow, gradient on a chart → erase. Pie/donut with >3 slices → replace with KPI+sparkline. | Erase / replace | https://www.geeksforgeeks.org/data-visualization/mastering-tuftes-data-visualization-principles/ · https://startingblockonline.org/dashboard-anti-patterns-12-mistakes-and-the-patterns-that-replace-them/ |
| D8 | **Competing-CTA** | Does only one element carry primary visual weight (size + placement + weight)? A second would-be-primary control → fail. | Demote to secondary or remove | https://designcourse.com/blog/post/primary-vs-secondary-cta-buttons-in-ui-design |
| D9 | **Two-level-max disclosure** | Does any flow need 3+ nested levels? "Beyond 2 disclosure levels, users get lost." | Restructure — don't add a drawer | https://www.nngroup.com/articles/progressive-disclosure/ |
| D10 | **Borderless-hierarchy** | If you remove this border/box, is meaning lost once type-weight and spacing are set? If not → delete the border. Dividers are "the last 10%," not the first tool. | Delete border; fix with type + space | https://blog.tubikstudio.com/visual-dividers-user-interface/ |
| D11 | **Five-second test** (whole screen) | Can a viewer identify the primary signal, tell good/bad, and know if action is needed within 5 seconds, without scrolling/filtering? If not → too much noise. | Remove components until it passes | https://denottersolutions.com/en/data-insights/dashboard-design-5-seconds-rule/ |
| D12 | **Humanized-units / no-ornament render** | Human units ($, %, ms/s, kB/MB), consistent decimals across cards, flat 1–2px strokes, labels ≥12px. Raw `0.123456`, inconsistent precision, sub-12px labels → fail. | Reformat | https://startingblockonline.org/dashboard-anti-patterns-12-mistakes-and-the-patterns-that-replace-them/ |

**Applied to Summon's three surfaces specifically:**
- **Dashboard** — governed in depth by `BEST-DASHBOARDS.md` G1–G12; D1/D4/D5/D7 are the sharpest cuts (vitals strip: 4 heroes max, each with trend+delta+sparkline; department cards are identical small-multiples).
- **Decisions** — D2 and D8 are law: exactly one primary action (the current top decision), four verbs, nothing competing. D9 keeps the diff/replay one level deep, never three.
- **Chat** — D5 (one outcome per message, Summary mode by default) and D3 (per-employee status dot is semantic, not decorative). No unread-badge inflation.

---

## 5. The Beauty Checklist — The Moves That Make It Feel Inevitable

These are the specific typographic, spatial, and color decisions that deliver the "BEAUTIFUL" half of the brief. Each is a concrete, checkable move — the four craft principles behind Stripe/Linear/Vercel, made specific for Summon.

### 5.1 Typography
- [ ] **One type family, few weights.** A sharp, geometric, slightly cold sans — "no rounded, friendly fonts." Roles are distinguished by *size, weight, case* — not by color chips or boxed containers (typography does the hierarchy work). (https://www.pixeldarts.com/en/post/four-design-principles-behind-stripe-linear-and-vercel)
- [ ] **Negative tracking on display, zero on body, never positive.** Hero numbers (Market Cap, MRR) read "compressed, engineered" with negative letter-spacing; body stays at zero. Documented as a DESIGN.md law. (https://vercel.com/geist/introduction)
- [ ] **A real type scale.** Header / subhead / body / caption as a fixed ratio scale — a boxed group that could be expressed by heading-weight + spacing alone fails the minimalism test. (https://medium.com/@Ummiux/understanding-the-use-of-white-space-and-text-for-better-hierarchy-ui-ae7254ef7d53)

### 5.2 Whitespace & rhythm
- [ ] **"Take the spacing that feels like enough, then double it."** Whitespace is the primary separator because it "doesn't add new objects" — the most responsive-safe divider. (https://www.pixeldarts.com/en/post/four-design-principles-behind-stripe-linear-and-vercel)
- [ ] **Consistent spacing scale** (a base unit; all gaps are multiples). Small-multiples share the exact same padding so 8 department cards read as one system, not eight widgets. (`BEST-DASHBOARDS.md` G7)
- [ ] **Gallery-like emptiness** — every element earns its pixel; the white space *is* the design. (https://vercel.com/geist/introduction)

### 5.3 Color
- [ ] **Monochrome + one accent.** "Almost entirely black, white, and gray, then one color does all the work" — the accent is reserved for the single primary action and true status escalation, nothing else. (https://www.pixeldarts.com/en/post/four-design-principles-behind-stripe-linear-and-vercel)
- [ ] **Semantic status colors only,** each paired with icon/label: green (working/healthy), amber (needs-you/warning), red (blocked/failed). No decorative red/green anywhere (see gate D3). (https://startingblockonline.org/dashboard-anti-patterns-12-mistakes-and-the-patterns-that-replace-them/)
- [ ] **High contrast, nothing muddy.** "Black on white, white on black, nothing muddy in between" so the eye always knows where to go. (https://www.pixeldarts.com/en/post/four-design-principles-behind-stripe-linear-and-vercel)

### 5.4 Borderless hierarchy & depth
- [ ] **Borders as shadow, not lines.** `box-shadow: 0 0 0 1px rgba(0,0,0,0.08)` for lighter visual weight and smoother transitions; prefer no border at all where spacing + weight already separate. (https://vercel.com/geist/introduction · https://blog.tubikstudio.com/visual-dividers-user-interface/)
- [ ] **Structure felt, not seen.** Nav/tabs/headers are dimmed and low-contrast so the work area dominates; soften any remaining dividers to rounded, low-contrast. Audit icons: fewer, smaller, no colored icon-backgrounds. (https://linear.app/now/behind-the-latest-design-refresh)
- [ ] **Deference.** No gradients, glows, or ornament competing with content; adornments minimized. (https://developer.apple.com/design/human-interface-guidelines/)

### 5.5 Motion (the feel)
- [ ] **Sub-100ms, GPU-only, layout properties never animated.** Durations below the 100ms cause-and-effect threshold; animate transform/opacity, never width/height/top. (https://performance.dev/how-is-linear-so-fast-a-technical-breakdown)
- [ ] **No spinners on the home screen** — skeleton states matching final layout; all state cached locally. (https://blog.superhuman.com/superhuman-is-built-for-speed/)
- [ ] **"Feels human" micro-detail** where it counts — a status dot transitioning, a decision clearing — treated as craft, not polish-if-time (Stripe's randomized-typing-delay lesson). (https://creatoreconomy.so/p/how-stripe-crafts-quality-products-katie-dill)

---

## 6. How This Doc Sits With Its Siblings

- **`BEST-DASHBOARDS.md`** specifies the Dashboard's zones, gates (G1–G12), and gamification line. This doc supplies the *aesthetic layer* over those zones and the DESIGN.md governance that keeps them honest.
- **`DESKTOP-UX-SKELETONS.md`** specifies the IA, Chat (VIT-41), Decisions queue mechanics, and composer anatomy. This doc supplies the *look* of those surfaces and the deletion gates that keep them minimal.
- **`DESIGN.md` / `DESIGN_SYSTEM.md`** is the *executable* output: §3's structure + intentionality gate turn everything above into the enforceable source of truth. The `principles` block below is the top-of-file law for that upgraded DESIGN.md.

## Research caveats
- Sequoia publishes no first-party command-center wireframes; S1 (Agent Inbox) is LangChain's design surfaced via Sequoia's podcast. The "agent org chart" is not a Sequoia framework — Buhler describes peer-to-peer swarms.
- Several peer UIs (Cursor, Devin, Manus, Factory) are described via launch coverage/third-party analysis, not verified current screenshots; treat as directional.
- Stripe/Linear/Vercel craft specifics (exact letter-spacing values, "double the whitespace") come from design-commentary blogs interpreting the products, not first-party design-system docs, except where a first-party URL is cited (Vercel Geist, Superhuman, Apple HIG, Vitsœ/Rams).
- "DESIGN.md as single source of truth" is an emergent community/agent convention (design-skills, getdesign.md), not an official Google or industry standard; the *design-doc* discipline it borrows (Ubl) is canonical.
- Numeric deletion thresholds (≤3 pie slices, ≥12px labels, 5-second test, 3–7 KPIs) are practitioner conventions, not Tufte/Nielsen constants — use as opinionated defaults.