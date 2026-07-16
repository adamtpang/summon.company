// One-shot heartbeat for VIT-103 (2026-07-16, Vitals CEO):
// 1) comment durable progress + the decision card, 2) create a request_confirmation
// board card to ratify "We sell X to Y at Z", 3) set status in_review pending it
// (wake_assignee on accept so the CEO resumes to update NORTH_STAR).
const BASE = process.env.VITALS_API_BASE ?? "http://127.0.0.1:3100/api";
const COMPANY_ID = "4a46da88-eb15-40d5-98a8-10739d4fa310";

async function request(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${text.slice(0, 500)}`);
  return text ? JSON.parse(text) : null;
}

const issues = await request("GET", `/companies/${COMPANY_ID}/issues`);
const issue = issues.find((i) => i.issueNumber === 103);
if (!issue) throw new Error("VIT-103 not found");
console.log("VIT-103 id:", issue.id, "status:", issue.status);

const comment = [
  "[Vitals CEO - VIT-103 heartbeat 2026-07-16] Offer & ICP pressure-test done. Decision card: doc/VIT-103-OFFER-ICP-DECISION-CARD.md",
  "",
  "THE CARD (plain language):",
  "- We SELL: one hireable AI employee that owns an outcome end-to-end (board approves every send/spend), fed by a free instant whole-company diagnosis, on top of a company-context file we never sell.",
  "- To WHOM: LEAD = solo technical-ish founder (1-5 projects, revenue intent, zero staff), self-serve, founder communities. EXPANSION = SMB owner-operator, service-wedge (the Quantus pattern), higher touch/LTV. Strangers only.",
  "- At WHAT PRICE: $99/employee/mo, flat, no usage metering - BUT the entry offer is ONE first employee at $99, NOT 'staff the 8-person formation for $792'. Land-and-expand grows seats per company.",
  "",
  "EVIDENCE PASS (honest, 11x rule):",
  "1. We have ZERO first-party conversion data. Revenue $0, Stripe not connected, 0 paying (market-cap snapshot: 4 companies on the plane, 0 paying, $99 anchor 0 sold). The only real external engagement (Quantus) is ICP-2-shaped: a bespoke, Adam-brokered SERVICE relationship, not a repeatable self-serve funnel. No waitlist/intake form exists in the repo, so ICP conversion is currently UNMEASURABLE - itself a finding (we haven't shipped the instrument).",
  "2. Comparables: the direct competitor Cofounder.co (General Intelligence Co.) has our EXACT 'run a whole company with AI' pitch and sells the WHOLE company of agents for $20-50/mo + usage. VenturOS flat monthly; Sintra $97/whole workspace; Lindy $49.99+/user; Devin $20 + ACU; Artisan (one SDR seat) $199+; Beam $499+ enterprise. The fast, self-serve, minutes-to-buy conversions all cluster at the technical-founder end buying a SINGLE agent. Higher-LTV buyers need a sales motion we can't run yet (no board-approved outbound). => ICP-1 self-serve is the fastest REPEATABLE first-dollar lane; ICP-2 is the service-wedge expansion lane.",
  "",
  "KILL-TEST on $99/employee: keep the UNIT, fix the BUNDLE. FOR: $99 vs $70K salary is an obvious yes; matches 'company = employees you hire'; powers the land-and-expand ARR lever; our fuel doctrine (runs on founder's own subscription, ~$0 marginal) lets us price FLAT with no metering surprise (a real edge vs Cofounder's token+compute). AGAINST: an 8-employee formation at $99 = $792/mo is 15-40x Cofounder's whole-company price - a losing first comparison and sticker shock that kills the free-diagnosis->paid conversion. VERDICT: retain $99/employee anchor (reversible), make entry = ONE first employee at $99, never the full formation at first touch. Compete on 'one accountable employee that owns a VERIFIED outcome, human as board, flat no-surprise price', not on being cheaper per agent.",
  "",
  "REVERSIBILITY: price/packaging are reversible (cheap to change). Positioning ('AI EMPLOYEES you HIRE, the human is the BOARD') is STICKY - commit to it, hold pricing loosely.",
  "WHAT WOULD CHANGE MY MIND: live conversion data showing founders reject per-employee pricing but convert at a flat whole-formation price -> flip the unit; or ICP-1 self-serve failing to make a repeatable first dollar while service-led ICP-2 succeeds -> lead with the service lane.",
  "",
  "DISPOSITION: in_review - board ratification card on this issue (request_confirmation, wake_assignee). On ACCEPT I update NORTH_STAR with the ratified sentence and close VIT-103. No external sends were made; research + packaging only.",
].join("\n");

await request("POST", `/issues/${issue.id}/comments`, { body: comment });
console.log("comment posted");

const ratifiedSentence = [
  "We sell hireable AI employees ($99/employee/mo, flat - start with one, not the whole",
  "formation), fed by a free whole-company diagnosis, to solo technical founders first and",
  "SMB owner-operators as the higher-touch expansion lane; strangers only.",
].join(" ");

const interaction = await request("POST", `/issues/${issue.id}/interactions`, {
  kind: "request_confirmation",
  idempotencyKey: `confirmation:${issue.id}:offer-icp-decision-card:2026-07-16`,
  continuationPolicy: "wake_assignee",
  payload: {
    version: 1,
    prompt: [
      "Ratify the offer & ICP decision (full card: doc/VIT-103-OFFER-ICP-DECISION-CARD.md)?",
      "",
      "WE SELL one hireable AI employee (owns an outcome end-to-end, board approves every send/spend), fed by a free whole-company diagnosis, on a never-sold company-context moat.",
      "TO solo technical-ish founders first (self-serve, founder communities); SMB owner-operators as the higher-touch expansion lane (the Quantus service pattern). Strangers only.",
      "AT $99/employee/mo, flat, no metering - entry offer = ONE first employee at $99, NOT the $792 full formation. Land-and-expand grows seats.",
      "",
      "Why: $99 vs a $70K salary is an obvious small first check; a free diagnosis earns the ask; accumulating company context makes leaving expensive. Selling the whole formation up front loses to Cofounder.co ($20-50/mo for a whole company of agents).",
      "Reversibility: price/packaging reversible; the positioning ('AI employees you hire, human is the board') is sticky.",
      "",
      "Accepting = ratify. On acceptance I update NORTH_STAR with this sentence and close VIT-103:",
      `\"${ratifiedSentence}\"`,
      "",
      "Reject with a reason (e.g. different unit, different lead ICP, different price) and I revise the card.",
    ].join("\n"),
    acceptLabel: "Ratify - update NORTH_STAR",
    rejectLabel: "Request changes",
    rejectRequiresReason: true,
    supersedeOnUserComment: true,
  },
});
console.log("interaction created:", interaction.id ?? JSON.stringify(interaction).slice(0, 200));

const patched = await request("PATCH", `/issues/${issue.id}`, { status: "in_review" });
console.log("status ->", patched.status);
