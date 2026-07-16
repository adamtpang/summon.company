// Files the board-approved improvement queue as issues across all companies
// (2026-07-15): Summon dogfood work (Run 4/5, logo, model picker, OpenClaw),
// plus per-company standardization (checklist + core-8 + roadmap).
// Also flips the Design Director to claude_local (Codex quota exhausted to Jul 22)
// and resumes it for its fresh assignments (the sanctioned resume path).
// Idempotent: finds issues by exact title before creating.

const API_BASE = process.env.VITALS_API_BASE ?? "http://127.0.0.1:3100/api";
const SUMMON_ID = "4a46da88-eb15-40d5-98a8-10739d4fa310";
const QUANTUS_ID = "c53e607e-1d77-4cb8-a12c-2dab11327fb6";
const ANCHOR_ID = "bc84673c-689c-4b9f-842e-fe722eeac04c";

async function request(method, path, body) {
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  if (!response.ok) throw new Error(`${method} ${path} ${response.status}: ${JSON.stringify(data).slice(0, 400)}`);
  return data;
}

const STANDARD_BODY = (companyName) => `WHY: Every company in the control plane runs the same operating standard or the
diagnosis loop cannot compare, staff, or verify it.

SOLUTION: Bring ${companyName} up to VITALS_COMPANY_STANDARD.md:
1. The standardization checklist (goal, project, primary workspace, budget caps,
   board-approval policy, evidence rules) completed and documented on this issue.
2. The core-8 formation: all eight departments (Engineering, Design, Marketing,
   Sales, Finance, Operations, Support, Legal) have one accountable owner each -
   an existing agent, a PROPOSED hire (board approves; never auto-hire), or an
   explicit "human owner" note. Product is not a ninth department.
3. The 8-stage roadmap (VITALS_FORMATION_ROADMAP.md, cofounder.co-informed) is
   instantiated with real evidence per stage and exactly one least-complete
   unblocked stage marked as the current constraint.

ACCEPTANCE: checklist evidence posted here; formation visible on /:prefix/formation;
roadmap visible on /:prefix/roadmap (or /roadmap) with the constraint highlighted;
hire proposals (if any) queued for board approval, not executed.`;

