// contrast.mjs — measures the WCAG contrast of every text element of a still against the frame it sits on.
// Inputs: the layer's transparent PNG, the background frame (1920 × 1080), and the boxes from src/boxes.js.
// Text pixels = overlay alpha ≥ 128 inside the box (their median colour is the text colour as rendered);
// background = frame pixels inside the box where the overlay is clear. The worst case is reported: the text's
// luminance against the 5th and the 95th percentile of the background's luminance, whichever is lower.
// CLI: node scripts/contrast.mjs <overlay.png> <background.png> <boxes.json>
import { readFileSync } from 'node:fs';
import { PNG } from 'pngjs';

const lin = (v) => {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
const lum = (r, g, b) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const ratio = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
const pct = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.floor(p * (sorted.length - 1)))];
const median = (arr) => {
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};

export const readPng = (path) => PNG.sync.read(readFileSync(path));

export function measureBoxes(overlay, bg, boxes) {
  if (overlay.width !== bg.width || overlay.height !== bg.height) throw new Error(`size mismatch overlay ${overlay.width}×${overlay.height} vs bg ${bg.width}×${bg.height}`);
  const W = overlay.width;
  return boxes.map((box) => {
    const tr = [], tg = [], tb = [], bgL = [];
    const x0 = Math.max(0, box.x), y0 = Math.max(0, box.y);
    const x1 = Math.min(W, box.x + box.w), y1 = Math.min(overlay.height, box.y + box.h);
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const i = (y * W + x) * 4;
        const a = overlay.data[i + 3];
        if (a >= 128) {
          tr.push(overlay.data[i]); tg.push(overlay.data[i + 1]); tb.push(overlay.data[i + 2]);
        } else if (a < 26) {
          bgL.push(lum(bg.data[i], bg.data[i + 1], bg.data[i + 2]));
        }
      }
    }
    if (!tr.length) return { ...box, textPixels: 0, pass: false, note: 'no text pixels in box' };
    bgL.sort((a, b) => a - b);
    const text = [median(tr), median(tg), median(tb)];
    const lt = lum(...text);
    const p5 = pct(bgL, 0.05), p50 = pct(bgL, 0.5), p95 = pct(bgL, 0.95);
    const worst = Math.min(ratio(lt, p5), ratio(lt, p95));
    const typical = ratio(lt, p50);
    return { ...box, textPixels: tr.length, textRgb: text, bgLumaP5: p5, bgLumaP50: p50, bgLumaP95: p95, worst: +worst.toFixed(2), typical: +typical.toFixed(2), pass: worst >= 4.5 };
  });
}

export const formatTable = (rows) => {
  const lines = ['| element | text rgb | worst | typical | ≥ 4.5 |', '| --- | --- | --- | --- | --- |'];
  for (const r of rows) {
    if (!r.textPixels) { lines.push(`| ${r.name} | — | — | — | ✗ (${r.note}) |`); continue; }
    lines.push(`| ${r.name} | ${r.textRgb.join(' ')} | **${r.worst}** | ${r.typical} | ${r.pass ? '✓' : '✗'} |`);
  }
  return lines.join('\n');
};

if (process.argv[1] && import.meta.url === new URL(`file:///${process.argv[1].replace(/\\/g, '/')}`).href) {
  const [overlay, bg, boxes] = process.argv.slice(2);
  const rows = measureBoxes(readPng(overlay), readPng(bg), JSON.parse(readFileSync(boxes, 'utf8')));
  console.log(formatTable(rows));
}
