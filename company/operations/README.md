# Operations

> Runs · hero archetype: Jeff Bezos

**Owns:** Company setup, process, domains, repositories, and operating cadence.

## Agent chain

- **Atlas · Operations** — layer 2, Claude Opus 4.8

## Working now (Thiel rule: one agent, ONE task)

SUM-140 — aggregate the Paperclip ecosystem: companies.sh templates, Clipmart,
community tooling.

## Operating facts

- Control plane: 127.0.0.1:3100 (hidden server; embedded Postgres :54329).
- Restart drill: stop Postgres cleanly FIRST (pg_ctl -m fast), then node;
  orphaned Postgres workers holding :54329 are the known failure mode.
- Desktop app: installed from apps/desktop (currently 0.1.4); tray owns the
  lifecycle.

## How to engage

- In Summon: @Atlas in board chat, or assign a task.
- Escalation: agent → Sol · Cofounder → the board (Adam).
