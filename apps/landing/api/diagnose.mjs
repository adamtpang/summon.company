// POST /api/diagnose — the Summon front door.
// A founder pastes a URL or a sentence about their business; this returns the
// stage (of Summon's 8-stage roadmap), the ONE binding constraint, a founder
// precedent from the real knowledge corpus, and the department to summon
// first with its first three tasks.
//
// Zero-secret: authenticates to the Vercel AI Gateway with the deployment's
// OIDC token (no API key stored anywhere). AI_GATEWAY_API_KEY env var is the
// local-dev fallback.
import { getVercelOidcToken } from "@vercel/functions/oidc";
import { PRECEDENTS, CONSTRAINT_KEYS, STAGES, DEPARTMENTS, MODELS as BIZ_MODELS, MODEL_KEYS } from "./_precedents.mjs";

export const config = { maxDuration: 60 };

const GATEWAY = "https://ai-gateway.vercel.sh/v1";
// Candidate slugs tried best-first; the gateway's catalog and the account's
// tier decide which one answers. On the free tier this degrades toward the
// models the account can use, and it upgrades itself once credits are funded.
const MODELS = [
  "anthropic/claude-opus-4.8",
  "anthropic/claude-sonnet-5",
  "anthropic/claude-sonnet-4.5",
  "anthropic/claude-haiku-4.5",
];

async function gatewayToken() {
  if (process.env.AI_GATEWAY_API_KEY) return process.env.AI_GATEWAY_API_KEY;
  return getVercelOidcToken();
}

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

async function callGateway(token, model, input) {
  const res = await fetch(`${GATEWAY}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      model,
      max_tokens: 3200,
      messages: [
        { role: "system", content: systemPrompt() },
        { role: "user", content: `Diagnose this business: ${input}` },
      ],
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    const err = new Error(`gateway ${res.status}: ${body.slice(0, 200)}`);
    err.status = res.status;
    throw err;
  }
  const json = await res.json();
  const content = json.choices?.[0]?.message?.content ?? "";
  if (!content.trim()) {
    // Thinking consumed the budget or the model stayed silent: try the next rung.
    const err = new Error("empty content from " + model + " (finish: " + (json.choices?.[0]?.finish_reason ?? "?") + ")");
    err.status = 429;
    throw err;
  }
  return content;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();

  const token = await gatewayToken();

  // Debug: enumerate the gateway's model catalog so the slug can be pinned.
  if (req.method === "GET" && req.query?.models) {
    const r = await fetch(`${GATEWAY}/models`, { headers: { Authorization: `Bearer ${token}` } });
    const body = await r.json().catch(() => ({}));
    const ids = (body.data ?? []).map((m) => m.id).filter((id) => /claude|anthropic/i.test(id));
    return res.status(200).json({ status: r.status, claudeModels: ids });
  }

  if (req.method !== "POST") return res.status(405).json({ error: "POST a JSON body: {input}" });

  const input = String(req.body?.input ?? "").trim().slice(0, 2000);
  if (input.length < 4) return res.status(400).json({ error: "Describe the business or paste a URL." });

  let lastError = null;
  for (const model of MODELS) {
    try {
      const text = await callGateway(token, model, input);
      const parsed = extractJson(text, model);
      const key = CONSTRAINT_KEYS.includes(parsed.constraintKey) ? parsed.constraintKey : "focus";
      const stage = Math.min(8, Math.max(1, Number(parsed.stage) || 1));
      const department = DEPARTMENTS.includes(parsed.department) ? parsed.department : "Operations";
      const modelKey = MODEL_KEYS.includes(parsed.businessModelKey) ? parsed.businessModelKey : "productized_service";
      return res.status(200).json({
        business: parsed.business,
        stage,
        stageName: STAGES[stage - 1],
        stageReason: parsed.stageReason,
        constraint: parsed.constraint,
        precedent: PRECEDENTS[key],
        businessModel: { key: modelKey, ...BIZ_MODELS[modelKey], reason: parsed.businessModelReason },
        department,
        tasks: (parsed.tasks ?? []).slice(0, 3),
        vitalsMove: parsed.vitalsMove,
        model,
      });
    } catch (err) {
      lastError = err;
      // Unknown slug or tier-blocked model: try the next candidate.
      if (err.status === 404 || err.status === 400 || err.status === 403 || err.status === 429) continue;
      break;
    }
  }
  return res.status(502).json({ error: "Diagnosis engine unavailable. Try again in a minute.", detail: String(lastError?.message ?? "").slice(0, 200) });
}
