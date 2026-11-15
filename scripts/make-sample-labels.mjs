// One-off generator for the three demo label images in public/samples (run once; not used at runtime).
// Renders simple SVG "box fronts" with generic names to small WebP files with sharp, which Next.js
// already installs. Usage: node scripts/make-sample-labels.mjs
import sharp from "sharp";
import { mkdir, stat } from "node:fs/promises";

const labels = [
  {
    file: "amlodipine-5mg.webp",
    name: "AMLODIPINE",
    strength: "5 mg",
    form: "Tablets IP",
    composition: "Each tablet contains: Amlodipine Besylate IP eq. to Amlodipine 5 mg",
    band: "#2F6B4F",
  },
  {
    file: "levothyroxine-50mcg.webp",
    name: "LEVOTHYROXINE",
    strength: "50 mcg",
    form: "Tablets IP",
    composition: "Each tablet contains: Levothyroxine Sodium IP 50 mcg",
    band: "#7A4E9C",
  },
  {
    file: "paracetamol-500mg.webp",
    name: "PARACETAMOL",
    strength: "500 mg",
    form: "Tablets IP",
    composition: "Each uncoated tablet contains: Paracetamol IP 500 mg",
    band: "#B5452F",
  },
];

const svg = (
  l,
) => `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="420" viewBox="0 0 720 420">
  <rect width="720" height="420" fill="#F4F1EA"/>
  <rect x="0" y="0" width="720" height="70" fill="${l.band}"/>
  <text x="32" y="46" font-family="Arial, Helvetica, sans-serif" font-size="26" font-weight="700" fill="#FFFFFF">Rx  10 x 10 Tablets</text>
  <text x="32" y="160" font-family="Arial, Helvetica, sans-serif" font-size="68" font-weight="800" fill="#1C1C1C">${l.name}</text>
  <text x="32" y="215" font-family="Arial, Helvetica, sans-serif" font-size="34" fill="#1C1C1C">${l.form}</text>
  <rect x="32" y="240" width="190" height="64" rx="10" fill="${l.band}"/>
  <text x="127" y="285" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="38" font-weight="800" fill="#FFFFFF">${l.strength}</text>
  <text x="32" y="345" font-family="Arial, Helvetica, sans-serif" font-size="21" fill="#333333">${l.composition}</text>
  <text x="32" y="392" font-family="Arial, Helvetica, sans-serif" font-size="18" fill="#555555">Sample label for the Kinloop demo. Not a real product.</text>
</svg>`;

await mkdir("public/samples", { recursive: true });
for (const l of labels) {
  const out = `public/samples/${l.file}`;
  await sharp(Buffer.from(svg(l)))
    .webp({ quality: 78 })
    .toFile(out);
  const { size } = await stat(out);
  process.stdout.write(`${out} ${Math.round(size / 1024)} KB\n`);
}
