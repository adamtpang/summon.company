// Build INDEX.md from the finished episode files' frontmatter (files are source of truth).
import { readFileSync, writeFileSync, readdirSync } from "node:fs";

import { existsSync } from "node:fs";
const KB = process.env.KB_DIR || "C:/Users/adamp/OneDrive/Aether/summon.company/knowledge/founders-podcast";
let cfg = {};
try { if (existsSync(KB + "/_index-config.json")) cfg = JSON.parse(readFileSync(KB + "/_index-config.json", "utf8")); } catch (e) {}
const TITLE = cfg.title || process.env.KB_TITLE || "Founders Podcast — Knowledge Base Index";
const SUBTITLE = cfg.subtitle || process.env.KB_SUBTITLE || "David Senra's [Founders Podcast](https://www.youtube.com/@founderspodcast1)";
const COLHEAD = cfg.colhead || process.env.KB_COLHEAD || "Founder / subject";
const files = readdirSync(KB).filter((f) => /^\d{3}-.*\.md$/.test(f));

function fm(txt) {
  txt = txt.replace(/^﻿/, "").replace(/\r\n/g, "\n");
  const m = txt.match(/^\s*---\n([\s\S]*?)\n---/);
  if (!m) return {};
  const o = {};
  for (const line of m[1].split("\n")) {
    const mm = line.match(/^([a-z_]+):\s*(.*)$/i);
    if (!mm) continue;
    let v = mm[2].trim();
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1).replace(/\\"/g, '"');
    o[mm[1]] = v;
  }
  return o;
}

const rows = files.map((f) => {
  const d = fm(readFileSync(KB + "/" + f, "utf8"));
  return { file: f, rank: Number(d.rank || 999), title: d.title || f,
    subject: d.guest || d.subject || "", source_book: d.source_book || d.company || "",
    principle: d.principle || "", url: d.youtube_url || "",
    published: d.published || "", views: Number(d.views || 0), words: Number(d.word_count || 0),
    duration: Number(d.duration_min || 0) };
}).sort((a, b) => a.rank - b.rank);

const totalWords = rows.reduce((s, r) => s + r.words, 0);
const missing = [];
for (let i = 1; i <= 20; i++) if (!rows.find((r) => r.rank === i)) missing.push(i);

let md = `# ${TITLE}

**${rows.length} episodes** · ${totalWords.toLocaleString()} words · ${SUBTITLE}
Extracted via [youchop.app/extract](https://youchop.app/extract). Files numbered by popularity rank (view count).

> For Summon agents: each file's frontmatter carries the subject/guest, source, and a one-line \`principle\`; the body has **Key lessons** (synthesis) + the full cleaned **Transcript** (ad reads removed, words preserved).

| # | ${COLHEAD} | The principle it teaches | Source | File |
|---|---|---|---|---|
`;
for (const r of rows) {
  const p = r.principle.replace(/\|/g, "\\|");
  const sb = (r.source_book || "—").replace(/\|/g, "\\|");
  md += `| ${r.rank} | **${r.subject}** | ${p} | ${sb} | [${r.file}](${r.file}) |\n`;
}
md += `\n## Episodes in detail\n\n`;
for (const r of rows) {
  md += `### ${r.rank}. ${r.title}\n`;
  md += `- **Subject:** ${r.subject}${r.source_book ? ` · **Book:** ${r.source_book}` : ""}\n`;
  md += `- **Principle:** ${r.principle}\n`;
  md += `- ${r.views.toLocaleString()} views · ${r.duration} min · published ${r.published} · ${r.words.toLocaleString()} words\n`;
  md += `- [Watch](${r.url}) · [\`${r.file}\`](${r.file})\n\n`;
}
if (missing.length) md += `\n> ⚠ Missing ranks (rerun their subagent): ${missing.join(", ")}\n`;

writeFileSync(KB + "/INDEX.md", md, "utf8");
console.log(`INDEX.md written: ${rows.length} episodes, ${totalWords.toLocaleString()} words.`);
if (missing.length) console.log("MISSING ranks:", missing.join(", "));
else console.log("All 20 ranks present.");
