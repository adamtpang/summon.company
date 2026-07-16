// Files the "chats feel like WhatsApp with my real AI employees" product bets
// as staged issues (unassigned; board assigns/comments to start). 2026-07-15.
// Idempotent by exact title. Grounded in what already exists in the repo.

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
  if (!r.ok) throw new Error(`${method} ${path} ${r.status}: ${JSON.stringify(data).slice(0, 400)}`);
  return data;
}

async function main() {
  const goals = await request("GET", `/companies/${SUMMON_ID}/goals`);
  const projects = await request("GET", `/companies/${SUMMON_ID}/projects`);
  const goalId = goals[0]?.id;
  const projectId = projects[0]?.id;

  const issues = [
    {
      title: "Conversation continuity: every agent chat carries full transcript + CLAUDE.md context (never start from scratch)",
      priority: "high",
      proposedOwner: "Vitals Engineer (Engineering owns product execution; CTO for runtime)",
      description: `WHY: Talking to an employee should feel continuous - it should remember the last
conversation, not re-introduce itself every message. Today session continuity is
per-RUN (agent_runtime_state.sessionId holds one rolling Claude session; the
claude-local adapter resumes it via --resume with cwd/prompt-bundle guards -
packages/adapters/claude-local/src/server/execute.ts:644-697). There is no durable
per-CHAT/THREAD transcript, and CLAUDE.md/AGENTS.md context is not guaranteed to be
re-injected on resume.

SOLUTION (additive; preserve @paperclipai/* + protocol):
1. Bind a durable session/transcript to each conversation THREAD (issue/agent chat),
   not just to the agent's last run - so opening a thread resumes THAT thread's
   Claude/Codex session (--resume for claude_local; the codex equivalent).
2. On every turn, re-inject the standing context bundle: the agent's AGENTS.md
   instruction bundle + the company/repo CLAUDE.md + the thread's own history, so a
   resumed chat has the same footing as a fresh /resume in Claude Code.
3. Make resume observable in the UI: a subtle "resumed - N prior messages" affordance;
   never silently drop context. Handle the guard cases already coded (cwd mismatch,
   invalid UUID, bundle change) gracefully with a one-line reason.

ACCEPTANCE: close a chat, reopen it days later, send a message that relies on earlier
context (e.g. "what did we decide about X") and the agent answers from the thread,
not from zero. Tests for: thread->session binding, context re-injection on resume,
graceful fallback when a session can't resume. Evidence: a recorded before/after.`,
    },
    {
      title: "WhatsApp-feel messaging: a persistent per-employee chat inbox",
      priority: "medium",
      proposedOwner: "Vitals Design Director (UX-led) + Vitals Engineer",
      description: `WHY: The board should feel like they are texting their real AI employees - one
always-on thread per employee, chronological, instant, familiar. The pieces exist
(IssueChatThread, CommentThread, RunChatSurface, ChatComposer, ConferenceRoomChatGate)
but they are issue-scoped, not a messaging home.

SOLUTION (additive UI on existing components; depends on the continuity issue for the
"remembers everything" feel):
1. A Messages surface: left rail = employee list (avatar, name, persona, presence dot -
   idle/running/paused, last-message preview, unread count); right = the thread.
2. WhatsApp affordances: chronological bubbles (you right / employee left), typing/running
   indicator, timestamps + read/delivered states mapped to real run states, day dividers,
   quick composer with attachments, jump-to-latest. Reuse the design system + Run 5 brand;
   presence dot uses --status-agent-* (one vocabulary).
3. One thread per employee that spans their work (an employee's issue chats roll up into
   their personal thread), so "message my engineer" is a first-class action, not
   "find the issue then find the chat".

ACCEPTANCE: from the Messages surface, pick an employee, send "status?", get a reply in
their thread with correct presence + timestamps; unread badges clear on read; light+dark
stories join the visual suite. Board review of the WhatsApp feel before merge.`,
    },
    {
      title: "summon.guide GOAT personas: assign legendary operators to AI employees (Elon=Engineer, Rockefeller=Finance)",
      priority: "medium",
      proposedOwner: "Vitals Engineer (model + injection) + Vitals Design Director (avatar/voice)",
      description: `WHY: Employees should be able to wear a GOAT persona - Elon Musk as the AI Engineer,
Rockefeller as Finance, Ogilvy as Marketing, etc. - shaping voice, priorities, and
mental models. The concept already leaks into the system: the bootstrap stamps
metadata.guide (e.g. "Jeff Bezos") on agents, but nothing consumes it.

SOURCE MATERIAL (do not invent personas from scratch):
- summon.guide (C:\\Users\\adamp\\OneDrive\\Aether\\summon.guide): PLAYBOOK.md, BOOKS.md,
  FEATURES.md, GUIDE_ONBOARDING.md, docs/ - the persona canon.
- The thedojo legendary-founder skills pack (/elon, /rockefeller, ...) - personas already
  in executable skill form; prefer wiring these over rewriting them.

SOLUTION (additive; personas are OPTIONAL flavor, never override governance or department
ownership):
1. Data model: a first-class persona field on the agent (promote metadata.guide) with
   { id, name, department-fit, voice, principles, avatar }.
2. Injection: when an agent has a persona, prepend a persona brief to its instruction
   bundle (voice + operating principles from summon.guide / the matching /skill) WITHOUT
   weakening the binding governance block. Persona shapes HOW, never WHETHER to seek
   board approval.
3. UI: persona picker in agent config; avatar + persona name shown in the roster,
   org chart, and the messaging threads (so "Elon" answers the Engineering chat).
   A tasteful default avatar set (illustrated, not real photos - avoid impersonation
   claims; label clearly as an AI persona "in the style of").

ACCEPTANCE: assign the Elon persona to the Engineer and the Rockefeller persona to
Finance; their chat voice + priorities shift; the roster/messaging show the persona;
governance still gates every send/spend. Tests: persona injection preserves the
approval block; picker persists; default agents work with NO persona set.
GUARDRAIL: personas are "in the style of" - never claim to BE the real person, never
imply endorsement.`,
    },
  ];

  for (const spec of issues) {
    const existing = await request("GET", `/companies/${SUMMON_ID}/issues`);
    let issue = existing.find((c) => c.title === spec.title);
    if (!issue) {
      issue = await request("POST", `/companies/${SUMMON_ID}/issues`, {
        ...(projectId ? { projectId } : {}),
        ...(goalId ? { goalId } : {}),
        title: spec.title,
        description: spec.description,
        status: "todo",
        priority: spec.priority,
        // intentionally UNASSIGNED: staged for the board to start (assigning wakes the agent)
      });
    }
    console.log(`${issue.identifier}  [${spec.priority}]  ${spec.title}`);
    console.log(`   proposed owner: ${spec.proposedOwner}`);
  }
  console.log("\n3 issues staged (unassigned). Assign or comment to start.");
}

main().catch((e) => { console.error(e.stack ?? e.message); process.exitCode = 1; });
