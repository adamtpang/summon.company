// SUM-297: the four-check analyzer (issue #27). It reads what
// gatherCompanyContext actually fetched and returns four verdicts, each with
// the URLs that justify it. It never guesses: when the site could not be read,
// a check is "unknown", not "gap". Reality is the eval; this only reports it.

import type { CompanyContext, PageSnapshot } from "@paperclipai/shared";

export type CheckStatus = "pass" | "gap" | "unknown";

export interface ContextCheck {
  key: "price_visibility" | "conversion_path" | "proof_ladder" | "stage_placement";
  status: CheckStatus;
  finding: string;
  evidence: string[];
}

export interface ContextAnalysis {
  domain: string;
  checks: ContextCheck[];
  /** The first check in chain order that is a gap: the one to fix first. Null when none is. */
  constraint: ContextCheck["key"] | null;
}

const PRICE_RE = /(?:[$€£]\s?\d[\d,]*(?:\.\d{2})?|\b\d[\d,]*(?:\.\d{2})?\s?(?:usd|dollars)\b)/i;
const PROOF_TEXT_RE = /\b(testimonial|case stud(?:y|ies)|customers? say|trusted by|reviews?|clients include|results for)\b/i;
const PROOF_PATH_RE = /\/(case-stud(?:y|ies)|customers|testimonials|reviews|clients|work|portfolio|results)(?:\/|$)/i;
const CONVERT_PATH_RE = /\/(contact|book|booking|demo|schedule|signup|sign-up|get-started|start|checkout|buy|order|quote|apply|pricing)(?:\/|$|\?)/i;
const CONVERT_TEXT_RE = /\b(book a (?:call|demo)|get a quote|buy now|sign up|start (?:free|now|your)|contact us|schedule|order now|get started)\b/i;

function readable(page: PageSnapshot | null | undefined): page is PageSnapshot {
  return Boolean(page && page.status >= 200 && page.status < 300);
}

function priceVisibility(ctx: CompanyContext, pages: PageSnapshot[]): ContextCheck {
  const evidence: string[] = [];
  for (const page of pages) {
    const match = page.text.match(PRICE_RE);
    if (match) evidence.push(`${page.url} shows "${match[0].trim()}"`);
  }
  for (const block of ctx.structuredData) {
    const offers = (block.data as { offers?: unknown }).offers;
    if (offers) evidence.push(`${block.sourceUrl} declares schema.org offers`);
  }
  if (evidence.length) return { key: "price_visibility", status: "pass", finding: "A price is visible on the public site.", evidence };
  if (!pages.length) return { key: "price_visibility", status: "unknown", finding: "No page could be read, so price visibility is unknown.", evidence: [] };
  return {
    key: "price_visibility",
    status: "gap",
    finding: "No price appears on any page that was read. A buyer cannot tell what it costs.",
    evidence: pages.map((page) => `${page.url} read, no price`),
  };
}

function conversionPath(ctx: CompanyContext, pages: PageSnapshot[]): ContextCheck {
  const evidence: string[] = [];
  const home = ctx.homepage;
  if (readable(home)) {
    const paths = home.links.filter((link) => CONVERT_PATH_RE.test(link));
    if (paths.length) evidence.push(`${home.url} links to ${paths.slice(0, 3).join(", ")}`);
    const cta = home.text.match(CONVERT_TEXT_RE);
    if (cta) evidence.push(`${home.url} says "${cta[0]}"`);
  }
  if (ctx.org.emails.length) evidence.push(`public email: ${ctx.org.emails[0]}`);
  if (ctx.org.phones.length) evidence.push(`public phone: ${ctx.org.phones[0]}`);
  if (evidence.length) return { key: "conversion_path", status: "pass", finding: "A visitor has a visible next step.", evidence };
  if (!pages.length) return { key: "conversion_path", status: "unknown", finding: "No page could be read, so the conversion path is unknown.", evidence: [] };
  return {
    key: "conversion_path",
    status: "gap",
    finding: "No contact, booking, signup, or checkout path was found. Interested visitors have nowhere to go.",
    evidence: pages.map((page) => `${page.url} read, no next step`),
  };
}

