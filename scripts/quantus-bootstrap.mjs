// Quantus onboarding: summon.company's first external client company.
// Mirrors scripts/vitals-company-zero-bootstrap.mjs (same control plane, same API).
// Additive only: creates/updates the Quantus company, goal, project, agents, and
// QTM issues. Never touches Company Zero, never restarts the control plane.
// All agents start heartbeat-OFF; wake one explicitly with --wake=QTM-n.
//
// Governance: Quantus is a CLIENT. Adam is ambassador/broker/white-hat, not Quantus
// core. Agents draft and verify; they never send external communications, never
// impersonate Quantus, and never publish. Evidence lands on the issue for board review.

const API_BASE = process.env.VITALS_API_BASE ?? "http://127.0.0.1:3100/api";
const QUANTUS_ENGAGEMENT_ROOT = "C:\\Users\\adamp\\OneDrive\\Aether\\quantus";
const MINER_FORK_ROOT = "C:\\Users\\adamp\\OneDrive\\Aether\\quantus.com";
const WAKE_IDENTIFIER =
  process.argv.find((argument) => argument.startsWith("--wake="))?.slice("--wake=".length) ??
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

const strongModel = {
  model: "gpt-5.5",
  modelReasoningEffort: "high",
  env: { CODEX_HOME: "C:\\Users\\adamp\\.codex" },
};
const cheapModel = {
  enabled: true,
  label: "Fast Codex",
  adapterConfig: { model: "gpt-5.5", modelReasoningEffort: "low" },
};
const commonRuntime = {
  heartbeat: { enabled: false, maxConcurrentRuns: 1 },
  modelProfiles: { cheap: cheapModel },
};

const sharedGovernance = `## Governance (binding)
- Quantus is a CLIENT of summon.company. You act for Adam's engagement with Quantus
  (ambassador, broker via asap.deals, white-hat reviewer) - you are NOT Quantus core.
- Draft-only externally: never send messages, emails, or posts outside the control
  plane; never impersonate Quantus; never publish. Produce drafts + evidence on the issue.
- Evidence or it did not happen: every claim needs an artifact (file path, PR link,
  test output, CRM row, screenshot).
- Never restart, migrate, or reconfigure the control plane. Never touch other companies.
- Spend stays inside your monthly budget cap. Stop and report when blocked on a
  board-only decision (Adam) or a Quantus-core decision (Chris Smith, Joe Mattia,
  Nikolaus Heger).

## Key artifacts on disk
- Engagement workspace: ${QUANTUS_ENGAGEMENT_ROOT} (launch-audit/, brokering/,
  marketing/, product/, company-context.md, QUANTUS.md)
- Security review: ${QUANTUS_ENGAGEMENT_ROOT}\\launch-audit\\SECURITY-REPORT.md (2026-07-14)
- Disclosure draft: ${QUANTUS_ENGAGEMENT_ROOT}\\launch-audit\\disclosure-to-chris.md
- Wallet bug diagnosis: ${QUANTUS_ENGAGEMENT_ROOT}\\product\\wallet-tx-diagnosis.md
- Investor pipeline: ${QUANTUS_ENGAGEMENT_ROOT}\\brokering\\ + asap.deals CRM
  (Neon project silent-surf-52786443, contacts table)
- Miner fork: ${MINER_FORK_ROOT} (upstream github.com/Quantus-Network/quantus-miner)`;

