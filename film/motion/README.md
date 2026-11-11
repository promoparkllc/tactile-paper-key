# film/motion — the Remotion layer of "From object to interface"

Titles, callouts, chips, the time ruler, the wipe band and grid, the CSS block, timecodes, the TAB chip, the end card
and the HUD, rendered as a transparent 1920 × 1080 layer and composited over the Blender render. Built in parallel
with the 26 s retiming; this folder is the only place this session writes.

## Rules this layer follows

- One `src/motion.js` holds every motion value: `EASE` (cubic-bezier), `MS` (durations), `SPRING` (ζ, Hz, closed
  form), `STAGGER_FRAMES`, and the pure helpers (`ramp`, `spring`, `pressDepth`, `lettersShown`, `typedPrefix`,
  `blinkOn`, `opacity`). Nothing else carries a duration or an easing.
- Every frame is a pure function of `t`: no CSS transitions, no state, no randomness (the grain is seeded per frame
  at composite time).
- **Timing comes exclusively from `../scenes.json`** (exported by the 3D side from the Blender retiming on the
  120 BPM grid). `src/timing.js` derives every entrance, hold and exit from that file + `MS`; `src/data/normalize.js`
  turns it into the `Film` object and throws on a missing key. When the 3D timing moves, the text moves with it.
- Callouts read `../anchors_s2.json` (per-frame px positions). Optional exports with the same shape:
  `anchors_s3.json` (`<glaze>_center`, `<glaze>_top` for graphite stone bone orange yellow), `anchors_s6.json` (`groove_start groove_end cap`),
  `wipe_edge.json` (`frames[f] = {x_top, x_bottom}`), and `px_per_mm_s5` inside scenes.json for the 8 mm grid.
  Without them `src/layout.js` FALLBACK_* positions are used and the stills report says so.
- Text in hold sits on whole pixels (`px()`); words build one letter per frame (no fade + slide); outlined words carry
  a 1.5 px stroke and fill over 300 ms; opacity never springs and ramps over 8 frames.
- Type: Michroma (display, uppercase, −0.03em), Instrument Sans (end card small row only), Geist Mono (labels, code,
  timecodes). Colours: cream `#F3E7D2` on dark frames, ink `#1E1D1D` on light frames (`TONE` per scene in layout.js),
  accent `#D9531E` on marks and the wipe band, never on text (it measures 2.9:1 on light frames).
- Fonts are local files in `public/fonts` (Google Fonts statics + Geist Mono from `../assets/fonts`); no network.

## Contract: `film/scenes.json`

Frames are Blender frames (1-based, `frame_base: 1`; set `frame_base: 0` if exported 0-based). The layer needs:

```json
{
  "fps": 30, "bpm": 120, "fpb": 15, "size": [1920, 1080], "film_s": 26.0, "frames": 780, "hard_cut": 676,
  "scenes": [ { "id": "S1", "n": 1, "name": "Hook", "start": 1, "end": 60 }, … , { "id": "END", "n": 9, "name": "End", "start": 721, "end": 780 } ],
  "events": {
    "explode": [76, 106, 136, 166], "fan": [186, 226], "bone_up": [226, 241], "press": 301, "led": [305, 309],
    "keys_flat": { "cc": 376, "mute": 391, "settings": 406, "fs": 421, "play": 436 }, "flat_len": 30,
    "wipe": [391, 466], "cap_slide": [481, 526], "fader_flat": [541, 556], "display_on": [586, 592],
    "display_flat": [601, 631], "dock_flat": [653, 661], "morph": 661,
    "tab_hops": [683, 698, 713]
  },
  "seek": { "from": 0.10, "fill": 0.865, "end": 0.923, "time_dur": "0:26" },
  "px_per_mm_s5": 1.6
}
```

