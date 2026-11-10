// probe.mjs — contrast of a text colour against a region of background frames, before placing text there.
//   node scripts/probe.mjs <bgDir> <frames: 21,40 or 10-60:5> <x> <y> <w> <h> <textHex>
// Prints per frame the background luminance p5 / p50 / p95 (0..1) and the WCAG ratio of the text colour against the
// worst of p5 / p95. Frames are Blender frames (%04d.png); the frame is scaled to 1920 × 1080 by nearest sampling.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PNG } from 'pngjs';

const [bgDir, framesArg, x, y, w, h, hex] = process.argv.slice(2);
const lin = (v) => {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
const lum = (r, g, b) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const ratio = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
const c = hex.replace('#', '');
const lt = lum(parseInt(c.slice(0, 2), 16), parseInt(c.slice(2, 4), 16), parseInt(c.slice(4, 6), 16));

const frames = [];
for (const part of framesArg.split(',')) {
  const m = part.match(/^(\d+)-(\d+)(?::(\d+))?$/);
  if (m) for (let f = +m[1]; f <= +m[2]; f += +(m[3] ?? 1)) frames.push(f);
  else frames.push(+part);
}
const box = [x, y, w, h].map(Number);
console.log(`box x${box[0]} y${box[1]} ${box[2]}×${box[3]} · text ${hex}`);
let worstAll = Infinity;
for (const f of frames) {
  const png = PNG.sync.read(readFileSync(resolve(bgDir, `${String(f).padStart(4, '0')}.png`)));
  const sx = png.width / 1920, sy = png.height / 1080;
  const L = [];
  for (let yy = box[1]; yy < box[1] + box[3]; yy += 2) {
    for (let xx = box[0]; xx < box[0] + box[2]; xx += 2) {
      const px = Math.min(png.width - 1, Math.floor(xx * sx)), py = Math.min(png.height - 1, Math.floor(yy * sy));
      const i = (py * png.width + px) * 4;
      L.push(lum(png.data[i], png.data[i + 1], png.data[i + 2]));
    }
  }
  L.sort((a, b) => a - b);
  const p = (q) => L[Math.floor(q * (L.length - 1))];
  const worst = Math.min(ratio(lt, p(0.05)), ratio(lt, p(0.95)));
  worstAll = Math.min(worstAll, worst);
  console.log(`f${String(f).padStart(4, '0')}  bg p5 ${p(0.05).toFixed(3)}  p50 ${p(0.5).toFixed(3)}  p95 ${p(0.95).toFixed(3)}  → worst ${worst.toFixed(2)} ${worst >= 4.5 ? 'ok' : 'LOW'}`);
}
console.log(`worst over frames: ${worstAll.toFixed(2)}`);
