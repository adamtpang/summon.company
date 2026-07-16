# Mobbin Patterns — Desktop App UI/UX Mined for Summon

**Research date:** 2026-07-15 (VIT-50)
**Companion doc:** `doc/research/DESKTOP-UX-SKELETONS.md` (Claude/Codex desktop anatomy). This doc cites it as **SKEL §n / feature n**; §6 confirms the two docs disagree nowhere.
**Feeds:** Run 5 design-system work (VIT-35) — see §5 annotated references; VIT-37 (model picker), VIT-41 (messaging), VIT-48 (usage), VIT-40 (continuity).

**Method + access caveat:** Mobbin's browse UI is login-gated and blocks anonymous fetches, but its per-screen pages (`mobbin.com/explore/screens/{id}`), flow pages, pattern indexes, and glossary are indexed and were read through a search-index fetcher. **Every link below appeared verbatim in a fetched page or search result — none are guessed.** Screen titles/descriptions are Mobbin's own. Full-resolution browsing of a linked screen may still prompt a Mobbin login; the board (Adam) can screenshot-share any flow that a paywall blocks, but no pattern below depends on that.

---

## 1. Reference app roster (12 apps + 3 bonus finds)

| App (Mobbin platform) | Why it's on the list | Summon surfaces it informs |
|---|---|---|
| **Linear** (Web) | Canonical triage/inbox + command palette | Decision queue, Inbox, palette, empty states |
| **Slack** (Web) | Channel/thread/DM anatomy | Messaging VIT-41 |
| **Notion** (Web) | People settings, inbox, search overlay | Roster, Inbox, palette, onboarding |
| **Superhuman** (Web, as "Superhuman Mail") | Keyboard-first inbox, command modal | Inbox VIT-41, palette, onboarding |
| **Notion Calendar** (Web, cataloged as "Cron Calendar") | Palette-as-navigation, destructive-action safety | Palette, settings, toasts |
| **Height** (Web) | Task+chat hybrid, inbox with status dots | Issue thread, Inbox VIT-41 |
| **Raycast** (iOS companion only) | AI chat detail; desktop launcher NOT on Mobbin | Chat input modes; palette via Linear/Vercel instead |
| **Arc** (iOS companions only) | Onboarding + guided external setup; desktop NOT on Mobbin | Onboarding |
| **ChatGPT** (Web) | Chat detail, empty-state home | Messaging VIT-41, empty states |
| **Claude** (Web) | Model settings panel, plans/billing | VIT-37, VIT-48, messaging |
| **Perplexity** (Web) | API credits/usage page, Pro tier affordance | VIT-48, VIT-37 |
| **Vercel** (Web) | **Model Browser**, analytics, team dashboards | VIT-37, VIT-48, roster |
| **Stripe** (Web) *(bonus)* | Business-metric dashboards, API usage | VIT-48 |
| **Manus** (Web) *(bonus)* | The only rich autonomous-agent progress UI on Mobbin (Devin has none) | Run monitor, evidence panel |
| **v0 / Cursor / Replit** (Web) *(bonus)* | Credits billing, chat+artifact splits, usage flows | VIT-48, VIT-41 |

Coverage gaps found: Raycast desktop launcher, Arc desktop browser, and Devin are absent from Mobbin (its catalog is iOS/Android/Web). Slack's quick switcher and a Linear member-roster screen never surfaced. Where a target app lacked a screen, the pattern below cites the nearest cataloged app instead.

---

## 2. The adoptable patterns (18)

Each: **pattern — source screens (Mobbin links) — Summon mapping.** SKEL refs point at `DESKTOP-UX-SKELETONS.md`.

### Inbox & decision queue

