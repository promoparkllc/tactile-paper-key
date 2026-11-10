// capture-states.mjs — the twelve state captures of section 04, from the real player (lab.html served by Vite), with
// real interactions: 1280 × 720 CSS px at ×1 → WebP in apps/preview/public/states/. The phone one is the 390 px player
// at ×3. Run: node apps/preview/scripts/capture-states.mjs [--only 03,07]
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '../../..');
const out = resolve(repo, 'apps/preview/public/states');
const work = resolve(repo, '_tmp/states');
mkdirSync(out, { recursive: true });
rmSync(work, { recursive: true, force: true });
mkdirSync(work, { recursive: true });
const only = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1].split(',') : null;
const MUX = 'T7FXzoR9xFnvnp4l7ADfysXjb8jOAlFmXbmufaBV1S4';

const { createServer } = await import(pathToFileURL(resolve(repo, 'node_modules/vite/dist/node/index.js')).href);
const server = await createServer({ configFile: resolve(repo, 'vite.config.ts'), logLevel: 'error', server: { port: 5197, strictPort: true, host: '127.0.0.1' } });
await server.listen();
const base = 'http://127.0.0.1:5197/lab.html';
const browser = await chromium.launch();

const clip = (name) => `src=/footage/${name}.mp4&captions=/footage/${name}.en.vtt`;
const states = [
  { n: '01', slug: 'ready', url: `mux=${MUX}&poster=/poster.webp`, run: async (p) => p.waitForFunction(() => window.__lab.media.duration > 0) },
  // a real stall: the clip's first 320 KB arrive, every later range request hangs, so playback runs out of data
  { n: '02', slug: 'loading', url: clip('night'), stall: 'night', run: async (p, h) => { await h.playReal(0.2); await p.waitForTimeout(2600); await h.hover(); await p.waitForTimeout(300); } },
  { n: '03', slug: 'playing', url: clip('snow'), run: async (p, h) => { await h.play(2.4); await h.hover(); } },
  { n: '04', slug: 'hidden', url: clip('studio'), run: async (p, h) => { await h.play(2.4); await p.mouse.move(5, 5); await p.waitForTimeout(3200); } },
  { n: '05', slug: 'seek-preview', url: `mux=${MUX}&poster=/poster.webp`, run: async (p, h) => { await h.play(12.5); await h.hoverSeek(0.42); await p.waitForTimeout(900); } },
  { n: '06', slug: 'dragging', url: clip('market'), run: async (p, h) => { await h.play(2.0); await h.drag(0.35, 0.58); } },
  { n: '07', slug: 'muted', url: clip('night'), run: async (p, h) => { await h.play(2.4); await h.click('.tactile-key-mute'); await h.hover(); } },
  { n: '08', slug: 'captions', url: clip('night'), run: async (p, h) => { await h.play(2.4); await h.click('.tactile-key-cc'); await h.hover(); await p.waitForTimeout(300); } },
  { n: '09', slug: 'settings', url: clip('studio'), run: async (p, h) => { await h.play(2.4); await h.click('.tactile-key-settings'); await p.waitForTimeout(400); } },
  { n: '10', slug: 'focus', url: clip('market'), run: async (p, h) => { await h.play(2.4); await h.focus('.tactile-key-mute'); await p.waitForTimeout(500); } },
  { n: '11', slug: 'replay', url: clip('snow'), run: async (p, h) => { await p.evaluate(async () => { const m = window.__lab.media; m.muted = true; m.currentTime = m.duration - 0.4; await m.play().catch(() => undefined); await new Promise((r) => { m.addEventListener('ended', r, { once: true }); setTimeout(r, 4000); }); }); await p.waitForTimeout(500); } },
  { n: '12', slug: 'phone', url: `${clip('snow')}&width=390`, phone: true, run: async (p, h) => { await h.play(2.4); await h.hover(); } },
];

