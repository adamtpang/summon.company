# Connectors: how a company plugs its real life into Summon

Claude Code connects to a codebase. Summon connects to a COMPANY, and a
company is more than its repos: its knowledge lives in Notion or Obsidian,
its money in Stripe, its customers in a CRM, its work in GitHub. A connector
is how one of those becomes something Summon's departments can read, cite,
and act on.

Rule of the house: a connector never becomes a second copy of the truth.
It reads the customer's system where it lives, cites it with a link, and
writes back only where the customer allows it.

## What already exists (do not rebuild)

- **Plugin runtime**: `packages/plugins/sdk` plus the plugin host services in
  `server/src/services/plugin-*.ts`. Plugins are the extension point; they
  run in a worker, declare capabilities, and are validated at load.
- **External objects**: `server/src/services/external-objects.ts` resolves
  outside things (a pull request, an issue, a ticket, a doc) into first-class
  objects agents can attach to a task. Providers implement
  `detectExternalObjects` and are matched by `providerKey` plus `objectType`.
- **The one shipped provider**: GitHub
  (`github-external-object-provider.ts`): pull requests, issues, deployments,
  workflow runs.
- **Provider labels already reserved** in `ui/src/lib/external-objects.ts`:
  github, hubspot, linear, jira, notion, asana. Labels only; no provider
  behind them yet.
- **Secrets**: per-company secret storage exists
  (`company_secrets`, `company_secret_bindings`, provider configs), so a
  connector's token has a home already. Never put a customer token in env.

So the socket is built. What is missing is the plug for anything that is
not GitHub, and a knowledge-shaped object type.

## The two connector shapes

1. **Object connectors** (what exists today): outside items that a task can
   point at. A pull request, a ticket, a CRM deal. Already modeled.
2. **Knowledge connectors** (the gap): a body of documents a company thinks
   with. A Notion workspace, an Obsidian vault, a Drive folder, a repo's
   `knowledge/` directory. Departments read these to answer in the company's
   own words, and every claim carries a link back to the source page.

## Notion as the first knowledge connector (Quantus is the test case)

Quantus keeps its knowledge base in Notion. The target behavior: ask the
Quantus Cofounder a question about the network, and the answer cites the
Notion page it came from, with a link, no copy-paste and no stale export.

Implementation path, smallest first:

1. **Read-only, cited**: connect a Notion workspace per company (token in
   company secrets), index page titles and IDs, and let departments search
   and quote with the page URL attached. Object type: `knowledge_page`.
2. **Freshness on the citation**: every quoted page carries its Notion
   `last_edited_time`. Anything older than the company's staleness window is
   flagged "confirm before quoting" (the corpus provenance rule in
   `doc/KNOWLEDGE-STRUCTURE.md`, applied to live sources).
3. **Write-back, board-gated**: an agent may DRAFT a page (a diagnosis, a
   runbook, a weekly report) and it lands in a review queue. Publishing to
   the customer's workspace requires an explicit approval, same as any
   outward action.
4. **The same shape for the neighbours**: Obsidian (local vault, file
   watcher), Drive, and a repo's own `knowledge/` folder reuse the interface.
   The connector API is per-source, not per-vendor.

## The onboarding question this changes

Today `/summon onboard` asks for a repo. A company OS asks for four things:
the repo, the knowledge base, the money account, and the customer list. Each
answered by a connector, each optional, each one making the departments less
blind. Onboarding should present them as a checklist, with what is missing
shown honestly (`[TBD: awaiting real data]`) rather than guessed at.

## Board tasks

Tracked on the SUM board: the Notion read-only knowledge connector, the
staleness rule on citations, and the four-connector onboarding checklist.
Quantus is the first company to run against it because its knowledge base is
already in Notion and it is on the board.
