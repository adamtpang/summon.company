# Plan: org-wide ingestion, problem extraction, agent assignment

Board prompt, 2026-07-22: point Summon at a company's GitHub org, surface the problems the company already documented, rank them by importance and urgency, and put the right department agent on the best one with a PR as the only write path. This is the core loop ("surface problems, triage, dispatch") productized. Plan first, per the prompt's own Step 0.

## Step 0 findings: what exists vs what must be built

Explored on 2026-07-22. The repo is a tracked Paperclip fork; the inherited scaffolding is real and mostly reusable.

**Already exists (reuse, do not rebuild):**
- Single-repo import: `server/src/routes/company-import-paths.ts` plus the onboarding wizard's GitHub pairing. Builds a company around ONE repo.
- GitHub fetching: `server/src/services/github-fetch.ts` (used for logo/name import).
- Repo working copies: paired repos clone to disk (SUM-129 work); agents run in configured working dirs via adapter config.
- Triage engine: `ui/src/lib/scoreboard.ts` ranks issues S to F by importance and urgency. The extractor's output lands directly in it.
- Dispatch: one-task-per-agent governor doctrine, department routing via `metadata.department`, comment-wake, approvals.
- Guardrail surface: budget caps, kill switch, manual mode, review gates.
- Worktree execution: `enableWorktreeRunExecution` experimental flag exists server-side but is OFF; isolated workspaces (SUM-168) is the missing trust piece.

**Dead or misleading inherited code to be aware of:**
- `ui/src/pages/CloudUpstreamUxLab.tsx`, `BootstrapSetupUxLab.tsx`, `ResponsibleUserDenialUxLab.tsx` are upstream UX labs, not product surfaces.
- The Conference Room flag machinery is upstream; nav item retired, route alive.
- `apps/landing` package.json still says "vitals" (harmless branding leftover).

**Must be built:**
1. GitHub org client: list every repo a token can see (paginated, private included), with name, visibility, language, size, last push, open issues, archived.
2. Workspace selection: explicit multi-select of repos into the company; persist; never clone implicitly.
3. Ingest and index: file tree plus docs-first content (docs/**, *.md, README, ADRs, audit reports, findings registers, remediation plans). Search index over docs and paths.
4. Problem extractor: parse for already-named problems (P0/P1/P2/Sev1/critical/blocker, "gap", "audit", "finding", "remediation", "known issue", "tech debt", "not production ready", TODO/FIXME, GitHub issues). Output ranked problems, each with {title, severity, sourceFile, evidenceQuote, estimatedEffort, businessImpact, confidence}. Never invent; every entry cites file and line; empty result says so.
5. Routing: map each problem to the core-8 department best fit, with the reason shown; human override before anything runs.
6. Execute: run the assigned agent in an isolated git worktree, produce a branch plus PR with diff, plain-English summary, and the evidence trail. Never push default branch. PRs only.

## Guardrails as features (from the prompt, kept verbatim in spirit)

- Never ingest customer, tenant, patient, or production data; refuse and report PII-looking files (Regain's phi-service and pii-service repos make this non-negotiable for the first real customer).
- Read-only by default; the only write path is a PR.
- Token needs read plus PR scope only; never logged or persisted; redact secrets on ingest; respect .gitignore; never touch .env.

## Build order (each step lands separately)

1. `server/src/services/github-org.ts`: pure org client over the GitHub REST API, unit-tested against fixtures. API: `listOrgRepos(handle, token)`.
2. Routes plus UI: org paste screen listing repos with multi-select into the company (extends company-import-paths).
3. `server/src/services/ingest-index.ts`: docs-first tree walk of selected local clones, index persisted per company.
4. `packages/shared/src/problem-extract.ts`: pure extractor functions with fixture-doc unit tests. This is the heart; build and test it before any UI.
5. Routing table: constraint and file-path heuristics to department, reason string included; override UI on the ranked list.
6. Execution: gate behind `enableWorktreeRunExecution` plus SUM-168 isolated workspaces; branch, commit, `gh pr create`, evidence links in the PR body.
7. Ranked problems UI: reuse the scoreboard spectrum; problems become issues on the board with sourceFile evidence in the description.

## First proof

Regain: all 28 regain-inc repos are cloned at `~/OneDrive/Aether/regain/`. Run the extractor over them (code and docs only, refuse anything PII-looking), get a ranked findings list with citations, route the top one, and produce one real PR in a sandbox repo first.