Scene ids `S1 … S8, END` (or `scenes` as an object keyed by id; `frames: [start, end]` also accepted). `tab_hops`
and `px_per_mm_s5` are optional. The numbers above are the fixture's (transcribed from `build_scene.py`), not the
export. `fixtures/scenes.dev.json` exists only so the layer can be developed before the export lands; `stills.mjs`
refuses it without `--dev`.

How the layer uses the events: hook title at `S1.start + 300 ms` · band centred on `S2.start` · callouts draw from
`explode[1] − 5 f`, leave at `explode[3] − 8 f` · fan line types from `fan[0]`, chips from `fan[1]`, bone chip at
`bone_up[1]` · ruler draws at `S4.start + 300 ms`, playhead from `press` · OBJECT at `S5.start + 300 ms`, INTERFACE
outline when the first key starts to flatten (`min(keys_flat) − flat_len`), fills at `wipe[1]`; code types from
`wipe[0]` at 2 glyphs a frame (`MS.codeCharsPerFrame`: 67 glyphs complete at f440, before the layer leaves at f457; at 1 a frame the last two lines never showed) · timecodes from `S6.start + 300 ms` · TAB chip from `hard_cut`, presses on `tab_hops` · end card from
`END.start + 300 ms`, keys on `END.start + 1·fpb, 2·fpb, 3·fpb`.

## Placement decisions measured on the retimed preview (2026-11-09)

- Hook title top-left (baseline 330), not the storyboard's mid-left (≈ 540): the rim's glow crosses the mid-left
  from f20 on (cream measures 3.6–4.2:1 there); top-left measures ≥ 6.4:1 over the whole hook.
- Flatten title right-aligned on the flat side and revealed by the wipe; code block below the dock (y 720: its five lines end at y 917, clear of the page dock's bottom 140 px), the real key: `inline-size: 44px` (`--tactile-key-size`), `border: 1.25px solid #2A2724` (`--tactile-outline`, `--tactile-edge`), `border-radius: 50%`. On the
  3D side the window bars stay until the wipe (ink 2.5–4.1:1); on the flat field both measure ≥ 8.9:1.
- `node scripts/probe.mjs <bgDir> <frames> <x> <y> <w> <h> <hex>` measures a candidate box over frames before placing text.
- Sizes for the real viewing size (player ≈ 1100 px wide on the page, ×0.57): callouts 24, ruler labels 22, code 26,
  HUD 16, fader timecodes 24 (all at 1080p; 2026-11-09 review).
- Exploded (S2 raking view, 673019b): all five anchors are on frame during the hold. display and cap share a
  vertical ~81 px apart and both anchors are the pieces' right tips, so both labels read to the right (display up,
  cap down, 140 px apart: a leader to the left would cross the piece); body reads left; ring and travel right of
  the key.
  Callouts enter 5 frames before the hold (`MS.calloutLead`), because the cap and display pieces cross on f91–100;
  60 ms apart, labels typed 2 glyphs a frame, all visible until 8 frames before the parts rejoin (f158), a callout
  whose anchor would leave the frame earlier leaves 6 frames before that (none does on the final anchors).
  S6: the film's current time rides above the fader cap (anchors_s6 `cap`, 128 px above its top-centre anchor,
  following the cap while it slides and holds, shown only during the cap's longest on-frame run and faded 8 frames at
  its ends); the duration sits 32 px right of `groove_end`. `scripts/fader-interval.mjs` measures the labels on
  every frame of that run (box-based, stricter than the stills).
- HUD = the scene label only ("0N / NAME", no timecode: the player shows the time), top-left at the 64 px margin on
  every scene, level with the Tab chip. It used to sit bottom-left, where the page's player dock (the bottom 140 px
  at 1920) covered it. Its colour follows `HUD_TONE_RUNS`, measured on its own box on every frame of the finished
  background by `scripts/hud-check.mjs`: cream on the dark frames, ink on the light ones, each switch on the first
  frame where the other colour reads better (f66, 175, 281, 574, 684 in Blender numbers: the dissolves at the starts
  of S2 and S4, the S2 → S3 cut, S7's fade to black, the live clip's fade-in). The Tab chip's own switch (top-right,
  f685) stays in `TONE_SWITCH`. Known dip: the S5 wipe's shadow crosses the corner on f412–438 (ink 2.3:1; cream
  would pass only on 426–437, so no flip).
