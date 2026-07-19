// Summon identity build · VIT-36
// Renders the board-approved "Summon Circle" mark into every production surface:
//   design/logo/dist/  png set (16..1024), summon.ico, summon.icns, tray glyphs
//   apps/desktop/      icon.ico + assets/tray/ (light/dark ico, macOS Template pngs)
//   ui/public/         favicon pngs/ico, apple-touch-icon, android-chrome pngs
// Run from repo root: node design/logo/build-icons.mjs
// Deps resolve from apps/desktop/node_modules (sharp, png-to-ico).

import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import { createRequire } from 'node:module';

const here = path.dirname(url.fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', '..');
const desktopDir = path.join(root, 'apps', 'desktop');
const require = createRequire(path.join(desktopDir, 'package.json'));
const sharp = require('sharp');
const pngToIco = require('png-to-ico');

const distDir = path.join(here, 'dist');
const pngDir = path.join(distDir, 'png');
const trayDistDir = path.join(distDir, 'tray');
const trayAppDir = path.join(desktopDir, 'assets', 'tray');
const uiPublic = path.join(root, 'ui', 'public');
for (const d of [distDir, pngDir, trayDistDir, trayAppDir]) fs.mkdirSync(d, { recursive: true });

const tileSvg = fs.readFileSync(path.join(here, 'summon-app-icon.svg'));
const tileSmallSvg = fs.readFileSync(path.join(here, 'summon-app-icon-small.svg'));

// Full-bleed square (no corner radius) for platforms that apply their own mask
// (apple-touch-icon, android-chrome maskable).
const fullBleedSvg = Buffer.from(
  tileSvg.toString().replace('rx="240"', 'rx="0"')
);

// Open monochrome glyph for tray/menubar; small-variant strokes for 16-32 px.
const trayGlyph = (color) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <defs>
    <mask id="gap" maskUnits="userSpaceOnUse" x="0" y="0" width="64" height="64">
      <rect width="64" height="64" fill="#fff"/>
      <path d="M3 32 H20 L26 21 L33 44 L38 32 H61" fill="none" stroke="#000" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"/>
    </mask>
  </defs>
  <circle cx="32" cy="32" r="21" fill="none" stroke="${color}" stroke-width="6" mask="url(#gap)"/>
  <path d="M3 32 H20 L26 21 L33 44 L38 32 H61" fill="none" stroke="${color}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`);

const render = (svg, size, srcWidth = 64) =>
  sharp(svg, { density: Math.max(72, (size / srcWidth) * 72) })
    .resize(size, size)
    .png()
    .toBuffer();

// Small-variant source below 48 px so strokes survive rasterization.
const tileAt = (size) =>
  size < 48 ? render(tileSmallSvg, size, 64) : render(tileSvg, size, 1024);

// ICNS container: header + typed PNG chunks (modern PNG-in-ICNS types).
function packIcns(entries) {
  const chunks = entries.map(({ type, png }) => {
    const head = Buffer.alloc(8);
    head.write(type, 0, 'ascii');
    head.writeUInt32BE(png.length + 8, 4);
    return Buffer.concat([head, png]);
  });
  const body = Buffer.concat(chunks);
  const header = Buffer.alloc(8);
  header.write('icns', 0, 'ascii');
  header.writeUInt32BE(body.length + 8, 4);
  return Buffer.concat([header, body]);
}

async function main() {
  // 1) PNG set
  const sizes = [16, 20, 24, 32, 48, 64, 128, 256, 512, 1024];
  const pngs = {};
  for (const s of sizes) {
    pngs[s] = await tileAt(s);
    fs.writeFileSync(path.join(pngDir, `summon-${s}.png`), pngs[s]);
  }

  // 2) Windows ICO (multi-size) -> dist + apps/desktop/icon.ico
  const ico = await pngToIco([16, 20, 24, 32, 48, 64, 128, 256].map((s) => pngs[s]));
  fs.writeFileSync(path.join(distDir, 'summon.ico'), ico);
  fs.writeFileSync(path.join(desktopDir, 'icon.ico'), ico);

  // 3) macOS ICNS
  const icns = packIcns([
    { type: 'icp4', png: pngs[16] },
    { type: 'icp5', png: pngs[32] },
    { type: 'ic11', png: pngs[32] },
    { type: 'ic12', png: pngs[64] },
    { type: 'ic07', png: pngs[128] },
    { type: 'ic08', png: pngs[256] },
    { type: 'ic13', png: pngs[256] },
    { type: 'ic09', png: pngs[512] },
    { type: 'ic14', png: pngs[512] },
    { type: 'ic10', png: pngs[1024] },
  ]);
  fs.writeFileSync(path.join(distDir, 'summon.icns'), icns);

  // 4) Tray glyphs
  const traySizes = [16, 20, 24, 32];
  const glyphSet = async (color) =>
    Promise.all(traySizes.map((s) => render(trayGlyph(color), s)));
  const white = await glyphSet('#FFFFFF'); // dark taskbars
  const ink = await glyphSet('#0A0A0A'); // light taskbars
  const black = await glyphSet('#000000'); // macOS template
  const trayDark = await pngToIco(white);
  const trayLight = await pngToIco(ink);
  for (const dir of [trayDistDir, trayAppDir]) {
    fs.writeFileSync(path.join(dir, 'summon-tray-dark.ico'), trayDark);
    fs.writeFileSync(path.join(dir, 'summon-tray-light.ico'), trayLight);
    fs.writeFileSync(path.join(dir, 'summonTrayTemplate.png'), black[0]);
    fs.writeFileSync(path.join(dir, 'summonTrayTemplate@2x.png'), black[3]);
  }

  // 5) Favicons + PWA icons -> ui/public
  fs.writeFileSync(path.join(uiPublic, 'favicon-16x16.png'), pngs[16]);
  fs.writeFileSync(path.join(uiPublic, 'favicon-32x32.png'), pngs[32]);
  fs.writeFileSync(
    path.join(uiPublic, 'favicon.ico'),
    await pngToIco([pngs[16], pngs[32], pngs[48]])
  );
  fs.writeFileSync(
    path.join(uiPublic, 'apple-touch-icon.png'),
    await render(fullBleedSvg, 180, 1024)
  );
  fs.writeFileSync(
    path.join(uiPublic, 'android-chrome-192x192.png'),
    await render(fullBleedSvg, 192, 1024)
  );
  fs.writeFileSync(
    path.join(uiPublic, 'android-chrome-512x512.png'),
    await render(fullBleedSvg, 512, 1024)
  );

  console.log('Summon identity rendered: png set, ico, icns, tray glyphs, favicons.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
