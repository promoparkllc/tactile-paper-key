// mix.mjs — the film's sound: SFX from sfx/ placed on frames derived from ../scenes.json (variants a/b/c alternate on
// repeats, each hit aligned by its detected onset), room tone under everything, the Suno music from music/ cut to the
// 26 s on the 120 BPM grid (optional, see --music), the whole mix normalised to −16 LUFS integrated / −1 dBTP
// (loudnorm, two passes, linear when the peak allows), muxed onto the final video with the video copied.
//
//   node film/audio/mix.mjs [--video ../motion/out/final/tactile_from_object_to_interface_1080p.mp4]
//                           [--music music/<file>] [--music-offset <s, the downbeat in the track that lands on f1>]
//                           [--music-lufs -21] [--out ../motion/out/final] [--limit-sfx] [--no-limiter]
//                           [--music-only] [--target-lufs -16] [--name final_music_only.mp4] [--music-tempo-bpm 120] [--music-stop <film s>]
//
// --music-only: no SFX, no room tone: the same music cut alone, normalised to -14 LUFS (the 01-MOTION rule for music
// on its own; --target-lufs overrides) / -1 dBTP -> <out>/final_music_only.mp4, report_music_only.md.
//
// Output: <out>/final_sfx_only.mp4 and, with music, <out>/final_music_sfx.mp4; stems and loudness JSON in
// film/audio/out/; film/audio/cues.json (the cue sheet) and film/audio/report.md (measured loudness + ffprobe).
// Needs only node ≥ 18 and ffmpeg/ffprobe on PATH.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const filmDir = resolve(here, '..');
const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : def;
};
/** A path as the reports print it: relative to the repo root, forward slashes. */
const repoRel = (p) => relative(resolve(here, '../..'), p).split('\\').join('/');
const videoPath = resolve(here, opt('--video', '../motion/out/final/tactile_from_object_to_interface_1080p.mp4'));
const outDir = resolve(here, opt('--out', '../motion/out/final'));
const workDir = resolve(here, 'out');
const sfxDir = resolve(here, 'sfx');
const musicDir = resolve(here, 'music');
const musicArg = opt('--music', null);
const musicPath = musicArg ? resolve(here, musicArg) : existsSync(musicDir) ? readdirSync(musicDir).filter((f) => /\.(wav|mp3|flac|m4a|aiff?)$/i.test(f)).map((f) => resolve(musicDir, f))[0] ?? null : null;
const musicOffset = Number(opt('--music-offset', '0'));
const musicLufs = Number(opt('--music-lufs', '-21'));
const musicOnly = args.includes('--music-only');
// a track that does not run at exactly 120 BPM is slowed/sped to 120 before the cut (atempo keeps the pitch);
// --music-offset is then read on the stretched timeline
const musicBpm = Number(opt('--music-tempo-bpm', '120'));
const tempoFilter = Math.abs(musicBpm - 120) > 0.01 ? `atempo=${(120 / musicBpm).toFixed(5)},` : '';
// --music-stop <film s>: the music stops dead there (25 ms fade against the click) instead of fading out over the last 0.5 s
const musicStop = args.includes('--music-stop') ? Number(opt('--music-stop', '0')) : null;
const musicTail = (dur) => (musicStop !== null ? `afade=t=out:st=${(musicStop - 0.025).toFixed(3)}:d=0.025,volume=enable='gte(t,${musicStop})':volume=0` : `afade=t=out:st=${dur - 0.5}:d=0.5`); // the bed's own integrated loudness before the final normalisation
mkdirSync(workDir, { recursive: true });
mkdirSync(outDir, { recursive: true });

const sh = (cmd, a, { capture = true, stderr = false } = {}) => {
  try {
    const out = execFileSync(cmd, a, { stdio: ['ignore', capture ? 'pipe' : 'inherit', 'pipe'], maxBuffer: 1 << 26 });
    return stderr ? '' : String(out);
  } catch (e) {
    if (stderr && e.stderr) return String(e.stderr);
    throw e;
  }
};
import * as childProcess from 'node:child_process';
/** The flat JSON block loudnorm prints at the end of ffmpeg's stderr. */
const lastJson = (text) => {
  const from = text.slice(text.lastIndexOf('{'));
  return JSON.parse(from.slice(0, from.indexOf('}') + 1));
};

