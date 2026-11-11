// capture.mjs — the page's 04 States: twelve stills and twelve short clips, from the real skin on the demo footage.
//   node design/states/capture.mjs [02,05,...]   (only these states)
// Serves design/states/states.html with Vite (the repo's config; the page's public folder for the footage, posters and
// fonts) and drives Chrome with real input (pointer, keyboard, touch, network) at deviceScaleFactor 2.
//
// Stills: a 16:9 crop on the element that makes the state (zoom 2–3×), cut from the 2× capture, no upscale, WebP
// ≤ 60 KB → apps/preview/public/states/NN-name.webp. 01, 04, 11 and 12 are whole frames and keep their stills.
// Clips: the same crop, 2.5–3 s at 30 fps, a clean loop, no audio, 640 × 360 (2× the card) → states/clips/NN-name.mp4
// (H.264, ≤ 150 KB) and .webm (VP9) when smaller. Recorded frame by frame: each frame applies the input planned for
// it, moves the page's animation clock on by exactly 1/30 s (window.__step) and takes a screenshot. The media is
// driven (?drive=1): the skin's own keys play and pause it, and the capture moves its time.
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '../..');
const pub = resolve(repo, 'apps/preview/public');
const work = resolve(repo, '_tmp/states');
const out = resolve(pub, 'states');
const clipsOut = resolve(out, 'clips');
for (const d of [work, out, clipsOut]) mkdirSync(d, { recursive: true });
const only = process.argv[2]?.split(',');
const ff = (args) => execFileSync('ffmpeg', ['-v', 'error', '-y', ...args], { stdio: ['ignore', 'pipe', 'inherit'] });
const FPS = 30;
const STILL_MAX = 60 * 1024;
const CLIP_MAX = 150 * 1024;

// Storyboard for the seek preview (the demo clips are plain MP4): 12 frames of 256 × 144, one every 0.5 s, and its VTT.
function storyboard(clip) {
  const jpg = resolve(work, `${clip}-storyboard.jpg`);
  ff(['-i', resolve(pub, `footage/${clip}.mp4`), '-vf', 'fps=2,scale=256:144,tile=4x3', '-frames:v', '1', '-q:v', '3', jpg]);
  const ts = (s) => `00:00:${s.toFixed(3).padStart(6, '0')}`;
  let vtt = 'WEBVTT\n\n';
  for (let i = 0; i < 12; i++) vtt += `${ts(i * 0.5)} --> ${ts(i * 0.5 + 0.5)}\n${clip}-storyboard.jpg#xywh=${(i % 4) * 256},${Math.floor(i / 4) * 144},256,144\n\n`;
  writeFileSync(resolve(work, `${clip}-storyboard.vtt`), vtt);
  return `/@fs/${resolve(work, `${clip}-storyboard.vtt`).replace(/\\/g, '/')}`;
}

const { createServer } = await import(pathToFileURL(resolve(repo, 'node_modules/vite/dist/node/index.js')).href);
const server = await createServer({
  configFile: resolve(repo, 'vite.config.ts'),
  root: here,
  publicDir: pub,
  logLevel: 'error',
  server: { port: 5406, strictPort: true, host: '127.0.0.1', fs: { allow: [repo] } },
});
await server.listen();
const BASE = 'http://127.0.0.1:5406/states.html';
const browser = await chromium.launch({ channel: 'chrome', args: ['--autoplay-policy=no-user-gesture-required'] });
const report = [];

