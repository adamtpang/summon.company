# P0-1: the five-minute close (for Anton's team, not for us)

P0-1 is the route-authorization finding: cockpit routes carried only
`isAuthenticated`, so a patient-portal login with an org context could read
other patients' data. It is the highest-severity row on the register, and it
is the one row Summon will never auto-close, because a wrong "closed" on a
PHI finding is worse than a stale register.

## What the code says today (origin/main c1b1701a2, 2026-08-01)

- RBAC gates on `persona-cockpits/controller.ts` went from 4 at the register
  commit to 11 today. Every route the finding named now carries
  `rbac: { permission: { bi: ["read"] } }` (`:146, 204, 229, 256, 328, 357`),
  and the hardening began in `5db025163` on 2026-07-14.
- The one exception: `/front-desk` carries
  `rbac: { permission: { scheduling: ["list"] } }` instead of `bi.read`.

## The one question only your team can answer

Is `scheduling:["list"]` on `/front-desk` intentional?

It looks deliberate: front-desk staff need the scheduling queue, not BI. But
the register asked for `bi.read` on that route by name, and a patient-portal
principal holding `scheduling:list` (if any patient role can hold it) would
still see the front-desk cockpit, which includes expected-revenue amounts.

- If intentional and patient principals can never hold `scheduling:list`:
  mark P0-1 closed. Everything else is already proven.
- If not intentional: one-line change to `bi: ["read"]` on that route, and
  P0-1 closes with it.

Either way the close takes five minutes, and it should be your five minutes,
not ours. An outside party marking a PHI finding closed is not a favor.
