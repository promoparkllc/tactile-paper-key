// render.mjs — tactile_contra_cover_4x3.mp4: 1600 × 1200, 30 fps, 11 s, a clean loop, no audio, H.264 yuv420p BT.709,
// at most 9.5 MB; plus its first frame as a PNG and a contact sheet at one frame per second.
//   node design/contra/render.mjs            (writes design/contra/out/)
// Serves design/contra/stage.html with Vite and renders it frame by frame in Chrome: every frame sets the layers, the
// film frame, the pointer and the media time, moves the page's animation clock on by exactly 1/30 s, then takes a
// screenshot. The timeline (seconds):
//   0–0.6     poster: title, the real player held at 44 % of the snow clip, dock in full (frame 0 = thumbnail)
//   0.6–2     the final film's 3D render, shot 4: the key presses (f290–331, press at f301, then its accent rim)
//   2–5       shot 5: the dock flattens into the interface (f370–459)
//   5–9.5     the real player: Play pressed, a scrub on the seek fader with its preview, Captions latched with the
//             accent rim, glaze bone → graphite → stone
//   9.5–11    back to the poster (its player is never touched, so the last frame is the first)
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, statSync, writeFileSync, copyFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '../..');
const pub = resolve(repo, 'apps/preview/public');
const work = resolve(repo, '_tmp/contra');
const frames = resolve(work, 'frames');
const out = resolve(here, 'out');
for (const d of [work, frames, out]) mkdirSync(d, { recursive: true });
const FPS = 30;
const N = 330; // 11 s
const MAX = 9.5 * 1024 * 1024;
const ff = (args) => execFileSync('ffmpeg', ['-v', 'error', '-y', ...args], { stdio: ['ignore', 'pipe', 'inherit'] });
const fsUrl = (p) => '/@fs/' + encodeURI(p.replace(/\\/g, '/'));

// storyboard for the seek preview (the snow clip is a plain MP4): 12 frames of 256 × 144, one every 0.5 s
const sbJpg = resolve(work, 'snow-storyboard.jpg');
ff(['-i', resolve(pub, 'footage/snow.mp4'), '-vf', 'fps=2,scale=256:144,tile=4x3', '-frames:v', '1', '-q:v', '3', sbJpg]);
const ts = (s) => `00:00:${s.toFixed(3).padStart(6, '0')}`;
let vtt = 'WEBVTT\n\n';
for (let i = 0; i < 12; i++) vtt += `${ts(i * 0.5)} --> ${ts(i * 0.5 + 0.5)}\nsnow-storyboard.jpg#xywh=${(i % 4) * 256},${Math.floor(i / 4) * 144},256,144\n\n`;
writeFileSync(resolve(work, 'snow-storyboard.vtt'), vtt);

