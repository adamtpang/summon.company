# Handoff from Anchor: let Summon orchestrate anchormarianas.com

Written 2026-11-20 in a Claude Code session in `Aether/anchormarianas.com`. Planning only:
no code changed in summon.company except this file and the Cofounder section added to
`FEATURE-PARITY.md`. No messages sent, no money moved.

## The ask (Adam, in chat, 2026-11-20)

"create handoff files for that repo, maybe i can have IT orchestrate anchor. im already
incorporated." Summon becomes the control plane that runs Anchor as a company: diagnose
its constraint, assign work to its agents, keep receipts. Adam stays the board.

He also asked to look at Grok Bot as an operator layer (people run businesses on Grok
bots) and to write a Cofounder.co parity spec here (done: `FEATURE-PARITY.md`,
"Cofounder.co delta"). Grok research findings are in the section at the bottom.

## What Anchor is now

Anchor Marianas (anchormarianas.com) is an **AI-first business brokerage that becomes a
holding company**. Phase 1: match retiring Texas owners of accounting firms (tax,
bookkeeping, CPA; never payroll as the target) with qualified buyers (searchers, search
funds, holdcos, PE add-on platforms, strategic CPA firms). Next: other recurring-revenue
B2B service firms with retiring owners and SBA-loan fit. Phase 2: buy and hold some.

It used to be a Guam AI-implementation agency (AnchorScan, review reads, fixed-price
builds). Much of `anchormarianas.com/CLAUDE.md` still describes that era; trust the
brokerage handoffs and `EVIDENCE.md` over it. Adam is incorporated; the entity name and
state are not recorded in this handoff, so ask him rather than guess.

## Systems Summon would sit on top of

- **Repo:** `adamtpang/anchormarianas.com` (Next.js 15 App Router, Supabase, Vercel).
  Builds on `main` only; Vercel budget is $20/month total, so merge in batches.
- **Database:** Supabase project `anchormarianas` (`rxkzhehuzyyiyvuxhewa`), schema
  `anchor`. Not exposed on the Data API. Read-only role `command_ro` (select + RLS policy
  on `deals`, `buyers`, `matches`). Write path today is the Supabase MCP or NocoDB
  (`nocodb_rw`).
- **Key tables:** `deals` (sell side; listing columns from migration 0012), `buyers`
  (buy side, structured criteria), `matches` (v1 rows have `method like 'v1-%'`),
  `deal_box`, `seller_signals`, `buyer_wants`, `sources`, `tasks`, `decisions`,
  `outreach_queue`, `metrics`, `kpis`, `critical_path`, `agents`, `board`.