const agentInstructions = {
  "Quantus CEO": `# Quantus CEO (engagement lead)
You run summon.company's Quantus engagement end to end. Own the diagnosis loop:
keep the eight-department picture current, keep exactly one binding constraint
ranked first, dispatch the accountable agent, verify evidence before accepting
anything as done, and rerun the diagnosis after each resolution.

Current S-tier order (2026-07-15): QTM-1 keystore CRITICAL disclosure+fix verified,
QTM-2 anchor investor for the $6M round (deadline already due), QTM-3 QDay 2026
(Oct 8, Singapore) as the investor-closing venue, QTM-4 wallet send bug, QTM-5
raise instrument. Deadline math: TOKEN2049 SG is Oct 7-8; ~12 weeks out.

${sharedGovernance}`,
  "Quantus Engineer": `# Quantus Engineer
You own QTM-1 (keystore CRITICAL) and QTM-4 (wallet send bug). Both are in
UPSTREAM repos (Quantus-Network/quantus-cli, Quantus-Network/quantus-apps) that
you may need to clone read-only into a scratch workspace for analysis. Your
deliverables are: verified root cause, a concrete patch (diff or PR-ready branch
on Adam's forks), regression tests, and reproduction/verification evidence.
Coordinate handoff to Quantus core (Nikolaus Heger / n13 merges releases) through
Adam - you never push to upstream or contact the team directly.

${sharedGovernance}`,
  "Quantus Dealmaker": `# Quantus Dealmaker (Sales)
You own QTM-2: get the $6M round (~5% at $120M) to a signed anchor. The deadline
(2026-07-15) is already due, so every day counts. Work the warm pipeline to dated
next steps: Fulgur Asia / Alex Mann (warm, expected at TOKEN2049 SG - anchor-lead
candidate), Ocular/Openspace via Derek ("best structural fit"), Curious Ventures /
Ashish Sood ($250-500K checks). Source of truth: asap.deals CRM (Neon
silent-surf-52786443, contacts table) + ${QUANTUS_ENGAGEMENT_ROOT}\\brokering\\.
Deliverables: draft outreach sequences for Adam to send, an updated pipeline with
stages and dates, meeting-prep briefs, and a raise one-pager. You draft; Adam sends.

${sharedGovernance}`,
  "Quantus Event Marketer": `# Quantus Event Marketer
You own QTM-3: make Quantus's EXISTING QDay 2026 (2026-10-08, Singapore, invite-only
60-80 delegates, Balaji anchor, lands on TOKEN2049 day 2) the investor-closing venue.
Do NOT design a competing event - Quantus owns q.day and the summit exists. Deliverables:
a proposal memo defining Adam's role (co-host / investor-track curator) for Chris/Joe,
a curated investor guest list (>=6) mapped to the raise pipeline, an invite draft, and
- only if a distinct satellite is warranted - a TOKEN2049-week Luma listing plan.

${sharedGovernance}`,
  "Quantus Counsel Support": `# Quantus Counsel Support (Legal - draft only)
You own QTM-5: the raise cannot close into nothing. Deliverables: a decision memo on
instrument (SAFT vs equity vs token warrant) with pros/cons for a Wyoming-registered
pre-mainnet L1, a checklist of what counsel must confirm, a draft term-sheet skeleton
clearly watermarked DRAFT - NOT LEGAL ADVICE, and the open-questions list for Quantus
core (who is counsel? which entity issues?). You are not a lawyer and never give legal
advice; everything you produce is preparation FOR counsel.

${sharedGovernance}`,
};

