# /invoice — scope-aware invoice generator

Reads a project's ACTUAL scope, decomposes it into line items a client would
recognize, prices it defensibly, shows the draft, and mints a real Stripe
invoice (hosted pay link + PDF) only on Adam's explicit approval. Sibling of
/mint: mint sells a product forward; invoice bills work already done.
Script: `scripts/invoice.mjs` next to this file.

Trigger on: /invoice, "invoice this", "bill <client> for <project>", "make an
invoice for the work on X", "send <client> an invoice".

## Inputs (ask for any that are missing before starting)

- Project: a repo path, a live URL, or a plain description of what was built.
- Client: name + email.
- Basis: Adam's rate (hourly / daily / flat), OR a target total, OR the word
  "estimate" to propose a fair market price.
- Optional: dates worked, a prior invoice to match, a PO or reference.

## Steps

1. **Understand the work.** Repo or path given: READ it — README, the main
   manifest, the route/feature map, and `git log --oneline` over the span of
   work. Produce a short honest inventory of what was actually built
   (features, pages, integrations, infra, migrations). URL or description
   only: work from that and say plainly what could not be verified.
2. **Decompose into 3–8 line items** a client would recognize. Group by
   deliverable, never by file ("Auth + multi-account onboarding", "OTP capture
   + Chrome extension", "Deploy + infra"). Each line: description, quantity or
   units, unit price, line amount.
3. **Price it.**
   - Rate given: compute each line from a defensible effort estimate; show
     the hours so Adam can adjust.
   - Flat/target given: allocate the total across lines sensibly.
   - "estimate": research the market rate for this work and region (real
     searches, not recall — same discipline as /mint's PRICE mode), state the
     assumption in one line, price from it.
   - Never invent hours, rates, or deliverables. Anything uncertain is marked
     [estimate] and flagged.
4. **Draft and SHOW before creating anything.** Header (from Adam, to client,
   date, invoice number, terms — default net 14), itemized lines, subtotal,
   optional discount, total, a one-line scope summary, and a short thank-you
   in Adam's voice: lowercase-ish, warm, direct, no em dashes, no emojis,
   never needy.
5. **On explicit approval, mint for real:**
   ```bash
   node ~/.claude/skills/invoice/scripts/invoice.mjs \
     --name "<client>" --email <email> \
     --item "<Line item one>=<cents>" --item "<Line item two>=<cents>" \
     --desc "<one-line scope summary>" --due 14
   ```
   Prints the hosted pay link + PDF. `--dry` first when unsure — it prints
   the plan without touching Stripe. Add `--send` (Stripe emails the client)
   ONLY when Adam says the word "send"; otherwise hand him the pay link and
   he delivers it himself.

## Rules (hard)

- Ground every number in the project or Adam's input. Unsure: ask, never fill.
- Amount honesty: always restate cents as dollars next to each other
  (120000 = $1,200.00) so a magnitude typo dies in review.
- The secret key is never printed, echoed, or passed on the CLI. The script
  resolves it internally (shares /mint's key: env, ./.env, this skill's .env,
  then ~/.claude/skills/mint/.env).
- Sending is outward and irreversible. Never --send without the explicit word.
- No em dashes anywhere in client-facing text.
- One clean itemized invoice per run; a re-draft replaces, never stacks.

## Summon wiring

Inside Summon this skill is Ledger's (CFO) capability: an invoice minted for a
company becomes a money-in outcome receipt (SUM-143). The free web version
(zite-style step wizard at invoice.summon.company) is the marketing wrapper —
same engine, lead-gen surface; see the board ticket before building it.

## Edge cases

- No key configured: produce the complete draft + the exact command, and tell
  Adam to drop STRIPE_SECRET_KEY into ~/.claude/skills/invoice/.env (or reuse
  mint's — already found automatically).
- Non-USD: --currency with the ISO code; amounts still in the smallest unit.
- Existing customer: the script finds them by email first, never duplicates.
- A prior invoice to match: mirror its numbering + terms, note the continuity.
