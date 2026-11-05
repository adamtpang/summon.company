import { describe, expect, it } from "vitest";
import type { CompanyContext, PageSnapshot } from "@paperclipai/shared";
import { analyzeCompanyContext, publicAuditTarget } from "../services/company-context-analyze.js";

function page(url: string, text: string, links: string[] = [], status = 200): PageSnapshot {
  return { url, status, title: null, metaDescription: null, text, links, generator: null, fetchedAt: "2026-09-18T00:00:00Z" };
}

function ctx(overrides: Partial<CompanyContext> = {}): CompanyContext {
  return {
    domain: "example.com",
    fetchedAt: "2026-09-18T00:00:00Z",
    homepage: page("https://example.com/", "We build websites."),
    pages: [],
    robots: { fetched: true, disallowsCrawlers: false, sitemapUrls: [], raw: "" },
    sitemapEntries: [],
    sitemapShape: {},
    structuredData: [],
    org: { emails: [], phones: [], socialLinks: {}, address: null },
    fetchErrors: [],
    ...overrides,
  };
}

const status = (analysis: ReturnType<typeof analyzeCompanyContext>, key: string) =>
  analysis.checks.find((check) => check.key === key)?.status;

describe("analyzeCompanyContext (SUM-297)", () => {
  it("a site with no price, path, or proof is pre-offer and the constraint is price", () => {
    const analysis = analyzeCompanyContext(ctx());
    expect(status(analysis, "price_visibility")).toBe("gap");
    expect(status(analysis, "conversion_path")).toBe("gap");
    expect(status(analysis, "proof_ladder")).toBe("gap");
    expect(analysis.checks.find((c) => c.key === "stage_placement")?.finding).toMatch(/Pre-offer/);
    expect(analysis.constraint).toBe("price_visibility");
  });

  it("finds a real price on the pricing page and cites the URL", () => {
    const analysis = analyzeCompanyContext(ctx({ pages: [page("https://example.com/pricing", "Quick Build $900. Standard Build $2,200.")] }));
    const price = analysis.checks.find((c) => c.key === "price_visibility")!;
    expect(price.status).toBe("pass");
    expect(price.evidence[0]).toContain("https://example.com/pricing");
    expect(price.evidence[0]).toContain("$900");
  });

  it("priced and buyable with no proof: the constraint moves to proof", () => {
    const analysis = analyzeCompanyContext(
      ctx({ homepage: page("https://example.com/", "Plans from $49. Book a call.", ["https://example.com/contact"]) }),
    );
    expect(status(analysis, "price_visibility")).toBe("pass");
    expect(status(analysis, "conversion_path")).toBe("pass");
    expect(analysis.constraint).toBe("proof_ladder");
    expect(analysis.checks.find((c) => c.key === "stage_placement")?.finding).toMatch(/without proof/);
  });

  it("counts reviews markup and case-study pages as proof", () => {
    const analysis = analyzeCompanyContext(
      ctx({
        homepage: page("https://example.com/", "From $49. Get started.", ["https://example.com/signup"]),
        sitemapEntries: [{ url: "https://example.com/case-studies/acme", lastmod: null }],
        structuredData: [{ sourceUrl: "https://example.com/", type: "AggregateRating", data: {} }],
      }),
    );
    expect(status(analysis, "proof_ladder")).toBe("pass");
    expect(analysis.constraint).toBeNull();
  });

  it("an unreadable site is unknown, never a gap", () => {
    const analysis = analyzeCompanyContext(ctx({ homepage: page("https://example.com/", "", [], 403) }));
    for (const check of analysis.checks) expect(check.status).toBe("unknown");
    expect(analysis.constraint).toBeNull();
  });
});

describe("publicAuditTarget (issue #29 route guard)", () => {
  it("accepts public sites and normalizes to an origin", () => {
    expect(publicAuditTarget("anchormarianas.com/pricing")).toBe("https://anchormarianas.com");
    expect(publicAuditTarget("http://beware.dog")).toBe("http://beware.dog");
  });
  it("rejects malformed, non-http, and private targets", () => {
    for (const bad of ["not a url", "ftp://example.com", "localhost:3100", "http://127.0.0.1", "10.0.0.5", "192.168.1.1", "http://169.254.169.254/latest", "printer.local", "db.internal", "http://[::1]"]) {
      expect(publicAuditTarget(bad), bad).toBeNull();
    }
  });
});
