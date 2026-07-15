# SUMMON DESIGN_SYSTEM.md v2.0
## summon.company: hire AI employees, you're the board

**Status: canonical. Light mode is the source of truth. Dark is derived.**
**Supersedes v1 (dark-primary). The Dorsey doctrine and the five laws carry over, re-derived for light.**

---

## 0. Philosophy

SUMMON sells trust in something new: AI employees reporting to a human board. New things earn trust by looking calm, expensive, and inevitable. v1 said this with darkness. v2 says it with light: a boardroom at 9am, not a server room at midnight.

**The Dorsey doctrine (unchanged):**
1. **Closed vocabulary.** Every color, size, radius, ease, and shadow used anywhere in the product exists in this file. If a value is not here, it does not ship. No one-off hexes, no "just this once" pixel values.
2. **Limit the details.** Few tokens, few components, few moves. The system is small enough to hold in one head.
3. **Perfect every one.** Because there are few details, each one gets obsessive attention: the pulse timing, the exact border alpha, the tracking on a label.

**The Five Laws, re-derived for light:**

- **LAW 1: LIGHT IS THE CANVAS.** The page is never pure white and never gray. Every surface carries a whisper of blue: the canvas is #F7FAFF, neutrals are alpha tints of the deep navy, borders are alpha tints of the ink. Pure #FFFFFF is reserved for elevated cards and inputs, so hierarchy comes from surface color before it comes from shadow. (Structure learned from Wise's brand-tinted neutrals and Mercury's tinted page backgrounds.)
- **LAW 2: BLUE IS THE PULSE.** One accent family, one deep ink of the same hue. Summon Blue #0B5FFF is the only saturated color on screen outside of sentiment states. Every interactive color ships as a base/hover/active triad. If blue is everywhere it is nowhere: accent coverage stays under roughly 10% of any viewport.
- **LAW 3: DEPTH WITHOUT DARKNESS.** The light UI is nearly shadowless. Depth comes from surface stepping (tinted canvas to white card), 1px alpha borders, and tinted fills. Real shadows are blue-keyed, never black, and appear only on floating objects: popovers, modals, and at most one hero object per page.
- **LAW 4: THE HEARTBEAT IS SACRED.** The EKG trace is the signature. It is drawn in Summon Blue on light, it beats at one rhythm (see Motion), and it appears at most once per viewport. It is a sign of life, not a decoration: it marks where an AI employee is working.
- **LAW 5: EVERY DETAIL IS A DECISION.** Nothing is default. If a property is unset, that was chosen. If two elements differ, the difference means something.

---

## 1. Color

### 1.1 Architecture (three layers, borrowed from Neptune)

Primitives (raw hexes) feed semantic roles (what a color means) which feed components. Components only ever reference semantic tokens. Themes (light canonical, dark derived, deep-navy section) re-point semantic tokens; components never change.

### 1.2 Primitives: the Summon Blue family

| Token | Hex | Role hint |
|---|---|---|
| blue-050 | #EEF5FF | palest tint, quiet accent fills |
| blue-100 | #DCEBFF | wash stop, accent borders |
| blue-200 | #B9D6FF | wash stop |
| blue-300 | #8AB9FF | gradient mid-stop only |
| blue-400 | #5395FF | gradient mid-stop, dark-mode accent hover |
| blue-500 | #2B78FF | CTA gradient top, dark-mode accent |
| blue-600 | #0B5FFF | **PRIMARY. The Summon Blue.** |
| blue-700 | #084DDB | hover |
| blue-800 | #0640B4 | active |
| blue-900 | #093180 | deep accents on tints |
| navy-950 | #071F4D | **the deep ink: section flips, gradient anchor, shadow key** |
| ink | #0C1428 | text primary, a blue-black |

The chord is Wise's structure with our hue: one electric fill (blue-600) plus one near-black of the same family (navy-950). Everything neutral is an alpha tint of one of these two.

### 1.3 Semantic: light (canonical)