- End card: three 64 px keys (dock proportions) on their own row 40 px under the small row's baseline, left edge of
  the block; on the baseline itself a 64 px key would cut into PAPER KEY (60 px above).

## Commands

```
npm install                      # once (Remotion 4.0.537, React 19.3.1, pngjs)
npm run sync                     # copies ../scenes.json + anchors into public/data (MOTION_SCENES=fixtures/scenes.dev.json for the fixture)
npm run studio                   # Remotion Studio on the synced data
npm run typecheck
node scripts/stills.mjs --bg ../render/final/out   # M1: five stills over the final render + contrast report (gate: ../scenes.json, 26 s)
node scripts/preview.mjs [--bg ../render/final/out] [--height 720]   # whole layer over the render → out/preview/*.mp4 + stills/preview_contact.jpg (2 fps)
node scripts/fader-interval.mjs           # S6 labels: ink contrast on every frame of the cap's run → stills/fader_interval.md
node scripts/hud-check.mjs [--bg out/final/bg]   # the scene label on every frame: contrast, measured switch frames, nothing of the layer in the bottom 140 px → stills/hud_check.md
node scripts/capture.mjs [--probe]        # live hand-off: the real skin in Chromium (Playwright) playing the film, one PNG per frame of the live window → out/final/capture
node scripts/final.mjs [--reuse-layer]    # 1080p layer + render + capture → out/final/tactile_from_object_to_interface_1080p.mp4 (H.264 yuv420p BT.709 limited, silent AAC), ffprobe.txt, stills/final_contact.jpg
node scripts/stills.mjs --dev    # same pipeline on the fixture → stills/_work/dev (test only)
node scripts/contrast.mjs <overlay.png> <bg.png> <boxes.json>
```

`stills.mjs` renders each key frame as a transparent PNG, scales the preview frame to 1920 × 1080 (lanczos), composites,
adds a fine uniform grain (`noise`, seed = frame), and measures every text element: WCAG ratio of the rendered text
colour against the 5th and 95th percentile luminance of the frame behind it (worst of the two, plus the median).
Outputs `stills/M1_<name>_f<NNNN>.png`, `M1_contact.jpg`, `M1_report.md`, `M1_contrast.json`.

M1 frames, derived in `timing.js › m1Frames`: hook = word 2 complete as an outline, before the fill · exploded = every
callout typed, inside the hold · press = both marks lit (press + 300 ms) · flatten = wipe midpoint (code about half
typed) · end = card complete, 2 frames before the end.

## Live capture (hand-off)

`capture/index.html` mounts the real skin (`@/video/skin`, `@/skin.css`) on a Video.js v10 HTML player with a plain
`<video>` playing the 3D film (`render/final/preview.mp4`) and the sidecar captions on; Vite serves it with the
repo's config at 1200 × 675 CSS px, Chromium at deviceScaleFactor 1.6 → 1920 × 1080 (the board's player, as the
brief's hand-off frame). Frame-exact and deterministic: the media stays paused and is seeked to the middle of each
film frame of the live window (`hard_cut` … `S8.end`), while `HTMLMediaElement.paused` is made to read false so the
skin shows the playing state (Pause glyph, time display and seek fill from `currentTime`). The media container's
`tabindex` is set to −1 so the first Tab lands on the play key; Tab is pressed on `events.tab_hops` (play → seek cap →
mute). Volume 0.6 to match the 3D stand-in's fader. `--probe` writes screenshots after six Tabs and the focus path.

## Sound (film/audio)

