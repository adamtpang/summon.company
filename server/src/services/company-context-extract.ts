/**
 * Pure extraction functions: HTML/XML text in, structured facts out. No
 * network here, so these are the fully unit-testable half of the gatherer.
 * The orchestrator (company-context.ts) does the fetching and calls these.
 */

import { JSDOM } from "jsdom";

import type {
  OrgSignals,
  RobotsInfo,
  SitemapEntry,
  StructuredDataBlock,
} from "@paperclipai/shared";

const MAX_TEXT_CHARS = 8000;

const SOCIAL_HOSTS: Record<string, keyof OrgSignals["socialLinks"]> = {
  "twitter.com": "twitter",
  "x.com": "twitter",
  "linkedin.com": "linkedin",
  "github.com": "github",
  "instagram.com": "instagram",
  "facebook.com": "facebook",
  "youtube.com": "youtube",
};

export interface ExtractedPage {
  title: string | null;
  metaDescription: string | null;
  text: string;
  links: string[];
  generator: string | null;
}

/** Extract title, description, visible text, links, and generator meta from HTML. */
export function extractPage(html: string, pageUrl: string): ExtractedPage {
  const dom = new JSDOM(html, { url: pageUrl });
  const doc = dom.window.document;

  const title = doc.querySelector("title")?.textContent?.trim() || null;
  const metaDescription =
    doc.querySelector('meta[name="description"]')?.getAttribute("content")?.trim() || null;
  const generator = doc.querySelector('meta[name="generator"]')?.getAttribute("content")?.trim() || null;

  // Strip script/style/noscript before reading text, or they pollute the read.
  for (const el of doc.querySelectorAll("script, style, noscript, template")) el.remove();
  const rawText = doc.body?.textContent ?? "";
  const text = rawText.replace(/\s+/g, " ").trim().slice(0, MAX_TEXT_CHARS);

  const origin = new URL(pageUrl).origin;
  const links = new Set<string>();
  for (const a of doc.querySelectorAll("a[href]")) {
    const href = a.getAttribute("href");
    if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) continue;
    try {
      const resolved = new URL(href, pageUrl);
      if (resolved.origin === origin) links.add(resolved.toString());
    } catch {
      // malformed href, skip
    }
  }

  return { title, metaDescription, text, links: [...links], generator };
}

/** Parse a sitemap.xml (or a sitemap index) into flat entries. Handles nested indexes one level deep. */
export function parseSitemap(xml: string): SitemapEntry[] {
  const dom = new JSDOM(xml, { contentType: "text/xml" });
  const doc = dom.window.document;
  const entries: SitemapEntry[] = [];
  for (const urlEl of doc.querySelectorAll("url")) {
    const loc = urlEl.querySelector("loc")?.textContent?.trim();
    if (!loc) continue;
    const lastmod = urlEl.querySelector("lastmod")?.textContent?.trim() || null;
    entries.push({ url: loc, lastmod });
  }
  return entries;
}

/** A sitemap index lists other sitemaps rather than pages. Return their URLs, or empty if this isn't one. */
export function parseSitemapIndex(xml: string): string[] {
  const dom = new JSDOM(xml, { contentType: "text/xml" });
  const doc = dom.window.document;
  const urls: string[] = [];
  for (const smEl of doc.querySelectorAll("sitemap > loc")) {
    const loc = smEl.textContent?.trim();
    if (loc) urls.push(loc);
  }
  return urls;
}

/** Bucket sitemap URLs by first path segment, a fast read of the site's shape. */
export function shapeSitemap(entries: SitemapEntry[]): Record<string, number> {
  const shape: Record<string, number> = {};
  for (const { url } of entries) {
    let segment = "/";
    try {
      const path = new URL(url).pathname;
      const first = path.split("/").filter(Boolean)[0];
      segment = first ? `/${first}` : "/";
    } catch {
      segment = "(unparsable)";
    }
    shape[segment] = (shape[segment] ?? 0) + 1;
  }
  return shape;
}