async function open(params, { phone = false } = {}) {
  const context = await browser.newContext(
    phone
      ? { viewport: { width: 390, height: 219 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }
      : { viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 }
  );
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  const s = { context, page, errors, phone };
  s.go = async () => {
    await page.goto(`${BASE}?${new URLSearchParams(params)}`);
    await page.waitForFunction(() => window.__s?.media?.readyState >= 2 || window.__s?.player?.hasAttribute('poster'), null, { timeout: 30000 });
    await page.evaluate(() => document.fonts.ready);
  };
  return s;
}

// ---------------------------------------------------------------- helpers ----------------------------------------
const box = (page, sel) => page.evaluate((sel) => { const r = document.querySelector(sel)?.getBoundingClientRect(); return r ? { l: r.left, t: r.top, r: r.right, b: r.bottom } : null; }, sel);
const centre = (b) => ({ x: (b.l + b.r) / 2, y: (b.t + b.b) / 2 });
const union = (...bs) => bs.filter(Boolean).reduce((a, b) => ({ l: Math.min(a.l, b.l), t: Math.min(a.t, b.t), r: Math.max(a.r, b.r), b: Math.max(a.b, b.b) }));
/** A 16:9 crop of width w (css px) centred on a box, kept inside the 1280 × 720 frame. */
const crop16 = (b, w, dy = 0) => {
  const h = (w * 9) / 16;
  const c = centre(b);
  const x = Math.round(Math.min(Math.max(c.x - w / 2, 0), 1280 - w));
  const y = Math.round(Math.min(Math.max(c.y + dy - h / 2, 0), 720 - h));
  return { x, y, width: w, height: Math.round(h) };
};
const play = (s) => s.page.evaluate(() => window.__s.media.play());
const seekTo = (s, frac) => s.page.evaluate((frac) => window.__s.seek(window.__s.media.duration * frac), frac);
const pin = (s, on = true) => s.page.evaluate((on) => { const c = document.querySelector('media-controls'); if (on) c.setAttribute('visibility', 'always'); else c.removeAttribute('visibility'); }, on);
const WAKE = { x: 640, y: 300 };
const wake = async (s) => { await s.page.mouse.move(WAKE.x, WAKE.y); await s.page.mouse.move(WAKE.x + 8, WAKE.y + 6, { steps: 3 }); };
/** Tooltips appear on hover after a real-time delay; outside the keyboard state they would land on random frames. */
const noTips = (s) => s.page.addStyleTag({ content: '.tactile-tip { display: none !important; }' });
const waitFor = (s, fn) => s.page.waitForFunction(fn, null, { timeout: 10000 });
const dockShown = () => getComputedStyle(document.querySelector('.tactile-dock')).opacity === '1';
const controlsIdle = () => !document.querySelector('.tactile-controls').hasAttribute('data-visible');
const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2);
const at = (f, a, b) => Math.min(1, Math.max(0, (f - a) / (b - a)));
/** A click held for `hold` frames: down on frame a, up on frame a + hold. */
const click = async (s, f, a, p, hold = 3) => {
  if (f === a - 3) await s.page.mouse.move(p.x, p.y, { steps: 2 });
  if (f === a) await s.page.mouse.down();
  if (f === a + hold) await s.page.mouse.up();
};

