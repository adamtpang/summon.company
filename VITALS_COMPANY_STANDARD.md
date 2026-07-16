# vitals.run company standard

The standard every company created, imported, or improved by vitals.run must pass.
vitals.run is Company Zero and must pass it first.

## North star

Become the world's most valuable company by creating the most verified usefulness.
Market capitalization is the lagging scoreboard, not a daily control variable.

Vitals compounds two axes:

1. Value created per company: time saved, money saved, revenue grown, and risk reduced.
2. Reach: the number of companies and people measurably improved.

No task is complete because an agent produced text. It is complete when evidence shows
that a company outcome changed.

## First-principles operating doctrine

- **NVIDIA:** build a full-stack system around the binding compute constraint. For
  Vitals, the product is the diagnosis, assignment, execution, and verification loop,
  not a collection of disconnected agents.
- **Apple:** function and end-to-end experience are inseparable. Experts own their
  domains, debate details, remove complexity, and make the useful path feel obvious.
- **Elon:** reason from physical and economic truth, delete before optimizing,
  parallelize independent work, attack the bottleneck, and treat the factory as a
  product. Vitals is the company factory.

## Opinionated organization

The CEO allocates the company constraint and owns strategy. The human is the board.
There are exactly eight operating departments:

| Department | Owns |
| --- | --- |
| Engineering | Product execution, software, infrastructure, integrations, reliability |
| Design | Identity, product experience, marketing site, visual and interaction quality |
| Marketing | Positioning, content, acquisition, referrals, demand generation |
| Sales | Prospecting, qualification, pipeline, proposals, closing |
| Finance | Pricing, billing, bookkeeping, budgets, cash, runway |
| Operations | Company setup, standards, workspaces, process, operating cadence |
| Support | Onboarding, service, community, feedback, retention |
| Legal | Incorporation, contracts, privacy, compliance, risk |

Product is not a ninth department. The CEO owns product strategy; Engineering owns
product execution. Design, Marketing, Sales, Support, Finance, Operations, and Legal
provide requirements and evidence through their existing ownership.

## One-constraint rule

Vitals may surface many problems, but the board view highlights exactly one binding
constraint. Each S-tier problem has one Directly Responsible Agent. The owner returns:

- `SOLVED`: acceptance criteria and evidence are attached.
- `BLOCKED`: the exact missing input or board decision is named.
- `STOPPED`: a budget, security, legal, or safety boundary fired.

Status chatter is not a result. Failed agents do not silently transfer ownership to a
manager; recovery must restore the named owner or explicitly record a board reassignment.

## Autonomous CEO loop

The CEO operates continuously, but it does not continuously manufacture work. Event
triggers are the fast path; a 30-minute heartbeat is the safety net. Company and agent
budgets, one concurrent CEO run, and the one-constraint rule remain hard limits.

1. **Sense:** read live goals, issues, comments, work products, budgets, approvals,
   customer evidence, operating context, and source freshness.
2. **Triage:** rank candidate problems by expected impact, urgency, confidence,
   reversibility, effort, and risk. Reject work that is not S-tier.
3. **Select:** maintain exactly one company-level binding constraint. Do not create a
   duplicate when the evidence and constraint have not changed.
4. **Dispatch:** assign one Directly Responsible Agent from the owning department with
   acceptance criteria, baseline, budget, dependencies, and the next wake condition.
5. **Coordinate:** use issue comments, mentions, linked child issues, and work products
   as the employee-to-employee bus. Reports contain new evidence, a precise blocker, or
   solved proof; they are not heartbeat chatter.
6. **Verify:** require an inspectable artifact and a before/after change in time saved,
   money saved, revenue grown, companies improved, or risk reduced.
7. **Correct:** on failure, update the diagnosis or execution method without hiding the
   error. On success, close the loop and immediately rerun the scan.

The CEO owns this loop. The Company Diagnostician supplies evidence and ranking; the
department owner executes; the human board retains high-risk decisions.

An adapter quota or authentication failure trips the CEO into visible `error` state and
prevents blind recurring retries. After verifying a provider is available, switch and
resume with one canary run:

```bash
node scripts/vitals-ceo-runtime.mjs status
node scripts/vitals-ceo-runtime.mjs claude
node scripts/vitals-ceo-runtime.mjs codex --force
node scripts/vitals-ceo-runtime.mjs stop
```

The Claude lane requires `claude /login`. The Codex lane must not be forced before its
recorded usage window resets. The bootstrap preserves a deliberately selected non-Codex
CEO adapter instead of silently reverting it.

## Trusted company context

Connectors expand sensing, not authority. Every snapshot records source, scope, owner,
freshness, and read/write policy. Secrets and raw sensitive records stay in connector or
secret storage, never in issue descriptions, comments, artifacts, prompts, or git.

