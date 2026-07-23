import { access, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const API_BASE = process.env.VITALS_API_BASE ?? "http://127.0.0.1:3100/api";
const COMPANY_ID = process.env.VITALS_COMPANY_ID ?? "4a46da88-eb15-40d5-98a8-10739d4fa310";
const SHARED_SKILL_ROOT = process.env.VITALS_SHARED_SKILL_ROOT ?? "C:\\Users\\adamp\\.agents\\skills";
const BRAND_WORKTREE_ROOT =
  process.env.VITALS_BRAND_WORKTREE_ROOT ??
  "C:\\Users\\adamp\\OneDrive\\Aether\\.worktrees\\vitals-run-brand-system-20260714";
const BRAND_WORKTREE_BRANCH = "codex/vitals-brand-system";
const CEO_SELF_DIAGNOSIS_SCRIPT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "vitals-ceo-self-diagnosis.mjs",
);
const WAKE_IDENTIFIER =
  process.argv.find((argument) => argument.startsWith("--wake="))?.slice("--wake=".length) ??
  process.env.VITALS_WAKE_IDENTIFIER ??
  "";

async function request(method, path, body) {
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  if (!response.ok) {
    throw new Error(`${method} ${path} ${response.status}: ${JSON.stringify(data)}`);
  }
  return data;
}

function print(label, value) {
  process.stdout.write(`\n${label}\n${JSON.stringify(value, null, 2)}\n`);
}

async function clearAgentErrorIfNeeded(agent) {
  if (agent.status !== "error") return;
  await request("POST", `/agents/${agent.id}/clear-error`, {});
}

const strongModel = {
  model: "gpt-5.5",
  modelReasoningEffort: "high",
  env: { CODEX_HOME: "C:\\Users\\adamp\\.codex" },
};
const codexCheapModel = {
  enabled: true,
  label: "Fast Codex",
  adapterConfig: { model: "gpt-5.5", modelReasoningEffort: "low" },
};
const claudeCheapModel = {
  enabled: true,
  label: "Cheap Claude",
  adapterConfig: { model: "claude-haiku-4-5", effort: "low" },
};

// SUM-220: the cheap profile MUST match the agent's adapter. A gpt-5.5 cheap
// profile on a claude_local agent is instant-fail poison — the claude adapter
// cannot run gpt-5.5, so any run that resolves `cheap` dies in ~4s. Never
// hard-code the cheap model into a shared runtime object; resolve it from the
// adapter every time an agent runtimeConfig is built.
function cheapModelForAdapter(adapterType) {
  if (adapterType === "claude_local") return claudeCheapModel;
  if (adapterType === "codex_local") return codexCheapModel;
  return null;
}

const commonHeartbeat = { enabled: false, maxConcurrentRuns: 1 };
const ceoHeartbeat = {
  enabled: true,
  intervalSec: 1800,
  wakeOnDemand: true,
  cooldownSec: 60,
  maxConcurrentRuns: 1,
};

// Build an agent runtimeConfig whose cheap profile always matches the agent
// adapter. Pass the adapterType the agent will actually run on (the one being
// applied in the same patch), not a stale value.
function runtimeConfigFor(adapterType, heartbeat, existingRuntime = {}) {
  const existingProfiles = existingRuntime.modelProfiles ?? {};
  const cheap = cheapModelForAdapter(adapterType);
  const modelProfiles = { ...existingProfiles };
  if (cheap) modelProfiles.cheap = cheap;
  else delete modelProfiles.cheap;
  return { ...existingRuntime, heartbeat, modelProfiles };
}

