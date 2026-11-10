// stills.mjs — M1: the five key-frame stills of the Remotion layer composited over the current 3D preview, plus the
// measured contrast of every text element. Gate: film/scenes.json must exist and describe the 26 s cut; the layer
// is rendered with that file (never the dev fixture) and the frames are the ones timing.js derives from it.
//
//   node scripts/stills.mjs [--bg ../render/preview/out] [--only hook,exploded,press,flatten,fader,end] [--dev]
//
// --dev renders with fixtures/scenes.dev.json into stills/_work/dev (pipeline test only; no deliverable).
// Output: stills/M1_<name>_f<NNNN>.png, stills/M1_contact.jpg, stills/M1_report.md, stills/M1_contrast.json.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
/** A path as the reports print it: relative to the repo root, forward slashes. */
const repoRel = (p) => relative(resolve(root, '../..'), p).split('\\').join('/');
const filmDir = resolve(root, '..');
const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : def;
};
const dev = args.includes('--dev');
const bgDir = resolve(root, opt('--bg', '../render/preview/out'));
const only = opt('--only', 'hook,exploded,press,flatten,fader,end').split(',');
const outDir = dev ? resolve(root, 'stills/_work/dev') : resolve(root, 'stills');
const work = resolve(outDir, '_overlay');
mkdirSync(work, { recursive: true });

const run = (cmd, a) => execFileSync(cmd, a, { stdio: ['ignore', 'pipe', 'pipe'], cwd: root }).toString();
const remotionCli = resolve(root, 'node_modules/@remotion/cli/remotion-cli.js');

// ---- gate
const scenesPath = dev ? resolve(root, 'fixtures/scenes.dev.json') : resolve(filmDir, 'scenes.json');
if (!existsSync(scenesPath)) {
  console.error(`M1 blocked: ${scenesPath} does not exist yet. The 3D session exports it from the 26 s retiming.`);
  process.exit(3);
}
const { normalizeFilm, sceneById } = await import(pathToFileURL(resolve(root, 'src/data/normalize.js')).href);
const { m1Frames } = await import(pathToFileURL(resolve(root, 'src/timing.js')).href);
const { boxesFor } = await import(pathToFileURL(resolve(root, 'src/boxes.js')).href);
const { measureBoxes, readPng, formatTable } = await import(pathToFileURL(resolve(here, 'contrast.mjs')).href);
const { COLOR } = await import(pathToFileURL(resolve(root, 'src/layout.js')).href);

const raw = JSON.parse(readFileSync(scenesPath, 'utf8'));
const film = normalizeFilm(raw, scenesPath);
const seconds = film.frames / film.fps;
if (Math.abs(seconds - 26) > 0.5) {
  console.error(`M1 blocked: scenes.json describes ${seconds.toFixed(2)} s (${film.frames} frames @ ${film.fps}); the 26 s retiming is expected.`);
  process.exit(3);
}
const anchorsS2 = JSON.parse(readFileSync(resolve(filmDir, 'anchors_s2.json'), 'utf8'));
const anchorFrames = Object.keys(anchorsS2.frames).map(Number);
const anchorRange = [Math.min(...anchorFrames) - 1, Math.max(...anchorFrames) - 1];
const s2 = sceneById(film, 'S2');
const warnings = [];
if (anchorRange[0] > s2.start || anchorRange[1] < s2.end) warnings.push(`anchors_s2.json covers frames ${anchorRange[0] + 1}–${anchorRange[1] + 1} (Blender) but S2 is ${s2.start + 1}–${s2.end + 1}: re-run scripts/export_anchors.py after the retiming`);
for (const f of ['anchors_s3.json', 'anchors_s6.json', 'wipe_edge.json']) if (!existsSync(resolve(filmDir, f))) warnings.push(`${f} not exported → layout fallback positions`);

// ---- sync data for the renderer
process.env.MOTION_SCENES = dev ? 'fixtures/scenes.dev.json' : undefined;
if (!dev) delete process.env.MOTION_SCENES;
run(process.execPath, [resolve(here, 'sync-data.mjs')]);

// ---- frames
const anchorsS6Path = resolve(filmDir, 'anchors_s6.json');
const anchorsS6 = existsSync(anchorsS6Path) ? JSON.parse(readFileSync(anchorsS6Path, 'utf8')) : null;
const { frames, notes } = m1Frames(film, anchorsS2.labels, anchorsS6);
if (!frames.fader) warnings.push('fader still skipped: no anchors_s6.json / no on-frame run of the cap');
console.log('M1 frames (0-based → Blender):', Object.fromEntries(Object.entries(frames).map(([k, v]) => [k, `${v} → f${String(v + 1).padStart(4, '0')}`])));
for (const n of notes) console.log('  note:', n);

// ---- background frames
const bgFiles = existsSync(bgDir) ? readdirSync(bgDir).filter((f) => /^\d{4}\.png$/.test(f)).sort() : [];
const lastBg = bgFiles.length ? Number(bgFiles[bgFiles.length - 1].slice(0, 4)) : 0;
const endScene = sceneById(film, 'END');
const bgFor = (frame0) => {
  const blender = frame0 + 1;
  const p = resolve(bgDir, `${String(blender).padStart(4, '0')}.png`);
  if (existsSync(p)) return { kind: 'file', path: p };
  if (frame0 >= endScene.start) return { kind: 'bone' }; // the end field, when the render stops before END
  return { kind: 'missing', path: p };
};
if (!dev && lastBg && lastBg < endScene.start) warnings.push(`background sequence ends at f${lastBg}; the retimed preview should cover 1–${endScene.start} (Blender frames)`);

