// end-check.mjs — the end card under the player's END state. The finished film plays to its end in the real skin
// (capture/index.html, 1200 × 675 CSS px at ×1.6 → 1920 × 1080), the END state (the centred Replay key over the last
// frame) is screenshotted, and the card's text extent on the film's last frame (ink pixels, left half) is compared
// with the Replay key's box: the text must end at ≤ 38 % of the width and never under the key.
//
//   node scripts/end-check.mjs [--video out/final/tactile_film_27_5s.mp4] [--name film_27_5s]
//
// Output: stills/<name>_end_state.png (the END state), stills/<name>_end_check.json (the numbers).
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
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
const video = resolve(root, opt('--video', 'out/final/tactile_film_27_5s.mp4'));
const name = opt('--name', 'film_27_5s');
const publicDir = resolve(root, 'out/final/end-public');
const W = 1920;
const H = 1080;
mkdirSync(publicDir, { recursive: true });
mkdirSync(resolve(root, 'stills'), { recursive: true });
copyFileSync(video, resolve(publicDir, 'end.mp4'));

// ---- the film's last frame as 8-bit grey, and the text's extent on it
const { STAGE, TYPE } = await import(pathToFileURL(resolve(root, 'src/layout.js')).href);
const grey = execFileSync('ffmpeg', ['-v', 'error', '-sseof', '-0.05', '-i', video, '-frames:v', '1', '-vf', `scale=${W}:${H},format=gray`, '-f', 'rawvideo', '-'], { maxBuffer: 1 << 26 });
const lineH = TYPE.endTitle * 0.98;
const band = { top: Math.round(STAGE.end.titleBaseline - 2 * lineH), bottom: Math.round(STAGE.end.keys.top + STAGE.end.keys.size) };
let textRight = 0;
let textLeft = W;
for (let y = band.top; y < band.bottom; y++) {
  for (let x = 0; x < W / 2; x++) {
    if (grey[y * W + x] < 140) {
      if (x > textRight) textRight = x;
      if (x < textLeft) textLeft = x;
    }
  }
}

// ---- the END state in the real skin
const { createServer } = await import(pathToFileURL(resolve(repo, 'node_modules/vite/dist/node/index.js')).href);
const server = await createServer({
  configFile: resolve(repo, 'vite.config.ts'),
  root: resolve(root, 'capture'),
  publicDir,
  logLevel: 'error',
  server: { port: 5198, strictPort: true, host: '127.0.0.1', fs: { allow: [repo] } },
});
await server.listen();
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1200, height: 675 }, deviceScaleFactor: 1.6, colorScheme: 'light' });
const page = await context.newPage();
await page.goto('http://127.0.0.1:5198/?src=/end.mp4');
await page.waitForFunction(() => window.__capture?.video && window.__capture.video.readyState >= 2 && window.__capture.video.duration > 0, null, { timeout: 60000 });
await page.evaluate(async () => {
  const v = window.__capture.video;
  v.muted = true;
  v.currentTime = v.duration - 0.4;
  await v.play();
});
await page.waitForFunction(() => window.__capture.video.ended, null, { timeout: 15000 });
await page.waitForTimeout(700); // the END transition
const key = await page.evaluate(() => {
  const el = document.querySelector('.tactile-center-play') ?? document.querySelector('[class*="center"]');
  const r = el?.getBoundingClientRect();
  return r ? { x: r.x * 1.6, y: r.y * 1.6, width: r.width * 1.6, height: r.height * 1.6, selector: el.className } : null;
});
const display = await page.evaluate(() => document.querySelector('.tactile-display')?.textContent?.replace(/\s+/g, ' ').trim() ?? null);
const shot = resolve(root, `stills/${name}_end_state.png`);
await page.screenshot({ path: shot, clip: { x: 0, y: 0, width: 1200, height: 675 }, scale: 'device' });
await browser.close();
await server.close();

const pct = (v) => +((100 * v) / W).toFixed(1);
const result = {
  video: video.split('\\').join('/'),
  band,
  text: { left: textLeft, right: textRight, rightPct: pct(textRight), limitPct: 38 },
  replayKey: key ? { left: Math.round(key.x), right: Math.round(key.x + key.width), leftPct: pct(key.x), rightPct: pct(key.x + key.width), top: Math.round(key.y), bottom: Math.round(key.y + key.height) } : null,
  display,
  clear: key ? Math.round(key.x - textRight) : null,
  pass: textRight <= 0.38 * W && (!key || key.x > textRight),
};
writeFileSync(resolve(root, `stills/${name}_end_check.json`), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
console.log(`wrote ${shot}`);
