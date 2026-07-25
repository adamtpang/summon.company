#!/usr/bin/env node
// sitegrab.mjs — study a website's craft: grab homepage HTML, its CSS, and
// sitemap, then extract the design system (fonts, colors, type scale,
// spacing, meta) into a study folder. Dependency-free, no API key.
// Usage: node sitegrab.mjs <url> [outDir]

import fs from "node:fs";
import path from "node:path";

const url = process.argv[2];
if (!url) { console.error("usage: sitegrab.mjs <url> [outDir]"); process.exit(1); }
const u = new URL(url.startsWith("http") ? url : "https://" + url);
const OUT = process.argv[3] ?? path.join("C:/Users/adamp/OneDrive/Aether/site-studies", u.hostname);
fs.mkdirSync(OUT, { recursive: true });

const UA = { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) sitegrab-study/1.0" } };
async function grab(target) {
  const res = await fetch(target, UA);
  if (!res.ok) throw new Error(`${res.status} ${target}`);
  return res.text();
}

const html = await grab(u.href);
fs.writeFileSync(path.join(OUT, "index.html"), html);

// Linked stylesheets (absolute-ized), inline <style> blocks too.
const cssLinks = [...html.matchAll(/<link[^>]+rel=["']stylesheet["'][^>]*href=["']([^"']+)["']/gi)]
  .concat([...html.matchAll(/<link[^>]+href=["']([^"']+\.css[^"']*)["'][^>]*>/gi)])
  .map((m) => m[1]);
const inlineCss = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]).join("\n");
let css = inlineCss;
const seen = new Set();
for (const href of cssLinks) {
  const abs = new URL(href, u.href).href;
  if (seen.has(abs)) continue;
  seen.add(abs);
  try {
    const body = await grab(abs);
    css += "\n/* " + abs + " */\n" + body;
  } catch (e) { console.error("css skip:", abs, e.message); }
}
fs.writeFileSync(path.join(OUT, "styles.css"), css);

let sitemap = "";
for (const cand of ["/sitemap.xml", "/sitemap_index.xml"]) {
  try { sitemap = await grab(new URL(cand, u.origin).href); fs.writeFileSync(path.join(OUT, "sitemap.xml"), sitemap); break; } catch {}
}

// Extraction
const count = (arr) => {
  const m = new Map();
  for (const v of arr) m.set(v, (m.get(v) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
};
const fonts = count([...css.matchAll(/font-family:\s*([^;}{]+)[;}]/gi)].map((m) => m[1].trim().slice(0, 80)));
const colors = count([...css.matchAll(/#[0-9a-fA-F]{3,8}\b|oklch\([^)]+\)|rgba?\([^)]+\)/g)].map((m) => m[0].toLowerCase()));
const sizes = count([...css.matchAll(/font-size:\s*([^;}{]+)[;}]/gi)].map((m) => m[1].trim()));
const radii = count([...css.matchAll(/border-radius:\s*([^;}{]+)[;}]/gi)].map((m) => m[1].trim()));
const vars = count([...css.matchAll(/--[a-z0-9-]+/gi)].map((m) => m[0]));
const title = (html.match(/<title[^>]*>([^<]*)<\/title>/i) ?? [])[1] ?? "";
const desc = (html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i) ?? [])[1] ?? "";
const h1s = [...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi)].map((m) => m[1].replace(/<[^>]+>/g, "").trim()).filter(Boolean);
const pages = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);

const top = (list, n) => list.slice(0, n).map(([v, c]) => `- \`${v}\` x${c}`).join("\n") || "- none found";
const notes = `# Site study: ${u.hostname}
Grabbed ${new Date().toISOString().slice(0, 10)} · html ${(html.length / 1024).toFixed(0)}KB · css ${(css.length / 1024).toFixed(0)}KB · ${pages.length} sitemap pages

Title: ${title}
Description: ${desc}
H1: ${h1s.slice(0, 3).join(" | ") || "(none)"}

## Fonts (by use)
${top(fonts, 8)}

## Colors (by use)
${top(colors, 15)}

## Type scale
${top(sizes, 12)}

## Radii
${top(radii, 6)}

## CSS custom properties (design tokens)
${top(vars, 20)}

## Sitemap pages
${pages.slice(0, 20).map((p) => "- " + p).join("\n") || "- no sitemap found"}

## Study rules
Learn the patterns (spacing rhythm, type scale, restraint, structure). Never
copy content, brand names, images, or distinctive copy. The lesson is craft,
not cloning.
`;
fs.writeFileSync(path.join(OUT, "DESIGN-NOTES.md"), notes);
console.log("saved to", OUT);
console.log(notes.slice(0, 2400));
