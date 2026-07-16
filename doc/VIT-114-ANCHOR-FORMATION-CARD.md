# VIT-114 — Anchor formation decision card

Date: 2026-07-16. Owner: Vitals COO. Board: Adam.

## The decision

**Staff the Anchor formation? [8 employees, $80/mo total cap]**

Anchor (`ANC`, company `bc84673c-689c-4b9f-842e-fe722eeac04c`) has zero agents and
is currently **archived**. Accepting this card means, in one decision:

1. Reactivate Anchor.
2. Staff the core-8 formation: one employee per department, each capped at
   **$10/mo**, **$80/mo total**. Every seat gets the department instruction
   template and an empty optional GOAT persona slot (VIT-42).

Nothing is created and nothing can spend before the board accepts. Rejecting
leaves Anchor exactly as it is (archived, zero agents).

## The eight seats

| Seat | Title | Owns | Cap |
| --- | --- | --- | --- |
| Engineering | Head of Engineering | Product execution, software, infrastructure, integrations, reliability | $10/mo |
| Design | Head of Design | Identity, product experience, marketing site, visual and interaction quality | $10/mo |
| Marketing | Head of Marketing | Positioning, content, acquisition, referrals, demand generation | $10/mo |
| Sales | Head of Sales | Prospecting, qualification, pipeline, proposals, closing | $10/mo |
| Finance | Head of Finance | Pricing, billing, bookkeeping, budgets, cash, runway | $10/mo |
| Operations | Head of Operations | Company setup, standards, workspaces, process, operating cadence | $10/mo |
| Support | Head of Support | Onboarding, service, community, feedback, retention | $10/mo |
| Legal | Head of Legal | Incorporation, contracts, privacy, compliance, risk | $10/mo |

Product is not a ninth seat: the CEO owns product strategy, Engineering owns
product execution.

## Declining seats

The board may decline any seat by rejecting with the department name and the
named human who owns it instead (e.g. "decline Legal — human owner: Adam
Pang"). Declined departments stay empty with the documented human owner; the
remaining seats are staffed.

## Why this card exists

Board directive (2026-07-16): "every org should start with the core 8
departments/employees." VIT-114 makes the eight-department formation the
default at birth — the engine now seeds eight `pending_approval` employee
proposals plus exactly ONE `staff_formation` approval on every company
creation and import (commit `28a57ce22`). The live packaged runtime predates
that change (rollout rides the VIT-14 cutover), so Anchor — the retrofit test
case — gets its formation through this card instead: accept, and the COO
staffs it through the live API in one shot.
