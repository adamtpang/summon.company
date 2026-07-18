# The MVP scoreboard: when running the company inside Summon just works

Board rulings baked in (2026-07-17): **Claude Code is for codebases. Summon is for
companies. They are aligned, not in opposition** — Claude Code is the pair-programmer
that builds Summon; Summon is where the companies run. Customers bring their own
Claude/Codex subscriptions as fuel, same as the board does. Plain language only: no
"gates", no G-numbers without their names.

History: the first version of this doc (2026-07-16) framed Claude Code as the enemy to
beat. The board overruled that framing on 2026-07-17. The seven measures below are the
same ones — renamed in plain English — because they still describe what "running a
company in Summon feels tight" means.

## The seven measures (the MVP progress bars)

Formerly G1–G7. Each is one sentence you can test.

| # | Name | Passes when |
|---|---|---|
| 1 | **Message loop** (was G1) | You message any employee; the right one answers in under 10 seconds and you watch the work stream live in that chat. |
| 2 | **Memory** (was G2) | Reopen any chat days later — the employee remembers everything; you never re-explain. |
| 3 | **Proof in the chat** (was G3) | Screenshots, diffs, and files show up inside the conversation. You never hunt for a file path. |
| 4 | **One-tap decisions** (was G4) | Every approval arrives as one card; a yes is one gesture; the median decision takes under 10 seconds. |
| 5 | **No silent failures** (was G5) | Work never dies quietly. A usage-limit wall shows "paused — resumes at 6pm", never an error black hole. |
| 6 | **One-glance dashboard** (was G6) | The dashboard answers "how is my company doing?" in 10 seconds. |
| 7 | **Works while you sleep** (was G7) | You wake up to real, evidenced overnight work, and the CEO files useful tasks you never asked for. |

## Where each measure stands (2026-07-17)

The old doc tracked two numbers per measure — "in source" (code written) vs "installed"
(what the running app had) — because the running app was an old package. **That split is
over: on 2026-07-16 the running server was switched to the current code, and on
2026-07-17 the reboot trap that kept silently undoing that switch was closed**
(`scripts/start-summon.cmd`; the desktop app's fallback used to boot the old package
after every reboot). What the code has, the app now has.

What remains per measure is mostly *proof*, not code:

| # | Measure | Built | Still to prove or finish |
|---|---|---|---|
| 1 | Message loop | Global composer dispatches to the right employee and opens the live thread | Time it for real: one prompt, stopwatch under 10s |
| 2 | Memory | Per-chat resume for Claude/Codex with fallback | The 48-hour reopen test on real threads |
| 3 | Proof in the chat | Screenshots/markdown/files render inside the thread | One real run observed end-to-end |
| 4 | One-tap decisions | Decisions is a one-card deck with one-gesture actions | Measure a real median decision time |
| 5 | No silent failures | Watchdog, quota windows, failover, "paused — resumes at" copy | A real quota wall observed showing the friendly state |
| 6 | One-glance dashboard | Mission Control built over real data — **and live**: /dashboard renders it (verified 2026-07-17 during the wizard's end-to-end test) | The 10-second test on real data |
| 7 | Works while you sleep | Overnight heartbeat + CEO self-diagnosis runner exist and have filed real tasks | CEO's model config still mismatched (old cheap-model setting); apply the corrected bootstrap, then three good mornings |

## The acceptance week (unchanged, plain words)

One week where all seven hold at once, on real work:

1. Prompts from the composer get the right employee in <10s, work streams, results land
   in the same thread with proof. (1+3)
2. Reopening any thread after 48h needs zero re-briefing. (2)
3. Every decision is a card; median under 10 seconds. (4)
4. Zero silent failures all week; any usage wall shows "paused — resumes at <time>". (5)
5. The dashboard answers "state of the company?" in 10 seconds. (6)
6. On 3+ mornings there is useful, evidenced overnight work and at least one CEO-filed
   task the board agrees mattered. (7)
7. Sanity check: one identical task run in Summon vs Claude Code costs at most 2x the
   board-minutes — while Summon also runs 5+ other lanes in parallel.

## Division of labor (aligned, not versus)

- **Claude Code** = the cofounder's tool for building Summon itself: deep seams, test
  lockstep, migrations, pre-verifying the review queue.
- **Summon** = where companies run: parallel owned lanes with evidence, decisions,
  overnight work, institutional memory across companies (Summon, Quantus, Anchor, …).
- **The board** decides: reviews, decisions deck, and pointing one employee at one
  S-tier task at a time (Manual mode default; 24/7 mode is opt-in with a budget).

## What ships next (one at a time)

Status 2026-07-18 — the build list is DONE:
1. ~~First-run wizard (fuel-first, repo pairing)~~ SHIPPED + proven live (d5bca219f;
   clone-on-first-run fixed in 67098c29a).
2. ~~Mission Control wired~~ — was already live; verified during the wizard test.
3. ~~Control room~~ SHIPPED: kill switch + RUNNING NOW panel (280576ffb), Manual/24-7
   modes with Manual as the product default (bc1532b5b), CEO Surface/Triage/Route
   skill installed in the live CEO (534b4a8ac).

What remains is CONTACT WITH REALITY, in order:
1. **Founding offers out** to Anton (Regain — company staged, REG-1 blocked on his
   repo URL) and Michael (Hawaii Tech Week — first answer: software org or not?).
   SUM-137 is the top of the queue.
2. **Run the acceptance week** (section above) as the dogfood while the first two
   design partners onboard.
3. Distribution engine only after both are live: Discord seeding (SUM-131),
   KOL outreach (SUM-132), SEO lane (SUM-134).

Deferred until after: personas polish, iOS, users lane, model-picker beyond the pit
stop, leaderboard, AI SDR, deeper UI reduction runs.