- **Private desk:** `/command` behind `requireCommandAdmin()`; shows the Top matches
  card (PR #134, live 2026-11-20).
- **Marketplace UI:** built and merged (PRs #125 to #133) but **off in production**
  (`MARKET_UI_V2` unset). Repo migrations 0004 and 0007 to 0011 are written but **not
  applied** to the live database; 0007 has a name collision. Adam decides the order.
- **Scripts:** `scripts/aggregation/broker-listings.mjs` (refresh active Texas listings
  from Accounting Practice Sales and accountingfirmsold.com, output outside the repo),
  `scripts/matching/build-matches.ts` (rescore), `lib/matching/score.ts` (rule).

## Data as of 2026-11-19 (counts only; leads never leave Supabase)

- Sellers with an active listing: **20** (APS 17 of 437 listed, 420 sold;
  accountingfirmsold.com 3). 7 are Sale Pending.
- Buyers: **127** (33 published criteria, 25 public wanted ads, 53 deal history only,
  16 unverified).
- Matches v1: **100** stored (best 5 per listing) of 1,687 scorable. Top score 90.
- Blocked sources: BizBuySell, BizQuest (Access Denied), DealStream (captcha),
  Transworld, Sunbelt, accountingbizbrokers.com, accountingbroker.com (403), ABA
  Advisors (terms forbid copying), Karbon, Searchfunder, LinkedIn, Facebook (login).
- Revenue: **$0**. Introductions made: **0**.

## Who does the work today

- **9 Grok Bot agents** on grok.com: Cofounder plus Anchor Sales, Operations, Finance,
  Legal, Engineering, Marketing, Design, Support (Maans is separate). Their output is
  synced for Claude by `Aether/.codex/grokbot-sync.py` into
  `anchormarianas.com/CLAUDE_CONTINUE_FROM_GROKBOT.md`, `~/.grokbot-sync/feeds/<date>/`
  and `~/.grokbot-sync/ledger.json`. Their own files live on their machines, not here.
- **Cursor cloud agents** open PRs on the repo.
- **Claude Code and Codex** sessions in `Aether/anchormarianas.com`.
- Shared hub was a Notion "Anchor HQ", moving to Supabase `anchor` + NocoDB.

These map one to one onto Summon's eight departments. Summon's job is to be the one board
and queue above them, not another worker.

## Hard rules Summon must enforce for Anchor

1. **No outbound as Adam without a per-message go.** Agents draft; Adam sends, or says
   "send this" after seeing the exact text and recipient. One consent, one message. See
   `Aether/CLAUDE.md`. Summon's outreach rows stay manual for Anchor.
2. **Leads stay in Supabase.** Never copy owner names, emails, phones or listings into
   Summon's database, git, logs or a public page. Summon reads counts and IDs.
3. **Introductions are consent-based.** Approved line: "Owners and buyers meet directly,
   once both say yes." Never write "no middlemen". A 90+ match leads to an introduction
   only with both sides' consent.
4. **Fees and commission wording stay `[CONFIRM:]`** until Legal clears Texas broker
   licensing. Make-offer stays behind a flag that is off.
5. **Free data only, respect robots.txt and terms, skip anything that blocks.** No
   captcha or bot-detection bypass. No new paid keys or signups without Adam.
6. **No production SQL, flag flips or merges without Adam.** Every schema change is a
   migration file; apply only on his go.
7. **Honest zero.** Never round up counts, revenue or "sent".

## The binding constraint (money formula: OFFER, REACH, CONVERT)

- OFFER: exists (consent-based introductions; fee terms unconfirmed).
- REACH: false link. Nobody on either side has been contacted. 20 sellers is thin.
- CONVERT: untested.

Single next physical action: **Adam reviews the top matches on `/command` and personally
contacts the first seller's broker and the first matching buyer.** Summon's first loop
should make that action easy, not replace it.

## Proposed first Summon loop for Anchor

1. Create company "Anchor" in Summon (or connect the existing record if one exists).
   Do not provision new repos, databases or Vercel projects: Anchor already has one of
   each, and the fleet rule is one site, one repo, one Vercel project.
2. Give the Operations employee read-only access through `command_ro` (connection string
   is Adam's to supply as a company secret; never commit it).
3. Weekly recurring task: run the listing refresh, diff against `anchor.deals`
   (new, status changed, gone), rescore, and post a receipt: counts, changes, top 10
   matches to review. Writes to the database go through an approval, not directly.
4. Daily: one "next three moves" proposal for Adam, constrained to the money formula's
   false link (REACH).
5. Done when: Summon has produced two weekly receipts with no rule violations and Adam
   has made the first consent-based introduction from one of them.

## Open decisions for Adam (do not decide for him)

- Apply order for repo migrations 0004 and 0007 to 0011, and the 0007 name collision.
- Whether to turn `MARKET_UI_V2` on in production.
- Texas broker licensing and fee wording (lawyer).
- Cofounder.co: pay $40/month or not (recommendation in this session: not now), and
  sending its support message to take down `app.anchor.cofounder.company`, which still
  shows the old Guam AI-agency pitch and names Hilton.
- Whether the old Grok Bot team keeps running alongside Summon or is folded into it.

## Grok Bot as an operator layer (research, 2026-11-20)

**What it is.** Grok Bot is made by xAI, now SpaceXAI after SpaceX bought xAI (Feb 2026)
and Cursor's maker Anysphere (about Aug 2026). Beta since 2026-08-11; download at
cursor.com/download/bot, Cursor sign-in, usage metered through Cursor or "The X
Subscription" tiers from a weekly pool. Each account gets one persistent cloud computer
(browser, files, terminal) that all its bots share, each bot on its own screen. Connectors
for Gmail, Calendar, Drive, Slack, Notion, any MCP server or API; skills, scheduled
routines, a Vault for logins and cards. Per-bot memory only; no company-wide memory.
Docs: https://docs.x.ai/grok-bot/overview,
https://docs.x.ai/grok-bot/approvals-security-and-privacy

**Evidence that it runs businesses: thin.** Every revenue claim found is self-reported
(Alex Finn's "$10k sponsorship in 4 hours", Salesforge's "38% reply rate"). xAI's own
72-hour bot-run company build shipped a game with 2,000 players and made **$0**; one
skipped approval took the live game down. No named bot-run company with verified
stranger revenue was found.

**What works for practitioners**
- One bot per narrow, recurring job with a reviewable output (briefs, receipts and
  invoices, CRM upkeep, drafts for approval).
- Do the task by hand once, save it as a skill, then schedule it (xAI's own docs say so).
- Few handoffs between bots; trigger specialists directly for routine work; wake bots by
  webhook, not hourly polling; move fixed steps into plain scripts.

**What breaks**
- Cost: inter-bot chatter re-reads shared docs and histories. One user with 21 bots spent
  $180 in a day; a brokerage user exhausted a $200 plan in 3 to 4 days.
- Reliability: routines missed or late, failed runs not replayed, duplicate client
  messages, bots overwriting a shared Google Sheet.
- Background approval cards expire after about 30 minutes and the task is dropped.
- Shared computer: every bot can use every saved login and Vault card; separate bots are
  not a security boundary. Instagram flagged automated posting.

**What this means for Anchor and Summon**
1. Anchor's 9-bot Grok team is the exact pattern that fails on cost and shared-state
   overwrites. Summon should be the single queue and memory above them, not a 10th bot.
2. Grok Bot accepts any MCP server, and Summon already ships one
   (`packages/mcp-server`: issues, approvals, documents). The cleanest integration is
   Grok bots connecting to Summon's MCP for their task queue and company memory, with
   Supabase `anchor` (role-scoped, RLS) as the data of record instead of a shared sheet.
3. Approvals must live in Summon, which does not expire them, not in Grok's 30-minute
   cards. Keep Grok's ask-first rules on for every send, and never save a payment card in
   its Vault.
4. Cut the roster: one Grok bot per proven recurring job (listing refresh, buyer-ad
   recheck where the site allows it, weekly receipt). Fold the rest until a job is proven
   by hand.

Sources: https://x.ai/news/introducing-grok-bot, https://docs.x.ai/grok-bot/faq,
https://docs.x.ai/grok-bot/troubleshooting,
https://venturebeat.com/orchestration/spacexais-grok-bot-turns-agents-into-persistent-digital-coworkers-that-can-operate-your-apps-for-120-per-month,
https://linas.substack.com/p/one-person-company-grok-bot,
https://www.blotato.com/blog/grok-bot-marketing-team,
https://aimaker.substack.com/p/grok-bot-ai-agent-team,
https://www.reddit.com/r/GrokBot/comments/1xembjd/running_about_20_grok_bots_as_a_team_and_burning/,
https://www.reddit.com/r/cursor/comments/1vxjipg/grok_bot_review/,
https://forum.cursor.com/t/grok-bot-status-on-auto-review-errors-and-related-platform-issues-oct-29-31/176847
