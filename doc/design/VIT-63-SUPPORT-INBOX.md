# VIT-63 — Support/hello inbox: setup runbook

Status: board approved 2026-07-16 (confirmation card accepted). CMO steps executed
2026-07-16: DNS MX/SPF live on both domains (verified via 8.8.8.8), footer contact
link deployed to production (summon.company + vitals.run). Remaining: founder steps
(ImprovMX account + Gmail label/filter) and the end-to-end test email.
Parent: VIT-59 (`doc/design/VIT-59-USERS-LANE.md`).

## Decision proposed

Publish **`hello@summon.company`** as the user-facing address (matches the visible
Summon brand in the site footer), with **`hello@vitals.run`** configured identically so
both work. Both forward to the board's Gmail (`adamtpangelinan@gmail.com`) and are
filed under the label **`Summon/Users`**.

## Current state (verified 2026-07-15)

- DNS for both `vitals.run` and `summon.company` is on Vercel
  (`ns1/ns2.vercel-dns.com`); the Vercel CLI on this machine is authenticated as
  `adamtpang` and can manage records.
- **Neither domain has MX records** — no inbound mail exists to break.
- The board's Gmail has only one user label (`Notes`); no `Summon/Users` label yet.
- The connected Gmail MCP scopes allow read/search/draft/label-apply but **not**
  label creation or filter creation — those are founder steps.
- The landing footer (`apps/landing/index.html`) now links
  `mailto:hello@summon.company` — **not deployed**; publishing is board-gated.
- No waitlist form exists in the repo (CTAs are Stripe/cal.com links), so the
  "waitlist confirmation reply-to" from the issue has no wiring surface yet; it
  applies the day a waitlist form ships.

## Forwarding mechanics: ImprovMX (proposed)

Free tier, no mailbox to manage, per-domain aliases, forwards to any Gmail.
Alternatives considered: Cloudflare Email Routing (requires moving nameservers off
Vercel — rejected), Google Workspace (paid + migration — overkill for zero inbound).

### Step 1 — Founder (≈5 min): ImprovMX account

1. Create a free account at improvmx.com (suggest signing in with the board Gmail).
2. Add both domains: `summon.company` and `vitals.run`.
3. For each, create alias `hello` → `adamtpangelinan@gmail.com`.
   (Optionally alias `support` → same target.)

### Step 2 — CMO: DNS records via Vercel CLI — DONE 2026-07-16

Record IDs: summon.company `rec_bbb5c910…`, `rec_2b81a96a…`, `rec_93389c5c…`;
vitals.run `rec_640fbd9b…`, `rec_174b34c4…`, `rec_5feb0dbe…`. MX + SPF confirmed
resolving via Google DNS (8.8.8.8) minutes after creation.

```bash
npx vercel dns add summon.company '' MX mx1.improvmx.com 10
npx vercel dns add summon.company '' MX mx2.improvmx.com 20
npx vercel dns add summon.company '' TXT 'v=spf1 include:spf.improvmx.com ~all'
npx vercel dns add vitals.run '' MX mx1.improvmx.com 10
npx vercel dns add vitals.run '' MX mx2.improvmx.com 20
npx vercel dns add vitals.run '' TXT 'v=spf1 include:spf.improvmx.com ~all'
```

ImprovMX shows a green check per domain when MX+SPF are detected.

### Step 3 — Founder (≈2 min): Gmail label + filter

1. Create label `Summon/Users` (nested: parent `Summon`, child `Users`).
2. Create filter: `to:(hello@summon.company OR hello@vitals.run OR support@summon.company OR support@vitals.run)`
   → apply label `Summon/Users`, never send to spam. Leave in inbox.

### Step 4 — Verification (issue acceptance)

1. Send a real email from any outside account to `hello@summon.company`.
2. Confirm via Gmail search `to:hello@summon.company` that it arrived **and**
   carries the `Summon/Users` label (agent can verify with the read-scoped
   Gmail connector: `search_threads` query `to:hello@summon.company`).
3. Repeat once for `hello@vitals.run`.

### Step 5 — Board approval gate: publish — DONE 2026-07-16

Deployed to production (`dpl_ETMmL6E4avj34QyPNUSMVrxYdeKS`, Vercel project
`vitals.run`). Verified live: the footer `mailto:hello@summon.company` link is
served on both `https://summon.company` and `https://vitals.run`.
Known quirk (pre-existing, out of scope): `www.summon.company` 302s to a Vercel
SSO gate — the www subdomain is attached to a protected project/deployment;
the apex domains are correct.

## What this unblocks

VIT-59 acceptance ("a real user email appears as a thread") gets a live channel to
run on once VIT-41 ships the Messages inbox. The Users-lane sync should ingest
Gmail threads under label `Summon/Users` (see flow spec in
`doc/design/VIT-59-USERS-LANE.md`).
