const API_BASE = process.env.VITALS_API_BASE ?? "http://127.0.0.1:3100/api";
const COMPANY_ID = process.env.VITALS_COMPANY_ID ?? "4a46da88-eb15-40d5-98a8-10739d4fa310";
const PROJECT_ID = process.env.VITALS_PROJECT_ID ?? "ae5f4b2a-201e-4660-bf6e-eb48965cbe3a";
const GOAL_ID = process.env.VITALS_GOAL_ID ?? "bcf0d950-3689-455a-976b-d218a93c707d";
const TITLE = "Trusted context graph: Notion, Obsidian, Stripe, and bank vitals";

async function request(method, path, body) {
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(`${method} ${path} ${response.status}: ${text}`);
  return data;
}

async function main() {
  const issues = await request("GET", `/companies/${COMPANY_ID}/issues`);
  let issue = issues.find((candidate) => candidate.title === TITLE);
  if (!issue) {
    issue = await request("POST", `/companies/${COMPANY_ID}/issues`, {
      projectId: PROJECT_ID,
      goalId: GOAL_ID,
      title: TITLE,
      status: "backlog",
      priority: "high",
      description: `WHY: Company Zero agents cannot diagnose the real business or protect runway while company knowledge, life context, revenue, and cash are disconnected from the control plane.

SOLUTION: Build a read-only, source-attributed context graph with normalized snapshots and explicit freshness. Keep raw secrets and sensitive records in connector storage. Expose only the minimum board-approved facts each employee needs.

ACCEPTANCE:
- Notion OAuth can find and sync the board-selected Quantus pages; wrong-workspace and missing-permission states are explicit.
- Obsidian reads only approved folders from C:\\Users\\adamp\\ObsidianVault and never edits the vault in this task.
- Stripe provides read-only revenue, charges, subscriptions, cash timing, and payment-link health with least privilege.
- Chase data enters through board-authorized Plaid OAuth or an equivalent provider; credentials are never requested, stored, or scraped.
- Finance keeps personal and company ledgers separate and computes earn rate, burn rate, net cash flow, liquid savings, and runway with as-of timestamps.
- Every fact records source, scope, freshness, and missing-data state; sensitive transaction details never enter prompts, issues, artifacts, logs, or git.
- Connector writes, payments, refunds, transfers, bank actions, and broader data access remain board-gated.
- Tests cover redaction, stale data, revoked access, duplicate sync, and partial-source failure.

DISPATCH RULE: Keep this unassigned in backlog until the CEO closes or supersedes the current runtime-portability constraint, then rank it against the live S-tier candidates and assign one directly responsible department owner.`,
    });
  }
  process.stdout.write(`${JSON.stringify({ id: issue.id, identifier: issue.identifier, status: issue.status, assigneeAgentId: issue.assigneeAgentId }, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});

