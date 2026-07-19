# The company, as a folder

This directory IS summon.company the organization — the core-8 org chart
(standardized from cofounder.co doctrine) rendered as folders. One folder per
department; each README carries the full agent + department context. Code
describes what the product does; `company/` describes who runs it.

**Convention (applies to every company Summon imports):** a paired repo gets a
`company/` folder with these eight department folders. Files inside a
department folder are that department's standing context — agents read it
before working, humans read it to know who owns what. Root-level department
folders (`/sales`, `/engineering`) are equivalent when the repo has no
collisions; `company/` is the portable default.

## Leadership (outside the eight)

- **Sol · CEO** — Claude Fable 5. Routes, decides, never holds tasks.
  Surface → Triage → Route.
- **Pulse · Diagnostician** — Opus 4.8, staff role. Reads the vitals, audits
  the board (currently: SUM-150, the blocked-backlog audit).

## Departments

- [engineering](engineering/README.md) — Vector · CTO, Forge · Engineer
- [design](design/README.md) — Ink · Design Director
- [marketing](marketing/README.md) — Echo · CMO
- [sales](sales/README.md) — Magnet · Sales
- [finance](finance/README.md) — Ledger · CFO
- [operations](operations/README.md) — Atlas · COO
- [support](support/README.md) — Haven · Support
- [legal](legal/README.md) — Shield · Legal

## The model ladder

CEO = Claude Fable 5 · core-8 department heads = Claude Opus 4.8 · subagents
under a department = Grok 4.5 via `grok_local` (free window). Each level down
carries a lesser model; a subagent always reports into a department head
(e.g. a fundraiser under Finance), never straight to the CEO.

## Standing doctrine

- Thiel rule: one agent, ONE task. Everything else stays unassigned on the
  ranked board.
- Chrome is monochrome; color is data. Plain words beat doctrine words.
- Manual mode is sovereign: routing suggests, the board dispatches. Budgets
  pause; they never bill.
- Knowledge convention: `doc/KNOWLEDGE-STRUCTURE.md`. Founder corpus:
  `knowledge/`.
