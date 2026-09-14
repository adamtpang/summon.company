# Fleet analytics ownership proposal

Date: 2026-09-06. Historical proposal; September 7 local implementation follow-up below.

September 7 update: the delegated all-sites request authorized a reversible
private local slice. Implemented in `tmp/fleet-integration/`: 16-site disconnected
inventory, sortable 7/30-day traffic view, exact-project Vercel GET adapter and
local-only endpoint. See that checkout's
`doc/plans/2026-09-07-private-fleet-analytics.md` for preview, tests, connection
contract and limitations. No actual provider counts or collection verified.
The proposal below remains broader than this implementation; hosted connection
storage, enumeration and additional provider adapters remain pending.

## Recommendation

Summon should own the coverage inventory, private reporting, evidence freshness,
and the task that fixes each coverage gap. Start with a read-only Vercel adapter
and three representative sites. Reuse existing instrumentation before considering
a new collector. Current official documentation supports this approach: Vercel
has a public Web Analytics query API.

## Evidence in this repository

The outer checkout is older than the newer Fleet source. The latter was preserved
inside `tmp/fleet-integration/` during the prior integration. Findings below refer
to that inspected snapshot, not a claim about today's deployed service:

- `packages/shared/src/types/company-website.ts:55`: provider configuration and
  website identity already include company, external project, team, domain,
  accountable agent, secret reference, granted scopes, and evidence.
- `server/src/routes/company-website.ts:105`: existing website routes enforce
  company access. `server/src/services/company-website.ts` manages deployments,
  domains, health, and receipts; it does not supply visitor/pageview reporting.
- `server/src/routes/aether-portfolio.ts:26`: a board portfolio endpoint exists.
  `server/src/services/aether-portfolio.ts:492` consumes repository/URL identity
  from Lightmark. A diagnosis score is not visitor analytics or demand proof.
- `server/src/services/company-social.ts:1971`: analytics refresh, freshness,
  provider-plan errors, and receipts exist for social posts. Reuse the pattern,
  not its metrics or provider identity, for websites.
- `server/src/services/aether-codebase-diagnostic.ts:391` recognizes analytics
  documents as evidence. This is not a live website analytics connector.
- Searches of services and shared contracts found no Vercel Web Analytics,
  Cloudflare RUM, GA4, Plausible, or PostHog website-query adapter.

The earlier fleet configuration audit is historical evidence only. This task did
not read current provider accounts, inspect instrumentation across other repos,
or verify current event collection. Existing Focus changes remain intact.

## Supported provider paths, checked September 6

