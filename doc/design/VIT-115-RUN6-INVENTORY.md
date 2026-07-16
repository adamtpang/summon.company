# VIT-115 Run 6 — Via-Negativa Frontend Inventory & Sentencing

**Binding spec:** `doc/research/BEST-DASHBOARDS.md` (board-landed 2026-07-16) — three surfaces
(**Dashboard / Chat / Decisions**) + Settings, simplicity gates G1–G12, and the §3 "What got
DELETED" table. This doc is step 1+2 of VIT-115: a mechanical inventory of every route, page,
nav item, dialog, and panel in `ui/src`, each sentenced **KEEP / DEMOTE / DELETE**.

**Sentence key**
- **KEEP** — lives on a top surface; passes the daily-action test (G1).
- **DEMOTE** — exactly one hop deep: command-palette entry, level-2 drill, or settings-only.
  Legitimate only under the <100ms hop budget (G11). No sidebar/nav row.
- **DELETE** — route and code removed. Git is the archive.

**Guardrails honored:** no protocol/API/DB changes (golden rule); anything an ACTIVE workflow
depends on is DEMOTED, not deleted, until VIT-111's collapse lands; upstream-owned
(`paperclipai/paperclip`) code deletions are flagged for fork-divergence cost.

**Method note:** inventory data gathered by mechanical sweep of `App.tsx` routes, `Sidebar.tsx` /
`Layout.tsx` chrome, `CommandPalette.tsx`, and a grep of all Modal/Dialog/Sheet mounts.
Two findings that correct the research doc's assumptions about the current app:
1. There is **no drag-and-drop pane dashboard** in `ui/src` — Dashboard uses plain CSS grids.
   (The spec's "8 pane types, configurable" row targets the Electron desktop shell, out of this
   run's scope.)
2. Four `*UxLab.tsx` pages are **already orphaned** (no `<Route>` mounts them) — instant deletes.

---

## 1. Target end-state

The app boots into **three tabs + settings**:

| Surface | Route | What absorbs into it |
|---|---|---|
| **Dashboard** (Mission Control) | `/dashboard` | Rebuilt to the five-zone spec (§3 of BEST-DASHBOARDS.md): Zone A vitals strip (EKG + market cap + MRR + runway heroes, pressure bars), Zone B formation (8 dept cards, live mode per VIT-112), Zone C roadmap bars, Zone D task queue, Zone E decision badge. Absorbs: Formation, Roadmap, Org, Costs/Usage direction, Activity recap, Dashboard/Live. |
| **Chat** | `/messages` | WhatsApp-style conversation list (VIT-41). Absorbs: Board Chat (pinned conversation), issue chat threads as the territory (IssueDetail reached from here). |
| **Decisions** | `/decisions` | The queue of what needs the board (WhatNeedsMe). Absorbs: Approvals, Inbox attention items. Flag `enableDecisions` removed — always on. |
| **Settings** | `/company/settings/**` | Unchanged tree (company + instance), one hop from the account menu. Absorbs: skills/plugins/adapters management links, export/import. |

The **command palette (⌘K)** is the retrieval mechanism that makes every DEMOTE legitimate
(G11): demoted surfaces keep routes and get palette entries; they lose all persistent nav.

---

## 2. Route inventory — every route in `App.tsx`, sentenced

### KEEP (9 units)

| # | Route(s) | Page | Sentence & reason |
|---|---|---|---|
| K1 | `/dashboard` | Dashboard.tsx | **KEEP — rebuild.** Becomes the five-zone Mission Control. Current interior (4 MetricCards, 4 ChartCards, recent lists) is replaced by the spec'd zones; `ActiveAgentsPanel` survives as Zone B live mode (VIT-112). |
| K2 | `/messages` | Messages.tsx | **KEEP.** The Chat surface (VIT-41). |
| K3 | `/decisions` | WhatNeedsMe.tsx | **KEEP.** The Decisions surface; de-flag `enableDecisions`. |
| K4 | `/issues/:issueId` | IssueDetail.tsx | **KEEP (no nav row).** Issue threads are the chat territory — entered from Chat/Decisions/palette, never from a sidebar. |
| K5 | `/company/settings/**` + `/company/settings/instance/**` + `instance/settings/adapters` (~18 routes) | CompanySettings + instance pages | **KEEP.** The settings tree, one hop deep via account/company menu. |
| K6 | `/onboarding`, `/auth`, `/board-claim/:token`, `/cli-auth/:id`, `/invite/:token` | entry pages | **KEEP.** Entry plumbing, not surfaces. |
| K7 | Command palette (⌘K) | CommandPalette.tsx | **KEEP.** The demotion mechanism; gains entries for every DEMOTE row. |
| K8 | New Task/Agent/Project/Goal dialogs + `c` shortcut | Layout.tsx dialogs | **KEEP.** Creation stays one keystroke away without nav chrome. |
| K9 | `*` NotFound, RouteErrorBoundary, legacy redirects | plumbing | **KEEP.** |

### DELETE (24 units — route + code removed)

| # | Route / unit | Page/file | Why it dies (gate) |
|---|---|---|---|
| D1 | **Sidebar as primary nav** | Sidebar.tsx + sections | Spec §3: "Three surfaces = three tabs" (G4, Hick). Company switcher + account menu relocate to a slim top bar. Biggest single deletion. |
| D2 | Sidebar "Company" section (Formation/Roadmap/AI SDR/Org/Timeline/Usage/Costs/Activity rows) | Sidebar.tsx | All 8 destinations die or demote below; the section has no survivors. |
| D3 | Sidebar "Work" section (Tasks/Cases/Routines/Pipelines/Goals/Artifacts/Skills/Workspaces/Projects rows) | Sidebar.tsx | Every row demotes to palette; section dies. |
| D4 | Sidebar "Agents" section | SidebarAgents.tsx | Zone B formation cards ARE the agent roster (spec idea #9); agent detail is the L2 drill. |
| D5 | `/formation` | Formation.tsx | Becomes Zone B (spec §3 deletion table). Route redirects to `/dashboard`. |
| D6 | `/roadmap` | Roadmap.tsx | Becomes Zone C (spec §3 deletion table). Redirect likewise. |
| D7 | `/costs` | Costs.tsx | Spec §3: direction-of-pressure → Zone A bars; per-agent spend → agent detail L2. Failed G1. Budget policy/incident cards relocate to agent detail Budget tab + settings. |
| D8 | `/usage` | Usage.tsx | Same fold as Costs (Zone A Capacity bar + L2). Quota alerts surface as formation-card badges (idea #10). |
| D9 | `/activity` | Activity.tsx | "While you were gone" strip + issue threads cover it (idea #12). A raw event firehose fails G1. |
| D10 | `/org` | OrgChart.tsx (+ Org.tsx if confirmed dead) | Redundant with Zone B formation. Two org views is one too many (G2). |
| D11 | `/timeline` | Timeline.tsx + components/timeline/ | Gantt view, checked ~never (G1). **Upstream-owned (PAP-12424) — fork-divergence cost accepted; see DECISION-SHEET R6-3.** |
| D12 | `/dashboard/live` | DashboardLive.tsx | Thin ActiveAgentsPanel wrapper; VIT-112 Zone B live mode absorbs it. |
| D13 | `/companies` | Companies.tsx | Company switcher dropdown already covers select/create/reorder. |
| D14 | `/agents/new` | NewAgent.tsx | NewAgentDialog covers creation; page is a duplicate path. |
| D15–D18 | IssueChatUxLab, RunTranscriptUxLab, SystemNoticeUxLab, InviteUxLab | pages/*.tsx | **Already orphaned — no route mounts them.** Dead code, delete on sight. |
| D19–D21 | `/ux-lab/cloud-upstream`, `/ux-lab/bootstrap-setup`, `/ux-lab/responsible-user-denial` | 3 UxLab pages | Dev showcases shipped in prod bundle. Delete routes + pages; visual evidence lives in doc/design + git history. |
| D22 | MobileBottomNav (5 tabs) | MobileBottomNav.tsx | Replaced by the same three tabs on mobile. |
| D23 | Notification-style toasts | ToastViewport/ToastContext usage | Spec §3: spatially-anchored badges replace the tray (idea #10). **Transactional failure toasts (mutation errors) are kept** — that's feedback, not notification. See DECISION-SHEET R6-4. |
| D24 | MyIssues.tsx | pages/MyIssues.tsx | No route found in App.tsx — verify at execution; delete if confirmed dead. |

### DEMOTE (26 units — route kept, one hop deep, zero persistent nav)

| # | Route(s) | Where it lands |
|---|---|---|
| M1 | `/marketcap` | Level-2 drill from the Market Cap hero card (Zone A). Spec idea #2. |
| M2 | `/agents/:agentId` (+tabs/runs) | Level-2 drill from Zone B formation card. |
| M3 | `/agents/all` (+status tabs) | Palette ("Browse agents"). |
| M4 | `/issues` (list) | Palette ("Tasks"). Zone D is the daily queue; the list is investigation. |
| M5 | `/search` | Palette full-search target (⌘↵) only. |
| M6 | `/projects`, `/projects/:id/**` | Palette. |
| M7 | `/workspaces` | Already flag-gated; palette. |
| M8 | `/routines`, `/routines/:id` | Palette. |
| M9 | `/cases`, `/cases/:id` | Stays flag-gated beta; palette. |
| M10 | `/review-queue` | Flag-gated; palette. |
| M11 | `/learnings` | Flag-gated; palette. |
| M12 | `/pipelines/**` | Flag-gated; palette. |
| M13 | `/execution-workspaces/:id/**` | L2 drill from runs/issues. |
| M14 | `/goals`, `/goals/:goalId` | Already behind `enableGoalsSidebarLink`; palette. |
| M15 | `/artifacts` | Palette. |
| M16 | `/approvals/**` | Folds under Decisions surface. **Active approval-gate workflow (VIT-45) → demote, never delete** until VIT-111 lands. |
| M17 | `/inbox/*` (mine/recent/unread/blocked/all) | Decisions absorbs attention items. **Active wake loop → demote, never delete** until VIT-111. Routes stay; nav rows die. |
| M18 | `/inbox/requests` | Settings → Members (join-request badge already exists there). |
| M19 | `/board-chat` | Merges into Chat as a pinned "Board room" conversation; route redirects to `/messages`. |
| M20 | `/ai-sdr` | Palette-only. **Active sales dogfood workflow (VIT-103) → demote, not delete.** |
| M21 | `/u/:userSlug` | Account menu only. |
| M22 | `/design-guide` | Palette-only dev tool. |
| M23 | `/skills/*` | Palette + settings link. |
| M24 | `/skills/studio/**` | Palette. |
| M25 | `/company/export/*`, `/company/import` | Settings-only reachability. |
| M26 | `/plugins/:pluginId`, `/:pluginRoutePath/*` + plugin nav slots | Plugin launchers become palette entries; sidebar plugin slots die with the sidebar. |

---

## 3. Chrome & overlay inventory (non-route surfaces)

| Item | Sentence | Landing |
|---|---|---|
| Company switcher | KEEP | Moves to top bar (left). |
| Account menu (profile/theme/sign-out/server info) | KEEP | Moves to top bar (right), beside the Decision badge. |
| Search icon button (sidebar) | DELETE | ⌘K + `/` cover it. |
| Sidebar collapse/pin/peek machinery | DELETE | Dies with the sidebar. |
| Starred projects / starred agents sidebar rows | DELETE | Palette + Zone B cover. |
| New Task button (sidebar) | DELETE (button) | `c` shortcut, palette, Chat composer remain. |
| Breadcrumb bar | KEEP (thinned) | Needed on L2 drills to get back; three tabs need none. |
| Mobile toolbar / StandaloneBrowserControls | KEEP | PWA plumbing, mobile-only. |
| Toast viewport | DEMOTE | Transactional errors only (see D23). |
| PropertiesPanel (`]` right rail) | KEEP | Issue-detail furniture, not nav. |
| KeyboardShortcutsCheatsheet | KEEP | `?` overlay; self-explanatory (G5). |
| Onboarding wizard | KEEP | First-run only. |
| WorktreeBanner / DevRestartBanner | KEEP | Dev-mode plumbing, gated. |
| Workflow dialogs (ConfigureBuiltInAgent, ImageGallery, DocumentDiff, FileViewerSheet, RoutineRunVariables, ForkSkill, secrets dialogs, workspace-close, etc.) | KEEP | Interior furniture of kept/demoted surfaces — they ride with their owner's sentence. |
| KanbanBoard dnd / Pipelines dnd | DEMOTE | Rides with M4/M12 owners. |
| SkillStudio resizable panes | DEMOTE | Rides with M24. |

---

## 4. The slate (headline)

**DELETE 24 · DEMOTE 26 · KEEP 9.**

Deletion rate on nav chrome: the sidebar's ~30 always-on destinations collapse to
**3 tabs + 1 settings menu + 1 palette**. Every demoted route keeps working via ⌘K.

### Top-10 riskiest deletions (individual board swipe)

1. **Sidebar → three-tab chrome** (D1–D4) — every muscle-memory path changes at once.
2. **Formation page → Zone B** (D5) — shipped this month (S2 dogfood surface).
3. **Roadmap page → Zone C** (D6) — same.
4. **Costs page** (D7) — money visibility moves; G9 requires decision-critical numbers stay
   on level 1 → the Zone A bars + decision-card cost lines must land in the same release.
5. **Usage page** (D8) — quota alerting must re-land as formation badges before delete.
6. **Activity page** (D9) — only if "while you were gone" ships in the same release.
7. **Timeline page** (D11) — upstream-owned code; permanent fork divergence.
8. **Org page** (D10) — loses the classic tree view entirely.
9. **Dashboard/Live** (D12) — depends on VIT-112 zone landing first.
10. **Companies page** (D13) — switcher must prove create/reorder parity first.

### Add-back insurance (the 10% rule)

Per the issue's DONE-WHEN: if nothing from this slate gets added back within two weeks of
execution, the slate was too conservative and gets re-run harder. Deletion order in the
worktree is one unit per commit, so any add-back is a single revert.

---

## 5. Execution plan (post-approval)

Worktree `design/run6-via-negativa`, one deletion unit per commit, visual suite + token
gates green per house discipline, evidence in `run6-review/`. Sequencing:

1. Dead code first (D15–D18, D24) — zero risk, no board dependency.
2. UX labs + duplicate paths (D19–D21, D14, D13, D12).
3. Page folds that need a zone to exist (D5–D9) — land WITH the corresponding zone build
   or immediately after VIT-112/dashboard rebuild; never delete before the absorber exists.
4. Chrome swap last (D1–D4, D22): sidebar → three tabs, one release, behind a short-lived
   dev flag for the canary.

Dependencies: Zone builds (VIT-112 + dashboard rebuild) gate step 3; VIT-111 collapse
gates any future deletion of inbox/approvals routes (M16/M17 stay demoted until then).

**Evidence:** before-screenshots of all 24 sentenced surfaces (light; kept surfaces also
dark) at `doc/design/evidence/VIT-115/before/`.
