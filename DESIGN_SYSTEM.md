# SUMMON - DESIGN_SYSTEM.md

**summon.company - "Hire AI employees. You're the board."**
Version 1.0 · Dark-primary · Synthesized 2026-07-15

---

## 0. Philosophy - Dorsey Minimalism

> "Limit the details. Perfect every one."

Summon's design system has a small, closed vocabulary. Every token below is the *only* legal value for its job. If a design decision isn't answerable from this document, the answer is "use the existing token" - never "invent a new value."

The five laws:

1. **One accent, rationed.** Emerald `#22E39B` (flowing into cyan `#22D3EE`) appears only where something is *alive*: the EKG line, primary CTAs, focus rings, live-status moments. Everything else is monochrome ink on near-black.
2. **Depth is light, not gray.** Surfaces, borders, and highlights are white at low alpha over the `#0B0D12` base - depth reads as light hitting glass, never as stacked gray rectangles.
3. **Tightness is luxury.** One weight step above normal, tracking that tightens as type grows, line-heights that crush toward 1.0 at display sizes. Premium comes from restraint, not boldness.
4. **Motion is physics.** Interactive elements brighten like lit objects and compress like real buttons. One easing family. The only expressive animation is the EKG draw - our heartbeat, used sparingly so it stays sacred.
5. **Mono means measured.** JetBrains Mono marks anything the machine says: metrics, eyebrows, statuses, table numerals. The sans/mono interplay is our engineering-credibility signal.

---

## 1. Color Tokens

Dark is primary and canonical. Light theme is optional and derived (see 1.6).

### 1.1 Background layers (solid)

| Token | Value | Use |
|---|---|---|
| `--bg-void` | `#07090D` | Marketing hero stage, deepest layer |
| `--bg-base` | `#0B0D12` | Page background (brand anchor) |
| `--bg-raise-1` | `#10131A` | Panels, first elevation |
| `--bg-raise-2` | `#151922` | Nested panels, popovers |
| `--bg-raise-3` | `#1A1F2A` | Highest solid elevation (rare) |

Each layer is ~+4 lightness on the same cool blue-green hue. Never pure `#000`.

### 1.2 Surface & border alphas (white-alpha ladder)

Translucent surfaces work on *any* background layer - prefer them over solid raises.

| Token | Value | Use |
|---|---|---|
| `--surface-1` | `rgba(255,255,255,0.03)` | Card fill, subtle wells |
| `--surface-2` | `rgba(255,255,255,0.06)` | Hover fill, chips |
| `--surface-3` | `rgba(255,255,255,0.10)` | Active fill, strong chips |
| `--border-1` | `rgba(255,255,255,0.08)` | Default hairline |
| `--border-2` | `rgba(255,255,255,0.13)` | Hover / emphasized hairline |
| `--border-3` | `rgba(255,255,255,0.20)` | Strong border (selected) |

### 1.3 Text hierarchy (ink ladder)

One ink, four alpha stops - guarantees harmony on any surface. Base ink is a faintly emerald-tinted white.

| Token | Value | Use |
|---|---|---|
| `--text-1` | `#EDF2EF` | Headings, primary copy (never pure `#FFF`) |
| `--text-2` | `rgba(237,242,239,0.72)` | Body copy, descriptions |
| `--text-3` | `rgba(237,242,239,0.48)` | Captions, meta, placeholders |
| `--text-4` | `rgba(237,242,239,0.32)` | Disabled, ghost labels |

### 1.4 Accent - the living color

| Token | Value | Use |
|---|---|---|
| `--accent` | `#22E39B` | The one accent. CTAs, links, live states, EKG stroke |
| `--accent-2` | `#22D3EE` | Gradient terminus only - never used alone |
| `--accent-grad` | `linear-gradient(104deg, #22E39B, #22D3EE)` | Primary button, EKG stroke, ≤1 gradient element per viewport |
| `--accent-ink` | `#052A1D` | Text/icons sitting ON emerald fills |
| `--accent-tint` | `rgba(34,227,155,0.10)` | Accent-tinted wells, selected rows |
| `--accent-border` | `rgba(34,227,155,0.35)` | Accent hairline (live cards, focus adjuncts) |
| `--accent-glow` | `0 0 24px rgba(34,227,155,0.25)` | RESERVED: the EKG pulse and live-status dots only |

Hover states on accent elements use `filter: brightness(1.12)` - never a second green hex.

### 1.5 Semantic

