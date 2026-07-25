# /summon — connect any Claude Code session to the Summon control plane

Summon (summon.company) is Adam's AI-agent-company OS: every company gets a
named org of AI employees, a ranked task board, and a board seat (Adam). This
skill is the bridge: from ANY repo, ANY session — connect, onboard the current
project as a company, standardize its org, diagnose its constraint, and route
work. "Claude Code is for codebases, Summon is for companies" — this skill is
where the two shake hands.

Trigger on: `/summon`, "connect to summon", "onboard this repo into summon",
"standardize this company", "summon status", "sync this to summon", or any ask
to run the current project as a Summon company.

## Connection

- Preferred: the `summon` MCP server (user-scope, tools `summon_companies`,
  `summon_tasks`, `summon_task`, `summon_create_task`, `summon_comment`,
  `summon_agents`, `summon_fleet_running`, `summon_fleet_stop`).
- Fallback: raw HTTP on the control plane `http://127.0.0.1:3100/api` via
  node fetch (never curl — proxy env breaks it on this machine).
- If the server is down: start it hidden with
  `cscript //nologo scripts/start-summon-hidden.vbs` from the summon.company
  repo, poll `/api/health` up to 180s. Known failure: an orphaned
  `postgres.exe` holding :54329 — kill the orphan worker, restart. Never kill
  node before Postgres is down.

## Modes (infer from the ask; STATUS is the default)

### STATUS — where do things stand
List companies (prefix, operating mode, agent count), live runs, and the top
S/A-tier tasks. One screen, no prose walls. End with the single next move.

### ONBOARD — make the current repo a company
1. Identify the repo (git remote, folder name). Check if a company already
   pairs to it — never create duplicates.
2. Create the company (name from the repo/product, 3-letter issue prefix),
   pair the repo/org URL, and pull identity: GitHub owner avatar →
   `logoUrl` (`https://github.com/<owner>.png`), description, homepage.
3. **Place it on the roadmap** (doc/COMPANY-ROADMAP.md): 8 stages, Initial
   idea → Found it → Identity → Build → Distribute → Launch → Operate and
   close → Scale. Position = the lowest stage whose exit evidence is
   unproven; that stage holds the constraint candidate. Evidence only,
   never vibes.
4. Proceed to STANDARDIZE. New companies start in `manual` operating mode —
   nothing executes unpointed.

### STANDARDIZE — apply the org standard (the core of this skill)
Every company gets the same shape. Idempotent: check before creating.

1. **Core-8 org chart** — exactly eight departments: engineering, design,
   marketing, sales, finance, operations, support, legal. (Product is NOT a
   9th — the CEO owns product strategy.) ADOPT BEFORE CREATING: company
   creation auto-seeds a default department set, and a second staffing pass
   produces "Engineering 2" duplicates (the Sellsniper SELA incident,
   2026-07-25). First LIST existing agents; wire and rename what is already
   there; create only what is missing. Also check for an existing company
   with the same repo before creating one — a second onboarding must adopt,
   never duplicate (the SEL/SELA double-ticker incident).
2. **Plain function names ONLY, no C-suite naming** (board rulings
   2026-07-19 and 2026-07-25): the org is exactly 9 seats: Cofounder,
   Support, Operations, Legal, Finance, Engineering, Design, Sales,
   Marketing. That's it. Names AND titles are the plain department word:
   never CEO/CTO/CMO/CFO/COO titles, never "Head of X", NO invented first
   names (Sol, Atlas, Vector, Qubit and the rest are retired; personas
   return only as unlockable characters, SUM-196). The internal `role`
   field (ceo, cto...) is upstream plumbing and stays; naming is display.
   "Reflection Coach" is upstream built-in machinery, not an org seat:
   leave it alone, never count it in the 9.
