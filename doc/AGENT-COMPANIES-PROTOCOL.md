# The Agent Companies protocol, and what Summon does about it

Studied 2026-07-25: [agentcompanies/agentcompanies](https://github.com/agentcompanies/agentcompanies)
(105 stars, MIT, draft stage) and the directory at
[companies.sh](https://companies.sh).

## What they are

**The protocol**: "a vendor-neutral extension protocol for describing
portable AI companies in text files." It extends Agent Skills from reusable
capability packages to whole-company composition. A company is a git repo:

```text
my-company/
├── COMPANY.md
├── teams/engineering/TEAM.md
├── agents/ceo/AGENTS.md
├── projects/q2-launch/PROJECT.md
├── tasks/monday-review/TASK.md
├── skills/review/SKILL.md
└── .paperclip.yaml
```

Their README states plainly: "Paperclip is one implementation of the
standard." Our kernel is already a named runtime for this spec.

**The directory**: `npx companies.sh add <owner/repo>` installs a pre-built
organization. Leaderboard on 2026-07-25: GStack 682 installs, Agency Agents
268, Superpowers Dev Shop 207, Fullstack Forge 106, Product Compass 89, then
a long tail down to single digits across 18 listed companies. Early, real,
and small enough to matter to us.

## The field mapping (we are already about 90 percent shaped like this)

| Spec | Summon today | Gap |
|---|---|---|
| COMPANY.md (name, description, slug, goals) | `companies` row plus `goals` | Needs stage and constraint (SUM-269) |
| TEAM.md (`manager`, `includes`) | department, held in `agents.metadata` jsonb | Promote to a column (SUM-272); `company/<dept>/TEAM.md` now ships in spec shape (SUM-275, done) |
| AGENTS.md (`title`, `reportsTo`, `skills`) | `agents.title`, `agents.reportsTo` (real FK), `company_skills` | Close to exact; instructions already live in AGENTS.md files |
| PROJECT.md | `projects` plus `project_workspaces.repoUrl` | Fill the empty ones |
| TASK.md (`assignee`, `project`, `schedule`) | `issues.assigneeId`, `routines`, heartbeat schedules | Close to exact |
| SKILL.md | `skills/` in this repo | Already compatible |
| `metadata.sources` (repo, path, commit sha, content hash, license) | our knowledge provenance rule | Same idea, different words |

The overlap is not a coincidence: both descend from Agent Skills, and
Paperclip is the runtime the spec names.

## What this changes for Summon

1. **Export and import the protocol.** A Summon company should round-trip to
   spec-compliant text: `COMPANY.md`, `teams/*/TEAM.md`, `agents/*/AGENTS.md`,
   `projects/*`, `tasks/*`, `skills/*`. That makes a company `git clone`-able
   and diffable, which is the same answer the machine-readability audit
   asked for, arrived at from outside. It also removes lock-in as an
   objection: the customer keeps their company even if they leave.
2. **Distribution.** The directory is a free channel pointed exactly at our
   avatar (people who already want an AI company). Publishing Summon's
   9-seat org standard as an installable company puts our structure in front
   of that audience, and each install is a lead we can see.
3. **Import as onboarding.** Someone with a companies.sh org should be able
   to point Summon at the repo and have it adopt, never duplicate (the SELA
   rule). Fastest possible first-run for anyone already in this ecosystem.

## The honest strategic read

The protocol commoditizes the *description* of a company: text files anyone
can copy. Nothing in that directory runs the work, spends a budget, keeps
receipts, or moves money. So the spec is the commodity layer and Summon's
differentiation has to be the runtime and the evidence: real runs, real
budgets, real pull requests, real invoices. Speak the standard fluently,
compete on execution.

Board: SUM-273 (speak the protocol), SUM-274 (publish to the directory),
SUM-275 (company/ folders become TEAM.md).
