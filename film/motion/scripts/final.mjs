// final.mjs — the finished film: the 1080p Remotion layer over the 3D render (render/final/out), with the live
// Playwright capture (out/final/capture, Blender-numbered) replacing the 3D frames of the live window, the same fine
// grain as the stills, encoded H.264 yuv420p BT.709 limited with a silent stereo AAC track. Then ffprobe and a 2 fps
// contact sheet.
//
//   node scripts/final.mjs [--bg ../render/final/out] [--capture out/final/capture] [--layer-only] [--reuse-layer] [--no-capture]
//
// Output: out/final/tactile_from_object_to_interface_1080p.mp4, out/final/ffprobe.txt, stills/final_contact.jpg.
import { execFileSync } from 'node:child_process';
import { existsSync, linkSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
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
const captureDir = resolve(root, opt('--capture', 'out/final/capture'));
const outDir = resolve(root, 'out/final');
const layerDir = resolve(outDir, 'layer');
const seqDir = resolve(outDir, 'bg');
const mp4 = resolve(outDir, 'tactile_from_object_to_interface_1080p.mp4');
const run = (cmd, a, capture = false) => execFileSync(cmd, a, { stdio: ['ignore', capture ? 'pipe' : 'inherit', 'inherit'], cwd: root, maxBuffer: 1 << 26 });
const remotionCli = resolve(root, 'node_modules/@remotion/cli/remotion-cli.js');

const { normalizeFilm, sceneById } = await import(pathToFileURL(resolve(root, 'src/data/normalize.js')).href);
const film = normalizeFilm(JSON.parse(readFileSync(resolve(filmDir, 'scenes.json'), 'utf8')), 'scenes.json');
const s8 = sceneById(film, 'S8');
const live = [film.hardCut + 1, s8.end + 1]; // Blender frame numbers of the live window
mkdirSync(outDir, { recursive: true });

// 1. the layer at 1920 × 1080
if (!(args.includes('--reuse-layer') && existsSync(layerDir) && readdirSync(layerDir).filter((f) => f.endsWith('.png')).length === film.frames)) {
  run(process.execPath, [resolve(here, 'sync-data.mjs')]);
  rmSync(layerDir, { recursive: true, force: true });
  mkdirSync(layerDir, { recursive: true });
  console.log(`rendering the layer at 1920 × 1080 (${film.frames} frames)…`);
  run(process.execPath, [remotionCli, 'render', 'src/index.ts', 'Film', layerDir, '--sequence', '--image-format', 'png', '--concurrency', '8', '--log', 'error']);
}
const layerFiles = readdirSync(layerDir).filter((f) => f.endsWith('.png')).sort();
if (layerFiles.length !== film.frames) {
  console.error(`layer has ${layerFiles.length} frames, expected ${film.frames}`);
  process.exit(1);
}
if (args.includes('--layer-only')) {
  console.log(`layer ready → ${layerDir}`);
  process.exit(0);
}
const m = layerFiles[0].match(/^(.*?)(\d+)\.png$/);
const layerPattern = `${m[1]}%0${m[2].length}d.png`;
const layerStart = Number(m[2]);

// 2. the background sequence: 3D frames, the capture over the live window
rmSync(seqDir, { recursive: true, force: true });
mkdirSync(seqDir, { recursive: true });
const missing = [];
let fromCapture = 0;
for (let n = 1; n <= film.frames; n++) {
  const name = `${String(n).padStart(4, '0')}.png`;
  let src = resolve(bgDir, name);
  if (!args.includes('--no-capture') && n >= live[0] && n <= live[1]) {
    const cap = resolve(captureDir, name);
    if (existsSync(cap)) {
      src = cap;
      fromCapture++;
    } else missing.push(`capture ${name}`);
  }
  if (!existsSync(src)) {
    missing.push(name);
    continue;
  }
  linkSync(src, resolve(seqDir, name));
}
if (missing.length) {
  console.error(`missing frames: ${missing.slice(0, 10).join(', ')}${missing.length > 10 ? ` … (${missing.length})` : ''}`);
  process.exit(1);
}
console.log(`background: ${film.frames} frames, ${fromCapture} from the live capture (f${live[0]}–${live[1]})`);

// 3. composite + grain → H.264 yuv420p BT.709 limited + silent AAC
console.log('compositing + encoding…');
run('ffmpeg', [
  '-v', 'error', '-y',
  '-framerate', String(film.fps), '-start_number', '1', '-i', resolve(seqDir, '%04d.png'),
  '-framerate', String(film.fps), '-start_number', String(layerStart), '-i', resolve(layerDir, layerPattern),
  '-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=48000',
  '-filter_complex',
  `[0:v]scale=1920:1080:flags=lanczos,format=rgb24[bg];[bg][1:v]overlay=format=auto:shortest=1,format=rgb24,noise=alls=5:allf=t+u,scale=in_range=full:out_range=limited:out_color_matrix=bt709:flags=accurate_rnd+full_chroma_int,format=yuv420p,setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709:range=tv[v]`,
  '-map', '[v]', '-map', '2:a', '-shortest',
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-profile:v', 'high', '-level', '4.1', '-g', String(film.fps * 2),
  '-x264-params', 'colorprim=bt709:transfer=bt709:colormatrix=bt709:range=tv',
  '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-color_range', 'tv',
  '-c:a', 'aac', '-b:a', '128k', '-ar', '48000',
  '-r', String(film.fps), '-movflags', '+faststart', mp4,
]);

// 4. ffprobe + contact sheet
const probe = String(run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration,size,bit_rate:stream=index,codec_name,codec_type,width,height,pix_fmt,color_range,color_space,color_primaries,color_transfer,r_frame_rate,nb_frames,sample_rate,channels', '-of', 'default=noprint_wrappers=1', mp4], true));
writeFileSync(resolve(outDir, 'ffprobe.txt'), probe);
console.log(probe);
const contact = resolve(root, 'stills/final_contact.jpg');
const cols = 6;
const n = Math.ceil(film.frames / film.fps) * 2;
run('ffmpeg', ['-v', 'error', '-y', '-i', mp4, '-vf', `fps=2,scale=480:-1,tile=${cols}x${Math.ceil(n / cols)}:padding=2:margin=2:color=black`, '-frames:v', '1', '-q:v', '3', contact]);
console.log(`wrote ${mp4}\nwrote ${resolve(outDir, 'ffprobe.txt')}\nwrote ${contact}`);