function proofLadder(ctx: CompanyContext, pages: PageSnapshot[]): ContextCheck {
  const evidence: string[] = [];
  for (const page of pages) {
    const match = page.text.match(PROOF_TEXT_RE);
    if (match) evidence.push(`${page.url} mentions "${match[0]}"`);
  }
  const proofPaths = new Set<string>();
  for (const page of pages) for (const link of page.links) if (PROOF_PATH_RE.test(link)) proofPaths.add(link);
  for (const entry of ctx.sitemapEntries) if (PROOF_PATH_RE.test(entry.url)) proofPaths.add(entry.url);
  if (proofPaths.size) evidence.push(`proof pages: ${[...proofPaths].slice(0, 3).join(", ")}`);
  for (const block of ctx.structuredData) {
    if (block.type && /Review|AggregateRating/i.test(block.type)) evidence.push(`${block.sourceUrl} declares ${block.type}`);
  }
  if (evidence.length) return { key: "proof_ladder", status: "pass", finding: "The site shows some proof that others bought and it worked.", evidence };
  if (!pages.length) return { key: "proof_ladder", status: "unknown", finding: "No page could be read, so proof is unknown.", evidence: [] };
  return {
    key: "proof_ladder",
    status: "gap",
    finding: "No testimonials, case studies, reviews, or customer pages were found.",
    evidence: pages.map((page) => `${page.url} read, no proof`),
  };
}

function stagePlacement(price: ContextCheck, convert: ContextCheck, proof: ContextCheck, pages: PageSnapshot[]): ContextCheck {
  if (!pages.length) {
    return { key: "stage_placement", status: "unknown", finding: "The site could not be read, so the stage cannot be placed.", evidence: [] };
  }
  const evidence = [
    `price visibility: ${price.status}`,
    `conversion path: ${convert.status}`,
    `proof ladder: ${proof.status}`,
  ];
  if (price.status === "gap") {
    return { key: "stage_placement", status: "gap", finding: "Pre-offer: the public site does not yet sell a priced thing.", evidence };
  }
  if (convert.status === "gap") {
    return { key: "stage_placement", status: "gap", finding: "Priced but not buyable: there is an offer and no way to act on it.", evidence };
  }
  if (proof.status === "gap") {
    return { key: "stage_placement", status: "pass", finding: "Selling without proof: priced and buyable, no visible evidence that it works.", evidence };
  }
  return { key: "stage_placement", status: "pass", finding: "Selling with proof: priced, buyable, and backed by evidence.", evidence };
}

export function analyzeCompanyContext(ctx: CompanyContext): ContextAnalysis {
  const pages = [ctx.homepage, ...ctx.pages].filter(readable);
  const price = priceVisibility(ctx, pages);
  const convert = conversionPath(ctx, pages);
  const proof = proofLadder(ctx, pages);
  const stage = stagePlacement(price, convert, proof, pages);
  const checks = [price, convert, proof, stage];
  // Chain order: without a price nothing sells, without a path nobody buys,
  // without proof fewer do. The first gap is the constraint.
  const constraint = ([price, convert, proof] as ContextCheck[]).find((check) => check.status === "gap")?.key ?? null;
  return { domain: ctx.domain, checks, constraint };
}

const PRIVATE_HOST_RE = /^(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|0\.|\[?::1\]?$|\[?f[cd][0-9a-f]{2}:)/i;

/** A normalized origin for an outside audit, or null for malformed, non-http, or private targets. */
export function publicAuditTarget(input: string): string | null {
  const raw = /^https?:\/\//i.test(input.trim()) ? input.trim() : `https://${input.trim()}`;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (!/^https?:$/.test(url.protocol)) return null;
  if (!url.hostname.includes(".") || PRIVATE_HOST_RE.test(url.hostname) || url.hostname.endsWith(".local") || url.hostname.endsWith(".internal")) return null;
  return url.origin;
}