// ---- render + composite + measure
const report = [];
const json = {};
const made = [];
for (const name of only) {
  const frame = frames[name];
  if (frame === undefined) continue;
  const tag = `M1_${name}_f${String(frame + 1).padStart(4, '0')}`;
  const overlay = resolve(work, `${tag}.overlay.png`);
  const bgScaled = resolve(work, `${tag}.bg.png`);
  const out = resolve(outDir, `${tag}.png`);
  console.log(`\n${tag}: rendering layer…`);
  run(process.execPath, [remotionCli, 'still', 'src/index.ts', 'Film', overlay, `--frame=${frame}`, '--image-format=png', '--log=error']);
  const bg = bgFor(frame);
  if (bg.kind === 'missing') {
    warnings.push(`${tag}: background ${bg.path} missing — rendered over neutral grey`);
  }
  const bgInput = bg.kind === 'file' ? ['-i', bg.path] : ['-f', 'lavfi', '-i', `color=c=${bg.kind === 'bone' ? COLOR.bone : '#808080'}:s=1920x1080:d=1`];
  run('ffmpeg', ['-v', 'error', '-y', ...bgInput, '-frames:v', '1', '-vf', 'scale=1920:1080:flags=lanczos,format=rgb24', bgScaled]);
  // composite + a fine uniform grain over the whole frame (deterministic: seed = frame)
  run('ffmpeg', ['-v', 'error', '-y', '-i', bgScaled, '-i', overlay, '-filter_complex', `[0][1]overlay=format=auto,format=rgb24,noise=all_seed=${frame}:alls=5:allf=u`, '-frames:v', '1', out]);
  const boxes = boxesFor(name, frame, film, anchorsS2, anchorsS6);
  const rows = measureBoxes(readPng(overlay), readPng(bgScaled), boxes);
  json[tag] = { frame0: frame, blender: frame + 1, background: bg.kind === 'file' ? repoRel(bg.path) : bg.kind, rows };
  const fails = rows.filter((r) => !r.pass);
  report.push(`### ${tag} · frame ${frame + 1} (Blender) · t ${(frame / film.fps).toFixed(2)} s · background: ${bg.kind === 'file' ? bg.path.replace(/.*[\\/]/, '') : bg.kind}\n\n${formatTable(rows)}\n\n${fails.length ? `**${fails.length} below 4.5:1** — ${fails.map((f) => f.name).join(', ')}` : 'All text ≥ 4.5:1.'}\n`);
  made.push(out);
  console.log(formatTable(rows));
}

// ---- contact sheet
if (made.length) {
  const inputs = made.flatMap((p) => ['-i', p]);
  const n = made.length;
  const filter = `${made.map((_, i) => `[${i}]scale=640:-1[s${i}]`).join(';')};${made.map((_, i) => `[s${i}]`).join('')}xstack=inputs=${n}:layout=${made.map((_, i) => `${(i % 3) * 640}_${Math.floor(i / 3) * 360}`).join('|')}:fill=black`;
  try {
    run('ffmpeg', ['-v', 'error', '-y', ...inputs, '-filter_complex', filter, '-frames:v', '1', resolve(outDir, 'M1_contact.jpg')]);
  } catch (e) {
    warnings.push(`contact sheet failed: ${String(e.stderr || e.message).slice(0, 200)}`);
  }
}

const head = `# M1 · key-frame stills · ${new Date().toISOString().slice(0, 16).replace('T', ' ')}\n\nscenes: ${repoRel(scenesPath)}${dev ? ' (DEV FIXTURE — pipeline test, not a deliverable)' : ''} · ${film.frames} frames @ ${film.fps} fps = ${seconds} s · ${film.bpm} BPM (${film.fpb} f/beat) · hard cut f${film.hardCut + 1}\nbackground: ${repoRel(bgDir)}\n\nContrast = WCAG ratio of the rendered text colour against the 5th / 95th percentile luminance of the frame behind each element (worst of the two). Typical = against the median.\n\n${warnings.length ? `## Warnings\n\n${warnings.map((w) => `- ${w}`).join('\n')}\n\n` : ''}${notes.length ? `## Frame notes\n\n${notes.map((w) => `- ${w}`).join('\n')}\n\n` : ''}`;
writeFileSync(resolve(outDir, 'M1_report.md'), head + report.join('\n'));
writeFileSync(resolve(outDir, 'M1_contrast.json'), JSON.stringify({ scenes: repoRel(scenesPath), dev, frames, warnings, notes, stills: json }, null, 2));
console.log(`\nwrote ${made.length} stills, M1_report.md, M1_contrast.json${made.length ? ', M1_contact.jpg' : ''} → ${outDir}`);
if (warnings.length) console.log('warnings:\n- ' + warnings.join('\n- '));
