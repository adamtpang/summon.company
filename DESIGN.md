# Summon Design Principles

**Status:** v1.0 - the source of truth for a beautiful, ruthlessly minimal AI-agent command center. Governs both structure AND intentionality. Full research + evidence: `doc/research/AGENT-COMMAND-CENTER-DESIGN.md` (Sequoia agent thesis, peer command centers, the design canon), `doc/research/BEST-DASHBOARDS.md` (the Dashboard grid), `doc/research/DESKTOP-UX-SKELETONS.md` (the IA). Brand token VALUES live only in `ui/src/index.css`; nothing in `ui/` hardcodes them.

Changes from v0.5 (board rulings, 2026-07-18): **the monochrome ruling** — law 4 hardened from "monochrome + one accent" to *chrome is white and black; color is data* (the palette in index.css is now pure neutral; the brand mark is a white glyph on a near-black tile — "lean white when in doubt, black if not"); **law 13 expanded** with the liquid-glass recipe and the full surface list (dialogs, ⌘K palette, dropdown menus, popovers, sheets, toasts) now implemented in `ui/src/components/ui/`; **the first via-negativa pass shipped** on Mission Control (removals logged in the commit per law 1). Changes from v0.4: added law 13. Changes from v0.3: elevated from a token-extraction anchor to the command-center design spine.

## What this document is for

Agents and humans modifying `ui/` treat this file as the source of truth for design decisions. **The intentionality gate (below) is binding:** every on-screen element must trace to a reason here. Storybook is the verification surface - it documents the system; it does not define it. If a change conflicts with this document, change this document first (with review) or change the code.

## The thesis (the one question)

Summon is a command center for a founder supervising AI employees. It answers ONE question first, above all others: **which of my agents needs me right now.** Every element either sharpens that answer or is deleted. Three surfaces, nothing more: **Dashboard** (the glance - which employees need me, what's the company's state), **Chat** (talk to any employee, WhatsApp-simple, outcomes not logs), **Decisions** (the drainable queue of what needs my yes). Beauty here is not decoration - it is the absence of everything that isn't that answer. The canon and the Sequoia peer set agree: the defining design decision is almost always a *subtraction*.

## The thirteen laws (enforceable; each element must pass all)

