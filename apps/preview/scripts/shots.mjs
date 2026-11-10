// shots.mjs — page captures at 1440, 810 and 390 (full page and the first screen) into design/implementation/.
// Run: node apps/preview/scripts/shots.mjs [--url https://…] [--tag v3]
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '../../..');
const out = resolve(repo, 'design/implementation');
mkdirSync(out, { recursive: true });
const arg = (n, d) => (process.argv.includes(n) ? process.argv[process.argv.indexOf(n) + 1] : d);
const urlArg = arg('--url', null);
const tag = arg('--tag', 'v3');

let server = null;
let base = urlArg;
if (!base) {
  const { createServer } = await import(pathToFileURL(resolve(repo, 'node_modules/vite/dist/node/index.js')).href);
  server = await createServer({ configFile: resolve(repo, 'vite.config.ts'), logLevel: 'error', server: { port: 5195, strictPort: true, host: '127.0.0.1' } });
  await server.listen();
  base = 'http://127.0.0.1:5195';
}
const browser = await chromium.launch();
for (const width of [1440, 810, 390]) {
  const context = await browser.newContext({ viewport: { width, height: width < 600 ? 844 : 900 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  await page.goto(`${base}/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: resolve(out, `page-${tag}-${width}-hero.png`) });
  await page.screenshot({ path: resolve(out, `page-${tag}-${width}.png`), fullPage: true });
  console.log(`${width} ✓`);
  await context.close();
}
await browser.close();
if (server) await server.close();