**P1. One-key triage verbs on a focused item.** Linear renders a single issue with explicit accept / mark-duplicate / decline / snooze actions — nothing enters the backlog without a human verb. Source: [Linear Web Issue Detail View](https://mobbin.com/explore/screens/a0c168b3-153d-4b5a-9af5-32aa299cc2ee), [Linear Web Single Issue](https://mobbin.com/explore/screens/52b17d03-d6bc-4f96-805a-b415696c0968). → **Decision queue / Inbox home** — the four verbs map 1:1 onto approve / request-changes / reject / snooze for agent output. Confirms SKEL feature 1.

**P2. Two-pane inbox: list left, full detail right, never navigate away.** Linear and Notion inboxes keep the notification list visible while the focused item renders beside it with its activity log and comments. Source: [Linear Web Inbox Notifications](https://mobbin.com/explore/screens/5ed7ef17-39f4-4186-843f-0427e1e8579d) ([variant](https://mobbin.com/explore/screens/ecd4b63c-7956-4fa3-9573-bf6d78c4bca4)), [Linear Web Notification Detail](https://mobbin.com/explore/screens/2a024a1e-5269-412a-8e2d-241edc2b7a1b), [Notion Web Inbox View](https://mobbin.com/explore/screens/dc69b7fa-9bb1-409a-9f59-32f7aad9109e). → **Inbox layout** (VIT-41 detail pane = existing issue thread). Confirms SKEL feature 2.

**P3. Inbox rows carry status dots + one-line context.** Height's inbox lists conversations with status dots and mark-as-done affordances; its task detail embeds a chat section — the closest existing analog to Summon's issue-thread-as-conversation model. Source: [Height Web Inbox View](https://mobbin.com/explore/screens/20a3fc56-b0d5-4e80-98e0-d034c2a9ded0), [Height Web Task Detail Panel](https://mobbin.com/explore/screens/a26d22f4-3717-4e0a-84d5-cabb764f49cb). → **Inbox rows + issue thread** (VIT-41/VIT-40).

**P4. Queue filters as a lightweight popover, not a filter page.** Superhuman filters conversations (Unread/Starred/Important/No reply) from a keyboard-reachable popover; Stripe's payments table shows chip-based filters with pagination for heavier data. Source: [Superhuman Mail Web Filter Conversations Popover](https://mobbin.com/explore/screens/7c061a20-01de-48b8-b26b-1093fbd499d1), [Stripe Web Payments Table](https://mobbin.com/explore/screens/af632986-d9bc-4a35-ad86-f5b16d43919d). → **Inbox + roster filtering** (filter by employee, state, needs-me).

**P5. Inbox-zero as a designed win state.** Linear's empty inbox says "No unread notifications" with an icon; Superhuman celebrates with streak + marked-done counts; Midday/Jasper ship designed empty notification inboxes. Source: [Linear Web Empty Inbox](https://mobbin.com/explore/screens/db497da7-0b3c-4f6b-bf78-f355b2147dec), [Superhuman Mail Web Achievement Modal](https://mobbin.com/explore/screens/1f6dbde4-2225-4518-b452-c4e1c90c315f), [empty-state pattern index](https://mobbin.com/explore/web/screens/empty-state) (Midday "Notification Inbox", Jasper "Inbox Interface"). → **Inbox empty state:** "All employees unblocked — nothing needs you." Confirms SKEL §4.2.

### Messaging (VIT-41)

**P6. Channel / thread / composer anatomy.** Slack's three-part contract: channel view with message history, thread panel opening beside it (with "Open in split view" on DMs), pinned message at top, composer with explicit send. Source: [Slack Web Slack Channel View](https://mobbin.com/explore/screens/62dcb1a4-9548-48ec-b100-b987e4022ed3), [Slack Web Thread Conversation](https://mobbin.com/explore/screens/8da696c0-79a7-4ab6-b0a4-46965bebf2dc), [Slack Web Direct Message Menu](https://mobbin.com/explore/screens/5857da80-92c0-4d8b-9b15-4bd5330bc4cb), [Slack Web Message composer](https://mobbin.com/explore/screens/960a78e6-6f17-4296-ab9c-3faa0c2d07e1), [Slack Web Pinned Message View](https://mobbin.com/explore/screens/00e5234f-cdca-4ab6-8502-1c462ce84f38). → **VIT-41 chat surface** (already WhatsApp-feel; adopt thread-beside-list and pin-the-directive).

**P7. Prompt-first dispatch composer.** Manus opens on a task-definition input, then turns the submission into a monitored run; Lovable and v0 open on prompt-first homes. Source: [Manus Web Task Defined](https://mobbin.com/explore/screens/ff06a8ae-0102-4193-bb1f-81653a329679), [Lovable Web Home Screen](https://mobbin.com/explore/screens/26bdc006-3936-46e8-8cda-b5bd2ff95ddb), [v0 Web Homepage](https://mobbin.com/explore/screens/9ecb3712-83f0-4805-88e1-4634ebe74923). → **#company Dispatch channel** (SKEL feature 8): type the task, the console routes it and links the spawned issue back to the message.

**P8. List+detail chat shells for AI conversations.** Claude's multi-column layout (sidebar + chat + drawer), ChatGPT's chat detail with side navigation, Cursor's chat-in-an-internal-tool shell, and v0's chat+live-preview split are the current AI-chat anatomy. Source: [Claude Web Multi-Column Layout Screen](https://mobbin.com/explore/screens/5664f5fb-aad5-425d-a6af-63965eb6bf33), [ChatGPT Web Chat Detail Screen](https://mobbin.com/explore/screens/86b2a572-1f8f-423a-b818-86cef72b4eff), [Cursor Web Multi-Column Layout Screen](https://mobbin.com/explore/screens/3873ef88-3f4c-4963-bd72-f749ea88cbf8), [v0 Web Web application interface](https://mobbin.com/explore/screens/c99b4fcc-b226-44f3-bc0d-96e3e7060bb4). → **Per-employee DM surface** (VIT-41), with v0's chat+artifact split as the model for "conversation + deliverable evidence" (VIT-40 Summary mode).

### Command palette

**P9. Palette with inline shortcut teaching.** Superhuman's command modal lists commands *with* their shortcuts (the palette doubles as the keyboard tutor); Linear's command menu auto-suggests as you type; Vercel ships the same in a dev console. Mobbin's own glossary analyzed 120+ palettes: search-first beats shortcut memorization; add tabs/chips only under real data complexity. Source: [Superhuman Mail Web Command Modal](https://mobbin.com/explore/screens/e36ea7b5-114b-43ff-84d2-3b3e344bbc7d), [Linear Web Command menu](https://mobbin.com/explore/screens/663ce897-cc91-4f2c-b9e8-15b2822846ab), [Linear Web Command list](https://mobbin.com/explore/screens/6f97cc9a-49ce-44ee-9a99-0a2a86ea97b5), [Vercel Web Command Menu Modal](https://mobbin.com/explore/screens/7abd1276-fabf-4e1f-b7ad-fede52e8d745), [command palette glossary](https://mobbin.com/glossary/command-palette), [150+ web examples](https://mobbin.com/explore/web/screens/command-palette). → **Ctrl+K palette** with SKEL §4.4's company verbs; every row shows its shortcut.

**P10. Palette as navigation, not just actions.** Notion Calendar's palette jumps to dates; Notion's search overlay doubles as the nav surface (recents + filters, works in dark mode). Source: [Cron Calendar Web Command Palette](https://mobbin.com/explore/screens/dd49f084-f697-4678-8365-c0c5eb11bf1a), [Notion Web Search Overlay](https://mobbin.com/explore/screens/f6bd8f3c-1d14-4caf-ad0a-babe5c33397e), [Notion Web Dark Mode Search](https://mobbin.com/explore/screens/53604d51-1a09-4f5c-a3b9-04111f3d039b). → Palette `go` verbs (go inbox / formation / [employee]) and "jump to issue/run" are first-class, not an afterthought.

### Roster / formation

**P11. Roster = people table with inline management.** Notion's People settings is the cleanest members-list-with-actions screen on Mobbin; Slack manages invites as revocable links ("Deactivate All"); Vercel renders teams/projects as searchable, sortable card grids. Source: [Notion Web People Settings](https://mobbin.com/explore/screens/a7275f38-fd31-4528-b5b5-0df477255643), [Slack Web Invite Links](https://mobbin.com/explore/screens/febd4358-177e-445a-87f1-c89c1069a401), [Vercel Web Team Dashboard](https://mobbin.com/explore/screens/21c95be5-2cea-40d2-b8a5-db050aaa263e), [Vercel Web Project Dashboard](https://mobbin.com/explore/screens/d87b389d-e6eb-468f-a636-cbc1914997d5), [invite-teammates index](https://mobbin.com/explore/web/screens/invite-teammates). → **Formation roster**: employee table with role, trust profile, model default, and "summon" as the invite verb.

**P12. Presence as status dots with optional labels.** Mobbin's Status Dot glossary (1,000+ examples): dots for binary live state, corner-of-avatar for messages, add a text label when meaning isn't obvious, never use a dot for critical alerts. Height's inbox and a ChatGPT publishing screen show them in work contexts. Source: [status-dot glossary](https://mobbin.com/glossary/status-dot), [Height Web Inbox View](https://mobbin.com/explore/screens/20a3fc56-b0d5-4e80-98e0-d034c2a9ded0), [ChatGPT Web Screen (Status Dot)](https://mobbin.com/explore/screens/7bbee8f4-9c4b-44b5-9958-d4ed60a31683). → **Employee presence** (SKEL feature 3): dot = working/idle/blocked/resting, labeled on the card ("waiting on you — 12m"); blocked-on-you escalates to an Inbox item, never just a red dot.

### Model picker & settings (VIT-37)

**P13. Model selection as a browsable, searchable catalog — not a bare dropdown.** Vercel's Model Browser lists AI models with search and filtering; Claude exposes a model-settings panel with a temperature slider; ChatGPT's mobile picker highlights the selected model inline; Apollo and FLORA ship model-selection modals. Source: [Vercel Web Model Browser](https://mobbin.com/explore/screens/0c5eb5cf-78f1-4b9b-9392-fce3dbb95047), [Claude Web Adjusted Temperature Setting](https://mobbin.com/explore/screens/edaa0fc7-f2f1-4055-8ae2-f7fcda60f40e), [ChatGPT iOS GPT-4 Selected](https://mobbin.com/explore/screens/f08ad45c-a3db-44f6-8cab-d42e1312f25d), [Apollo Web AI Model Selection](https://mobbin.com/explore/screens/c068b5c3-521c-4ab2-9a52-b9aeb9b5bb3b), [FLORA Web Model Selected](https://mobbin.com/explore/screens/401b9a7b-e064-4004-b066-6d1eea8b3aa1). → **VIT-37**: composer picker stays a compact dropdown (SKEL feature 4 — adjacent to send), but the *per-employee default* on agent detail gets the catalog treatment: model cards with cost/capability, searchable.

**P14. Tier affordances explain themselves on hover.** Perplexity's "Pro" button explains the tier in a hover popup before you commit; ChatGPT walks feature/tier info as a stepper. Source: [Perplexity Web Pro search popup](https://mobbin.com/explore/screens/a5387dc8-1cb8-4be4-bf8b-9ab56358037d), [ChatGPT Web Feature Info Screen](https://mobbin.com/explore/screens/d65779ea-e42b-4289-bd10-a6d0d341616f). → **VIT-37 effort tiers**: hovering the max tier shows projected cost against the employee's remaining quota (SKEL feature 4's Codex-style warning, rendered the Perplexity way).

**P15. Settings anatomy: grouped sections, toggles, and a danger zone that confirms.** Linear/Slack/Notion settle on sectioned settings with switches and per-section tabs; notification prefs are toggle matrices (Front, Notion); Notion Calendar gates account deletion behind an explicit confirmation modal. Source: [Linear Web Settings & Preferences](https://mobbin.com/explore/screens/f65297dd-67fb-4560-9d89-ab3c179536a8), [Slack Web Settings & Permissions](https://mobbin.com/explore/screens/60279f8d-04d7-4b99-83bc-661d77557075), [Notion Web Notification Settings](https://mobbin.com/explore/screens/5dfe50e8-f0c0-4ea8-825c-52ab91b6462e), [Front Web Notification Settings Page](https://mobbin.com/explore/screens/475bac97-5d93-4d73-a241-529f7a1aa8c8), [Cron Calendar Web Account deletion confirmation](https://mobbin.com/explore/screens/0c625a86-8e4c-479f-9b8e-d3e66fa5e14a). → **Settings + agent-detail Config tab**; "fire employee" and "revoke always-allow" live in a confirmed danger zone.

### Usage & costs (VIT-48)

**P16. Credits/usage rendered as balance + meter + breakdown, next to the key that spends it.** Perplexity's API page puts available credits, current usage, and key generation on one screen; v0's billing shows plan + credit balance + payment method; Cursor's home leads with a billing progress indicator; Stripe's developer dashboard tracks API usage; Replit ships a whole usage flow. Company-level: Stripe's billing overview (MRR/subscribers/net volume) and Vercel's analytics charts. Source: [Perplexity Web API Settings Page](https://mobbin.com/explore/screens/1e5e57dd-91c4-49e3-b95a-cfffb444d618), [v0 Web Billing and Usage Settings](https://mobbin.com/explore/screens/109c6bf3-1d25-49f3-98d0-a167f76deaf8), [Cursor Web Home Screen](https://mobbin.com/explore/screens/d0f596f9-78ed-4e3f-b56c-510a4cb5a84d), [Stripe Web Developer Dashboard](https://mobbin.com/explore/screens/c99bcbde-a924-46c4-a9cc-56b23a4298cb), [Replit Web Usage Flow](https://mobbin.com/explore/flows/2c73db0d-bb83-4192-aa57-0a0a3e1d453e), [Stripe Web Billing Overview](https://mobbin.com/explore/screens/79298d82-c094-4e61-9b02-3da019799305), [Vercel Web Analytics Dashboard](https://mobbin.com/explore/screens/d327779b-97f3-4a2a-b0d2-751cbaba7d9d). → **VIT-48 three levels** (SKEL feature 5): ring on the employee card, credits+meter+per-issue breakdown on agent detail (Perplexity/v0 anatomy), Stripe-style company roll-up in /usage.

### Agent runs & evidence

**P17. Autonomous-run monitor: step checklist + live evidence + artifact + rating.** Manus (the only agent product with deep Mobbin coverage — Devin has none) shows a progress bar over completed steps, a terminal view of commands as they execute, a markdown artifact panel for the deliverable, and a rating prompt on completion. Source: [Manus Web Task Progress](https://mobbin.com/explore/screens/7cca0201-52d3-4e26-a065-b78a2f865ea6), [Manus Web Detailed Progress](https://mobbin.com/explore/screens/b68b9d97-3276-4b84-8340-8076943ecbca), [Manus Web Markdown File Display](https://mobbin.com/explore/screens/7da171c2-0946-4b7e-838a-b019cd90f926), [Manus Web Rating Feedback Screen](https://mobbin.com/explore/screens/d3117b8c-e491-4396-8106-99493a747b2d). → **Run monitor inside agent detail / issue thread**: steps = plan progress, terminal = Verbose density (SKEL feature 7), artifact panel = the deliverable the board actually reviews, rating = board verification signal.

### Onboarding & safety

**P18. Onboard inside the working surface, then confirm destructive exits.** The winning onboarding is a checklist/tutorial living in the real UI — Notion's welcome checklist, Stripe's "activate payments" nudge on a live dashboard, Superhuman's welcome message *inside the inbox*, Slack's tutorial popup over the real channel list; workspace-creation wizards (Linear, Height, Perplexity flows) stay short and end in the product. The safety counterpart: destructive actions confirm (Cron account deletion) and reversible ones toast with undo (Cron event cancellation; Height's unsaved-changes toast; Mobbin's toast glossary: toasts for low-priority, dialogs for decisions). Source: [Notion Web Notion Welcome Page](https://mobbin.com/explore/screens/95cfbdc4-10fb-4f5d-bc9e-84c627e3ef35), [Stripe Web Dashboard Home](https://mobbin.com/explore/screens/a71edad2-ab06-4d1f-922a-c7c7bfe75279), [Superhuman Mail Web Inbox Welcome](https://mobbin.com/explore/screens/85b28b16-cb18-4a3c-824e-8f4fab7ba110), [Slack Web Slack Interface Tutorial](https://mobbin.com/explore/screens/1e758bdf-4da9-43ad-bfb5-88738824f2f1), [Linear Web Onboarding flow](https://mobbin.com/explore/flows/a41035e9-66ed-4f97-8e30-72e13f0b843d), [Height Web Onboarding Flow](https://mobbin.com/explore/flows/069e58e3-90ba-434e-8fd3-4805b051266e), [Cron Calendar Web Calendar Updated (undo toast)](https://mobbin.com/explore/screens/726b9c2b-c5a3-482b-a0c0-29abeba4b2ac), [toast glossary](https://mobbin.com/glossary/toast), [empty-state glossary](https://mobbin.com/glossary/empty-state). → **OnboardingWizard + first-run formation view** (SKEL §4.2's sample-employee teaching state) and **trust boundaries**: approve/reject = dialog-grade; archive/snooze = toast+undo.

---

## 3. Pattern → Summon surface index

| Summon surface | Patterns |
|---|---|
| Decision queue / Inbox (home) | P1, P2, P3, P4, P5 |
| Messaging VIT-41 | P3, P6, P7, P8 |
| Command palette | P9, P10 |
| Roster / formation | P11, P12 |
| Model picker / settings VIT-37 | P13, P14, P15 |
| Usage dashboards VIT-48 | P16 |
| Run monitor / evidence (VIT-40 adjacent) | P8, P17 |
| Onboarding | P7, P18 |
| Empty states | P5, P18 |

18 patterns ≥ the 15 required; every one maps to a Summon surface and carries at least one verified Mobbin link.

---

## 4. Coverage gaps & evidence caveats

- **Not on Mobbin:** Raycast desktop launcher, Arc desktop browser, Devin, any Slack Cmd+K quick-switcher screen, a Linear member-roster screen, and post-rebrand "Notion Calendar" captures (still cataloged as Cron). Where relevant, nearest cataloged apps were substituted and labeled.
- Mobbin screen links resolve for anonymous visitors via its indexed pages, but interactive browsing beyond a screen may hit the signup wall — acceptable per the ticket (board can screenshot-share if a deep flow is ever needed).
- Screen descriptions are Mobbin's editorial copy; pixel-level details (spacing, exact colors) were not extracted and should not be quoted downstream — these references are IA/pattern evidence, not visual specs. Visual language remains governed by the SUMMON v2.0 brand (Run 5), not by any referenced app.

---

## 5. Feed into Run 5 / VIT-35 — annotated references

The five references the Run 5 design-system session should pin while working (`doc/design/RUN5-SUMMON-BRAND.md`):

1. **[Vercel Model Browser](https://mobbin.com/explore/screens/0c5eb5cf-78f1-4b9b-9392-fce3dbb95047)** (P13) — how a catalog of models stays scannable in a light, dense console; direct reference for VIT-37's per-employee default picker.
2. **[Linear Inbox + Empty Inbox](https://mobbin.com/explore/screens/5ed7ef17-39f4-4186-843f-0427e1e8579d)** ([empty](https://mobbin.com/explore/screens/db497da7-0b3c-4f6b-bf78-f355b2147dec)) (P2/P5) — the density, row anatomy, and win-state tone for Summon's Inbox home.
3. **[Perplexity API Settings](https://mobbin.com/explore/screens/1e5e57dd-91c4-49e3-b95a-cfffb444d618)** + **[v0 Billing & Usage](https://mobbin.com/explore/screens/109c6bf3-1d25-49f3-98d0-a167f76deaf8)** (P16) — credits/meter/breakdown anatomy for VIT-48 in a light-first UI.
4. **[Height Task Detail Panel](https://mobbin.com/explore/screens/a26d22f4-3717-4e0a-84d5-cabb764f49cb)** (P3) — chat-inside-task, the closest published analog to Summon's issue thread; informs VIT-41's thread pane typography and spacing rhythm.
5. **[Manus Task Progress](https://mobbin.com/explore/screens/7cca0201-52d3-4e26-a065-b78a2f865ea6)** (P17) — agent-run evidence hierarchy (steps → terminal → artifact); informs how status tokens (`--status-task-*`) render inside a run monitor.

Token-level implications for Run 5: status dots (P12) and run states (P17) must come from the existing `--status-agent-*` / `--status-task-*` vocabulary — the brand remap must not touch them (already a Run 5 guardrail); the Inbox/queue density (P2) argues for keeping the operator text ladder (#0C1428/#46506B/#6B7590) at Linear-grade compactness rather than marketing-page airiness.

---

## 6. Cross-check vs DESKTOP-UX-SKELETONS.md

Checked every pattern against the skeletons doc; **no disagreements found.** Specifically:

- P1/P2/P5 are the Mobbin evidence base for SKEL features 1–2 (decision queue, two-pane review) and §4.2's celebration empty state — same verbs, same layout.
- P6/P7/P8 support SKEL feature 8 (Dispatch-style router + per-employee DMs) — Slack anatomy for DMs, Manus/Lovable for the dispatch composer.
- P9/P10 support SKEL feature 10 and §4.4 (palette verbs); Mobbin's glossary adds the "search-first beats shortcuts" nuance, which refines—not contradicts—the shortcut-teaching rule (show shortcuts, don't require them).
- P12 supports SKEL feature 3 (presence) and adds the glossary's constraint that dots never carry critical alerts — consistent with SKEL anti-pattern 2 (blocked-on-you goes to the Inbox, not a dot).
- P13/P14 support SKEL feature 4 (picker adjacent to send, cost warning on top tier) and extend it with the catalog treatment for per-employee defaults — an addition on the agent-detail surface, not a change to composer placement.
- P16 supports SKEL feature 5 (ring + dual meters + breakdown); P17 supports features 7/9 (density toggle, promote-to-branch as board decision); P15/P18 support feature 6 (trust as per-employee attribute, revocable grants) and anti-pattern 1 (visible autonomy).
- Height's death (SKEL anti-pattern 1) doesn't conflict with citing Height's *UI screens* here: what died was invisible autonomy, not the inbox/task-detail anatomy, which remains well-executed and is cited only as layout evidence.
