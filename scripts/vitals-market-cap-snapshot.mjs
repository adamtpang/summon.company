// VIT-101: market-cap snapshot -- real data only (11x rule).
// Pulls companies/agents from the control plane and ARR from Stripe (live REST
// read with STRIPE_SECRET_KEY, or a pre-fetched subscriptions JSON via
// --stripe-subscriptions=<file> when the key lives elsewhere, e.g. Stripe MCP).
// Computes the model (packages/shared/src/vitals-market-cap.ts), publishes the
// snapshot as the `market-cap-snapshot` document on the market-cap issue, and
// with --file-regressions files starred tasks for churn/margin/growth events
// (the VIT-71 CEO-autopilot wiring; dedup by exact title, VIT-71 discipline).
//
// Usage:
//   node scripts/vitals-market-cap-snapshot.mjs                  # print snapshot
//   node scripts/vitals-market-cap-snapshot.mjs --publish        # + upsert document
//   node scripts/vitals-market-cap-snapshot.mjs --publish --file-regressions
//   node scripts/vitals-market-cap-snapshot.mjs --stripe-subscriptions=subs.json --publish

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  computeMarketCapSnapshot,
  detectLeverRegressions,
  renderMarketCapSnapshotDocument,
  VITALS_MARKET_CAP_DOCUMENT_KEY,
} from "../packages/shared/src/vitals-market-cap.ts";

const API_BASE = process.env.VITALS_API_BASE ?? "http://127.0.0.1:3100/api";
const SUMMON_ID = "4a46da88-eb15-40d5-98a8-10739d4fa310";
const MARKET_CAP_ISSUE_TITLE_MATCH = /market cap on the scoreboard/i;
const STATE_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "doc", "finance");
const STATE_FILE = join(STATE_DIR, "market-cap-snapshot.json");

const args = new Map(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.split("=");
    return [k, v ?? true];
  }),
);

// Reads go unauthed (local board); writes carry the agent token when present
// so documents/issues attribute to the CFO agent, not `local-board`.
async function request(method, path, body) {
  const useAuth = method !== "GET" && process.env.PAPERCLIP_API_KEY;
  const r = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      ...(body ? { "content-type": "application/json" } : {}),
      ...(useAuth ? { authorization: `Bearer ${process.env.PAPERCLIP_API_KEY}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  if (!r.ok) throw new Error(`${method} ${path} ${r.status}: ${JSON.stringify(data).slice(0, 300)}`);
  return data;
}

// --- Stripe: real reads only. No key + no file => not connected, ARR shown $0.
async function readStripe() {
  const fixtureFile = args.get("--stripe-subscriptions");
  let subs = null;
  let testMode = false;
  if (typeof fixtureFile === "string") {
    const raw = JSON.parse(readFileSync(fixtureFile, "utf8"));
    subs = raw.data ?? raw.subscriptions ?? raw;
    testMode = subs.some((s) => s.livemode === false);
  } else if (process.env.STRIPE_SECRET_KEY) {
    const r = await fetch("https://api.stripe.com/v1/subscriptions?status=active&limit=100", {
      headers: { authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` },
    });
    const data = await r.json();
    if (!r.ok) throw new Error(`Stripe read failed: ${JSON.stringify(data).slice(0, 200)}`);
    subs = data.data ?? [];
    testMode = process.env.STRIPE_SECRET_KEY.startsWith("sk_test_") || subs.some((s) => s.livemode === false);
  } else {
    return { connected: false, testMode: false, arrCents: null, payingCompanies: null };
  }

  let mrrCents = 0;
  const customers = new Set();
  for (const sub of subs) {
    if (sub.status !== "active" && sub.status !== "trialing") continue;
    customers.add(typeof sub.customer === "string" ? sub.customer : sub.customer?.id);
    for (const item of sub.items?.data ?? []) {
      const price = item.price ?? item.plan ?? {};
      const amount = price.unit_amount ?? price.amount ?? 0;
      const qty = item.quantity ?? 1;
      const interval = price.recurring?.interval ?? price.interval ?? "month";
      const count = price.recurring?.interval_count ?? price.interval_count ?? 1;
      const perMonth =
        interval === "year" ? amount / (12 * count)
        : interval === "week" ? (amount * 52) / (12 * count)
        : interval === "day" ? (amount * 365) / (12 * count)
        : amount / count;
      mrrCents += perMonth * qty;
    }
  }
  return {
    connected: true,
    testMode,
    arrCents: Math.round(mrrCents * 12),
    payingCompanies: customers.size,
  };
}

