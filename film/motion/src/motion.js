// motion.js — every motion value of the film's Remotion layer lives here (01-MOTION §4b: one motion.js, no inline
// values anywhere else). Timing of *when* things happen comes from ../scenes.json; this file only says *how* they move.
// Every helper is a pure function of time: no state, no randomness.

export const FPS = 30; // the real fps comes from scenes.json; this is the default for msToFrames

/** Cubic-bezier control points (easings.net names). Enter with out-*, exit with in-* (shorter), traverse with in-out-*. */
export const EASE = {
  outExpo: [0.16, 1, 0.3, 1], // text / logo reveals
  outQuint: [0.22, 1, 0.36, 1], // premium entrances, the skin's own ease
  outCubic: [0.33, 1, 0.68, 1], // UI feedback
  inOutCubic: [0.65, 0, 0.35, 1], // traversals
  inOutQuart: [0.76, 0, 0.24, 1], // camera-like moves, the band
  inOutSine: [0.37, 0, 0.63, 1], // ambient
  inExpo: [0.7, 0, 0.84, 0], // fast exits
  linear: [0, 0, 1, 1], // progress bars, playheads, rotation only
};

/** Durations in milliseconds. */
export const MS = {
  feedback: 150, // UI feedback 100–200
  uiMove: 300, // UI moves 200–500
  reveal: 700, // hero reveals 600–900
  wordStagger: 90, // hook words
  calloutStagger: 60, // exploded callouts (the hold is ~1 s: 60 ms apart, 2 glyphs a frame, visible until 8 f before the reunion)
  calloutCharsPerFrame: 2,
  calloutExitLead: 8, // frames before the parts rejoin (explode[3]) when every callout leaves together
  chipStagger: 120, // fan chips
  leader: 250, // callout leader line draw (ease-out-quint)
  fill: 300, // outline → filled word
  band: 500, // the double band's single pass (ease-in-out-quart)
  exit: 200, // callouts out, all at once (ease-in-expo)
  pressDown: 70, // the skin's press curve
  pressBack: 200,
  rulerDraw: 400,
  rulerSpan: 300, // the time ruler shows 0–300 ms
  chipReveal: 300,
  smallRow: 400,
  titleLead: 300, // a title lands ≤ 300 ms after its scene starts (01-MOTION §4)
  endKeyBeats: [0, 1, 2], // end-card keys press on these beats of the card: 25.0 / 25.5 / 26.0 s (END starts at 25.0), with the music's last three hits; the card then holds in silence to 27.5 s
  wordBeat: 300, // hold between the outline landing and its fill
  calloutLead: 1000 / 6, // 5 frames before the exploded hold (f101): cap and display cross on f91–100 in the final framing
  cursorPeriod: 500, // code cursor: 2 blinks/s (WCAG: max 3)
  opacityRampFrames: 8, // smoothstep on the first 8 frames of any opacity change
};

/** Springs as damping ratio ζ + natural frequency (Hz). ≥ 1 no bounce · 0.7–0.85 premium. Opacity never springs. */
export const SPRING = {
  ui: { zeta: 0.8, hz: 3.0 },
  press: { zeta: 1.0, hz: 7.0 }, // critically damped: the key returns without wobble
};

/** Secondary motion runs 50–70 % of the hero's distance and starts 100–200 ms later (01-MOTION §4b). */
export const HIERARCHY = { secondaryDistance: 0.6, secondaryLagMs: 150, ambientDistance: 0.04 };

/** Stroke of outlined display words (the showcase's .out). */
export const OUTLINE_STROKE_PX = 1.5;

export const msToFrames = (ms, fps = FPS) => Math.round((ms / 1000) * fps);
export const framesToMs = (f, fps = FPS) => (f / fps) * 1000;
export const STAGGER_FRAMES = {
  word: msToFrames(MS.wordStagger),
  callout: msToFrames(MS.calloutStagger),
  chip: msToFrames(MS.chipStagger),
};

export const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
export const lerp = (a, b, u) => a + (b - a) * u;
export const smoothstep = (e0, e1, x) => {
  const u = clamp01((x - e0) / (e1 - e0));
  return u * u * (3 - 2 * u);
};

/** Cubic bezier y(x) for control points (p1x, p1y, p2x, p2y); Newton + bisection, as browsers do. */
export function cubicBezier([p1x, p1y, p2x, p2y]) {
  const cx = 3 * p1x;
  const bx = 3 * (p2x - p1x) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * p1y;
  const by = 3 * (p2y - p1y) - cy;
  const ay = 1 - cy - by;
  const sampleX = (t) => ((ax * t + bx) * t + cx) * t;
  const sampleY = (t) => ((ay * t + by) * t + cy) * t;
  const slopeX = (t) => (3 * ax * t + 2 * bx) * t + cx;
  return (x) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 8; i++) {
      const dx = sampleX(t) - x;
      if (Math.abs(dx) < 1e-6) return sampleY(t);
      const d = slopeX(t);
      if (Math.abs(d) < 1e-6) break;
      t -= dx / d;
    }
    let lo = 0;
    let hi = 1;
    t = x;
    while (hi - lo > 1e-6) {
      const dx = sampleX(t) - x;
      if (Math.abs(dx) < 1e-6) break;
      if (dx > 0) hi = t;
      else lo = t;
      t = (lo + hi) / 2;
    }
    return sampleY(t);
  };
}
const bezierCache = {};
export const ease = (name, u) => {
  if (!bezierCache[name]) bezierCache[name] = cubicBezier(EASE[name]);
  return bezierCache[name](clamp01(u));
};

