// POST /api/diagnose: the Summon front door.
// A founder pastes a URL or a sentence about their business; this returns the
// stage (of Summon's 8-stage roadmap), the ONE binding constraint, a founder
// precedent from the real knowledge corpus, and the department to summon
// first with its first three tasks.
//
// OFFLINE since 2026-08-24. This route used to authenticate to the Vercel AI
// Gateway with the deployment's OIDC token and run a live model diagnosis.
// Adam's call: no project in this workspace may use the Vercel AI Gateway.
// It is a metered, per-token service billed to a card, and this endpoint is
// public and unauthenticated, so anyone could have spent his money by POSTing
// to it. Vercel's "$5/month free credits if you add a card" offer was declined
// for the same reason.
//
// The gateway client, the OIDC token fetch, and the model ladder were deleted
// outright rather than feature-flagged, so no code path can reach a paid
// provider by accident. The prompt and schema below are intentionally kept:
// they are the real work product, and they are what a future model path would
// be rebuilt on.
//
// Do not restore this by pointing it at the gateway again. If Adam restarts
// summon.company and wants the diagnosis engine live, give it a funded
// ANTHROPIC_API_KEY (or bring-your-own-key, the way skill.supply now works)
// and put an auth check in front of it so it is not a public compute endpoint.
import { CONSTRAINT_KEYS, STAGES, DEPARTMENTS, MODEL_KEYS } from "./_precedents.mjs";

export const config = { maxDuration: 10 };

function systemPrompt() {
  return [
    "You are Summon's diagnosis engine. Summon builds AI-agent companies: a founder plus eight AI departments (" +
      DEPARTMENTS.join(", ") +
      ") speedrunning an 8-stage company roadmap: " +
      STAGES.map((s, i) => `${i + 1} ${s}`).join(", ") +
      ".",
    "Given a business (a URL or a description), produce a diagnosis with theory-of-constraints thinking: name the SINGLE constraint most limiting saved time, saved money, or grown revenue right now. Not a list. One thing.",
    "House voice: plain words, no em dashes, no hype. Be concrete and specific to THIS business, never generic. If the input is a URL, reason from what that kind of business plainly is.",
    "Reply with ONLY a JSON object, no markdown fences, in exactly this shape:",
    JSON.stringify({
      business: "one line saying what this business is, in plain words",
      stage: 3,
      stageReason: "one sentence of evidence for the stage pick",
      constraint: "the one binding constraint, one sentence, specific to this business",
      constraintKey: "one of: " + CONSTRAINT_KEYS.join(", "),
      businessModelKey: "one of: " + MODEL_KEYS.join(", "),
      businessModelReason: "one sentence: why this model fits THIS business best; for idea-stage businesses weight the fastest path to a first paying customer (sell the outcome before building the machine)",
      department: "one of: " + DEPARTMENTS.join(", "),
      tasks: [
        "first task, concrete enough to start today",
        "second task",
        "third task",
      ],
      vitalsMove: "one sentence: which number moves if this works, and roughly how",
    }),
    "stage is an integer 1 to 8 against the roadmap above. constraintKey MUST be one of the listed keys. department MUST be the one best placed to attack the constraint. Tasks are for AI agents plus one human founder: specific, small, startable.",
  ].join("\n");
}

function extractJson(text, model) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("no JSON from " + model + ": " + JSON.stringify(text.slice(0, 140)));
  return JSON.parse(text.slice(start, end + 1));
}


export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();

  // No model path exists any more, so every request ends here. This returns
  // before reading the body, before any network call, and before any billable
  // work of any kind. It is deliberately a plain, cheap, constant response.
  return res.status(503).json({
    error: "The diagnosis engine is offline.",
    detail: "This endpoint no longer calls any model provider. summon.company is paused.",
  });
}