| Token | Value |
|---|---|
| `--ok` | `#22E39B` (success IS the brand - one green) |
| `--warn` | `#F5B94B` |
| `--danger` | `#F26D6D` |
| `--info` | `#22D3EE` |

Each pairs with a 10%-alpha tint of itself for fills.

### 1.6 Optional light theme (derived, not designed twice)

Invert the ladders: base `#F7F9F8` (emerald-tinted off-white), ink `#0B0D12` at alpha stops `e6/b3/73/4d`, borders `rgba(11,13,18,0.10)`, surfaces `rgba(11,13,18,0.04)`. Accent stays `#22E39B` with `--accent-ink` on fills. Light theme is a re-pointed token set, never per-component overrides.

---

## 2. Typography

### 2.1 Families & roles

| Token | Stack | Role |
|---|---|---|
| `--font-display` | `"Space Grotesk", "Inter", sans-serif` | All headings, buttons, nav |
| `--font-serif` | `"Instrument Serif", Georgia, serif` | *Italic accent only* - one emphasized word/phrase inside a display heading, always `font-style: italic` |
| `--font-body` | `"Inter", -apple-system, sans-serif` | Body, UI copy. `font-feature-settings: "cv01","ss03"` |
| `--font-mono` | `"JetBrains Mono", ui-monospace, monospace` | Eyebrows, metrics, statuses, table numerals, code |

### 2.2 The scale (exact sizes / weights / tracking)

Rule: **tracking tightens as size grows; display line-height crushes toward 1.0.** Space Grotesk headings run weight **500** (medium - never 700; hierarchy from size, not heaviness).

| Token | Size / Line-height | Weight | Tracking | Use |
|---|---|---|---|---|
| `display-1` | `4.5rem / 1.02` | 500 | `-0.035em` | Hero H1 (desktop) |
| `display-2` | `3.5rem / 1.05` | 500 | `-0.03em` | Hero @1024px, section megaheads |
| `display-3` | `2.75rem / 1.08` | 500 | `-0.025em` | Section H2 |
| `heading-1` | `2rem / 1.15` | 500 | `-0.02em` | H3, card group titles |
| `heading-2` | `1.5rem / 1.25` | 500 | `-0.015em` | H4, feature titles |
| `heading-3` | `1.25rem / 1.3` | 500 | `-0.01em` | H5, card titles |
| `body-lg` | `1.125rem / 1.6` | 400 | `-0.011em` | Lede paragraphs |
| `body` | `0.9375rem / 1.6` | 400 | `-0.011em` | Default body (15px) |
| `body-sm` | `0.8125rem / 1.5` | 400 | `-0.008em` | Meta, captions |
| `label` | `0.875rem / 1.2` | 500 | `0` | Buttons, form labels |
| `eyebrow` | `0.75rem / 1.4` | 500 (mono) | `+0.08em`, UPPERCASE | Mono section eyebrows |
| `metric` | `2.5rem / 1.0` | 500 (mono) | `-0.02em` | Dashboard numerals, stats |
| `micro` | `0.6875rem / 1.4` | 400 (mono) | `+0.04em` | Table headers, timestamps |

Responsive: hero uses `display-1` → `display-2` @1024px → `2.375rem` @640px. Fluid helper: `clamp(2.375rem, 1.5rem + 4.2vw, 4.5rem)`.

**Serif accent rule:** at most ONE Instrument Serif italic phrase per heading, per viewport. It renders at `1.04em` of the parent size (serif optical compensation), same weight 400.

**Section pattern:** mono eyebrow (emerald) → display head (with optional serif italic word) → `--text-2` description capped at `38ch`.

### 2.3 Body copy limits

Prose max-width `640px` / `65ch`. Descriptions `38ch`. Never justify. Numerals in tables and metrics are always mono with `font-variant-numeric: tabular-nums`.

---

## 3. Spacing & Layout

**Base unit: 4px.** All spacing is a multiple; nothing is eyeballed.

| Token | Value |
|---|---|
| `--space-1..4` | 4 / 8 / 12 / 16px |
| `--space-5..8` | 24 / 32 / 48 / 64px |
| `--space-9..11` | 96 / 128 / 192px |

- **Section rhythm:** `padding-block: 128px` desktop → `96px` @1024 → `64px` mobile. Section header → content gap: `64px`.
- **Standing gap:** `24px` (`--space-5`) between sibling components; `12px` inside components.
- **Containers:** `--container-page: 1200px` + `24px` inline margin; `--container-narrow: 1024px` (docs/content); `--container-prose: 640px`.
- **Grid:** 12 columns desktop / 8 tablet / 4 mobile, `24px` gutter.
- **Controls:** heights 32 / 40 / 48px (sm/md/lg). Min tap target `44px`. Nav height `64px`.