// ---------------------------------------------------------------- the twelve states -------------------------------
// prepare(s): from a fresh page to the clip's first frame (the loop's rest state). still(s): into the still's state.
// crop(s): the 16:9 crop (css px), measured in the still's state; null = the whole frame. frame(s, f): input on frame f.
const STATES = {
  '01-ready': {
    params: { clip: 'market', poster: 1, drive: 1 }, frames: 60, keepStill: true,
    async prepare(s) { await noTips(s); s.key = centre(await box(s.page, '.tactile-center-play')); },
    // the big key pressed 1 px: down on it, off it while held, released outside (so it does not play)
    async frame(s, f) {
      if (f === 20) await s.page.mouse.move(s.key.x, s.key.y, { steps: 2 });
      if (f === 24) await s.page.mouse.down();
      if (f === 34) await s.page.mouse.move(40, 40);
      if (f === 35) await s.page.mouse.up();
    },
  },
  '02-loading': {
    params: { clip: 'night' }, frames: 81, // 3 × the LEDs' 900 ms cycle
    async prepare(s) {
      // the first 320 KB arrive, the rest never does: the player runs dry and the buffering indicator comes on
      const file = readFileSync(resolve(pub, 'footage/night.mp4'));
      const LIMIT = 320 * 1024;
      await s.page.route('**/footage/night.mp4', async (route) => {
        const range = route.request().headers().range ?? 'bytes=0-';
        const [a, b] = range.replace('bytes=', '').split('-').map((n) => (n ? Number(n) : undefined));
        const start = a ?? 0;
        if (start >= LIMIT) return; // left pending
        const end = Math.min(b ?? file.length - 1, LIMIT - 1);
        await route.fulfill({ status: 206, headers: { 'content-type': 'video/mp4', 'accept-ranges': 'bytes', 'content-range': `bytes ${start}-${end}/${file.length}`, 'content-length': String(end - start + 1) }, body: file.subarray(start, end + 1) });
      });
    },
    beforeGo: true,
    async ready(s) {
      await noTips(s);
      await s.page.evaluate(() => window.__s.media.play());
      await waitFor(s, () => document.querySelector('media-controls:has(.tactile-buffering[data-visible])'));
      await pin(s);
      await wake(s);
      await s.page.waitForTimeout(500);
    },
    async crop(s) { return crop16(union(await box(s.page, '.tactile-dock-play'), await box(s.page, '.tactile-status')), 480); },
    async frame() {},
  },
  '03-playing': {
    params: { clip: 'snow', drive: 1 }, frames: 80,
    async ready(s) { await noTips(s); await play(s); await seekTo(s, 0.44); await pin(s); await wake(s); s.key = centre(await box(s.page, '.tactile-dock-play')); },
    async crop(s) {
      const seek = await box(s.page, '.tactile-seek');
      return crop16(union(await box(s.page, '.tactile-dock-play'), await box(s.page, '.tactile-status'), { ...seek, r: seek.l + 120 }), 600);
    },
    // Play → pause (the glyph morphs to the triangle) and back
    async frame(s, f) {
      await click(s, f, 18, s.key);
      await click(s, f, 50, s.key);
      if (f === 60) await s.page.mouse.move(WAKE.x, WAKE.y, { steps: 2 });
    },
  },
  '04-hidden': {
    params: { clip: 'studio', drive: 1 }, frames: 90, keepStill: true,
    async ready(s) { await noTips(s); await play(s); await seekTo(s, 0.44); await pin(s); await wake(s); await waitFor(s, dockShown); },
    // the dock fades away when the pointer rests, then comes back when it moves
    async frame(s, f) {
      if (f === 15) { await pin(s, false); await waitFor(s, controlsIdle); }
      if (f === 62) { await wake(s); await pin(s); }
    },
  },
  '05-seek-preview': {
    params: { clip: 'studio', drive: 1 }, thumbs: 'studio', frames: 90,
    async ready(s) {
      await noTips(s); await play(s); await seekTo(s, 0.3); await pin(s); await wake(s);
      s.track = await box(s.page, '.tactile-seek');
      s.px = (p) => ({ x: s.track.l + (s.track.r - s.track.l) * p, y: (s.track.t + s.track.b) / 2 });
      const p = s.px(0.5);
      await s.page.mouse.move(p.x, p.y, { steps: 6 });
    },
    async still(s) { const p = s.px(0.66); await s.page.mouse.move(p.x, p.y, { steps: 4 }); await s.page.waitForTimeout(700); },
    async crop(s) {
      const a = s.px(0.5), b = s.px(0.82);
      const preview = await box(s.page, '.tactile-preview');
      return crop16(union({ l: a.x - 90, r: b.x + 90, t: preview?.t ?? a.y - 140, b: a.y + 20 }, preview), 560);
    },
    // the preview follows the pointer along the fader: 50 % → 80 % → 50 %
    async frame(s, f) { const p = s.px(0.5 + 0.3 * (0.5 - 0.5 * Math.cos((2 * Math.PI * f) / 90))); await s.page.mouse.move(p.x, p.y); },
  },
  '06-dragging': {
    params: { clip: 'market', drive: 1 }, frames: 80,
    async ready(s) { await noTips(s); await play(s); await seekTo(s, 0.36); await pin(s); await wake(s); s.cap = centre(await box(s.page, '.tactile-seek .tactile-fader-cap')); },
    async still(s) {
      await s.page.mouse.move(s.cap.x, s.cap.y, { steps: 3 }); await s.page.mouse.down();
      await s.page.mouse.move(s.cap.x + 24, s.cap.y, { steps: 6 }); await s.page.waitForTimeout(400);
      s.after = () => s.page.mouse.up();
    },
    async crop(s) { return crop16({ l: s.cap.x - 10, r: s.cap.x + 50, t: s.cap.y - 30, b: s.cap.y + 30 }, 384); },
    // the cap lifts 1 px when held, is dragged right and back, and settles
    async frame(s, f) {
      if (f === 10) await s.page.mouse.move(s.cap.x, s.cap.y, { steps: 2 });
      if (f === 14) await s.page.mouse.down();
      if (f > 16 && f <= 40) await s.page.mouse.move(s.cap.x + 40 * ease(at(f, 16, 40)), s.cap.y);
      if (f > 44 && f <= 66) await s.page.mouse.move(s.cap.x + 40 * (1 - ease(at(f, 44, 66))), s.cap.y);
      if (f === 68) await s.page.mouse.up();
      if (f === 72) await s.page.mouse.move(WAKE.x, WAKE.y, { steps: 2 });
    },
  },
  '07-muted': {
    params: { clip: 'night', drive: 1 }, frames: 76,
    async ready(s) { await noTips(s); await play(s); await seekTo(s, 0.44); await pin(s); await wake(s); s.key = centre(await box(s.page, '.tactile-key-mute')); },
    async still(s) { await s.page.mouse.click(s.key.x, s.key.y); await s.page.mouse.move(WAKE.x, WAKE.y); await s.page.waitForTimeout(600); },
    async crop(s) { return crop16(union(await box(s.page, '.tactile-key-mute'), await box(s.page, '.tactile-volume-wrap')), 384); },
    // waves → cross, the fader drops to zero; then back
    async frame(s, f) {
      await click(s, f, 18, s.key);
      await click(s, f, 46, s.key);
      if (f === 54) await s.page.mouse.move(WAKE.x, WAKE.y, { steps: 2 });
    },
  },
  '08-captions': {
    params: { clip: 'night', drive: 1 }, frames: 80,
    async ready(s) { await noTips(s); await play(s); await seekTo(s, 0.5); await pin(s); await wake(s); s.key = centre(await box(s.page, '.tactile-dock .tactile-key-cc')); },
    async still(s) { await s.page.mouse.click(s.key.x, s.key.y); await s.page.mouse.move(WAKE.x, WAKE.y); await s.page.waitForTimeout(700); },
    // the cue is drawn by the video itself (no DOM box): centred, its baseline just above the dock
    async crop(s) {
      const dock = await box(s.page, '.tactile-dock');
      return crop16(union(await box(s.page, '.tactile-dock .tactile-key-cc'), { l: 400, r: 880, t: dock.t - 70, b: dock.t - 20 }), 760);
    },
    // the rim lights and the line appears; then off again
    async frame(s, f) {
      await click(s, f, 16, s.key);
      if (f === 24) await s.page.mouse.move(WAKE.x, WAKE.y, { steps: 2 });
      await click(s, f, 56, s.key);
      if (f === 64) await s.page.mouse.move(WAKE.x, WAKE.y, { steps: 2 });
    },
  },
  '09-settings': {
    params: { clip: 'studio', drive: 1 }, frames: 80,
    async ready(s) { await noTips(s); await play(s); await seekTo(s, 0.44); await pin(s); await wake(s); s.key = centre(await box(s.page, '.tactile-dock .tactile-key-settings')); },
    async still(s) { await s.page.mouse.click(s.key.x, s.key.y); await s.page.waitForTimeout(700); },
    async crop(s) { return crop16(union(await box(s.page, '.tactile-dock .tactile-key-settings'), await box(s.page, '.tactile-menu')), 520); },
    // the menu opens from its key and closes again
    async frame(s, f) {
      await click(s, f, 16, s.key);
      await click(s, f, 54, s.key);
      if (f === 62) await s.page.mouse.move(WAKE.x, WAKE.y, { steps: 2 });
    },
  },
  '10-focus': {
    params: { clip: 'market', drive: 1 }, frames: 86,
    // keyboard only: Tab from the play key to the mute key (play → seek cap → mute)
    async ready(s) {
      await play(s); await seekTo(s, 0.44); await pin(s);
      await s.page.focus('.tactile-dock-play'); await s.page.keyboard.press('Tab'); await s.page.keyboard.press('Tab');
      await s.page.waitForTimeout(700);
    },
    async crop(s) {
      const tips = await s.page.evaluate(() => { const t = document.querySelector('.tactile-tip[data-open]')?.getBoundingClientRect(); return t ? { l: t.left, t: t.top, r: t.right, b: t.bottom } : null; });
      return crop16(union(await box(s.page, '.tactile-key-mute'), await box(s.page, '.tactile-dock .tactile-key-settings'), tips), 520);
    },
    // Tab → captions → settings, Shift+Tab back: the ink ring and the tooltip move with the focus
    async frame(s, f) {
      if (f === 20 || f === 38) await s.page.keyboard.press('Tab');
      if (f === 56 || f === 72) await s.page.keyboard.press('Shift+Tab');
    },
  },
  '11-replay': {
    params: { clip: 'snow', drive: 1 }, frames: 75, keepStill: true, fade: 9,
    async ready(s) { await noTips(s); await play(s); await s.page.evaluate(() => window.__s.seek(window.__s.media.duration - 1.2)); },
    // the last second plays out, then END: the big key returns as Replay
    async frame(s, f) {
      if (f < 36) await s.page.evaluate((t) => window.__s.seek(window.__s.media.duration - 1.2 + t), f / FPS);
      if (f === 36) await s.page.evaluate(async () => { await window.__s.seek(window.__s.media.duration); window.__s.end(); });
    },
  },
  '12-phone': {
    params: { clip: 'snow', drive: 1 }, phone: true, frames: 90, keepStill: true,
    async ready(s) { await noTips(s); await play(s); await seekTo(s, 0.44); await waitFor(s, () => getComputedStyle(document.querySelector('.tactile-dock')).opacity === '0'); },
    // a tap brings the dock up; resting, it goes down again
    async frame(s, f) {
      if (f === 14) { await s.page.touchscreen.tap(195, 80); await s.page.evaluate(() => document.activeElement?.blur()); }
      if (f === 50) await waitFor(s, controlsIdle);
    },
  },
};