**Surfaces**
- `--bg-canvas: #F7FAFF` (page background, never pure white)
- `--bg-elevated: #FFFFFF` (cards, inputs, popovers)
- `--bg-neutral: rgba(7,31,77,0.06)` hover `0.10` active `0.15` (all "gray" fills are navy tints)
- `--bg-accent-quiet: #EEF5FF` (selected states, info chips)
- `--bg-section-tint: #EEF5FF` (alternating marketing sections)
- `--bg-section-deep: #071F4D` (the one dark section per page, tokens remap, see 1.6)

**Text ladder**
- `--text-primary: #0C1428`
- `--text-secondary: #46506B`
- `--text-tertiary: #6B7590`
- `--text-disabled: rgba(12,20,40,0.35)`
- `--text-on-accent: #FFFFFF`
- `--text-accent: #084DDB` (links: 700, not 600, for AA on tinted canvas)

**Borders (always alpha, never flat hex)**
- `--border-neutral: rgba(12,20,40,0.12)`
- `--border-strong: rgba(12,20,40,0.22)`
- `--border-accent: rgba(11,95,255,0.35)` (focused inputs)
- `--border-focus: #0B5FFF` (2px ring, offset 2px)

**Interactive triads (base / hover / active)**
- Primary action: #0B5FFF / #084DDB / #0640B4
- Quiet action: #EEF5FF / #DCEBFF / #B9D6FF (ink stays blue-800)
- Neutral action: rgba(7,31,77,0.06) / 0.10 / 0.15

