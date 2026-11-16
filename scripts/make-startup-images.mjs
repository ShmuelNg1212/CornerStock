// Makes the startup images that iOS shows while the home-screen app opens.
// iOS needs one image for each screen size. Android makes its own from the web app manifest.
//
// Run: CHROME=<path to Chrome or Chromium> node scripts/make-startup-images.mjs
// It needs the playwright-core package (npx -p playwright-core) and the network for the fonts.
// It writes public/startup/*.png and src/lib/startup-images.json. See doc/wiki/setup.md.
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright-core";

/** Screen sizes in CSS pixels, portrait, and the pixel ratio. iPads also get landscape. */
const DEVICES = [
  // iPhone
  [440, 956, 3], [420, 912, 3], [402, 874, 3], [430, 932, 3], [393, 852, 3], [428, 926, 3],
  [390, 844, 3], [375, 812, 3], [414, 896, 3], [414, 896, 2], [414, 736, 3], [375, 667, 2], [320, 568, 2],
  // iPad
  [1032, 1376, 2], [1024, 1366, 2], [834, 1210, 2], [834, 1194, 2], [820, 1180, 2], [834, 1112, 2],
  [810, 1080, 2], [768, 1024, 2], [744, 1133, 2],
];

const mark = `<svg viewBox="0 0 48 48" width="64" height="64" aria-hidden="true">
  <path d="M6 6h32v9H15v27H6z" fill="#f6f3ec"/>
  <circle cx="31" cy="31" r="12" fill="#d45a32"/>
  <circle cx="30" cy="25.5" r="1.9" fill="#f6f3ec"/>
  <circle cx="35.5" cy="27.5" r="1.9" fill="#f6f3ec"/>
  <circle cx="30.5" cy="31.5" r="1.9" fill="#f6f3ec"/>
</svg>`;

// The same mark, wordmark, and endorsement as the sign-in screen, centered on ink navy.
const html = `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@500&family=Space+Grotesk:wght@700&display=block" rel="stylesheet">
<style>
  html, body { margin: 0; height: 100%; background: #172a3a; }
  body { display: grid; place-items: center; }
  .lockup { display: flex; flex-direction: column; align-items: center; transform: translateY(-4%); }
  .word { margin-top: 20px; font: 700 30px/1 "Space Grotesk", sans-serif; letter-spacing: -0.01em; color: #f6f3ec; }
  .endorse { margin-top: 12px; display: flex; align-items: center; gap: 12px; font: 500 15px/1 Inter, sans-serif; color: #c3cbd1; }
  .rule { width: 24px; height: 1px; background: #d7a55b; }
</style></head>
<body><div class="lockup">${mark}<div class="word">CORNERSTOCK</div><div class="endorse"><span class="rule"></span>For Bowlers Corner<span class="rule"></span></div></div></body></html>`;

const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined });
mkdirSync("public/startup", { recursive: true });
const images = [];
for (const [width, height, ratio] of DEVICES) {
  const sizes = width >= 744 ? [[width, height, "portrait"], [height, width, "landscape"]] : [[width, height, "portrait"]];
  for (const [w, h, orientation] of sizes) {
    const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: ratio });
    await page.setContent(html, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    const file = `startup/${w * ratio}x${h * ratio}.png`;
    await page.screenshot({ path: `public/${file}` });
    await page.close();
    images.push({
      url: `/${file}`,
      media: `(device-width: ${width}px) and (device-height: ${height}px) and (-webkit-device-pixel-ratio: ${ratio}) and (orientation: ${orientation})`,
    });
  }
}
await browser.close();
writeFileSync("src/lib/startup-images.json", JSON.stringify(images, null, 2) + "\n");
console.log(`Wrote ${images.length} startup images.`);