`node film/audio/mix.mjs` places the SFX from `film/audio/sfx/` on frames derived from `scenes.json` (join_clunk on
explode[3]; ceramic_settle on fan[1] + 0/3/6/9 and bone_up[1]; key_hero on press and the three end-card beats;
tick_light on every keys_flat frame and the tab_hops; fader_slide with its stop on cap_slide[1]; display_on on
display_on[0]; room tone under everything), each hit aligned by its detected onset, variants a/b/c alternating; cuts
the music (when a file is in `film/audio/music/`, `--music-offset` = the track's downbeat for frame 1) to the 26 s,
normalises to −16 LUFS / −1 dBTP with one linear gain (plus a true-peak limiter only on the music mix) and muxes onto
the final video with `-c:v copy` → `out/final/final_sfx_only.mp4`, `final_music_sfx.mp4`; report in
`film/audio/report.md`, cue sheet in `film/audio/cues.json`. Decision 2026-11-10: the film ships with the music alone:
`node film/audio/mix.mjs --music-only --music "music/Three Staccato Hits.mp3" --music-offset 56.03` → `final_music_only.mp4`
at −14 LUFS (the 01-MOTION rule for music on its own), `report_music_only.md`. `--music-tempo-bpm` locks a track that
is not at 120 BPM to the grid before the cut (atempo, pitch kept); `--music-stop <film s>` stops the music dead.
v2 (2026-11-10, the current deliverable): `--music "music/Punchy Staccato.mp3" --music-tempo-bpm 121.02
--music-offset 108.133 --music-stop 25.1 --name final_music_only_v2.mp4` → groove from 0 s, break at 16–20 s,
hits on 24.0 / 24.5 / 25.0 s, dry stop 100 ms after the 25.0 s beat; −14.0 LUFS, TP −4.3 dBTP.

## Contra presentation video (src/contra, 45 s, two formats)

Compositions `Contra16x9` (1920 × 1080) and `Contra4x5` (1080 × 1350), 30 fps, 1350 frames on the same 120 BPM grid;
every number in `src/contra/config.js` (scenes, copy, layouts per format, capture geometry); brief in
`CONTRA-BRIEF.md`. Each scene: the demo clip inside the player box, the real skin's capture on top when
`public/contra/captures.json` lists the scene (else a marked placeholder), a Michroma title (accent word outlined →
filled), a Geist Mono line, kbd chips / swatches / the end card drawn here. Hook: the film's own S1 frames under the title in cream
(measured 6.7:1 in 16:9, 14.7:1 on the 4:5 crop), then the S5 wipe with no text.

```
node scripts/contra-sync.mjs        # demo-footage + the 3D film → public/contra (gitignored)
node scripts/contra-music.mjs       # 45 s cut of Punchy Staccato at 120 BPM, −14 LUFS → public/contra/music.wav + music.json
node scripts/contra-stills.mjs --both   # hook / seek / end stills in both formats → stills/contra
node scripts/contra-capture.mjs --dry --scenes seek   # frame-loop mechanics on a bare video (no skin)
node scripts/contra-capture.mjs [--scenes a,b] [--target main|isolated] [--url …] [--clip …]   # the skin captures (only after the skin session's OK)
```

Capture mechanics: Playwright virtual clock (timers / rAF / Date stepped 1000/30 ms a frame), CSS transitions and
animations stepped the same amount through `document.getAnimations()`, media paused and seeked to the frame's clip
time while `paused` reads false, real pointer / keyboard actions from the scene's `actions`, pointer logged per frame
for a drawn cursor; PNGs pre-scaled lanczos to the 16:9 box into `public/contra/capture/<scene>/`.

## Coordination with the 3D session

Writes only in `film/motion/`. Reads `film/scenes.json`, `film/anchors_s2.json`, `film/render/preview/*`. No Remotion
video render while a long Blender render runs (stills and short previews only). Commit `film/motion/` separately, and
only when the 3D session has no uncommitted changes.
