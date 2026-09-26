// POST /api/diagnose-form — landing page diagnosis form intake.
//
// Accepts { problem: string } from the landing page form.
// Logs the submission to the SUM board as a support issue so Adam can review
// it without any model call, metered service, or stored secret on the client.
//
// Fail-closed on board logging (if env vars are missing the request still
// returns 200 so the UI shows the thank-you state — the submission is logged
// to stderr for Vercel's built-in log drain).
//
// Config (set in Vercel project env):
//   SUMMON_API_URL         base URL of the vendor Summon API
//   SUMMON_API_KEY         bearer token for a service/agent scoped to the SUM board
//   SUMMON_SUM_COMPANY_ID  company id of Adam's SUM flagship board

export const config = { maxDuration: 15 };

const MAX_PROBLEM = 500;

function clean(raw, max) {
  return String(raw ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

// Rate-limit per IP in warm lambda memory (best-effort, ephemeral).
const seen = new Map();
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 3;

function rateLimit(ip) {
  const now = Date.now();
  const entry = seen.get(ip);
  if (!entry || now - entry.first > WINDOW_MS) {
    seen.set(ip, { first: now, count: 1 });
    return false;
  }
  if (entry.count >= MAX_PER_WINDOW) return true;
  entry.count++;
  return false;
}

async function logToBoard(problem) {
  const base = process.env.SUMMON_API_URL;
  const key = process.env.SUMMON_API_KEY;
  const company = process.env.SUMMON_SUM_COMPANY_ID;
  if (!base || !key || !company) return;

  const title = "Diagnosis request: " + problem.slice(0, 60) + (problem.length > 60 ? "..." : "");
  await fetch(`${base.replace(/\/$/, "")}/api/companies/${company}/issues`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + key },
    body: JSON.stringify({ title, description: problem, department: "Support" }),
    signal: AbortSignal.timeout(8000),
  });
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const ip = req.headers["x-forwarded-for"]?.split(",")[0].trim() ?? "unknown";
  if (rateLimit(ip)) return res.status(429).json({ error: "Too many requests." });

  let body;
  try {
    body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  } catch {
    return res.status(400).json({ error: "Invalid JSON." });
  }

  const problem = clean(body?.problem, MAX_PROBLEM);
  if (!problem) return res.status(400).json({ error: "problem is required." });

  console.log("[diagnose-form] submission:", JSON.stringify({ ip, problem: problem.slice(0, 80) }));

  try {
    await logToBoard(problem);
  } catch (err) {
    console.error("[diagnose-form] board log failed:", err?.message);
  }

  return res.status(200).json({ ok: true });
}
