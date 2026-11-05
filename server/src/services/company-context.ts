/**
 * Company context gatherer: step one of diagnosis. Given a domain, pull
 * everything the public web will give up for free before any human talks
 * to the company: the homepage, the sitemap, a handful of high-signal
 * pages, robots.txt, structured data, and contact/org signals.
 *
 * This is deliberately upstream of judgment. It gathers facts with sources;
 * it does not decide what they mean. The four-check analyzer (SUM-297:
 * stage, price visibility, proof ladder, conversion path) consumes this
 * output. Read-only, always: nothing here writes to or interacts with the
 * target site beyond a normal page fetch.
 *
 * Design: doc/COMPANY-CONTEXT-GATHERER.md
 */

import type { CompanyContext, PageSnapshot, RobotsInfo, SitemapEntry } from "@paperclipai/shared";

import {
  extractOrgSignals,
  extractPage,
  extractStructuredData,
  parseRobots,
  parseSitemap,
  parseSitemapIndex,
  shapeSitemap,
} from "./company-context-extract.js";

const USER_AGENT = "Mozilla/5.0 (compatible; SummonCompanyContext/1.0; +https://summon.company)";
const FETCH_TIMEOUT_MS = 10_000;
const MAX_SITEMAP_ENTRIES = 500;
const MAX_SECONDARY_PAGES = 6;

/** Paths worth checking opportunistically: where price, team, and proof usually live. */
const SECONDARY_PATH_CANDIDATES = [
  "/pricing",
  "/price",
  "/about",
  "/team",
  "/contact",
  "/blog",
  "/careers",
];

async function fetchText(url: string, signal?: AbortSignal): Promise<{ status: number; text: string } | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "text/html,application/xhtml+xml,application/xml" },
      signal,
      redirect: "follow",
    });
    const text = await res.text();
    return { status: res.status, text };
  } catch {
    return null;
  }
}

function withTimeout(): { signal: AbortSignal; cancel: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  return { signal: controller.signal, cancel: () => clearTimeout(timer) };
}

/** Fetch a URL once and return both the snapshot and the raw HTML, so callers
 * needing structured data or org signals don't re-fetch the same page. */
async function fetchPageRaw(
  url: string,
  errors: CompanyContext["fetchErrors"],
): Promise<{ snapshot: PageSnapshot; rawHtml: string } | null> {
  const { signal, cancel } = withTimeout();
  const result = await fetchText(url, signal);
  cancel();
  if (!result) {
    errors.push({ url, reason: "network error or timeout" });
    return null;
  }
  if (result.status >= 400) {
    errors.push({ url, reason: `HTTP ${result.status}` });
    // Still return a snapshot: a 403 or 404 is itself a finding (the HTW
    // lesson: a site blocking automated readers is evidence, not silence).
  }
  const extracted = extractPage(result.text, url);
  return {
    rawHtml: result.text,
    snapshot: {
      url,
      status: result.status,
      title: extracted.title,
      metaDescription: extracted.metaDescription,
      text: extracted.text,
      links: extracted.links,
      generator: extracted.generator,
      fetchedAt: new Date().toISOString(),
    },
  };
}

async function fetchPage(url: string, errors: CompanyContext["fetchErrors"]): Promise<PageSnapshot | null> {
  const result = await fetchPageRaw(url, errors);
  return result?.snapshot ?? null;
}

async function fetchRobots(origin: string): Promise<RobotsInfo> {
  const url = `${origin}/robots.txt`;
  const { signal, cancel } = withTimeout();
  const result = await fetchText(url, signal);
  cancel();
  if (!result || result.status >= 400) {
    return { fetched: false, disallowsCrawlers: false, sitemapUrls: [], raw: null };
  }
  return { fetched: true, ...parseRobots(result.text) };
}