for (const s of states) {
  if (only && !only.includes(s.n)) continue;
  const scale = s.phone ? 3 : 1;
  const context = await browser.newContext({ viewport: s.phone ? { width: 390, height: 300 } : { width: 1280, height: 720 }, deviceScaleFactor: scale, hasTouch: !!s.phone });
  const page = await context.newPage();
  page.on('pageerror', (e) => console.error(`[${s.slug}] ${e.message}`));
  if (s.stall) {
    const file = resolve(repo, 'apps/preview/public/footage', `${s.stall}.mp4`);
    const data = readFileSync(file);
    const head = 320000;
    await page.route(`**/footage/${s.stall}.mp4`, async (route) => {
      const range = route.request().headers()['range'] ?? '';
      const start = Number((range.match(/bytes=(\d+)-/) ?? [])[1] ?? 0);
      if (start >= head) return; // never answered: the media stalls here
      const body = data.subarray(start, head);
      await route.fulfill({ status: 206, headers: { 'Content-Type': 'video/mp4', 'Accept-Ranges': 'bytes', 'Content-Range': `bytes ${start}-${head - 1}/${data.length}`, 'Content-Length': String(body.length) }, body });
    });
  }
  await page.goto(`${base}?${s.url}`);
  await page.waitForFunction(() => window.__lab?.media && window.__lab.media.readyState >= 1, null, { timeout: 60000 });
  const stage = await page.locator('#stage').boundingBox();
  const h = {
    // play from a time and let it run a little, so the dock is up and the picture is a real frame
    play: async (t) => {
      await page.evaluate(async (time) => {
        const m = window.__lab.media;
        m.muted = false;
        m.volume = 0.6;
        m.currentTime = time;
        await m.play().catch(() => undefined);
      }, t);
      await page.mouse.move(stage.x + stage.width / 2, stage.y + stage.height * 0.3);
      await page.waitForTimeout(500);
      await page.evaluate(() => window.__lab.media.pause());
      // paused for the screenshot but shown as playing: the display reads PLAY, the key shows Pause
      await page.evaluate(() => {
        Object.defineProperty(window.__lab.media, 'paused', { get: () => false, configurable: true });
        window.__lab.media.dispatchEvent(new Event('play'));
        window.__lab.media.dispatchEvent(new Event('playing'));
      });
      await page.waitForTimeout(150);
    },
    // really playing (for states that need the media pipeline itself: a stall, the end)
    playReal: async (t) => {
      await page.evaluate(async (time) => {
        const m = window.__lab.media;
        m.muted = true;
        m.currentTime = time;
        await m.play().catch(() => undefined);
      }, t);
      await page.mouse.move(stage.x + stage.width / 2, stage.y + stage.height * 0.3);
    },
    hover: async () => page.mouse.move(stage.x + stage.width / 2, stage.y + stage.height * 0.35),
    center: async (sel) => {
      const r = await page.locator(sel).first().boundingBox();
      return r ? { x: r.x + r.width / 2, y: r.y + r.height / 2 } : null;
    },
    click: async (sel) => {
      const c = await h.center(sel);
      if (c) await page.mouse.click(c.x, c.y);
    },
    focus: async (sel) => {
      await page.keyboard.press('Tab');
      // Tab until the key has focus (keyboard focus shows the ring and the tooltip)
      for (let i = 0; i < 12; i++) {
        const on = await page.evaluate((s) => document.activeElement?.matches(s) ?? false, sel);
        if (on) break;
        await page.keyboard.press('Tab');
      }
    },
    hoverSeek: async (f) => {
      const r = await page.locator('.tactile-seek').first().boundingBox();
      await page.mouse.move(r.x + r.width * f, r.y + r.height / 2, { steps: 8 });
    },
    drag: async (from, to) => {
      const r = await page.locator('.tactile-seek').first().boundingBox();
      await page.mouse.move(r.x + r.width * from, r.y + r.height / 2, { steps: 6 });
      await page.mouse.down();
      await page.mouse.move(r.x + r.width * to, r.y + r.height / 2, { steps: 12 });
      await page.waitForTimeout(200);
    },
  };
  await s.run(page, h);
  const png = resolve(work, `${s.n}-${s.slug}.png`);
  await page.screenshot({ path: png, clip: stage, scale: 'device' });
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', png, '-c:v', 'libwebp', '-quality', '84', resolve(out, `${s.n}-${s.slug}.webp`)]);
  console.log(`${s.n} ${s.slug} ✓`);
  await context.close();
}
await browser.close();
await server.close();
