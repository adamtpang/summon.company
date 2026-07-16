// VIT-115 evidence: "before" screenshots of every top-level surface the via-negativa
// slate sentences (keep/demote/delete), from the source UI dev server proxied to the
// live control plane. Light theme sweep + dark for the three kept surfaces.
import { chromium } from "../node_modules/.pnpm/playwright@1.58.2/node_modules/playwright/index.mjs";
import { mkdirSync } from "node:fs";

const BASE = process.env.VIT115_BASE ?? "http://localhost:5247";
const OUT = "doc/design/evidence/VIT-115/before";
mkdirSync(OUT, { recursive: true });

const KEEP = ["/VIT/dashboard", "/VIT/messages", "/VIT/decisions"];
const SWEEP = [
  "/VIT/dashboard",
  "/VIT/dashboard/live",
  "/VIT/messages",
  "/VIT/decisions",
  "/VIT/board-chat",
  "/VIT/formation",
  "/VIT/roadmap",
  "/VIT/marketcap",
  "/VIT/org",
  "/VIT/timeline",
  "/VIT/costs",
  "/VIT/usage",
  "/VIT/activity",
  "/VIT/goals",
  "/VIT/artifacts",
  "/VIT/issues",
  "/VIT/inbox/mine",
  "/VIT/approvals/pending",
  "/VIT/agents/all",
  "/VIT/projects",
  "/VIT/workspaces",
  "/VIT/routines",
  "/VIT/search",
  "/VIT/ai-sdr",
];

const slug = (r) => r.replace(/^\/VIT\//, "").replaceAll("/", "-") || "root";

const browser = await chromium.launch();
async function shoot(route, theme) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1080 },
    colorScheme: theme,
  });
  const page = await context.newPage();
  await page.addInitScript((t) => {
    try {
      localStorage.setItem("theme", t);
      localStorage.setItem("paperclip-theme", t);
    } catch {}
  }, theme);
  try {
    await page.goto(`${BASE}${route}`, { waitUntil: "networkidle", timeout: 30000 });
  } catch {
    // networkidle can time out on polling pages; capture whatever rendered
  }
  await page.waitForTimeout(1800);
  const path = `${OUT}/${slug(route)}-${theme}.png`;
  await page.screenshot({ path });
  console.log(`saved ${path}`);
  await context.close();
}

for (const route of SWEEP) await shoot(route, "light");
for (const route of KEEP) await shoot(route, "dark");
await browser.close();
