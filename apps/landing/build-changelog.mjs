// changelog builder — renders the public build log from real git history.
// Run from apps/landing: `node build-changelog.mjs` → writes changelog.html.
// The investor-update principle: timestamps + plain first lines, straight
// from commits — progress you can audit, not narrative.
import { execSync } from "node:child_process";
import fs from "node:fs";

const raw = execSync('git log master --date=short --pretty=format:"%ad|%s" --no-merges -400', {
  cwd: "..\\..",
  encoding: "utf8",
});

const skip = /^(wip|chore\(deps|Merge|Checkpoint)/i;
const days = new Map();
for (const line of raw.split("\n")) {
  const idx = line.indexOf("|");
  if (idx < 0) continue;
  const date = line.slice(0, idx);
  const subject = line.slice(idx + 1).trim();
  if (skip.test(subject)) continue;
  if (!days.has(date)) days.set(date, []);
  days.get(date).push(subject);
}

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const fmtDate = (d) =>
  new Date(d + "T00:00:00Z").toLocaleDateString("en-US", { timeZone: "UTC", month: "long", day: "numeric", year: "numeric" });

const sections = [...days.entries()]
  .map(
    ([date, subjects]) =>
      `  <section>\n    <h2>${fmtDate(date)}</h2>\n    <ul>\n` +
      subjects.map((s) => `      <li>${esc(s)}</li>`).join("\n") +
      `\n    </ul>\n  </section>`,
  )
  .join("\n\n");

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Changelog — Summon</title>
<meta name="description" content="The Summon build log: every day of progress, straight from the commits. Public, timestamped, auditable." />
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { margin: 0; background: #ffffff; color: #0a0a0a; font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; line-height: 1.6; font-size: 15px; }
  .page { max-width: 44rem; margin: 0 auto; padding: 2.5rem 1.25rem 5rem; }
  header.site { display: flex; align-items: center; justify-content: space-between; gap: 1rem; margin-bottom: 2rem; }
  header.site a { display: inline-flex; align-items: center; gap: 0.6rem; color: inherit; text-decoration: none; font-weight: 600; }
  h1 { font-size: 1.8rem; letter-spacing: -0.02em; margin: 0 0 0.25rem; }
  .lede { color: #5a5a5a; margin: 0 0 2.5rem; }
  h2 { font-size: 0.95rem; letter-spacing: 0.04em; text-transform: uppercase; color: #5a5a5a; margin: 2.25rem 0 0.5rem; padding-top: 1.25rem; border-top: 1px solid rgba(0,0,0,0.1); }
  ul { margin: 0; padding-left: 1.1rem; }
  li { margin: 0.35rem 0; }
  a { color: #0a0a0a; }
  @media (prefers-color-scheme: dark) {
    body { background: #0a0a0a; color: #f2f2f2; }
    .lede, h2 { color: #a3a3a3; }
    h2 { border-color: rgba(255,255,255,0.14); }
    a { color: #f2f2f2; }
  }
</style>
</head>
<body>
<div class="page">
  <header class="site">
    <a href="/" aria-label="Summon home">
      <svg width="22" height="22" viewBox="0 0 32 32" aria-hidden="true"><defs><mask id="sg" maskUnits="userSpaceOnUse" x="0" y="0" width="32" height="32"><rect width="32" height="32" fill="#fff"/><path d="M1.5 16 H10 L13 10.5 L16.5 22 L19 16 H30.5" fill="none" stroke="#000" stroke-width="6.5" stroke-linecap="round" stroke-linejoin="round"/></mask></defs><rect width="32" height="32" rx="7.5" fill="#FFFFFF" stroke="#0A0A0A" stroke-opacity="0.16"/><circle cx="16" cy="16" r="10.5" fill="none" stroke="#0A0A0A" stroke-width="3" mask="url(#sg)"/><path d="M1.5 16 H10 L13 10.5 L16.5 22 L19 16 H30.5" fill="none" stroke="#0A0A0A" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>
      Summon
    </a>
    <a href="/#founding" style="font-size:.9rem;">Become a founding member</a>
  </header>
  <h1>The build log</h1>
  <p class="lede">Every day of progress, straight from the commits — public, timestamped, auditable.
  The same update an investor would get, except it never stops shipping. Generated ${new Date().toISOString().slice(0, 10)}.</p>

${sections}

</div>
</body>
</html>
`;

fs.writeFileSync("changelog.html", html);
console.log("changelog.html written: " + days.size + " days, " + [...days.values()].reduce((a, b) => a + b.length, 0) + " entries");
