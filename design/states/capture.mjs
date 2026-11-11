// capture.mjs — the twelve captures of the page's 04 States, from the real skin on the demo footage.
//   node design/states/capture.mjs [01,05,step,...]   (also the Origin step 5 card: public/img/step-skin.webp)
// Serves design/states/states.html with Vite (the repo's config; the page's public folder for the footage, posters and
// fonts), drives Chrome into each state with real input (pointer, keyboard, touch, network) and writes 1280 × 720 WebP
// to apps/preview/public/states/. A playing frame is held still: the player plays for real, then the media pauses
// while `paused` keeps reading false, so the skin stays in its playing state on a fixed frame.
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '../..');
const pub = resolve(repo, 'apps/preview/public');
const work = resolve(repo, '_tmp/states');
const out = resolve(pub, 'states');
mkdirSync(work, { recursive: true });
const only = process.argv[2]?.split(',');
const ff = (args) => execFileSync('ffmpeg', ['-v', 'error', '-y', ...args], { stdio: ['ignore', 'pipe', 'inherit'] });

// Storyboard for the seek preview (the demo clips are plain MP4, so there is no Mux storyboard): 4 × 3 frames of
// 256 × 144, one every 0.5 s, and its VTT.
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

async function open(params, { phone = false, card = false } = {}) {
  const context = await browser.newContext(
    phone
      ? { viewport: { width: 390, height: 219 }, deviceScaleFactor: 1280 / 390, isMobile: true, hasTouch: true }
      : card
        ? { viewport: { width: 800, height: 600 }, deviceScaleFactor: 1.5 }
        : { viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 }
  );
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  return { context, page, errors, go: async () => {
    await page.goto(`${BASE}?${new URLSearchParams(params)}`);
    await page.waitForFunction(() => window.__s?.media?.readyState >= 2 || window.__s?.player?.hasAttribute('poster'), null, { timeout: 30000 });
    await page.evaluate(() => document.fonts.ready);
  } };
}

/** Play for real, then hold the frame at `frac` of the clip in the playing state. */
const hold = (page, frac) =>
  page.evaluate(async (frac) => {
    const m = window.__s.media;
    await m.play();
    await new Promise((r) => setTimeout(r, 400));
    Object.defineProperty(HTMLMediaElement.prototype, 'paused', { get: () => false, configurable: true });
    m.pause();
    m.currentTime = m.duration * frac;
    await new Promise((r) => m.addEventListener('seeked', r, { once: true }));
    m.dispatchEvent(new Event('playing'));
    m.dispatchEvent(new Event('timeupdate'));
  }, frac);

const rect = (page, sel) => page.evaluate((sel) => { const r = document.querySelector(sel).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, l: r.left, w: r.width }; }, sel);
const wake = async (page) => { await page.mouse.move(640, 300); await page.mouse.move(650, 310, { steps: 3 }); };

/** What the skin shows, for the report: dock opacity, the play key's label, the display's text, rim on the CC key. */
const state = (page) =>
  page.evaluate(() => {
    const q = (s) => document.querySelector(s);
    const dock = q('.tactile-dock');
    const cc = q('.tactile-key-cc');
    return {
      dock: dock ? getComputedStyle(dock).opacity : '-',
      play: q('.tactile-dock-play')?.getAttribute('aria-label'),
      center: getComputedStyle(q('.tactile-center-play')).visibility,
      display: q('.tactile-status')?.innerText.replace(/\s+/g, ' ').trim(),
      cc: cc?.hasAttribute('data-active') ? `latched, rim ${getComputedStyle(cc).getPropertyValue('--tactile-rim-w') || 'on'}` : 'off',
      leds: document.querySelectorAll('.tactile-led-on, .tactile-leds').length,
      focus: document.activeElement?.className?.toString().slice(0, 40),
    };
  });

