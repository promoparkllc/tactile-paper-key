// live-source.mjs — the media the live player plays during the capture: the 3D preview (so the frame at the hard cut
// is the 3D frame) with a bright demo clip fading in over the video area across 12 frames from the hard cut (the cut
// frame itself stays the 3D frame, the dock never moves), then the clip to the end. The dock reads the film's own
// time and length because the file is as long as the film.
//
//   node scripts/live-source.mjs [--clip ../../demo-footage/snow_mountain.mp4] [--preview ../render/final/preview.mp4] [--fade 12]
//
// Output: out/final/src/live_<clip>_<film>.mp4 → pass it to capture.mjs as --src.
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : def;
};
const clip = resolve(root, opt('--clip', '../../demo-footage/snow_mountain.mp4'));
const preview = resolve(root, opt('--preview', '../render/final/preview.mp4'));
const fadeFrames = Number(opt('--fade', '12'));
const { normalizeFilm } = await import(pathToFileURL(resolve(root, 'src/data/normalize.js')).href);
const film = normalizeFilm(JSON.parse(readFileSync(resolve(root, '../scenes.json'), 'utf8')), 'scenes.json');
const dur = film.frames / film.fps;
const cutT = film.hardCut / film.fps; // the first live frame starts here; its own time stays the 3D frame (fade = 0)
const outDir = resolve(root, 'out/final/src');
mkdirSync(outDir, { recursive: true });
const out = resolve(outDir, `live_${basename(clip, '.mp4')}_${String(dur).replace('.', '_')}s.mp4`);
const graph =
  `[1:v]fps=${film.fps},scale=1920:1080,format=yuva420p,tpad=start_duration=${cutT}:color=black@0,` +
  `fade=t=in:st=${cutT}:d=${fadeFrames / film.fps}:alpha=1,trim=duration=${dur},setpts=PTS-STARTPTS[c];` +
  `[0:v]fps=${film.fps},trim=duration=${dur},setpts=PTS-STARTPTS[b];[b][c]overlay=format=auto:shortest=1,format=yuv420p[v]`;
execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', preview, '-i', clip, '-filter_complex', graph, '-map', '[v]', '-an', '-c:v', 'libx264', '-crf', '16', '-preset', 'fast', '-movflags', '+faststart', out], { stdio: 'inherit' });
console.log(`wrote ${out} (${dur} s; the clip fades in over frames ${film.hardCut + 2}–${film.hardCut + fadeFrames}, Blender numbers; frame ${film.hardCut + 1} is the 3D frame)`);
