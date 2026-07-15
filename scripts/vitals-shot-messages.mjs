// One-off evidence capture for VIT-41: screenshot the Messages story in light
// and dark from a running Storybook. Usage: node scripts/vitals-shot-messages.mjs [port]
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

// Resolve playwright from the pnpm store (not hoisted to root node_modules).
const pwUrl = pathToFileURL(
  resolve(process.cwd(), "node_modules/.pnpm/playwright@1.58.2/node_modules/playwright/index.js"),
).href;
const pw = await import(pwUrl);
const chromium = pw.chromium ?? pw.default?.chromium;

const port = process.argv[2] ?? "6017";
const storyId = "product-messages--inbox";
const outDir = resolve(process.cwd(), "doc/design/evidence/VIT-41");
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
try {
  for (const theme of ["light", "dark"]) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 860 }, deviceScaleFactor: 2 });
    const url = `http://127.0.0.1:${port}/iframe.html?id=${storyId}&globals=theme:${theme}&viewMode=story`;
    await page.goto(url, { waitUntil: "networkidle", timeout: 60_000 });
    // Let the seeded greeting + layout settle.
    await page.waitForSelector('[aria-label="Conversation"]', { timeout: 30_000 });
    await page.waitForTimeout(600);
    const file = resolve(outDir, `messages-${theme}.png`);
    await page.screenshot({ path: file, fullPage: true });
    console.log(`wrote ${file}`);
    await page.close();
  }
} finally {
  await browser.close();
}
