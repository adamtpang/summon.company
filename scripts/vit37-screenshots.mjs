// VIT-37 evidence: capture the model quick-switch chip and its picker against the
// live control plane (vite dev on 5199 proxies /api to 3100).
//   ui/node_modules/.bin/vite --port 5199
//   node scripts/vit37-screenshots.mjs
import { chromium } from "../node_modules/.pnpm/playwright@1.58.2/node_modules/playwright/index.mjs";
import { mkdir } from "node:fs/promises";

const BASE = process.env.VIT37_BASE ?? "http://localhost:5199";
const AGENT = process.env.VIT37_AGENT ?? "vitals-engineer";
const OUT = "doc/evidence/vit-37";

const CHIP = '[data-testid="model-quick-switch-chip"]';
const POPOVER = '[data-testid="model-quick-switch-popover"]';

async function shoot(page, theme) {
  // The board themes via a .dark class from localStorage (APP_THEME_STORAGE_KEY),
  // not prefers-color-scheme, so emulateMedia would be a no-op here.
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.evaluate((t) => window.localStorage.setItem("vitals.theme", t), theme);
  // The board polls on intervals, so networkidle never settles; wait on the chip.
  await page.goto(`${BASE}/VIT/agents/${AGENT}`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(
    (t) => document.documentElement.classList.contains("dark") === (t === "dark"),
    theme,
    { timeout: 15_000 },
  );
  await page.waitForSelector(CHIP, { timeout: 30_000 });

  const chip = page.locator(CHIP).first();
  console.log(`[${theme}] chip reads: ${(await chip.textContent())?.trim()}`);
  await page.screenshot({ path: `${OUT}/chip-closed-${theme}.png` });

  // Click 1 of 2: open the picker. (Click 2 is a model/effort row, which writes.)
  await chip.click();
  await page.waitForSelector(POPOVER, { timeout: 15_000 });
  await page.waitForTimeout(600); // let the models query settle
  const models = await page.locator(`${POPOVER} [data-testid^="model-quick-switch-model-"]`).count();
  const efforts = await page.locator(`${POPOVER} [data-testid^="model-quick-switch-effort-"]`).count();
  console.log(`[${theme}] picker open: ${models} models, ${efforts} effort tiers`);
  await page.screenshot({ path: `${OUT}/chip-open-${theme}.png` });
  await page.keyboard.press("Escape");
}

const browser = await chromium.launch();
try {
  await mkdir(OUT, { recursive: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  for (const theme of ["light", "dark"]) await shoot(page, theme);
  console.log(`\nWrote screenshots to ${OUT}/`);
} finally {
  await browser.close();
}
