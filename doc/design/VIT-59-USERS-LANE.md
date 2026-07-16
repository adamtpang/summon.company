# VIT-59 — Users lane: user conversations in the same chat inbox as employees

Status: spec, written 2026-07-15 by Vitals CMO. Implementation is sequenced AFTER
VIT-41 ships its employee inbox (VIT-41 was `in_progress` at time of writing;
`ui/src/pages/Messages.tsx` is an explicit draft-only prototype whose transcript is
local state, pending the VIT-40 continuity backend).

## Why

NORTH_STAR "The interface" doctrine: the founder's job is two conversations — users
and AI employees. VIT-41/57/40 build the employee half. This spec covers the users
half, starting with the narrowest real channel: email. No channel zoo (per
`doc/research/OPENCLAW-LEARNINGS.md`): one more channel only after email works
end-to-end.

## Channel evidence (2026-07-15)

- The board's connected Gmail account is `adamtpangelinan@gmail.com`.
- A 90-day search of that account for anything vitals/summon/waitlist-related
  returned only Vercel receipts — **zero inbound user emails**.
- No dedicated `support@`/`hello@` address exists on the connected account, and
  neither vitals.run nor summon.company publishes one.

Consequence: the acceptance test ("a real user email appears as a thread") cannot
run until a support/hello address exists and is published where users can find it.
That prerequisite is NOT blocked by VIT-41 and is tracked as its own child issue
(owner: CMO; publishing to the live site is a board-approval gate).

## Flow spec (maps 1:1 to the acceptance criteria)

1. **Ingest** — inbound mail to the support/hello address lands in the board's
   Gmail under a dedicated label (proposed: `Summon/Users`). The control plane
   surfaces each Gmail thread as a thread in a **Users** section of the same
   Messages inbox VIT-41 ships. Users lane sits beside the employee lane; same
   bubble/thread UI, different left-rail section.
2. **Draft** — the Support employee (or the CEO pre-hire) reads the thread and
   drafts a reply. Mechanically: a Gmail draft created in the board's own account
   (the agent never sends). The draft renders in the thread as a pending bubble.
3. **Approve** — the board approves in the inbox (existing approval/interaction
   machinery, e.g. `request_confirmation`). Approval writes an audit event
   (issue/audit log entry recording who approved what draft for which thread).
4. **Send** — the board sends the approved draft **from their own account**.
   Thread sync picks up the sent message, so the full exchange is readable in the
   Users lane afterward.

Design invariants:

- The agent drafts; the board sends. No agent-initiated outbound to users.
- Email is the only channel until this loop works end-to-end.
- Additive UI: a Users section in the VIT-41 inbox, no new top-level surface.

## Sequencing

1. (Unblocked, CMO) Stand up the support/hello address, wire vitals.run /
   summon.company contact points to it, confirm a real test email lands. Board
   approves anything published on the live site.
2. (Blocked on VIT-41) Users lane UI in the shipped Messages inbox.
3. (Blocked on 1+2) Draft → approve → send loop with audit event; run the
   acceptance test on a real user email.
