// hud-check.mjs — the scene label (HUD, top-left) on EVERY frame of the finished background (render + live capture):
// the rendered colour's WCAG contrast against the p5 / p95 luminance of the label's box on the frame (worst of the
// two), the same for the other colour, and the frames where the better colour changes — the measured switch frames
// that HUD_TONE_RUNS (src/layout.js) records. With the layer rendered (out/final/layer) it also lists every frame on
// which any layer pixel falls in the bottom band the page's dock covers (140 px at 1920).
//
//   node scripts/hud-check.mjs [--bg out/final/bg] [--layer out/final/layer] [--band 140]
//
// Output: stills/hud_check.md (+ the summary on stdout).
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { PNG } from 'pngjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const filmDir = resolve(root, '..');
const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : def;
};
const bgDir = resolve(root, opt('--bg', 'out/final/bg'));
const layerDir = resolve(root, opt('--layer', 'out/final/layer'));
const band = Number(opt('--band', '140'));
const repoRel = (p) => relative(resolve(root, '../..'), p).replace(/\\/g, '/');

const { normalizeFilm, sceneAt } = await import(pathToFileURL(resolve(root, 'src/data/normalize.js')).href);
const { boxesFor } = await import(pathToFileURL(resolve(root, 'src/boxes.js')).href);
const { COLOR, H, HUD_TONE_RUNS, W, hudColor } = await import(pathToFileURL(resolve(root, 'src/layout.js')).href);
const { luminance, contrastOfLuminance: contrast } = await import(pathToFileURL(resolve(root, 'src/motion.js')).href);
const lin = (v) => (v / 255 <= 0.04045 ? v / 255 / 12.92 : ((v / 255 + 0.055) / 1.055) ** 2.4);
const lumRgb = (r, g, b) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);

const film = normalizeFilm(JSON.parse(readFileSync(resolve(filmDir, 'scenes.json'), 'utf8')), 'scenes.json');
const s2 = JSON.parse(readFileSync(resolve(filmDir, 'anchors_s2.json'), 'utf8'));
const L = { cream: luminance(COLOR.cream), ink: luminance(COLOR.ink) };

// ---- the label on every frame
const rows = [];
for (let f = 0; f < film.frames; f++) {
  const p = resolve(bgDir, `${String(f + 1).padStart(4, '0')}.png`);
  if (!existsSync(p)) continue;
  const png = PNG.sync.read(readFileSync(p));
  const sx = png.width / W, sy = png.height / H;
  const b = boxesFor('hud', f, film, s2).find((x) => x.name === 'hud');
  const lums = [];
  for (let y = b.y; y < b.y + b.h; y++)
    for (let x = b.x; x < b.x + b.w; x++) {
      const i = (Math.min(png.height - 1, Math.floor(y * sy)) * png.width + Math.min(png.width - 1, Math.floor(x * sx))) * 4;
      lums.push(lumRgb(png.data[i], png.data[i + 1], png.data[i + 2]));
    }
  lums.sort((a, c) => a - c);
  const q = (k) => lums[Math.floor(k * (lums.length - 1))];
  const worst = (lt) => Math.min(contrast(lt, q(0.05)), contrast(lt, q(0.95)));
  const rendered = hudColor(f) === COLOR.cream ? 'cream' : 'ink';
  const cream = worst(L.cream), ink = worst(L.ink);
  rows.push({ f, scene: sceneAt(film, f)?.id, rendered, cream, ink, got: rendered === 'cream' ? cream : ink, better: cream >= ink ? 'cream' : 'ink' });
}

// ---- the layer's pixels in the bottom band
let bandRows = null;
if (existsSync(layerDir)) {
  const files = readdirSync(layerDir).filter((x) => x.endsWith('.png')).sort();
  if (files.length === film.frames) {
    bandRows = [];
    for (let f = 0; f < files.length; f++) {
      const png = PNG.sync.read(readFileSync(resolve(layerDir, files[f])));
      let n = 0, minY = H, minX = W, maxX = 0;
      for (let y = H - band; y < H; y++)
        for (let x = 0; x < W; x++)
          if (png.data[(y * W + x) * 4 + 3] >= 128) {
            n++;
            if (y < minY) minY = y;
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
          }
      if (n) bandRows.push({ f, scene: sceneAt(film, f)?.id, n, minY, minX, maxX });
    }
  }
}

// ---- report
const byScene = {};
for (const r of rows) (byScene[r.scene] ??= []).push(r);
const sceneLines = Object.entries(byScene).map(([id, rs]) => {
  const w = rs.reduce((m, r) => (r.got < m.got ? r : m));
  const low = rs.filter((r) => r.got < 4.5).map((r) => r.f + 1);
  const colours = [...new Set(rs.map((r) => r.rendered))].join(' → ');
  return `| ${id} | ${rs[0].f + 1}–${rs[rs.length - 1].f + 1} | ${colours} | **${w.got.toFixed(2)}** at f${w.f + 1} | ${low.length ? `${low.length}: ${low.length > 12 ? `${low.slice(0, 6).join(', ')} … ${low.slice(-3).join(', ')}` : low.join(', ')}` : '—'} |`;
});
const switches = [];
for (let i = 1; i < rows.length; i++) if (rows[i].better !== rows[i - 1].better) switches.push(`f${rows[i].f + 1} (0-based ${rows[i].f}) → ${rows[i].better} (${rows[i].cream.toFixed(1)} vs ${rows[i].ink.toFixed(1)})`);
const mismatch = rows.filter((r) => r.better !== r.rendered && Math.max(r.cream, r.ink) >= 4.5 && r.got < 4.5).map((r) => r.f + 1);
const recorded = HUD_TONE_RUNS.map(([f, t]) => `${f} → ${t}`).join(', ');
const bandText = bandRows === null
  ? `layer not rendered (${repoRel(layerDir)}): band check skipped`
  : bandRows.length === 0
    ? `no layer pixel in the bottom ${band} px on any of the ${film.frames} frames ✓`
    : (() => {
        const g = {};
        for (const r of bandRows) (g[r.scene] ??= []).push(r);
        return Object.entries(g).map(([id, rs]) => `${id}: ${rs.length} frames (f${rs[0].f + 1}–${rs[rs.length - 1].f + 1}), from y ${Math.min(...rs.map((r) => r.minY))}, x ${Math.min(...rs.map((r) => r.minX))}–${Math.max(...rs.map((r) => r.maxX))}`).join('; ');
      })();
const md = `# HUD (scene label, top-left) · contrast on every frame

background ${repoRel(bgDir)} (${rows.length} frames) · box = the label's box on the frame, p5 / p95 luminance, worst of the two (box-based: stricter than the glyph-pixel measurement of the stills)
cream ${COLOR.cream} on dark frames, ink ${COLOR.ink} on light ones · HUD_TONE_RUNS (0-based): ${recorded}

| scene | frames | colour | worst (rendered) | frames < 4.5 |
| --- | --- | --- | --- | --- |
${sceneLines.join('\n')}

Measured switch frames (where the other colour starts to read better): ${switches.length ? switches.join('; ') : 'none'}.
Frames where the other colour would pass 4.5 and the rendered one does not: ${mismatch.length ? mismatch.join(', ') : 'none'}.

Bottom band (${band} px, the page's dock at 1920): ${bandText}.
`;
writeFileSync(resolve(root, 'stills/hud_check.md'), md);
console.log(md);