const STATES = {
  async '01-ready'() {
    const s = await open({ clip: 'market', poster: 1 });
    await s.go();
    await s.page.waitForTimeout(600);
    return s;
  },
  async '02-loading'() {
    const s = await open({ clip: 'night' });
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
    await s.go();
    await s.page.evaluate(() => window.__s.media.play());
    await s.page.waitForFunction(() => document.querySelector('media-controls:has(.tactile-buffering[data-visible])'), null, { timeout: 20000 });
    await wake(s.page);
    await s.page.waitForTimeout(700);
    return s;
  },
  async '03-playing'() {
    const s = await open({ clip: 'snow' });
    await s.go();
    await hold(s.page, 0.44);
    await wake(s.page);
    await s.page.waitForTimeout(500);
    return s;
  },
  async '04-hidden'() {
    const s = await open({ clip: 'studio' });
    await s.go();
    await hold(s.page, 0.44);
    await wake(s.page);
    await s.page.mouse.move(1279, 719);
    await s.page.mouse.move(1500, 800).catch(() => undefined);
    await s.page.waitForTimeout(3500);
    return s;
  },
  async '05-seek-preview'() {
    const s = await open({ clip: 'studio', thumbs: storyboard('studio') });
    await s.go();
    await hold(s.page, 0.3);
    await wake(s.page);
    const r = await rect(s.page, '.tactile-seek');
    await s.page.mouse.move(r.l + r.w * 0.68, r.y, { steps: 6 });
    await s.page.waitForTimeout(900);
    return s;
  },
  async '06-dragging'() {
    const s = await open({ clip: 'market' });
    await s.go();
    await hold(s.page, 0.36);
    await wake(s.page);
    const cap = await rect(s.page, '.tactile-seek .tactile-fader-cap');
    await s.page.mouse.move(cap.x, cap.y, { steps: 4 });
    await s.page.mouse.down();
    await s.page.mouse.move(cap.x + 46, cap.y, { steps: 8 });
    await s.page.waitForTimeout(400);
    s.after = () => s.page.mouse.up();
    return s;
  },
  async '07-muted'() {
    const s = await open({ clip: 'night' });
    await s.go();
    await hold(s.page, 0.44);
    await s.page.evaluate(() => { window.__s.media.muted = true; });
    await wake(s.page);
    await s.page.waitForTimeout(500);
    return s;
  },
  async '08-captions'() {
    const s = await open({ clip: 'night' });
    await s.go();
    await hold(s.page, 0.5);
    await wake(s.page);
    await s.page.click('.tactile-key-cc');
    await s.page.mouse.move(640, 300, { steps: 4 });
    await s.page.waitForTimeout(700);
    return s;
  },
  async '09-settings'() {
    const s = await open({ clip: 'studio' });
    await s.go();
    await hold(s.page, 0.44);
    await wake(s.page);
    await s.page.click('.tactile-key-settings:not(.tactile-settings-corner)');
    await s.page.waitForTimeout(600);
    return s;
  },
  async '10-focus'() {
    const s = await open({ clip: 'market' });
    await s.go();
    await hold(s.page, 0.44);
    // keyboard only: Tab from the play key to the mute key (play → seek cap → mute)
    await s.page.focus('.tactile-dock-play');
    await s.page.keyboard.press('Tab');
    await s.page.keyboard.press('Tab');
    await s.page.waitForTimeout(700);
    return s;
  },
  async '11-replay'() {
    const s = await open({ clip: 'snow' });
    await s.go();
    // play out the last second with no pointer or keyboard activity, then wait past the controls' idle time
    await s.page.evaluate(async () => {
      const m = window.__s.media;
      m.currentTime = m.duration - 1;
      await new Promise((r) => m.addEventListener('seeked', r, { once: true }));
      await m.play();
      await new Promise((r) => m.addEventListener('ended', r, { once: true }));
    });
    await s.page.waitForTimeout(2500);
    return s;
  },
  async '12-phone'() {
    const s = await open({ clip: 'snow' }, { phone: true });
    await s.go();
    await hold(s.page, 0.44);
    // a tap toggles the controls: let them idle out first, then one tap brings the dock and the corner key up
    await s.page.waitForFunction(() => getComputedStyle(document.querySelector('.tactile-dock')).opacity === '0', null, { timeout: 8000 });
    await s.page.touchscreen.tap(195, 80);
    // the emulated tap leaves the container focused with its keyboard ring, which a real tap does not show
    await s.page.evaluate(() => document.activeElement?.blur());
    await s.page.waitForTimeout(600);
    return s;
  },
  // Origin step 5 (THE SKIN): the dock over the market, 4:3 for the step cards (public/img/step-skin.webp, 1200 × 900)
  async 'step-skin'() {
    const s = await open({ clip: 'market', fit: 'cover' }, { card: true });
    await s.go();
    await hold(s.page, 0.5);
    await s.page.mouse.move(400, 200);
    await s.page.mouse.move(410, 210, { steps: 3 });
    await s.page.waitForTimeout(500);
    s.file = resolve(pub, 'img/step-skin.webp');
    s.size = '1200:900';
    return s;
  },
};

for (const [name, run] of Object.entries(STATES)) {
  if (only && !only.some((o) => name.startsWith(o))) continue;
  const s = await run();
  const raw = resolve(work, `${name}.png`);
  await s.page.screenshot({ path: raw });
  const st = await state(s.page);
  await s.after?.();
  ff(['-i', raw, '-vf', `scale=${s.size ?? '1280:720'}:flags=lanczos`, '-c:v', 'libwebp', '-quality', '82', '-compression_level', '6', s.file ?? resolve(out, `${name}.webp`)]);
  report.push(`${name}: ${JSON.stringify(st)}${s.errors.length ? ' · errors: ' + s.errors.join(' | ') : ''}`);
  await s.context.close();
}
console.log(report.join('\n'));
await browser.close();
await server.close();
rmSync(work, { recursive: true, force: true });
