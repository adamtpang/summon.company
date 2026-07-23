// POST /api/feedback-digest — weekly roll-up of customer feedback for the board.
//
// SUM-192, item 4: "Haven summarizes the week's scores (average, detractors,
// verbatims) for the board." The per-instance intake (feedback.mjs) files ONE
// ticket per customer instance per week. This endpoint scans that week's
// feedback tickets, computes the numbers a human wants at a glance, and posts a
// single digest onto the SUM board routed to Haven:
//
//   - N instances reporting, average stars
//   - detractors (<=2 stars) with their reasons
//   - every verbatim "why not a 5", grouped by score
//
// Trigger it from a weekly cron (Vercel Cron / GitHub Action) or by Haven:
//   curl -X POST https://summon.company/api/feedback-digest \
//        -H "X-Feedback-Token: $FEEDBACK_DIGEST_TOKEN"
// Optional body {"week":"2026-W29"} overrides the target week (defaults to the
// current ISO week). Idempotent per week: one digest ticket, refreshed by a new
// comment on re-run rather than a second ticket.

export const config = { maxDuration: 30 };

// ---- env / board plumbing (mirrors feedback.mjs) ----------------------------

function apiBase() {
  const raw = process.env.SUMMON_API_URL;
  if (!raw) return null;
  return raw.trim().replace(/\/+$/, "").replace(/\/api$/, "");
}

