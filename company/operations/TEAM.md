---
name: Operations
description: Company setup, process, domains, repositories, and operating cadence.
manager: Cofounder
includes:
  - canary
  - benchmark
  - guard
  - retro
  - elon-algo
metadata:
  sources:
    - kind: spec
      repo: agentcompanies/agentcompanies
      path: specification.mdx
      note: TEAM.md manifest shape, adopted 2026-07-26 (SUM-275)
---

# Operations

**Owns:** company setup, process, domains, repositories, and operating cadence.

## Craft skills

`/canary` after any deploy, `/benchmark` for the health picture (there is no
`/health` skill), `/guard` before destructive work, `/retro` for the weekly.
Every process passes `/elon-algo` before it is optimized: a process that
should not exist must never be automated.

## Operating facts

- Control plane: 127.0.0.1:3100, embedded Postgres on 54329.
- Restart drill: stop Postgres cleanly first, then node. Orphaned Postgres
  workers holding 54329 are the known failure mode.
- Never restart or migrate the live control plane while runs are active.

## Current task

The board is the only source of truth.

## How to engage

- In Summon: assign a task, or address the department in board chat.
- Escalation: department, then Cofounder, then Adam (the board).
