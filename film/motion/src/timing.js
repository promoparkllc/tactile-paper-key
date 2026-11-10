// timing.js — *when* each element of the layer happens, derived only from the Film object (scenes.json) and the
// durations in motion.js. Shared by the components and by scripts/stills.mjs, so a still is cut at the frame the
// layer itself considers the key moment. All times in seconds, frames 0-based.

import { sceneById } from './data/normalize.js';
import { CODE_TEXT, END_TITLE, FALLBACK_WIPE, FLATTEN_WORDS, HOOK_WORDS, MARGIN, STAGE, W } from './layout.js';
import { MS, STAGGER_FRAMES, lerp, ramp, typingFrames, visibleGlyphs } from './motion.js';

export const hookTiming = (film) => {
  const s1 = sceneById(film, 'S1');
  const t0 = s1.start / film.fps + MS.titleLead / 1000;
  const w1 = t0;
  const w2 = t0 + MS.wordStagger / 1000;
  const w2Landed = w2 + (HOOK_WORDS[1].length - 1) / film.fps;
  const fillStart = w2Landed + MS.wordBeat / 1000;
  return { s1, t0, w1, w2, w2Landed, fillStart, fillEnd: fillStart + MS.fill / 1000 };
};

export const bandStart = (film) => sceneById(film, 'S2').start / film.fps - MS.band / 2000;
/** x of the band's leading (right) edge at t; −∞ before it starts. */
export const bandLeadingEdge = (t, film, width) => {
  const t0 = bandStart(film);
  if (t < t0) return -Infinity;
  return lerp(0, W + width, ramp(t, t0, MS.band, 'inOutQuart'));
};

export const CALLOUT_ORDER = ['key_ring', 'key_travel', 'cap', 'display', 'body'];
export const calloutTiming = (film, labels = {}) => {
  const hold = film.events.explode[1] / film.fps;
  const start = hold - MS.calloutLead / 1000;
  // all leave together 8 frames before the parts rejoin (explode[3]); a callout whose anchor leaves the frame earlier
  // goes earlier (calloutExit)
  const exit = (film.events.explode[3] - MS.calloutExitLead) / film.fps;
  const stagger = STAGGER_FRAMES.callout / film.fps;
  const complete = CALLOUT_ORDER.map((k, i) => start + i * stagger + MS.leader / 1000 + (typingFrames(labels[k] ?? '', MS.calloutCharsPerFrame) - 1) / film.fps);
  return { start, exit, stagger, allComplete: Math.max(...complete) };
};

/** Exit time of one callout: the common exit, or 6 frames before its anchor leaves the frame, whichever is first. */
export const calloutExit = (film, anchorsS2, key, frame0, exit) => {
  const last = Math.round(exit * film.fps);
  for (let f = frame0; f <= last; f++) {
    const a = anchorsS2.frames?.[String(f + 1)]?.[key];
    if (!a || !a.visible || a.x < 0 || a.x > W || a.y < 0 || a.y > 1080) return Math.min(exit, (f - 6) / film.fps);
  }
  return exit;
};

export const fanTiming = (film) => ({
  line: film.events.fan[0] / film.fps,
  chips: film.events.fan[1] / film.fps,
  bone: film.events.boneUp[1] / film.fps,
  exit: (sceneById(film, 'S3').end - 14) / film.fps, // the lights fade to black over the last 14 f
});

export const rulerTiming = (film) => {
  const s4 = sceneById(film, 'S4');
  return { s4, draw: s4.start / film.fps + MS.titleLead / 1000, press: film.events.press / film.fps, exit: (s4.end - 8) / film.fps };
};

export const flattenTiming = (film) => {
  const s5 = sceneById(film, 'S5');
  const fps = film.fps;
  const wipe0 = film.events.wipe[0] / fps;
  const wipe1 = film.events.wipe[1] / fps;
  // the whole title lives on the flat side and is revealed by the wipe (the hero of the shot); letters land from
  // the wipe's start so the words also build when seen unclipped, INTERFACE fills when the wipe completes
  const object = wipe0;
  const objectLanded = object + (FLATTEN_WORDS[0].length - 1) / fps;
  const arrow = objectLanded + MS.wordStagger / 1000;
  const iface = arrow + MS.leader / 1000;
  return { s5, object, arrow, iface, fill: wipe1, wipe0, wipe1, code: wipe0, exit: (s5.end - 8) / fps };
};

