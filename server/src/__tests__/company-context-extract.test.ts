import { describe, expect, it } from "vitest";

import {
  extractOrgSignals,
  extractPage,
  extractStructuredData,
  parseRobots,
  parseSitemap,
  parseSitemapIndex,
  shapeSitemap,
} from "../services/company-context-extract.js";

const SAMPLE_PAGE = `<!doctype html>
<html>
<head>
  <title>Acme — pricing that scales</title>
  <meta name="description" content="Automation for small teams." />
  <meta name="generator" content="Webflow" />
</head>
<body>
  <nav>
    <a href="/pricing">Pricing</a>
    <a href="/about">About</a>
    <a href="https://twitter.com/acme">Twitter</a>
    <a href="https://external.example/other">External</a>
    <a href="#section">Anchor</a>
  </nav>
  <main>
    <h1>Acme automates your ops</h1>
    <p>Contact us at hello@acme.com or +1 (555) 123-4567.</p>
    <a href="mailto:sales@acme.com">Sales</a>
    <a href="tel:+15559876543">Call</a>
  </main>
  <script>console.log("not visible text");</script>
  <style>.x { color: red; }</style>
</body>
</html>`;

describe("extractPage", () => {
  const result = extractPage(SAMPLE_PAGE, "https://acme.com/");

  it("reads title and meta description", () => {
    expect(result.title).toBe("Acme — pricing that scales");
    expect(result.metaDescription).toBe("Automation for small teams.");
  });

  it("reads the generator meta tag", () => {
    expect(result.generator).toBe("Webflow");
  });

  it("collapses whitespace and excludes script/style content", () => {
    expect(result.text).toContain("Acme automates your ops");
    expect(result.text).not.toContain("console.log");
    expect(result.text).not.toContain("color: red");
  });

  it("collects only same-origin links, resolved to absolute, skipping anchors and mailto/tel", () => {
    expect(result.links).toContain("https://acme.com/pricing");
    expect(result.links).toContain("https://acme.com/about");
    expect(result.links).not.toContain("https://external.example/other");
    expect(result.links.some((l) => l.includes("#section"))).toBe(false);
    expect(result.links.some((l) => l.startsWith("mailto:"))).toBe(false);
  });
});

describe("extractOrgSignals", () => {
  const result = extractOrgSignals(SAMPLE_PAGE, "https://acme.com/");

  it("finds emails from both mailto links and visible text", () => {
    expect(result.emails).toContain("hello@acme.com");
    expect(result.emails).toContain("sales@acme.com");
  });

  it("finds phone numbers from tel links", () => {
    expect(result.phones.some((p) => p.includes("15559876543"))).toBe(true);
  });

  it("maps known social hosts to platform keys", () => {
    expect(result.socialLinks.twitter).toBe("https://twitter.com/acme");
    expect(result.socialLinks.linkedin).toBeUndefined();
  });

  it("leaves address null when no schema.org PostalAddress exists", () => {
    expect(result.address).toBeNull();
  });
});

describe("extractStructuredData", () => {
  it("parses a single JSON-LD block and its @type", () => {
    const html = `<script type="application/ld+json">{"@type":"Organization","name":"Acme"}</script>`;
    const blocks = extractStructuredData(html, "https://acme.com/");
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe("Organization");
    expect(blocks[0].data.name).toBe("Acme");
  });

  it("parses an array of JSON-LD objects in one block", () => {
    const html = `<script type="application/ld+json">[{"@type":"Organization"},{"@type":"Product"}]</script>`;
    const blocks = extractStructuredData(html, "https://acme.com/");
    expect(blocks.map((b) => b.type)).toEqual(["Organization", "Product"]);
  });

  it("skips malformed JSON-LD rather than throwing", () => {
    const html = `<script type="application/ld+json">{not valid json</script>`;
    expect(() => extractStructuredData(html, "https://acme.com/")).not.toThrow();
    expect(extractStructuredData(html, "https://acme.com/")).toHaveLength(0);
  });

  it("extracts a postal address from schema.org markup, used by extractOrgSignals", () => {
    const html = `<script type="application/ld+json">{"@type":"Organization","address":{"@type":"PostalAddress","streetAddress":"1 Main St","addressLocality":"Springfield"}}</script>`;
    const result = extractOrgSignals(html, "https://acme.com/");
    expect(result.address).toBe("1 Main St, Springfield");
  });
});

describe("parseSitemap", () => {
  it("reads url/loc/lastmod entries", () => {
    const xml = `<?xml version="1.0"?><urlset>
      <url><loc>https://acme.com/</loc><lastmod>2026-01-01</lastmod></url>
      <url><loc>https://acme.com/pricing</loc></url>
    </urlset>`;
    const entries = parseSitemap(xml);
    expect(entries).toEqual([
      { url: "https://acme.com/", lastmod: "2026-01-01" },
      { url: "https://acme.com/pricing", lastmod: null },
    ]);
  });

  it("returns empty for a sitemap index, not garbage", () => {
    const xml = `<?xml version="1.0"?><sitemapindex>
      <sitemap><loc>https://acme.com/sitemap-pages.xml</loc></sitemap>
    </sitemapindex>`;
    expect(parseSitemap(xml)).toEqual([]);
  });
});

describe("parseSitemapIndex", () => {
  it("reads child sitemap URLs", () => {
    const xml = `<?xml version="1.0"?><sitemapindex>
      <sitemap><loc>https://acme.com/sitemap-pages.xml</loc></sitemap>
      <sitemap><loc>https://acme.com/sitemap-blog.xml</loc></sitemap>
    </sitemapindex>`;
    expect(parseSitemapIndex(xml)).toEqual([
      "https://acme.com/sitemap-pages.xml",
      "https://acme.com/sitemap-blog.xml",
    ]);
  });
});

describe("shapeSitemap", () => {
  it("buckets by first path segment", () => {
    const shape = shapeSitemap([
      { url: "https://acme.com/", lastmod: null },
      { url: "https://acme.com/blog/one", lastmod: null },
      { url: "https://acme.com/blog/two", lastmod: null },
      { url: "https://acme.com/pricing", lastmod: null },
    ]);
    expect(shape).toEqual({ "/": 1, "/blog": 2, "/pricing": 1 });
  });
});

describe("parseRobots", () => {
  it("finds Sitemap: directives regardless of user-agent block", () => {
    const raw = "User-agent: *\nDisallow: /admin\nSitemap: https://acme.com/sitemap.xml";
    const result = parseRobots(raw);
    expect(result.sitemapUrls).toEqual(["https://acme.com/sitemap.xml"]);
  });

  it("flags a wildcard full-site disallow", () => {
    const raw = "User-agent: *\nDisallow: /";
    expect(parseRobots(raw).disallowsCrawlers).toBe(true);
  });

  it("does not flag a partial disallow", () => {
    const raw = "User-agent: *\nDisallow: /admin";
    expect(parseRobots(raw).disallowsCrawlers).toBe(false);
  });

  it("does not flag a disallow scoped to an unrelated named bot", () => {
    const raw = "User-agent: SomeScraperBot\nDisallow: /";
    expect(parseRobots(raw).disallowsCrawlers).toBe(false);
  });
});
