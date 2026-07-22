// POST /api/feedback — hosted feedback intake for CUSTOMER Summon instances.
//
// The in-app feedback widget (weekly 2-field survey: 0-5 stars + why-not-5)
// files support tasks on the LOCAL board when the instance is the vendor's own.
// For customer instances it cannot reach the vendor's board directly, so it
// POSTs here instead. This endpoint takes {instanceId, rating, why, week,
// context}, dedupes per instance+week, and files ONE support task on Adam's SUM
// board routed to Haven, appending a weekly digest comment when more than one
// submission lands for the same instance in the same ISO week.
//
// Doctrine (board, 2026-07-19): rate limited, no PII beyond what the customer
// typed, fail-closed if the board credentials are not configured.
//
// Config (set in Vercel project env — never commit these):
//   SUMMON_API_URL         base URL of the vendor Summon API (e.g. https://summon.company)
//   SUMMON_API_KEY         bearer token for a service/agent scoped to the SUM board
//   SUMMON_SUM_COMPANY_ID  company id of Adam's SUM flagship board
//   SUMMON_HAVEN_AGENT_ID  (optional) Haven's agent id; when set, tickets route to Haven
//
// SUM-190. This is the CUSTOMER-instance counterpart to the local-board path in
// ui/src/components/FeedbackWidget.tsx.

export const config = { maxDuration: 30 };

// ---- input hygiene (no PII beyond what the customer typed) -------------------

const WEEK_RE = /^\d{4}-W\d{2}$/; // matches isoWeekId() in the widget
const MAX_WHY = 1000; // one honest sentence, not a data dump
const MAX_CONTEXT = 300; // path + timestamp the widget stamps, nothing more
const MAX_INSTANCE_ID = 128;

/** Opaque instance id: keep it boring so it can never smuggle markup or PII. */
function cleanInstanceId(raw) {
  const s = String(raw ?? "").trim().slice(0, MAX_INSTANCE_ID);
  return /^[A-Za-z0-9._:-]+$/.test(s) ? s : null;
}

function cleanRating(raw) {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0 || n > 5) return null;
  return n;
}

