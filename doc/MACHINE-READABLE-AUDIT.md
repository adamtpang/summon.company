# Audit: is a company machine-readable in Summon?

Run 2026-07-25 against the live control plane (7 companies, 154 agent
records) and all 100 tables in `packages/db/src/schema/`. Standard borrowed
from Tobi Lutke's Shopify OS: you can only reconcile what you can compute.
Anything that lives as prose cannot be diffed, ranked, or held to a desired
state.

## Verdict

Summon is fully machine-readable about what agents DO, and mostly prose
about what the company IS.

## Machine-readable and populated

| Dimension | Where | Evidence |
|---|---|---|
| Org chart | `agents.reportsTo` (real FK, indexed) plus `metadata.department` | 154 agent records; department set on 51, which is every real department head across all 7 companies. Only built-in agents (Reflection Coach) lack one, correctly |
| Work | `issues` plus labels, relations, approvals, outcomes, work products, plan decompositions | 268 issues on Summon alone |
| Money out | `budgetMonthlyCents` and `spentMonthlyCents` per company AND per agent, `cost_events`, `budget_policies`, `budget_incidents` | Every company populated; per-agent budgets set (Sellsniper Finance capped at $10/mo) |
| Runtime | `heartbeat_runs`, `environments`, `execution_workspaces`, `policy_ledger`, `activity_log` | Live |
| Repos | `project_workspaces.repoUrl` | Summon 4/4, Regain 4/4, Acme 3/3, Quantus 1/4; Anchor, Sellsniper, skill.supply have no projects at all |
| Documents | `documents`, `document_revisions`, annotation threads | Live |
| Secrets | `company_secrets` and per-company bindings | Live |
| Outside objects | `external_objects` plus the GitHub provider | GitHub only |

## Prose or missing (the business half)

| Gap | Status | Board |
|---|---|---|
| Roadmap stage | No column in any of the 100 tables. Lives in `doc/COMPANY-ROADMAP.md` | SUM-269 |
| Binding constraint | No field. Lives inside agent instruction markdown as a sentence | SUM-269 |
| Business model | Computed by the landing diagnose API per request, never stored | SUM-269 (same shape) |
| Revenue | `finance_events` exists (eventKind, amountCents) but `/companies/:id/finance` 404s; companies expose spend only | SUM-270 |
| Offers and prices | `subscriptions` table exists (basePriceCents, billingInterval, outcomeMetric) but `/companies/:id/subscriptions` 404s; the real $1,500 and $990 offers live in markdown and Stripe | SUM-270 |
| Customers and deals | No table anywhere. Anton, Joe, Michael exist only in files and Stripe | SUM-271 |
| Department wiring | Correct but stored in unconstrained jsonb: no column, no index, no one-head-per-department rule | SUM-272 |
| Knowledge sources | No connector rows; departments cannot read a customer's Notion or vault | SUM-263 |
| Company identity | `brandColor` 0/7, `logoUrl` 0/7, Anchor has no description | onboarding papercut |
| Goals | 1 to 2 per company; Regain, skill.supply, and Acme have none | onboarding papercut |

## Why this matters

The Summon algorithm is a desired-state reconciler: surface what is, compare
to what should be, take the minimum steps. Today it can reconcile the org
tree and the work queue because both are computable. It cannot reconcile
stage, constraint, revenue, or customers, because those are sentences. Every
diagnosis that touches them is re-derived by hand and cannot be verified
later.

The fix order is the board order: SUM-269 (stage and constraint), SUM-270
(money in), SUM-271 (customers), SUM-272 (department as a column), which
together are the prerequisites for the org reconciler in SUM-267.
