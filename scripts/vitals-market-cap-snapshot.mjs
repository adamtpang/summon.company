// VIT-101: market-cap snapshot -- real data only (11x rule).
// Reads the selected company's dashboard. ARR comes from the same company-owned
// restricted Stripe connection used by Payments and Mission Control; this
// script never accepts or reads a global Stripe secret.
// Computes the model (packages/shared/src/vitals-market-cap.ts), publishes the
// snapshot as the `market-cap-snapshot` document on the market-cap issue, and
// with --file-regressions files starred tasks for churn/margin/growth events
// (the VIT-71 CEO-autopilot wiring; dedup by exact title, VIT-71 discipline).
//
// Usage:
//   node scripts/vitals-market-cap-snapshot.mjs                  # print snapshot
//   node scripts/vitals-market-cap-snapshot.mjs --publish        # + upsert document
//   node scripts/vitals-market-cap-snapshot.mjs --publish --file-regressions
//   node scripts/vitals-market-cap-snapshot.mjs --company-id=<uuid> --publish

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
const MARKET_CAP_ISSUE_TITLE_MATCH = /market cap on the scoreboard/i;
const STATE_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "doc", "finance");

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

async function main() {
  const companies = await request("GET", "/companies");
  const requestedCompanyId = args.get("--company-id") ?? process.env.SUMMON_COMPANY_ID;
  const company = typeof requestedCompanyId === "string"
    ? companies.find((candidate) => candidate.id === requestedCompanyId)
    : companies.length === 1
      ? companies[0]
      : companies.find((candidate) => candidate.name === "Summon Company Zero");
  if (!company) throw new Error("Select one company with --company-id=<uuid> or SUMMON_COMPANY_ID");
  const dashboard = await request("GET", `/companies/${company.id}/dashboard`);
  const finance = dashboard.finance;
  const stateFile = join(STATE_DIR, `market-cap-snapshot-${company.id}.json`);
  const prev = existsSync(stateFile) ? JSON.parse(readFileSync(stateFile, "utf8")) : null;

  const snapshot = computeMarketCapSnapshot(
    {
      stripeConnected: finance.stripeConnected,
      stripeTestMode: finance.stripeMode === "test",
      arrCents: finance.arrCents,
      arrCurrency: finance.arrCurrency,
      arrCoverage: finance.arrCoverage,
      payingCustomers: finance.payingCustomerCount,
      retentionRate: null, // no paying cohort yet -- honest null
      grossMarginPct: null, // cost-of-revenue attribution pending -- honest null
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
    const issues = await request("GET", `/companies/${company.id}/issues`);
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
    const issues = await request("GET", `/companies/${company.id}/issues`);
    const goals = await request("GET", `/companies/${company.id}/goals`);
    const projects = await request("GET", `/companies/${company.id}/projects`);
    const agents = await request("GET", `/companies/${company.id}/agents`);
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
      const created = await request("POST", `/companies/${company.id}/issues`, {
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
  writeFileSync(stateFile, JSON.stringify(snapshot, null, 2));
  console.log(`state written: ${stateFile}`);
}

main().catch((e) => { console.error(e.stack ?? e.message); process.exitCode = 1; });
