const API_BASE = process.env.VITALS_API_BASE ?? "http://127.0.0.1:3100/api";
const COMPANY_ID = process.env.VITALS_COMPANY_ID ?? "4a46da88-eb15-40d5-98a8-10739d4fa310";

async function request(method, path, body) {
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${method} ${path} ${response.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

async function main() {
  const [identifier, ...messageParts] = process.argv.slice(2);
  const body = messageParts.join(" ").trim();
  if (!identifier || !body) {
    throw new Error("Usage: node scripts/vitals-company-zero-board-comment.mjs VIT-4 <message>");
  }
  const issues = await request("GET", `/companies/${COMPANY_ID}/issues`);
  const issue = issues.find((candidate) => candidate.identifier === identifier);
  if (!issue) throw new Error(`Unknown issue ${identifier}`);
  const comment = await request("POST", `/issues/${issue.id}/comments`, { body });
  process.stdout.write(`${JSON.stringify({ identifier, commentId: comment.id }, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error.stack ?? error.message);
  process.exitCode = 1;
});
