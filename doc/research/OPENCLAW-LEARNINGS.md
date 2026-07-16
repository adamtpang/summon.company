# OpenClaw Learnings for Summon

**Doc:** `doc/research/OPENCLAW-LEARNINGS.md`
**Date:** 2026-07-15
**Sources:** github.com/openclaw org sweep (84 public repos), deep-read of openclaw/openclaw core (README + docs.openclaw.ai), deep-read of clawsweeper, clawhub, crabfleet, lobster, clawrouter READMEs.
**Rule:** We reimplement patterns, we never copy code. clawsweeper is MIT-licensed; the core openclaw repo's license was not confirmed in this pass — verify before borrowing anything more than ideas. Patterns and architecture are not copyrightable; code is.

---

## 1. What OpenClaw is and why it matters to Summon

OpenClaw (github.com/openclaw, ~383k stars on the flagship repo, 84 public repos, active daily as of 2026-07-15) is a local-first, single-user personal AI assistant built around one long-lived Gateway daemon (default `127.0.0.1:18789`) that owns every channel connection (~23 chat channels), embeds the agent runtime, and exposes a typed WebSocket control API. Always-on behavior comes from three concrete mechanisms — periodic heartbeats driven by a `HEARTBEAT.md` checklist with `HEARTBEAT_OK` suppression, a full cron/task system with isolated-session runs and audit records, and authenticated inbound webhooks. Around that core sits an ecosystem that looks suspiciously like a company OS taken apart into repos: a versioned skill registry with supply-chain scanning (clawhub), a mission-control dashboard for agent runs with live terminal takeover (crabfleet), a typed resumable workflow engine with human approval gates and per-run cost limits (lobster), a policy/budget LLM gateway with microdollar reservations (clawrouter), and a production autonomous AI maintainer running 24/7 on their own repos (clawsweeper).

This matters to Summon because OpenClaw has already shipped, at scale, working answers to most of the gaps we track as issues: an always-on runtime that actually executes (not just schedules), risk-rated async approval, mechanical cost control, durable inspectable state, and a verify-before-mutate discipline. Summon's positioning is different — a provider-neutral control plane for AI-agent *companies*, Electron desktop, `claude_local`/`codex_local` adapters on the founder's own subscriptions, board-approval governance — but the engineering patterns transfer almost one-to-one. The single biggest cross-cutting lesson, visible in every OpenClaw repo: **AI plans, deterministic code mutates.** Models never hold write credentials; they emit evidence-backed proposals into durable records, and a dumb executor rechecks live state immediately before applying anything. That one pattern is what makes an autonomous employee safe enough to run 24/7 on real company assets, and it is exactly the trust story a $99/mo AI employee needs.

---

## 2. Architecture learnings mapped to Summon's known gaps

Each learning: what OpenClaw does → evidence → the concrete adoption move in Summon. All adoption moves are clean-room reimplementations in Summon's own stack.

### 2.1 Gap: always-on runtime that schedules but doesn't execute

**What OpenClaw does.** The Gateway is a supervised user service (launchd/systemd, auto-restart) with three wake sources: (a) heartbeats — default every 30m, the agent reads `HEARTBEAT.md` and replies `HEARTBEAT_OK` if nothing needs attention, with OK-acks stripped so humans only see alerts; heartbeats defer while cron work is active (`skipWhenBusy`); (b) cron — `--at` / `--every` / `--cron` schedules that run in a fresh isolated session per run, deliver output to a channel or webhook, and always create auditable task records (`openclaw tasks list/audit`); (c) authenticated webhooks (`POST /hooks/wake`, `POST /hooks/agent`) for event-driven wakes (e.g. Gmail Pub/Sub). Crucially, the scheduler and the executor are the same daemon — a fired schedule *is* an agent turn, not a reminder to have one.

**Evidence:** https://docs.openclaw.ai/gateway/heartbeat, https://docs.openclaw.ai/automation/cron-jobs, https://docs.openclaw.ai/concepts/architecture

**Summon adoption move.** Make Summon's heartbeat loop execute, not enqueue. Each VIT employee gets a `HEARTBEAT.md`-equivalent standing checklist in its workspace; the Electron main process (or a small supervised daemon it spawns) fires the heartbeat, runs a real `claude_local`/`codex_local` turn in an isolated session, suppresses OK results, and surfaces only alerts to the board feed. Every scheduled execution writes a task record row (start, session id, outcome, cost) — this doubles as the seed of event-sourced state. Steal clawsweeper's cadence tiers as the attention-scheduling model: hourly for hot items, daily for items under 30 days old, weekly for older/inactive — attention is budgeted, not uniform.

### 2.2 Gap: risk-rated async approval