const { createServer } = await import(pathToFileURL(resolve(repo, 'node_modules/vite/dist/node/index.js')).href);
const server = await createServer({
  configFile: resolve(repo, 'vite.config.ts'),
  root: resolve(repo, 'design'),
  publicDir: pub,
  logLevel: 'error',
  server: { port: 5407, strictPort: true, host: '127.0.0.1', fs: { allow: [repo] } },
});
await server.listen();
const browser = await chromium.launch({ channel: 'chrome', args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 1200 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('response', (r) => r.status() >= 400 && errors.push(`${r.status()} ${r.url()}`));
await page.goto(`http://127.0.0.1:5407/contra/stage.html?thumbs=${encodeURIComponent(fsUrl(resolve(work, 'snow-storyboard.vtt')))}`);
await page.waitForFunction(() => window.__stage, null, { timeout: 30000 });
await page.evaluate(() => window.__stage.ready());
await page.evaluate(() => window.__stage.holdPoster());
await page.evaluate(() => window.__stage.actionAt(0.8));
await page.mouse.move(1500, 1150);
await page.waitForTimeout(800);

const S = (fn, ...a) => page.evaluate(([fn, a]) => window.__stage[fn](...a), [fn, a]);
const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2);
const lerp = (a, b, x) => a + (b - a) * x;
const span = (f, a, b) => Math.min(1, Math.max(0, (f - a) / (b - a)));
const filmSrc = (n) => fsUrl(resolve(repo, `film/render/final/out/${String(n).padStart(4, '0')}.png`));

// where the pointer goes: the action player's controls, measured once (the layout does not move)
const P = {
  rest: { x: 1180, y: 640 },
  play: await S('at', '.tactile-dock-play'),
  cap: await S('at', '.tactile-seek .tactile-fader-cap'),
  cc: await S('at', '.tactile-dock .tactile-key-cc'),
  away: { x: 820, y: 560 },
};
const track = await page.evaluate(() => { const r = document.querySelector('#action .tactile-seek').getBoundingClientRect(); return { l: r.left, w: r.width, y: r.top + r.height / 2 }; });
const DRAG_TO = { x: track.l + track.w * 0.55, y: P.cap.y };

// the pointer path: [frame from, frame to, from, to]
const MOVES = [
  [156, 170, P.rest, P.play],
  [176, 189, P.play, P.cap],
  [191, 222, P.cap, DRAG_TO],
  [226, 238, DRAG_TO, P.cc],
  [243, 254, P.cc, P.away],
];
const DOWN = [[171, 175], [190, 223], [239, 242]];
const where = (f) => {
  let pos = P.rest;
  for (const [a, b, from, to] of MOVES) {
    if (f >= a) pos = f >= b ? to : { x: lerp(from.x, to.x, ease(span(f, a, b))), y: lerp(from.y, to.y, ease(span(f, a, b))) };
  }
  return pos;
};
const isDown = (f) => DOWN.some(([a, b]) => f >= a && f < b);
const playing = (f) => (f >= 175 && f < 190) || (f >= 224 && f < 285); // the stage moves the clip's time on

let wasDown = false;
const started = Date.now();
for (let f = 0; f < N; f++) {
  // layers
  const posterO = f < 18 ? 1 : f < 24 ? 1 - span(f, 17, 23) : f < 285 ? 0 : f < 300 ? ease(span(f, 284, 299)) : 1;
  // from 10 s the film's first frame is back under the poster, so the last frame is the first one, pixel for pixel
  const filmO = f < 150 ? 1 : f < 159 ? 1 - span(f, 149, 158) : f < 300 ? 0 : 1;
  await S('opacity', 'poster-layer', posterO);
  await S('opacity', 'film-layer', filmO);
  if (f < 150) await S('film', filmSrc(f < 18 ? 290 : f < 60 ? 290 + (f - 18) : 370 + (f - 60)));
  if (f === 300) await S('film', filmSrc(290));
  // glaze
  if (f === 258) await S('glaze', 'graphite');
  if (f === 273) await S('glaze', 'stone');
  // pointer
  const pos = where(f);
  const shown = f >= 156 && f < 262;
  const down = isDown(f);
  await page.mouse.move(pos.x, pos.y);
  if (down && !wasDown) await page.mouse.down();
  if (!down && wasDown) await page.mouse.up();
  wasDown = down;
  await S('pointer', pos.x, pos.y, { shown, down });
  // media time
  if (playing(f) && !down) {
    const t = await S('actionTime');
    await S('actionAt', Math.min(t + 1 / FPS, 5.5));
  }
  await S('step', 1000 / FPS);
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  await page.screenshot({ path: resolve(frames, `${String(f).padStart(4, '0')}.png`) });
  if (f % 30 === 0) process.stdout.write(`${f / 30}s `);
}
console.log(`\n${N} frames in ${((Date.now() - started) / 1000).toFixed(0)} s`);
await browser.close();
await server.close();

// encode: x264 high, yuv420p, BT.709 tagged and converted, no audio; CRF up until it fits 9.5 MB
const mp4 = resolve(out, 'tactile_contra_cover_4x3.mp4');
let crf = 14;
for (;;) {
  ff(['-framerate', String(FPS), '-i', resolve(frames, '%04d.png'), '-vf', 'scale=out_color_matrix=bt709:out_range=tv,format=yuv420p,setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709:range=tv', '-c:v', 'libx264', '-preset', 'slow', '-profile:v', 'high', '-crf', String(crf), '-pix_fmt', 'yuv420p', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-color_range', 'tv', '-movflags', '+faststart', '-an', mp4]);
  if (statSync(mp4).size <= MAX || crf >= 30) break;
  crf += 2;
}
copyFileSync(resolve(frames, '0000.png'), resolve(out, 'tactile_contra_cover_4x3_frame0.png'));
// contact sheet: one frame per second (0 … 10 s), 4 × 3
ff(['-i', mp4, '-vf', "select='not(mod(n\\,30))',scale=400:300,tile=4x3", '-frames:v', '1', '-update', '1', resolve(out, 'tactile_contra_cover_4x3_contact.png')]);
console.log(`mp4 ${(statSync(mp4).size / 1048576).toFixed(2)} MB at CRF ${crf}${errors.length ? ' · errors: ' + errors.join(' | ') : ''}`);
if (!process.env.KEEP) rmSync(work, { recursive: true, force: true });