async function main() {
  const companies = await request("GET", "/companies");
  const agentLists = await Promise.all(
    companies.map((c) => request("GET", `/companies/${c.id}/agents`).catch(() => [])),
  );
  const totalEmployees = agentLists.reduce((n, list) => n + list.length, 0);

  const stripe = await readStripe();

  const prev = existsSync(STATE_FILE) ? JSON.parse(readFileSync(STATE_FILE, "utf8")) : null;

  const snapshot = computeMarketCapSnapshot(
    {
      stripeConnected: stripe.connected,
      stripeTestMode: stripe.testMode,
      arrCents: stripe.arrCents,
      payingCompanies: stripe.payingCompanies,
      totalCompanies: companies.length,
      totalEmployees,
      retentionRate: null, // no paying cohort yet -- honest null
      grossMarginPct: null, // per-employee ledger (VIT-46/49) pending -- honest null
      arrGrowth30dPct: null, // no trailing ARR series yet -- honest null
    },
    new Date().toISOString(),
  );

  const doc = renderMarketCapSnapshotDocument(snapshot);
  console.log(doc.split("```json")[0]);

  const regressions = detectLeverRegressions(prev, snapshot);
  if (regressions.length) {
    console.log(`lever regressions detected: ${regressions.map((r) => r.kind).join(", ")}`);
  } else {
    console.log("lever regressions: none");
  }

  if (args.has("--publish")) {
    const issues = await request("GET", `/companies/${SUMMON_ID}/issues`);
    const issue = issues.find((i) => MARKET_CAP_ISSUE_TITLE_MATCH.test(i.title));
    if (!issue) throw new Error("market-cap issue not found on the control plane");
    // Updating an existing document requires its latest revision id (409 otherwise).
    const existing = await request(
      "GET",
      `/issues/${issue.id}/documents/${VITALS_MARKET_CAP_DOCUMENT_KEY}`,
    ).catch(() => null);
    await request("PUT", `/issues/${issue.id}/documents/${VITALS_MARKET_CAP_DOCUMENT_KEY}`, {
      title: "Market cap snapshot",
      format: "markdown",
      body: doc,
      changeSummary: `snapshot ${snapshot.generatedAt}: stage ${snapshot.stage.id}, ARR ${snapshot.arrLabel}`,
      ...(existing?.latestRevisionId ? { baseRevisionId: existing.latestRevisionId } : {}),
    });
    console.log(`published ${VITALS_MARKET_CAP_DOCUMENT_KEY} document on ${issue.identifier}`);
  }

  if (args.has("--file-regressions") && regressions.length) {
    const issues = await request("GET", `/companies/${SUMMON_ID}/issues`);
    const goals = await request("GET", `/companies/${SUMMON_ID}/goals`);
    const projects = await request("GET", `/companies/${SUMMON_ID}/projects`);
    const agents = await request("GET", `/companies/${SUMMON_ID}/agents`);
    const findOwner = (dept) => {
      const d = dept.toLowerCase();
      return agents.find((a) => {
        const n = a.name.toLowerCase();
        if (d.includes("finance")) return n.includes("cfo");
        if (d.includes("support")) return n.includes("support") || n.includes("coo");
        if (d.includes("marketing")) return n.includes("cmo") || n.includes("marketing");
        return false;
      });
    };
    for (const reg of regressions) {
      // Dedup by exact title among non-terminal issues (VIT-71 discipline):
      // an open twin gets left alone; a board-closed twin is never re-filed.
      const twin = issues.find((i) => i.title === reg.title);
      if (twin) {
        console.log(`regression already filed as ${twin.identifier} (${twin.status}) -- skipping`);
        continue;
      }
      // --no-assign: demo mode -- file unassigned so no agent is woken on demo data.
      const owner = args.has("--no-assign") ? null : findOwner(reg.ownerDepartment);
      const created = await request("POST", `/companies/${SUMMON_ID}/issues`, {
        projectId: projects[0]?.id,
        goalId: goals[0]?.id,
        title: reg.title,
        description: [
          `WHY (CEO autopilot lever watch, VIT-101/VIT-71): ${reg.why}`,
          "",
          `EVIDENCE: ${reg.evidence}`,
          `LEVER: ${reg.leverKey} (owner: ${reg.ownerDepartment})`,
          `PROPOSED STARS: importance ${reg.importanceStars}/5, urgency ${reg.urgencyStars}/5`,
          "",
          "Filed automatically from the market-cap snapshot regression rules",
          "(doc/MARKET-CAP-MODEL.md section 5). Numbers are real system reads.",
        ].join("\n"),
        status: "todo",
        priority: reg.importanceStars >= 5 ? "critical" : "high",
        assigneeAgentId: owner?.id,
      });
      console.log(`filed ${created.identifier}: ${reg.title} -> ${owner?.name ?? "unassigned"}`);
    }
  }

  mkdirSync(STATE_DIR, { recursive: true });
  writeFileSync(STATE_FILE, JSON.stringify(snapshot, null, 2));
  console.log(`state written: doc/finance/market-cap-snapshot.json`);
}

main().catch((e) => { console.error(e.stack ?? e.message); process.exitCode = 1; });
