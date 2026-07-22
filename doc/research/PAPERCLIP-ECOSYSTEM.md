# The Paperclip ecosystem, aggregated — keep / wrap / skip

> **Issue:** SUM-140 · **Author:** Atlas (COO) · **Date:** 2026-07-19
> **Board WHY (2026-07-18):** "we can have company templates from companies.sh… learn
> from all the paperclip ecosystem tooling… aggregate it all into Summon to make company
> building super super simple and easy and seamless for founders."
> **The rule:** *aggregate, don't rebuild.* Summon is the **opinionated distro** over this
> ecosystem, not a re-implementation of it.

---

## TL;DR — the finding that changes the plan

**~80% of "aggregate the ecosystem" is already inside our fork.** The import engine, the
template/catalog format, the install API, and a catalog browser UI all exist and ship
today. The gap is **not machinery — it's curation and one placement.**

Three things remain, and only three:

1. **Curation gap.** The catalog holds 4 *generic* teams (exec / design / eng / content).
   The board wants 4 *opinionated founder* templates — agency-in-a-box, newsletter co,
   SaaS starter, community/events org (the Michael case). These are content, not code.
2. **Placement gap.** The catalog browser (`TeamCatalog.tsx`) lives *outside* onboarding.
   The board wants a **skippable "Start from a template" step** inside the wizard.
3. **Distribution gap.** Nothing Summon-authored is published back to an external hub yet.

Everything below is the evidence for that finding: every ecosystem piece with a
**KEEP / WRAP / SKIP** verdict and the in-fork file that already does the job.

---

## The leverage table

Verdict legend — **KEEP**: already in-fork, use as-is. **WRAP**: in-fork but needs a
thin Summon layer (opinion, placement, or branding). **SKIP**: don't rebuild / not our
job / external.

