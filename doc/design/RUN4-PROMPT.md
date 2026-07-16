# Run 4 — Palette-class retirement + toast decision: guide + /goal prompt

Executes DECISION-SHEET B2 (3,115 Tailwind palette-class sites / 145 files → semantic
tokens, cluster-by-cluster) and closes C9 (toast). This is the "simplify" run: after it,
the app speaks ONE color vocabulary (semantic tokens), and the ESLint ratchet can turn on.

## Which directory?

Fresh worktree from origin/master, same pattern as Run 3:

```bash
cd C:/Users/adamp/OneDrive/Aether/summon.company
git fetch origin && git worktree add ../.worktrees/summon-run4 -b design/palette-retirement origin/master
cd ../.worktrees/summon-run4 && pnpm install
```

Launch `claude` inside it, type `/goal`, paste the block below.

## What to expect

Mostly unattended. Zero-pixel is the default expectation (palette class → token with the
SAME resolved value); any visible delta must be exported for review like Run 3.

## The /goal paste block

```
Retire Tailwind palette classes from ui/src per DECISION-SHEET.md B2.
DESIGN.md is the source of truth; read doc/design/CHANGING-THE-UI.md
and doc/design/RUN4-PROMPT.md first. Work only in this worktree.
Small reviewable commits: one cluster per commit.

SCOPE
1. Cluster the 3,115 palette-class sites (bg-red-500, text-zinc-400,
   etc.) by MEANING, starting with status-adjacent colors (red=danger,
   green=done, amber=warn, blue=running/info), then neutrals
   (zinc/slate/gray text+bg+border ladders), then brand blues, then
   long-tail decoratives.
2. Per cluster: map to an existing semantic token where one exists;
   mint a new token in ui/src/index.css ONLY when no semantic fits
   (closed vocabulary; document each mint in the commit).
3. "N live" sidebar text and other Run-3 leftovers flagged "for Run 4"
   in DECISION-SHEET.md are in scope.
4. C9 toast: retokenize toast palette colors; evaluate
   sonner-behind-pushToast-facade vs keep-custom; write the verdict
   in DECISION-SHEET.md C9 (execute only if zero behavior change).
5. Extend check:token-gates to fail on NEW palette classes in
   ui/src/components/** and ui/src/pages/** (allowlist the documented
   exceptions: test lockstep values, InviteLanding, third-party chrome).

VERIFICATION DISCIPLINE
- Suite green before starting; per-cluster commits; zero-pixel expected
  (same resolved values). Any diff: triplet into doc/design/run4-review/
  + one-line justification, or STOP and record in DECISION-SHEET.
- pnpm check:token-gates / typecheck / ui build / ui vitest / visual
  suite all green at close.

DONE WHEN
1. rg '\b(bg|text|border|ring|fill|stroke)-(red|orange|amber|yellow|
   lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|
   pink|rose|zinc|slate|gray|neutral|stone)-\d{2,3}\b' over
   ui/src/components ui/src/pages returns only allowlisted sites.
2. The extended gate is committed and CLEAN.
3. C9 verdict recorded; toast colors tokenized.
4. All suites green; run4-review/ contains any visible-delta triplets.

GUARDRAILS
- Preserve behavior and pixels; no layout or hue-meaning changes.
- No new dependencies without the C9 verdict saying so.
- Never re-baseline a diff you cannot justify in the commit message.
```

## After the run

1. Review doc/design/run4-review/ (should be nearly empty).
2. Turn on the ESLint ratchet (the last roadmap item from the tune session).
3. Proceed to RUN5-SUMMON-BRAND.md (light-flagship brand preset).