3. **Model ladder** — CEO = `claude-fable-5`; core-8 department heads =
   `opus`; subagents under a department = `grok_local` (free Grok window).
   A subagent always reports into a head (a fundraiser under Finance), never
   the CEO. Known gap: grok runs can't emit dispositions yet (SUM-145) —
   raise/revenue-critical subagents stay on opus until it closes.
4. **Wiring** — `metadata.department` on every agent (strongest formation
   signal), `reportsTo` chains so the org chart is ONE connected tree rooted
   at the CEO.
5. **company/ folders** — scaffold `company/<dept>/README.md` in the repo
   (mode/hero/owns, agent chain with tier, the ONE current task, engagement +
   escalation). The codebase carries its org. Reference:
   summon.company/company/.
6. **Knowledge slot** — every company needs a knowledge base: import existing
   (Notion/Obsidian/Drive via MCP connectors) or scaffold `knowledge/` per
   summon.company/doc/KNOWLEDGE-STRUCTURE.md. Provenance on every fact;
   stale figures flagged confirm-before-quoting.

### DIAGNOSE — the cofounder loop (learned from /cofounder)
Run the whole-company diagnosis, then route:
1. **Surface** — read the vitals: open tasks by tier (S=9-10, A=8, B=6-7,
   C=4-5, D=3, F=2 from importance+urgency stars), live runs, spend, blocked
   pile, in_review pile.
2. **Demand check (learned from optimism.fun)** — before grading supply,
   grade demand: What problem does this company solve? Who pays, how much,
   how urgently? Priority = IMPORTANT × URGENT — a company's S-tier should
   trace to paying demand or the constraint blocking it. Infinite problems ×
   infinite solutions; opportunity lives in the allocation gap. If nothing on
   the board touches revenue or the binding constraint, say so — that IS the
   diagnosis.
3. **Constraint** — name ONE binding limit (theory of constraints; the
   roadmap's lowest unproven stage holds it, see doc/COMPANY-ROADMAP.md).
   Everything else waits.
   Before any routed task is executed, the department runs /elon-algo on
   it: question, delete, optimize, accelerate, automate, in order.
4. **Route** — Thiel rule: one agent, ONE task. S-tier first, matched to the
   right department head. Assignment wakes the agent (that's the dispatch).
   Board-only work (sending offers, signing, paying) is listed for Adam,
   never assigned to an agent.
5. **Receipt** — every claim in the report traces to control-plane evidence
   (statuses, run locks, timestamps), never self-reporting.

### SYNC — push session context into the company
When a Claude Code session produced knowledge Summon should keep: write it to
the company's knowledge base (or the repo's `knowledge/`), comment on the
matching task with evidence (commits, URLs), and update `company/` folders if
the org changed. Comments on assigned tasks WAKE the assignee — say so before
commenting on a task with an assignee.

## Standing rules (non-negotiable)

- **Manual mode is sovereign**: routing suggests, the board dispatches.
  Never flip a company to 24/7 or autopilot — that is Adam's toggle.
- **Thiel rule**: never give an agent a second task; never assign filler.
- **Money artifacts confirm first**: Stripe links, offers, invoices — draft,
  show, wait for Adam's yes. Adam markets, never pushes (offers are postable
  artifacts with a buy link).
- **Monochrome doctrine**: chrome is white/black; color is data. Plain words
  beat doctrine words (Org, not Formation).
- **The kernel rule**: never rename `@paperclipai/*`, `PAPERCLIP_*`,
  `paperclipai` CLI, `~/.paperclip` — upstream ABI, not branding.
- **Shared-tree caution**: agents may hold the summon.company working tree on
  a feature branch. Commit board work to master via stash → switch → pop →
  commit → push, and restore the branch after (until SUM-168 isolates
  workspaces).

## Output style

Lead with the one thing that matters. Tier chips and numbers over prose.
Every run ends with: the single next move for Adam, and what got dispatched
(agent ← task). No em-dash walls, no doctrine words without their plain
translation.
