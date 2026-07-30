---
name: Engineering
description: Runtime, architecture, reliability, and product execution for summon.company.
manager: Cofounder
includes:
  - review
  - ship
  - investigate
  - codex
  - elon-algo
metadata:
  sources:
    - kind: spec
      repo: agentcompanies/agentcompanies
      path: specification.mdx
      note: TEAM.md manifest shape, adopted 2026-07-26 (SUM-275)
---

# Engineering

**Owns:** app, auth, billing infrastructure, monitoring, and integrations.
Engineering owns product execution; the Cofounder owns product strategy.

## Craft skills

Declared in `includes` above and bound in the agent's instruction bundle:
`/review` before in_review, `/ship` for release-shaped work, `/investigate`
for any bug (no fix before root cause), `/codex` for a cross-model second
opinion. Decisions run through `/elon-algo` first.

## Current task

The board is the only source of truth. Never hardcode it here: a task
written into a doc goes stale the day it changes.

## How to engage

- In Summon: assign a task, which wakes the agent, or address the department
  in board chat.
- Department knowledge lives in this folder as files.
- Escalation: department, then Cofounder, then Adam (the board).
