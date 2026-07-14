# vitals.run

vitals.run is an AI-agent company platform built as an additive product layer on the
Paperclip engine. Customers hire AI employees by department while a human remains the
board: high-risk actions require approval and spending stops at configured caps.

## Repository layout

- Engine: the repository root. Keep `@paperclipai/*`, `PAPERCLIP_*`, database, API, and
  protocol surfaces compatible with upstream Paperclip.
- Product UI: additive vitals.run routes and components in `ui/`.
- Landing and portable dashboard: `apps/landing/`.
- Installer: the `installer` branch, published from the same GitHub repository so the
  vendorable package remains at branch root.

## Run the engine

```bash
pnpm install
pnpm dev
```

## Run the landing locally

Serve `apps/landing/` with any static server, or open `apps/landing/index.html` directly.
Production is deployed from `apps/landing/` to the existing Vercel project `vitals.run`.

## Install the portable CEO dashboard

Run this inside any company repository:

```bash
npx github:adamtpang/vitals.run#installer
```

The installer vendors a zero-dependency dashboard into `vitals/`, then the founder can
ask an AI coding agent to "interview me" and populate the company config.

## Upstream discipline

1. Prefer new files and routes for vitals.run product behavior.
2. Do not rename Paperclip packages or environment variables.
3. Keep `upstream` pointed at `paperclipai/paperclip` and merge upstream regularly.
4. Verify engine build, landing links, installer output, and the live domain before release.
