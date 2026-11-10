// capture.mjs — the live hand-off: the real Tactile skin in Chromium (Playwright) playing the film itself, one PNG
// per film frame of the live window (hard cut → end of S8), with the focus ring hopping by Tab on scenes.json
// `tab_hops`. Frame-exact and deterministic: the <video> is paused and SEEKED to each frame's time (no real-time
// playback), while the skin believes it is playing (`paused` reads false) so the dock shows the playing state.
//
//   node scripts/capture.mjs [--src ../render/final/preview.mp4] [--captions ../captions.en.vtt] [--out out/final/capture] [--volume 0.8] [--probe]
//
// The film is wholly buffered before the first frame (the dock's buffer line reads full); the captions track shows.
//
// --probe: no sequence; writes _probe/ screenshots at the cut and after six Tab presses plus the focus path, to check
// the tab order and the player's fit before a real run.
//
// Page: capture/index.html (1200 × 675 CSS px, the board's player) at deviceScaleFactor 1.6 → 1920 × 1080, served by
// Vite with the repo's config (alias `@/` → src), the media copied to a temp public dir (out/final/capture-public).
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const filmDir = resolve(root, '..');
const repo = resolve(filmDir, '..');
const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : def;
};
const probe = args.includes('--probe');
const srcPath = resolve(root, opt('--src', '../render/final/preview.mp4'));
const captionsPath = resolve(root, opt('--captions', '../captions.en.vtt'));
const outDir = resolve(root, opt('--out', 'out/final/capture'));
const publicDir = resolve(root, 'out/final/capture-public');

const { normalizeFilm, sceneById } = await import(pathToFileURL(resolve(root, 'src/data/normalize.js')).href);
const film = normalizeFilm(JSON.parse(readFileSync(resolve(filmDir, 'scenes.json'), 'utf8')), 'scenes.json');
const s8 = sceneById(film, 'S8');
const first = film.hardCut; // 0-based film frame of the first live frame
const last = s8.end;
const hops = film.events.tabHops ?? [];
if (!existsSync(srcPath)) {
  console.error(`capture blocked: ${srcPath} missing`);
  process.exit(3);
}

// ---- media in a public dir Vite can serve with ranges
mkdirSync(publicDir, { recursive: true });
copyFileSync(srcPath, resolve(publicDir, 'film.mp4'));
if (existsSync(captionsPath)) copyFileSync(captionsPath, resolve(publicDir, 'captions.vtt'));

// ---- Vite dev server on the capture page with the repo's config
const { createServer } = await import(pathToFileURL(resolve(repo, 'node_modules/vite/dist/node/index.js')).href);
const server = await createServer({
  configFile: resolve(repo, 'vite.config.ts'),
  root: resolve(root, 'capture'),
  publicDir,
  logLevel: 'error',
  server: { port: 5199, strictPort: true, host: '127.0.0.1', fs: { allow: [repo] } },
});
await server.listen();
const url = `http://127.0.0.1:5199/?src=/film.mp4${existsSync(captionsPath) ? '&captions=/captions.vtt' : ''}`;

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1200, height: 675 }, deviceScaleFactor: 1.6, colorScheme: 'light' });
const page = await context.newPage();
page.on('pageerror', (e) => console.error('page error:', e.message));
page.on('console', (m) => {
  if (m.type() === 'error') console.error('console:', m.text());
});
// the skin must read the media as playing while we seek a paused element
await page.addInitScript(() => {
  Object.defineProperty(HTMLMediaElement.prototype, 'paused', { get: () => false, configurable: true });
});
await page.goto(url);
await page.waitForFunction(() => window.__capture?.video && window.__capture.video.readyState >= 1 && window.__capture.video.duration > 0, null, { timeout: 60000 });

// the whole film buffered before any frame: the dock's buffer line must read full. The file is small enough that
// Chromium loads it whole; if it stops short, the same bytes go in as a Blob (one range, 0 → duration).
const buffered = () =>
  page.evaluate(() => {
    const v = window.__capture.video;
    const ranges = [];
    for (let i = 0; i < v.buffered.length; i++) ranges.push([+v.buffered.start(i).toFixed(3), +v.buffered.end(i).toFixed(3)]);
    return { ranges, duration: v.duration };
  });
const whole = (b) => b.ranges.length === 1 && b.ranges[0][0] <= 0.01 && b.ranges[0][1] >= b.duration - 0.05;
let buf = await buffered();
if (!whole(buf)) {
  await page.waitForFunction(() => { const v = window.__capture.video; return v.buffered.length === 1 && v.buffered.end(0) >= v.duration - 0.05; }, null, { timeout: 15000 }).catch(() => {});
  buf = await buffered();
}
if (!whole(buf)) {
  await page.evaluate(async () => {
    const v = window.__capture.video;
    const blob = await (await fetch(v.currentSrc || v.src)).blob();
    v.src = URL.createObjectURL(blob);
    await new Promise((r) => v.addEventListener('loadedmetadata', r, { once: true }));
    await new Promise((r) => v.addEventListener('progress', r, { once: true }));
  });
  buf = await buffered();
}
console.log(`buffered ${JSON.stringify(buf.ranges)} of ${buf.duration.toFixed(3)} s${whole(buf) ? '' : ' — NOT whole'}`);