// ---- the film grid
const raw = JSON.parse(readFileSync(resolve(filmDir, 'scenes.json'), 'utf8'));
const fps = raw.fps;
const fpb = raw.fpb ?? Math.round((fps * 60) / raw.bpm);
const base = typeof raw.frame_base === 'number' ? raw.frame_base : 1;
const frames = raw.frames;
// the film's length comes from the video itself when it exists (the motion side holds the end card past the render)
const probeDur = existsSync(videoPath) ? Number(sh('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', videoPath]).trim()) : NaN;
const DUR = Number.isFinite(probeDur) && probeDur > 0 ? Math.round(probeDur * fps) / fps : frames / fps;
const tOf = (blenderFrame) => (blenderFrame - base) / fps; // frame 1 → t 0
const ev = raw.events;
const scenes = Array.isArray(raw.scenes) ? raw.scenes : Object.entries(raw.scenes).map(([id, s]) => ({ id, ...s }));
const END = scenes.find((s) => s.id === 'END');

// ---- cue sheet (Blender frames). Types map to sfx/<type>_<a|b|c>.mp3; repeats alternate the variants.
const cues = [];
const cue = (type, frame, note, extra = {}) => cues.push({ type, frame, t: +tOf(frame).toFixed(4), note, ...extra });
cue('join_clunk', ev.explode[3], 'parts rejoin (explode[3])');
const fanEnd = ev.fan[1];
['yellow', 'stone', 'orange', 'graphite'].forEach((cap, i) => cue('ceramic_settle', fanEnd + 3 * i, `fan cap ${cap} settles (fan[1] + ${3 * i})`));
cue('ceramic_settle', ev.bone_up[1], 'bone cap up (bone_up[1])');
cue('key_hero', ev.press, 'the press (press)');
for (const [k, f] of Object.entries(ev.keys_flat)) cue('tick_light', f, `key ${k} flat (keys_flat.${k})`);
cue('fader_slide', ev.cap_slide[1], 'cap stop (cap_slide[1]); the slide runs from cap_slide[0]', { from: ev.cap_slide[0] });
cue('display_on', ev.display_on[0], 'display lights (display_on[0])');
for (const f of ev.tab_hops ?? []) cue('tick_light', f, `Tab hop (tab_hops)`);
[0, 1, 2].forEach((k) => cue('key_hero', END.start + k * fpb, `end card beat ${k} (END.start + ${k}·fpb)`));
cues.sort((a, b) => a.frame - b.frame || a.type.localeCompare(b.type));

// ---- levels: sample-peak targets (dBFS) per type before the final normalisation; room tone by RMS
const PEAK_TARGET = { join_clunk: -6, key_hero: -6, ceramic_settle: -12, tick_light: -16, fader_slide: -14, display_on: -18 };
const ROOM_RMS_DBFS = -50;
const PRE_ROLL = 0.03; // seconds of the sample kept before the detected onset

