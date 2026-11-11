// render.mjs — the hero poster: design/poster/poster.html → apps/preview/public/poster.webp (1920 × 1080, under 40 KB).
//   node design/poster/render.mjs
// Renders the page at deviceScaleFactor 2 in Chrome, downscales (lanczos) to 1920 × 1080 and encodes WebP, stepping the
// quality down until the file is under 40 KB.
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '../..');
const work = resolve(repo, '_tmp/poster');
const out = resolve(repo, 'apps/preview/public/poster.webp');
const MAX = 40 * 1024;
mkdirSync(work, { recursive: true });

const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 2 });
await page.goto(pathToFileURL(resolve(here, 'poster.html')).href);
await page.waitForFunction(() => document.querySelector('.key').complete);
const raw = resolve(work, 'poster@2x.png');
await (await page.$('#frame')).screenshot({ path: raw });
await browser.close();

let quality = 82;
for (;;) {
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', raw, '-vf', 'scale=1920:1080:flags=lanczos', '-c:v', 'libwebp', '-quality', String(quality), '-compression_level', '6', out]);
  if (statSync(out).size <= MAX || quality <= 50) break;
  quality -= 4;
}
console.log(`poster.webp: ${(statSync(out).size / 1024).toFixed(1)} KB at quality ${quality}`);
rmSync(work, { recursive: true, force: true });
