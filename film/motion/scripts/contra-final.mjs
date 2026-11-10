// contra-final.mjs — the Contra presentation video, both formats: each composition rendered by Remotion as a PNG
// sequence (the captures and the manifest come from public/contra/), then encoded like the film (scripts/final.mjs):
// H.264 yuv420p, BT.709 limited, tagged, with the 45 s music cut (public/contra/music.wav) as stereo AAC. Then
// ffprobe and a 2 fps contact sheet per format.
//
//   node scripts/contra-final.mjs [--only Contra16x9|Contra4x5] [--reuse-frames]
//
// Output: out/contra/final/tactile_contra_16x9.mp4, tactile_contra_4x5.mp4, ffprobe_<format>.txt;
// stills/contra/final_contact_<format>.jpg.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : def;
};
const { FPS, FRAMES, SCENES } = await import(pathToFileURL(resolve(root, 'src/contra/config.js')).href);
const run = (cmd, a, capture = false) => execFileSync(cmd, a, { stdio: ['ignore', capture ? 'pipe' : 'inherit', 'inherit'], cwd: root, maxBuffer: 1 << 26 });
const remotionCli = resolve(root, 'node_modules/@remotion/cli/remotion-cli.js');
const outDir = resolve(root, 'out/contra/final');
const music = resolve(root, 'public/contra/music.wav');
mkdirSync(outDir, { recursive: true });

// every captured scene must be in the manifest with all its frames, or the video would ship a placeholder
const manifest = JSON.parse(readFileSync(resolve(root, 'public/contra/captures.json'), 'utf8'));
const missing = SCENES.filter((s) => s.capture).filter((s) => {
  const m = manifest.scenes?.[s.id];
  const dir = resolve(root, 'public/contra/capture', s.id);
  return !m || m.frames !== (s.end - s.start) * FPS || !existsSync(dir) || readdirSync(dir).filter((f) => f.endsWith('.png')).length !== m.frames;
});
if (missing.length) {
  console.error(`captures missing or incomplete: ${missing.map((s) => s.id).join(', ')}`);
  process.exit(1);
}
if (!existsSync(music)) {
  console.error('public/contra/music.wav is missing (scripts/contra-music.mjs)');
  process.exit(1);
}
run(process.execPath, [resolve(here, 'contra-sync.mjs')]);

const formats = [
  { comp: 'Contra16x9', tag: '16x9', width: 1920, height: 1080 },
  { comp: 'Contra4x5', tag: '4x5', width: 1080, height: 1350 },
].filter((f) => !args.includes('--only') || f.comp === opt('--only', ''));

for (const { comp, tag, width, height } of formats) {
  const seq = resolve(outDir, `frames_${tag}`);
  const have = existsSync(seq) ? readdirSync(seq).filter((f) => f.endsWith('.png')).length : 0;
  if (!(args.includes('--reuse-frames') && have === FRAMES)) {
    rmSync(seq, { recursive: true, force: true });
    mkdirSync(seq, { recursive: true });
    console.log(`rendering ${comp} (${FRAMES} frames, ${width} × ${height})…`);
    run(process.execPath, [remotionCli, 'render', 'src/index.ts', comp, seq, '--sequence', '--image-format', 'png', '--concurrency', '8', '--log', 'error']);
  }
  const files = readdirSync(seq).filter((f) => f.endsWith('.png')).sort();
  if (files.length !== FRAMES) {
    console.error(`${comp}: ${files.length} frames, expected ${FRAMES}`);
    process.exit(1);
  }
  const m = files[0].match(/^(.*?)(\d+)\.png$/);
  const mp4 = resolve(outDir, `tactile_contra_${tag}.mp4`);
  console.log(`encoding ${mp4}…`);
  run('ffmpeg', [
    '-v', 'error', '-y',
    '-framerate', String(FPS), '-start_number', String(Number(m[2])), '-i', resolve(seq, `${m[1]}%0${m[2].length}d.png`),
    '-i', music,
    '-filter_complex',
    `[0:v]format=rgb24,scale=in_range=full:out_range=limited:out_color_matrix=bt709:flags=accurate_rnd+full_chroma_int,format=yuv420p,setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709:range=tv[v]`,
    '-map', '[v]', '-map', '1:a', '-t', String(FRAMES / FPS),
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-profile:v', 'high', '-level', '4.2', '-g', String(FPS * 2),
    '-x264-params', 'colorprim=bt709:transfer=bt709:colormatrix=bt709:range=tv',
    '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-color_range', 'tv',
    '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2',
    '-r', String(FPS), '-movflags', '+faststart', mp4,
  ]);
  const probe = String(run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration,size,bit_rate:stream=index,codec_name,codec_type,width,height,pix_fmt,color_range,color_space,color_primaries,color_transfer,r_frame_rate,nb_frames,sample_rate,channels', '-of', 'default=noprint_wrappers=1', mp4], true));
  writeFileSync(resolve(outDir, `ffprobe_${tag}.txt`), probe);
  console.log(probe);
  const cols = tag === '16x9' ? 6 : 9;
  const n = (FRAMES / FPS) * 2;
  const contact = resolve(root, `stills/contra/final_contact_${tag}.jpg`);
  run('ffmpeg', ['-v', 'error', '-y', '-i', mp4, '-vf', `fps=2,scale=${tag === '16x9' ? 480 : 300}:-1,tile=${cols}x${Math.ceil(n / cols)}:padding=2:margin=2:color=black`, '-frames:v', '1', '-q:v', '3', contact]);
  console.log(`wrote ${mp4}\nwrote ${contact}`);
}
