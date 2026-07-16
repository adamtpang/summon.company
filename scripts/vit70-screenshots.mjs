// VIT-70 evidence: screenshot the Conference Room with the Priorities
// scoreboard docked beside chat (light + dark), from the source UI dev server
// proxied to the live control plane.
import { chromium } from "../node_modules/.pnpm/playwright@1.58.2/node_modules/playwright/index.mjs";
import { mkdirSync } from "node:fs";

const BASE = process.env.VIT70_BASE ?? "http://localhost:5247";
const ROUTE = process.env.VIT70_ROUTE ?? "/VIT/board-chat";
const OUT = "doc/design/evidence/VIT-70";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
for (const theme of ["light", "dark"]) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1080 },
    colorScheme: theme,
  });
  const page = await context.newPage();
  // Force the Conference Room Chat experimental flag ON for this screenshot
  // session only — a client-side response override, never a server write.
  await page.route("**/api/instance/settings/experimental", async (route) => {
    if (route.request().method() !== "GET") return route.continue();
    const response = await route.fetch();
    let body = {};
    try {
      body = await response.json();
    } catch {}
    await route.fulfill({
      response,
      json: { ...body, enableConferenceRoomChat: true },
    });
  });
  await page.addInitScript((t) => {
    try {
      localStorage.setItem("theme", t);
      localStorage.setItem("paperclip-theme", t);
    } catch {}
  }, theme);
  await page.goto(`${BASE}${ROUTE}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${OUT}/board-scoreboard-${theme}.png` });
  console.log(`saved ${OUT}/board-scoreboard-${theme}.png  title=${await page.title()}`);
  await context.close();
}
await browser.close();
