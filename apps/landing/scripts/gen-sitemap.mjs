#!/usr/bin/env node
// SUM-153: auto-generate sitemap.xml for summon.company.
// Scans the landing app for real, indexable HTML pages and emits clean URLs.
// Re-run this whenever pages are added (pricing, blog, ai-employee/*, alternatives/*):
//   node scripts/gen-sitemap.mjs
// Vercel serves *.html at its clean path, so foo.html -> /foo and index.html -> /.
import { readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ORIGIN = 'https://summon.company';

// Directories and files that are never public, indexable content.
const SKIP_DIRS = new Set(['node_modules', '.vercel', '.git', 'bin', 'react', 'scripts']);
// Real pages that exist but should not be indexed (internal demos / templates).
const SKIP_PAGES = new Set(['dashboard.html']);

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const rel = relative(ROOT, full).split('\\').join('/');
    if (statSync(full).isDirectory()) {
      if (SKIP_DIRS.has(name)) continue;
      out.push(...walk(full));
    } else if (name.endsWith('.html') && !SKIP_PAGES.has(rel)) {
      out.push(rel);
    }
  }
  return out;
}

function toUrl(rel) {
  // index.html -> /,  foo.html -> /foo,  dir/index.html -> /dir/,  dir/foo.html -> /dir/foo
  if (rel === 'index.html') return `${ORIGIN}/`;
  if (rel.endsWith('/index.html')) return `${ORIGIN}/${rel.slice(0, -'index.html'.length)}`;
  return `${ORIGIN}/${rel.slice(0, -'.html'.length)}`;
}

const today = new Date().toISOString().slice(0, 10);
const urls = [...new Set(walk(ROOT).map(toUrl))].sort((a, b) =>
  // home first, then alphabetical
  a === `${ORIGIN}/` ? -1 : b === `${ORIGIN}/` ? 1 : a.localeCompare(b),
);

const body = urls
  .map(
    (u) =>
      `  <url>\n    <loc>${u}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>weekly</changefreq>\n  </url>`,
  )
  .join('\n');

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</urlset>
`;

writeFileSync(join(ROOT, 'sitemap.xml'), xml);
console.log(`sitemap.xml written with ${urls.length} url(s):`);
for (const u of urls) console.log(`  ${u}`);
