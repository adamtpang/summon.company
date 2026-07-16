// Batch 11 (2026-07-16): board "execute" command. Enforce 1 agent = 1 S-tier task,
// unblock Quantus (flip to claude_local, restore department assignees, wake the two
// criticals), and steer the product asks (global prompt composer, live-runs-by-
// archetype). Idempotent.

const API_BASE = process.env.VITALS_API_BASE ?? "http://127.0.0.1:3100/api";
const SUMMON_ID = "4a46da88-eb15-40d5-98a8-10739d4fa310";
const QUANTUS_ID = "c53e607e-1d77-4cb8-a12c-2dab11327fb6";

async function request(method, path, body) {
  const r = await fetch(`${API_BASE}${path}`, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let data; try { data = JSON.parse(text); } catch { data = text; }
  if (!r.ok) throw new Error(`${method} ${path} ${r.status}: ${JSON.stringify(data).slice(0, 250)}`);
  return data;
}

async function main() {
  // ---------- QUANTUS: unblock and execute ----------
  const qAgents = await request("GET", `/companies/${QUANTUS_ID}/agents`);
  const qByName = Object.fromEntries(qAgents.map((a) => [a.name, a]));
  for (const a of qAgents) {
    if (a.adapterType !== "claude_local") {
      await request("PATCH", `/agents/${a.id}`, {
        adapterType: "claude_local",
        adapterConfig: { model: "claude-fable-5" },
      });
      console.log(`${a.name} -> claude_local`);
    }
    if (a.status === "error") {
      await request("POST", `/agents/${a.id}/clear-error`, {});
      console.log(`${a.name} error cleared`);
    }
  }
  // restore one-owner-per-department (the Elon rule) + unblock
  const qAssign = {
    "QUA-1": ["Quantus Engineer", "Board wake: you own this S-tier task solo. Verify the keystore-CRITICAL disclosure reached Quantus core (Nikolaus Heger/n13, Chris, or Joe) and drive the fix per the ticket. You are on claude_local now. Evidence on the ticket; drafts only externally."],
    "QUA-2": ["Quantus Dealmaker", "Board wake: you own this S-tier task solo. Work the warm pipeline (Fulgur/Alex Mann first) to dated next steps; draft outreach for the board to send. You are on claude_local now. Evidence on the ticket."],
    "QUA-4": ["Quantus Engineer", null],
    "QUA-3": ["Quantus Event Marketer", null],
    "QUA-5": ["Quantus Counsel Support", null],
    "QUA-6": ["Quantus CEO", null],
  };
  const qIssues = await request("GET", `/companies/${QUANTUS_ID}/issues`);
  for (const [identifier, [ownerName, wake]] of Object.entries(qAssign)) {
    const issue = qIssues.find((c) => c.identifier === identifier);
    const owner = qByName[ownerName];
    if (!issue || !owner) continue;
    const patch = { assigneeAgentId: owner.id, status: "todo" };
    if (wake) patch.comment = wake;
    await request("PATCH", `/issues/${issue.id}`, patch);
    console.log(`${identifier} -> ${ownerName}${wake ? "  (WOKEN)" : "  (unblocked, queued)"}`);
  }

  // ---------- SUMMON: steers ----------
  const vIssues = await request("GET", `/companies/${SUMMON_ID}/issues`);
  const steers = {
    "VIT-111": `Board rule (2026-07-16, BINDING - encode it in your collapse): ONE AGENT = ONE
S-TIER TASK. The CEO surfaces problems, triages, and assigns exactly one S-tier
(critical) task per agent; everything else in that agent's queue is parked todo in
Summon-Score order (VIT-113). Current WIP violates this badly (Engineer alone holds
~12 in_progress). Your collapse output: per agent, the ONE task that stays active,
the parked queue order, and anything that should be deleted outright (Elon gate 2).
Post it as a plain-language decision card for the board.`,
    "VIT-57": `Board addition (in-scope): Claude-Code-parity prompting. A GLOBAL COMPOSER -
always-available prompt box (Ctrl+K or always-docked) that can address any company
or agent - plus the left sidebar listing ALL COMPANIES and their agents (the
StarCraft unit roster). Selecting a company/agent scopes the composer; @-mention
routes across them ("@Quantus-Dealmaker status?"). Prompting Summon must feel
exactly like prompting Claude Code: type, enter, the right employee picks it up
(CEO routes when ambiguous).`,
    "VIT-112": `Board addition (in-scope): the LIVE AGENT RUNS zone. Within Mission Control (or as
the formation zone's live mode): how many agents are working RIGHT NOW grouped by
archetype (CEO / Engineer / Design / Sales / Marketing / Finance / Ops / Support /
Legal), each with its current task one-liner and run duration. Across ALL companies
(the sidebar's fleet view) and per company. This is the StarCraft minimap: one
glance = who is working, on what, where the idle capacity is.`,
  };
  for (const [identifier, comment] of Object.entries(steers)) {
    const issue = vIssues.find((c) => c.identifier === identifier);
    if (!issue) { console.log(`${identifier} missing - steer skipped`); continue; }
    await request("PATCH", `/issues/${issue.id}`, { comment });
    console.log(`steered ${identifier}`);
  }
  console.log("\nExecute batch applied.");
}

main().catch((e) => { console.error(e.stack ?? e.message); process.exitCode = 1; });
