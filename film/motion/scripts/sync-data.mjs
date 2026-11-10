// sync-data.mjs — copies the 3D side's exports into public/data so Remotion can fetch them. Reads film/, never
// writes there. MOTION_SCENES=<path> points the layer at another scenes file (the dev fixture); the stills script
// refuses to run on anything but ../scenes.json.
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const film = resolve(root, '..');
const out = resolve(root, 'public/data');
mkdirSync(out, { recursive: true });

const scenesPath = process.env.MOTION_SCENES ? resolve(root, process.env.MOTION_SCENES) : resolve(film, 'scenes.json');
if (!existsSync(scenesPath)) {
  console.error(`sync: ${scenesPath} does not exist. The 3D session exports film/scenes.json from the 26 s retiming;`);
  console.error('      for development only: MOTION_SCENES=fixtures/scenes.dev.json npm run sync');
  process.exit(2);
}
copyFileSync(scenesPath, resolve(out, 'scenes.json'));
const fixture = scenesPath !== resolve(film, 'scenes.json');
writeFileSync(resolve(out, '_source.json'), JSON.stringify({ scenes: scenesPath, fixture, synced: new Date().toISOString() }, null, 2));
console.log(`sync: scenes.json ← ${scenesPath}${fixture ? '  (DEV FIXTURE)' : ''}`);

const required = ['anchors_s2.json'];
const optional = ['anchors_s3.json', 'anchors_s6.json', 'wipe_edge.json'];
for (const name of required) {
  const p = resolve(film, name);
  if (!existsSync(p)) {
    console.error(`sync: required ${p} missing`);
    process.exit(2);
  }
  copyFileSync(p, resolve(out, name));
  console.log(`sync: ${name} ← film/`);
}
for (const name of optional) {
  const p = resolve(film, name);
  if (existsSync(p)) {
    copyFileSync(p, resolve(out, name));
    console.log(`sync: ${name} ← film/`);
  } else {
    console.log(`sync: ${name} not exported yet → layout fallback`);
  }
}
