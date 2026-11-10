// contra-capture.mjs — the skin captures for the Contra video: the real Tactile player in Chrome (Playwright) with
// real interactions (hover, drag, click, Tab, keys, the accent variable), one PNG per video frame per scene, frame-exact:
//   · the page runs on a virtual clock (page.clock), paused once the page is ready: timers / rAF / Date advance
//     1000/30 ms per captured frame and not at all while a screenshot is taken;
//   · CSS transitions and animations do not follow that clock, so each one is paused when it first appears and
//     stepped by the frame time through document.getAnimations(); one that reaches its end is finished, so the
//     components waiting on it (menus, tooltips) move on. A 300 ms dock move spans 9 frames whatever a screenshot takes;
//   · the media never really plays: play() / pause() only flip `paused` and send the events, and the script seeks the
//     media to the clip time of each frame. A drag on the seek fader moves that clip time, as it would in playback;
//   · pointer positions are logged per frame (Remotion draws the cursor), and a manifest lists what exists.
//
//   node scripts/contra-capture.mjs [--scenes ready,seek] [--target main|isolated] [--url <page>] [--clip <file>] [--channel chrome] [--dry]
//
// Targets (per scene in src/contra/config.js, overridable): `main` = the hero player of the live page
// (CAPTURE.mainUrl, --url overrides), its frame widened to 1200 CSS px so every scene shows the same player;
// `isolated` = capture/index.html served by Vite from this repo (the skin in src/) with the scene's demo clip as the
// source (--clip overrides), a captions track when the scene has `captions`, and a storyboard cut from the clip when
// it has `storyboard`. Desktop scenes capture the 1200 × 675 player at deviceScaleFactor 1.6 (1920 × 1080 PNGs), the
// mobile scene the 390 px player at ×3; frames are then pre-scaled (lanczos) to the composition box and written to
// public/contra/capture/<scene>/NNNN.png.
//
// Chrome, not the bundled Chromium: the demo clips and the Mux stream are H.264.
// --dry runs the frame loop on a bare <video> page (no skin) to check the clock / seek / screenshot mechanics only.
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const repo = resolve(root, '../..');
const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : def;
};
const dry = args.includes('--dry');
const { CAPTURE, FPS, LAYOUTS, SCENES } = await import(pathToFileURL(resolve(root, 'src/contra/config.js')).href);
const wanted = opt('--scenes', null)?.split(',') ?? SCENES.filter((s) => s.capture).map((s) => s.id);
const scenes = SCENES.filter((s) => wanted.includes(s.id) && (s.capture || dry));
const targetOverride = opt('--target', null);
const urlOverride = opt('--url', null);
const clipOverride = opt('--clip', null);
const outRoot = resolve(root, 'public/contra/capture');
const rawRoot = resolve(root, 'out/contra/capture-raw');
const publicDir = resolve(root, 'out/contra/capture-public');
mkdirSync(outRoot, { recursive: true });
mkdirSync(rawRoot, { recursive: true });
mkdirSync(publicDir, { recursive: true });
const sh = (cmd, a) => execFileSync(cmd, a, { stdio: ['ignore', 'pipe', 'inherit'], cwd: root });
const FRAME_MS = 1000 / FPS;
const CLIP_END = 5.9; // the clips are 6.05 s; stay short of the end so the player never reaches END

// ---- Vite for the isolated page (the repo's config: alias @/ → src), media from a public dir
let server = null;
const vtt = (s) => {
  const ms = Math.round((s % 1) * 1000);
  return `00:00:${String(Math.floor(s)).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
};
const isolatedUrl = async (clip, scene = {}) => {
  if (!server) {
    // every clip goes into the public dir before Vite starts: Vite lists the public files at start-up, so a clip copied
    // after that answers 404 for a while (the first scene's media failed with NO SIGNAL)
    for (const f of readdirSync(resolve(repo, 'demo-footage')).filter((f) => f.endsWith('.mp4'))) copyFileSync(resolve(repo, 'demo-footage', f), resolve(publicDir, f));
    const { createServer } = await import(pathToFileURL(resolve(repo, 'node_modules/vite/dist/node/index.js')).href);
    server = await createServer({ configFile: resolve(repo, 'vite.config.ts'), root: resolve(root, 'capture'), publicDir, logLevel: 'error', server: { port: 5198, strictPort: true, host: '127.0.0.1', fs: { allow: [repo] } } });
    await server.listen();
  }
  const src = resolve(repo, 'demo-footage', clip);
  copyFileSync(src, resolve(publicDir, clip));
  let url = `http://127.0.0.1:5198/?src=/${encodeURIComponent(clip)}`;
  const base = clip.replace(/\.mp4$/, '');
  if (scene.captions) {
    // one cue over the whole clip; the scene turns the track on with the Captions key
    writeFileSync(resolve(publicDir, `${base}.captions.vtt`), `WEBVTT\n\n00:00:00.000 --> 00:00:06.000\n${scene.captions}\n`);
    url += `&captions=/${base}.captions.vtt`;
  }
  if (scene.storyboard) {
    // a storyboard as Mux serves one: a sprite of 256 × 144 tiles (one every 0.5 s) and a thumbnails track
    const tiles = 13;
    sh('ffmpeg', ['-v', 'error', '-y', '-i', src, '-vf', `fps=2,scale=256:144:flags=lanczos,tile=${tiles}x1`, '-frames:v', '1', '-q:v', '3', resolve(publicDir, `${base}.storyboard.jpg`)]);
    const cues = Array.from({ length: tiles }, (_, i) => `${vtt(i * 0.5)} --> ${vtt(i * 0.5 + 0.5)}\n/${base}.storyboard.jpg#xywh=${i * 256},0,256,144`);
    writeFileSync(resolve(publicDir, `${base}.storyboard.vtt`), `WEBVTT\n\n${cues.join('\n\n')}\n`);
    url += `&storyboard=/${base}.storyboard.vtt`;
  }
  return url;
};