---

## 4. Radii, Borders, Shadows

### 4.1 Radii (closed set)

| Token | Value | Use |
|---|---|---|
| `--radius-sm` | `6px` | Inputs, small controls, chips-with-corners |
| `--radius-md` | `12px` | Cards, panels, popovers |
| `--radius-lg` | `20px` | Feature cards, modals |
| `--radius-full` | `9999px` | ALL buttons and pills |

Nested children inside a bordered card use `calc(var(--radius-md) - 1px)`.

### 4.2 Borders

`1px` hairlines from the white-alpha ladder - never gray hexes. Default `--border-1`, hover `--border-2`, selected `--border-3`. Dividers: `--border-1`.

### 4.3 Shadows - rings over blurs

Elevation = a 1px alpha ring + at most two ultra-low-alpha soft layers. Crisp precision, not glow.

| Token | Value |
|---|---|
| `--shadow-ring` | `0 0 0 1px rgba(255,255,255,0.08)` |
| `--shadow-raise` | `0 0 0 1px rgba(255,255,255,0.08), 0 2px 4px rgba(0,0,0,0.24), 0 8px 24px rgba(0,0,0,0.24)` |
| `--shadow-overlay` | `0 0 0 1px rgba(255,255,255,0.10), 0 4px 8px rgba(0,0,0,0.28), 0 16px 40px rgba(0,0,0,0.40)` |
| `--shadow-button` | `inset 0 0 0 1px rgba(255,255,255,0.06), inset 0 1px 0 rgba(255,255,255,0.08), 0 0 0 1px rgba(0,0,0,0.55), 0 2px 6px rgba(0,0,0,0.25)` |

`--shadow-button` is the signature chrome: hairline inner ring + 1px inner TOP highlight (machined/embossed feel) + dark outer ring. `--accent-glow` is the ONLY colored shadow and is reserved for the EKG pulse and live dots.

### 4.4 Focus

`--focus-ring: 0 0 0 2px var(--bg-base), 0 0 0 4px var(--accent)` - 2px gap ring, emerald, on every focusable element via `:focus-visible`.

---

## 5. Motion

### 5.1 Durations & easings (closed set)

| Token | Value | Use |
|---|---|---|
| `--dur-1` | `120ms` | Micro: color, opacity, border |
| `--dur-2` | `160ms` | Hover brighten / press (the workhorse) |
| `--dur-3` | `240ms` | Panels, menus, accordions |
| `--dur-4` | `600ms` | Entrances, hero reveals |
| `--ease-out` | `cubic-bezier(0.25, 0.46, 0.45, 0.94)` | Default for all micro-interaction |
| `--ease-expo` | `cubic-bezier(0.16, 1, 0.3, 1)` | Entrances, large moves, EKG draw |

No ease-in, ever. Transition-property is limited to `color, background-color, border-color, box-shadow, opacity, filter, transform`.

### 5.2 Interaction physics

- **Hover:** `filter: brightness(1.12)` over `--dur-2 --ease-out` - objects light up, colors don't swap.
- **Press:** `transform: scale(0.97)` + `brightness(0.98)`, `will-change: transform`.
- **Row/list hover:** background `--surface-2` + border `--border-1` fade in together at `--dur-3`.

### 5.3 Entrances

`opacity: 0; translateY(16px)` → settled, `--dur-4 --ease-expo`, staggered by `calc(var(--stagger-i) * 80ms)`. Max 5 staggered items per group.

### 5.4 The EKG signature animation

Our one expressive motion. An SVG polyline (the heartbeat trace) stroked with `--accent-grad`:

1. **Draw:** `stroke-dasharray: var(--ekg-length); stroke-dashoffset: var(--ekg-length) → 0` over `1.2s --ease-expo`, triggered on viewport entry (once).
2. **Pulse:** at the QRS spike, a ring pulses - `scale(1) → scale(3)`, `opacity 0.6 → 0`, `1.6s --ease-expo`, with `--accent-glow` on the dot. Loops every `4s` (a calm ~15bpm ambient rhythm, not literal).
3. **Live dots:** status indicators breathe `opacity 1 → 0.55 → 1` over `2.4s ease-in-out infinite`.

Placement budget: hero (once), live agent-status components, loading states. Nowhere else.

### 5.5 Reduced motion

`@media (prefers-reduced-motion: reduce)`: EKG renders fully drawn and static, entrances become instant fades, pulses stop.

---

