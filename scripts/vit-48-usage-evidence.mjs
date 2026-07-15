// VIT-48 evidence harness: screenshots the /usage page light+dark against the
// live control plane (via the ui dev server proxy), then re-captures with a
// simulated 92% Claude window + exhausted Codex window injected at the network
// layer to demo the threshold-alert banner without touching live quota state.
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const BASE = process.env.VIT48_BASE ?? "http://localhost:5173";
const OUT = "doc/evidence/vit-48";
mkdirSync(OUT, { recursive: true });

const SIMULATED = [
  {
    provider: "anthropic",
    source: "claude-oauth",
    ok: true,
    windows: [
      { label: "5h", usedPercent: 44, resetsAt: new Date(Date.now() + 2.5 * 3_600_000).toISOString(), valueLabel: null },
      { label: "7d", usedPercent: 92, resetsAt: new Date(Date.now() + 3.2 * 86_400_000).toISOString(), valueLabel: null },
    ],
  },
  {
    provider: "openai",
    source: "codex-cli",
    ok: true,
    windows: [
      { label: "5h", usedPercent: 100, resetsAt: new Date(Date.now() + 1.1 * 3_600_000).toISOString(), valueLabel: null },
      { label: "1w", usedPercent: 100, resetsAt: "2026-07-22T07:00:00.000Z", valueLabel: null },
    ],
  },
];

async function capture(page, name) {
  await page.goto(`${BASE}/vit/usage`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
  console.log(`captured ${OUT}/${name}.png`);
}

const browser = await chromium.launch();
for (const theme of ["light", "dark"]) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await context.addInitScript((t) => {
    window.localStorage.setItem("vitals.theme", t);
  }, theme);

  // live data
  let page = await context.newPage();
  await capture(page, `usage-live-${theme}`);
  await page.close();

  // simulated 90%+ consumption (acceptance: threshold alert fires)
  page = await context.newPage();
  await page.route("**/costs/quota-windows", (route) =>
    route.fulfill({ contentType: "application/json", body: JSON.stringify(SIMULATED) }),
  );
  await capture(page, `usage-simulated-alerts-${theme}`);
  await page.close();
  await context.close();
}
await browser.close();