const browser = await chromium.launch({ channel: opt('--channel', 'chrome') });
const manifestPath = resolve(root, 'public/contra/captures.json');
const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : { scenes: {} };

for (const scene of scenes) {
  const cap = scene.capture ?? { target: 'isolated', viewport: 'desktop' };
  const target = targetOverride ?? cap.target;
  const isMain = target === 'main' && !dry;
  const mobile = cap.viewport === 'mobile';
  const geo = mobile ? CAPTURE.mobile : CAPTURE.player;
  const frames = Number(opt('--frames', (scene.end - scene.start) * FPS)); // --frames N: a short run to check a scene's start
  const clip = clipOverride ?? scene.clip;
  const context = await browser.newContext({
    viewport: mobile ? { width: geo.width, height: 800 } : { width: 1440, height: 1000 }, // taller than the 675 px player with room to centre it
    deviceScaleFactor: geo.deviceScaleFactor,
    colorScheme: 'light',
    hasTouch: mobile,
  });
  const page = await context.newPage();
  page.on('pageerror', (e) => console.error(`[${scene.id}] page error:`, e.message));
  page.on('console', (m) => m.type() === 'error' && console.error(`[${scene.id}] console:`, m.text()));
  page.on('requestfailed', (r) => console.error(`[${scene.id}] request failed:`, r.url(), r.failure()?.errorText));
  page.on('response', (r) => r.status() >= 400 && console.error(`[${scene.id}] ${r.status()}:`, r.url()));
  // The media never plays for real: play() / pause() flip `paused` and send the events the player listens for.
  await page.addInitScript(() => {
    const proto = HTMLMediaElement.prototype;
    const playing = new WeakSet();
    Object.defineProperty(proto, 'paused', { get() { return !playing.has(this); }, configurable: true });
    proto.play = function play() {
      if (!playing.has(this)) {
        playing.add(this);
        this.dispatchEvent(new Event('play'));
        this.dispatchEvent(new Event('playing'));
      }
      return Promise.resolve();
    };
    proto.pause = function pause() {
      if (playing.has(this)) {
        playing.delete(this);
        this.dispatchEvent(new Event('pause'));
      }
    };
  });
  await page.clock.install({ time: new Date('2026-11-10T12:00:00') });

  let url;
  if (dry) url = (await isolatedUrl(clip)).replace('/?', '/bare.html?');
  else if (isMain) url = urlOverride ?? CAPTURE.mainUrl;
  else url = urlOverride ?? `${await isolatedUrl(clip, scene)}${mobile ? `&width=${geo.width}` : ''}`;
  await page.goto(url, { waitUntil: 'load' });
  // the live page's hero frame is 1104 px wide at this viewport; the isolated player is 1200. Same player in every scene.
  if (isMain) await page.addStyleTag({ content: `#hero-frame { width: ${geo.width}px; max-width: none; margin-left: calc((100% - ${geo.width}px) / 2); }` });

  // the player: the live page's hero player or the capture page's; the media inside it
  const handles = await page.evaluateHandle((main) => {
    const player = main ? document.querySelector('#hero-frame video-player, #hero-frame media-container') : document.querySelector('video-player, media-container, video');
    const root = player ?? document.body;
    const media = root.querySelector?.('video, mux-video') ?? document.querySelector('video');
    const container = root.querySelector?.('media-container') ?? root;
    return { player: root, media, container };
  }, isMain);
  // ready = a first frame and the duration (the clock is still running, so the stream can load), fonts in
  await page
    .waitForFunction((h) => h.media && h.media.readyState >= 3 && Number.isFinite(h.media.duration), handles, { timeout: 20000 })
    .catch(async () => console.warn(`[${scene.id}] media not ready in 20 s:`, await page.evaluate((h) => JSON.stringify({ rs: h.media?.readyState, err: h.media?.error?.message, code: h.media?.error?.code, src: h.media?.currentSrc, dur: h.media?.duration }), handles)));
  await page.evaluate(() => document.fonts.ready);
  const rect = await page.evaluate((h) => {
    h.container.scrollIntoView({ block: 'center' }); // the container: <video-player> is display: contents and has no box
    const r = h.container.getBoundingClientRect();
    return { x: r.left, y: r.top, width: r.width, height: r.height };
  }, handles);
  await page.evaluate((h) => {
    if (h.media) {
      h.media.muted = false;
      h.media.volume = 0.6;
      for (const t of h.media.textTracks ?? []) if (t.kind === 'captions' || t.kind === 'subtitles') t.mode = 'disabled';
    }
    if (h.container?.setAttribute) h.container.tabIndex = -1;
  }, handles);
  // from here on time moves only when the loop says so
  if (rect.y < 0 || rect.y + rect.height > page.viewportSize().height) console.warn(`[${scene.id}] the player is not fully inside the viewport:`, JSON.stringify(rect));
  await page.clock.pauseAt(new Date((await page.evaluate(() => Date.now())) + 1000));

  const locate = (sel) => {
    const list = sel.split(',').map((s) => s.trim());
    return page.evaluateHandle(({ h, list }) => {
      for (const s of list) {
        const el = s === 'video' ? h.media : h.player.querySelector(s) ?? document.querySelector(s);
        if (el) return el;
      }
      return null;
    }, { h: handles, list });
  };
  const center = async (sel, fx = 0.5, fy = 0.5) => {
    const el = await locate(sel);
    const r = await el.evaluate((e) => (e ? e.getBoundingClientRect().toJSON() : null)).catch(() => null);
    if (!r || !r.width) console.warn(`[${scene.id}] nothing to point at for "${sel}"`);
    return r && r.width ? { x: r.x + r.width * fx, y: r.y + r.height * fy } : null;
  };
  // seek and wait for the frame; the wait is on the real clock (the page's is paused)
  const seekMedia = (time) =>
    Promise.race([
      page.evaluate(({ h, time }) => {
        const v = h.media;
        if (!v || Math.abs(v.currentTime - time) < 0.001) return null;
        return new Promise((done) => {
          v.addEventListener('seeked', () => done(null), { once: true });
          v.currentTime = time;
        });
      }, { h: handles, time }),
      new Promise((done) => setTimeout(done, 3000)),
    ]);
  const mediaTime = () => page.evaluate((h) => h.media?.currentTime ?? 0, handles);
  const stepAnimations = (ms) =>
    page.evaluate((ms) => {
      const seen = (window.__stepped ??= new WeakSet());
      for (const a of document.getAnimations()) {
        if (a.playState === 'finished' || a.playState === 'idle') continue;
        let t;
        if (seen.has(a)) t = (Number(a.currentTime) || 0) + ms;
        else {
          // new since the last frame: it has run on the real clock; restart it one frame in
          seen.add(a);
          a.pause();
          t = ms;
        }
        const end = Number(a.effect?.getComputedTiming().endTime);
        if (Number.isFinite(end) && t >= end) a.finish();
        else a.currentTime = t;
      }
    }, ms);
  const settle = async (ms) => {
    for (let k = 0; k < Math.ceil(ms / FRAME_MS); k++) {
      await page.clock.runFor(Math.round(FRAME_MS));
      await stepAnimations(FRAME_MS);
    }
  };
  const perform = async (a, tl) => {
    if (a.do === 'play') await page.evaluate((h) => h.media?.play(), handles);
    if (a.do === 'pin') await page.evaluate((h) => h.player.querySelector('media-controls')?.setAttribute('visibility', 'always'), handles);
    if (a.do === 'hover') {
      const p = await center(a.on, a.x ?? 0.5, a.y ?? 0.5);
      if (p) {
        await page.mouse.move(p.x, p.y, { steps: 6 });
        state.mouse = p;
      }
    }
    if (a.do === 'click') {
      const p = await center(a.on, a.x ?? 0.5, a.y ?? 0.5);
      if (p) {
        await page.mouse.move(p.x, p.y, { steps: 4 });
        await page.mouse.down();
        await page.clock.runFor(70);
        await page.mouse.up();
        state.mouse = p;
      }
    }
    if (a.do === 'drag') {
      const from = await center(a.on, a.from, 0.5);
      const to = await center(a.on, a.to, 0.5);
      if (from && to) {
        await page.mouse.move(from.x, from.y, { steps: 4 });
        await page.mouse.down();
        state.dragging = { from, to, start: tl, seconds: a.seconds ?? 1 };
        state.mouse = from;
      }
    }
    if (a.do === 'tab') await page.keyboard.press('Tab');
    if (a.do === 'key') await page.keyboard.press(a.key);
    if (a.do === 'accent') await page.evaluate(({ h, hex, ink }) => {
      h.container.style.setProperty('--media-accent-color', hex);
      h.container.style.setProperty('--media-accent-text-color', ink);
    }, { h: handles, hex: a.hex, ink: a.ink });
  };

  const dir = resolve(dry ? resolve(root, 'out/contra/dry') : rawRoot, scene.id);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const pointer = [];
  const state = { mouse: null, dragging: null, released: -1, offset: 0 };
  const actions = [...scene.actions].sort((a, b) => a.at - b.at);
  let next = 0;
  await settle(300); // the player reads the loaded media (duration, tracks) on its own timers
  // pre-roll: what the scene starts with (playing, pinned) happens before its first frame and has time to land
  while (next < actions.length && actions[next].at <= 0 && ['play', 'pin'].includes(actions[next].do)) await perform(actions[next++], 0);
  if (next > 0) await settle(700);
  if (dry) await page.evaluate((h) => h.media?.play(), handles);
  console.log(`[${scene.id}] ${frames} frames · ${target} · ${mobile ? 'mobile ×3' : '1200 × 675 ×1.6'} · ${isMain ? url : `clip ${clip}`}`);
  for (let f = 0; f < frames; f++) {
    const tl = f / FPS;
    while (next < actions.length && actions[next].at <= tl + 1e-6) await perform(actions[next++], tl);
    if (state.dragging) {
      const d = state.dragging;
      const p = Math.min(1, (tl - d.start) / d.seconds);
      const e = 1 - Math.pow(1 - p, 3);
      const x = d.from.x + (d.to.x - d.from.x) * e;
      await page.mouse.move(x, d.from.y);
      state.mouse = { x, y: d.from.y };
      if (p >= 1) {
        await page.mouse.up();
        state.dragging = null;
        state.released = f;
      }
    }
    await page.clock.runFor(Math.round(FRAME_MS));
    await stepAnimations(FRAME_MS);
    const playing = await page.evaluate((h) => !!h.media && !h.media.paused, handles);
    if (state.released >= 0 && f - state.released === 5) {
      // the fader's seek has landed (it is throttled): playback goes on from where the cap was dropped
      state.offset = (await mediaTime()) - tl;
      state.released = -1;
    }
    const holding = state.dragging || state.released >= 0; // the fader owns the media time while it is dragged
    if (playing && !holding) await seekMedia(Math.max(0, Math.min(CLIP_END, tl + state.offset)));
    await page.screenshot({ path: resolve(dir, `${String(f).padStart(4, '0')}.png`), clip: rect, scale: 'device' });
    pointer.push(state.mouse ? [Math.round((state.mouse.x - rect.x) * 1000) / 1000, Math.round((state.mouse.y - rect.y) * 1000) / 1000] : null);
  }
  await context.close();

  if (dry) {
    console.log(`[${scene.id}] dry run: ${readdirSync(dir).length} frames → ${dir} (manifest untouched)`);
    continue;
  }
  // pre-scale (lanczos) to the composition box of the 16:9 layout (the 4:5 box is a near-integer ratio of it)
  const box = mobile ? LAYOUTS['16:9'].end.phone : LAYOUTS['16:9'].player;
  const outDir = resolve(outRoot, scene.id);
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });
  sh('ffmpeg', ['-v', 'error', '-y', '-framerate', String(FPS), '-i', resolve(dir, '%04d.png'), '-vf', `scale=${box.width}:${box.height}:flags=lanczos`, '-start_number', '0', resolve(outDir, '%04d.png')]);
  manifest.scenes[scene.id] = { frames, width: box.width, height: box.height, captured: new Date().toISOString(), target, clip: isMain ? null : clip, url: isMain ? url : null, touch: mobile, pointer, sourceRect: rect, deviceScaleFactor: geo.deviceScaleFactor };
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`[${scene.id}] wrote ${readdirSync(outDir).length} frames → ${outDir}`);
}
await browser.close();
if (server) await server.close();