const agentInstructions = {
  "Vitals CEO": `# Vitals CEO

You are the CEO of vitals.run Company Zero.

Own strategy, prioritization, product direction, and constraint allocation. The human remains the board. Engineering owns Product execution. You do not replace department owners; you assign one accountable owner for the current binding constraint and require solved evidence.

Operating rules:

- Work through Paperclip issues, goals, projects, documents, comments, and work products.
- Keep company work provider-neutral. Claude, Codex, Cursor, OpenClaw, and future runtimes are adapters, not company logic.
- Run the closed loop on every event wake and scheduled heartbeat: SENSE evidence, TRIAGE by expected impact and urgency, SELECT exactly one company-level binding constraint, DISPATCH it to one directly responsible employee, VERIFY the artifact and before/after result, then immediately RE-DIAGNOSE.
- When the wake reason is \`heartbeat_timer\`, run \`node "${CEO_SELF_DIAGNOSIS_SCRIPT}" --file\` before selecting the next constraint. This is the standing VIT-71 sensing pass: it only files or refreshes deduplicated \`todo\` anomalies, performs no external sends or spend, and must finish even when it finds nothing new.
- Event wakes are the fast path. The scheduled heartbeat is a safety net. Never create a duplicate issue or comment when the evidence and constraint have not changed.
- Only dispatch S-tier work: a task must materially improve time saved, money saved, revenue grown, companies improved, or risk reduced. Keep one active S-tier company constraint; use owned child issues only when the solution truly requires multiple departments.
- Delegate implementation to the owning department. The CEO diagnoses, prioritizes, assigns, unblocks, and verifies; it does not absorb an employee's implementation work.
- Use issue comments and work products as the employee-to-employee communication bus. Every handoff names the owner, acceptance criteria, dependency, evidence, and next wake condition. Employees report meaningful discoveries, blockers, and solved proof to each other there.
- On SOLVED, compare the measured result to the baseline and select the next constraint. On BLOCKED, route the exact decision to the board or accountable dependency owner. On STOPPED, preserve evidence and the fired boundary.
- Treat Notion, Obsidian, Stripe, and bank connections as read-only sensing sources by default. Never copy credentials or sensitive transaction details into issues. Chase access must use a board-authorized OAuth data provider such as Plaid, never scraped credentials.
- Use issue interactions for board choices, approvals, and confirmations.
- Require board approval for hires, budget increases, incorporation, banking, contracts, production deployment, customer data access, destructive changes, public claims, and outbound messages.
- Final outcomes are SOLVED with evidence, BLOCKED with the exact owner/action, or STOPPED by budget, security, legal, or safety boundaries.

Measured levers: time saved, money saved, revenue grown, companies improved, and risk reduced.`,
  "Vitals CTO": `# Vitals CTO

You own Engineering leadership for vitals.run.

Make runtime, architecture, reliability, and product execution real. Engineering owns Product execution; the CEO owns product strategy and company constraints. Keep all changes additive to Paperclip protocol surfaces unless the board explicitly approves a deeper fork.

Operating rules:

- Work one assigned issue at a time through Paperclip.
- Preserve package, API, environment, database, and protocol names.
- Prefer targeted verification that proves the change, then record the evidence.
- Delegate focused product implementation to Vitals Engineer when the work is product-surface execution.
- Return SOLVED with runnable evidence, BLOCKED with the exact owner/action, or STOPPED by budget, security, legal, or safety boundaries.

Measured levers: companies improved through reliable execution, time saved through fewer failed runs, and risk reduced through clear runtime boundaries.`,
  "Vitals Engineer": `# Vitals Engineer

You own Product execution for vitals.run under Engineering.

Build additive Vitals routes, components, tests, and verification paths on top of the Paperclip engine. Product is not a ninth department. Engineering owns the implementation of product strategy set by the CEO and informed by Design, Marketing, Sales, Finance, Operations, Support, and Legal.

Operating rules:

- Read the repo continuation docs before product work.
- Keep Vitals customer-facing behavior additive.
- Follow DESIGN.md and token-gate rules for UI work.
- Attach inspectable artifacts or work products when the deliverable is a file, preview, branch, PR, or document.
- Return SOLVED with tests and evidence, BLOCKED with the exact owner/action, or STOPPED by budget, security, legal, or safety boundaries.

Measured levers: companies improved by shipped product, founder time saved, and revenue enabled by clearer workflows.`,
  "Vitals CMO": `# Vitals CMO

You own Marketing for vitals.run.

Turn the Company Zero operating system into positioning, content, demand generation, referrals, and public proof. You may draft public claims, but the board must approve external publication and outbound messages.

Operating rules:

- Work one assigned issue at a time through Paperclip.
- Tie every campaign or asset to a measurable lever: revenue grown, companies improved, or time saved for the founder.
- Use evidence from product, diagnosis, support, sales, and finance before making claims.
- Coordinate with Sales for pipeline and with Design for brand quality.
- Return SOLVED with the asset/evidence, BLOCKED with the exact owner/action, or STOPPED by budget, legal, security, or safety boundaries.

Measured levers: qualified demand, revenue grown, referral loops, and companies improved.`,
  "Vitals CFO": `# Vitals CFO

You own Finance for vitals.run.

Manage budgets, pricing, billing readiness, bookkeeping standards, cash discipline, and runway. The board approves spending beyond caps, banking, and financial commitments.

Operating rules:

- Work one assigned issue at a time through Paperclip.
- Enforce company and agent budgets. Spending caps are hard constraints, not suggestions.
- Track before-and-after money saved, revenue grown, or risk reduced.
- Coordinate with Engineering on billing implementation and with Legal on contracts/compliance.
- Return SOLVED with numbers and evidence, BLOCKED with the exact owner/action, or STOPPED by budget, legal, security, or safety boundaries.

Measured levers: money saved, revenue grown, runway protected, and financial risk reduced.`,
  "Vitals COO": `# Vitals COO

You own Operations for vitals.run Company Zero.

Turn recurring company-building work into a standard, inspectable operating system. Engineering owns Product. The CEO allocates constraints. The board approves high-risk actions.

Work one assigned issue at a time. Use first principles, remove unnecessary steps, then optimize. Do not produce status chatter. Return SOLVED with evidence, BLOCKED with the exact board decision required, or STOPPED when a budget or safety boundary fires.

Every deliverable must improve at least one measured lever: time saved, money saved, revenue grown, or companies improved. Use Paperclip for coordination and the project workspace for artifacts.`,
  "Vitals Design Director": `# Vitals Design Director

You own Design for vitals.run.

Make the product exceptionally clear, useful, and beautiful. Function comes first, then form makes the function feel inevitable. Read DESIGN.md and VITALS_BRAND_STANDARD.md before editing. Continue existing work before inventing replacements.

Work one assigned issue at a time. Produce a coherent design system, implement it in the real product, and verify desktop, mobile, accessibility, loading, empty, error, and interactive states. Do not report until SOLVED with screenshots and tests, BLOCKED on a precise board decision, or STOPPED by a safety or budget boundary.

Never optimize aesthetics at the cost of task clarity, speed, or trust.`,
  "Vitals Company Diagnostician": `# Vitals Company Diagnostician

Diagnose vitals.run as Company Zero.

Inspect all eight departments and the eight roadmap stages using real evidence. Rank exactly one binding constraint by expected effect on time saved, money saved, revenue grown, or companies improved. Turn the diagnosis into one assigned task with explicit acceptance criteria.

Do not grade vibes. Require artifacts and before-and-after evidence. Return SOLVED with the diagnosed constraint and dispatched owner, BLOCKED with missing evidence or a board decision, or STOPPED at a safety or budget boundary.`,
};

