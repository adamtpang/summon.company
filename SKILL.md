# Vitals (skill)

A portable, JSON-config company operating system. The fundamentals are universal
(every company has a mission, a problem, money, metrics, a roadmap, an org). The
founder fills in the blanks. Claude is the agent that operates it. Inspired by Tobi
Lutke's JSON-config company OS and by Bridgewater's "principles encoded as software."

## The model
- The **codebase is the knowledge base** (the context files).
- `vitals.data.js` is the **single JSON-style config and state file** (the source of truth).
- `index.html` + `vitals.core.js` + `vitals.css` are the renderer (zero dependencies, no build).
- **Claude is the runtime:** the founder talks, Claude updates the config and the knowledge base.

## The schema
See `schema.md`. The load-bearing fields: `metrics` (with `value`, `target`, and a
`next` reconciling action), `roadmap` (gated, checkable), `goals`, `decisions` (the
why behind choices), and `knowledgeBase` (the context files this OS is tied to).

## Commands Claude follows (plain language)
- **"set up vitals here" / "init"**: vendor the dashboard files into the repo, then run the interview.
- **"interview me" / "onboard me"**: run the interview below, then write `vitals.data.js` and create or update the knowledge-base context files.
- **"log this week"**: append a snapshot to `history` using today's real date, pulling current metric and finance numbers.
- **"check off X" / "mark X done"**: set that roadmap item or goal `done: true` (reverse on "uncheck").
- **"set <metric> to N" / "set the target for <metric> to N"**: update `value` or `target`.
- **"add a decision"**: append to `decisions` with date, decision, why, and what would change our mind (`revisit`).
- **"sync from context"**: re-read the context files and update the config to match reality.
- After any change, remind the user to refresh `index.html`.

## The interview (to populate a new company's Vitals and seed its knowledge base)
Ask a few at a time, conversationally. Use answers to fill `vitals.data.js` and seed context files.
1. Company name and a one-line tagline.
2. Mission: the 25-year why.
3. The problem, and exactly who has it.
4. The solution and product line: what is Live, Building, Next, Later.
5. North star: the single output number that means winning.
6. The 3 input metrics you control week to week (and a target for each if known).
7. Money: monthly income, monthly expenses, cash (say "skip" if private; default to placeholders and remind them to gitignore the data file).
8. The roadmap: the gated stages from today to your next big milestone.
9. The org: the functions, who owns each now, the first hires.
10. Quarterly goals: 3 max.
11. Non-negotiables and key decisions: seed the `decisions` log with the big calls and their why.
12. Competitors and the graveyard: who tried this and failed, and why.

## Porting to any company
This is a vendored library. Copy the `vitals/` folder into any repo (or run
`npx github:adamtpang/vitals.run`), then "interview me" to populate it. One renderer,
many companies, each with its own data file.

## Principle
The founder fills the blanks; the fundamentals are universal; Claude keeps the config
and the knowledge base in sync. Dogfood it on one real company first.
