// Batch 12 (2026-07-16): Run 6 via-negativa frontend deletion audit + the
// Tinder-style decision deck steer. Idempotent by exact title.

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
  if (!r.ok) throw new Error(`${method} ${path} ${r.status}: ${JSON.stringify(data).slice(0, 250)}`);
  return data;
}

const RUN6 = {
  title: "Run 6 - via negativa: audit the entire frontend and delete to the minimalist essential",
  priority: "critical",
  ownerName: "Vitals Design Director",
  description: `WHY (board, 2026-07-16): "I want a minimalist desktop UI. Audit the entire
frontend and remove the unnecessary to get to the minimalist essential. Less the
better. Via negativa." This is the deletion half of the three-surface rule
(Chat / Mission Control / Decisions) - Elon gate 2 applied to the whole app:
"If you're not adding deleted things back in 10% of the time, you're not deleting
enough."

METHOD (reuse the campaign machinery - worktree, visual suite, DECISION-SHEET):
1. INVENTORY: every route, page, panel, dialog, sidebar section, button, and menu
   item in ui/src - one row each: what it is, when the board last needed it, which
   of the three surfaces (if any) it belongs to. Reuse the COMPONENT-INVENTORY.md
   pattern; a read-only sweep, mechanical and complete.
2. SENTENCE each row: KEEP (on a top surface - must pass the daily-action test) /
   DEMOTE (one click deep / below the fold / command-palette-only) / DELETE
   (route + code removed). Bias to DELETE: the 10% add-back rule means an
   over-conservative slate is a FAILED slate.
3. The slate goes to the board as ONE plain-language decision card ("Delete 23
   surfaces, demote 31, keep 9 - swipe through the top 10 riskiest deletions
   individually"), with before/after screenshots per top-surface change.
4. EXECUTE approved deletions in a worktree (design/run6-via-negativa), one
   deletion unit per commit, visual suite + token gates green, run6-review/
   evidence per the house discipline. Deleted code is deleted, not commented out -
   git is the archive.
5. Guardrails: no protocol/API/DB surface changes (golden rule); anything an
   ACTIVE workflow depends on gets DEMOTED not deleted until VIT-111's collapse
   lands; record every judgment call in DECISION-SHEET.
DONE WHEN: the app boots into three surfaces + settings; the inventory shows every
former surface as kept/demoted/deleted with a reason; the board approved the slate
via the decision deck; suite green on the new baseline; and at least one deletion
gets added back within two weeks (proof we cut deep enough) OR the slate is
documented as insufficiently aggressive and re-run.`,
};

const TINDER_STEER = `Board redesign (2026-07-16, BINDING): the Decisions tab is a TINDER DECK, not a
list. One decision at a time, full card, centered - never a scrolling list ("I
usually just say yes anyway - make yes effortless").

DECK MECHANICS:
- One card fills the surface: plain-language question (per the language rule),
  recommendation + why, reversibility chip, inline evidence thumbnails.
- Swipe right / y / right-arrow = APPROVE. Swipe left / n / left-arrow = REJECT
  (asks one line: why? - optional, feeds the decision log). Swipe down / d = DEFER
  to back of deck. Swipe up / enter = open details/thread (the only path to depth).
- Auto-advance to the next card; progress indicator "3 of 7"; satisfying
  clear-the-deck end state (deck empty = inbox zero moment, show the streak).
- IRREVERSIBLE cards are visually distinct (red chip) and require a deliberate
  two-step (swipe then confirm word) - fast yes for reversible, friction scaled to
  reversibility, exactly the governance doctrine.
- Batch affordance: "approve all remaining reversible" appears only after the board
  has individually decided >=3 cards this session (protects against pure
  rubber-stamping while honoring the real behavior).
- Every resolution still writes the decision log + unblocks the suspended run
  (existing VIT-72 mechanics unchanged underneath).
Mobile (VIT-73): this deck IS the phone surface - thumb swipes, lock-screen
notification opens straight into the top card.`;

async function main() {
  const agents = await request("GET", `/companies/${SUMMON_ID}/agents`);
  const byName = Object.fromEntries(agents.map((a) => [a.name, a]));
  const goals = await request("GET", `/companies/${SUMMON_ID}/goals`);
  const projects = await request("GET", `/companies/${SUMMON_ID}/projects`);
  let issues = await request("GET", `/companies/${SUMMON_ID}/issues`);

  let run6 = issues.find((c) => c.title === RUN6.title);
  if (!run6) {
    run6 = await request("POST", `/companies/${SUMMON_ID}/issues`, {
      projectId: projects[0]?.id, goalId: goals[0]?.id,
      title: RUN6.title, description: RUN6.description,
      status: "todo", priority: RUN6.priority,
      assigneeAgentId: byName[RUN6.ownerName]?.id,
    });
  }
  console.log(`${run6.identifier}  [critical]  -> ${RUN6.ownerName}`);

  const vit72 = issues.find((c) => c.identifier === "VIT-72");
  if (vit72) {
    await request("PATCH", `/issues/${vit72.id}`, { comment: TINDER_STEER });
    console.log("steered VIT-72: Tinder decision deck");
  }
  console.log("\nBatch 12 applied.");
}

main().catch((e) => { console.error(e.stack ?? e.message); process.exitCode = 1; });
