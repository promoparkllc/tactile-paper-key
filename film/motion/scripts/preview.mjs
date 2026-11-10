// preview.mjs — the whole Remotion layer rendered as a transparent PNG sequence and composited over the 3D render
// (default: the final render), with the same grain as the stills, into an h264 preview plus a 2 fps contact sheet.
//
//   node scripts/preview.mjs [--bg ../render/final/out] [--height 720] [--out out/preview]
//
// Output: <out>/layer_over_final_<height>p.mp4, stills/preview_contact.jpg (every 0.5 s, 6 × 9 tiles). The layer
// frames stay in <out>/layer (gitignored). Not for the final composite: that one runs at 1080p from the same layer.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const filmDir = resolve(root, '..');
const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : def;
};
const bgDir = resolve(root, opt('--bg', '../render/final/out'));
const height = Number(opt('--height', '720'));
const width = Math.round((height * 16) / 9);
const outDir = resolve(root, opt('--out', 'out/preview'));
const layerDir = resolve(outDir, 'layer');
const run = (cmd, a) => execFileSync(cmd, a, { stdio: ['ignore', 'inherit', 'inherit'], cwd: root });
const remotionCli = resolve(root, 'node_modules/@remotion/cli/remotion-cli.js');

const scenesPath = resolve(filmDir, 'scenes.json');
if (!existsSync(scenesPath)) {
  console.error(`preview blocked: ${scenesPath} does not exist.`);
  process.exit(3);
}
const { normalizeFilm } = await import(pathToFileURL(resolve(root, 'src/data/normalize.js')).href);
const film = normalizeFilm(JSON.parse((await import('node:fs')).readFileSync(scenesPath, 'utf8')), scenesPath);

const bgFiles = existsSync(bgDir) ? readdirSync(bgDir).filter((f) => /^\d{4}\.png$/.test(f)).sort() : [];
if (bgFiles.length < film.frames) {
  console.error(`preview blocked: ${bgDir} holds ${bgFiles.length} frames, the film has ${film.frames}.`);
  process.exit(3);
}

// 1. data + layer
run(process.execPath, [resolve(here, 'sync-data.mjs')]);
rmSync(layerDir, { recursive: true, force: true });
mkdirSync(layerDir, { recursive: true });
console.log(`rendering the layer at ${width} × ${height} (${film.frames} frames)…`);
run(process.execPath, [remotionCli, 'render', 'src/index.ts', 'Film', layerDir, '--sequence', '--image-format', 'png', '--scale', String(height / 1080), '--concurrency', '8', '--log', 'error']);
const layerFiles = readdirSync(layerDir).filter((f) => f.endsWith('.png')).sort();
if (layerFiles.length !== film.frames) {
  console.error(`layer render produced ${layerFiles.length} frames, expected ${film.frames}`);
  process.exit(1);
}
const m = layerFiles[0].match(/^(.*?)(\d+)\.png$/);
const layerPattern = `${m[1]}%0${m[2].length}d.png`;
const layerStart = Number(m[2]);

// 2. composite (lanczos scale of the render, overlay, fine uniform grain changing every frame) → h264
const mp4 = resolve(outDir, `layer_over_final_${height}p.mp4`);
console.log('compositing…');
run('ffmpeg', [
  '-v', 'error', '-y',
  '-framerate', String(film.fps), '-start_number', '1', '-i', resolve(bgDir, '%04d.png'),
  '-framerate', String(film.fps), '-start_number', String(layerStart), '-i', resolve(layerDir, layerPattern),
  '-filter_complex', `[0:v]scale=${width}:${height}:flags=lanczos,format=rgb24[bg];[bg][1:v]overlay=format=auto:shortest=1,format=rgb24,noise=alls=5:allf=t+u,format=yuv420p`,
  '-c:v', 'libx264', '-crf', '18', '-preset', 'slow', '-movflags', '+faststart', mp4,
]);

// 3. contact sheet, 2 fps
mkdirSync(resolve(root, 'stills'), { recursive: true });
const contact = resolve(root, 'stills/preview_contact.jpg');
const cols = 6;
const n = Math.ceil(film.frames / film.fps) * 2;
const rows = Math.ceil(n / cols);
run('ffmpeg', ['-v', 'error', '-y', '-i', mp4, '-vf', `fps=2,scale=480:-1,tile=${cols}x${rows}:padding=2:margin=2:color=black`, '-frames:v', '1', '-q:v', '3', contact]);
console.log(`wrote ${mp4}\nwrote ${contact} (${n} frames at 2 fps, ${cols} × ${rows})`);
