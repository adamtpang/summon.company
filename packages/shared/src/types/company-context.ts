/**
 * Company context types: what Summon can learn about a company from the
 * outside, before any human talks to them. This is step one of diagnosis,
 * not the diagnosis itself: it gathers facts, the analyzer (SUM-297)
 * interprets them.
 *
 * Every field is either present with a source, or absent. Nothing here is
 * ever inferred or guessed to fill a gap; a missing field means the public
 * web genuinely didn't have it, and that absence is itself a finding (a
 * company with no visible price, no sitemap, or a site that blocks readers
 * is telling you something).
 */

export interface PageSnapshot {
  url: string;
  /** HTTP status. 0 means the fetch itself failed (network, DNS, timeout). */
  status: number;
  title: string | null;
  metaDescription: string | null;
  /** Visible text, whitespace-collapsed, capped. Not full HTML. */
  text: string;
  /** Every internal link found, deduped, for CTA and structure analysis. */
  links: string[];
  /** Server-declared generator (WordPress, Webflow, Framer, Next.js, etc.) if present. */
  generator: string | null;
  fetchedAt: string;
}

export interface SitemapEntry {
  url: string;
  lastmod: string | null;
}

export interface RobotsInfo {
  fetched: boolean;
  /** True when a bot-relevant disagent (or the whole site) is disallowed. */
  disallowsCrawlers: boolean;
  sitemapUrls: string[];
  raw: string | null;
}

/** One JSON-LD block found on a page, parsed, with the page it came from. */
export interface StructuredDataBlock {
  sourceUrl: string;
  /** schema.org @type, when present. */
  type: string | null;
  data: Record<string, unknown>;
}

export interface OrgSignals {
  emails: string[];
  phones: string[];
  /** Social and platform links, keyed by platform for easy lookup. */
  socialLinks: Partial<Record<"twitter" | "linkedin" | "github" | "instagram" | "facebook" | "youtube", string>>;
  /** Physical address, only when found in visible text or schema.org markup. */
  address: string | null;
}

export interface CompanyContext {
  domain: string;
  fetchedAt: string;
  homepage: PageSnapshot | null;
  /** Secondary pages opportunistically fetched: pricing, about, team, contact, blog. */
  pages: PageSnapshot[];
  robots: RobotsInfo;
  sitemapEntries: SitemapEntry[];
  /** Sitemap URLs bucketed by path heuristic, for a fast shape-of-the-site read. */
  sitemapShape: Record<string, number>;
  structuredData: StructuredDataBlock[];
  org: OrgSignals;
  /** Every fetch that failed, with why. This list is evidence, not noise. */
  fetchErrors: { url: string; reason: string }[];
}