/** Parse robots.txt for crawler-disallow signals and any declared Sitemap: URLs. */
export function parseRobots(raw: string): Omit<RobotsInfo, "fetched"> {
  const sitemapUrls: string[] = [];
  let disallowsCrawlers = false;
  let currentAgentIsWildcardOrKnown = false;

  for (const rawLine of raw.split(/\r?\n/)) {
    const line = rawLine.split("#")[0].trim();
    if (!line) continue;
    const [rawKey, ...rest] = line.split(":");
    const key = rawKey.trim().toLowerCase();
    const value = rest.join(":").trim();

    if (key === "sitemap" && value) sitemapUrls.push(value);
    if (key === "user-agent") {
      currentAgentIsWildcardOrKnown = value === "*" || /gptbot|claudebot|ccbot|anthropic|bingbot|googlebot/i.test(value);
    }
    if (key === "disallow" && currentAgentIsWildcardOrKnown && (value === "/" || value === "")) {
      if (value === "/") disallowsCrawlers = true;
    }
  }

  return { disallowsCrawlers, sitemapUrls, raw };
}

/** Extract every JSON-LD <script> block on a page. */
export function extractStructuredData(html: string, pageUrl: string): StructuredDataBlock[] {
  const dom = new JSDOM(html, { url: pageUrl });
  const blocks: StructuredDataBlock[] = [];
  for (const script of dom.window.document.querySelectorAll('script[type="application/ld+json"]')) {
    const raw = script.textContent?.trim();
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw);
      const items = Array.isArray(parsed) ? parsed : [parsed];
      for (const item of items) {
        if (item && typeof item === "object") {
          blocks.push({
            sourceUrl: pageUrl,
            type: typeof item["@type"] === "string" ? item["@type"] : null,
            data: item,
          });
        }
      }
    } catch {
      // malformed JSON-LD, skip rather than guess
    }
  }
  return blocks;
}

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const PHONE_RE = /\+?\d[\d\s().-]{7,}\d/g;

/** Pull emails, phones, social links, and any visible address from a page. */
export function extractOrgSignals(html: string, pageUrl: string): OrgSignals {
  const dom = new JSDOM(html, { url: pageUrl });
  const doc = dom.window.document;
  const bodyText = doc.body?.textContent ?? "";

  const emails = new Set<string>();
  for (const a of doc.querySelectorAll('a[href^="mailto:"]')) {
    const addr = a.getAttribute("href")?.replace("mailto:", "").split("?")[0].trim();
    if (addr) emails.add(addr);
  }
  for (const m of bodyText.matchAll(EMAIL_RE)) emails.add(m[0]);

  const phones = new Set<string>();
  for (const a of doc.querySelectorAll('a[href^="tel:"]')) {
    const num = a.getAttribute("href")?.replace("tel:", "").trim();
    if (num) phones.add(num);
  }

  const socialLinks: OrgSignals["socialLinks"] = {};
  for (const a of doc.querySelectorAll("a[href]")) {
    const href = a.getAttribute("href");
    if (!href) continue;
    try {
      const host = new URL(href, pageUrl).hostname.replace(/^www\./, "");
      const platform = SOCIAL_HOSTS[host];
      if (platform && !socialLinks[platform]) socialLinks[platform] = href;
    } catch {
      // malformed href, skip
    }
  }

  // Address: only from schema.org PostalAddress, never guessed from free text.
  let address: string | null = null;
  for (const block of extractStructuredData(html, pageUrl)) {
    const candidate = block.data as { address?: unknown };
    if (candidate.address && typeof candidate.address === "object") {
      const addr = candidate.address as Record<string, unknown>;
      const parts = [addr.streetAddress, addr.addressLocality, addr.addressRegion, addr.postalCode, addr.addressCountry]
        .filter((p): p is string => typeof p === "string" && p.length > 0);
      if (parts.length > 0) {
        address = parts.join(", ");
        break;
      }
    }
  }

  return {
    emails: [...emails].slice(0, 10),
    phones: [...new Set([...phones].map((p) => p.match(PHONE_RE)?.[0] ?? p))].slice(0, 5),
    socialLinks,
    address,
  };
}