/** Progress 0..1 of a move that starts at t0 (seconds) and lasts `ms`, with the named ease. Pure in t. */
export const ramp = (t, t0, ms, name = 'outQuint') => ease(name, (t - t0) / (ms / 1000));

/** Linear 0..1 progress (playheads, typing). */
export const linear = (t, t0, ms) => clamp01((t - t0) / (ms / 1000));

/**
 * Closed-form unit step response of a damped spring: 0 → 1 starting at t = 0 (seconds). zeta = damping ratio,
 * hz = natural frequency. Under-, critically- and over-damped branches. No state: value(t) only.
 */
export function spring(t, { zeta, hz }) {
  if (t <= 0) return 0;
  const w = 2 * Math.PI * hz;
  if (zeta < 1) {
    const wd = w * Math.sqrt(1 - zeta * zeta);
    const e = Math.exp(-zeta * w * t);
    return 1 - e * (Math.cos(wd * t) + (zeta / Math.sqrt(1 - zeta * zeta)) * Math.sin(wd * t));
  }
  if (zeta === 1) {
    const e = Math.exp(-w * t);
    return 1 - e * (1 + w * t);
  }
  const s = Math.sqrt(zeta * zeta - 1);
  const r1 = -w * (zeta - s);
  const r2 = -w * (zeta + s);
  return 1 - (r2 * Math.exp(r1 * t) - r1 * Math.exp(r2 * t)) / (r2 - r1);
}

/** Multi-target spring in closed form: value(t) = initial + Σ Δtarget · spring(t − tchange). keys: [{t, value}] sorted. */
export function springTrack(t, initial, keys, cfg) {
  let v = initial;
  let prev = initial;
  for (const k of keys) {
    if (t >= k.t) v += (k.value - prev) * spring(t - k.t, cfg);
    prev = k.value;
  }
  return v;
}

/** The skin's press curve as a 0..1 depth: 70 ms down (ease-out-cubic), 200 ms back (ease-out-quint). */
export function pressDepth(t, tPress) {
  const dt = (t - tPress) * 1000;
  if (dt < 0) return 0;
  if (dt < MS.pressDown) return ease('outCubic', dt / MS.pressDown);
  return 1 - ease('outQuint', (dt - MS.pressDown) / MS.pressBack);
}

/** Letters shown of `text` when one letter lands per frame from t0. */
export const lettersShown = (t, t0, text, fps = FPS) => {
  const n = Math.floor((t - t0) * fps + 1e-6) + 1;
  return n < 0 ? 0 : Math.min(text.length, n);
};

/** Typed prefix when only visible glyphs cost a frame (spaces / newlines land together with the next glyph); `perFrame` glyphs land each frame. */
export function typedPrefix(t, t0, text, fps = FPS, perFrame = 1) {
  const budget = (Math.floor((t - t0) * fps + 1e-6) + 1) * perFrame;
  if (budget <= 0) return '';
  let shown = 0;
  let i = 0;
  while (i < text.length && shown < budget) {
    if (!/\s/.test(text[i])) shown++;
    i++;
  }
  return text.slice(0, i);
}
export const visibleGlyphs = (text) => text.replace(/\s/g, '').length;
/** Frames a label needs to type at `perFrame` glyphs a frame. */
export const typingFrames = (text, perFrame = 1) => Math.ceil(visibleGlyphs(text) / perFrame);

/** Cursor state for a blink of `periodMs` (on for the first half). ≤ 3 flashes/s when periodMs ≥ 334. */
export const blinkOn = (t, t0, periodMs = MS.cursorPeriod) => ((t - t0) * 1000) % periodMs < periodMs / 2;

/** Opacity for an element that enters at tIn and exits at tOut: smoothstep over the first 8 frames of each change. */
export function opacity(t, tIn, tOut = Infinity, fps = FPS) {
  const r = MS.opacityRampFrames / fps;
  const a = smoothstep(tIn, tIn + r, t);
  const b = 1 - smoothstep(tOut, tOut + r, t);
  return Math.min(a, b);
}

/** Relative luminance and WCAG contrast (sRGB hex). Used to choose chip text colours and by the contrast script. */
export function luminance(hex) {
  const c = hex.replace('#', '');
  const ch = (i) => {
    const v = parseInt(c.slice(i, i + 2), 16) / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * ch(0) + 0.7152 * ch(2) + 0.0722 * ch(4);
}
export const contrastOfLuminance = (la, lb) => (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
export const contrast = (hexA, hexB) => contrastOfLuminance(luminance(hexA), luminance(hexB));
