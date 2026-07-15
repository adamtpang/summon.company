// One-off evidence capture for VIT-51: screenshot the desktop-IA contact sheet
// (self-contained HTML) in light and dark. Usage: node scripts/vit51-contact-sheet-shots.mjs
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

// Resolve playwright from the pnpm store (not hoisted to root node_modules).
const pwUrl = pathToFileURL(
  resolve(process.cwd(), "node_modules/.pnpm/playwright@1.58.2/node_modules/playwright/index.js"),
).href;
const pw = await import(pwUrl);
const chromium = pw.chromium ?? pw.default?.chromium;

const sheet = pathToFileURL(resolve(process.cwd(), "doc/design/evidence/VIT-51/contact-sheet.html")).href;
const outDir = resolve(process.cwd(), "doc/design/evidence/VIT-51");

const browser = await chromium.launch();
try {
  for (const theme of ["light", "dark"]) {
    const page = await browser.newPage({ viewport: { width: 1640, height: 1200 }, deviceScaleFactor: 2 });
    await page.goto(`${sheet}?theme=${theme}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(300);
    const file = resolve(outDir, `contact-sheet-${theme}.png`);
    await page.screenshot({ path: file, fullPage: true });
    console.log(`wrote ${file}`);
    await page.close();
  }
} finally {
  await browser.close();
}