const issueSet = [
  {
    key: "QTM-1",
    title: "Confirm receipt of and ship a verified fix for the wallet-keystore CRITICAL before any mainnet or TGE",
    ownerName: "Quantus Engineer",
    priority: "critical",
    description: `WHY: The 2026-07-14 white-hat static review (${QUANTUS_ENGAGEMENT_ROOT}\\launch-audit\\SECURITY-REPORT.md) confirms one CRITICAL: quantus-cli/src/wallet/keystore.rs:215-233 derives the AES-256 key from the Argon2 digest AND persists the full PHC hash beside the ciphertext, so any wallet .json alone decrypts the BIP39 mnemonic + ML-DSA-87 key with no password. The review says "Not a launch certificate." Shipping mainnet like this on a security-branded chain risks day-one user-fund loss.

DISCLOSURE STATUS: the on-disk disclosure (launch-audit/disclosure-to-chris.md) is a DRAFT addressed to Chris/Joe. Adam reports he messaged Nick (Nikolaus Heger / n13) - first step is confirming it was received and acknowledged by Quantus core.

ACCEPTANCE:
- Written acknowledgment from a Quantus core owner (Chris Smith, Joe Mattia, or Nikolaus Heger) that the disclosure was received.
- Fix (store salt + Argon2 params only; re-derive key at decrypt) merged upstream or PR-ready on Adam's fork with the diff attached.
- Regression test proving a wallet .json alone cannot decrypt without the password.
- Adam's own OneDrive-synced CLI wallet rotated to a new keystore.
- Miner TLS gap (quic.rs:312 InsecureCertVerifier) filed as a linked follow-up issue, not bundled here.

EVIDENCE: PR link/diff + test output + acknowledgment message (redacted).`,
  },
  {
    key: "QTM-2",
    title: "Secure an anchor investor to lead the $6M round (deadline already slipped)",
    ownerName: "Quantus Dealmaker",
    priority: "critical",
    description: `WHY: The raise (~5% at $120M, $6M target, ~$2.4M raised to date) is OFF TRACK: no lead, presale commits behind, stated deadline 2026-07-15 (today). Cash is the near-term existential risk. The raise does NOT need the October event - warm intros exist now.

PIPELINE (asap.deals CRM, Neon silent-surf-52786443 + ${QUANTUS_ENGAGEMENT_ROOT}\\brokering\\): Fulgur Asia / Alex Mann (warm, interviewed mid-June, expected at TOKEN2049 SG - anchor-lead candidate), Ocular/Openspace via Derek ("best structural fit"), Curious Ventures / Ashish Sood ($250-500K), Natalie Ng, Notch (likely pass).

ACCEPTANCE:
- Draft outreach/follow-up for each top-3 warm investor, ready for Adam to send.
- Each top-3 investor moved to a dated next step (call booked or explicit pass) in the CRM.
- A raise one-pager (story, terms, traction, quantum-security moment) for the anchor conversation.
- Engagement terms for brokered intros confirmed with Adam (CRM notes "first deal free") so fees are unambiguous.
- Signed lead commit OR a board-approved revised close date backed by the dated pipeline.

EVIDENCE: drafts, CRM stage changes with dates, the one-pager, and (when it lands) the term sheet. Depends on QTM-5 for the instrument.`,
  },
  {
    key: "QTM-3",
    title: "Anchor Quantus's existing QDay 2026 (Oct 8, Singapore) as the investor-closing venue",
    ownerName: "Quantus Event Marketer",
    priority: "high",
    description: `WHY + REFRAME: The stated priority was "a Q-Day side event at TOKEN2049" - but Quantus already owns q.day and has QDay 2026 scheduled for 2026-10-08 in Singapore (invite-only, 60-80 delegates, Balaji + exec team), landing on TOKEN2049 SG day 2 (Oct 7-8, Marina Bay Sands). A competing event would collide with the company's own summit. ~12 weeks out: the leverage is plugging in and aiming it at the raise.

ACCEPTANCE:
- Proposal memo for Chris/Joe defining Adam's role (co-host / investor-track curator) - draft for Adam to send.
- Curated investor guest list (>=6) mapped to the raise pipeline (Alex Mann already expected at TOKEN2049).
- Invite draft + run-of-show suggestion for an investor track/segment.
- Only if a distinct satellite is genuinely warranted: a TOKEN2049-week Luma listing plan (luma.com/cryptosideevents).

EVIDENCE: the memo, the guest list, Quantus's written role confirmation (via Adam), and any listing URL.`,
  },
  {
    key: "QTM-4",
    title: "Fix the wallet 'failed submitting transaction' bug that blocks new-user activations",
    ownerName: "Quantus Engineer",
    priority: "high",
    description: `WHY: Diagnosed 2026-07-12 (${QUANTUS_ENGAGEMENT_ROOT}\\product\\wallet-tx-diagnosis.md): the Quantus-Network/quantus-apps Flutter monorepo fails at UI -> RegularSendStrategy.submit -> TransactionSubmissionService, blocking a new user's FIRST send. It caps Adam's ambassador goal (100 wallet activations in 3 months) and undercuts the security narrative used in the raise.

ACCEPTANCE:
- Root cause confirmed against current quantus-apps source (clone read-only; the 07-12 diagnosis is the starting hypothesis, not the conclusion).
- Patch merged upstream or PR-ready on a fork with diff attached.
- A successful testnet send verified on BOTH iOS and Android (recorded evidence).
- Activation funnel measured before vs after where data exists.

EVIDENCE: PR/diff, recorded sends, activation counts. Coordinate with QTM-1 owner (same wallet surface).`,
  },
  {
    key: "QTM-5",
    title: "Stand up the raise instrument and token-sale compliance wrapper so the round can close",
    ownerName: "Quantus Counsel Support",
    priority: "high",
    description: `WHY: An anchor cannot sign into nothing. The $6M raise and eventual QUAN TGE create securities exposure with no evidence of a SAFT/instrument, entity decision, or named counsel. Gating dependency under QTM-2; must run in parallel.

ACCEPTANCE (all DRAFT-ONLY, for counsel review - never legal advice):
- Decision memo: SAFT vs equity vs token warrant for a Wyoming-registered (Sheridan) pre-mainnet L1, with pros/cons and precedents.
- Draft term-sheet skeleton watermarked DRAFT - NOT LEGAL ADVICE.
- Presale-commit compliance checklist (what counsel must confirm).
- Open-questions list for Quantus core: who is counsel, which entity issues, board sign-off path.

EVIDENCE: the memo, the skeleton, the checklists. Board/counsel-gated: nothing here is executed, only prepared.`,
  },
];

