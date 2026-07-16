// VIT-61 evidence harness: captures the Elon-operating-model UI against the
// live control plane through the ui dev server — parallel lanes (default
// tasks view), kanban + list with time-in-state chips, and the five-gate
// Algorithm strip on task detail. Light + dark, desktop + mobile lanes.
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const BASE = process.env.VIT61_BASE ?? "http://localhost:5173";
const OUT = "doc/design/evidence/VIT-61";
mkdirSync(OUT, { recursive: true });

const DETAIL_ISSUES = ["VIT-61", "VIT-4"];

async function settle(page) {
  await page.waitForTimeout(1800);
}

const browser = await chromium.launch();
for (const theme of ["light", "dark"]) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await context.addInitScript((t) => {
    window.localStorage.setItem("vitals.theme", t);
  }, theme);

  const page = await context.newPage();

  // 1. Tasks — parallel lanes are the default view for a fresh browser.
  await page.goto(`${BASE}/vit/issues`, { waitUntil: "networkidle" });
  await settle(page);
  await page.screenshot({ path: `${OUT}/lanes-default-${theme}.png`, fullPage: true });
  console.log(`captured lanes-default-${theme}`);

  // 2. Kanban board with age chips.
  await page.getByRole("button", { name: "Board view" }).click();
  await settle(page);
  await page.screenshot({ path: `${OUT}/board-age-chips-${theme}.png`, fullPage: false });
  console.log(`captured board-age-chips-${theme}`);

  // 3. List with age chips.
  await page.getByRole("button", { name: "List view" }).click();
  await settle(page);
  await page.screenshot({ path: `${OUT}/list-age-chips-${theme}.png`, fullPage: false });
  console.log(`captured list-age-chips-${theme}`);

  // Restore lanes so stored state matches the shipped default.
  await page.getByRole("button", { name: "Lanes view" }).click();
  await settle(page);

  // 4. Task detail — Algorithm strip (an in-flight task and a done task).
  for (const identifier of DETAIL_ISSUES) {
    await page.goto(`${BASE}/vit/issues/${identifier}`, { waitUntil: "networkidle" });
    await settle(page);
    const strip = page.getByTestId("algorithm-strip");
    await strip.waitFor({ state: "visible", timeout: 10_000 });
    await page.screenshot({ path: `${OUT}/detail-${identifier}-${theme}.png`, fullPage: false });
    console.log(`captured detail-${identifier}-${theme}`);
  }

  await page.close();

  // 5. Mobile lanes (390px) — chips wrap, edges still draw.
  const mobile = await context.newPage();
  await mobile.setViewportSize({ width: 390, height: 844 });
  await mobile.goto(`${BASE}/vit/issues`, { waitUntil: "networkidle" });
  await settle(mobile);
  await mobile.screenshot({ path: `${OUT}/lanes-mobile-${theme}.png`, fullPage: true });
  console.log(`captured lanes-mobile-${theme}`);
  await mobile.close();

  await context.close();
}
await browser.close();
console.log("done");
