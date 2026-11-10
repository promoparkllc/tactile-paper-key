// axe.mjs — axe-core (WCAG 2.1 A + AA) on the page and on the player alone, at 1440 and 390, with the menus open.
// Writes design/a11y/axe-report.json and axe-report.md. Run: node apps/preview/scripts/axe.mjs [--url https://…]
import { AxeBuilder } from '@axe-core/playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '../../..');
const outDir = resolve(repo, 'design/a11y');
mkdirSync(outDir, { recursive: true });
const urlArg = process.argv.includes('--url') ? process.argv[process.argv.indexOf('--url') + 1] : null;

let server = null;
let base = urlArg;
if (!base) {
  const { createServer } = await import(pathToFileURL(resolve(repo, 'node_modules/vite/dist/node/index.js')).href);
  server = await createServer({ configFile: resolve(repo, 'vite.config.ts'), logLevel: 'error', server: { port: 5196, strictPort: true, host: '127.0.0.1' } });
  await server.listen();
  base = 'http://127.0.0.1:5196';
}
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
const browser = await chromium.launch();
const runs = [];

async function audit(name, url, viewport, prepare) {
  const context = await browser.newContext({ viewport, hasTouch: viewport.width < 600 });
  const page = await context.newPage();
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  if (prepare) await prepare(page);
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  runs.push({ name, url, viewport, violations: results.violations, passes: results.passes.length, incomplete: results.incomplete.map((i) => ({ id: i.id, impact: i.impact, nodes: i.nodes.length })) });
  console.log(`${name} @${viewport.width}: ${results.violations.length} violations, ${results.passes.length} rules passed`);
  for (const v of results.violations) console.log(`  - ${v.id} (${v.impact}): ${v.nodes.length} × ${v.help}`);
  await context.close();
}

/** Start the hero player and open its settings menu, so the audit sees the dock, the menu and the submenu. */
const openMenus = async (page) => {
  await page.evaluate(async () => {
    const m = document.querySelector('#hero-frame video, #hero-frame mux-video, #stage video, #stage mux-video');
    if (m) {
      m.muted = true;
      await m.play().catch(() => undefined);
    }
  });
  await page.waitForTimeout(600);
  // element clicks (the sticky header or the media element can sit over the key for a pointer click)
  const opened = await page.evaluate(() => {
    const key = [...document.querySelectorAll('.tactile-key-settings')].find((k) => k.getClientRects().length);
    if (!key) return false;
    key.scrollIntoView({ block: 'center' });
    key.click();
    return true;
  });
  if (opened) {
    await page.waitForTimeout(400);
    await page.evaluate(() => {
      const row = [...document.querySelectorAll('.tactile-row')].find((r) => r.getClientRects().length);
      row?.click();
    });
    await page.waitForTimeout(400);
  }
};

const desktop = { width: 1440, height: 900 };
const phone = { width: 390, height: 844 };
await audit('page', `${base}/`, desktop);
await audit('page', `${base}/`, phone);
await audit('page · menus open', `${base}/`, desktop, openMenus);
await audit('page · menus open', `${base}/`, phone, openMenus);
await audit('player', `${base}/lab.html?src=/footage/snow.mp4&captions=/footage/snow.en.vtt`, desktop, openMenus);
await audit('player', `${base}/lab.html?src=/footage/snow.mp4&captions=/footage/snow.en.vtt&width=390`, phone, openMenus);
await audit('player · graphite', `${base}/lab.html?src=/footage/night.mp4&glaze=graphite`, desktop, openMenus);
await audit('player · stone', `${base}/lab.html?src=/footage/market.mp4&glaze=stone`, desktop, openMenus);

await browser.close();
if (server) await server.close();

const total = runs.reduce((n, r) => n + r.violations.length, 0);
const date = new Date().toISOString().slice(0, 10);
writeFileSync(resolve(outDir, 'axe-report.json'), JSON.stringify({ date, base, tags: TAGS, total, runs }, null, 2));
const md = [
  `# axe-core · WCAG 2.1 A/AA · ${date}`,
  '',
  `Base: ${base} · rules: ${TAGS.join(', ')} · @axe-core/playwright`,
  '',
  `**Total violations: ${total}**`,
  '',
  '| run | viewport | violations | rules passed | incomplete (needs review) |',
  '| --- | --- | --- | --- | --- |',
  ...runs.map((r) => `| ${r.name} | ${r.viewport.width} × ${r.viewport.height} | ${r.violations.length} | ${r.passes} | ${r.incomplete.map((i) => `${i.id} (${i.nodes})`).join(', ') || '—'} |`),
  '',
  ...runs.flatMap((r) => r.violations.flatMap((v) => [`## ${r.name} @${r.viewport.width}: ${v.id} (${v.impact})`, '', v.help, '', ...v.nodes.map((n) => `- \`${n.target.join(' ')}\` — ${n.failureSummary?.split('\n').slice(1).join(' ').trim()}`), ''])),
].join('\n');
writeFileSync(resolve(outDir, 'axe-report.md'), md + '\n');
console.log(`\ntotal violations: ${total} → ${outDir}`);