**Sentiment (dark content on pale tint, Wise's pairing structure)**
- Positive: content #0A5C38 on #E2F6EB
- Negative: content #C8232E on #FDEBEC
- Warning: content #6B4E0A on #FFF4D6
- Info: content #084DDB on #EEF5FF

Sentiment colors appear only in status UI. Never decorative.

### 1.4 The 10% rule
Saturated blue (500 through 800) may cover at most ~10% of any viewport: primary CTA, links, the EKG trace, one selected state. The horizon-glow gradient in the closing section is the single sanctioned exception.

### 1.5 Shadows (blue-keyed, scarce)
Shadow color is always navy-950, never black. Ladder:
- `--shadow-xs: 0 1px 3px rgba(7,31,77,0.07)` (inputs on focus-within only)
- `--shadow-sm: 0 2px 8px rgba(7,31,77,0.08), 0 1px 3px rgba(7,31,77,0.05)` (dropdowns)
- `--shadow-md: 0 6px 20px rgba(7,31,77,0.10), 0 2px 6px rgba(7,31,77,0.05)` (popovers)
- `--shadow-lg: 0 16px 40px rgba(7,31,77,0.12), 0 6px 16px rgba(7,31,77,0.06)` (modals)
- `--shadow-hero: 0 24px 80px rgba(7,31,77,0.16), 0 8px 32px rgba(7,31,77,0.08)` (ONE floating hero object per page, maximum)

Cards at rest have NO shadow: border plus white-on-tinted-canvas does the work. Scarcity is what makes the hero shadow feel premium.

### 1.6 Section theme flips
Marketing pages drift through three atmospheres, in this order of frequency: canvas (#F7FAFF), tint (#EEF5FF), deep (#071F4D). The deep section remaps the full token set (text flips to #EEF2FA, borders to rgba(255,255,255,0.16), accent brightens to #5395FF) so any component drops in unchanged. Maximum one deep section per page. This is Wise's color-block move and Mercury's theme-class move, done in one hue family.

---

## 2. Typography

Three faces, fixed jobs. Instrument Serif italic is retired in v2: it fought the light aesthetic and the Dorsey budget (see rejections).

| Face | Job | Never |
|---|---|---|
| **Space Grotesk** | Display and headings, 600/700 | body copy, UI labels |
| **Inter** | Body, UI, buttons, forms, 400/500/600 | weight 700+ ("bold" body is 600) |
| **JetBrains Mono** | Numbers, metrics, agent IDs, EKG readouts, code, 400/500 | prose |

`font-synthesis: none` globally. `text-wrap: balance` on all headings.

**Scale (rem, fluid where marked):**
- `display-1`: clamp(2.75rem, 2rem + 3.5vw, 4.5rem), Space Grotesk 700, lh 1.0, ls -0.03em
- `display-2`: clamp(2rem, 1.6rem + 2vw, 3rem), Space Grotesk 700, lh 1.05, ls -0.025em
- `title-section`: 1.75rem, Space Grotesk 600, lh 1.15, ls -0.02em
- `title-card`: 1.25rem, Space Grotesk 600, lh 1.2, ls -0.015em
- `body-lg`: 1.125rem, Inter 400, lh 1.55, ls -0.011em
- `body`: 1rem, Inter 400, lh 1.55, ls -0.006em
- `body-sm`: 0.875rem, Inter 400, lh 1.5, ls -0.003em
- `label`: 0.8125rem, Inter 600, lh 1.2, ls +0.01em
- `overline`: 0.75rem, JetBrains Mono 500, lh 1.2, ls +0.08em, uppercase (section kickers, agent status)
- `metric`: clamp(1.75rem, 1.4rem + 1.5vw, 2.5rem), JetBrains Mono 500, lh 1.1, tabular-nums

Tracking ladder: more negative as display size grows (Wise), slightly positive on small labels (Mercury). Display type is huge, tight, and confident against generous whitespace; body stays quiet.

---

## 3. Spacing, layout, radii, borders

**Spacing: strict 8-grid with 4px fine grain.**
Scale (px): 4, 8, 12, 16, 24, 32, 40, 48, 64, 80, 96, 128, 160.
Sections breathe at 80 to 128. Components at 16 to 32. Page margin 32/24/16 (desktop/tablet/mobile). Content max-width 1200px, 12-col grid, 24px gutter.

**Control heights:** 32 (small), 40 (medium), 48 (default button and input), 56 (hero CTA).

**Radii (closed set):**
- `--radius-input: 10px`
- `--radius-card: 16px`
- `--radius-panel: 24px` (marketing surfaces, media frames)
- `--radius-pill: 9999px` (ALL buttons, chips, badges, nav items)

Buttons are pills, always. Pill + 48px height + Inter 600 at -0.011em is the button signature.

**Borders:** 1px, applied as `box-shadow: inset 0 0 0 1px var(--border-neutral)` on interactive controls so hover can thicken to 2px without layout shift. Focus: 2px outline in `--border-focus`, offset 2px.

**Glass:** the sticky nav is a glass chip: `background: rgba(247,250,255,0.72); backdrop-filter: blur(20px); border-bottom: 1px solid rgba(12,20,40,0.08)`. Glass is used for nav only.

---

## 4. Motion and the EKG

**Eases (closed set):**
- `--ease-summon: cubic-bezier(0.62, 0.18, 0.12, 1)` (the house curve: fast entry, long settle; everything interactive)
- `--ease-out-soft: cubic-bezier(0.16, 1, 0.3, 1)` (large reveals, section entrances)
- `--ease-spring: cubic-bezier(0.34, 1.55, 0.6, 1)` (delight only: success states, the hire-confirmed moment)

**Durations:** 120ms color/border micro, 200ms hovers and fills, 320ms panels and entrances, 600ms section reveals. Nothing slower except the EKG.

Entrances animate opacity + transform(8px) together at 320ms `--ease-out-soft`. No parallax. No scroll-jacking.

**The EKG heartbeat (signature motif):**
- Stroke: `--ekg-stroke: #0B5FFF`, 2px, round caps, on light surfaces. On the deep section: #5395FF.
- Glow: `filter: drop-shadow(0 0 6px rgba(11,95,255,0.35))`. This is the only glow in the system.
- Rhythm: one 2.4s cycle: flatline, P wave, the QRS spike, settle, rest. Drawn via stroke-dashoffset, linear timing across the trace (a heartbeat does not ease).
- Edges: the trace strip fades out at both ends with a mask (see gradient recipes), never a hard clip.
- Budget: at most one animated EKG per viewport. Secondary appearances (card corners, dividers) are static traces at `--border-strong` alpha.
- Meaning: animated = an agent is live/working. Static = capability, not activity. Do not blur this line.

**Reduced motion:** all animation collapses to opacity-only at 1ms; the EKG renders as its complete static trace, no drawing, no glow pulse.

---

## 5. Components (rules, not exhaustive specs)

- **Primary button:** pill, 48px, CTA gradient fill (see recipes), white Inter 600 label, hover shifts to the darker gradient + translateY(-1px) at 200ms `--ease-summon`, active removes the lift.
- **Secondary button:** pill, white fill, inset 1px `--border-neutral`, ink label; hover fill `--bg-neutral`.
- **Quiet button:** pill, `--bg-accent-quiet` fill, blue-800 label.
- **Cards:** white on canvas, `--radius-card`, 1px border, NO shadow at rest, 24 or 32 padding. Hover on interactive cards: border-strong + translateY(-2px), no shadow gain.
- **Inputs:** white, `--radius-input`, 48px, inset border; focus swaps to `--border-accent` at 2px + `--shadow-xs`.
- **Agent roster rows:** overline mono for agent ID, static EKG divider, sentiment chip for status.
- **Nav:** glass chip, pill links, active link gets `--bg-accent-quiet` pill.
- **The board table (core product surface):** JetBrains Mono tabular-nums for every number, right-aligned; row hover `--bg-neutral`.

**DON'Ts (the closed-vocabulary enforcement list):**
- DON'T use pure #FFFFFF as a page background, or any flat gray anywhere.
- DON'T use black shadows, or shadows on resting cards.
- DON'T introduce a second hue. No purple, no teal, no multi-color gradients, ever.
- DON'T put gradients on cards, borders, text, or icons. Gradients live in exactly three places (see recipes).
- DON'T animate more than one EKG per viewport, and never animate it decoratively.
- DON'T use Inter above 600, Space Grotesk below 600, or mono for prose.
- DON'T use em dashes in any product copy. Commas, colons, periods.
- DON'T exceed the 10% saturated-blue coverage rule.
- DON'T add a radius, ease, duration, or spacing value that is not in this file.

---

## 6. Derived dark theme (`[data-theme="dark"]`)

Dark is a re-pointing of semantic tokens, not a second design. Rules of derivation:
- Canvas #0A1120 (navy-black, same hue family), elevated #111B33.
- Text flips to #EEF2FA / #A9B4CE / #77829F.
- Neutral fills become white alphas (0.06/0.10/0.15); borders rgba(255,255,255,0.14).
- Accent brightens two steps for contrast: base #5395FF, hover #7FB0FF, active #A5C6FF; links #7FB0FF.
- Shadows are replaced by 1-step surface lightening; the hero shadow becomes rgba(0,0,0,0.5).
- Gradients invert their resolution target: washes resolve to #0A1120 and drop to half alpha.
- The EKG keeps #5395FF stroke with the same glow at 0.45 alpha: it reads brighter in the dark, which is correct, it is a heartbeat at night.
- The deep-navy section flip is a no-op in dark mode (renders as elevated surface).

Everything else (type, spacing, radii, motion, budgets, laws) is theme-invariant.

---

## Appendix A: Gradient recipes

/* ============================================================
   SUMMON v2 GRADIENT SYSTEM
   One hue family (Summon Blue), three sanctioned placements.
   Every gradient resolves to a token surface (#F7FAFF light,
   #0A1120 dark), never to pure white and never to black.
   No multi-hue gradients exist anywhere in the system.
   ============================================================ */

/* ------------------------------------------------------------
   1. HERO WASH (top of page, the "9am sky")
   Barely-there: peaks at blue-100 and dissolves into canvas
   within the first ~80% of the hero. Applied to the hero
   SECTION background, never to elements inside it.
   ------------------------------------------------------------ */
--gradient-hero-wash: radial-gradient(
  140% 90% at 50% 0%,
  #DCEBFF 0%,     /* blue-100, the strongest it ever gets */
  #EEF5FF 42%,    /* blue-050 */
  #F7FAFF 78%     /* resolves to canvas */
);
/* Optional second layer for depth, composited under the wash:
   a faint side glow that keeps the hero from feeling flat. */
--gradient-hero-side: radial-gradient(
  60% 50% at 85% 12%,
  rgba(11, 95, 255, 0.06) 0%,
  rgba(11, 95, 255, 0) 70%
);
/* usage: background: var(--gradient-hero-side), var(--gradient-hero-wash); */

/* ------------------------------------------------------------
   2. HORIZON GLOW (closing CTA section, the one loud moment)
   Bottom-anchored radial positioned just below the viewport
   edge (at 50% 104%) so saturated blue blooms up from the fold
   and dissolves into canvas. 5 stops, perceptually spaced.
   This is the ONLY place saturated blue may exceed the 10%
   coverage rule. White text + white pill CTA sit on the
   saturated zone.
   ------------------------------------------------------------ */
--gradient-horizon: radial-gradient(
  120% 100% at 50% 104%,
  #0B5FFF 0%,     /* Summon Blue, full strength at the anchor */
  #4D8DFF 12%,
  #A9CCFF 32%,
  #DCEBFF 50%,
  #F7FAFF 68%     /* resolves to canvas well before mid-viewport */
);

/* ------------------------------------------------------------
   3. CTA FILL (primary button, and nowhere else)
   A near-invisible vertical shift within the 500-600 range:
   reads as depth, not as "a gradient button".
   ------------------------------------------------------------ */
--gradient-cta:       linear-gradient(180deg, #2B78FF 0%, #0B5FFF 100%);
--gradient-cta-hover: linear-gradient(180deg, #1E6CF2 0%, #084DDB 100%);
--gradient-cta-active: none; /* active state flattens to #0640B4 */

/* ------------------------------------------------------------
   FUNCTIONAL (not decorative, exempt from the budget)
   ------------------------------------------------------------ */

/* Navy scrim for text over imagery/video. Navy, never black,
   in light mode. */
--gradient-scrim: linear-gradient(
  180deg,
  rgba(7, 31, 77, 0.55) 0%,
  rgba(7, 31, 77, 0.25) 45%,
  rgba(7, 31, 77, 0) 80%
);

/* Edge-fade mask for the EKG strip and horizontal scrollers:
   the trace dissolves at both ends, never hard-clipped. */
--mask-edge-fade: linear-gradient(
  90deg, transparent 0%, #000 12%, #000 88%, transparent 100%
);
/* usage: mask-image: var(--mask-edge-fade); */

/* Media dissolve: hero media melts into the wash instead of
   sitting in a box (4-edge mask, composited). */
--mask-media-y: linear-gradient(180deg, transparent 0%, #000 8%, #000 92%, transparent 100%);
--mask-media-x: linear-gradient(90deg, transparent 0%, #000 6%, #000 94%, transparent 100%);
/* usage: mask-image: var(--mask-media-y), var(--mask-media-x);
          mask-composite: intersect; */

/* ------------------------------------------------------------
   SECTION DRIFT (gradient-adjacent, but flat)
   Between hero wash and horizon glow, the page drifts through
   flat tinted sections: #F7FAFF canvas, #EEF5FF tint, #071F4D
   deep (token-remapped via [data-section="deep"]). The drift
   reads as one continuous atmosphere; no CSS gradient is used
   at section boundaries.
   ------------------------------------------------------------ */

/* ============================================================
   USAGE BUDGET (enforced in review, no exceptions)
   1. Hero wash: exactly one per page, hero section only,
      never exceeds blue-100 saturation.
   2. Horizon glow: at most one per page, final CTA section
      only. A page may have zero. Never in the hero AND the
      footer: pick one loud moment.
   3. CTA gradient: primary buttons only. Secondary, quiet,
      and neutral buttons are flat.
   4. Never on: cards, borders, text, icons, charts, dividers,
      table rows, badges. Zero exceptions.
   5. One hue family only. If a gradient contains a hue that
      is not in the blue-050..navy-950 ladder, it is a bug.
   6. Dark mode: same three placements, alpha-halved variants
      resolving to #0A1120 (defined in the dark token block).
   ============================================================ */

## Appendix B: Signature moves adopted (inspiration credits)

- Wise: brand-tinted neutrals. Every gray surface, hover fill, and border is a low-alpha tint of navy-950 (rgba(7,31,77,x)) or the ink, so the whole light UI carries the blue cast without ever showing flat gray.
- Wise: the two-tone brand chord. One electric fill (#0B5FFF) plus one near-black of the same hue (#071F4D) carry the entire identity; base/hover/active triads on every interactive token; pill buttons at 48px with Inter 600 labels.
- Wise: nearly shadowless light mode. Depth from surface stepping and 1px inset alpha borders; real shadows are scarce and reserved for floating objects, which is what makes them feel premium. Also the glass nav chip: 72%-alpha canvas tint + blur(20px).
- Stripe: the bottom-anchored horizon glow. A 5-stop radial anchored at 50% 104% that blooms saturated blue from below the fold and resolves to the tinted canvas #F7FAFF, used once per page as the closing CTA moment.
- Stripe: blue-keyed dual-layer shadows. Every shadow is navy-950 at 5 to 16% alpha in tight+ambient pairs, never black, so elevation stays inside the brand atmosphere.
- Mercury: section-scoped theme flips and the tinted-page rule. No pure-white page background, pure #FFFFFF reserved for elevated cards and inputs, and the page drifts through flat tinted atmospheres (canvas, tint, deep navy) via full token remaps instead of mid-element gradients. Also the 4-edge mask-image media dissolve.
- Wise: display type discipline. Huge, tight headlines (Space Grotesk 700 at line-height 1.0, tracking -0.03em) over a quiet Inter body, with the negative-tracking-grows-with-size ladder and slightly positive tracking on small labels (the label half is Mercury's).

## Appendix C: Deliberately rejected (Dorsey: limit the details)

- Instrument Serif italic accent: retired. It fought the light, engineered aesthetic and violated the three-font Dorsey budget. Space Grotesk carries all display personality now.
- Stripe's purple-violet accent family and its multi-hue accessories (conic border rings, tri-color sweeps, per-product accent blobs): SUMMON is one hue family only. A second hue would dilute the blue-equals-pulse law.
- Stripe's featherweight 300 typography: too ethereal for a company selling accountable AI employees. We keep weight in the display (600/700) and calm in the body (400).
- Mercury's custom-font micro-weight system (360/420/480/530) and dual base/magic ramps per hue: beautiful but too much vocabulary for a system this small. One ramp plus alpha tints covers everything.
- Mercury's 16-stop eased scrims and odometer digit-roll animations: craft we admire but detail count we cannot afford. Our scrim is 3 stops of navy and it is enough.
- Wise's total gradient ban: Adam's directive is gradient backgrounds, so we keep gradients but adopt Wise's discipline instead, three sanctioned placements with a hard budget.
- Wise's playful pastel block-color pool (yellow/orange/pink sections) and Stripe's WebGL hero wave: decorative surface area that adds nothing to trust. Flat tinted sections and a static radial wash say calm better.
- v1's dark-primary glow language: neon glows, dark vignettes, and high-alpha black shadows are all gone from light mode. The only glow that survives is the EKG's 6px blue drop-shadow, because the heartbeat is sacred.

## Appendix D: Implementation

Canonical token file: `design/tokens.css` (light canonical, dark derived). All surfaces consume these variables. No value ships that is not in this file.

