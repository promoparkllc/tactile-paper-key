// config.js — the Contra presentation video: every number the compositions, the stills and the capture script share.
// 45 s on the film's 120 BPM grid (30 fps, 15 frames a beat, bar = 2 s); every scene cut sits on a downbeat.
// Two formats with their own layouts (never a crop): 16:9 1920 × 1080 and 4:5 1080 × 1350.

export const FPS = 30;
export const BPM = 120;
export const FPB = (FPS * 60) / BPM; // 15
export const SECONDS = 45;
export const FRAMES = SECONDS * FPS; // 1350
export const beat = (k) => k * FPB; // frame of beat k (0-based, from time, never summed)

/** Player box the captures are made at (the board's player, CSS px) and the capture scale. */
export const CAPTURE = {
  player: { width: 1200, height: 675, deviceScaleFactor: 1.6 }, // → 1920 × 1080 PNGs, pre-scaled (lanczos) to the box
  mobile: { width: 390, height: 219, deviceScaleFactor: 3 }, // the 390 px player → 1170 × 657
  mainUrl: 'https://tactile-paper-key.vercel.app/',
};

/**
 * Scenes, in seconds of the video (start inclusive, end exclusive). `clip` = demo-footage file (6.05 s, 24 fps);
 * `title` = Michroma words, the one in `accent` outlined then filled; `mono` = the Geist Mono line under the box;
 * `capture` = what the Playwright script records for the box (null = no capture, Remotion draws it);
 * `actions` = the capture script's timeline inside the scene (seconds from the scene start).
 */
export const SCENES = [
  {
    id: 'hook', start: 0, end: 4, name: 'Hook',
    // 0–2 s: the film's own hook (S1, Blender f1–60: the rim on the dark key) under the title; 2–4 s: the flatten
    // wipe (S5, f406–465) with no text; both from the 3D film without the layer
    background: [{ at: 0, fromFrame: 0, seconds: 2 }, { at: 2, fromFrame: 405, seconds: 2 }],
    title: ['A PLAYER', 'YOU CAN PRESS'], accent: 'PRESS', titleUntil: 2, mono: null, capture: null, actions: [],
  },
  {
    id: 'ready', start: 4, end: 10, name: 'Ready → play',
    clip: 'snow_mountain.mp4', title: ['READABLE', 'OVER ANY FRAME'], accent: 'FRAME', mono: 'READY · the dock comes up on play',
    capture: { target: 'isolated', viewport: 'desktop' }, // on the snow clip itself (no scene depends on the hero's film)
    // READY (the big key and the duration, no dock) → the click → the dock comes up; then the pointer rests on the fader
    actions: [{ at: 1.0, do: 'hover', on: '.tactile-center-play' }, { at: 1.5, do: 'click', on: '.tactile-center-play' }, { at: 3.4, do: 'hover', on: '.tactile-seek', x: 0.6 }],
  },
  {
    id: 'captions', start: 10, end: 16, name: 'Captions · rim',
    clip: 'night_street.mp4', title: ['ONE KEY.', 'CAPTIONS ON.'], accent: 'ON.', mono: 'captions · CC · the rim lights up',
    capture: { target: 'isolated', viewport: 'desktop' },
    captions: 'Readable over any frame.', // the clip's one cue (a line of the film's own captions)
    actions: [{ at: 0.0, do: 'play' }, { at: 1.0, do: 'hover', on: '.tactile-key-cc' }, { at: 2.0, do: 'click', on: '.tactile-key-cc' }, { at: 3.5, do: 'hover', on: 'video' }],
  },
  {
    id: 'seek', start: 16, end: 22, name: 'Seek preview',
    clip: 'flower_market.mp4', title: ['FIND', 'THE MOMENT'], accent: 'MOMENT', mono: 'hover the fader · drag the cap · preview',
    capture: { target: 'isolated', viewport: 'desktop' },
    storyboard: true, // a thumbnails track cut from the clip, as Mux serves one
    // hover ahead of the cap (the preview), then take the cap where it is at 2 s (0.33 of the 6.05 s clip) and drag it
    actions: [{ at: 0.0, do: 'play' }, { at: 0.8, do: 'hover', on: '.tactile-seek', x: 0.56 }, { at: 2.0, do: 'drag', on: '.tactile-seek', from: 0.335, to: 0.5, seconds: 1.2 }, { at: 4.2, do: 'hover', on: 'video' }],
  },
  {
    id: 'speed', start: 22, end: 28, name: 'Settings · speed',
    clip: 'podcast_studio.mp4', title: null, accent: null, mono: 'settings · Speed 1.5× · the status pill follows',
    capture: { target: 'isolated', viewport: 'desktop' },
    // Settings → the Speed row → 1.5× (the fourth rate); the menu goes back to its root, the Settings key closes it
    actions: [
      { at: 0.0, do: 'play' }, { at: 0.6, do: 'hover', on: '.tactile-dock .tactile-key-settings' }, { at: 1.4, do: 'click', on: '.tactile-dock .tactile-key-settings' },
      { at: 2.0, do: 'hover', on: '#tactile-settings-menu .tactile-row[commandfor="tactile-menu-speed"]' }, { at: 2.4, do: 'click', on: '#tactile-settings-menu .tactile-row[commandfor="tactile-menu-speed"]' },
      { at: 3.0, do: 'hover', on: '#tactile-menu-speed media-menu-radio-item:nth-of-type(4)' }, { at: 3.5, do: 'click', on: '#tactile-menu-speed media-menu-radio-item:nth-of-type(4)' },
      { at: 4.3, do: 'hover', on: '.tactile-dock .tactile-key-settings' }, { at: 4.6, do: 'click', on: '.tactile-dock .tactile-key-settings' }, { at: 5.1, do: 'hover', on: '.tactile-status' },
    ],
  },
  {
    id: 'keyboard', start: 28, end: 34, name: 'Keyboard first',
    clip: 'podcast_studio.mp4', title: ['KEYBOARD', 'FIRST'], accent: 'FIRST', mono: 'Tab · Space · M · C · F',
    capture: { target: 'isolated', viewport: 'desktop' },
    actions: [{ at: 0.0, do: 'play' }, { at: 0.5, do: 'tab' }, { at: 1.5, do: 'tab' }, { at: 2.5, do: 'tab' }, { at: 3.5, do: 'tab' }, { at: 4.5, do: 'key', key: 'm' }],
    kbd: [{ at: 0.5, label: 'TAB' }, { at: 1.5, label: 'TAB' }, { at: 2.5, label: 'TAB' }, { at: 3.5, label: 'TAB' }, { at: 4.5, label: 'M' }],
  },
  {
    id: 'accent', start: 34, end: 40, name: 'One variable',
    clip: 'flower_market.mp4', title: ['ONE VARIABLE', 'ANY GLAZE'], accent: 'GLAZE', mono: '--media-accent-color',
    capture: { target: 'isolated', viewport: 'desktop' }, // the market clip, dock pinned
    swatches: [
      { at: 0.0, hex: '#D9531E', ink: '#160C07', label: 'Burnt orange' },
      { at: 1.5, hex: '#FFA31A', ink: '#1E1D1D', label: 'Amber' },
      { at: 3.0, hex: '#3F6FD8', ink: '#FFFFFF', label: 'Blue' },
      { at: 4.5, hex: '#2A2724', ink: '#F4F1EC', label: 'Ink' },
    ],
    // the dock is pinned (the page's "Pin controls"), so every glaze is seen on it
    actions: [{ at: 0.0, do: 'pin' }, { at: 0.0, do: 'play' }, { at: 1.5, do: 'accent', hex: '#FFA31A', ink: '#1E1D1D' }, { at: 3.0, do: 'accent', hex: '#3F6FD8', ink: '#FFFFFF' }, { at: 4.5, do: 'accent', hex: '#2A2724', ink: '#F4F1EC' }],
  },
  {
    id: 'end', start: 40, end: 45, name: 'Mobile · end card',
    clip: 'flower_market.mp4', title: ['TACTILE', 'PAPER KEY'], accent: 'PAPER KEY', mono: 'A Video.js v10 skin · promopark.studio',
    capture: { target: 'isolated', viewport: 'mobile' },
    actions: [{ at: 0.0, do: 'pin' }, { at: 0.0, do: 'play' }],
  },
];
export const sceneAt = (frame) => SCENES.find((s) => frame >= s.start * FPS && frame < s.end * FPS) ?? SCENES[SCENES.length - 1];