| Source | Company Zero purpose | Default authority | Current gate |
| --- | --- | --- | --- |
| Notion | Company knowledge, including the Quantus operating system | Read-only, user-authorized OAuth | Confirm the connected workspace can actually find Quantus before ingestion. |
| Obsidian | Adam's life context, goals, commitments, and decisions | Read-only snapshots from `C:\Users\adamp\ObsidianVault` | Scope folders explicitly; do not edit the vault without a separate approved task. |
| Stripe | Professional revenue, charges, subscriptions, and cash timing | Read-only OAuth with least privilege | Finance may aggregate metrics; payments, refunds, and account changes are board-gated. |
| Chase | Personal and professional cash, expenses, debt, and liquidity | Read-only OAuth through Plaid or another board-approved provider | Never scrape `chase.com`, request bank credentials, or mix personal and company ledgers. |

Finance keeps personal and company ledgers logically separate, then exposes only the
board-approved control variables: monthly earn rate, monthly burn rate, net cash flow,
liquid savings, and runway. `runway months = liquid savings / max(burn - earn, 0)`; when
earn is at least burn, report positive cash flow instead of an artificial infinite
runway. Every metric includes an as-of timestamp and an explicit missing-data state.

## Company checklist

1. **Outcome:** one company north star and one measurable near-term proof milestone.
2. **Evidence:** current revenue, cost, time, product, customer, and risk baselines.
3. **Workspace:** one primary repository or operating workspace with a verified path.
4. **Organization:** CEO plus explicit ownership across all eight departments.
5. **Skills:** each active employee has only the relevant company skills and a portable
   instruction bundle.
6. **Runtime:** at least one tested execution adapter, a strong default model, and a
   faster low-reasoning lane for bounded tasks.
7. **Governance:** company and agent budgets, one-concurrent-run default, board approval
   for hires and high-risk external actions.
8. **Critical path:** real goals, projects, issues, dependencies, owners, and evidence
   produce one current constraint.
9. **Execution:** one owner checks out one problem and works until solved or precisely
   blocked.
10. **Verification:** compare before and after, record impact, rerun diagnosis, repeat.

## Company Zero ownership map

Current vitals.run ownership is configured around one CEO and eight operating
departments. Dedicated hires are not required for every department before the
standard is useful; unstaffed functions have explicit interim owners and board gates.

| Function | Current owner | Operating rule |
| --- | --- | --- |
| CEO | Vitals CEO | Owns strategy, product direction, prioritization, and constraint allocation; reports to the human board. |
| Engineering | Vitals CTO and Vitals Engineer | Engineering owns Product execution, runtime, infrastructure, reliability, and additive Vitals product implementation. |
| Design | Vitals Design Director | Owns identity, product experience, marketing site quality, accessibility, and visual verification. |
| Marketing | Vitals CMO | Owns positioning, content, demand generation, referrals, and public proof; board approves publication and outbound claims. |
| Sales | Vitals CMO, interim | Owns prospecting and pipeline until a dedicated Sales agent is approved; outbound messages require board approval. |
| Finance | Vitals CFO | Owns budgets, pricing, billing readiness, cash discipline, and runway. |
| Operations | Vitals COO | Owns company setup, workspaces, standards, process, cadence, import readiness, and evidence rules. |
| Support | Vitals COO, interim | Owns onboarding and support workflow until a dedicated Support agent is approved; customer data access requires board approval. |
| Legal | Human board, with Vitals COO drafts | Contracts, incorporation, compliance, privacy, and banking remain board-gated. Agents may prepare drafts but cannot approve legal actions. |

## Company Zero S-tier queue

| Rank | Problem and why | Owner | Solution | First baby steps |
| --- | --- | --- | --- | --- |
| S0 | Runtime portability. Adapter probes passed while real Windows runs failed on Codex auth symlinks. | Vitals CTO | Separate portable company identity from adapter auth and make Windows execution real. | Run one canary; repair auth sharing; complete one repository task; test a provider switch. |
| S1 | Operating context. Agents cannot improve a company without a shared goal, workspace, ownership, budget, skills, and evidence rules. | Vitals COO | Configure and export vitals.run as Company Zero using this standard. | Verify goal; project; workspace; org; budgets; approvals; skill catalog; export. |
| S2 | Design dogfood. The engine is useful but the product and landing experience are not yet one coherent, exceptional system. | Vitals Design Director | Finish the design system, apply it to the product and landing page, then verify real workflows. | Continue the existing brand worktree; verify function; implement tokens; test desktop, mobile, accessibility, empty, loading, and error states. |
| S3 | Critical-path visibility. A board cannot allocate effort if stages are decorative or disconnected from real work. | Vitals Product Engineer | Build the eight-stage Roadmap from goals, projects, issues, owners, dependencies, and evidence. | Map live data; compute completeness; highlight one unblocked constraint; verify Company Zero. |
| S4 | Diagnosis-to-impact loop. Reports without dispatch and before-and-after proof do not improve a company. | Vitals Company Diagnostician | Scan eight departments and stages, rank one cause, dispatch one owner, verify impact, and repeat. | Collect baseline; explain causes; rank constraint; assign; measure; rerun. |

## Company Zero live state: 2026-07-14

The first self-dogfood cycle is complete enough to operate, but not complete enough to
claim runtime portability is solved.

