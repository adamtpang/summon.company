# SUM-142 — Surface grade against the product sentence

**Grader:** Ink · Design Director · 2026-07-22
**The sentence (board, ruthless pass 2, master f1dcaa3d9):**
> "super clear what the next best thing to do is for the humans and AI agents
> involved, based on the problems the company faces, triaged, and assigned to
> the right agents and humans."

**The test (two questions every surface must answer):**
1. **WHOSE** move is it? — does the surface name which agent/human owns the next action?
2. **WHAT** is the move? — does it name the specific next best action with a clear verb/CTA?

This is law 12 (five-second test) made concrete. A surface either **PASSES**
(answers both), is **DEFENSIBLE** (exists for a different honest job — record,
config, reference — and does not pretend to be a next-move surface), or is
**NEEDS-WORK** (presents as actionable but fails WHOSE or WHAT). Graded from the
shipped code on master, not vibes.

## The gold standard

`MissionControl.tsx` sets the bar. The Next-move card names WHOSE ("Your next
move") and WHAT (a single computed CTA: *Clear N decisions* → *Review VIT-x* →
*Assign VIT-x* → *All clear*). The Org cards name each department, its current
task, its owner, and progress. Every element is evidence-derived. **PASS.**

## The grade (12 surviving surfaces)

| Surface | Lead element | WHOSE | WHAT | Verdict |
|---|---|---|---|---|
| **Dashboard / Mission Control** | Next-move card | yes | yes | **PASS** |
| **Org / Formation** | Constraint dept + owner + Dispatch/Staff CTA | yes | yes | **PASS** |
| **Roadmap** | Critical-path panel: owner + "Open next task" | yes | yes | **PASS** |
| **Agents** | Agent rows: name + status + "Run Heartbeat" | yes | yes | **PASS** |
| **Inbox** | Tabbed personal work list (mine/unread/blocked) | partial | partial | **DEFENSIBLE** — personal work list, not company triage |
| **Tasks / Issues** | Progress strip ("N done · Next up: …") | partial | partial | **DEFENSIBLE** — status record; the drill-down of the queue |
| **Costs** | Spend tiles + budget incident cards | partial | partial | **DEFENSIBLE** — money record + incident response |
| **Activity** | Chronological event log | no | no | **DEFENSIBLE** — read-only audit log |
| **Settings** | Config form (name, budget, logo) | no | no | **DEFENSIBLE** — configuration |
| **Projects** | "My / Other Projects" tiles: name + status badge | **no** | **no** | **NEEDS-WORK** |
| **Messages** | Employee rail: presence + last-message preview | **no** | **no** | **NEEDS-WORK** |
| **Decisions** | Deck/list of resolvable decisions with verbs | partial | yes | **NEEDS-WORK** (priority/constraint framing missing) |

## The three failures → three follow-up subtasks

Per the board cadence ("one S-tier at a time — ready to dispatch when the board
says go"), these are filed as ranked, unassigned child issues for the board to
dispatch. Each fix serves a named law and mirrors an already-shipped pattern.

### P1 — Projects: rows carry no next move (law 12, law 6)
Each project tile is a passive link — name, description, status badge — and
answers neither WHOSE nor WHAT. **Fix:** give every row the Mission-Control Org-card
treatment — surface the project's binding sub-task, its owner, and the next
action ("Waiting on Sol to approve", "Ready — assign to an agent"). A lone status
badge is a metric without a next step (law 6 violation); it gets context or gets cut.

### P2 — Messages: the rail shows presence, not need (law 12, thesis)
The thread rail is sorted by conversation, not by who is waiting on the board.
Chat is a thesis surface ("outcomes not logs") — its answer to the sentence is
*which employees need me now and why.* **Fix:** add a per-thread next-action line
so the rail reads "Ada needs your sign-off to raise the budget cap", and rank the
rail by that, not by last-message time. Presence + preview alone is a channel, not
a triaged surface.

### P3 — Decisions: verbs are clear, priority is not (law 3, law 6)
The deck resolves decisions with clean verbs (WHAT = yes) but every card looks
equally urgent — it never says which decision unblocks the biggest company
constraint (WHOSE/priority = partial). **Fix:** badge the top card with the
constraint it clears ("Unblocks Engineering — 3 tasks parked"), computed from the
same roadmap-constraint evidence Mission Control already uses. One primary card
carries the weight (law 3); the rest stay quiet.

## What is explicitly NOT broken

Inbox, Tasks, Costs, Activity, and Settings are **correct as record / config /
reference surfaces** and must not be forced into next-move theater. Costs is the
money truth of record; Activity is the audit log; Settings is configuration.
Adding fake "next move" CTAs to them would violate law 1 (deletion test) by adding
chrome that carries no new affordance. They defend themselves. They live.
