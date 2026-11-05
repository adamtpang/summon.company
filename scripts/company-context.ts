/**
 * Gather everything public about a company from the outside: homepage,
 * sitemap, robots.txt, a handful of high-signal pages, structured data,
 * org signals. Read-only, always.
 *
 *   node cli/node_modules/tsx/dist/cli.mjs scripts/company-context.ts \
 *     <domain-or-url> [--json] [--homepage-only]
 */

import { gatherCompanyContext } from "../server/src/services/company-context.js";

const target = process.argv[2];
const asJson = process.argv.includes("--json");
const homepageOnly = process.argv.includes("--homepage-only");

if (!target) {
  console.error("usage: <domain-or-url> [--json] [--homepage-only]");
  process.exit(2);
}

const ctx = await gatherCompanyContext(target, { homepageOnly });

if (asJson) {
  console.log(JSON.stringify(ctx, null, 2));
  process.exit(0);
}

console.log(`\n${ctx.domain}  (gathered ${ctx.fetchedAt})\n`);

console.log("--- homepage ---");
if (ctx.homepage) {
  console.log(`status: ${ctx.homepage.status}`);
  console.log(`title: ${ctx.homepage.title ?? "(none)"}`);
  console.log(`description: ${ctx.homepage.metaDescription ?? "(none)"}`);
  console.log(`generator: ${ctx.homepage.generator ?? "(unknown)"}`);
  console.log(`text sample: ${ctx.homepage.text.slice(0, 220)}...`);
} else {
  console.log("(homepage fetch failed entirely)");
}

console.log("\n--- robots.txt ---");
console.log(`fetched: ${ctx.robots.fetched}`);
console.log(`disallows crawlers: ${ctx.robots.disallowsCrawlers}`);
console.log(`declared sitemaps: ${ctx.robots.sitemapUrls.join(", ") || "(none)"}`);

console.log("\n--- sitemap ---");
console.log(`entries found: ${ctx.sitemapEntries.length}`);
console.log("shape:", ctx.sitemapShape);

console.log("\n--- secondary pages ---");
for (const page of ctx.pages) {
  console.log(`${page.url}  [${page.status}]  ${page.title ?? "(no title)"}`);
}
if (ctx.pages.length === 0) console.log("(none fetched)");

console.log("\n--- structured data ---");
console.log(
  ctx.structuredData.length > 0
    ? ctx.structuredData.map((b) => b.type ?? "(untyped)").join(", ")
    : "(none found)",
);

console.log("\n--- org signals ---");
console.log(`emails: ${ctx.org.emails.join(", ") || "(none)"}`);
console.log(`phones: ${ctx.org.phones.join(", ") || "(none)"}`);
console.log(`social: ${JSON.stringify(ctx.org.socialLinks)}`);
console.log(`address: ${ctx.org.address ?? "(none)"}`);

console.log("\n--- fetch errors (evidence, not noise) ---");
for (const err of ctx.fetchErrors) console.log(`${err.url}: ${err.reason}`);
if (ctx.fetchErrors.length === 0) console.log("(none)");
console.log();