| Path | Verified capability | Consequence |
| --- | --- | --- |
| Vercel Web Analytics API | GET `/v1/query/web-analytics/visits/aggregate` and `/events/aggregate`; count endpoints also exist. Visits expose visitors/pageviews; events expose count/visitors. Date ranges and path/referrer grouping are documented. | Preferred first adapter; no private dashboard endpoint or invented fleet aggregation API. Query exact projects, then combine locally. [Guide](https://vercel.com/docs/analytics/web-analytics-api), [endpoint contract](https://vercel.com/docs/rest-api/web-analytics/aggregates-page-views). |
| Vercel inventory | GET `/v10/projects`, paginated, includes Web Analytics enablement metadata and `hasData`; project-domain listing is documented. | Capture configuration separately from recent collection. `hasData` alone is not proof for a selected date range. [Projects](https://vercel.com/docs/rest-api/projects/retrieve-a-list-of-projects), [domains](https://vercel.com/docs/rest-api/projects/retrieve-project-domains-by-project-by-id-or-name). |
| Vercel CSV | A dashboard panel exports up to 250 entries. | Manual, bounded fallback with source, filters, range, and truncation recorded; never assume a complete event export. [CSV documentation](https://vercel.com/docs/analytics/using-web-analytics). |
| Vercel Drains | Analytics drains export pageviews/custom events; Pro or Enterprise required, not Hobby or Pro Trial. Published charge is $0.50/GB. | Optional later ingestion; unnecessary for the first private reporting slice and requires separate setup/cost approval. [Drains](https://vercel.com/docs/drains), [analytics schema](https://vercel.com/docs/drains/reference/analytics). |
| Cloudflare | RUM site configuration has a read API; GraphQL exposes analytics, including RUM datasets. Sampling and account/dataset limits apply. | Second adapter only for already-connected sites. Keep RUM pageviews distinct from edge requests; do not invent unique visitor or custom conversion support. Discover actual schema/limits with approved access. [RUM API](https://developers.cloudflare.com/api/resources/rum/), [GraphQL](https://developers.cloudflare.com/analytics/graphql-api/), [sampling FAQ](https://developers.cloudflare.com/web-analytics/faq/). |

Vercel's current pricing table lists unlimited projects, 50,000 monthly events on
Hobby, and $0.03/1,000 events on Pro with no included events listed. Reporting
windows are one month on Hobby, 12 on Pro, and 24 with Plus/Enterprise. Custom
events require Pro or above; Plus adds $10/team/month. Collection may pause at
limits. The page contains inconsistent Hobby resumption wording, so report actual
account status rather than promising a resumption date. No account plan or paid
entitlement was checked here. [Pricing](https://vercel.com/docs/analytics/limits-and-pricing).

Cloudflare currently limits non-proxied Web Analytics sites to 10, while proxied
sites have no site-count limit. Its dashboard aggregates at most 1,000 websites
at once. This is not a reason to change DNS or proxy configuration as part of
analytics intake. [Limits](https://developers.cloudflare.com/web-analytics/limits/).

## Coverage must be evidence, not a green toggle

Store separate fields rather than one overloaded status:

| Field | Meaning and required proof |
| --- | --- |
| Enabled | Current provider configuration; observed timestamp and account/project scope. |
| Instrumented | Deployed script or SDK observed and attributed to a deployment. A package in source is weaker evidence. |
| Receiving events | A recent provider result proves collection in a stated interval. Show latest event bucket, not an invented exact timestamp. |
| Zero observed traffic | Successful complete query returned zero for a valid covered interval. It does not prove that all visits would have been captured. If instrumentation/collection health is unknown, keep that uncertainty visible. |
| Unavailable | Missing access, unsupported metric, plan denial, retention expiry, disabled collection, rate limit, or provider error; preserve the reason. Never coerce null to zero. |
| Freshness | Last attempt, last success, requested interval, actual covered interval, and last observed event are distinct. A newly imported old CSV is still old evidence. |

## Inventory and reporting contract

Use `(provider, account/team ID, project/property ID)` as the provider identity,
mapped explicitly to `companyId` and `websiteId`. Enumerate all pages of approved
accounts and reconcile with existing website and repository links. Retain unmapped
and conflicting records for review. A repository can have multiple projects.

Normalize host casing, IDNs and trailing dots. Keep canonical, www, provider,
redirect, preview, and retired domains as aliases with provenance. Do not merge
on display name or strip www without a verified mapping. Count each project's
production traffic once; domain aliases are not additional sites or totals.
When a project serves multiple distinct businesses, require an explicit split
and a supported filter, or show project-level data with the limitation.

Propose company-scoped analytics connection, coverage observation, and snapshot
records in the existing database. Each snapshot carries metric definition,
provider/project, timezone, requested/covered range, dimensions, collection time,
sampling/completeness flags, and a receipt reference. Repeated fetches upsert the
same query interval; they never append duplicate totals.

The private Fleet analytics view should provide 7-day, 30-day, and custom ranges;
per-site visitors, pageviews, trends, referrers, top pages, and configured conversion
events; and an always-visible coverage denominator. Include source links and
freshness. Keep Speed Insights as performance evidence, separate from traffic.
Count an event as a business conversion only with a named definition. A form or
checkout click is not a payment; paid outcomes need an authoritative receipt.

For the first release, label summed visitors as a sum of per-site visitor counts,
never unique people across the fleet. Do not add daily unique counts and relabel
them as monthly uniques. Preserve provider semantics and top-value truncation
(including Vercel's `Others`). Compare equal intervals and explicit production
filters; disclose incomplete current-day data and retention gaps.

## Smallest working first slice

1. Add a bounded, server-side Vercel read adapter using existing secret references.
   Only allow documented inventory and analytics GET endpoints. Apply timeouts,
   pagination, cached query keys, low concurrency, and 429 backoff. Do not expose
   tokens to UI or logs. Validate responses and retain partial results on failure.
2. Import approved project/domain identities into a coverage ledger. Select three
   existing sites: receiving data, an empty interval, and missing/disabled coverage.
   Use fixtures for missing cases if real accounts do not contain them.
3. Add a private analytics view beside Fleet with per-site traffic, top pages,
   referrers, supported events, and explicit gaps. Propose an hourly refresh and
   daily inventory reconciliation; do not create a schedule until implementation
   and access are approved. An on-demand refresh is sufficient for acceptance.
4. Compare one fixed interval with the provider dashboard/export. Test pagination,
   duplicate aliases, foreign-company denial, zero versus unavailable, expired
   ranges, 402/403/429, malformed responses, partial failures, timezone boundaries,
   and idempotent refresh. Prove no write-provider calls and no secret leakage.

Fleet aggregation must authorize the caller for every included company, not rely
on a board role alone in a hosted multi-tenant deployment. Require authenticated
access, scoped exports, and private cache responses; no public share URL. Store
aggregates first and exclude raw visitor identifiers, query strings, and custom
event properties containing personal data.

## Ownership, access, and next decision

Proposed accountable implementation owner: Summon CTO / Engineering, with one
named engineer on the implementation task. Marketing defines conversion meaning;
Operations owns coverage review. These are proposed responsibilities, not agent
activation or staffing approval.

Missing evidence/access: approved provider account scope, a usable secret reference
with least available read access, actual plan entitlement, exact website mappings,
and one current provider comparison. Never paste credentials into this document.
Cloudflare access is not required for the first Vercel slice. No new collector,
paid drain, or tracking deployment is necessary to begin read-only implementation.

Next human decision: select the pilot account/sites and approve this bounded
read-only slice. Next implementation action after that decision: add the Vercel
adapter and fixture-backed coverage contract in the newer Fleet source. Preserve
the existing repository-readiness and Fleet command work; this proposal does not
silently start or supersede either.

Validation this turn: source/contract inspection and current official provider
documentation only. No live provider request or event-collection test was run.
No analytics implementation exists yet. Prior Focus tests and the incomplete
repository-wide run do not validate this proposal's future adapter.
