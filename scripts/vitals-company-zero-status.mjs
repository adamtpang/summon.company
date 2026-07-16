const API_BASE = process.env.VITALS_API_BASE ?? "http://127.0.0.1:3100/api";
const COMPANY_ID = process.env.VITALS_COMPANY_ID ?? "4a46da88-eb15-40d5-98a8-10739d4fa310";
const S_TIER_IDENTIFIERS = ["VIT-14", "VIT-22", "VIT-4", "VIT-13", "VIT-11"];

async function get(path) {
  const response = await fetch(`${API_BASE}${path}`);
  if (!response.ok) throw new Error(`GET ${path} ${response.status}: ${await response.text()}`);
  return response.json();
}

function shortError(value) {
  if (!value) return null;
  return String(value).replace(/\s+/g, " ").slice(0, 180);
}

async function summarizeRunLog(runId) {
  const detail = await get(`/heartbeat-runs/${runId}/log`).catch(() => null);
  if (!detail?.content) return { lastMessage: null, lastCommand: null };
  let lastMessage = null;
  let lastCommand = null;
  for (const line of String(detail.content).split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      const record = JSON.parse(line);
      for (const chunkLine of String(record.chunk ?? "").split(/\r?\n/)) {
        if (!chunkLine.trim()) continue;
        try {
          const event = JSON.parse(chunkLine);
          const item = event.item;
          if (item?.type === "agent_message" && item.text) {
            lastMessage = String(item.text).replace(/\s+/g, " ").slice(0, 240);
          }
          if (item?.type === "command_execution" && item.command) {
            lastCommand = String(item.command).replace(/\s+/g, " ").slice(0, 240);
          }
        } catch {
          // Some adapter chunks are plain text rather than Codex JSONL events.
        }
      }
    } catch {
      // Ignore a partial final log line while an active process is writing.
    }
  }
  return { lastMessage, lastCommand };
}

async function main() {
  const [agents, issues, runs] = await Promise.all([
    get(`/companies/${COMPANY_ID}/agents`),
    get(`/companies/${COMPANY_ID}/issues`),
    get(`/companies/${COMPANY_ID}/heartbeat-runs?limit=100`),
  ]);
  const agentById = Object.fromEntries(agents.map((agent) => [agent.id, agent]));
  const latestRunByIssueId = {};
  for (const run of runs) {
    const issueId = run.contextSnapshot?.issueId;
    if (issueId && !latestRunByIssueId[issueId]) latestRunByIssueId[issueId] = run;
  }

  const sTier = S_TIER_IDENTIFIERS.map((identifier) => {
    const issue = issues.find((candidate) => candidate.identifier === identifier);
    if (!issue) return { identifier, missing: true };
    const owner = agentById[issue.assigneeAgentId];
    const run = latestRunByIssueId[issue.id];
    return {
      identifier,
      issue: issue.status,
      owner: owner?.name ?? null,
      agent: owner?.status ?? null,
      run: run?.status ?? null,
      runId: run?.id ?? null,
      error: shortError(run?.error ?? owner?.errorReason),
    };
  });

  const activeRuns = await Promise.all(
    runs
      .filter((run) => run.status === "queued" || run.status === "running")
      .map(async (run) => ({
        runId: run.id,
        agent: agentById[run.agentId]?.name ?? run.agentId,
        status: run.status,
        issueId: run.contextSnapshot?.issueId ?? null,
        processPid: run.processPid,
        lastOutputAt: run.lastOutputAt,
        ...(run.status === "running" ? await summarizeRunLog(run.id) : {}),
      })),
  );

  process.stdout.write(`${JSON.stringify({ sTier, activeRuns }, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error.stack ?? error.message);
  process.exitCode = 1;
});