async function main() {
  // 1. Company (idempotent by name)
  const companies = await request("GET", "/companies");
  const companyList = Array.isArray(companies) ? companies : companies.companies ?? [];
  let company = companyList.find((candidate) => candidate.name === "Quantus");
  if (!company) {
    company = await request("POST", "/companies", {
      name: "Quantus",
      issuePrefix: "QTM",
      description:
        "Client company: Quantus Network - post-quantum L1 (testnet live, 247 validators; mainnet pending security fixes). Engagement: close the $6M round, weaponize QDay 2026 (Oct 8, Singapore) for the raise, and clear the security + wallet blockers to mainnet. Adam is ambassador/broker/white-hat; agents draft, the board sends.",
      budgetMonthlyCents: 5000,
    });
  }
  const companyId = company.id;
  await request("PATCH", `/companies/${companyId}`, {
    requireBoardApprovalForNewAgents: true,
  });

  // 2. Agents (idempotent by name; CEO first, everyone reports to CEO)
  let agents = await request("GET", `/companies/${companyId}/agents`);
  const agentsByName = Object.fromEntries(agents.map((agent) => [agent.name, agent]));

  async function hire(specification) {
    const existing = agentsByName[specification.name];
    if (existing) {
      const updated = await request("PATCH", `/agents/${existing.id}`, {
        title: specification.title,
        reportsTo: specification.reportsTo,
        capabilities: specification.capabilities,
        adapterType: specification.adapterType,
        adapterConfig: { ...(existing.adapterConfig ?? {}), ...(specification.adapterConfig ?? {}) },
        runtimeConfig: specification.runtimeConfig,
        budgetMonthlyCents: specification.budgetMonthlyCents,
        metadata: { ...(existing.metadata ?? {}), ...(specification.metadata ?? {}) },
      });
      const instructions = specification.instructionsBundle?.files?.["AGENTS.md"];
      if (instructions) {
        await request("PUT", `/agents/${updated.id}/instructions-bundle/file`, {
          path: "AGENTS.md",
          content: instructions,
          entryFile: "AGENTS.md",
        });
      }
      agentsByName[updated.name] = updated;
      return updated;
    }
    const result = await request("POST", `/companies/${companyId}/agent-hires`, specification);
    const agent = result.agent ?? result;
    agentsByName[agent.name] = agent;
    return agent;
  }

  const ceo = await hire({
    name: "Quantus CEO",
    role: "ceo",
    title: "Engagement lead - diagnosis loop, constraint ranking, evidence verification",
    capabilities:
      "Whole-company diagnosis, S-tier ranking, dispatching accountable agents, verifying evidence, board reporting.",
    adapterType: "codex_local",
    adapterConfig: strongModel,
    runtimeConfig: commonRuntime,
    budgetMonthlyCents: 1500,
    permissions: { canCreateAgents: false, canCreateSkills: false, trustPreset: "standard" },
    metadata: { department: "ceo", client: "quantus", providerNeutral: true },
    instructionsBundle: { entryFile: "AGENTS.md", files: { "AGENTS.md": agentInstructions["Quantus CEO"] } },
  });

  const roster = [
    {
      name: "Quantus Engineer",
      role: "engineer",
      title: "Engineering - keystore CRITICAL fix and wallet activation bug",
      capabilities:
        "Rust (quantus-cli keystore, Argon2/AES), Flutter (quantus-apps tx submission), static analysis, regression tests, PR-ready patches on forks.",
      department: "engineering",
    },
    {
      name: "Quantus Dealmaker",
      role: "general",
      title: "Sales - anchor investor for the $6M round",
      capabilities:
        "Investor pipeline management, outreach drafting, meeting-prep briefs, raise one-pagers, CRM hygiene (asap.deals/Neon).",
      department: "sales",
    },
    {
      name: "Quantus Event Marketer",
      role: "general",
      title: "Marketing - QDay 2026 as the investor-closing venue",
      capabilities:
        "Event strategy, investor guest-list curation, proposal memos, invite drafting, TOKEN2049-week side-event landscape.",
      department: "marketing",
    },
    {
      name: "Quantus Counsel Support",
      role: "general",
      title: "Legal (draft-only) - raise instrument and compliance prep",
      capabilities:
        "Instrument decision memos (SAFT/equity/token warrant), draft term-sheet skeletons, compliance checklists - all prepared FOR counsel, never legal advice.",
      department: "legal",
    },
  ];

  const hired = { [ceo.name]: ceo };
  for (const member of roster) {
    hired[member.name] = await hire({
      name: member.name,
      role: member.role,
      title: member.title,
      reportsTo: ceo.id,
      capabilities: member.capabilities,
      adapterType: "codex_local",
      adapterConfig: strongModel,
      runtimeConfig: commonRuntime,
      budgetMonthlyCents: 1000,
      permissions: { canCreateAgents: false, canCreateSkills: false, trustPreset: "standard" },
      metadata: { department: member.department, client: "quantus", providerNeutral: true },
      instructionsBundle: { entryFile: "AGENTS.md", files: { "AGENTS.md": agentInstructions[member.name] } },
    });
  }

  // 3. Goal (idempotent by title match)
  const goals = await request("GET", `/companies/${companyId}/goals`);
  let goal = goals.find((candidate) => candidate.title.includes("$6M"));
  if (!goal) {
    goal = await request("POST", `/companies/${companyId}/goals`, {
      title: "Close the $6M round, land QDay 2026, clear the path to mainnet",
      description:
        "Three-front engagement, in dependency order: (1) verify + fix the keystore CRITICAL so the security story holds, (2) sign an anchor investor for the $6M round (deadline already slipped - urgency is now), (3) turn Quantus's own QDay 2026 (2026-10-08, Singapore, TOKEN2049 day 2) into the investor-closing venue. Mainnet follows the security fix, not the calendar.",
      level: "company",
      status: "active",
      ownerAgentId: ceo.id,
    });
  }

  // 4. Project + workspace (idempotent by name)
  const projects = await request("GET", `/companies/${companyId}/projects`);
  let project = projects.find((candidate) => candidate.name === "Quantus engagement");
  if (!project) {
    project = await request("POST", `/companies/${companyId}/projects`, {
      name: "Quantus engagement",
      description:
        "summon.company's first external client. Raise, QDay 2026, and mainnet-blocking security/product fixes. One accountable agent per S-tier constraint; evidence required before anything is done.",
      status: "in_progress",
      leadAgentId: ceo.id,
      goalIds: [goal.id],
      workspace: {
        name: "Quantus engagement workspace",
        sourceType: "git_repo",
        cwd: QUANTUS_ENGAGEMENT_ROOT,
        isPrimary: true,
      },
    });
  }

  // Secondary workspace: the miner fork (optional; skip on failure)
  try {
    const workspaces = await request("GET", `/projects/${project.id}/workspaces`);
    const hasMiner = workspaces.some(
      (workspace) => workspace.cwd && workspace.cwd.toLowerCase().includes("quantus.com"),
    );
    if (!hasMiner) {
      await request("POST", `/projects/${project.id}/workspaces`, {
        name: "quantus-miner fork",
        sourceType: "git_repo",
        cwd: MINER_FORK_ROOT,
        repoUrl: "https://github.com/adamtpang/quantus.com.git",
        defaultRef: "main",
        isPrimary: false,
      });
    }
  } catch (error) {
    print("Miner workspace skipped", String(error.message ?? error));
  }

  // 5. Issues (idempotent by title)
  let issues = await request("GET", `/companies/${companyId}/issues`);
  const created = [];
  for (const spec of issueSet) {
    let issue = issues.find((candidate) => candidate.title === spec.title);
    if (!issue) {
      issue = await request("POST", `/companies/${companyId}/issues`, {
        projectId: project.id,
        goalId: goal.id,
        title: spec.title,
        description: spec.description,
        status: "todo",
        priority: spec.priority,
        assigneeAgentId: hired[spec.ownerName].id,
      });
    }
    created.push({ identifier: issue.identifier, title: spec.title, owner: spec.ownerName, status: issue.status });
  }

  // 6. Optional wake (explicit, one issue, board-invoked)
  if (WAKE_IDENTIFIER) {
    issues = await request("GET", `/companies/${companyId}/issues`);
    const target = issues.find((issue) => issue.identifier === WAKE_IDENTIFIER);
    if (!target) throw new Error(`--wake target ${WAKE_IDENTIFIER} not found`);
    await request("PATCH", `/issues/${target.id}`, {
      status: "todo",
      reopen: true,
      comment: `Board wake: execute this issue now. Return solved evidence or the exact remaining blocker. Draft-only externally; evidence on the issue.`,
    });
    print("Woke", { identifier: WAKE_IDENTIFIER });
  }

  print("Company", { id: companyId, name: company.name, issuePrefix: company.issuePrefix });
  print("Goal", { id: goal.id, title: goal.title });
  print("Project", { id: project.id, name: project.name });
  print(
    "Agents",
    Object.values(hired).map((agent) => ({ id: agent.id, name: agent.name, status: agent.status })),
  );
  print("Issues", created);
}

main().catch((error) => {
  console.error(error.stack ?? error.message);
  process.exitCode = 1;
});
