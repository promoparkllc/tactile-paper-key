// contra-music.mjs — the 45 s music cut for the Contra video: "Punchy Staccato" locked to 120 BPM (atempo, pitch
// kept), cut from an offset on the stretched timeline so the beats sit on the video's grid (frame 1 = a downbeat),
// one linear gain to −14 LUFS (music alone) with the true peak ≤ −1 dBTP, written as public/contra/music.wav.
//
//   node scripts/contra-music.mjs [--music ../audio/music/Punchy Staccato.mp3] [--bpm 121.02] [--offset 92.13] [--seconds 45] [--stop <s>]
//
// Default offset 92.13 s (stretched) = 91.36 s of the original, a downbeat of the beat fit 109.204 + 0.4958·k (k = −36):
// the track's groove re-enters at 2.7 s, its break falls at 31.4–35.5 s and its last hit lands on 43.0 s (end card
// beat), after which the tail dies by ~44 s. Reports the cut in public/contra/music.json.
import * as childProcess from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : def;
};
const music = resolve(root, opt('--music', '../audio/music/Punchy Staccato.mp3'));
const bpm = Number(opt('--bpm', '121.02'));
const offset = Number(opt('--offset', '92.13'));
const seconds = Number(opt('--seconds', '45'));
const stop = args.includes('--stop') ? Number(opt('--stop', '0')) : null;
const TARGET_I = -14;
const CEIL = -1;
const outDir = resolve(root, 'public/contra');
mkdirSync(outDir, { recursive: true });
if (!existsSync(music)) {
  console.error(`music missing: ${music}`);
  process.exit(3);
}
const run = (a) => childProcess.spawnSync('ffmpeg', a, { encoding: 'utf8', maxBuffer: 1 << 26 });
const lastJson = (text) => {
  const from = text.slice(text.lastIndexOf('{'));
  return JSON.parse(from.slice(0, from.indexOf('}') + 1));
};
const tempo = Math.abs(bpm - 120) > 0.01 ? `atempo=${(120 / bpm).toFixed(5)},` : '';
const tail = stop !== null ? `afade=t=out:st=${(stop - 0.025).toFixed(3)}:d=0.025,volume=enable='gte(t,${stop})':volume=0` : `afade=t=out:st=${seconds - 0.5}:d=0.5`;
const cut = `${tempo}atrim=start=${offset}:end=${offset + seconds},asetpts=PTS-STARTPTS,aformat=sample_rates=48000:channel_layouts=stereo,${tail}`;

const p1 = run(['-i', music, '-af', `${cut},loudnorm=I=${TARGET_I}:TP=${CEIL}:LRA=11:print_format=json`, '-f', 'null', '-']);
const m = lastJson(p1.stderr);
let gain = TARGET_I - Number(m.input_i);
let mode = 'linear';
let limiter = '';
if (Number(m.input_tp) + gain > CEIL) {
  mode = `linear + true-peak limiter (${(Number(m.input_tp) + gain - CEIL).toFixed(1)} dB caught)`;
  limiter = `,alimiter=limit=${Math.pow(10, (CEIL - 0.6) / 20).toFixed(4)}:attack=2:release=80:level=0`;
}
const wav = resolve(outDir, 'music.wav');
const p2 = run(['-y', '-i', music, '-af', `${cut},volume=${gain.toFixed(2)}dB${limiter}`, '-c:a', 'pcm_s24le', wav]);
if (p2.status !== 0) throw new Error(p2.stderr.slice(-600));
const meas = run(['-i', wav, '-af', 'ebur128=peak=true', '-f', 'null', '-']).stderr;
const summary = meas.slice(meas.lastIndexOf('Summary:'));
const g = (re) => Number((summary.match(re) ?? [])[1]);
const result = {
  file: music, bpm, atempo: tempo ? +(120 / bpm).toFixed(5) : 1, offsetStretched: offset, offsetOriginal: +(offset * (tempo ? 120 / bpm : 1)).toFixed(3), seconds, stop,
  gainDb: +gain.toFixed(2), mode, measured: { integratedLufs: g(/I:\s+(-?[\d.]+) LUFS/), lra: g(/LRA:\s+(-?[\d.]+) LU/), truePeakDbtp: g(/Peak:\s+(-?[\d.]+) dBFS/) },
};
writeFileSync(resolve(outDir, 'music.json'), JSON.stringify(result, null, 2));
console.log(`music.wav: ${seconds} s from ${offset} s (stretched; ${result.offsetOriginal} s original) · ${result.measured.integratedLufs} LUFS · TP ${result.measured.truePeakDbtp} dBTP · ${mode}`);
