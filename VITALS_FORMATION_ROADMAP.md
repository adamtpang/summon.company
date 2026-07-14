# vitals.run formation and roadmap

Canonical product specification for VIT-12 and VIT-13.

## Eight departments

| Department | Guide | Mode | Ownership |
| --- | --- | --- | --- |
| Engineering | Elon Musk | Builds | App, auth, email, monitoring, billing infrastructure, and integrations |
| Design | Jony Ive | Builds | Brand identity, marketing website, and product experience |
| Marketing | Alex Hormozi | Sells | Positioning, social, content, SEO, paid acquisition, and referrals |
| Sales | Ryan Serhant | Sells | Prospecting, outbound, qualification, pipeline, and closing |
| Finance | John D. Rockefeller | Runs | Banking, bookkeeping, budgets, billing, cash, and runway |
| Operations | Jeff Bezos | Runs | Company setup, repositories, domains, process, and operating cadence |
| Support | Tony Hsieh | Runs and sells | Community, onboarding, support, and customer feedback |
| Legal | Open summon | Runs | Incorporation, contracts, compliance, privacy, and risk |

A CEO agent sits above the departments as the orchestrator. The human remains the
board and approves high-risk work.

## Eight roadmap stages

1. **Initial idea**: define the product and outcome.
2. **Found it**: choose a company name, prepare the repository, and incorporate.
3. **Identity**: create the brand, buy the domain, establish positioning and social
   presence, and open the bank account.
4. **Build**: build the product, auth, email, marketing site, outbound system,
   prospect list, social connections, and bookkeeping.
5. **Distribute**: publish content, grow social, send outreach, and run paid acquisition.
6. **Launch**: launch the app and site, expand content, and qualify opportunities.
7. **Operate and close**: add monitoring, SEO, community, closing, onboarding,
   billing, and customer support.
8. **Scale**: launch referrals, complete legal and compliance work, and integrate
   the support chat surface.

## Product behavior

- Formation shows all eight departments, the CEO orchestrator, staffing health,
  budget pressure, and exactly one highlighted constraint.
- Roadmap shows all eight stages and their real tasks. The least-complete unblocked
  stage is the current critical-path constraint.
- Every task has one department owner and one execution state.
- Task blocks distinguish `Agent can do this`, `Needs your input`, and `Needs earlier
  steps first`.
- Incorporation, banking, external outreach, and similarly high-risk actions require
  explicit board approval.
- vitals.run runs this roadmap on itself so product progress is visible dogfood.

## Implementation boundary

Build additively on the Paperclip fork. New Vitals routes may interpret existing
agent metadata and tasks, but must not rename Paperclip packages, environment
variables, API contracts, or protocol surfaces.