## 6. Component Rules

### 6.1 Buttons

- Shape: **full pill** (`--radius-full`). Heights 32/40/48. Padding-inline 16/20/24. Label: `--font-display` 500, `0.875rem`.
- **Primary:** `--accent-grad` fill, `--accent-ink` text, `--shadow-button`. Hover `brightness(1.12)`, press `scale(0.97)`.
- **Secondary:** `--surface-2` fill, `--border-1` hairline, `--text-1` label, `--shadow-button` (glass key). Hover: fill → `--surface-3`, border → `--border-2`.
- **Ghost:** transparent, `--text-2` label; hover `--surface-1` fill + `--text-1`.
- One primary button per view region. Icons 16px, gap 8px.

### 6.2 Cards

`--surface-1` fill + `--border-1` hairline + `--radius-md` + `padding: 24px`. Elevation on hover: border → `--border-2` + `--shadow-raise`; never move the card. **Live cards** (an AI employee at work) may add `--accent-border` + a breathing live dot - the only cards allowed accent chrome.

### 6.3 Inputs

Height 40px, `--radius-sm`, `--bg-base` fill (recessed: darker than the card it sits in), `--border-1`, `--text-1` value, `--text-3` placeholder. Hover border `--border-2`; focus swaps border for `--focus-ring`. Labels above, `label` style `--text-2`; errors in `--danger` `body-sm`. No floating labels.

### 6.4 Nav

Height 64px, fixed. At rest: transparent. On scroll: `background: rgba(11,13,18,0.80)` + `backdrop-filter: blur(20px)` + bottom hairline `--border-1`. Links: `--text-2` → hover `--text-1` via `brightness`, `0.875rem` 500. Logo left, links center, one primary pill CTA right. Mobile: full-screen sheet at `--dur-3 --ease-expo`.

### 6.5 Tables (the "board" views)

Header row: `micro` mono UPPERCASE `--text-3`, bottom hairline `--border-2`. Rows: 48px, hairline `--border-1` dividers, hover `--surface-1`. Numerals: mono, `tabular-nums`, right-aligned. Status: pill chip, tint fill (`--accent-tint` / warn / danger at 10%) + matching text, live states get the breathing dot. Selected row: `--accent-tint` + left 2px `--accent` rule. No zebra striping, no vertical rules.

### 6.6 Chips / badges

Pill, height 24px, padding-inline 10px, `micro` or `body-sm`, `--surface-2` + `--border-1` default; semantic chips use 10% tint + colored text.

### 6.7 Overlays

Modal: `--bg-raise-1`, `--radius-lg`, `--shadow-overlay`, scrim `rgba(7,9,13,0.7)` + `blur(4px)`. Enter: `scale(0.98) → 1` + fade, `--dur-3 --ease-expo`. Menus: `--bg-raise-2`, `--radius-md`, `--shadow-overlay`, items 32px with `--surface-2` hover.

### 6.8 Texture (optional, one per page)

A 256px tiled monochrome grain at `opacity 0.05, mix-blend-mode: overlay` may sit over the hero gradient to kill banding. Data-URI, never a network image. That is the entire texture budget.

---

## 7. DON'Ts

1. **Don't add colors.** No purples, blues, oranges, second greens. Emerald→cyan is the whole palette beyond ink.
2. **Don't use pure `#000` or `#FFF`.** Base is `#0B0D12`; brightest text is `#EDF2EF`.
3. **Don't use gray hexes for depth.** Surfaces and borders come from the white-alpha ladder only.
4. **Don't bold headings.** Space Grotesk 500, always. Hierarchy = size + tracking.
5. **Don't use more than one serif-italic phrase per heading** - or per viewport.
6. **Don't gradient more than one element per viewport.** The gradient budget goes to the primary CTA or the EKG line, not both in the same view.
7. **Don't glow.** No colored shadows except `--accent-glow` on the EKG pulse and live dots.
8. **Don't animate for decoration.** No spinners, no floating blobs, no parallax, no infinite marquees. Motion is interaction physics + the EKG.
9. **Don't swap colors on hover.** Brighten (`filter`) and compress (`scale`), like a physical object.
10. **Don't invent spacing.** 4px multiples; 24px standing gap; 128px sections. If it isn't a token, it's wrong.
11. **Don't exceed radii vocabulary.** 6 / 12 / 20 / pill. No 5-rem section capsules, no per-corner creativity.
12. **Don't put body copy wider than 65ch** or descriptions wider than 38ch.
13. **Don't use mono for prose** or sans for metrics. The machine speaks mono; humans read Inter.
14. **Don't ship a value that isn't in this file.**

