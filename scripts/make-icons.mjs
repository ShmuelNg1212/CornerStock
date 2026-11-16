// Makes the app icons in public/ from the logo mark. Run: node scripts/make-icons.mjs
import sharp from "sharp";

const mark = `<path d="M6 6h32v9H15v27H6z" fill="#f6f3ec"/><circle cx="31" cy="31" r="12" fill="#d45a32"/>
<circle cx="30" cy="25.5" r="1.9" fill="#f6f3ec"/><circle cx="35.5" cy="27.5" r="1.9" fill="#f6f3ec"/><circle cx="30.5" cy="31.5" r="1.9" fill="#f6f3ec"/>`;

// `inset` is the space around the mark, in units of the 48-unit mark. Maskable icons need more.
const svg = (inset, radius) => {
  const size = 48 + inset * 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}">
<rect width="${size}" height="${size}" rx="${radius}" fill="#172a3a"/><g transform="translate(${inset} ${inset})">${mark}</g></svg>`;
};

const out = [
  ["public/icon-192.png", 192, svg(10, 14)],
  ["public/icon-512.png", 512, svg(10, 14)],
  ["public/icon-maskable-512.png", 512, svg(20, 0)],
  ["src/app/apple-icon.png", 180, svg(10, 0)],
  ["src/app/icon.png", 64, svg(6, 12)],
];
for (const [file, size, source] of out) {
  await sharp(Buffer.from(source), { density: 600 }).resize(size, size).png().toFile(file);
  console.log(file);
}