function authHeaders() {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${process.env.SUMMON_API_KEY}`,
  };
}

// A digest write is an internal/admin action, not an open intake, so it is
// fail-closed on a token: FEEDBACK_DIGEST_TOKEN, falling back to the intake
// token. Without either configured we refuse (never let anyone spawn board
// tickets by hitting a public URL).
function digestTokenOk(req) {
  const expected = (process.env.FEEDBACK_DIGEST_TOKEN || process.env.FEEDBACK_INTAKE_TOKEN || "").trim();
  if (!expected) return false;
  const got = String(req.headers?.["x-feedback-token"] ?? "").trim();
  if (got.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i += 1) diff |= got.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

// ---- ISO week (matches isoWeekId() in the widget) ---------------------------

const WEEK_RE = /^\d{4}-W\d{2}$/;

function isoWeekId(now = new Date()) {
  const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

// ---- parsing the week's feedback tickets ------------------------------------

const DIGEST_MARKER = (week) => `[fbdigest:${week}]`;

/** Pull the primary star rating from a title like "...: 3/5 · acme · 2026-W29". */
function ratingFromTitle(title) {
  const m = /(\b[0-5])\/5\b/.exec(String(title ?? ""));
  return m ? Number(m[1]) : null;
}

/** Instance id from the dedupe marker "[fb:<instance>:<week>]". */
function instanceFromMarker(text, week) {
  const m = new RegExp(`\\[fb:([^:\\]]+):${week.replace(/[-]/g, "\\$&")}\\]`).exec(String(text ?? ""));
  return m ? m[1] : null;
}

/** The customer's verbatim, if any, from the ticket body's "Why not a 5:" line. */
function whyFromDescription(desc) {
  const line = String(desc ?? "")
    .split("\n")
    .find((l) => l.startsWith("Why not a 5:"));
  if (!line) return "";
  const v = line.slice("Why not a 5:".length).trim();
  return v && v !== "(no reason given)" ? v : "";
}

async function listWeekTickets(base, companyId, week) {
  const url = `${base}/api/companies/${encodeURIComponent(companyId)}/issues?limit=200`;
  const res = await fetch(url, { headers: authHeaders() });
  if (!res.ok) throw new Error(`list issues ${res.status}`);
  const body = await res.json().catch(() => null);
  const issues = Array.isArray(body) ? body : body?.issues ?? [];
  const wanted = `:${week}]`;
  return issues.filter(
    (i) => typeof i?.title === "string" && i.title.includes("[fb:") && i.title.includes(wanted),
  );
}

/** Description is not always in the list payload; fetch detail only when missing. */
async function descriptionFor(base, issue) {
  if (typeof issue?.description === "string") return issue.description;
  try {
    const res = await fetch(`${base}/api/issues/${encodeURIComponent(issue.id)}`, { headers: authHeaders() });
    if (!res.ok) return "";
    const body = await res.json().catch(() => ({}));
    return typeof body?.description === "string" ? body.description : "";
  } catch {
    return "";
  }
}

/** Turn the week's tickets into the numbers and verbatims a human wants. */
export async function buildDigest(base, companyId, week) {
  const tickets = await listWeekTickets(base, companyId, week);
  const rows = [];
  for (const t of tickets) {
    const rating = ratingFromTitle(t.title);
    if (rating == null) continue;
    const instanceId = instanceFromMarker(t.title, week) ?? "unknown";
    const why = whyFromDescription(await descriptionFor(base, t));
    rows.push({ instanceId, rating, why });
  }
  rows.sort((a, b) => a.rating - b.rating || a.instanceId.localeCompare(b.instanceId));

  const n = rows.length;
  const avg = n ? rows.reduce((s, r) => s + r.rating, 0) / n : null;
  const detractors = rows.filter((r) => r.rating <= 2);
  const promoters = rows.filter((r) => r.rating >= 5);
  return { week, n, avg, rows, detractors, promoters };
}

/** The board-facing markdown a human reads at a glance. */
export function renderDigest(d) {
  const lines = [`Weekly customer feedback digest — ${d.week} ${DIGEST_MARKER(d.week)}`, ``];
  if (!d.n) {
    lines.push(`No customer feedback submitted this week.`);
    return lines.join("\n");
  }
  lines.push(
    `Instances reporting: ${d.n}`,
    `Average stars: ${d.avg.toFixed(2)}/5`,
    `Detractors (<=2): ${d.detractors.length}`,
    `Promoters (5/5): ${d.promoters.length}`,
    ``,
  );
  if (d.detractors.length) {
    lines.push(`Detractors — reach out first (deliver WOW):`);
    for (const r of d.detractors) lines.push(`  - ${r.instanceId} · ${r.rating}/5 · ${r.why || "(no reason given)"}`);
    lines.push(``);
  }
  const verbatims = d.rows.filter((r) => r.rating < 5 && r.why);
  if (verbatims.length) {
    lines.push(`All "why not a 5" verbatims:`);
    for (const r of verbatims) lines.push(`  - [${r.rating}/5] ${r.instanceId}: ${r.why}`);
    lines.push(``);
  }
  return lines.join("\n").trimEnd();
}

async function findDigestTicket(base, companyId, week) {
  const url = `${base}/api/companies/${encodeURIComponent(companyId)}/issues?limit=200`;
  const res = await fetch(url, { headers: authHeaders() });
  if (!res.ok) throw new Error(`list issues ${res.status}`);
  const body = await res.json().catch(() => null);
  const issues = Array.isArray(body) ? body : body?.issues ?? [];
  const marker = DIGEST_MARKER(week);
  return issues.find((i) => typeof i?.title === "string" && i.title.includes(marker)) ?? null;
}

// ---- handler ----------------------------------------------------------------

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Feedback-Token");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST to build the weekly digest." });

  if (!digestTokenOk(req)) return res.status(401).json({ error: "Invalid or missing digest token." });

  const base = apiBase();
  if (!base || !process.env.SUMMON_API_KEY || !process.env.SUMMON_SUM_COMPANY_ID) {
    return res.status(503).json({ error: "Feedback digest is not configured yet." });
  }
  const companyId = process.env.SUMMON_SUM_COMPANY_ID.trim();

  const week = String(req.body?.week ?? "").trim() || isoWeekId();
  if (!WEEK_RE.test(week)) return res.status(400).json({ error: "week must look like 2026-W29." });

  try {
    const digest = await buildDigest(base, companyId, week);
    const rendered = renderDigest(digest);
    const existing = await findDigestTicket(base, companyId, week);

    if (existing) {
      // Refresh in place: a new comment carrying the latest numbers.
      const r = await fetch(`${base}/api/issues/${encodeURIComponent(existing.id)}/comments`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ body: `Digest refreshed.\n\n${rendered}` }),
      });
      if (!r.ok) throw new Error(`append digest ${r.status}`);
      return res.status(200).json({ status: "refreshed", issueId: existing.id, ...summary(digest) });
    }

    const payload = {
      title: `Weekly feedback digest: ${digest.n} instances · avg ${digest.avg == null ? "n/a" : digest.avg.toFixed(2)}/5 · ${week} ${DIGEST_MARKER(week)}`,
      status: "todo",
      priority: digest.detractors.length ? "high" : "medium",
      description: rendered,
    };
    const haven = process.env.SUMMON_HAVEN_AGENT_ID?.trim();
    if (haven) payload.assigneeAgentId = haven;

    const r = await fetch(`${base}/api/companies/${encodeURIComponent(companyId)}/issues`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
    if (!r.ok) {
      const detail = await r.text().catch(() => "");
      throw new Error(`create digest ${r.status}: ${detail.slice(0, 200)}`);
    }
    const created = await r.json().catch(() => ({}));
    return res.status(201).json({ status: "created", issueId: created?.id ?? null, ...summary(digest) });
  } catch (err) {
    return res
      .status(502)
      .json({ error: "Could not build the digest.", detail: String(err?.message ?? "").slice(0, 200) });
  }
}

function summary(d) {
  return { week: d.week, count: d.n, average: d.avg, detractors: d.detractors.length };
}