async function fetchSitemapEntries(
  sitemapUrl: string,
  errors: CompanyContext["fetchErrors"],
  depth = 0,
): Promise<SitemapEntry[]> {
  const { signal, cancel } = withTimeout();
  const result = await fetchText(sitemapUrl, signal);
  cancel();
  if (!result || result.status >= 400) {
    errors.push({ url: sitemapUrl, reason: result ? `HTTP ${result.status}` : "network error or timeout" });
    return [];
  }
  const direct = parseSitemap(result.text);
  if (direct.length > 0) return direct;

  // Might be a sitemap index. Only recurse one level to keep this bounded.
  if (depth === 0) {
    const childSitemaps = parseSitemapIndex(result.text);
    const all: SitemapEntry[] = [];
    for (const child of childSitemaps.slice(0, 10)) {
      all.push(...(await fetchSitemapEntries(child, errors, depth + 1)));
      if (all.length >= MAX_SITEMAP_ENTRIES) break;
    }
    return all;
  }
  return [];
}

export interface GatherOptions {
  /** Skip secondary pages and structured-data extraction on them; homepage + sitemap only. Faster. */
  homepageOnly?: boolean;
}

/**
 * Gather everything public about one domain. Always read-only, always
 * sourced. A field that could not be found is absent, never invented.
 */
export async function gatherCompanyContext(
  domainOrUrl: string,
  options: GatherOptions = {},
): Promise<CompanyContext> {
  const url = /^https?:\/\//i.test(domainOrUrl) ? domainOrUrl : `https://${domainOrUrl}`;
  const origin = new URL(url).origin;
  const domain = new URL(url).hostname;
  const fetchErrors: CompanyContext["fetchErrors"] = [];

  const [homepageResult, robots] = await Promise.all([
    fetchPageRaw(origin, fetchErrors),
    fetchRobots(origin),
  ]);
  const homepage = homepageResult?.snapshot ?? null;

  const sitemapUrl = robots.sitemapUrls[0] ?? `${origin}/sitemap.xml`;
  const sitemapEntries = await fetchSitemapEntries(sitemapUrl, fetchErrors);

  const structuredData = homepageResult ? extractStructuredData(homepageResult.rawHtml, origin) : [];
  const org = homepageResult
    ? extractOrgSignals(homepageResult.rawHtml, origin)
    : { emails: [], phones: [], socialLinks: {}, address: null };

  const pages: PageSnapshot[] = [];
  if (!options.homepageOnly && homepage) {
    const candidates = candidatePaths(homepage, sitemapEntries);
    for (const path of candidates.slice(0, MAX_SECONDARY_PAGES)) {
      const page = await fetchPage(`${origin}${path}`, fetchErrors);
      if (page) pages.push(page);
    }
  }

  return {
    domain,
    fetchedAt: new Date().toISOString(),
    homepage,
    pages,
    robots,
    sitemapEntries: sitemapEntries.slice(0, MAX_SITEMAP_ENTRIES),
    sitemapShape: shapeSitemap(sitemapEntries),
    structuredData,
    org,
    fetchErrors,
  };
}

/** Which secondary paths to try: sitemap-confirmed paths first, then common guesses. */
function candidatePaths(homepage: PageSnapshot, sitemapEntries: SitemapEntry[]): string[] {
  const sitemapPaths = new Set(
    sitemapEntries.map((e) => {
      try {
        return new URL(e.url).pathname;
      } catch {
        return "";
      }
    }),
  );

  const fromSitemap = ["/pricing", "/price", "/about", "/team", "/contact", "/careers"].filter((p) =>
    sitemapPaths.has(p),
  );
  const fromHomepageLinks = homepage.links
    .map((link) => {
      try {
        return new URL(link).pathname;
      } catch {
        return "";
      }
    })
    .filter((path) => SECONDARY_PATH_CANDIDATES.some((c) => path === c || path === `${c}/`));

  const ordered = [...new Set([...fromSitemap, ...fromHomepageLinks])];
  return ordered.length > 0 ? ordered : SECONDARY_PATH_CANDIDATES.slice(0, 3);
}
