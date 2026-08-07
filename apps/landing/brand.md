# summon.company brand.md

Structure inherited from Aether/brand.md; this project's accent is Summon Blue
(`--blue-600` / `#0B5FFF`), chosen because Summon sells trust: strangers are asked to
hand company decisions to AI employees, so the palette needs to read as calm,
technical, and dependable rather than flashy. Blue is the default "this is
infrastructure, not a toy" signal, and it pairs cleanly with the EKG heartbeat motif
(a live signal, not a static logo) that already runs through the product's motion
system.

This file documents what already exists in `apps/landing/tokens.css`. It does not
propose a new palette and it does not change any color value. Per the Aether rollout
process, summon.company is the structural template the rest of the portfolio is meant
to follow, not a project that needs to catch up to one.

## What's already in tokens.css

`apps/landing/tokens.css` (v2.0, "SUMMON v2.0 tokens. Light canonical, dark derived")
already implements the full layered structure Aether/brand.md asks every project to
follow:

1. **Primitives**: a 9-step Summon Blue ramp, `--blue-050` through `--blue-900`, plus
   `--navy-950` (deep ink, used for shadow keying and the one deep-navy section flip)
   and `--ink`. `--blue-600` (`#0B5FFF`) is the named accent.
2. **Semantic surfaces**: `--bg-canvas`, `--bg-elevated`, `--bg-neutral(-hover/-active)`,
   `--bg-accent-quiet`, `--bg-section-tint`, `--bg-section-deep`, all mapped from
   primitives, never raw hex outside the primitives block.
3. **Semantic text**: `--text-primary/secondary/tertiary/disabled/on-accent/accent`.
4. **Semantic borders**: `--border-neutral/strong/accent/focus`.
5. **Interactive triads**: `--action-primary/quiet/neutral`, each with base, hover, and
   active states.
6. **Sentiment**: `--positive-content/bg`, `--negative-content/bg`,
   `--warning-content/bg`, `--info-content/bg`. See mismatch note below, this is the
   one layer that diverges from the proposed shared portfolio set.
7. **Shadows**: `--shadow-xs` through `--shadow-hero`, all keyed to navy
   (`rgba(7, 31, 77, ...)`), never pure black. A separate glass set
   (`--glass-bg/blur/border`) exists for the nav.
8. **Dark theme**: a `[data-theme="dark"]` block that re-points the semantic layer only
   (surfaces, text, borders, actions, sentiment, shadows, glass, gradients). No new
   design decisions inside it, the same tokens inverted with care, exactly as the
   Aether structure prescribes. There is also a `[data-section="deep"]` variant, a
   light-mode-only deep-navy section flip capped at one use per page.

Below that: typography (`--font-display` Space Grotesk, `--font-body` Inter,
`--font-mono` JetBrains Mono, with `clamp()` display sizes and a fixed scale below),
an 8px spacing grid with 4px fine-grain (`--space-1` through `--space-40`), a closed
radius set (`--radius-input/card/panel/pill`), and named motion (three eases including
the product-specific `--ease-summon`, four named durations). A `prefers-reduced-motion`
block collapses all durations to 1ms and freezes the EKG trace statically, this is
Summon-specific motion personality (the EKG heartbeat), which Aether/brand.md
explicitly says should stay project-owned rather than shared.

Nothing in this pass touched any value in `tokens.css`. This section is a reference to
the existing file, not a copy of it; see the file itself for exact values.

## Sentiment color mismatch: open decision, not silently resolved

Aether/brand.md proposes a shared portfolio sentiment set so a founder scanning
multiple dashboards sees the same "good/bad/caution" hues everywhere:

- positive: `#1F7A4D` / `#3E6B4C` family
- negative: `#A23B2E` / `#B03A2E` family
- warning: `#96702A` / `#C28A1E` family

summon.company's current sentiment tokens are different, its own greens and reds,
not the proposed shared set:

- `--positive-content: #0A5C38` / `--positive-bg: #E2F6EB`
- `--negative-content: #C8232E` / `--negative-bg: #FDEBEC`
- `--warning-content: #6B4E0A` / `--warning-bg: #FFF4D6`
- (plus the dark-theme re-pointed equivalents in the `[data-theme="dark"]` block)

This was NOT changed in this pass. Per instruction, a sentiment-color mismatch is a
founder decision, not something an agent resolves by overwriting live tokens. Adam (or
whoever owns brand across the portfolio) needs to pick one of:

1. **Align**: migrate summon's sentiment tokens to the shared Aether set, so a
   "confirmed" green reads identically across summon, the Kitchen Report, the
   value-equation board, and every future dashboard.
2. **Keep as a deliberate Summon-specific choice**: summon's sentiment colors were
   tuned as part of the same v2.0 pass that built the rest of this token system
   (commit `ff801eff5`, "Design system v2: light mode, Summon Blue, gradient washes"),
   so there is a real argument they were chosen with intent, not accidentally.

Whichever way this goes, treat it as a one-time portfolio-wide migration once decided,
not a per-project drift to patch quietly.

## Shared component audit

Verified against the live files in `apps/landing/` (not assumed):

- **Beta feedback bar**: present. `apps/landing/index.html` footer, line 496:
  `<div class="beta">Beta - tell me what sucked: <a id="beta-contact"
  href="mailto:adamtpang@gmail.com?subject=summon%20beta">send it</a></div>`. A script
  block right after it upgrades the link to `https://wa.me/<NEXT_PUBLIC_ADAM_WA>` when
  that env var is injected at deploy time, otherwise it stays the mailto fallback. This
  matches the shared "tell me what sucked" pattern Aether/brand.md describes as already
  shipped on four sites this session.
- **Empty-until-real evidence slot**: present. `apps/landing/index.html` line 455-457:
  `<section id="case-studies" class="wrap"></section>`, paired with the CSS rule at
  line 216, `#case-studies:empty { display: none; }`. Renders nothing while the section
  has no real case-study markup inside it, exactly the shared pattern, no fabricated
  content.
- **"built by adam.inc" receipt line**: gap. adam.inc only appears as
  `parentOrganization` inside the JSON-LD structured data block (line 29), which is
  invisible to a human visitor. There is no visible footer line crediting adam.inc or
  linking back to adampang.com anywhere in `index.html`. The footer does carry a full
  nav (Roster, Pricing, Security, Terms, Privacy, Hire by role, Blog, Changelog, Book a
  call, hello@summon.company) plus the beta bar, but no receipt line. This is flagged
  as a gap, not fixed in this pass, adding it means editing a dense, already-crowded
  footer block and picking exact wording and placement, which deserves its own
  deliberate pass rather than a rushed one-line insert here.

## Deploy note

This project's Vercel has no git auto-deploy configured. If this file is committed and
pushed, that alone does not ship anything live. Deploying still requires Adam to run
`vercel --prod` from `apps/landing` himself.