const seek = async (t) => {
  await page.evaluate(async (time) => {
    const v = window.__capture.video;
    await new Promise((done) => {
      const onSeeked = () => {
        v.removeEventListener('seeked', onSeeked);
        done();
      };
      v.addEventListener('seeked', onSeeked);
      v.currentTime = time;
    });
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  }, t);
};
// the dock shows on pointer activity and hides 2 s after it; poke it before every frame (keyboard focus keeps it later)
const poke = async () => {
  await page.evaluate(() => {
    const c = window.__capture.container;
    c.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerType: 'mouse', clientX: 600, clientY: 200 }));
  });
};
const filmTime = (frame0) => (frame0 + 0.5) / film.fps; // the middle of the frame: seeks land on that frame
const focusPath = () =>
  page.evaluate(() => {
    const parts = [];
    let el = document.activeElement;
    while (el) {
      parts.push(el.localName + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).join('.') : ''));
      el = el.shadowRoot?.activeElement ?? null;
    }
    return parts.join(' > ');
  });

await page.evaluate((volume) => {
  const v = window.__capture.video;
  v.muted = false; // the 3D stand-in shows the sound-on glyph and a volume fader position
  v.volume = volume;
  window.__capture.container.tabIndex = -1; // Tab 1 goes to the first key, not to the container (no ring around the player)
  for (const t of v.textTracks) t.mode = t.kind === 'captions' ? 'showing' : 'disabled';
  v.dispatchEvent(new Event('play'));
  v.dispatchEvent(new Event('playing'));
}, Number(opt('--volume', '0.6')));
await seek(filmTime(first));
await poke();
await page.waitForTimeout(800); // the dock's show transition

if (probe) {
  const dir = resolve(outDir, '_probe');
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const log = [];
  const state = await page.evaluate(() => {
    const c = window.__capture.container;
    const v = window.__capture.video;
    return {
      containerRect: c.getBoundingClientRect().toJSON(),
      tabindex: c.getAttribute('tabindex'),
      currentTime: v.currentTime,
      duration: v.duration,
      videoSize: [v.videoWidth, v.videoHeight],
      controlsVisible: !!c.querySelector('media-controls-content')?.hasAttribute('data-visible') || !!c.querySelector('[data-visible]'),
      playState: c.querySelector('.tactile-dock-play')?.getAttribute('data-paused') ?? c.querySelector('.tactile-dock-play')?.outerHTML.slice(0, 200),
      display: c.querySelector('.tactile-display')?.textContent?.replace(/\s+/g, ' ').trim(),
    };
  });
  log.push(`state: ${JSON.stringify(state)}`);
  await page.screenshot({ path: resolve(dir, 'cut.png'), clip: { x: 0, y: 0, width: 1200, height: 675 }, scale: 'device' });
  for (let i = 1; i <= 6; i++) {
    await page.keyboard.press('Tab');
    await page.waitForTimeout(150);
    const fp = await focusPath();
    log.push(`tab ${i}: ${fp}`);
    await page.screenshot({ path: resolve(dir, `tab${i}.png`), clip: { x: 0, y: 0, width: 1200, height: 675 }, scale: 'device' });
  }
  writeFileSync(resolve(dir, 'probe.txt'), log.join('\n') + '\n');
  console.log(log.join('\n'));
} else {
  mkdirSync(outDir, { recursive: true });
  const pre = Number(opt('--pre-tabs', '0')); // Tabs pressed before the window so hop 1 lands on the first key
  for (let i = 0; i < pre; i++) await page.keyboard.press('Tab');
  const hopSet = new Set(hops);
  for (let f = first; f <= last; f++) {
    if (hopSet.has(f)) await page.keyboard.press('Tab');
    await seek(filmTime(f));
    await poke();
    await page.waitForTimeout(40);
    const name = `${String(f + 1).padStart(4, '0')}.png`; // Blender frame number, like render/final/out
    await page.screenshot({ path: resolve(outDir, name), clip: { x: 0, y: 0, width: 1200, height: 675 }, scale: 'device' });
    if (hopSet.has(f)) console.log(`f${f + 1}: Tab → ${await focusPath()}`);
  }
  console.log(`wrote ${last - first + 1} frames (${first + 1}–${last + 1}) → ${outDir}`);
}

await browser.close();
await server.close();