---

## Appendix A - Signature moves adopted (inspiration credits)

- Linear - white-alpha depth system: all surfaces/borders built from white at 3-20% alpha over a near-black base (our #0B0D12), so depth reads as light on glass; plus the signature pill-button chrome (inset hairline ring + inset 1px top highlight + dark outer ring) as --shadow-button.
- Linear - 15px (0.9375rem) body size with tracking that tightens as type grows (-0.011em body to -0.035em display) and display line-heights crushed to ~1.0.
- Linear - physical micro-interactions: hover = filter brightness(1.12), press = scale(0.97), all at 160ms ease-out-quad; interactive elements light up and compress instead of swapping colors.
- Vercel (Geist) - accent rationing and hairline-ring elevation: monochrome everywhere with the single accent reserved for links/focus/live states, floating surfaces elevated by a 1px alpha ring plus 2 ultra-low-alpha shadows (never one big blur), and the 2px-gap emerald focus ring (0 0 0 2px bg, 0 0 0 4px accent).
- Stripe - one-hue color discipline and semantic token architecture: every neutral, border, and shadow tinted toward the brand hue family (our emerald-cool ink #EDF2EF ladder), with core tokens feeding semantic aliases so light theme is a re-pointed token set, not overrides. Also the 'spend the color budget in exactly one place per section' rule, applied to our emerald→cyan gradient (one gradient element per viewport).
- cofounder.co - alpha-ladder ink: one base ink color at four alpha stops for the entire text hierarchy, guaranteeing harmony on any surface; plus the draw-path SVG stroke animation and --stagger CSS-var entrance system, adapted directly into our EKG signature draw (1.2s ease-out-expo).
- 11x.ai - medium-weight display (headings at 500, never bold, hierarchy from size + tight negative tracking) and the radiating pulse-ring keyframe (scale 1→3 with fade) adapted as the EKG heartbeat pulse and live-status breathing dots.
- Resend - mono-eyebrow-over-display-head section pattern (JetBrains Mono uppercase letterspaced eyebrow above a giant tight-tracked heading) and the never-pure-white text discipline (#EDF2EF cap, translucent scrolled nav with backdrop blur).
- Linear - film-grain texture budget: a single optional 256px tiled grain overlay at ~5% opacity over the hero gradient to kill banding, as the entire texture allowance.

## Appendix B - Deliberately rejected (Dorsey: limit the details)

- Stripe's WebGL animated gradient hero with blend-mode double-rendered headline text - spectacular but a maintenance-heavy detail we can't perfect; our hero gets one static gradient + the EKG draw instead.
- Resend's four-typeface quartet with a giant display serif (Domaine at 96px) - we cap Instrument Serif at one italic accent phrase per heading; the serif never carries a whole headline.
- 11x.ai's giant 5-6rem section-capsule radii and 120px frosted-glass blur cards - a whole second visual language; our radii vocabulary stays 6/12/20/pill and blur is reserved for nav/scrims at 20px.
- Resend's decorative loops: disco-border rotating rainbow gradients, ai-shimmer-text, and 48-180s infinite marquees - decoration-as-motion violates law 4; our only expressive animation is the EKG.
- Linear's hundreds of generated grid-dot ambient keyframes and Vercel's border-trail light effects - ambient generative motion is a detail farm we'd never perfect; rejected wholesale.
- Vercel's true-black #000 base and pixel-font decorative accents - pure black flattens our emerald-tinted layering (base stays #0B0D12), and novelty display fonts dilute the four-family system.
- cofounder.co's 5-6-layer shadow stacks and pointer-tracked radial sheen - we cap elevation at ring + two soft layers and skip cursor-reactive effects entirely.
- Stripe's weight-300 light typography - elegant on warm light backgrounds but thin text on near-black fails contrast and readability; we hold body at 400 and display at 500.
- Multi-accent semantic rainbows (Stripe's 8 graphic accents, Radix full-scale imports from Resend/Vercel) - we keep exactly one green (success IS the brand), one warn, one danger, and cyan doing double duty as info and gradient terminus.
- Zebra striping, vertical table rules, floating input labels, and hover color-swaps - every one replaced by a single quieter mechanism already in the system (hairlines, surface fills, brightness).

## Appendix C - Implementation

The canonical token file is `design/tokens.css`. Import it before any other styles. All surfaces (apps/landing, ui/, apps/desktop splash) must consume these variables; per-surface overrides are forbidden (law: don't ship a value that isn't in this file).

