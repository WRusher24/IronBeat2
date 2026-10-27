import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

/**
 * Generates the PWA icon set from a single vector source.
 *
 * Run with: npm run icons
 */

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "public", "icons");

/** IronBeat mark: amber waveform on charcoal. */
function buildSvg({ scale = 1, background = true } = {}) {
  const bars = [
    { h: 96, y: 208 },
    { h: 160, y: 176 },
    { h: 224, y: 144 },
    { h: 144, y: 184 },
    { h: 80, y: 216 },
  ];

  const width = 30;
  const gap = 22;
  const totalWidth = bars.length * width + (bars.length - 1) * gap;
  const startX = (512 - totalWidth) / 2;

  const rects = bars
    .map((bar, index) => {
      const x = startX + index * (width + gap);
      return `<rect x="${x}" y="${bar.y}" width="${width}" height="${bar.h}" rx="${width / 2}" fill="#C67D3B" />`;
    })
    .join("");

  const bg = background
    ? `<rect width="512" height="512" fill="#1C1C1E" />`
    : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
    ${bg}
    <g transform="translate(256 256) scale(${scale}) translate(-256 -256)">
      ${rects}
    </g>
  </svg>`;
}

async function main() {
  await mkdir(outDir, { recursive: true });

  const jobs = [
    { file: "icon-192.png", size: 192, svg: buildSvg() },
    { file: "icon-512.png", size: 512, svg: buildSvg() },
    { file: "apple-touch-icon.png", size: 180, svg: buildSvg() },
    // Maskable icons need their content inside the safe zone (~80%).
    { file: "maskable-512.png", size: 512, svg: buildSvg({ scale: 0.78 }) },
    { file: "favicon-32.png", size: 32, svg: buildSvg() },
  ];

  for (const job of jobs) {
    const buffer = Buffer.from(job.svg);
    await sharp(buffer)
      .resize(job.size, job.size, { fit: "cover" })
      .png({ compressionLevel: 9 })
      .toFile(path.join(outDir, job.file));
    console.log(`✓ ${job.file} (${job.size}×${job.size})`);
  }

  // A tiny SVG favicon for modern browsers that prefer vectors.
  await writeFile(path.join(root, "public", "favicon.svg"), buildSvg(), "utf8");
  console.log("✓ favicon.svg");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
