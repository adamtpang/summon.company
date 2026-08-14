# The first 30 minutes

Written 2026-08-01 for step 4 of the fleet-ready pass. The goal of this document
is narrow and testable:

> A new customer reaches "the board told me something useful" without Adam
> driving the session.

Every step below was run against the live product on 2026-08-01. Where something
is friction, it says so rather than pretending.

## The one thing that matters

Value lands in **minute one, before any install**, at
[summon.company/diagnose](https://summon.company/diagnose). Do not lead a new
customer with a download. Lead with the diagnosis.

Verified live on 2026-08-01. Pasting a two sentence description of a small
agency returned:

- the business restated in one line, correctly
- its stage on the 8 stage roadmap (stage 7, "Operate and close") with a reason
- **the one binding constraint**, named specifically, not generically
- a precedent founder and the lesson to steal
- the business model classification and a concrete first move

That output is the product's whole promise in 60 seconds. Everything after it is
installation.

## Minute 0 to 2: the diagnosis (no install)

1. Go to https://summon.company/diagnose
2. Paste a URL or two sentences about the business.
3. Read the constraint.

Stop here and check: **did the board tell you something useful?** If the answer
is no, nothing downstream fixes that, and the honest move is to say so and fix
the diagnosis, not to push the install.

## Minute 2 to 10: get the runtime

Two supported paths.

**Windows, no terminal.** Download
[Summon.Setup.0.1.5.exe](https://github.com/adamtpang/summon.company/releases/download/v0.1.5/Summon.Setup.0.1.5.exe)
(80 MB) and run it.

> Known friction, tell them before they hit it: the installer is unsigned, so
> SmartScreen will warn once. More info, then Run anyway. If a customer will not
> click through that, use the terminal path instead.

**Mac, Linux, or Windows with a terminal.**

```bash
npx paperclipai onboard --yes
```

> Known friction: the command still carries the upstream `paperclipai` name, not
> `summon`. A customer will ask why. The answer is that Summon is built on the
> open source Paperclip engine and the rename has not reached the CLI yet. Say
> it plainly; it reads as honest rather than sloppy.
>
> If it fails with `E404` on a private npm registry, see the troubleshooting
> block in README.md.

The command center opens at `http://127.0.0.1:3100`.

## Minute 10 to 20: import the company

1. Point Summon at what already exists: the repo, the site, the docs.
2. Summon reads it before any employee works. This is the context file, and it
   is the part that makes the output specific instead of generic.
3. Confirm the diagnosis from minute 1 against the imported reality. It should
   get sharper, not vaguer.

## Minute 20 to 30: one assignment, one approval

Do not staff all eight departments on day one. Staff the one department that
owns the constraint.

1. Assign one issue to that department.
2. Watch it work. Budget caps mean it pauses rather than surprises you.
3. **Approve something.** The approval gate is the product. A customer who has
   not approved anything has not met the product yet.

Success at minute 30 is not a shipped feature. It is: they saw the constraint,
they assigned one job, and they clicked approve once.

## What to do when it stalls

| Symptom | Real cause | What to say |
| --- | --- | --- |
| SmartScreen blocks the install | Unsigned beta binary | Expected. More info, Run anyway, or use the terminal path. |
| `npx paperclipai` 404s | Private npm registry in `~/.npmrc` | README.md troubleshooting block, force the public registry. |
| "Why is it called paperclipai?" | Upstream engine name, rename incomplete | Built on the open source Paperclip engine. Being renamed. |
| Runtime will not start against an existing database | The S0 blocker in CLAUDE.md: this checkout's migration journal is not compatible with the packaged runner's database | Do not point source at the live database. This is a known internal blocker, not their fault. |

## The honest gap

The whole path above works, but it has never been walked end to end by a
stranger without Adam in the loop. **Anton will be the first test of this
document.** If he stalls, the stall point is the thing to fix next, and it goes
in EVIDENCE.md as a real number, not as an excuse.

The single highest-leverage improvement available: make minute 0 to 2 lead every
customer conversation, since it is the only step verified to deliver value with
zero setup cost.