/** Layout per format, px. Type keeps a 64 px safe margin; the player box may come closer to the edge. */
export const LAYOUTS = {
  '16:9': {
    id: '16:9', width: 1920, height: 1080,
    // the player takes 86 % of the width, centred (134 px each side); the 136 px band above it carries the title
    // row, the mono line and the chips on one baseline, nothing touches the box (28 px clear)
    player: { x: 134, y: 136, width: 1651, height: 929 },
    title: { x: 64, baseline: 108, size: 52, lineGap: 0 },
    monoInline: true, // the mono line follows the title on the same baseline
    mono: { x: 64, baseline: 108, size: 22 },
    hook: { x: 64, baseline: 330, size: 104, color: '#F3E7D2' }, // the film's hook placement (top-left); cream measures ≥ 6.7:1 on f1–60
    kbd: { right: 1856, y: 52, size: 56, gap: 12, row: true },
    swatches: { right: 1856, y: 60, size: 40, gap: 12, row: true },
    // the 390 px player is landscape: its box keeps 16:9, scaled like the main box (x1.173)
    end: { phone: { x: 134, y: 334, width: 732, height: 412 }, textX: 962, titleBaseline: 440, titleSize: 96, lineGap: 100, smallBaseline: 604, keys: { y: 644, size: 64, gap: 16 } },
  },
  '4:5': {
    id: '4:5', width: 1080, height: 1350,
    // 90 % of the width, centred (54 px each side); two title rows above, the mono line and the chips below
    player: { x: 54, y: 400, width: 972, height: 547 },
    title: { x: 64, baseline: 180, size: 72, lineGap: 84 },
    monoInline: false,
    mono: { x: 64, baseline: 1024, size: 24 },
    hook: { x: 64, baseline: 340, size: 68, color: '#F3E7D2' }, // cover crop of the S1 frames: cream ≥ 14.7:1 here (≤ 5.2 higher up, near the rim)
    kbd: { right: 1016, y: 1064, size: 56, gap: 12, row: true },
    swatches: { right: 1016, y: 1072, size: 40, gap: 12, row: true },
    end: { phone: { x: 54, y: 120, width: 972, height: 547 }, textX: 64, titleBaseline: 840, titleSize: 88, lineGap: 92, smallBaseline: 996, keys: { y: 1036, size: 64, gap: 16 } },
  },
};

export const PAGE = { bone: '#E7E4DE', ink: '#1E1D1D', cream: '#F3E7D2', accent: '#D9531E', keyFace: '#F3F0EB', ring: '#2A2724', placeholder: '#D8D3CB' };

/** Where the capture script leaves its frames and the manifest Remotion reads. */
export const CAPTURE_DIR = 'contra/capture'; // under public/
export const MANIFEST = 'contra/captures.json';