// ---- sample analysis (cached): onset = first 10 ms window within 12 dB of the loudest; sample peak; RMS
const analysisPath = resolve(workDir, 'samples.json');
const analysis = existsSync(analysisPath) ? JSON.parse(readFileSync(analysisPath, 'utf8')) : {};
const analyse = (file) => {
  const key = basename(file);
  if (analysis[key]) return analysis[key];
  const r = childProcess.spawnSync(
    'ffmpeg',
    ['-v', 'error', '-i', file, '-af', 'aformat=channel_layouts=mono,asetnsamples=441,astats=metadata=1:reset=1,ametadata=print:key=lavfi.astats.Overall.RMS_level:file=-', '-f', 'null', '-'],
    { encoding: 'utf8', maxBuffer: 1 << 26 }
  );
  const rms = (r.stdout + r.stderr).split('\n').filter((l) => l.includes('RMS_level=')).map((l) => Number(l.split('RMS_level=')[1]));
  const max = Math.max(...rms.filter(Number.isFinite));
  const onsetIdx = rms.findIndex((v) => v > max - 12);
  const s = childProcess.spawnSync('ffmpeg', ['-i', file, '-af', 'astats=measure_perchannel=none', '-f', 'null', '-'], { encoding: 'utf8', maxBuffer: 1 << 26 });
  const grab = (label) => Number((s.stderr.match(new RegExp(`${label}: (-?[\\d.]+|-inf)`)) ?? [])[1]);
  const dur = Number(sh('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]).trim());
  analysis[key] = { onset: +(onsetIdx * 0.01).toFixed(2), maxRms: +max.toFixed(1), peak: +grab('Peak level dB').toFixed(2), rms: +grab('RMS level dB').toFixed(2), duration: dur };
  writeFileSync(analysisPath, JSON.stringify(analysis, null, 2));
  return analysis[key];
};
const variants = (type) => readdirSync(sfxDir).filter((f) => new RegExp(`^${type}_[a-z]\\.(mp3|wav)$`).test(f)).sort();
const counters = {};
const room = resolve(sfxDir, readdirSync(sfxDir).find((f) => f.startsWith('room_tone')) ?? 'room_tone_loop.mp3');
const roomInfo = analyse(room);

// ---- filter graph
const inputs = ['-stream_loop', '-1', '-i', room];
const chains = [];
const labels = [];
const placed = [];
chains.push(`[0:a]aformat=sample_rates=48000:channel_layouts=stereo,atrim=0:${DUR},asetpts=PTS-STARTPTS,volume=${(ROOM_RMS_DBFS - roomInfo.rms).toFixed(2)}dB,afade=t=in:d=0.5,afade=t=out:st=${DUR - 0.5}:d=0.5[room]`);
labels.push('[room]');
cues.forEach((c, i) => {
  const vs = variants(c.type);
  if (!vs.length) {
    c.file = null;
    c.missing = true;
    return;
  }
  const n = counters[c.type] ?? 0;
  counters[c.type] = n + 1;
  const file = resolve(sfxDir, vs[n % vs.length]);
  const a = analyse(file);
  const gain = PEAK_TARGET[c.type] - a.peak;
  let start;
  let fadeIn = 0.004;
  let end = a.duration;
  if (c.type === 'fader_slide') {
    // the sample's loudest point is the stop: land it on cap_slide[1]; the slide body runs from cap_slide[0]
    start = Math.max(0, a.onset - (tOf(c.frame) - tOf(c.from)));
    fadeIn = 0.04;
    end = Math.min(a.duration, a.onset + 0.3);
  } else if (c.type === 'display_on') {
    start = 0;
  } else {
    start = Math.max(0, a.onset - PRE_ROLL);
  }
  const delay = Math.max(0, tOf(c.frame) - (a.onset - start));
  const idx = inputs.filter((x) => x === '-i').length;
  inputs.push('-i', file);
  const fadeOut = c.type === 'display_on' ? `,afade=t=out:st=${(end - 0.08).toFixed(3)}:d=0.08` : c.type === 'fader_slide' ? `,afade=t=out:st=${(end - start - 0.12).toFixed(3)}:d=0.12` : '';
  chains.push(`[${idx}:a]aformat=sample_rates=48000:channel_layouts=stereo,atrim=start=${start.toFixed(3)}:end=${end.toFixed(3)},asetpts=PTS-STARTPTS,afade=t=in:d=${fadeIn}${fadeOut},volume=${gain.toFixed(2)}dB,adelay=${Math.round(delay * 1000)}|${Math.round(delay * 1000)}[c${i}]`);
  labels.push(`[c${i}]`);
  Object.assign(c, { file: basename(file), onset: a.onset, peak: a.peak, gainDb: +gain.toFixed(2), sampleStart: +start.toFixed(3), placedAt: +(delay + (a.onset - start)).toFixed(4) });
  placed.push(c);
});
chains.push(`${labels.join('')}amix=inputs=${labels.length}:normalize=0:duration=first[sfx]`);
const sfxStem = resolve(workDir, 'sfx_mix.wav');
if (!musicOnly) sh('ffmpeg', ['-v', 'error', '-y', ...inputs, '-filter_complex', chains.join(';'), '-map', '[sfx]', '-c:a', 'pcm_s24le', sfxStem], { capture: false });

// ---- music bed (optional): cut from --music-offset to the film's length, its own loudness set, 0.5 s fade-out
let musicStem = null;
let musicInfo = null;
if (musicPath && existsSync(musicPath)) {
  const m1 = childProcess.spawnSync('ffmpeg', ['-i', musicPath, '-af', `${tempoFilter}atrim=start=${musicOffset}:end=${musicOffset + DUR},asetpts=PTS-STARTPTS,loudnorm=I=${musicLufs}:TP=-3:LRA=11:print_format=json`, '-f', 'null', '-'], { encoding: 'utf8', maxBuffer: 1 << 26 });
  const j = lastJson(m1.stderr);
  musicStem = resolve(workDir, 'music_bed.wav');
  sh('ffmpeg', ['-v', 'error', '-y', '-i', musicPath, '-af', `${tempoFilter}atrim=start=${musicOffset}:end=${musicOffset + DUR},asetpts=PTS-STARTPTS,aformat=sample_rates=48000:channel_layouts=stereo,volume=${(musicLufs - Number(j.input_i)).toFixed(2)}dB,${musicTail(DUR)}`, '-c:a', 'pcm_s24le', musicStem], { capture: false });
  musicInfo = { file: basename(musicPath), offset: musicOffset, tempoBpm: musicBpm, stop: musicStop, measuredI: Number(j.input_i), bedLufs: musicLufs, gainDb: +(musicLufs - Number(j.input_i)).toFixed(2) };
}

// ---- normalise (two-pass loudnorm) and mux
const TARGET_I = Number(opt('--target-lufs', musicOnly ? '-14' : '-16'));
const CEILING_TP = -1;
/**
 * Normalise to −16 LUFS / −1 dBTP without loudnorm's dynamic mode (which lifts the quiet room tone of a sparse SFX
 * track): measure, then one linear gain. If that gain would push the true peak over the ceiling, the gain is applied
 * with a true-peak limiter catching the excess ("linear + limiter"); with --no-limiter the gain stops at the ceiling
 * instead ("linear to ceiling", integrated below target, nothing squashed).
 */
const normalise = (stems, outWav, allowLimiter) => {
  const inp = stems.flatMap((s) => ['-i', s]);
  const sum = stems.length > 1 ? `${stems.map((_, i) => `[${i}:a]`).join('')}amix=inputs=${stems.length}:normalize=0:duration=first[m];[m]` : '[0:a]';
  const p1 = childProcess.spawnSync('ffmpeg', [...inp, '-filter_complex', `${sum}loudnorm=I=${TARGET_I}:TP=${CEILING_TP}:LRA=11:print_format=json[o]`, '-map', '[o]', '-f', 'null', '-'], { encoding: 'utf8', maxBuffer: 1 << 26 });
  const m = lastJson(p1.stderr);
  const I = Number(m.input_i);
  const TP = Number(m.input_tp);
  let gain = TARGET_I - I;
  let mode = 'linear';
  let limiter = '';
  if (TP + gain > CEILING_TP) {
    if (allowLimiter) {
      mode = `linear + true-peak limiter (${(TP + gain - CEILING_TP).toFixed(1)} dB over the ceiling caught)`;
      limiter = `,alimiter=limit=${Math.pow(10, (CEILING_TP - 0.6) / 20).toFixed(4)}:attack=2:release=80:level=0`;
    } else {
      gain = CEILING_TP - TP;
      mode = `linear to the ceiling (${gain.toFixed(1)} dB; the target would need ${(TARGET_I - I).toFixed(1)} dB)`;
    }
  }
  const p2 = childProcess.spawnSync('ffmpeg', ['-y', ...inp, '-filter_complex', `${sum}volume=${gain.toFixed(2)}dB${limiter},aresample=48000[o]`, '-map', '[o]', '-c:a', 'pcm_s24le', outWav], { encoding: 'utf8', maxBuffer: 1 << 26 });
  if (p2.status !== 0) throw new Error(p2.stderr.slice(-800));
  return { pass1: m, gainDb: +gain.toFixed(2), mode };
};
const measure = (file) => {
  const r = childProcess.spawnSync('ffmpeg', ['-i', file, '-af', 'ebur128=peak=true', '-f', 'null', '-'], { encoding: 'utf8', maxBuffer: 1 << 26 });
  const s = r.stderr.slice(r.stderr.lastIndexOf('Summary:'));
  const g = (re) => Number((s.match(re) ?? [])[1]);
  return { integratedLufs: g(/I:\s+(-?[\d.]+) LUFS/), lra: g(/LRA:\s+(-?[\d.]+) LU/), truePeakDbtp: g(/Peak:\s+(-?[\d.]+) dBFS/) };
};
const mux = (wav, out) => sh('ffmpeg', ['-v', 'error', '-y', '-i', videoPath, '-i', wav, '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-shortest', '-movflags', '+faststart', out], { capture: false });
const probe = (file) => sh('ffprobe', ['-v', 'error', '-show_entries', 'format=duration,size,bit_rate:stream=index,codec_name,codec_type,width,height,pix_fmt,color_range,color_space,color_primaries,color_transfer,r_frame_rate,nb_frames,sample_rate,channels,bit_rate', '-of', 'default=noprint_wrappers=1', file]);

const results = {};
if (!existsSync(videoPath)) {
  console.error(`video missing: ${videoPath}`);
  process.exit(3);
}
if (musicOnly) {
  if (!musicStem) {
    console.error('music-only: no music file (film/audio/music/ or --music)');
    process.exit(3);
  }
  const wav = resolve(workDir, 'mix_music_only.wav');
  const ln = normalise([musicStem], wav, !args.includes('--no-limiter'));
  const out = resolve(outDir, opt('--name', 'final_music_only.mp4'));
  mux(wav, out);
  results.music_only = { out, loudnorm: ln, measured: measure(out), ffprobe: probe(out) };
} else {
  const wav = resolve(workDir, 'mix_sfx_only.wav');
  const ln = normalise([sfxStem], wav, args.includes('--limit-sfx'));
  const out = resolve(outDir, 'final_sfx_only.mp4');
  mux(wav, out);
  results.sfx_only = { out, loudnorm: ln, measured: measure(out), ffprobe: probe(out) };
}
if (musicStem && !musicOnly) {
  const wav = resolve(workDir, 'mix_music_sfx.wav');
  const ln = normalise([sfxStem, musicStem], wav, !args.includes('--no-limiter'));
  const out = resolve(outDir, 'final_music_sfx.mp4');
  mux(wav, out);
  results.music_sfx = { out, loudnorm: ln, measured: measure(out), ffprobe: probe(out) };
}

// ---- cue sheet + report
if (!musicOnly) writeFileSync(resolve(here, 'cues.json'), JSON.stringify({ fps, fpb, frames, video: repoRel(videoPath), music: musicInfo, room: { file: basename(room), rmsTargetDbfs: ROOM_RMS_DBFS, gainDb: +(ROOM_RMS_DBFS - roomInfo.rms).toFixed(2) }, peakTargets: PEAK_TARGET, cues }, null, 2));
writeFileSync(resolve(workDir, musicOnly ? 'loudness_music_only.json' : 'loudness.json'), JSON.stringify(results, null, 2));
const fmt = (v, d = 1) => (Number.isFinite(v) ? v.toFixed(d) : '—');
const lines = [];
lines.push(`# Sound${musicOnly ? ' · music only' : ''} · ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`);
lines.push('');
lines.push(`video: ${repoRel(videoPath)}`);
lines.push(`grid: ${fps} fps · ${fpb} f/beat · ${frames} frames = ${DUR} s · frame 1 = t 0`);
lines.push('');
if (musicOnly) lines.push('Decision 2026-11-10: the film carries the music alone, no SFX and no room tone. The SFX cue sheet stays in cues.json / report.md.');
if (!musicOnly) {
  lines.push('## Cue sheet (Blender frames)');
  lines.push('');
  lines.push('| frame | t (s) | type | sample | onset in sample | gain | peak target | note |');
  lines.push('| --- | --- | --- | --- | --- | --- | --- | --- |');
}
if (!musicOnly) for (const c of cues) lines.push(`| ${c.frame} | ${fmt(c.t, 3)} | ${c.type} | ${c.file ?? '**missing**'} | ${c.onset ?? '—'} s | ${c.gainDb ?? '—'} dB | ${PEAK_TARGET[c.type]} dBFS | ${c.note} |`);
lines.push('');
if (!musicOnly) lines.push(`Room tone: ${basename(room)} over the whole film at RMS ${ROOM_RMS_DBFS} dBFS (gain ${(ROOM_RMS_DBFS - roomInfo.rms).toFixed(1)} dB), 0.5 s fades. Each hit is aligned by its detected onset (first 10 ms window within 12 dB of the sample's loudest), ${PRE_ROLL * 1000} ms of pre-roll kept; the fader slide's loudest point (the stop) lands on cap_slide[1] and the slide body starts at cap_slide[0].`);
lines.push('');
lines.push('## Music');
lines.push('');
lines.push(musicInfo ? `${musicInfo.file}: ${musicInfo.tempoBpm !== 120 ? `stretched from ${musicInfo.tempoBpm} to 120 BPM (atempo ${(120 / musicInfo.tempoBpm).toFixed(5)}, pitch kept), then ` : ''}cut from ${musicInfo.offset} s for ${DUR} s (that point of the ${musicInfo.tempoBpm !== 120 ? 'stretched ' : ''}track lands on frame 1 / beat 1; 120 BPM = ${fpb} frames a beat), measured ${fmt(musicInfo.measuredI)} LUFS, ${musicOnly ? `then normalised on its own to ${TARGET_I} LUFS` : `set to ${musicInfo.bedLufs} LUFS under the SFX (${musicInfo.gainDb} dB)`}, ${musicInfo.stop !== null ? `hard stop at ${musicInfo.stop} s of the film (25 ms fade against the click), silence to the end` : '0.5 s fade-out'}. End-card beats at ${[0, 1, 2].map((k) => fmt(tOf(END.start + k * fpb), 2)).join(' / ')} s.` : `**pending** — no file in film/audio/music/. Put the Suno track there and run \`node film/audio/mix.mjs --music-offset <s>\` with the time in the track of the downbeat that should land on frame 1; the cut then runs ${DUR} s on the ${fpb}-frame beat grid with the three end-card beats at ${[0, 1, 2].map((k) => fmt(tOf(END.start + k * fpb), 2)).join(' / ')} s and a 0.5 s fade-out. The track itself has to carry its three final hits on those beats (choose the offset so a phrase ends there).`);
lines.push('');
lines.push('## Loudness (measured on the muxed files, ebur128)');
lines.push('');
lines.push('| file | integrated | LRA | true peak | gain | input I / TP |');
lines.push('| --- | --- | --- | --- | --- | --- |');
for (const [k, r] of Object.entries(results)) lines.push(`| ${basename(r.out)} | **${fmt(r.measured.integratedLufs)} LUFS** | ${fmt(r.measured.lra)} LU | **${fmt(r.measured.truePeakDbtp)} dBTP** | ${r.loudnorm.mode} | ${r.loudnorm.pass1.input_i} / ${r.loudnorm.pass1.input_tp} |`);
lines.push('');
lines.push(`Target: ${TARGET_I} LUFS integrated, true peak ≤ −1 dBTP. One linear gain per file after measuring (no dynamic loudness riding, which would lift the room tone of a sparse SFX track); the music mix may add a true-peak limiter on the few hits that would cross the ceiling, the SFX-only version stops at the ceiling unless run with --limit-sfx.`);
lines.push('');
lines.push('## ffprobe');
lines.push('');
for (const [k, r] of Object.entries(results)) lines.push(`### ${basename(r.out)}\n\n\`\`\`\n${r.ffprobe.trim()}\n\`\`\`\n`);
writeFileSync(resolve(here, musicOnly ? `report_${opt('--name', 'final_music_only.mp4').replace(/\.mp4$/, '')}.md`.replace('report_final_', 'report_') : 'report.md'), lines.join('\n') + '\n');
console.log(lines.slice(0, 4).join('\n'));
console.log(`\ncues: ${cues.length} (${cues.filter((c) => c.missing).length} missing)`);
for (const [k, r] of Object.entries(results)) console.log(`${k}: ${fmt(r.measured.integratedLufs)} LUFS · LRA ${fmt(r.measured.lra)} · TP ${fmt(r.measured.truePeakDbtp)} dBTP · ${r.loudnorm.mode} → ${r.out}`);
if (!musicStem && !musicOnly) console.log('music: pending (no file in film/audio/music/)');
