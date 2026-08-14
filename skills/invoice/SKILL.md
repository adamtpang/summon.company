---
name: invoice
description: >
  Reads a project's actual scope, decomposes it into client-recognizable line
  items, prices it defensibly, shows a draft, then creates a real Stripe
  invoice (hosted pay page + PDF) via the Stripe MCP or a fallback script.
  Sibling of /mint: invoice bills work already done or agreed, mint sells
  forward.
---

# /invoice — scope-aware invoice generator (Stripe MCP first)

Reads a project's ACTUAL scope, decomposes it into line items a client would
recognize, prices it defensibly, shows the draft, and creates a real Stripe
invoice (hosted pay page + PDF, identical to Stripe's standard invoice layout:
numbered header, bill-to block, itemized table, amount due, pay-online link).
Sibling of /mint: mint sells a product forward; invoice bills work already
done or work agreed. Two engines, in order of preference:

1. **Stripe MCP** (when the Stripe connector is available in the session):
   drive the API through `stripe_api_write` / `stripe_api_read`. Mutations may
   return an approval URL that Adam clicks; that approval loop IS the
   human-in-the-loop for money artifacts, use it, never route around it.
2. **Fallback script**: `scripts/invoice.mjs` next to this file (raw REST,
   key resolved internally, shares /mint's key).

Trigger on: /invoice, "invoice this", "bill <client> for <project>", "make an
invoice for the work on X", "send <client> an invoice".

## Inputs (ask for any that are missing before starting)

- Project: a repo path, a live URL, or a plain description of what was built.
- Client: name + email. Email can arrive later, but the invoice cannot SEND
  without it; drafts are fine name-only.
- Basis: Adam's rate (hourly / daily / flat), OR a target total, OR the word
  "estimate" to propose a fair market price.
- Optional: dates worked, a prior invoice to match, a PO or reference,
  days until due (default net 14; use 30 when an offer includes a free month).

## Steps

1. **Understand the work.** Repo or path given: READ it — README, the main
   manifest, the route/feature map, and `git log --oneline` over the span of
   work. Produce a short honest inventory of what was actually built. URL or
   description only: work from that and say plainly what could not be verified.
2. **Decompose into 1–8 line items** a client would recognize. Group by
   deliverable, never by file. Each line: description, quantity or units,
   unit price, line amount.
3. **Price it.** Rate given: compute from a defensible effort estimate and
   show the hours. Flat/target: allocate sensibly. "estimate": research the
   market rate (real searches, /mint PRICE discipline), state the assumption.
   Never invent hours, rates, or deliverables.
4. **Draft and SHOW before creating anything.** Header (from Anchor Marianas
   LLC, to client, terms), itemized lines, total, one-line scope summary, a
   short thank-you in Adam's voice: warm, direct, no em dashes, never needy.
5. **Create as a DRAFT via the Stripe MCP** (default path):
   1. Find or create the customer: `stripe_api_read` `GetCustomersSearch`
      with `query: "name:'<client>'"` (or email when known); else
      `stripe_api_write` `PostCustomers` `{name, email?}`. Never duplicate.
   2. `stripe_api_write` `PostInvoices` `{customer, collection_method:
      "send_invoice", days_until_due, auto_advance: false, footer}`. The
      footer carries the guarantee or terms line when the offer has one.
   3. One `stripe_api_write` `PostInvoiceitems` per line:
      `{customer, invoice, amount (cents), currency: "usd", description}`.
   4. STOP at draft. Report the dashboard link
      (`https://dashboard.stripe.com/invoices/<id>`), the total restated in
      dollars, and what is missing (usually the email).
6. **Finalize and send ONLY on Adam's explicit "send"**:
   `PostInvoicesInvoiceFinalize` then `PostInvoicesInvoiceSend` (Stripe emails
   the hosted invoice + PDF). Without the word "send", hand Adam the hosted
   link after finalize and he delivers it himself. If the MCP asks for
   approval via URL, show the link, wait for Adam to say he approved, then
   re-call with the approval_token.

## Fallback script and modular client profiles

```bash
node ~/.claude/skills/invoice/scripts/invoice.mjs --client joe --preset ambassadorship
node ~/.claude/skills/invoice/scripts/invoice.mjs \
  --name "<client>" --email <email> \
  --item "<Line item one>=<cents>" --item "<Line item two>=<cents>" \
  --desc "<one-line scope summary>" --due 14
```

**Client profiles** live in `clients/<slug>.json` (see `clients/_template.json`):
name, email, pinned Stripe `customerId`, default terms, memo, footer, and a
map of named line-item presets. `--client <slug>` loads the profile,
`--preset <name>` pulls a preset line, and every flag overrides the profile.
One JSON file per client is the customization surface: new client, new file.
Current profiles: `joe` (Quantus, net 7), `anton` (Regain, founding footer).
`--dry` prints the plan without touching Stripe. `--send` only on the word.

## Pre-mint gate

Before minting a FIRST invoice for a new client or a new offer, run
/offer-check (the Grand Slam and value-equation gate). GO means mint; FIX
means repair the offer first. Recurring re-bills of an already-checked offer
skip the gate. Adam can override with an explicit "skip the check".

## Rules (hard)

- Ground every number in the project or Adam's input. Unsure: ask, never fill.
- Amount honesty: always restate cents as dollars next to each other
  (120000 = $1,200.00) so a magnitude typo dies in review.
- Drafts are reversible and invisible to the client: safe to create.
  Finalizing assigns the invoice number; SENDING is outward and irreversible.
  Never finalize-and-send without the explicit word "send".
- The secret key is never printed, echoed, or passed on the CLI (script path
  resolves it internally; MCP path never touches a key at all).
- No em dashes anywhere in client-facing text.
- One clean itemized invoice per run; a re-draft replaces, never stacks
  (void or delete the superseded draft).

## Summon wiring

Inside Summon this is Finance's capability: an invoice becomes a money-in
outcome receipt (SUM-143). The free web version (step wizard at
invoice.summon.company) is the marketing wrapper, same engine (SUM-194).

## Edge cases

- No MCP and no key: produce the complete draft + exact command, tell Adam to
  drop STRIPE_SECRET_KEY into ~/.claude/skills/invoice/.env (mint's is found
  automatically).
- Non-USD: currency ISO code; amounts still in the smallest unit.
- A prior invoice to match: mirror its terms and numbering series; Stripe
  keeps the account's numbering automatically (drafts show the next number
  at finalize).
- Recurring arrangements ($X/mo): first month as an invoice is fine; offer
  /mint's subscription link for months 2+, or a Stripe subscription when the
  client prefers hands-off billing.
