# Run 5 — SUMMON light-flagship brand preset: guide + /goal prompt

This is the deferred "preset session" the DECISION-SHEET kept pointing at (B4 radius went
here; chart-hue adjacency "revisit at preset session"). It aligns the APP's tokens with
the SUMMON v2.0 brand (design/tokens.css + apps/landing — "light canonical, dark derived",
Summon Blue #0B5FFF, canvas #F7FAFF, ink #0C1428) so the desktop app and the landing are
one product. Light mode is already the default (ui/index.html seeds "light" when nothing
is stored); this run makes light the FLAGSHIP, not just the default.

## Sequencing

AFTER Run 4. Palette classes must be retired first — otherwise the brand remap misses
3,115 hardcoded sites and the app splits into two color worlds. (Run 4 makes this run
a token-value edit instead of a codebase sweep. That's the whole point of the campaign.)

## Which directory?

```bash
cd C:/Users/adamp/OneDrive/Aether/summon.company
git fetch origin && git worktree add ../.worktrees/summon-run5 -b design/summon-brand-preset origin/master
cd ../.worktrees/summon-run5 && pnpm install
```

Launch `claude` inside it, type `/goal`, paste the block below.

## What to expect

DELIBERATELY visible — this is a reskin run, the opposite of Run 4. Every changed story
re-baselines behind a contact-sheet review (the tune-session gallery pattern). Budget a
gallery round-trip with the board before merge.

## The /goal paste block

```
Align the app UI tokens with the SUMMON v2.0 brand so light mode is
the flagship surface. Brand source of truth: design/tokens.css +
DESIGN_SYSTEM.md ("light canonical, dark derived"). Token destination:
ui/src/index.css ONLY (DESIGN.md rule - design/tokens.css stays the
landing's file; the app consumes the same VALUES through its own
semantic tokens; if wholesale import is cleaner, index.css @imports a
single shared file - never two parallel sources).
Read doc/design/CHANGING-THE-UI.md and doc/design/RUN5-SUMMON-BRAND.md
first, and pin the five annotated pattern references in
doc/research/MOBBIN-PATTERNS.md section 5 (VIT-50) while working -
they set the density/anatomy bar for Inbox, model picker, and usage
surfaces; status-token guardrails there match this run's.
Work only in this worktree. One semantic family per commit.

SCOPE
1. Map the app's semantic tokens (:root light block) onto the SUMMON
   v2.0 palette: canvas/surface (#F7FAFF/#FFFFFF family), text ladder
   (#0C1428/#46506B/#6B7590), borders, primary/accent (Summon Blue
   #0B5FFF family), section tints. Preserve STATUS hues (status-task-*,
   status-agent-*) - they are an operator vocabulary, not brand.
2. Derive the dark block per the same brand doc (dark derived, never
   independently invented); keep contrast ratios WCAG AA on both.
3. Close B4's open shadow decision using the landing's shadow key
   (navy-950-based) - one shadow ladder, both themes.
4. Light-mode legibility sweep: rerun the gallery round-2/3 checks
   (dark-text-on-light-wash, bar fills, chips) against the new values.
5. Theme toggle: surface it as a first-class control in Settings AND
   the command palette if one exists (mechanism already in
   ThemeContext.tsx - this is discoverability only, no new machinery).
6. Desktop chrome: apps/desktop window/titlebar + ui/index.html
   theme-color metas pick up the new canvas values in both themes.

VERIFICATION DISCIPLINE
- This run is EXPECTED to re-baseline broadly. Process: per-family
  commit -> affected stories -> contact sheet (before/after grid) into
  doc/design/run5-review/ -> board gallery review BEFORE merge, exactly
  like the tune session. maxDiffPixels: 0 against the NEW baseline at
  close.
- pnpm check:token-gates / typecheck / ui build / ui vitest green.
- A11y: axe pass on the top 10 pages, both themes, no new violations.

DONE WHEN
1. The app in light mode reads as the same product as the landing
   (side-by-side screenshot committed to run5-review/).
2. Dark mode derived and reviewed on the same contact sheets.
3. Both index.css theme blocks contain only brand-derived or
   status-vocabulary values; gate stays CLEAN.
4. Board has approved the gallery; suite green on the new baseline.

GUARDRAILS
- No layout, spacing, or component changes - values only (plus the
  toggle surfacing and chrome metas). Anything structural: record in
  DECISION-SHEET and stop.
- Status hues untouched (chart adjacency trade gets REVIEWED on the
  contact sheet, decided by the board, not silently changed).
- Never merge without the gallery approval.
```

## After the run

The desktop app IS the brand: light-first, one vocabulary, landing-coherent.
Remaining known work: issue→task rename run, C6 launchers overlay review,
VIT-29 NSIS installer.