/** Collapse whitespace and cap length. We store EXACTLY what they typed, capped. */
function cleanText(raw, max) {
  return String(raw ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

// ---- best-effort rate limiting ----------------------------------------------
// Serverless memory is per-lambda and ephemeral, so this is a warm-instance
// speed bump, not a durable guard. The real bound on ticket volume is the
// per-instance+week dedup below: one ticket per instance per week, forever.
// A durable limiter (Vercel KV / Upstash) is the follow-up if abuse appears.

const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_INSTANCE_PER_WINDOW = 6;
const hits = new Map(); // instanceId -> number[] (timestamps)

function rateLimited(instanceId, now) {
  const recent = (hits.get(instanceId) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(instanceId, recent);
  if (hits.size > 5000) hits.clear(); // crude memory ceiling; correctness rides on dedup
  return recent.length > MAX_PER_INSTANCE_PER_WINDOW;
}

// ---- vendor board (Summon API) ----------------------------------------------

function apiBase() {
  const raw = process.env.SUMMON_API_URL;
  if (!raw) return null;
  let base = raw.trim().replace(/\/+$/, "");
  base = base.replace(/\/api$/, ""); // normalize whether or not /api was included
  return base;
}

function authHeaders() {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${process.env.SUMMON_API_KEY}`,
  };
}

/** Deterministic marker so the same instance+week always maps to one ticket. */
function dedupeMarker(instanceId, week) {
  return `[fb:${instanceId}:${week}]`;
}

async function findExistingTicket(base, companyId, marker) {
  // The board carries little traffic; scan the open issues and match the marker
  // embedded in the title. Closed weeks are intentionally not reopened.
  const url = `${base}/api/companies/${encodeURIComponent(companyId)}/issues?limit=200`;
  const res = await fetch(url, { headers: authHeaders() });
  if (!res.ok) throw new Error(`list issues ${res.status}`);
  const body = await res.json().catch(() => null);
  const issues = Array.isArray(body) ? body : body?.issues ?? [];
  return issues.find((i) => typeof i?.title === "string" && i.title.includes(marker)) ?? null;
}

async function createTicket(base, companyId, { instanceId, rating, why, week, context, marker }) {
  const lines = [
    `Weekly quality survey from a customer instance (support lane, route to Haven).`,
    ``,
    `Instance: ${instanceId}`,
    `Week: ${week}`,
    `Stars: ${rating}/5`,
    rating < 5 ? `Why not a 5: ${why || "(no reason given)"}` : `Perfect score.`,
    context ? `Context: ${context}` : null,
    ``,
    `Submissions this week: 1`,
    marker, // dedupe marker lives in the body too, for auditability
  ].filter((l) => l !== null);

  const payload = {
    title: `Customer feedback: ${rating}/5 · ${instanceId} · ${week} ${marker}`,
    status: "todo",
    priority: rating <= 2 ? "high" : "medium",
    description: lines.join("\n"),
  };
  const haven = process.env.SUMMON_HAVEN_AGENT_ID?.trim();
  if (haven) payload.assigneeAgentId = haven;

  const res = await fetch(`${base}/api/companies/${encodeURIComponent(companyId)}/issues`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`create issue ${res.status}: ${detail.slice(0, 200)}`);
  }
  return res.json();
}

async function appendDigest(base, issueId, { rating, why, week, context }) {
  const body = [
    `Another submission this week (${week}) for this instance.`,
    ``,
    `Stars: ${rating}/5`,
    rating < 5 ? `Why not a 5: ${why || "(no reason given)"}` : `Perfect score.`,
    context ? `Context: ${context}` : null,
  ]
    .filter((l) => l !== null)
    .join("\n");

  const res = await fetch(`${base}/api/issues/${encodeURIComponent(issueId)}/comments`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ body }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`append comment ${res.status}: ${detail.slice(0, 200)}`);
  }
  return res.json().catch(() => ({}));
}

// ---- handler ----------------------------------------------------------------

export default async function handler(req, res) {
  // Widgets on customer instances post cross-origin.
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST {instanceId, rating, why, week, context}" });
  }

  // Fail-closed: without board credentials we accept nothing (never silently drop).
  const base = apiBase();
  if (!base || !process.env.SUMMON_API_KEY || !process.env.SUMMON_SUM_COMPANY_ID) {
    return res.status(503).json({ error: "Feedback intake is not configured yet." });
  }
  const companyId = process.env.SUMMON_SUM_COMPANY_ID.trim();

  const instanceId = cleanInstanceId(req.body?.instanceId);
  const rating = cleanRating(req.body?.rating);
  const week = String(req.body?.week ?? "").trim();
  const why = cleanText(req.body?.why, MAX_WHY);
  const context = cleanText(req.body?.context, MAX_CONTEXT);

  if (!instanceId) return res.status(400).json({ error: "Missing or invalid instanceId." });
  if (rating == null) return res.status(400).json({ error: "rating must be an integer 0-5." });
  if (!WEEK_RE.test(week)) return res.status(400).json({ error: "week must look like 2026-W29." });

  const now = Date.now();
  if (rateLimited(instanceId, now)) {
    return res.status(429).json({ error: "Too many submissions. Try again shortly." });
  }

  const marker = dedupeMarker(instanceId, week);
  try {
    const existing = await findExistingTicket(base, companyId, marker);
    if (existing) {
      await appendDigest(base, existing.id, { rating, why, week, context });
      return res.status(200).json({ status: "appended", issueId: existing.id });
    }
    const created = await createTicket(base, companyId, {
      instanceId,
      rating,
      why,
      week,
      context,
      marker,
    });
    return res.status(201).json({ status: "created", issueId: created?.id ?? null });
  } catch (err) {
    return res
      .status(502)
      .json({ error: "Could not reach the feedback board.", detail: String(err?.message ?? "").slice(0, 200) });
  }
}
