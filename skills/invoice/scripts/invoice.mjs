#!/usr/bin/env node
// invoice.mjs — mint a real Stripe invoice (customer -> items -> invoice ->
// finalize) and print the hosted pay link + PDF. Dependency-free.
//
// Usage:
//   node invoice.mjs --name "Client Co" --email client@co.com \
//     --item "Auth + onboarding=120000" --item "Deploy + infra=45000" \
//     --desc "Project scope summary" --due 14 [--send] [--dry]
//
//   --amount <cents> may replace --item for a single-line invoice.
//   Amounts are CENTS. --send emails the client via Stripe — outward and
//   irreversible; never pass it without Adam's explicit "send".
//   --dry prints every call it WOULD make and exits without touching Stripe.
//
// Key resolution (never printed): $STRIPE_SECRET_KEY, then --env <path>,
// then ./.env, then ~/.claude/skills/invoice/.env, then
// ~/.claude/skills/mint/.env (the two money skills share one key).

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const args = process.argv.slice(2);
const opt = { items: [], presets: [], send: false, dry: false };
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  const next = () => args[++i];
  if (a === "--client") opt.client = next();
  else if (a === "--preset") opt.presets.push(next());
  else if (a === "--name") opt.name = next();
  else if (a === "--email") opt.email = next();
  else if (a === "--item") opt.items.push(next());
  else if (a === "--amount") opt.amount = next();
  else if (a === "--desc") opt.desc = next();
  else if (a === "--footer") opt.footer = next();
  else if (a === "--due") opt.due = Number(next());
  else if (a === "--currency") opt.currency = next();
  else if (a === "--env") opt.envPath = next();
  else if (a === "--send") opt.send = true;
  else if (a === "--dry") opt.dry = true;
  else if (a === "--help" || a === "-h") {
    console.log(
      "invoice.mjs [--client <slug>] [--preset <name>]* --name <client> --email <email> " +
        "(--item \"Description=cents\")+ | --amount <cents> [--desc <memo>] [--footer <text>] " +
        "[--due <days>] [--currency usd] [--env <path>] [--send] [--dry]\n\n" +
        "--client loads clients/<slug>.json (terms, footer, memo, customer id, item\n" +
        "presets). Flags always override the profile. --preset pulls a named line\n" +
        "item from the profile's items map.",
    );
    process.exit(0);
  }
}

function fail(msg) {
  console.error("error: " + msg);
  process.exit(1);
}

// Modular per-client profiles: clients/<slug>.json next to this skill.
// Profile fields fill anything the flags left unset; flags always win.
const skillDir = path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, "$1"));
let profile = null;
if (opt.client) {
  const profilePath = path.join(skillDir, "..", "clients", opt.client + ".json");
  try {
    profile = JSON.parse(fs.readFileSync(profilePath, "utf8"));
  } catch (e) {
    fail(`no client profile at ${profilePath} (${e.message})`);
  }
  opt.name ??= profile.name;
  opt.email ??= profile.email;
  opt.due ??= profile.due;
  opt.currency ??= profile.currency;
  opt.desc ??= profile.memo;
  opt.footer ??= profile.footer;
  for (const presetName of opt.presets) {
    const preset = profile.items?.[presetName];
    if (!preset) fail(`profile "${opt.client}" has no item preset "${presetName}" (has: ${Object.keys(profile.items ?? {}).join(", ") || "none"})`);
    opt.items.push(`${preset.description}=${preset.cents}`);
  }
} else if (opt.presets.length) {
  fail("--preset requires --client");
}
opt.due ??= 14;
opt.currency ??= "usd";

if (!opt.name || !opt.email) fail("--name and --email are required (directly or via --client profile)");
if (opt.items.length === 0 && !opt.amount) fail("provide --item \"Description=cents\" (repeatable) or --amount <cents>");
if (opt.items.length === 0) opt.items.push((opt.desc ?? "Professional services") + "=" + opt.amount);

const lines = opt.items.map((raw) => {
  const idx = raw.lastIndexOf("=");
  if (idx < 1) fail(`bad --item "${raw}" — use "Description=cents"`);
  const description = raw.slice(0, idx).trim();
  const cents = Number(raw.slice(idx + 1));
  if (!Number.isInteger(cents) || cents <= 0) fail(`bad amount in --item "${raw}" — cents must be a positive integer`);
  return { description, cents };
});
const totalCents = lines.reduce((sum, l) => sum + l.cents, 0);

