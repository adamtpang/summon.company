# The company context gatherer: step one of diagnosis

Status 2026-08-14: **built, tested, run live against two real companies.**
Not wired into `/diagnose` or onboarding yet.

## What it is

Given a domain, pull everything the public web will give up for free before
any human talks to the company: the homepage, the sitemap, robots.txt, a
handful of high-signal pages (pricing, about, team, contact, blog, careers),
every `application/ld+json` structured-data block, and contact/org signals
(emails, phones, social links, a schema.org address).

This is deliberately upstream of judgment. It gathers facts with sources; it
does not decide what they mean. The four-check analyzer (SUM-297: stage
placement, price visibility, proof ladder, conversion path) consumes this
output as its evidence base instead of a human running WebFetch by hand each
time, which is what produced every diagnosis this session before today
(Salomatic, Quantus, Hawaii Tech Week, SuperBlond, SitesGo, Diary of
Maanasa).

Read-only, always. Nothing here writes to or interacts with the target site
beyond a normal page fetch with a declared user agent.

## Why build this instead of continuing to do it by hand

Two things happened on the first two live runs that a human doing this by
WebFetch would not have caught:

1. **SitesGo's pricing was found, with real numbers**, where my own manual
   pass earlier this session reported "no pricing visible." The gatherer
   followed the sitemap-confirmed `/pricing` path directly: Quick Build
   $900, Standard Build $2,200, Custom Build $2,600+.
2. **Hawaii Tech Week's crawler-block claim needed correcting.** My earlier
   diagnostic said the site "blocks automated readers (HTTP 403)." A direct
   fetch with a normal user agent returned 200. What is actually true and
   checkable: `robots.txt` disallows crawlers for the wildcard and known-bot
   user agents, a real and ethical signal, just not the same claim as a
   blanket 403. The gatherer also surfaced something my manual read missed
   entirely: 33 pages under `/handbook`, a real content area.

Both are the same lesson: hand-run, one-shot lookups are exactly as good as
whichever pages a human happened to click, and exactly as precise as
whatever a summarizing tool chose to report. A systematic gatherer with a
declared, tested extraction layer is neither.

## What it gathers, concretely

| Signal | Source | Example from the live runs |
|---|---|---|
| Homepage title, description, generator | `<title>`, meta tags | SitesGo: "Idea to Website in 14 Days"; generator unknown (custom build) |
| Sitemap shape | `/sitemap.xml`, one level of sitemap-index recursion | SitesGo: 66 entries, 60 under `/blog`. HTW: 49 entries, 33 under `/handbook` |
| Crawler posture | `robots.txt` | HTW disallows crawlers for known bots; SitesGo does not |
| Secondary pages | sitemap-confirmed paths first, common guesses as fallback | SitesGo `/pricing` found via sitemap and fetched directly |
| Structured data | every JSON-LD block, typed | SitesGo: Organization. HTW: Organization, Event, FAQPage |
| Org signals | mailto/tel links, visible-text email/phone patterns, known social hosts, schema.org PostalAddress | HTW: 3 emails, 4 social platforms, "Honolulu, HI, US" from real markup |
| Fetch errors | every failed or non-2xx fetch, kept as evidence | Empty on both runs; a 403 or timeout would appear here rather than being silently dropped |

## What it deliberately does not do

No LinkedIn, no Crunchbase, no funding or headcount data: those require paid
APIs or logins this gatherer does not have, and guessing them would violate
the same anti-fabrication rule as everything else in this repo. No GitHub
org membership lookup yet, though the existing `github-external-object-provider.ts`
pattern is the natural place to add it when a domain links a GitHub org
(Regain does; most companies don't). "Org" in the deepest sense (headcount,
department structure) mostly isn't public, and the gatherer says so by
absence rather than inventing it.

## Files

- `packages/shared/src/types/company-context.ts`: the shapes.
- `server/src/services/company-context-extract.ts`: pure functions (HTML/XML
  in, facts out), fully unit-tested without network, 20 tests.
- `server/src/services/company-context.ts`: the fetch orchestrator. One
  homepage fetch feeds the snapshot, structured data, and org signals, so a
  full gather costs roughly 1 (homepage) + 1 (robots.txt) + 1-2 (sitemap,
  with one level of index recursion) + up to 6 (secondary pages) requests.
- `scripts/company-context.ts`: CLI, human-readable or `--json`.
- `outbound/company-context-proof/`: the two live runs, saved as evidence.

## Next: wiring it in

1. **Feed SUM-297** (the four-check analyzer) from this gatherer's output
   instead of ad hoc WebFetch calls, so every future `/diagnose` submission
   and every company onboarding gets the same systematic pass.
2. **Correct `outbound/diagnostic-hawaiitechweek.md`**: the "HTTP 403" claim
   should read "robots.txt disallows crawlers," which is the defensible,
   checkable version of the same finding.
3. **`/diagnose` route**: call `gatherCompanyContext` server-side when a
   URL is submitted, instead of relying only on what the user types into
   the form.
4. **Company onboarding**: the repo connector already exists (SUM-129);
   this is the same idea for a company's public web presence, run once at
   import and re-run on demand.