| Rank | Status | Evidence / next action |
| --- | --- | --- |
| S0 Runtime portability | `BLOCKED` | Adapter, auth, model-profile, skill-copy, and focused tests pass. The fork source migration lineage does not safely open the live packaged database. Prove a version-compatible build on an isolated database clone before cutover. |
| S1 Operating context | `SOLVED` | Company Zero has a goal, project, two workspaces, eight managed employees, budgets, approvals, scoped skills, and repeatable bootstrap/status scripts. |
| S2 Design dogfood | `SOLVED` | The brand source of truth, landing, Design surface, Formation treatment, desktop/mobile screenshots, targeted tests, typecheck, and build live in the board-approved brand worktree. Merge and deployment remain board-gated. |
| S3 Critical path | `SOLVED` | `/roadmap` and `/:companyPrefix/roadmap` compute eight real stages and highlight exactly one current constraint. |
| S4 Diagnosis loop | `SOLVED` | The Diagnostician captured a baseline, ranked runtime first, dispatched the owner, verified the result, then dispatched Design as the next constraint. |

The CTO and Design Director are temporarily `paused`. The packaged runtime can process
queued issue-comment wakeups after a restart and reopen terminal issues. Resume an owner
only when assigning fresh work or deliberately running a canary. All other Company Zero
employees remain available.

## Runtime-neutral contract

Vitals is the control plane. Claude, Codex, Cognition, Cursor, OpenClaw, and future
runtimes are execution adapters.

Portable company state:

- goals, projects, issues, dependencies, assignments, budgets, approvals, and evidence
- provider-neutral `AGENTS.md` instruction bundles
- `SKILL.md` company skills from a shared skill root
- department, role, capability, and outcome metadata
- workspace and source-control references

Adapter-specific state:

- executable command and transport
- authentication and local state directory
- model identifier and reasoning level
- sandbox, permission, timeout, and concurrency settings

No company rule may depend on Claude- or Codex-only behavior. Switching an adapter must
preserve the employee's identity, skills, issue, acceptance criteria, and work evidence.

## Control-plane recovery rules

1. No agent may restart, replace, or migrate the main control plane while any company run
   is active. That is a board operation.
2. Never point a source checkout at a packaged production database until migration lineage
   compatibility is proven on an isolated clone.
3. A passing source test is not a live cutover. Record the exact package version, database
   lineage, backup, canary, and rollback command.
4. On Windows, Paperclip-owned skill links must fall back to fingerprinted materialized
   copies when symlinks fail. Preserve user-owned skill directories.
5. Treat comments on terminal issues as executable events. Pause the owner before adding a
   passive board note if the current runtime could interpret it as a wake request.
6. After recovery, verify health, the five S-tier statuses, and zero active runs before
   resuming employees.

## Model policy

- Use `gpt-5.5` with high reasoning for ambiguous, high-leverage work.
- Use `gpt-5.5` with low reasoning as the current fast lane for bounded work.
- Add free OpenRouter models only after a real task test proves capability, latency,
  context handling, and output quality. Free does not count as cheap if supervision or
  rework costs more time.
- A model list or hello probe is not support. A real issue must complete through the
  adapter before the model is marked usable.

## Board gates

Explicit board approval is required for new hires, spending beyond caps, incorporation,
banking, contracts, production deployment, customer data access, destructive changes,
public claims, and outbound messages. Internal reversible research and scoped workspace
edits may proceed within the assigned issue and budget.

## Company Zero commands

```bash
node scripts/vitals-company-zero-bootstrap.mjs
node scripts/vitals-company-zero-bootstrap.mjs --wake=VIT-14
node scripts/vitals-company-zero-status.mjs
```

The bootstrap is repeatable. A `--wake=<identifier>` run intentionally reopens only that
S-tier issue as a canary; an ordinary rerun should synchronize configuration without
waking completed or active work.

Local operating surfaces:

- Main Company Zero control plane: `http://127.0.0.1:3100`
- Isolated brand preview: `http://127.0.0.1:3102`
- Custom light UI on live Company Zero: `http://127.0.0.1:3110`

The live UI proxy keeps the packaged `3100` API and database authoritative while serving
the additive Vitals interface from the isolated `3102` design runtime. It is the safe
operator surface until source and packaged migration lineages are proven compatible:

```bash
node scripts/vitals-live-ui-proxy.mjs --daemon
```

## Primary references

- CompaniesMarketCap ranking: https://companiesmarketcap.com/USD/
- NVIDIA fiscal 2026 results: https://investor.nvidia.com/news/press-release-details/2026/NVIDIA-Announces-Financial-Results-for-Fourth-Quarter-and-Fiscal-2026/
- NVIDIA DSX AI factory playbook: https://investor.nvidia.com/news/press-release-details/2026/NVIDIA-DSX-Gives-Infrastructure-Builders-the-Playbook-for-AI-Factories/default.aspx
- Apple at 50: https://www.apple.com/newsroom/2026/03/apple-to-celebrate-50-years-of-thinking-different/
- Apple design: https://www.apple.com/newsroom/2016/11/designed-by-apple-in-california-chronicles-20-years-of-apple-design/
- Apple organization for innovation: https://www.apple.com/careers/pdf/HBR_How_Apple_Is_Organized_For_Innovation-4.pdf
