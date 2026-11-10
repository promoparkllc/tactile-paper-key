// fader-interval.mjs — ink contrast of the current-time label above the fader cap on EVERY frame of its on-frame run
// (and of the duration label at the groove end), measured probe-style: the text colour against the p5 / p95 luminance
// of the label's box on the background frame. Writes stills/fader_interval.md.
//   node scripts/fader-interval.mjs [--bg ../render/final/out]
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { PNG } from 'pngjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const filmDir = resolve(root, '..');
const args = process.argv.slice(2);
const bgDir = resolve(root, args.includes('--bg') ? args[args.indexOf('--bg') + 1] : '../render/final/out');
const { normalizeFilm } = await import(pathToFileURL(resolve(root, 'src/data/normalize.js')).href);
const { boxesFor } = await import(pathToFileURL(resolve(root, 'src/boxes.js')).href);
const { capRun, faderTiming } = await import(pathToFileURL(resolve(root, 'src/timing.js')).href);
const { COLOR } = await import(pathToFileURL(resolve(root, 'src/layout.js')).href);
const { luminance, contrastOfLuminance: contrast, opacity } = await import(pathToFileURL(resolve(root, 'src/motion.js')).href);
const lin = (v) => (v / 255 <= 0.04045 ? v / 255 / 12.92 : ((v / 255 + 0.055) / 1.055) ** 2.4);
const lumRgb = (r, g, b) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);

const film = normalizeFilm(JSON.parse(readFileSync(resolve(filmDir, 'scenes.json'), 'utf8')), 'scenes.json');
const s6 = JSON.parse(readFileSync(resolve(filmDir, 'anchors_s6.json'), 'utf8'));
const s2 = JSON.parse(readFileSync(resolve(filmDir, 'anchors_s2.json'), 'utf8'));
const run = capRun(film, s6);
if (!run) {
  console.error('no on-frame run of the cap');
  process.exit(1);
}
const lt = luminance(COLOR.ink);
const rows = [];
let worst = Infinity;
const { exit } = faderTiming(film);
for (let f = run.first; f <= run.last; f++) {
  const p = resolve(bgDir, `${String(f + 1).padStart(4, '0')}.png`);
  const o = opacity(f / film.fps, run.first / film.fps, Math.min(exit, (run.last - 8) / film.fps), film.fps);
  if (!existsSync(p) || o <= 0) continue; // the label fades over the run's last 8 frames and is gone on the last
  const png = PNG.sync.read(readFileSync(p));
  const sx = png.width / 1920, sy = png.height / 1080;
  const cells = [];
  for (const b of boxesFor('fader', f, film, s2, s6)) {
    const L = [];
    for (let y = b.y; y < b.y + b.h; y += 2)
      for (let x = b.x; x < b.x + b.w; x += 2) {
        const px = Math.min(png.width - 1, Math.max(0, Math.floor(x * sx)));
        const py = Math.min(png.height - 1, Math.max(0, Math.floor(y * sy)));
        const i = (py * png.width + px) * 4;
        L.push(lumRgb(png.data[i], png.data[i + 1], png.data[i + 2]));
      }
    L.sort((a, c) => a - c);
    const q = (k) => L[Math.floor(k * (L.length - 1))];
    const w = Math.min(contrast(lt, q(0.05)), contrast(lt, q(0.95)));
    worst = Math.min(worst, w);
    cells.push(`${b.name}: **${w.toFixed(2)}**${w < 4.5 ? ' LOW' : ''}`);
  }
  rows.push(`| ${f + 1} | ${(f / film.fps).toFixed(2)} | ${o.toFixed(2)} | ${cells.join(' · ')} |`);
}
const md = `# S6 fader labels · ink contrast on every frame of the cap's on-frame run\n\nrun: Blender f${run.first + 1}–${run.last + 1} · background ${relative(resolve(root, '../..'), bgDir).split('\\').join('/')}\nbox = the label's bounding box on the background frame (p5 / p95 luminance, worst of the two) vs ink ${COLOR.ink}; this is stricter than the glyph-pixel measurement of the stills.\n\n**worst over the run: ${worst.toFixed(2)}** ${worst >= 4.5 ? '(≥ 4.5 ✓)' : '(BELOW 4.5 ✗)'}\n\n| frame | t | labels |\n| --- | --- | --- |\n${rows.join('\n')}\n`;
writeFileSync(resolve(root, 'stills/fader_interval.md'), md);
console.log(md.split('\n').slice(0, 6).join('\n'));
console.log(rows.filter((r) => r.includes('LOW')).join('\n') || 'no frame below 4.5');
