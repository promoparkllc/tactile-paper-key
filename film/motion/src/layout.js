// layout.js — the STAGE: colours, type and px positions of every element (1920 × 1080, 64 px margin). Plain JS so the
// node scripts (stills, contrast) read the same values the compositions render. Positions that depend on the 3D camera
// come from anchors (anchors_s2.json and the optional anchors_s3/s5/s6 exports); the FALLBACK_* constants below are
// measured on the 26 s check frames and are used only when an export is missing — the stills report flags that.

export const W = 1920;
export const H = 1080;
export const MARGIN = 64;

/** Colours from the live page (tactile-paper-key.vercel.app) and the skin. */
export const COLOR = {
  cream: '#F3E7D2',      // text on dark frames (the page's --text)
  ink: '#1E1D1D',        // text on light frames (the page's --ink / --bg)
  accent: '#D9531E',     // --media-accent-color; at most once per frame
  amber: '#FFA31A',      // the double band, top
  amberDeep: '#FF6A00',  // the double band, bottom
  muted: '#BFB39E',
  bone: '#E7E4DE',       // end card field (composited by the 3D side)
  keyFace: '#F3F0EB',
  keyShade: '#C2BBB1',
  ring: '#2A2724',
  glazes: { graphite: '#0E0E0E', stone: '#A8A49D', bone: '#F3F0EB', orange: '#D9531E', yellow: '#E4C94A' },
};

export const FONT = {
  display: 'Michroma',          // display, uppercase, tracking −0.03em, line-height 0.98 (the page's .disp)
  sans: 'Instrument Sans',      // rare: the end card's small row
  mono: 'Geist Mono',           // labels, dimensions, code, timecode
};

/** Type sizes in px. */
export const TYPE = {
  hook: 112,
  flattenTitle: 72,
  endTitle: 72,          // the player's END state puts its 112 × 64 replay key in the centre: the card's text stays left, right edge ≤ 38 % of the width
  endSmall: 24,
  callout: 24,           // ≥ 22 at 1080p: the player is ~1100 px wide on the page (×0.57)
  fanLine: 20,
  chip: 18,
  rulerLabel: 22,
  code: 26,
  codeLineHeight: 1.6,
  timecode: 24,          // fader ends, ≥ 22
  hudLabel: 16,
  tab: 28,
};

/** Frame tone per scene id → text colour. Measured on each still by scripts/contrast.mjs. */
export const TONE = { S1: 'dark', S2: 'light', S3: 'dark', S4: 'light', S5: 'light', S6: 'light', S7: 'dark', S8: 'dark', END: 'light' };
/**
 * Within S8 the live player's clip (snow) fades in over the dark field on f677–687 (Blender numbers): the frame turns
 * light mid-fade. From Blender f685 (0-based 684) ink beats cream at the Tab chip (3.7 vs 3.5:1); measured on the
 * capture frames, see stills/film_27_5s_sync.md.
 */
export const TONE_SWITCH = { S8: { frame0: 684, to: 'light' } };
/**
 * The HUD label's own tone, measured on its box (top-left, 200 × 28 px at 60, 60) on every frame of the finished
 * background (render + live capture) by scripts/hud-check.mjs: cream on the dark frames, ink on the light ones, each
 * switch on the first frame where the other colour reads better (the 3D dissolves at the starts of S2 and S4, the
 * S2 → S3 cut, S7's fade to black, the live clip's fade-in). 0-based frames; frames before the first entry take it.
 */
export const HUD_TONE_RUNS = [[0, 'dark'], [65, 'light'], [174, 'dark'], [280, 'light'], [573, 'dark'], [683, 'light']];
/** @param {number} frame 0-based film frame */
export const hudColor = (frame) => {
  let tone = HUD_TONE_RUNS[0][1];
  for (const [from, to] of HUD_TONE_RUNS) if (frame >= from) tone = to;
  return tone === 'dark' ? COLOR.cream : COLOR.ink;
};
/** @param {string} sceneId @param {number | null} [frame] 0-based film frame; without it the scene's base tone */
export const textColor = (sceneId, frame = null) => {
  const sw = TONE_SWITCH[sceneId];
  const tone = sw && frame !== null && frame >= sw.frame0 ? sw.to : TONE[sceneId];
  return tone === 'dark' ? COLOR.cream : COLOR.ink;
};

/** HUD names (upper-case in Michroma). Index = scene n. */
export const HUD_NAMES = { S1: 'HOOK', S2: 'EXPLODED', S3: 'GLAZE', S4: 'PRESS', S5: 'FLATTEN', S6: 'FADER', S7: 'DISPLAY', S8: 'HAND-OFF', END: 'END' };

