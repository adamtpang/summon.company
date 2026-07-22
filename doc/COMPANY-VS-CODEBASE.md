# A company is not a codebase (and what Summon does about it)

Board doctrine, 2026-07-22. The one-page answer to "Claude Code is for codebases, Summon is for companies: what actually differs?"

## First principles

A company is a compounding loop: problems get triaged, people and agents do work, work becomes products, services, and assets, customers pay, and money plus learning feed back in. A codebase is one asset inside that loop.

## The starter packs, mapped

| Codebase | Company (what Summon models) |
|---|---|
| repo of files | org and assets, departments as folders |
| package.json dependencies | cap table, payroll, vendor bills |
| issue tracker | the board, problems triaged S to F |
| tests and typecheck | paying customers and retention |
| CI on every commit | routines on cadence, review gates |
| git history | ledger and the public changelog |
| build artifact | the product, service, or asset |
| README | NORTH_STAR.md |
| one dev in a terminal | many humans and agents, one task each |

## The three deep differences

1. **Feedback speed.** Code verifies in seconds (tests), the market verifies in weeks (revenue, retention). Summon's real job is proxy verifiers that sit between the founder and the market: triage scores, review decks, outcome receipts. The tighter the proxies, the faster the company can iterate.

2. **Reversibility.** `git revert` exists. A refund, a burned customer, or a bad send does not revert. That is why Summon has approval gates and a decision deck where Claude Code has permission modes.

3. **Legibility.** A codebase is all text in one folder, fully greppable. A company's state is scattered across inboxes, bank balances, SaaS tabs, and heads. Summon's core promise is making company state as greppable as code: org as folders, board as the queue, roadmap as the progress bar, ledger as history.

## The operating rule that falls out

Ask one question about any piece of work: **is the deliverable a diff, or a decision?**

- A diff: use the workbench (Claude Code or the engineering department dispatching it).
- A decision, an assignment, an order of battle, anything cross-department: use the boardroom (Summon chat).

The dogfood loop: every time Summon cannot do something the founder needed, that exact gap gets typed into chat and becomes a ranked task on the SUM board. The backlog becomes a list of proven customer needs where the first customer is the founder.