async function start(name, def) {
  const params = { ...def.params };
  if (def.thumbs) params.thumbs = storyboard(def.thumbs);
  const s = await open(params, { phone: def.phone });
  if (def.beforeGo) await def.prepare(s);
  await s.go();
  if (!def.beforeGo && def.prepare) await def.prepare(s);
  await def.ready?.(s);
  await s.page.waitForTimeout(300);
  return s;
}

/** WebP from a PNG, stepping the quality down until it is under the limit. */
function webp(src, dest, max, scale) {
  for (let q = 82; ; q -= 6) {
    ff(['-i', src, ...(scale ? ['-vf', `scale=${scale}:flags=lanczos`] : []), '-c:v', 'libwebp', '-quality', String(q), '-compression_level', '6', dest]);
    if (statSync(dest).size <= max || q <= 40) return { q, size: statSync(dest).size };
  }
}

for (const [name, def] of Object.entries(STATES)) {
  if (only && !only.some((o) => name.startsWith(o))) continue;
  const line = [name];

  // the crop, measured in the still's state (it holds the moving element: the open menu, the preview)
  let crop = null;
  if (!def.keepStill) {
    const s = await start(name, def);
    await def.still?.(s);
    crop = def.crop ? await def.crop(s) : null;
    const raw = resolve(work, `${name}-still.png`);
    await s.page.screenshot({ path: raw, clip: crop ?? undefined });
    await s.after?.();
    const r = webp(raw, resolve(out, `${name}.webp`), STILL_MAX, crop && crop.width * 2 > 1280 ? '1280:-2' : null);
    line.push(`still ${crop ? `${crop.width}×${crop.height} css @${crop.x},${crop.y}` : 'whole'} → ${(r.size / 1024).toFixed(1)} KB q${r.q}`);
    if (s.errors.length) line.push('errors: ' + s.errors.join(' | '));
    await s.context.close();
  }

  // the clip: a fresh page, frame by frame
  const s = await start(name, def);
  if (!crop && def.crop && def.keepStill) crop = await def.crop(s);
  const dir = resolve(work, name);
  mkdirSync(dir, { recursive: true });
  for (let f = 0; f < def.frames; f++) {
    await def.frame(s, f);
    await s.page.evaluate((ms) => window.__step(ms), 1000 / FPS);
    await s.page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    await s.page.screenshot({ path: resolve(dir, `${String(f).padStart(3, '0')}.png`), clip: crop ?? undefined, scale: crop ? 'device' : 'css' });
  }
  if (s.errors.length) line.push('clip errors: ' + s.errors.join(' | '));
  await s.context.close();

  // encode: 640 × 360; a crossfade from the end into the start when the last frame is not the first
  const N = def.frames;
  const K = def.fade ?? 0;
  const scale = 'scale=640:360:flags=lanczos';
  const graph = K
    ? `[0]${scale},split[x][y];[x]trim=start_frame=${K},setpts=PTS-STARTPTS[a];[y]trim=end_frame=${K},setpts=PTS-STARTPTS[b];[a][b]xfade=transition=fade:duration=${K / FPS}:offset=${(N - 2 * K) / FPS},format=yuv420p[v]`
    : `[0]${scale},format=yuv420p[v]`;
  const input = ['-framerate', String(FPS), '-i', resolve(dir, '%03d.png')];
  const mp4 = resolve(clipsOut, `${name}.mp4`);
  let crf = 22;
  for (;;) {
    ff([...input, '-filter_complex', graph, '-map', '[v]', '-c:v', 'libx264', '-preset', 'slow', '-profile:v', 'high', '-crf', String(crf), '-pix_fmt', 'yuv420p', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-movflags', '+faststart', '-an', mp4]);
    if (statSync(mp4).size <= CLIP_MAX || crf >= 40) break;
    crf += 2;
  }
  const webm = resolve(clipsOut, `${name}.webm`);
  ff([...input, '-filter_complex', graph, '-map', '[v]', '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '40', '-row-mt', '1', '-deadline', 'good', '-cpu-used', '2', '-an', webm]);
  const keepWebm = statSync(webm).size < statSync(mp4).size && statSync(webm).size <= CLIP_MAX;
  if (!keepWebm) rmSync(webm);
  line.push(`clip ${N - K} f → mp4 ${(statSync(mp4).size / 1024).toFixed(0)} KB crf${crf}${keepWebm ? `, webm ${(statSync(webm).size / 1024).toFixed(0)} KB` : ''}`);
  report.push(line.join(' · '));
  console.log(line.join(' · '));
}
await browser.close();
await server.close();
if (!process.env.KEEP) rmSync(work, { recursive: true, force: true });
