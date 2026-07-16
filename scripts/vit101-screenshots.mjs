// VIT-101 evidence: screenshot the Market Cap panel (light + dark) from the
// source UI dev server proxied to the live control plane.
import { chromium } from "../node_modules/.pnpm/playwright@1.58.2/node_modules/playwright/index.mjs";
import { mkdirSync } from "node:fs";

const BASE = process.env.VIT101_BASE ?? "http://localhost:5199";
const OUT = "doc/design/evidence/VIT-101";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
for (const theme of ["light", "dark"]) {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 1400 },
    colorScheme: theme,
  });
  const page = await context.newPage();
  await page.addInitScript((t) => {
    try {
      localStorage.setItem("theme", t);
      localStorage.setItem("paperclip-theme", t);
    } catch {}
  }, theme);
  await page.goto(`${BASE}/VIT/marketcap`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/marketcap-${theme}.png`, fullPage: true });
  console.log(`saved ${OUT}/marketcap-${theme}.png  title=${await page.title()}`);
  await context.close();
}
await browser.close();
