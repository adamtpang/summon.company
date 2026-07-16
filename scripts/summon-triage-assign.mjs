// Board triage 2026-07-15: Eisenhower pass over the full Summon queue.
// Sets priority + assignee on every ticket (ownership by department), then wakes
// exactly TWO runs (Engineer -> VIT-41, Design -> VIT-36) so the Claude
// subscription isn't swarmed. Codex-owned items keep ownership but cannot run
// until Jul 22 (quota) - they are the agent's queue, not lost work.
// Idempotent; safe to re-run.

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

// identifier -> [priority, ownerAgentName, wakeComment?]
// Quadrant DO-FIRST = critical, SCHEDULE = high, LATER = medium, LOW = low.
const TRIAGE = {
  // --- DO FIRST (urgent + important) ---
  "VIT-41": ["critical", "Vitals Engineer",
    "Board wake: start now. Build the WhatsApp-style per-employee chat inbox (simple, clean - employee list + thread + composer). Coordinate mechanics with VIT-40 (continuity) and VIT-57 (CEO front door) - one surface, not three. Small commits, screenshots (light+dark) as evidence on this issue. Draft-only externally; the board reviews before merge."],
  "VIT-36": ["critical", "Vitals Design Director",
    "Board wake: start now. Deliver 3-5 Summon logomark concepts as an SVG contact sheet (light+dark) for board review - concepts first, NO icon wiring until the board picks. Post the sheet as evidence on this issue."],
  "VIT-57": ["critical", "Vitals Engineer", null],
  "VIT-40": ["critical", "Vitals Engineer", null],
  "VIT-48": ["critical", "Vitals Engineer", null],
  "VIT-49": ["critical", "Vitals Engineer", null],

  // --- SCHEDULE (important, sequenced) ---
  "VIT-56": ["high", "Vitals Engineer", null],
  "VIT-58": ["high", "Vitals Engineer", null],
  "VIT-34": ["high", "Vitals Engineer", null],
  "VIT-47": ["high", "Vitals Engineer", null],
  "VIT-35": ["high", "Vitals Design Director", null],
  "VIT-51": ["high", "Vitals Design Director", null],
  "VIT-50": ["high", "Vitals Design Director", null],
  "VIT-42": ["high", "Vitals Engineer", null],
  "VIT-53": ["high", "Vitals CTO", null],          // Codex-blocked until Jul 22
  "VIT-44": ["high", "Vitals CTO", null],          // Codex-blocked
  "VIT-43": ["high", "Vitals CTO", null],          // Codex-blocked
  "VIT-39": ["high", "Vitals COO", null],          // Codex-blocked

  // --- LATER (important, not urgent) ---
  "VIT-37": ["medium", "Vitals Engineer", null],   // after Run 4
  "VIT-45": ["medium", "Vitals Engineer", null],
  "VIT-46": ["medium", "Vitals Engineer", null],
  "VIT-38": ["medium", "Vitals CTO", null],        // umbrella; Codex-blocked
  "VIT-52": ["medium", "Vitals Engineer", null],

  // --- LOW ---
  "VIT-54": ["low", "Vitals Engineer", null],
  "VIT-55": ["low", "Vitals Engineer", null],
};

async function main() {
  const agents = await request("GET", `/companies/${SUMMON_ID}/agents`);
  const byName = Object.fromEntries(agents.map((a) => [a.name, a]));
  const issues = await request("GET", `/companies/${SUMMON_ID}/issues`);

  const rows = [];
  for (const [identifier, [priority, ownerName, wakeComment]] of Object.entries(TRIAGE)) {
    const issue = issues.find((c) => c.identifier === identifier);
    if (!issue) { rows.push(`${identifier}  MISSING - skipped`); continue; }
    const owner = byName[ownerName];
    if (!owner) { rows.push(`${identifier}  owner ${ownerName} not found - skipped`); continue; }
    const patch = { priority, assigneeAgentId: owner.id };
    if (wakeComment) patch.comment = wakeComment;
    const needsChange =
      issue.priority !== priority || issue.assigneeAgentId !== owner.id || Boolean(wakeComment);
    if (needsChange) await request("PATCH", `/issues/${issue.id}`, patch);
    rows.push(`${identifier}  [${priority}]  -> ${ownerName}${wakeComment ? "  (WOKEN)" : ""}`);
  }
  console.log(rows.join("\n"));
  console.log("\nTriage applied. Woken: VIT-41 (Engineer), VIT-36 (Design Director).");
}

main().catch((e) => { console.error(e.stack ?? e.message); process.exitCode = 1; });
