// contra-sync.mjs — copies what the Contra compositions read from public/contra/: the demo footage (../../demo-footage),
// the 3D film for the hook (../render/final/preview.mp4, no layer), and an empty captures manifest when none exists.
import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const repo = resolve(root, '../..');
const out = resolve(root, 'public/contra');
mkdirSync(resolve(out, 'footage'), { recursive: true });
const fresh = (src, dst) => !existsSync(dst) || statSync(src).mtimeMs > statSync(dst).mtimeMs;

const footage = resolve(repo, 'demo-footage');
for (const f of readdirSync(footage).filter((f) => f.endsWith('.mp4'))) {
  const dst = resolve(out, 'footage', f);
  if (fresh(resolve(footage, f), dst)) copyFileSync(resolve(footage, f), dst);
}
const film3d = resolve(root, '../render/final/preview.mp4');
if (existsSync(film3d) && fresh(film3d, resolve(out, 'film3d.mp4'))) copyFileSync(film3d, resolve(out, 'film3d.mp4'));
if (!existsSync(resolve(out, 'captures.json'))) writeFileSync(resolve(out, 'captures.json'), JSON.stringify({ scenes: {} }, null, 2));
console.log(`public/contra: ${readdirSync(resolve(out, 'footage')).length} clips, film3d ${existsSync(resolve(out, 'film3d.mp4')) ? 'ok' : 'MISSING'}, music ${existsSync(resolve(out, 'music.wav')) ? 'ok' : 'not yet (scripts/contra-music.mjs)'}`);