**What OpenClaw does.** Lobster workflows have `approval` as a first-class step type with identity enforcement: `required_approver` and `require_different_approver` (the approver must differ from the initiator — built-in four-eyes/separation-of-duties), tracked via initiated-by/approved-by variables. Risky steps *suspend cheaply*: `ctx.requestInput()` persists minimal state and the workflow resumes later from CLI or agent — no process held open waiting for a human. Elsewhere, exec approvals (`tools.exec.ask: 'always'`), pairing codes for unknown DM senders, and plugin-install prompts show approval applied proportional to risk, not uniformly.

**Evidence:** https://github.com/openclaw/lobster (README), https://docs.openclaw.ai/gateway/security

**Summon adoption move.** Reimplement board approval as a durable suspend/resume gate, not a blocking modal. An employee that hits a risk-rated action serializes a tiny approval record (action, evidence, risk tier, initiator, budget impact) into Summon's event log, pings the founder asynchronously, and the run resumes when the approval event lands. Enforce `approver != initiator` structurally: an agent can never approve its own proposal, and a sub-agent can never approve its parent's. Risk tiers map to gates: low = auto with audit record, medium = single founder approval, high = board approval with evidence attached.

### 2.3 Gap: verify-with-evidence gate

**What OpenClaw does.** Clawsweeper's four-lane architecture (detailed in §4) separates proposal from mutation: the review lane is proposal-only and writes evidence-backed markdown records; the apply lane runs every 15 minutes and mutates **only after rechecking live GitHub state** — labels, authorship, snapshot-unchanged — and any drift blocks the mutation. Crabfleet applies the same restraint at the board level: kanban cards store *intent only*, and merge policy stores the decision without enforcing it.

**Evidence:** https://github.com/openclaw/clawsweeper (README), https://github.com/openclaw/crabfleet (README)

**Summon adoption move.** Build Summon's verify gate as a deterministic apply loop, not an LLM judgment call. Employee output = a proposal record with evidence (diff, test output, screenshot, URL) written to durable state. A separate non-AI executor re-reads the live target (repo state, deployed page, Stripe object) immediately before applying, and refuses on any drift from the proposal's snapshot. "Verified" means the executor observed the evidence against live state, never that the model said it was done.

### 2.4 Gap: cost routing / margin control

**What OpenClaw does.** Clawrouter issues each consumer one policy-scoped gateway credential instead of real provider keys. A Policy = allowed providers/models + `monthlyBudgetMicros` + roles; budget enforcement is mechanical: pre-request upper-bound cost **reservation** in microdollars via Durable Object ledgers → post-response settlement → refunds on failure; budgeted calls without versioned pricing **fail closed**. Revocation is instant via generation-number matching despite caching. Providers are YAML manifests (auth schemes, routes, capability maps, billing meters) — new vendors are data, not code. Lobster complements this with a per-run `cost_limit` as a first-class workflow field. Model config in the core is `provider/model` strings with ordered fallbacks and auto-reprobe of the primary.

**Evidence:** https://github.com/openclaw/clawrouter (README), https://github.com/openclaw/lobster (README), https://docs.openclaw.ai/concepts/models

**Summon adoption move.** Even though Summon's v1 adapters run on the founder's own subscriptions (no per-token billing), reimplement the *accounting shape* now: every employee holds a Summon-issued credential bound to a policy (allowed adapters/models, monthly budget, capability scopes), every run carries a `cost_limit`, and every adapter call is metered into a per-employee ledger — subscription usage counted in normalized units today, dollars when API adapters land. This is the layer that makes $99/mo-per-employee COGS enforceable at the gateway instead of hoped-for in prompts, and the YAML-manifest provider model is the cheapest path to genuine provider-neutrality.

### 2.5 Gap: event-sourced state

**What OpenClaw does.** All durable state is inspectable artifacts: clawsweeper keeps per-item markdown records, jobs, results, and a full audit on a dedicated state branch of a separate repo (clawsweeper-state), plus a comprehensive audit comparing live GitHub state against generated records. Crabfleet archives every run as NDJSON event logs + transcripts + summaries in R2 with finalization guarantees, and emits audit events on all admin and session-lifecycle operations. The releases repo is literally "release automation + evidence ledger."

**Evidence:** https://github.com/openclaw/clawsweeper-state, https://github.com/openclaw/crabfleet (README), https://github.com/openclaw/releases