export const STAGE = {
  hook: { x: MARGIN, baseline: 330 },                           // top-left: the rim's glow crosses the storyboard's mid-left (baseline 540) from f20 on; measured 6.4:1 here over the whole hook
  band: { width: 192 },                                         // two 96 px columns, full height
  callout: {
    // label offset from the anchor (dx, dy); the leader runs anchor → label start
    // final framing (S2 raking view, commit 673019b): display and cap sit on one vertical ~81 px apart and both
    // anchors are the pieces' right tips, so both labels read to the right (a leader to the left would cross the
    // piece), display up, cap down, 140 px apart; body reads left on the empty field; ring and travel read to the
    // right of the key, travel's leader clearing the rim by ~18 px. Labels ≥ 24 px apart, leaders never cross.
    offsets: { key_ring: [120, -120], key_travel: [230, -110], cap: [120, 30], display: [120, -20], body: [-110, -40] },
    dot: 4,                                                     // anchor ring Ø
  },
  fanLine: { y: 290 },                                          // "--media-accent-color", centred, above the fan
  chips: { dy: 150, height: 36, padX: 14, radius: 18 },         // hex chip under each cap
  ruler: { x: 660, y: 900, width: 600, tickPitch: 4, minorH: 24, majorH: 32, markH: 40, labelGap: 14, marksMs: [70, 200] },
  flattenTitle: { right: W - MARGIN, y: 156, arrowLen: 72, gap: 28 }, // right-aligned on the flat side, revealed by the wipe (the 3D side keeps the window bars: ink measures 2.5–4.1:1 there)
  grid: { pitchPx: 12.8, inkAlpha: 0.1 },                       // 8 px grid at ×1.6; overridden by scenes.json px_per_mm_s5 × 8
  code: { x: 1120, y: 720 },                                    // below the dock on the flat field (8.9:1 measured); at y 300 it straddled the dock edge; at y 760 the closing brace reached y 957, inside the page dock's 140 px band
  // S6: current time rides above the cap (anchors_s6 `cap` = cap top centre; the cap's top edge is 56–94 px above
  // it, so the text's bottom sits 128 px above → ≥ 34 px clear); duration 32 px right of `groove_end`
  fader: { capRise: 128, endGap: 32, edgeMargin: 100, minRun: 8 },
  tab: { right: MARGIN, top: MARGIN, padX: 18, height: 52, radius: 8 },
  // the scene label, top-left at the margin on every scene, level with the Tab chip: on the page the player's dock
  // covers the bottom 140 px of the frame (at 1920), so nothing of the HUD sits there; no timecode (the player shows
  // the time)
  hud: { x: MARGIN, top: MARGIN },
  // keys: dock proportions (44 px key in the skin, drawn at 64 px here), their own row 40 px under the small row's baseline
  // (measured 583), on the block's left edge. On the small row's baseline itself a 64 px key would cut into
  // PAPER KEY (its baseline is only 60 px above).
  end: { x: MARGIN, titleBaseline: 520, lineGap: 24, smallRowGap: 40, keys: { top: 624, size: 64, gap: 16 } },
};

/** Fan caps (S3) screen positions, FALLBACK measured on render/check/f0241.png (26 s timing, 960 × 540 → ×2). */
export const FALLBACK_FAN = {
  order: ['yellow', 'stone', 'orange', 'graphite', 'bone'],   // appearance order; bone last (it rises last)
  pos: { graphite: [40, 470], yellow: [270, 510], stone: [620, 500], orange: [1020, 500], bone: [1440, 380] },
};

/** Wipe edge (S5) FALLBACK: screen x at the top and bottom of the frame as a function of wipe progress 0..1. */
export const FALLBACK_WIPE = { xTop: [W + 24, -24], xBottom: [W + 24 - 0.14 * W, -24 - 0.14 * W] }; // slant 52 % → 38 % as SF5

// the real key (src/styles/themes/tactile.css, dock size B): --tactile-key-size 44px, --tactile-outline 1.25px solid --tactile-edge (= --tactile-ink #2a2724 on bone), border-radius 50%
export const CODE_TEXT = '.key {\n  inline-size: 44px;\n  border: 1.25px solid #2A2724;\n  border-radius: 50%;\n}';
export const HOOK_WORDS = ['EVERY', 'CONTROL'];
export const FLATTEN_WORDS = ['OBJECT', 'INTERFACE'];
export const END_TITLE = ['TACTILE', 'PAPER KEY'];
export const END_SMALL = 'A Video.js v10 skin · promopark.studio';
export const FAN_LINE = '--media-accent-color';
export const TAB_LABEL = 'TAB';

/** Approximate glyph advance as a fraction of the font size, for the contrast script's sampling boxes. */
export const ADVANCE = { [FONT.display]: 0.92, [FONT.mono]: 0.6, [FONT.sans]: 0.52 };
export const px = (v) => Math.round(v); // text holds on whole pixels
