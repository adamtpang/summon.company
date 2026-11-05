// Issue #28: ground the /diagnose answer in what the business's own site shows.
// Before this, the model was told to "reason from what that kind of business
// plainly is", which is a guess. This fetches a few public pages when the input
// names a URL and hands the model the facts, each with its source. A lightweight
// port of server/src/services/company-context.ts: the landing deploys on its own
// and cannot import the server's TypeScript.

const TIMEOUT_MS = 6000;
const UA = "SummonDiagnosis/1.0 (+https://summon.company)";
const PRICE_RE = /(?:[$€£]\s?\d[\d,]*(?:\.\d{2})?)/g;
const CTA_RE = /\b(book a (?:call|demo)|get a quote|buy now|sign up|start (?:free|now|your)|contact us|schedule|order now|get started)\b/gi;
const CTA_HREF_RE = /href=["']([^"']*(?:\/(?:contact|book|booking|demo|schedule|signup|sign-up|get-started|start|checkout|buy|order|quote|apply)\b|buy\.stripe\.com|calendly\.com|cal\.com|mailto:)[^"']*)["']/gi;
const PROOF_RE = /\b(testimonials?|case stud(?:y|ies)|trusted by|reviews?|clients include)\b/gi;

/** The first http(s) URL or bare domain in the input, normalized to an origin, or null. */
export function findUrl(input) {
  const text = String(input ?? "");
  const explicit = text.match(/https?:\/\/[^\s"'<>]+/i);
  const bare = text.match(/\b(?:[a-z0-9-]+\.)+[a-z]{2,}\b/i);
  const raw = explicit?.[0] ?? (bare ? `https://${bare[0]}` : null);
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (!/^https?:$/.test(url.protocol)) return null;
    return url.origin;
  } catch {
    return null;
  }
}

function decode(text) {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&rsquo;/g, "'")
    .replace(/&quot;/g, '"');
}

function visibleText(html) {
  return html
    .replace(/<(script|style|noscript|svg)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z#0-9]+;/gi, (entity) => decode(entity))
    .replace(/\s+/g, " ")
    .trim();
}

function pick(re, text, limit) {
  const found = new Set();
  for (const match of text.matchAll(re)) {
    found.add(match[0].trim());
    if (found.size >= limit) break;
  }
  return [...found];
}

async function fetchPage(url, fetchImpl) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetchImpl(url, { headers: { "User-Agent": UA }, redirect: "follow", signal: controller.signal });
    const body = res.ok ? (await res.text()).slice(0, 400_000) : "";
    return { url, status: res.status, body };
  } catch (err) {
    return { url, status: 0, body: "", error: String(err?.message ?? err).slice(0, 120) };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fetch the homepage, /pricing, and robots.txt. Returns null when the input has
 * no URL. Every fact carries the URL it came from; failures are kept as facts.
 */
export async function gatherSiteFacts(input, fetchImpl = globalThis.fetch) {
  const origin = findUrl(input);
  if (!origin) return null;
  const [home, pricing, robots] = await Promise.all([
    fetchPage(`${origin}/`, fetchImpl),
    fetchPage(`${origin}/pricing`, fetchImpl),
    fetchPage(`${origin}/robots.txt`, fetchImpl),
  ]);
  const facts = { origin, fetchedAt: new Date().toISOString(), pages: [], errors: [] };
  for (const page of [home, pricing]) {
    if (!page.body) {
      facts.errors.push({ url: page.url, status: page.status, reason: page.error ?? `HTTP ${page.status}` });
      continue;
    }
    const text = visibleText(page.body);
    facts.pages.push({
      url: page.url,
      status: page.status,
      title: decode(page.body.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim() ?? "") || null,
      description: decode(page.body.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)/i)?.[1] ?? "") || null,
      prices: pick(PRICE_RE, text, 6),
      calls: pick(CTA_RE, text, 4),
      nextStepLinks: [...new Set([...page.body.matchAll(CTA_HREF_RE)].map((m) => m[1]))].slice(0, 4),
      proof: pick(PROOF_RE, text, 4),
      stripeLinks: pick(/https:\/\/buy\.stripe\.com\/[A-Za-z0-9_]+/g, page.body, 3),
      excerpt: text.slice(0, 1200),
    });
  }
  facts.robotsDisallowsAll = /user-agent:\s*\*[\s\S]*?disallow:\s*\/\s*$/im.test(robots.body);
  return facts;
}

/** The facts as a prompt block. States plainly when the site could not be read. */
export function factsToPrompt(facts) {
  if (!facts) return "";
  if (!facts.pages.length) {
    return `Observed on the live site: nothing. ${facts.origin} could not be read (${facts.errors.map((e) => e.reason).join("; ")}). Say so, and do not describe the site's content as if you had seen it.`;
  }
  const lines = [`Observed on the live site ${facts.origin} at ${facts.fetchedAt}. Base the diagnosis on these facts. Do not claim anything about the site that is not listed here; where something is absent, say it was not found.`];
  for (const page of facts.pages) {
    lines.push(`- ${page.url} (HTTP ${page.status})`);
    if (page.title) lines.push(`  title: ${page.title}`);
    if (page.description) lines.push(`  description: ${page.description}`);
    lines.push(`  prices seen: ${page.prices.length ? page.prices.join(", ") : "none"}`);
    lines.push(`  calls to action seen: ${page.calls.length ? page.calls.join(", ") : "none"}`);
    lines.push(`  next-step links: ${page.nextStepLinks.length ? page.nextStepLinks.join(", ") : "none"}`);
    lines.push(`  proof words seen: ${page.proof.length ? page.proof.join(", ") : "none"}`);
    if (page.stripeLinks.length) lines.push(`  checkout links: ${page.stripeLinks.length}`);
    lines.push(`  text excerpt: ${page.excerpt.slice(0, 700)}`);
  }
  for (const err of facts.errors) lines.push(`- ${err.url} not readable: ${err.reason}`);
  if (facts.robotsDisallowsAll) lines.push("- robots.txt disallows all crawlers.");
  return lines.join("\n");
}