/** Wipe front when the 3D side has not exported wipe_edge.json: the Blender key (quart in-out) with SF5's slant. */
export const wipeFallback = (film, t) => {
  const { wipe0, wipe1 } = flattenTiming(film);
  const p = ramp(t, wipe0, (wipe1 - wipe0) * 1000, 'inOutQuart');
  return { xTop: lerp(FALLBACK_WIPE.xTop[0], FALLBACK_WIPE.xTop[1], p), xBottom: lerp(FALLBACK_WIPE.xBottom[0], FALLBACK_WIPE.xBottom[1], p) };
};

export const faderTiming = (film) => {
  const s6 = sceneById(film, 'S6');
  return { s6, enter: s6.start / film.fps + MS.titleLead / 1000, exit: (s6.end - 8) / film.fps };
};

/**
 * Frames (0-based) of the longest run inside S6 where the fader cap anchor is on frame with its label inside the
 * side margins: the current time shows only during that run (the 3 frames before the camera leaves the cap at the
 * slide's start are too short a run). Null without anchors_s6.
 */
export const capRun = (film, anchorsS6) => {
  if (!anchorsS6?.frames) return null;
  const s6 = sceneById(film, 'S6');
  const F = STAGE.fader;
  let best = null;
  let cur = null;
  for (let f = s6.start; f <= s6.end + 1; f++) {
    const a = f <= s6.end ? anchorsS6.frames[String(f + 1)]?.cap : null;
    const ok = !!a && a.visible && a.x >= F.edgeMargin && a.x <= W - F.edgeMargin && a.y - F.capRise > MARGIN;
    if (ok) cur = cur ? { ...cur, last: f } : { first: f, last: f };
    else if (cur) {
      if (cur.last - cur.first + 1 >= F.minRun && (!best || cur.last - cur.first > best.last - best.first)) best = cur;
      cur = null;
    }
  }
  return best;
};

export const tabHops = (film) => {
  if (film.events.tabHops?.length) return film.events.tabHops;
  const s8 = sceneById(film, 'S8');
  const hops = [];
  for (let k = 0; ; k++) {
    const f = film.hardCut + Math.round((k + 0.5) * film.fpb);
    if (f > s8.end - 8) break;
    hops.push(f);
  }
  return hops;
};

export const endTiming = (film) => {
  const end = sceneById(film, 'END');
  const fps = film.fps;
  const w1 = end.start / fps + MS.titleLead / 1000;
  const w2 = w1 + (END_TITLE[0].length - 1) / fps + MS.wordStagger / 1000;
  const w2Landed = w2 + (END_TITLE[1].length - 1) / fps;
  const small = w2Landed + MS.wordBeat / 1000;
  const keys = MS.endKeyBeats.map((k) => (end.start + k * film.fpb) / fps);
  return { end, w1, w2, w2Landed, small, keys };
};

/**
 * M1 key frames (0-based), each the moment the brief names, derived from the same timing the layer renders:
 * hook — word 2 complete as an outline, before its fill · exploded — every callout drawn and typed, inside the hold ·
 * press — both ruler marks lit (0.3 s after the press) · flatten — the wipe at 50 %, code half typed · end — the card
 * complete, 2 frames before the film ends · fader (when anchors_s6 exists) — the middle of the cap's slide while on frame.
 */
export const m1Frames = (film, labels, anchorsS6 = null) => {
  const fps = film.fps;
  const hook = hookTiming(film);
  const call = calloutTiming(film, labels);
  const flat = flattenTiming(film);
  const end = endTiming(film);
  const run = capRun(film, anchorsS6);
  const notes = [];
  let exploded = Math.ceil(call.allComplete * fps) + 1;
  const lastHold = film.events.explode[2] - 1;
  if (exploded > lastHold) {
    notes.push(`exploded: callouts complete at f${exploded + 1} but the hold ends at f${lastHold + 1}; still cut at f${lastHold + 1} (last callout still typing)`);
    exploded = lastHold;
  }
  const flatten = Math.floor((film.events.wipe[0] + film.events.wipe[1]) / 2);
  const glyphsTyped = Math.min(visibleGlyphs(CODE_TEXT), flatten - film.events.wipe[0] + 1);
  notes.push(`flatten: ${glyphsTyped} / ${visibleGlyphs(CODE_TEXT)} code glyphs typed at the wipe midpoint`);
  return {
    frames: {
      hook: Math.round(hook.w2Landed * fps) + 2,
      exploded,
      press: film.events.press + Math.round((MS.rulerSpan / 1000) * fps),
      flatten,
      end: end.end.end - 2,
      ...(run ? { fader: Math.round((Math.max(run.first, film.events.capSlide[0]) + Math.min(run.last, film.events.capSlide[1])) / 2) } : {}),
    },
    notes,
  };
};
