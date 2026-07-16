// Elon operating model, executed (doc/research/ELON-OPERATING-MODEL.md §2):
// 1. All eight department agents -> claude_local (Codex quota = the constraint;
//    modularity is the fix; VIT-49 will make this policy-automatic later).
// 2. Redistribute tickets to true department owners - one agent per problem,
//    all gestating in parallel (no serialized dependencies unless real).
// 3. Unpause CTO (fresh assignments = the sanctioned resume path).
// 4. File the Elon-UI ticket (Algorithm gates, parallel lanes, time-in-state).
// 5. Wake CTO->VIT-53 and CFO->VIT-48 (constraint-attacker) - throttled parallelism.
// Idempotent.

const API_BASE = process.env.VITALS_API_BASE ?? "http://127.0.0.1:3100/api";
const SUMMON_ID = "4a46da88-eb15-40d5-98a8-10739d4fa310";

async function request(method, path, body) {
  const r = await fetch(`${API_BASE}${path}`, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let data; try { data = JSON.parse(text); } catch { data = text; }
  if (!r.ok) throw new Error(`${method} ${path} ${r.status}: ${JSON.stringify(data).slice(0, 300)}`);
  return data;
}

// dept ownership redistribution: identifier -> agentName (only where it CHANGES)
const REASSIGN = {
  "VIT-48": "Vitals CFO",        // usage/spend = money -> Finance
  "VIT-46": "Vitals CFO",        // cost ledger -> Finance
  "VIT-49": "Vitals CTO",        // fallback chains = runtime policy
  "VIT-52": "Vitals CMO",        // rebrand sweep = brand/language
  "VIT-54": "Vitals CMO",        // issue->task = product language
  "VIT-59": "Vitals CMO",        // users lane = user comms (until a Support agent exists)
  "VIT-45": "Vitals COO",        // approval gates = governance/ops
};
const WAKES = {
  "VIT-53": ["Vitals CTO",
    "Board wake (Elon model: attack in parallel): fix the queued comment-wake bug per this ticket. You are on claude_local now. Evidence: repro, fix diff, regression test."],
  "VIT-48": ["Vitals CFO",
    "Board wake (attack the constraint): provider quota is the production-rate limiter of the whole company (Codex exhausted to Jul 22; Claude shared with the board). Build the usage monitor per this ticket. Evidence: screenshots + alert demo."],
};

async function main() {
  const agents = await request("GET", `/companies/${SUMMON_ID}/agents`);
  const byName = Object.fromEntries(agents.map((a) => [a.name, a]));

  // 1. flip codex agents to claude_local + clear errors + unpause CTO
  for (const name of ["Vitals CTO", "Vitals COO", "Vitals CFO", "Vitals CMO", "Vitals Company Diagnostician"]) {
    const a = byName[name];
    if (!a) continue;
    if (a.adapterType !== "claude_local") {
      await request("PATCH", `/agents/${a.id}`, {
        adapterType: "claude_local",
        adapterConfig: { model: "claude-fable-5" },
      });
      console.log(`${name} -> claude_local (claude-fable-5)`);
    }
    if (a.status === "error") {
      await request("POST", `/agents/${a.id}/clear-error`, {});
      console.log(`${name} error cleared`);
    }
    if (a.status === "paused") {
      try { await request("POST", `/agents/${a.id}/resume`, {}); console.log(`${name} resumed`); }
      catch { try { await request("PATCH", `/agents/${a.id}`, { status: "idle" }); console.log(`${name} resumed via PATCH`); } catch { console.log(`${name} RESUME FAILED - manual`); } }
    }
  }

  // 2. redistribute
  const issues = await request("GET", `/companies/${SUMMON_ID}/issues`);
  for (const [identifier, ownerName] of Object.entries(REASSIGN)) {
    const issue = issues.find((c) => c.identifier === identifier);
    const owner = byName[ownerName];
    if (!issue || !owner) { console.log(`${identifier} -> ${ownerName} SKIPPED (missing)`); continue; }
    if (issue.assigneeAgentId !== owner.id) {
      await request("PATCH", `/issues/${issue.id}`, { assigneeAgentId: owner.id });
    }
    console.log(`${identifier} -> ${ownerName}`);
  }

  // 3. Elon-UI ticket
  const goals = await request("GET", `/companies/${SUMMON_ID}/goals`);
  const projects = await request("GET", `/companies/${SUMMON_ID}/projects`);
  const title = "Elon operating model in the UI: Algorithm gates, named requirements, parallel lanes, time-in-state";
  let elonUi = issues.find((c) => c.title === title);
  if (!elonUi) {
    elonUi = await request("POST", `/companies/${SUMMON_ID}/issues`, {
      projectId: projects[0]?.id, goalId: goals[0]?.id, title,
      description: `Implement doc/research/ELON-OPERATING-MODEL.md section 3 in the product UI:
1. Five-gate Algorithm strip on task detail (Requirements? -> Delete? -> Simplify ->
   Accelerate -> Automate) with gate state; gate 1 shows the NAMED requirement owner
   (a person/agent, never a department); gate 2 exposes "propose deletion" as a
   first-class agent action the board approves.
2. Parallel lanes as the board's default work view: one lane per agent, everything
   gestating simultaneously; true dependencies drawn as explicit edges so
   serialization is visible (and killable).
3. Time-in-state on every task chip; visual escalation with age ("if a timeline is
   long, it's wrong" as a render rule).
4. Box-in-a-box audit: one inbox, one settings surface, one status vocabulary -
   file dedup findings into DECISION-SHEET.
Coordinate with VIT-41 (chat surface), VIT-13 roadmap view, and the formation view.
Design-guide + visual suite discipline; board contact sheet before merge.`,
      status: "todo", priority: "high", assigneeAgentId: byName["Vitals Design Director"]?.id,
    });
  }
  console.log(`${elonUi.identifier}  ${title}`);

  // 4. throttled wakes
  const fresh = await request("GET", `/companies/${SUMMON_ID}/issues`);
  for (const [identifier, [ownerName, comment]] of Object.entries(WAKES)) {
    const issue = fresh.find((c) => c.identifier === identifier);
    const owner = byName[ownerName];
    if (!issue || !owner) continue;
    await request("PATCH", `/issues/${issue.id}`, { assigneeAgentId: owner.id, comment });
    console.log(`WOKE ${identifier} -> ${ownerName}`);
  }
  console.log("\nParallel formation applied.");
}

main().catch((e) => { console.error(e.stack ?? e.message); process.exitCode = 1; });