**Summon adoption move.** Make the append-only event log the source of truth for the VIT company: every proposal, approval, apply, heartbeat, and cost settlement is an event; company dashboards and board views are projections. Add a periodic reconciliation job (clawsweeper's audit pattern) that diffs projected state against live external state (GitHub, Stripe, deployed sites) and flags drift as an alert — this is what makes the event log trustworthy rather than decorative.

### 2.6 Gap: compressed institutional memory

**What OpenClaw does.** Memory is plain files: `MEMORY.md` loaded at session start, dated daily notes auto-loaded, and the explicit stance "the model only remembers what gets saved to disk; there is no hidden state." The key mechanism is the **pre-compaction memory flush**: before history compaction, a silent turn reminds the agent to persist important context to memory files. Retrieval is hybrid vector + keyword search over those files. Ingestion is a family of local-first crawlers (notcrawl, gitcrawl, clawdex, graincrawl) that archive external systems into SQLite/markdown the agent can search.

**Evidence:** https://docs.openclaw.ai/concepts/memory

**Summon adoption move.** Give each employee and the company a plain-file memory hierarchy (`COMPANY.md`, per-employee `MEMORY.md`, dated run notes) and reimplement the pre-compaction flush hook in the `claude_local`/`codex_local` adapters: before any context compaction, force a persist-to-memory turn. Institutional memory that survives session resets is a file-write discipline, not a vector-DB purchase. Hybrid search can come later; the flush hook is the high-leverage piece.

### 2.7 Gap: sub-agent delegation

**What OpenClaw does.** Multi-agent is isolation-first: each agent in `agents.list[]` gets its own workspace (persona files `AGENTS.md`/`SOUL.md`/`USER.md`), its own SQLite session store and auth profiles, with an explicit warning never to share `agentDir` across agents. Routing is deterministic tier-precedence binding of (channel, account, peer) → agent. Delegation guardrails: `sessions_spawn` can require sandboxing (`sandbox: 'require'`), and the secure baseline denies `sessions_spawn`/`sessions_send` by default. Caclawphony ("Symphony") turns project work into isolated autonomous implementation runs; clawsweeper derives all lane concurrency from one capacity knob (`workers.max`) with priority preemption — interactive work preempts background lanes, which shrink automatically.

**Evidence:** https://docs.openclaw.ai/concepts/multi-agent, https://github.com/openclaw/clawsweeper (README), https://github.com/openclaw/caclawphony

**Summon adoption move.** Sub-agents in Summon are isolated child runs, never shared-context threads: own workspace dir, own session store, a scoped-down policy credential (subset of the parent's budget and capabilities), and results returned as proposal records into the parent's queue — the parent (or the board gate) applies, the child never does. Adopt the single capacity knob: one `workers.max` per company from which all concurrency derives, with founder-initiated work preempting background heartbeat work.

### 2.8 Bonus learnings (no open issue, worth recording)

- **Skill supply chain (clawhub):** skills declare env/binary/permission needs in frontmatter; the registry scans declared-vs-actual behavior; customers can **pin** installed versions so production employees are frozen until explicitly upgraded. When Summon ships an employee-skill marketplace, this is the contract. (https://github.com/openclaw/clawhub)
- **Live takeover (crabfleet):** every run is a kanban card with heartbeats, diff preview, archived transcript, and a Human Review lane — and the operator can Watch, Attach, or Take Over the live session. Takeover is the affordance that makes buyers trust autonomy. A per-customer `CRABBOX.md`-style config declaring the autonomy level (open-PR vs merge-when-green) is the right shape for Summon's per-employee autonomy setting. (https://github.com/openclaw/crabfleet)
- **Typed workflow macros (lobster):** recurring SOPs as typed YAML pipelines invoked as *one* tool call ("composable macros… to save tokens") instead of re-planned every run — directly applicable to VIT's recurring ops. (https://github.com/openclaw/lobster)
- **Fail-closed auth posture:** the Gateway refuses connections with no auth path configured; session keys are routing selectors, not authorization. Summon's local WS/IPC surface should inherit both stances. (https://docs.openclaw.ai/gateway/security)

---

## 3. What NOT to adopt (Summon is a company OS, not a personal assistant)

- **Single-user, single-tenant core.** OpenClaw is explicitly single-user; multi-tenant claims are out of scope by design, and the "one Gateway per host, one brain for all channels" invariant follows from that. Summon's unit is the *company* with multiple employees, customers, and eventually tenants — copying the one-brain topology would bake in the wrong ceiling. Adopt the patterns per-employee, not the topology.
- **The ~23-channel personal inbox.** WhatsApp/iMessage/Signal/Telegram connectors are the personal-Jarvis surface. A company OS needs a small number of business channels (board UI, email, maybe Slack) done with audit trails — not channel breadth. Skip the connector zoo entirely.
- **Persona cosplay files (`SOUL.md`, `DREAMS.md`).** Personality scaffolding for a companion assistant. Summon employees need role charters, SOPs, and KPIs — keep `AGENTS.md`-style role definition, drop the soul.
- **DM pairing codes as the primary access model.** Pairing unknown chat senders is the right gate for a personal bot exposed to the world's messengers. Summon's access model is account/role-based governance on a desktop control plane; reimplementing pairing would solve a problem Summon doesn't have.
- **Local personal-data crawlers (photoscrawl, imsgcrawl, casa/HomeKit, spogo, etc.).** Personal-life ingestion. A company OS ingesting a founder's photos and home devices is a liability, not a feature.
- **Desktop/computer-use suite (Peekaboo, AXorcist) as core.** macOS screenshot/accessibility control is assistant-flavored. Summon employees act through typed adapters and APIs with evidence records; unaudited GUI puppeteering undercuts the verify-with-evidence gate. (Windows-node exists, but same reasoning.)
- **Markdown-config sprawl as the governance layer.** `HEARTBEAT.md`-style files are great for *checklists*; they are not a substitute for typed, versioned policy. Summon's board governance, budgets, and risk tiers should live in schema-validated config with an event trail — files an LLM freely edits must never be the security boundary.
- **The one-daemon-owns-everything process model on Electron.** OpenClaw fuses gateway + runtime + channels into one process. In Summon's Electron app, keep the control plane (main process/UI) separate from employee runtimes (child processes with scoped credentials) — that separation is what makes the propose/apply split and instant revocation enforceable.

---

## 4. Clawsweeper: the production AI employee, dissected

**What it is.** https://github.com/openclaw/clawsweeper (TypeScript, ~1.9k stars, MIT license, active 2026-07-15) — "Conservative GitHub Maintenance Automation." An autonomous AI maintainer bot that runs in production on openclaw/openclaw (~383k stars), clawhub, and itself. It reviews all open issues and PRs on schedule and on events, writes durable evidence-backed markdown reports per item, proposes safe closures, syncs exactly one marker-backed public status comment per item (edited in place, never duplicated), runs bounded autofix/automerge loops on PRs, generates implementation PRs from viable bug reports, and reviews main-branch commits. Maintainers steer it entirely in-context via issue comments: `@clawsweeper status/review/autofix/automerge/implement/fix ci/approve/stop`. State lives on a branch of a separate repo (clawsweeper-state) with a public dashboard and a full audit comparing live GitHub state against its own records.

**Why it matters:** clawsweeper is the closest existing thing to what Summon sells — an autonomous AI employee doing real, continuous work on real company assets, trusted enough that a 383k-star project lets it act. Every design choice is a trust mechanism:

1. **Four lanes, four trust levels.** Review lane: proposal-only, never mutates. Apply lane: runs every 15 min, mutates only after rechecking live state (labels, authorship, snapshot unchanged) — drift blocks the mutation. Repair lane: maintainer-command-driven bounded fix loops. Commit-review lane: strictly read-only. → Summon: every employee capability gets an explicit lane with an explicit trust level; "do work" and "change the world" are never the same code path.
2. **Token flow as the security model.** AI workers get **no** write tokens; review checkouts are read-only; write credentials are created only *after* the AI process exits; deterministic executors perform every mutation. → Summon: `claude_local`/`codex_local` processes run with read-only or sandboxed access; the Summon executor holds the write credentials and applies verified proposals.
3. **One capacity knob with priority preemption.** All lane limits derive from a single `workers.max`; command-driven work preempts background review, background lanes shrink automatically. → Summon: one per-company concurrency budget, founder requests preempt heartbeat work.
4. **Durable, auditable, public-by-default state.** Per-item markdown records with decisions and evidence, jobs/results on a state branch, plus a reconciliation audit against live GitHub. → Summon: the employee's work journal *is* the product surface the customer reads; the reconciliation audit is the anti-hallucination guarantee.
5. **Steering inside the artifact.** No separate ticketing system — humans command the bot with @-mentions where the work lives, and status is one in-place-edited comment (no notification spam). → Summon: board members steer employees from the work item itself, and each work item shows exactly one living status, not a comment trail.
6. **Human-authored items are protected.** Maintainer-authored issues/PRs get guarded treatment regardless of config. → Summon: founder-created artifacts get a structural protection tier employees cannot override.

**Caveat:** clawsweeper's README describes Codex (OpenAI) workers specifically; the lane architecture is worker-agnostic but its portability to Claude-based workers is our design work, not documented fact. It is MIT-licensed — patterns are free to reimplement; still do not copy code into Summon's proprietary tree.

---

## Appendix: gaps in this research

- READMEs and docs only; no source code was read. Implementation details (clawsweeper's prompts, clawrouter's ledger schema, lobster's suspend-state format) are unverified beyond README claims.
- The core openclaw repo's license was not captured — check before any deeper borrowing.
- Unread but shortlisted for follow-up: crabbox (pre-warmed sandbox, "warm a box, sync the diff, run the suite"), caclawphony/crabhelm (multi-agent orchestration), fs-safe/turnwire/clawscan/krillswitch (sandboxing/security), openclaw-windows-node (relevant to our Windows environment).
- Star counts are GitHub's rounded display values captured 2026-07-15; some doc quotes passed through a summarizing fetch — spot-check load-bearing config keys against live docs before citing externally.
