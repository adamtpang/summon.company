# Run 4 review: visible deltas

Run 4 retired Tailwind palette classes to semantic CSS custom property tokens
across ui/src/components/ and ui/src/pages/. This file documents cases where
the replacement produced a visible hue or tone shift (not a zero-pixel change).

## Delta 1: amber body text inside warning banners

**Affected pattern:** `text-amber-900/90` and similar high-opacity amber-900 variants
used as dark-brown body text inside amber/yellow warning surfaces.

**Before:** `text-amber-900/90` -- resolved to approximately #78350f at 90% opacity,
a dark warm brown readable on a light amber background.

**After:** `text-(--muted-foreground)` -- resolves to #5a5a5a (light mode) or #a3a3a3
(dark mode), a neutral gray.

**Reason:** The codemod treated all amber palette classes as status-indicator color
(amber = `--status-task-todo`, a bright amber-500 equivalent). Body text that used
amber-900 for contrast within warning surfaces would have become illegible as bright
amber on yellow. Replacing with `--muted-foreground` keeps text readable.

**Hue change:** warm brown -> neutral gray inside warning banners. The warning
surface color is unchanged (bg tokens handle that separately). This is a small
tone shift; no semantic meaning is lost.

**Files affected:** approximately 265 files contained `text-(--status-task-todo)/{opacity}`
patterns that were corrected to `text-(--muted-foreground)`. Not all of those were
amber-900 body text; some were intentional amber-tinted count labels (e.g.
KanbanBoard `text-amber-700/65` for pending-issue counts). Those also shift to
neutral gray. Board judgment: acceptable for Run 4; a future run can mint
`--count-todo` if the amber tint on counts is desired.

## Delta 2: KanbanBoard pending count tint

**Affected:** `text-amber-700/65` on pending-issue count badges in KanbanBoard.

**Before:** 65%-opacity amber-700, a muted amber tint on count text.

**After:** `text-(--muted-foreground)` -- neutral gray.

**Reason:** Caught by the same amber-body-text fix as Delta 1. The original intent
was a subtle amber tint to reinforce the todo/pending meaning. Neutral gray is
still readable; the semantic meaning is preserved through the column heading and
status chip. No functional regression.

## Gate 4 allowlist

Files carrying legitimate palette classes that are permanently allowlisted:

| File | Reason |
| --- | --- |
| ui/src/pages/InviteLanding.tsx | Third-party landing chrome (external brand constraints) |
| ui/src/pages/DesignGuide.tsx | Design reference/showcase (intentional palette display) |
| ui/src/components/DocumentAnnotationLayer.tsx | Annotation outline colors (runtime-dynamic palette needed) |
| ui/src/components/StarToggle.tsx | fill-amber-500 golden-star UX (meaningful specific hue) |
| ui/src/components/SidebarAgents.tsx | fill-amber-500 star icon (same as StarToggle) |
| ui/src/components/SidebarStarredProjects.tsx | fill-amber-500 star icon (same as StarToggle) |