async function upsertAgentInstructions(agentId, content) {
  return request("PUT", `/agents/${agentId}/instructions-bundle/file`, {
    path: "AGENTS.md",
    content,
    clearLegacyPromptTemplate: true,
  });
}

async function syncAgentSkills(agentId, desiredSkills) {
  return request("POST", `/agents/${agentId}/skills/sync`, { desiredSkills });
}

async function main() {
  const candidateSkillDirectories = (await readdir(SHARED_SKILL_ROOT, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
    .map((entry) => path.join(SHARED_SKILL_ROOT, entry.name));
  const skillDirectories = [];
  for (const directory of candidateSkillDirectories) {
    try {
      await access(path.join(directory, "SKILL.md"));
      skillDirectories.push(directory);
    } catch {
      // Shared roots can contain support directories that are not skills.
    }
  }
  const skillImports = [];
  for (const source of skillDirectories) {
    skillImports.push(await request("POST", `/companies/${COMPANY_ID}/skills/import`, { source }));
  }

  let companySkillCatalog = await request("GET", `/companies/${COMPANY_ID}/skills`);
  const backupSkills = companySkillCatalog.filter((skill) =>
    String(skill.sourceLocator ?? "").includes("\\.backups\\"),
  );
  for (const skill of backupSkills) {
    await request("DELETE", `/companies/${COMPANY_ID}/skills/${skill.id}`);
  }
  if (backupSkills.length > 0) {
    companySkillCatalog = await request("GET", `/companies/${COMPANY_ID}/skills`);
  }

  function resolveSkillRefs(references) {
    return references.map((reference) => {
      const exact = companySkillCatalog.find((skill) => skill.key === reference);
      if (exact) return exact.key;
      const candidates = companySkillCatalog.filter((skill) => skill.slug === reference);
      const live = candidates.find(
        (skill) => path.normalize(String(skill.sourceLocator ?? "")) === path.join(SHARED_SKILL_ROOT, reference),
      );
      if (live) return live.key;
      if (candidates.length === 1) return candidates[0].key;
      throw new Error(`Cannot resolve company skill ${reference}; found ${candidates.length} candidates`);
    });
  }

  let agents = await request("GET", `/companies/${COMPANY_ID}/agents`);
  let issues = await request("GET", `/companies/${COMPANY_ID}/issues`);
  const goals = await request("GET", `/companies/${COMPANY_ID}/goals`);
  const projects = await request("GET", `/companies/${COMPANY_ID}/projects`);
  const agentsByName = Object.fromEntries(agents.map((agent) => [agent.name, agent]));
  const ceo = agentsByName["Vitals CEO"];
  const cto = agentsByName["Vitals CTO"];
  const engineer = agentsByName["Vitals Engineer"];
  if (!ceo || !cto || !engineer) throw new Error("Expected Vitals leadership agents are missing");

  let northStar = goals.find((goal) => goal.title.includes("world's most valuable company"));
  if (!northStar) {
    northStar = await request("POST", `/companies/${COMPANY_ID}/goals`, {
      title: "Become the world's most valuable company by market cap by maximizing verified usefulness",
      description:
        "North star: reach #1 on CompaniesMarketCap by creating the most useful company operating system. Compound two axes: verified value created per company and number of companies improved. Market cap is the lagging score, not the daily control variable.",
      level: "company",
      status: "active",
      ownerAgentId: ceo.id,
    });
  }

  const nearTermGoal = goals.find((goal) => goal.id !== northStar.id);
  if (nearTermGoal) {
    await request("PATCH", `/goals/${nearTermGoal.id}`, {
      level: "team",
      status: "active",
      parentId: northStar.id,
      ownerAgentId: ceo.id,
      description:
        "First proof milestone: dogfood Vitals on itself, complete one diagnosis-to-solved loop, ship a sellable product, and reach $3,000+/mo. This is a child milestone of the #1 company north star.",
    });
  }

  let project = projects.find((candidate) => candidate.name === "vitals.run Company Zero");
  if (!project) {
    project = await request("POST", `/companies/${COMPANY_ID}/projects`, {
      name: "vitals.run Company Zero",
      description:
        "Vitals operates on and improves itself before it is sold to other companies. Engineering owns Product. Every S-tier problem has one accountable agent and a verified outcome.",
      status: "in_progress",
      leadAgentId: ceo.id,
      goalIds: [northStar.id, ...(nearTermGoal ? [nearTermGoal.id] : [])],
      workspace: {
        name: "vitals.run monorepo",
        sourceType: "git_repo",
        cwd: "C:\\Users\\adamp\\OneDrive\\Aether\\vitals.run",
        repoUrl: "https://github.com/adamtpang/vitals.run.git",
        defaultRef: "master",
        isPrimary: true,
      },
    });
  }

  let brandWorkspace = null;
  try {
    await access(BRAND_WORKTREE_ROOT);
    const projectWorkspaces = await request("GET", `/projects/${project.id}/workspaces`);
    brandWorkspace = projectWorkspaces.find(
      (workspace) =>
        workspace.cwd && path.normalize(workspace.cwd) === path.normalize(BRAND_WORKTREE_ROOT),
    );
    if (!brandWorkspace) {
      brandWorkspace = await request("POST", `/projects/${project.id}/workspaces`, {
        name: "vitals.run brand system worktree",
        sourceType: "git_repo",
        cwd: BRAND_WORKTREE_ROOT,
        repoUrl: "https://github.com/adamtpang/vitals.run.git",
        repoRef: BRAND_WORKTREE_BRANCH,
        defaultRef: BRAND_WORKTREE_BRANCH,
        isPrimary: false,
      });
    }
  } catch {
    // Brand work can continue from the primary workspace when this optional local worktree is absent.
  }

  await request("PATCH", `/companies/${COMPANY_ID}`, {
    description:
      "AI-agent company operating system that diagnoses the highest-leverage constraint, assigns one accountable employee, verifies the outcome, and compounds time saved, money saved, revenue grown, and companies improved. North star: become the world's most valuable company through verified usefulness.",
    budgetMonthlyCents: 10000,
  });

  const desiredSkills = Object.fromEntries(Object.entries({
    "Vitals CEO": [
      "cofounder",
      "prioritize",
      "tasks",
      "operations",
      "asap",
      "easy",
      "paperclipai/paperclip/paperclip",
      "paperclipai/paperclip/paperclip-board",
      "paperclipai/paperclip/paperclip-converting-plans-to-tasks",
      "paperclipai/paperclip/para-memory-files",
    ],
    "Vitals CTO": [
      "cofounder",
      "asap",
      "easy",
      "cure",
      "review-and-iterate",
      "paperclipai/paperclip/paperclip",
      "paperclipai/paperclip/paperclip-converting-plans-to-tasks",
    ],
    "Vitals Engineer": [
      "asap",
      "easy",
      "frontend-design-guidelines",
      "product-review",
      "review-and-iterate",
      "paperclipai/paperclip/paperclip",
      "paperclipai/paperclip/paperclip-converting-plans-to-tasks",
    ],
    "Vitals CMO": ["crisp", "marketing-video", "prioritize", "paperclipai/paperclip/paperclip"],
    "Vitals CFO": ["mint", "operations", "prioritize", "paperclipai/paperclip/paperclip"],
  }).map(([agentName, skills]) => [agentName, resolveSkillRefs(skills)]));

  for (const agent of agents) {
    if (!desiredSkills[agent.name]) continue;
    await clearAgentErrorIfNeeded(agent);
    if (agentInstructions[agent.name]) {
      await upsertAgentInstructions(agent.id, agentInstructions[agent.name]);
    }
    const isCeo = agent.name === "Vitals CEO";
    const preserveCeoAdapter = isCeo && agent.adapterType !== "codex_local";
    const nextAdapterType = preserveCeoAdapter ? agent.adapterType : "codex_local";
    const patch = {
      adapterType: nextAdapterType,
      adapterConfig: preserveCeoAdapter
        ? agent.adapterConfig
        : { ...(agent.adapterConfig ?? {}), ...strongModel },
      // Resolve the cheap profile from the adapter the agent will actually run on
      // (nextAdapterType), never a shared object — see SUM-220.
      runtimeConfig: runtimeConfigFor(
        nextAdapterType,
        isCeo ? ceoHeartbeat : commonHeartbeat,
        agent.runtimeConfig ?? {},
      ),
      budgetMonthlyCents: agent.name === "Vitals CEO" ? 3000 : 1000,
      metadata: {
        ...(agent.metadata ?? {}),
        providerNeutral: true,
        modelPolicy: "strong-default-cheap-optional",
      },
    };
    if (agent.name === "Vitals Engineer") {
      patch.title = "Product Engineer - Engineering owns product execution";
      patch.metadata = { ...patch.metadata, department: "engineering", ownsProduct: true };
    }
    const updated = await request("PATCH", `/agents/${agent.id}`, patch);
    await syncAgentSkills(updated.id, desiredSkills[agent.name]);
  }

  agents = await request("GET", `/companies/${COMPANY_ID}/agents`);
  const liveAgentsByName = Object.fromEntries(agents.map((agent) => [agent.name, agent]));

  async function hire(specification) {
    const existing = liveAgentsByName[specification.name];
    if (existing) {
      await clearAgentErrorIfNeeded(existing);
      const updated = await request("PATCH", `/agents/${existing.id}`, {
        title: specification.title,
        reportsTo: specification.reportsTo,
        capabilities: specification.capabilities,
        adapterType: specification.adapterType,
        adapterConfig: {
          ...(existing.adapterConfig ?? {}),
          ...(specification.adapterConfig ?? {}),
        },
        runtimeConfig: specification.runtimeConfig,
        budgetMonthlyCents: specification.budgetMonthlyCents,
        metadata: { ...(existing.metadata ?? {}), ...(specification.metadata ?? {}) },
      });
      const nextInstructions = specification.instructionsBundle?.files?.["AGENTS.md"];
      if (nextInstructions) {
        await upsertAgentInstructions(updated.id, nextInstructions);
      }
      if (specification.desiredSkills?.length) {
        await syncAgentSkills(updated.id, specification.desiredSkills);
      }
      liveAgentsByName[updated.name] = updated;
      return updated;
    }
    const result = await request("POST", `/companies/${COMPANY_ID}/agent-hires`, specification);
    const agent = result.agent ?? result;
    liveAgentsByName[agent.name] = agent;
    return agent;
  }

  const coo = await hire({
    name: "Vitals COO",
    role: "general",
    title: "Chief Operating Officer - company standardization and execution system",
    reportsTo: ceo.id,
    capabilities:
      "Company setup, standardization checklist, workspaces, skills, budgets, approvals, operating cadence, and import readiness.",
    adapterType: "codex_local",
    adapterConfig: strongModel,
    runtimeConfig: runtimeConfigFor("codex_local", commonHeartbeat),
    budgetMonthlyCents: 1000,
    desiredSkills: resolveSkillRefs([
      "operations",
      "cofounder",
      "diagnose",
      "prioritize",
      "tasks",
      "asap",
      "easy",
      "paperclipai/paperclip/paperclip",
      "paperclipai/paperclip/paperclip-converting-plans-to-tasks",
      "paperclipai/paperclip/para-memory-files",
    ]),
    permissions: { canCreateAgents: false, canCreateSkills: true, trustPreset: "standard" },
    metadata: { department: "operations", providerNeutral: true, guide: "Jeff Bezos" },
    instructionsBundle: {
      entryFile: "AGENTS.md",
      files: {
        "AGENTS.md": agentInstructions["Vitals COO"],
      },
    },
  });

  const design = await hire({
    name: "Vitals Design Director",
    role: "designer",
    title: "Design Director - product experience, identity, and visual quality",
    reportsTo: ceo.id,
    capabilities:
      "Brand identity, design system, landing page, product UX, responsive implementation, accessibility, and visual verification.",
    adapterType: "codex_local",
    adapterConfig: strongModel,
    runtimeConfig: runtimeConfigFor("codex_local", commonHeartbeat),
    budgetMonthlyCents: 1000,
    desiredSkills: resolveSkillRefs([
      "brand-design",
      "design-taste",
      "frontend-design-guidelines",
      "ui-ux-pro-max",
      "perfect",
      "product-review",
      "asap",
      "easy",
      "paperclipai/paperclip/paperclip",
      "paperclipai/paperclip/paperclip-converting-plans-to-tasks",
    ]),
    permissions: { canCreateAgents: false, canCreateSkills: true, trustPreset: "standard" },
    metadata: {
      department: "design",
      providerNeutral: true,
      guide: "Jony Ive",
      principle: "function-before-form",
    },
    instructionsBundle: {
      entryFile: "AGENTS.md",
      files: {
        "AGENTS.md": agentInstructions["Vitals Design Director"],
      },
    },
  });

  const diagnostician = await hire({
    name: "Vitals Company Diagnostician",
    role: "researcher",
    title: "Company Diagnostician - finds and measures the binding constraint",
    reportsTo: coo.id,
    capabilities:
      "Whole-company diagnosis, constraint ranking, evidence gathering, task dispatch, verification, and impact measurement.",
    adapterType: "codex_local",
    adapterConfig: strongModel,
    runtimeConfig: runtimeConfigFor("codex_local", commonHeartbeat),
    budgetMonthlyCents: 1000,
    desiredSkills: resolveSkillRefs([
      "cofounder",
      "diagnose",
      "prioritize",
      "operations",
      "perfect",
      "paperclipai/paperclip/paperclip",
      "paperclipai/paperclip/paperclip-converting-plans-to-tasks",
      "paperclipai/paperclip/para-memory-files",
    ]),
    permissions: { canCreateAgents: false, canCreateSkills: true, trustPreset: "standard" },
    metadata: { department: "operations", specialty: "diagnosis", providerNeutral: true },
    instructionsBundle: {
      entryFile: "AGENTS.md",
      files: {
        "AGENTS.md": agentInstructions["Vitals Company Diagnostician"],
      },
    },
  });

  await request("PATCH", `/companies/${COMPANY_ID}`, { requireBoardApprovalForNewAgents: true });

  issues = await request("GET", `/companies/${COMPANY_ID}/issues`);
  let companyZero = issues.find((issue) => issue.title === "S1: Configure vitals.run as Company Zero");
  if (!companyZero) {
    companyZero = await request("POST", `/companies/${COMPANY_ID}/issues`, {
      projectId: project.id,
      goalId: nearTermGoal?.id ?? northStar.id,
      title: "S1: Configure vitals.run as Company Zero",
      description: `WHY: Agents cannot improve a company reliably without a shared goal, workspace, department ownership, skills, budgets, approvals, and evidence rules.

SOLUTION: Make vitals.run the canonical first imported company and encode the reusable operating standard.

ACCEPTANCE:
- Company, goal, project, primary workspace, budget, and board policy are configured.
- CEO plus eight-department ownership is documented; Engineering owns Product.
- Every active agent has a provider-neutral instruction bundle and relevant skills.
- The configuration can be exported and imported without Claude- or Codex-specific company logic.
- Evidence is posted to this issue.`,
      status: "todo",
      priority: "high",
      assigneeAgentId: coo.id,
    });
  }

  issues = await request("GET", `/companies/${COMPANY_ID}/issues`);
  const assignments = [
    [
      "VIT-14",
      cto.id,
      "S0 Runtime portability",
      `Acceptance:
- Codex adapter passes command, auth, and hello probes.
- One real repository task completes through Vitals.
- Agent identity and instructions survive switching between Codex, Claude, and an HTTP/OpenClaw runtime.
- A cheap model profile is available for low-risk small tasks.
- Runtime failures surface one actionable recovery step.`,
    ],
    [companyZero.identifier, coo.id, "S1 Company Zero operating context", null],
    [
      "VIT-4",
      design.id,
      "S2 Design dogfood",
      `Phase 1 is vitals.run only. Continue the existing Brand System worktree instead of starting over.
Worktree: C:\\Users\\adamp\\OneDrive\\Aether\\.worktrees\\vitals-run-brand-system-20260714
Branch: codex/vitals-brand-system
Brand source: VITALS_BRAND_STANDARD.md in that worktree.

Acceptance:
- The product has one documented design system and token source of truth.
- The landing page is highly aesthetic without sacrificing clarity or speed.
- Formation, Design, and core operational surfaces feel coherent.
- Desktop and mobile screenshots, accessibility checks, tests, and build evidence are attached.
- Function is verified before visual polish.`,
    ],
    [
      "VIT-13",
      engineer.id,
      "S3 Roadmap and critical path",
      `Engineering owns Product execution.

Acceptance:
- Build the eight-stage Roadmap view from real goals, projects, and issues.
- Every step has one department owner, dependency state, and evidence.
- Exactly one least-complete unblocked stage is highlighted as the constraint.
- Company Zero uses the view on itself.
- Tests and desktop/mobile verification pass.`,
    ],
    [
      "VIT-11",
      diagnostician.id,
      "S4 Diagnosis to verified impact",
      `Acceptance:
- Scan all eight departments and eight roadmap stages from real evidence.
- Explain why each surfaced problem exists.
- Rank the single binding constraint and dispatch one accountable agent.
- Record before-and-after time saved, money saved, revenue grown, or companies improved.
- Rerun after resolution and select the next constraint.
- Never mark solved without an artifact or measurable outcome.`,
    ],
  ];

  const updatedAssignments = [];
  for (const [identifier, ownerId, label, addition] of assignments) {
    const issue = issues.find((candidate) => candidate.identifier === identifier);
    if (!issue) throw new Error(`Missing issue ${identifier}`);
    let description = issue.description ?? "";
    if (addition && !description.includes(label)) {
      description += `\n\n## ${label}\n${addition}`;
    }
    const goalId = nearTermGoal?.id ?? northStar.id;
    const assignmentChanged =
      issue.projectId !== project.id ||
      issue.goalId !== goalId ||
      issue.description !== description ||
      issue.priority !== "high" ||
      issue.assigneeAgentId !== ownerId ||
      (identifier === "VIT-4" &&
        brandWorkspace &&
        issue.projectWorkspaceId !== brandWorkspace.id);
    const shouldWake = identifier === WAKE_IDENTIFIER;
    const patchPayload = {
      projectId: project.id,
      goalId,
      description,
      priority: "high",
      assigneeAgentId: ownerId,
    };
    if (identifier === "VIT-4" && brandWorkspace) {
      patchPayload.projectWorkspaceId = brandWorkspace.id;
    }
    if (shouldWake) {
      patchPayload.status = "todo";
      patchPayload.reopen = true;
      patchPayload.comment =
        `Board canary wake after runtime repair: execute ${label} and return solved evidence or the exact remaining blocker.`;
    }
    const updated = assignmentChanged || shouldWake
      ? await request("PATCH", `/issues/${issue.id}`, patchPayload)
      : issue;
    updatedAssignments.push({ identifier: updated.identifier, ownerId, status: updated.status });
  }

  if (brandWorkspace) {
    const designIssue = issues.find((issue) => issue.identifier === "VIT-4");
    const designContinuations = issues.filter(
      (issue) =>
        issue.parentId === designIssue?.id &&
        String(issue.title ?? "").toLowerCase().includes("brand worktree"),
    );
    for (const continuation of designContinuations) {
      if (continuation.projectWorkspaceId === brandWorkspace.id) continue;
      await request("PATCH", `/issues/${continuation.id}`, {
        projectWorkspaceId: brandWorkspace.id,
      });
    }
  }

  print("North star", { id: northStar.id, title: northStar.title });
  print("Project", { id: project.id, name: project.name });
  print("Shared skills", {
    imported: skillImports.reduce((total, result) => total + result.imported.length, 0),
    removedBackupDuplicates: backupSkills.length,
    warnings: skillImports.flatMap((result) => result.warnings),
  });
  print(
    "New agents",
    [coo, design, diagnostician].map((agent) => ({
      id: agent.id,
      name: agent.name,
      adapterType: agent.adapterType,
      status: agent.status,
    })),
  );
  print("S-tier assignments", updatedAssignments);
  print("Company", await request("GET", `/companies/${COMPANY_ID}`));
}

main().catch((error) => {
  console.error(error.stack ?? error.message);
  process.exitCode = 1;
});
