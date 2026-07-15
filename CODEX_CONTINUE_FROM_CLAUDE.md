# Cross-agent continuation

Read `CLAUDE.md` first. It is the current shared handoff for Claude Code and Codex.

Company Zero completed its first self-dogfood cycle on 2026-07-14: operating context,
design dogfood, critical-path visibility, and the diagnosis loop are done. Runtime
portability is honestly blocked on source/package database migration-lineage
compatibility. The main packaged control plane is at `http://127.0.0.1:3100`; the
isolated brand preview is at `http://127.0.0.1:3102`.

Run `node scripts/vitals-company-zero-status.mjs` before resuming. The CTO and Design
Director are intentionally paused to prevent stale issue-comment wakeups from reopening
terminal work. Do not resume them unless assigning a fresh issue or deliberate canary.

Do not point the source checkout at the live packaged database. Prove migration
compatibility on an isolated clone, with backup and rollback, before any cutover.

The unmerged brand worktree is
`C:\Users\adamp\OneDrive\Aether\.worktrees\vitals-run-brand-system-20260714` on
`codex/vitals-brand-system`. Read its `VITALS_BRAND_STANDARD.md` before design work.

Do not split the landing and engine back into sibling repositories. The landing
lives at `apps/landing/`, and the portable installer remains on the `installer`
branch of `adamtpang/vitals.run`.
