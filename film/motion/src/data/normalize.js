// normalize.js — turns film/scenes.json into the Film object the layer and the scripts share. Plain JS so node reads
// it too (scripts/stills.mjs). Frames become 0-based here: Blender frame 1 = t 0 s = Remotion frame 0. A missing key
// throws with its name, so a schema drift surfaces at load, never as a silently misplaced title.

const need = (v, key) => {
  if (v === undefined || v === null) throw new Error(`scenes.json: missing "${key}" — see film/motion/README.md § Contract`);
  return v;
};
const pick = (o, ...keys) => {
  for (const k of keys) if (o[k] !== undefined) return o[k];
  return undefined;
};

export function normalizeFilm(raw, source = 'scenes.json') {
  const base = typeof raw.frame_base === 'number' ? raw.frame_base : 1;
  const f = (v, key) => need(v, key) - base;
  const pair = (v, key) => {
    const a = need(v, key);
    return [a[0] - base, a[1] - base];
  };
  const fps = need(raw.fps, 'fps');
  const bpm = need(raw.bpm, 'bpm');
  const fpb = raw.fpb ?? Math.round((fps * 60) / bpm);

  const rawScenes = need(pick(raw, 'scenes', 'shots'), 'scenes');
  const entries = Array.isArray(rawScenes) ? rawScenes : Object.entries(rawScenes).map(([id, s]) => ({ id, ...s }));
  const scenes = entries
    .map((o, i) => {
      const id = String(o.id ?? o.key ?? `S${i + 1}`);
      const range = o.frames ?? [o.start, o.end];
      return { id, n: Number(o.n ?? i + 1), name: String(o.name ?? id), start: f(range[0], `${id}.start`), end: f(range[1], `${id}.end`) };
    })
    .sort((a, b) => a.start - b.start);

  const ev = need(raw.events, 'events');
  const kf = need(pick(ev, 'keys_flat', 'keysFlat'), 'events.keys_flat');
  const events = {
    explode: need(ev.explode, 'events.explode').map((v) => v - base),
    fan: pair(ev.fan, 'events.fan'),
    boneUp: pair(pick(ev, 'bone_up', 'boneUp'), 'events.bone_up'),
    press: f(ev.press, 'events.press'),
    latch: pair(pick(ev, 'latch', 'led'), 'events.latch'), // the press's latch (the accent rim since variant A; `led` in older exports)
    keysFlat: Object.fromEntries(Object.entries(kf).map(([k, v]) => [k, v - base])),
    flatLen: need(pick(ev, 'flat_len', 'flatLen'), 'events.flat_len'),
    wipe: pair(ev.wipe, 'events.wipe'),
    capSlide: pair(pick(ev, 'cap_slide', 'capSlide'), 'events.cap_slide'),
    faderFlat: pair(pick(ev, 'fader_flat', 'faderFlat'), 'events.fader_flat'),
    displayOn: pair(pick(ev, 'display_on', 'displayOn'), 'events.display_on'),
    displayFlat: pair(pick(ev, 'display_flat', 'displayFlat'), 'events.display_flat'),
    dockFlat: pair(pick(ev, 'dock_flat', 'dockFlat'), 'events.dock_flat'),
    morph: f(ev.morph, 'events.morph'),
    tabHops: pick(ev, 'tab_hops', 'tabHops')?.map((v) => v - base),
  };

  const sk = need(raw.seek, 'seek');
  const seek = {
    from: need(sk.from, 'seek.from'),
    fill: need(sk.fill, 'seek.fill'),
    end: sk.end ?? sk.fill,
    timeDur: String(need(pick(sk, 'time_dur', 'timeDur'), 'seek.time_dur')),
  };

  const last = scenes[scenes.length - 1];
  const frames = raw.frames ?? last.end + 1;
  return {
    fps,
    bpm,
    fpb,
    frames,
    hardCut: f(pick(raw, 'hard_cut', 'hardCut'), 'hard_cut'),
    filmSeconds: pick(raw, 'film_s', 'filmSeconds') ?? frames / fps,
    scenes,
    events,
    seek,
    source,
    raw,
  };
}

export const sceneById = (film, id) => need(film.scenes.find((s) => s.id === id), `scene ${id}`);
export const sceneAt = (film, frame) => film.scenes.find((s) => frame >= s.start && frame <= s.end);
/** 0-based frame of beat k (beats come from time, never from sums). */
export const beatFrame = (film, k) => Math.round(k * film.fpb);

export const formatClock = (seconds) => {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
export const formatTimecode = (frame, fps) => {
  const s = Math.floor(frame / fps);
  const ff = frame - s * fps;
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}:${String(ff).padStart(2, '0')}`;
};