function loadKey() {
  if (process.env.STRIPE_SECRET_KEY) return process.env.STRIPE_SECRET_KEY;
  const candidates = [
    opt.envPath,
    path.resolve(".env"),
    path.join(os.homedir(), ".claude", "skills", "invoice", ".env"),
    path.join(os.homedir(), ".claude", "skills", "mint", ".env"),
  ].filter(Boolean);
  for (const p of candidates) {
    try {
      const text = fs.readFileSync(p, "utf8");
      const m = text.match(/^\s*STRIPE_SECRET_KEY\s*=\s*(\S+)\s*$/m);
      if (m) return m[1];
    } catch {
      // next candidate
    }
  }
  fail("no Stripe secret key found (env STRIPE_SECRET_KEY, --env, ./.env, skill .env, or mint's .env)");
}

const dollars = (c) => "$" + (c / 100).toFixed(2);

if (opt.dry) {
  console.log("DRY RUN — no Stripe calls made. Plan:");
  if (profile) console.log(`0. client profile: ${opt.client} (${profile.customerId ?? "find by email"})`);
  console.log(`1. find-or-create customer: ${opt.name} <${opt.email}>`);
  for (const l of lines) console.log(`2. invoice item: "${l.description}" ${dollars(l.cents)}`);
  console.log(`3. create invoice: collection_method=send_invoice, days_until_due=${opt.due}` + (opt.desc ? `, memo="${opt.desc}"` : "") + (opt.footer ? `, footer="${opt.footer.slice(0, 40)}..."` : ""));
  console.log(`4. finalize -> hosted pay link + PDF. TOTAL ${dollars(totalCents)} ${opt.currency.toUpperCase()}`);
  console.log(opt.send ? "5. SEND via Stripe email (outward!)" : "5. no send — Adam delivers the link himself");
  process.exit(0);
}

const KEY = loadKey();
const API = "https://api.stripe.com/v1";

async function stripe(pathname, params) {
  const body = new URLSearchParams(params);
  const res = await fetch(API + pathname, {
    method: "POST",
    headers: {
      Authorization: "Bearer " + KEY,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });
  const json = await res.json();
  if (!res.ok) fail(`${pathname}: ${json.error?.message ?? res.status}`);
  return json;
}

async function stripeGet(pathname) {
  const res = await fetch(API + pathname, { headers: { Authorization: "Bearer " + KEY } });
  const json = await res.json();
  if (!res.ok) fail(`${pathname}: ${json.error?.message ?? res.status}`);
  return json;
}

// 1. Use the profile's pinned customer id, else find or create by email.
let customer;
if (profile?.customerId) {
  customer = await stripeGet(`/customers/${profile.customerId}`);
  console.log(`customer: ${customer.id} (pinned by profile)`);
} else {
  const found = await stripeGet(`/customers/search?query=${encodeURIComponent(`email:'${opt.email}'`)}`);
  customer = found.data?.[0] ?? (await stripe("/customers", { name: opt.name, email: opt.email }));
  console.log(`customer: ${customer.id} (${found.data?.length ? "existing" : "created"})`);
}

// 2. Create the invoice FIRST (send_invoice + due days), then attach items to it.
const invoiceParams = {
  customer: customer.id,
  collection_method: "send_invoice",
  days_until_due: String(opt.due),
  auto_advance: "false",
  currency: opt.currency,
};
if (opt.desc) invoiceParams.description = opt.desc;
if (opt.footer) invoiceParams.footer = opt.footer;
const invoice = await stripe("/invoices", invoiceParams);
console.log(`invoice: ${invoice.id} (draft)`);

for (const l of lines) {
  await stripe("/invoiceitems", {
    customer: customer.id,
    invoice: invoice.id,
    amount: String(l.cents),
    currency: opt.currency,
    description: l.description,
  });
  console.log(`  line: "${l.description}" ${dollars(l.cents)}`);
}

// 3. Finalize -> hosted link + PDF.
const finalized = await stripe(`/invoices/${invoice.id}/finalize`, {});
console.log(`finalized: ${finalized.number ?? finalized.id} · total ${dollars(finalized.total)} ${String(finalized.currency).toUpperCase()} · due in ${opt.due} days`);

if (opt.send) {
  await stripe(`/invoices/${invoice.id}/send`, {});
  console.log("SENT via Stripe email to " + opt.email);
}

console.log("");
console.log("PAY LINK: " + finalized.hosted_invoice_url);
console.log("PDF:      " + finalized.invoice_pdf);
