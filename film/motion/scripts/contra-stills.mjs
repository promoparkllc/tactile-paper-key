// contra-stills.mjs — key-frame stills of the Contra compositions: hook (1.5 s), seek scene (19.5 s), end card (44 s)
// by default, in 16:9 (and 4:5 with --both), plus a contact sheet. Output: stills/contra/.
//   node scripts/contra-stills.mjs [--frames 45,585,1320] [--both]
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : def;
};
const frames = opt('--frames', '45,585,1320').split(',').map(Number);
const names = { 45: 'hook', 78: 'wipe', 585: 'seek', 1320: 'end' };
const contactName = args.includes('--frames') ? `contact_${frames.map((f) => names[f] ?? 'f' + f).join('_')}.jpg` : 'contact.jpg';
const comps = args.includes('--both') ? ['Contra16x9', 'Contra4x5'] : ['Contra16x9'];
const out = resolve(root, 'stills/contra');
mkdirSync(out, { recursive: true });
const run = (cmd, a) => execFileSync(cmd, a, { stdio: ['ignore', 'inherit', 'inherit'], cwd: root });
const cli = resolve(root, 'node_modules/@remotion/cli/remotion-cli.js');
run(process.execPath, [resolve(here, 'contra-sync.mjs')]);
const made = [];
for (const comp of comps) {
  for (const f of frames) {
    const file = resolve(out, `${comp}_${names[f] ?? 'f' + f}_f${String(f).padStart(4, '0')}.png`);
    run(process.execPath, [cli, 'still', 'src/index.ts', comp, file, `--frame=${f}`, '--image-format=png', '--log=error']);
    made.push(file);
  }
}
const n = made.length;
const cols = Math.min(3, n);
const filter = `${made.map((_, i) => `[${i}]scale=640:-1[s${i}]`).join(';')};${made.map((_, i) => `[s${i}]`).join('')}xstack=inputs=${n}:layout=${made.map((_, i) => `${(i % cols) * 640}_${Math.floor(i / cols) * 800}`).join('|')}:fill=black`;
run('ffmpeg', ['-v', 'error', '-y', ...made.flatMap((p) => ['-i', p]), '-filter_complex', filter, '-frames:v', '1', resolve(out, contactName)]);
console.log(`wrote ${n} stills + ${contactName} → ${out}`);
