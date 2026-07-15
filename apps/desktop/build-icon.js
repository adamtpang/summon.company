// Renders icon.svg -> multi-size icon.ico (16..256) using sharp + png-to-ico.
// Run: node build-icon.js   (deps are local devDependencies)
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const pngToIco = require('png-to-ico');

const SIZES = [16, 32, 48, 64, 128, 256];
const svgPath = path.join(__dirname, 'icon.svg');
const icoPath = path.join(__dirname, 'icon.ico');

async function main() {
  const svg = fs.readFileSync(svgPath);
  const pngs = await Promise.all(
    SIZES.map((size) =>
      sharp(svg, { density: 300 }).resize(size, size).png().toBuffer()
    )
  );
  const ico = await pngToIco(pngs);
  fs.writeFileSync(icoPath, ico);
  console.log(
    `wrote ${icoPath} (${ico.length} bytes, sizes: ${SIZES.join(', ')})`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
