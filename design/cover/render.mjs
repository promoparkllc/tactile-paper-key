// render.mjs — exports the submission cover and the OG image from design/cover/cover.html with the real skin.
//   node design/cover/render.mjs [cover,og,contra]
// Serves cover.html with Vite (the repo's config: `@/` → src; the page's public folder for the fonts and the footage),
// renders each format in Chrome at deviceScaleFactor 2 with the player held in its playing state at 44 % of the clip,
// then downscales (lanczos) to cover-1920x1080.png, og-1200x630.png and cover-1600x1200.png (Contra, 4:3), tagged sRGB,
// under 1 MB (the Contra cover under 2 MB) (quantized to a
// dithered palette only if the full-colour PNG is larger). Output in design/cover/.
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '../..');
const work = resolve(repo, '_tmp/cover');
mkdirSync(work, { recursive: true });
const MAX = 1024 * 1024;
const FORMATS = [
  { id: 'cover', file: 'cover-1920x1080.png', width: 1920, height: 1080 },
  { id: 'og', file: 'og-1200x630.png', width: 1200, height: 630 },
  // Contra's cover: 4:3, at least 1600 × 1200, under 2 MB
  { id: 'contra', file: 'cover-1600x1200.png', width: 1600, height: 1200, max: 2 * 1024 * 1024 },
];
const only = process.argv[2]?.split(',');

const { createServer } = await import(pathToFileURL(resolve(repo, 'node_modules/vite/dist/node/index.js')).href);
const server = await createServer({
  configFile: resolve(repo, 'vite.config.ts'),
  root: here,
  publicDir: resolve(repo, 'apps/preview/public'),
  logLevel: 'error',
  server: { port: 5405, strictPort: true, host: '127.0.0.1', fs: { allow: [repo] } },
});
await server.listen();
const browser = await chromium.launch({ channel: 'chrome', args: ['--autoplay-policy=no-user-gesture-required'] });
const ff = (args) => execFileSync('ffmpeg', ['-v', 'error', '-y', ...args], { stdio: ['ignore', 'pipe', 'inherit'] });

for (const f of FORMATS) {
  if (only && !only.includes(f.id)) continue;
  const max = f.max ?? MAX;
  const context = await browser.newContext({ viewport: { width: f.width, height: f.height }, deviceScaleFactor: 2 });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`http://127.0.0.1:5405/cover.html?format=${f.id}`);
  await page.waitForFunction(() => window.__cover?.media?.readyState >= 2, null, { timeout: 30000 });
  await page.evaluate(() => document.fonts.ready);

  // Play for real (the player records that playback started), then hold the frame at 44 % in the playing state:
  // the media pauses, but `paused` reads false, so the skin keeps the pause glyph, the latched Play key and PLAY.
  const at = await page.evaluate(async () => {
    const m = window.__cover.media;
    m.volume = 0.5;
    await m.play();
    await new Promise((r) => setTimeout(r, 400));
    Object.defineProperty(HTMLMediaElement.prototype, 'paused', { get: () => false, configurable: true });
    m.pause();
    m.currentTime = m.duration * 0.44;
    await new Promise((r) => m.addEventListener('seeked', r, { once: true }));
    m.dispatchEvent(new Event('playing'));
    m.dispatchEvent(new Event('timeupdate'));
    return { t: m.currentTime, d: m.duration };
  });
  await page.mouse.move(1, 1);
  await page.waitForTimeout(900);
  const state = await page.evaluate(() => {
    const q = (s) => document.querySelector(s);
    return {
      play: q('.tactile-dock-play')?.getAttribute('aria-label'),
      pill: q('.tactile-status')?.innerText.replace(/\s+/g, ' ').trim(),
      dock: getComputedStyle(q('.tactile-dock')).opacity,
      cc: q('.tactile-key-cc')?.hasAttribute('data-active') ? 'on' : 'off',
      fonts: [...document.fonts].filter((x) => x.status === 'loaded').map((x) => x.family).join(', '),
    };
  });
  const raw = resolve(work, `${f.id}@2x.png`);
  await (await page.$('#frame')).screenshot({ path: raw });
  await context.close();

  // downscale, tag sRGB; full colour first, a dithered palette only if that is over 1 MB
  const out = resolve(here, f.file);
  const scale = `scale=${f.width}:${f.height}:flags=lanczos+accurate_rnd+full_chroma_int`;
  ff(['-i', raw, '-vf', `${scale},format=rgb24,setparams=color_primaries=bt709:color_trc=iec61966-2-1:colorspace=gbr`, '-compression_level', '9', out]);
  let mode = 'rgb24';
  if (statSync(out).size > max) {
    ff(['-i', raw, '-filter_complex', `[0]${scale},split[a][b];[a]palettegen=max_colors=256:stats_mode=full[p];[b][p]paletteuse=dither=sierra2_4a,setparams=color_primaries=bt709:color_trc=iec61966-2-1:colorspace=gbr`, '-compression_level', '9', out]);
    mode = 'palette 256, dithered';
  }
  const size = statSync(out).size;
  console.log(`${f.file}: ${(size / 1024).toFixed(0)} KB (${mode})${size > max ? ` — OVER ${max / 1048576} MB` : ''} · player at ${at.t.toFixed(2)} / ${at.d.toFixed(2)} s · ${JSON.stringify(state)}${errors.length ? ' · errors: ' + errors.join(' | ') : ''}`);
}
await browser.close();
await server.close();
rmSync(work, { recursive: true, force: true });