| # | Upstream ecosystem piece | What it does | In-fork equivalent | Verdict | Why |
|---|---|---|---|---|---|
| 1 | **Company portability** (upstream v2026.325.0) | Export/import a whole company with secret scrubbing | `server/src/services/company-portability.ts` (5,141 LOC): `exportBundle` / `previewImport` / `importBundle` / `previewExport`. Types in `packages/shared/src/{types,validators}/company-portability.ts` | **KEEP** | The engine is already merged into our fork (upstream PR `pap-795-company-portability`). This is the foundation everything else stands on. Do not touch. |
| 2 | **companies.sh** (template hub, ~16 templates) | Public directory of downloadable company templates | `packages/teams-catalog/` — manifest (`generated/catalog.json`) + `catalog/` tree of teams as `agentcompanies/v1` markdown; served by `server/src/services/teams-catalog.ts` (1,036 LOC) | **WRAP** | The *format and hub mechanism* exist. What's thin is the *content*: only 4 teams vs. companies.sh's 16, and none are Summon-opinionated. Curate ours; don't rebuild the hub. |
| 3 | **Clipmart** (one-click download-and-run a company) | Install an entire org — structure + agents + skills — in one click | Catalog **install API**: `POST /companies/:companyId/teams/catalog/:catalogId/install` + `/preview` (`server/src/routes/teams-catalog.ts`); UI in `ui/src/pages/TeamCatalog.tsx` + `ui/src/api/teamCatalog.ts` | **KEEP** | One-click install already works end-to-end (list → preview → install → agents/projects/tasks materialized). This *is* Clipmart, in-fork. |
| 4 | **ClipHub** (public company registry) | "You can literally download a company" — publish/browse/search company exports | Spec at `doc/CLIPHUB.md`; export path via portability (#1); cloud directory hook in `server/src/services/cloud-upstreams.ts` | **WRAP** | Registry is spec'd and the export half is built. The *publish-back* (distribution) is the one genuinely-missing capability — see Remaining Move 3. |
| 5 | **paperclipai plugin system** (instance-wide plugins, out-of-process workers, tool exposure, UI contributions) | Extend the platform additively without forking core | `packages/plugins/`: `sdk`, `create-paperclip-plugin`, `examples`, `plugin-workspace-diff`, `plugin-llm-wiki`, `sandbox-providers`, `paperclip-plugin-fake-sandbox` | **KEEP** | Full plugin SDK is present. Aligns with our own doctrine (memory: *ship additively via plugins*). We don't need a plugin to deliver SUM-140 — the catalog path is more direct — but keep the SDK for future additive features. |
| 6 | **company-wizard plugin** (yesterday-ai/paperclip-plugin-company-wizard) | Community plugin: bootstrap a company from modular templates | `ui/src/components/OnboardingWizard.tsx` (3-step, board ruling VIT-128 2026-07-17) + teams-catalog (#2, #3) | **WRAP** | We already own a first-party wizard **and** a catalog. The community plugin's whole value — "bootstrap from modular templates" — is delivered by wiring #3 into the wizard as a skippable step. Don't adopt the external plugin; wrap our own pieces. See Remaining Move 1. |
| 7 | **PaperclipCloud /companies** directory | Reusable companies directory in the hosted product | `cloud-upstreams.ts` + ClipHub spec (#4) | **SKIP** (for SUM-140) | Hosted-cloud surface. Out of scope for the local/desktop founder flow this issue targets. Revisit when the publish-back path (Move 3) needs a home. |
| 8 | **skills catalog** (agent skills as installable units) | Vendored + external skills a team can require | `packages/skills-catalog/` (`generated/catalog.json`); required-skill resolution baked into teams-catalog install (`requiredSkills` on each team) | **KEEP** | Teams already declare `requiredSkills`; install resolves them. Our opinionated templates get their skills for free by referencing catalog skill refs. |

---

## What's actually in the catalog today (the curation gap, measured)

`packages/teams-catalog/generated/catalog.json` — `@paperclipai/teams-catalog@0.1.0`, **4 teams**:

| slug | kind | category | recommendedForCompanyTypes | Assessment |
|---|---|---|---|---|
| `core-exec-team` | bundled | company-defaults | startup, software, generalist | The **core-8 seed** (CEO/CTO/QA + first project + CEO heartbeat routine). Keep as the base every Summon template composes on top of. |
| `product-design` | bundled | product | — | Generic pod. Useful as an *include*, not a founder-facing template. |
| `product-engineering` | bundled | software-development | — | Generic pod. Same. |
| `content-machine` | optional | content | agency, marketing | Closest to a founder template (lead + recurring review + local skill). A good **pattern reference** for authoring the newsletter/agency templates. |

**Verdict:** these are *building blocks*, not *founder outcomes*. None is the "agency-in-a-box,
live in <2 min" the board asked for. The move is to author 4 opinionated templates that
**compose `core-exec-team` + a domain pod + a roadmap + operating doctrine**, using the
`content-machine` `team.md` as the structural template.

### Template format (grounded, for the authoring issue)

Each team is a directory under `catalog/{kind}/{category}/{slug}/` with a `team.md`
frontmatter entrypoint (`schema: agentcompanies/v1`). Real example — `content-machine`:

```yaml
---
name: Content Machine
description: Optional content operations team…
schema: agentcompanies/v1
slug: content-machine
category: content
key: paperclipai/optional/content/content-machine
manager: agents/content-lead/AGENTS.md
includes:
  - skills/content-calendar/SKILL.md
  - projects/content-operations/PROJECT.md
defaultInstall: false
recommendedForCompanyTypes: [agency, marketing]
tags: [content, marketing, routines]
---
```

Sub-tree layout: `agents/<slug>/AGENTS.md`, `projects/<slug>/PROJECT.md`,
`projects/.../tasks/<slug>/…`, optional `skills/<slug>/SKILL.md`. The manifest is
regenerated with `pnpm --filter @paperclipai/teams-catalog build:manifest`.

---

## The three remaining moves (→ child issues)

The audit's whole point: don't spread effort across 8 ecosystem pieces. Spend it on the 3
gaps. Each becomes an Engineering child issue.

### Move 1 — Wire the catalog into onboarding as a **skippable** "Start from a template" step
- **What:** Add a template-picker step to `OnboardingWizard.tsx` that calls the existing
  `GET /teams/catalog` → `…/preview` → `…/install`. Reuse `TeamCatalog.tsx` /
  `teamCatalog.ts` — do not build a new install path.
- **Board constraint (must honor):** VIT-128 (2026-07-17) deliberately cut the wizard to
  **3 steps, "nothing gates the company."** The template step **must be optional and
  non-gating** — a "Start from a template / Skip" fork, never a required stop. The issue
  itself says "skippable," so this is consistent — but the design must prove it doesn't
  reintroduce a gate. Owner: Engineering.

### Move 2 — Curate 4 opinionated launch templates
- **What:** Author `agency-in-a-box`, `newsletter-co`, `saas-starter`,
  `community-events-org` under `packages/teams-catalog/catalog/`, each composing
  `core-exec-team` + a domain pod + a seeded roadmap + Summon operating doctrine, with
  `recommendedForCompanyTypes` set so Move 1 can recommend them. Regenerate the manifest.
- **Distribution rule:** every template's `description`/README credits **summon.company**.
  Owner: Engineering (content), with COO review for the "opinion" (core-8 + roadmap +
  doctrine).

### Move 3 — Publish one Summon template back to the ecosystem hub
- **What:** Export one curated template via portability (#1) and list it on an external
  hub (ClipHub / companies.sh). **This is the only genuinely-missing capability** — the
  *publish-back* path, as opposed to import. Depends on the hub existing as a live
  external endpoint (today `doc/CLIPHUB.md` is a spec, not a running service).
- **Blocker to name up front:** if no live external hub exists, Move 3 is
  distribution-blocked and needs a board decision on where "the ecosystem hub" actually
  is. Owner: Engineering + board (venue decision).

---

## Acceptance mapping

| Acceptance criterion | Path to green |
|---|---|
| Founder goes template → live opinionated company in **<2 min** | Move 1 (wizard step) + Move 2 (real templates). Engine latency is already fine — install is one API call. |
| **One** Summon-authored template on the ecosystem hubs | Move 3 (publish-back), pending the venue decision. |

---

## Bottom line

The board was right: **aggregate, don't rebuild.** The ecosystem's hard parts — the
import engine, the template format, one-click install, the catalog UI, the plugin SDK —
are already in our fork (verdicts: 5× KEEP, 3× WRAP, 1× SKIP). Summon's differentiated
work is **curation and placement**: 4 opinionated templates, one skippable wizard step,
one publish-back. That is a days-of-content effort, not a months-of-platform effort.