async function main() {
  // ---- 1. Design Director: claude_local + resume (fresh assignments below) ----
  const summonAgents = await request("GET", `/companies/${SUMMON_ID}/agents`);
  const byName = Object.fromEntries(summonAgents.map((a) => [a.name, a]));
  const design = byName["Vitals Design Director"];
  const engineer = byName["Vitals Engineer"];
  const coo = byName["Vitals COO"];
  const cto = byName["Vitals CTO"];
  if (!design || !engineer || !coo) throw new Error("Expected Summon leadership agents missing");

  if (design.adapterType !== "claude_local") {
    await request("PATCH", `/agents/${design.id}`, {
      adapterType: "claude_local",
      adapterConfig: { model: "claude-fable-5" },
    });
    console.log("Design Director -> claude_local (claude-fable-5)");
  }
  if (design.status === "paused") {
    let resumed = false;
    for (const attempt of [
      () => request("POST", `/agents/${design.id}/resume`, {}),
      () => request("PATCH", `/agents/${design.id}`, { status: "idle" }),
    ]) {
      try { await attempt(); resumed = true; break; } catch { /* try next */ }
    }
    console.log(resumed ? "Design Director resumed (fresh-assignment path)" : "Design Director resume FAILED - resume manually in the app");
  }

  // ---- 2. Attach points for Summon issues ----
  const goals = await request("GET", `/companies/${SUMMON_ID}/goals`);
  const projects = await request("GET", `/companies/${SUMMON_ID}/projects`);
  const goalId = goals[0]?.id;
  const projectId = projects[0]?.id;

  async function fileIssue(companyId, spec) {
    const issues = await request("GET", `/companies/${companyId}/issues`);
    let issue = issues.find((candidate) => candidate.title === spec.title);
    if (!issue) {
      issue = await request("POST", `/companies/${companyId}/issues`, {
        ...(spec.projectId ? { projectId: spec.projectId } : {}),
        ...(spec.goalId ? { goalId: spec.goalId } : {}),
        title: spec.title,
        description: spec.description,
        status: "todo",
        priority: spec.priority,
        ...(spec.assigneeAgentId ? { assigneeAgentId: spec.assigneeAgentId } : {}),
      });
    }
    console.log(`${issue.identifier}  ${spec.title}  [${spec.ownerLabel ?? "unassigned"}]`);
    return issue;
  }

  // ---- 3. Summon (VIT) queue ----
  const summonIssues = [
    {
      title: "Run 4: retire Tailwind palette classes + toast decision (the simplify run)",
      priority: "high",
      assigneeAgentId: engineer.id,
      ownerLabel: "Vitals Engineer",
      description: `Execute doc/design/RUN4-PROMPT.md in a fresh worktree (design/palette-retirement).
Scope: DECISION-SHEET B2 (3,115 palette-class sites / 145 files -> semantic tokens,
cluster-by-cluster, zero-pixel discipline), C9 toast verdict, token-gate extension.
DONE: gates CLEAN incl. new palette gate; typecheck/build/vitest/visual suite green;
run4-review/ triplets for any visible delta. Full spec + /goal block in the doc.`,
    },
    {
      title: "Run 5: SUMMON light-flagship brand preset - app design system aligned to the brand",
      priority: "high",
      assigneeAgentId: design.id,
      ownerLabel: "Vitals Design Director",
      description: `Execute doc/design/RUN5-SUMMON-BRAND.md AFTER Run 4 merges.
Map the app's semantic tokens onto SUMMON v2.0 (design/tokens.css: light canonical,
dark derived, Summon Blue #0B5FFF, canvas #F7FAFF); close the B4 shadow decision;
light-mode legibility sweep; surface the theme toggle; desktop chrome metas.
Board gallery review REQUIRED before merge (tune-session pattern). The board (Adam)
crafts on this with you: produce contact sheets early and often.`,
    },
    {
      title: "Design the Summon desktop logo + full app icon set",
      priority: "high",
      assigneeAgentId: design.id,
      ownerLabel: "Vitals Design Director",
      description: `Fresh assignment (sanctioned resume). Design the Summon logomark and wire the
desktop app's identity. Brand: DESIGN_SYSTEM.md + design/tokens.css (Summon Blue
family; "summon" = calling forth a company; the landing's existing motif is the
starting point, not a constraint).

DELIVERABLES:
1. 3-5 logomark concepts as an SVG contact sheet (light + dark) for board review.
2. After board pick: production SVG (mark + wordmark lockups), app icon set
   (.ico, .icns, 16..1024 png), tray/menubar icons (light+dark, template variant),
   wired into apps/desktop (Electron config) + ui/index.html favicon + landing.
3. Evidence: before/after screenshots of the installed app icon, dock/taskbar, tray.
GUARDRAILS: additive files; no core renames; board approves the final mark before
any icon replaces the current one.`,
    },
    {
      title: "Model picker: Claude-Code-grade model modularity surface",
      priority: "medium",
      assigneeAgentId: engineer.id,
      ownerLabel: "Vitals Engineer",
      description: `Implement doc/MODEL-PICKER.md after Run 4: quick-switch chip on AgentDetail
(adapter - model - effort, 2 clicks), Settings -> Models with company defaults +
per-role overrides + cheap-profile editor, adapter health strip (auth state,
subscription vs API-key badge, detect refresh). Rides existing adapterModels/
detectModel APIs; additive component family ui/src/components/model-picker/.
Today's proof of need: all codex_local agents errored on the Codex usage limit
(locked to Jul 22) - switching executors must be a 2-click board action.`,
    },
    {
      title: "Adopt OpenClaw learnings into the Summon runtime",
      priority: "medium",
      assigneeAgentId: cto?.id,
      ownerLabel: cto ? "Vitals CTO" : "unassigned",
      description: `Research doc landing at doc/research/OPENCLAW-LEARNINGS.md (board-run sweep of
github.com/openclaw - the OpenClaw personal-assistant framework Adam wants learned
from, incl. clawsweeper and ecosystem repos). When the doc lands: extract the
adoption list (candidates: always-on gateway/daemon pattern vs schedule-only
heartbeat, skills registry/marketplace mechanics, multi-channel surfaces, memory
compression, provider modularity), REIMPLEMENT ideas (never copy code; respect
license), one issue per adopted item. Blocked-by: the research doc landing on disk.`,
    },
    {
      title: "Standardization rollout: every company gets the checklist, core-8 formation, and 8-stage roadmap",
      priority: "high",
      assigneeAgentId: coo.id,
      ownerLabel: "Vitals COO",
      description: `${STANDARD_BODY("every company in the plane (Anchor, Quantus, and all future imports)")}

ROLLOUT EXTRAS:
- The company-import flow seeds checklist + formation + roadmap automatically so
  standardization is the default, not a retrofit.
- Anchor currently has ZERO agents - propose its formation (board approves hires).
- Quantus has 5 of 8 departments (missing Design, Finance, Operations, Support) -
  its CEO owns the local issue; you own the standard and the verification.`,
    },
  ];

  console.log("--- Summon (VIT) ---");
  for (const spec of summonIssues) {
    await fileIssue(SUMMON_ID, { ...spec, goalId, projectId });
  }

  // ---- 4. Quantus (QUA) standardization ----
  console.log("--- Quantus (QUA) ---");
  const quantusAgents = await request("GET", `/companies/${QUANTUS_ID}/agents`);
  const quantusCeo = quantusAgents.find((a) => a.name === "Quantus CEO");
  const quantusGoals = await request("GET", `/companies/${QUANTUS_ID}/goals`);
  const quantusProjects = await request("GET", `/companies/${QUANTUS_ID}/projects`);
  await fileIssue(QUANTUS_ID, {
    title: "Standardize Quantus: operating checklist, complete the core-8 formation, 8-stage roadmap",
    priority: "medium",
    assigneeAgentId: quantusCeo?.id,
    ownerLabel: quantusCeo ? "Quantus CEO" : "unassigned",
    goalId: quantusGoals[0]?.id,
    projectId: quantusProjects[0]?.id,
    description: `${STANDARD_BODY("Quantus")}

QUANTUS SPECIFICS: 5 of 8 departments staffed (CEO + Engineering, Sales, Marketing,
Legal). Missing: Design, Finance, Operations, Support - propose owners (agent hire
proposals for board approval, or named humans on the Quantus side: Chris, Joe, Nick).
S-tier work QUA-1..5 already maps to the roadmap's early stages; place each on its
stage when instantiating.`,
  });

  // ---- 5. Anchor (ANC) standardization ----
  console.log("--- Anchor (ANC) ---");
  await fileIssue(ANCHOR_ID, {
    title: "Standardize Anchor: operating checklist, core-8 formation, 8-stage roadmap",
    priority: "medium",
    ownerLabel: "unassigned (no agents yet)",
    description: `${STANDARD_BODY("Anchor")}

ANCHOR SPECIFICS: zero agents today. First move is the formation PROPOSAL (which
departments need agents vs which stay human-owned by Adam), sized to Anchor's actual
activity - do not hire eight agents by default. Board approves any hire.`,
  });

  console.log("\nQueue filed.");
}

main().catch((error) => {
  console.error(error.stack ?? error.message);
  process.exitCode = 1;
});