1. **Deletion test.** Every element must survive a deletion attempt - if removing it loses no data and no affordance, DELETE it (don't shrink it). Log the removal in the PR.
2. **Intentionality gate.** Every on-screen element traces to a DESIGN.md entry; every entry states its REASON + the trade-off it settles + the alternative rejected. No trade-off = no decision = no bespoke element.
3. **One primary action per surface.** Only one element carries primary visual weight (size + placement + weight). Demote or delete every competing CTA.
4. **Chrome is white and black; color is data.** (Hardened 2026-07-18, board ruling: "can we just make it white and black... simplicity is amazing.") Every surface, border, wash, chart ramp, and the primary itself is neutral - near-black ink on white in light mode, inverted in dark. The "accent" IS the ink: primary actions and the S tier carry weight through black/white contrast, not hue. Color appears ONLY as data: the semantic status hues (law 5), destructive red, and the fixed agent-capsule gradients. A colored element therefore always MEANS something; if it doesn't, it's a violation. *Alternative rejected:* a brand accent color (the old Summon Blue) - it competed with status semantics and made chrome shout over signal.
5. **Status color is semantic and never alone.** Pair every green/amber/red with an icon or label. Never red/green decoratively.
6. **Every metric earns its place** with trend + delta-vs-target + a next step. A lone big number gets context or gets cut.
7. **Hierarchy from type + space first.** A border/box ships only if meaning is still lost after spacing and weight are set. Draw kept borders as a 1px shadow, not a line.
8. **One type family, roles by size/weight/case.** Display type carries negative letter-spacing; body is zero, never positive. Few weights. No chips/boxes to signal role.
9. **Double the whitespace.** Take the spacing that feels like enough, then double it. Every gap is a multiple of one base unit; repeated data is the same component at the same scale.
10. **No spinners on the home screen.** Cache all console state locally, stream the event log in the background, keep every hop < 100ms. Speed is a design decision.
11. **Motion is sub-100ms, GPU-only.** Animate transform/opacity, never layout (width/height/top).
12. **Five-second test, two levels max.** Any screen: identify the primary signal, tell good from bad, know if action is needed - in five seconds. Disclosure caps at two levels; a third level means the structure is wrong.
13. **Glass signals elevation, never data.** Translucent/blurred surfaces are permitted ONLY where something floats above the context it came from and is dismissible: the Cmd-K palette, modals/dialogs, sheets, dropdown menus, popovers, the Decisions deck card, toasts. They are forbidden on Dashboard data zones, tables, metrics, status, and any number the board reads to make a call. **The recipe (implemented 2026-07-18, `ui/src/components/ui/`):** surface = `bg-(--glass-surface) backdrop-blur-xl border-(--glass-border)`; the dimming overlay behind modal surfaces = `bg-black/40 backdrop-blur-sm`; tokens live in index.css (`--glass-surface` = white 62% / near-black 55%, `--glass-border` = ink 10% / paper 12%). Children of a glass surface never paint their own opaque background (the ⌘K palette's inner Command is `bg-transparent` for exactly this reason). Tooltips stay opaque - too small for blur to read as anything but haze. *Reason:* glass carries exactly one honest meaning - "this is transient and sits above what you were doing" - which is a real affordance the flat system otherwise spends a border on (law 7), so used here it ADDS signal rather than decoration. *Trade-off it settles:* it buys that depth cue at the cost of text contrast and of compositing during scroll; we pay that only where content is transient, short, and recoverable by dismissing it - never where law 12 or a metric's legibility is at stake. *Alternative rejected:* glass as a global skin across every card and panel. It lowers contrast on precisely the dense data the console exists to show, it competes with the single accent (law 4), and by making every surface equally shiny it flattens hierarchy - the opposite of what a command center is for. Board ruling 2026-07-17: the look is wanted; this law is where it is allowed to live.

## The intentionality gate (how "everything has a reason" is enforced)

An element ships to `ui/` only if it can point to a law it serves OR a DESIGN.md entry that records: *what it is · the reason it exists · the trade-off that reason settles · the alternative that was rejected.* "It looked empty" and "just in case" are not reasons. A PR that adds a surface, a nav item, a card, a badge, or a CTA without that trace fails review. This is the Google design-doc discipline (Malte Ubl): the decision and its rejected alternatives are written down BEFORE the pixels, so the interface stays legible to the next agent and stays honest over time.

## Product stance

Summon is an AI-agent company command center. The user is the BOARD, scanning which employees need them and deciding. Every screen answers, in order: *which agent needs me, what's the company state, what do I do about it.* Density serves scanning - but density comes from information, never from chrome.

## The token layer (where visual values live)

The single token source is **`ui/src/index.css`** (Tailwind v4; there is no tailwind config file - tokens are CSS custom properties consumed via `@theme`). Do NOT create a parallel token source such as `ui/src/tokens/` - that would produce two sources of truth. If index.css grows unwieldy, extracted values may live in a `tokens.css` **imported by index.css** so the pipeline still has one root.

Tailwind v4 gotcha: `@theme inline` bakes literal values at build time. Any token that must be runtime-tunable (theme editor, dark mode overrides) must be defined in a NON-inline block.

Existing tiers already in index.css (~80+ tokens) - extraction maps to these on **exact value match** before minting anything new:

1. **Semantic tier** - shadcn core set: `--background`, `--foreground`, `--card`, `--primary`, `--secondary`, `--muted`, `--accent`, `--destructive`, `--border`, `--input`, `--ring`, `--sidebar-*`, `--chart-1..5` (OKLCH, light/dark overrides).
2. **Brand tier** - agent gradients `--agent-1a/1b..10a/10b` (fixed hex) and status hues `--status-task-*` / `--status-agent-*` (WCAG-tuned; see inline comments).
3. **Domain tier** - match-chip tokens `--chip-match-*`, annotation highlights `--paperclip-doc-annotation-highlight-*`, plus motion/typography tokens.

## Principles

1. **One way to say each thing.** One component per job. One Button, one Card, one Badge, one Table, one EmptyState. Variants are props, not new components. Before creating a component, prove no existing one covers the job.
2. **Tokens are the only source of visual values.** All color, spacing, radius, type size/weight, shadow, and motion values come from the token layer. No hex, no raw px, no ad-hoc Tailwind arbitrary values (`p-[13px]`) in components. If a needed value doesn't exist, add a token - don't inline it. Tailwind palette classes (`bg-red-500`, `text-zinc-400`, etc.) ARE hardcoded values in spirit: they name a literal color, not a semantic role. They are in-scope debt scheduled for a dedicated future run (Run 4, cluster-by-cluster mapping to semantic tokens per doc/design/DECISION-SHEET.md B2) and are not currently gated by check-token-gates. Exception (doc/design/DECISION-SHEET.md B1 user ruling): first-party intentional one-off decoration on demo/UX-lab surfaces stays inline and allowlisted rather than minted as singleton tokens.
3. **Spacing routes through tokens; the scale comes later.** During simplification, extract every spacing and radius value verbatim into tokens - do not normalize, round, or invent a scale. The final scale is a design decision made by a human after reviewing the token audit. Structural rules apply now: vertical rhythm within a container uses one gap value, not per-element margins, and siblings never carry both margin and gap.
4. **Hierarchy through structure, not decoration.** Prefer position, size, and weight over borders, backgrounds, and dividers. Every border, divider, and background fill must justify itself; when in doubt, remove it. A screen should survive the removal of one visual layer.
5. **Status is systematic.** States like running / paused / blocked / awaiting-approval / over-budget map to a single semantic status token set used identically everywhere (badge, row, chart, log). An operator learns the vocabulary once.
6. **Machine values look machine-made.** IDs, costs, token counts, timestamps, and log output use the monospace token and consistent formatting helpers. Never format these ad hoc per screen.
7. **Words are part of the system.** One name per concept across the entire UI - the canonical term is *task* (never *issue* or *ticket* in copy, labels, or empty states). Buttons name the action ("Approve hire," not "Submit"). Errors say what happened and what to do. Empty states say what to do first. **Note:** enforcing the task rename is a visible change and is explicitly OUT of the zero-visual-change extraction run; it happens in its own follow-up run.
8. **Agent-modifiable by design.** The system must be changeable via instructions: single token source, lint rules that enforce it, and this document kept current. A correct change should be expressible as "edit tokens + run checks," not "visit 40 files."

## Enforcement (what "compliant" means for the extraction run)

- **Zero visual change is proven, not promised:** Storybook visual snapshots are baselined before any refactor, and all snapshots match baseline after it. A change that alters rendered output must be intentional and human-approved.
- **Baseline scope for Run 1:** the shared primitives in `ui/src/components/ui/` (each gets a story if missing - there are only ~24) plus the ~46 existing stories under `ui/storybook/stories/`. Do NOT attempt a story for every feature component (~277) in this run; full coverage is a later effort.
- Mechanical rewrites (value extraction, renames) are done via committed codemod scripts in `scripts/`, not hand-edits - reviewable once, repeatable forever.
- Token layer is the single source (`ui/src/index.css`, per above) consumed via CSS variables / Tailwind theme - never values copied into components.
- Lint/grep gates pass: zero hardcoded hex values, zero arbitrary spacing values, zero raw font-size declarations in `ui/src/components/**` and `ui/src/pages/**` outside the token layer and a documented allowlist (third-party overrides, intentional opt-outs commented inline).
- `pnpm build`, `pnpm typecheck`, and `pnpm build-storybook` pass.
- AGENTS.md links here and states the token-only rule.

Aspirational (NOT gating this run): no duplicate components; every component has exactly one story covering its variants; all UI copy says "task".

## Out of scope (do not do during simplification)

No visual redesign, no new colors or typefaces, no layout restructuring, no new dependencies beyond snapshot tooling, no component consolidation/merges (audit + recommend only), no copy renames, no changes to server code or app logic. Simplification means fewer parts, same product.

## Prior art (read before auditing)

See `doc/design/PRIOR-ART.md` - a previous audit pass (PAP-280/283/284, on the `PAP-282-playground` branch, NOT on master) found that of ~220 hardcoded drift sites, only 6 were exact-value-mappable to existing tokens; expect the verbatim extraction to mint many new tokens that the human scale-collapse step later merges. It also drafted usage rules (radius tiers, CTA tiers, named type styles) that are good candidates for the post-audit scale decision.

How-to guide for day-to-day UI changes: see `doc/design/CHANGING-THE-UI.md`.
