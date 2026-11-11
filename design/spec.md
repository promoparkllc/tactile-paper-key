# Tactile — Paper Key · design spec

Source of truth: `design/Final.dc.html` (the FINAL board, also at https://claude.ai/artifact/FErkWdfiA71JwiusVGnR1K).
Every value below is **observed** from that file unless marked **derived** (styled from the board's tokens because
the board does not show it) or **preference** (asked for in the brief).

## Decisions

- Layout: one opaque bone dock, a pill inset 24px from the frame (8px on mobile). Source order = visual order:
  play/pause, status display, seek, mute, volume, captions, settings, fullscreen.
- Keys: 52px round keys (44px on mobile), 1.25px `#2A2724` outline, `#F3F0EB` face, 2px shade `#C2BBB1` under.
  Play is a 96×52 wide key (60×44 mobile) in the accent with a dark glyph.
- Latched state (playing, captions on, settings open): 1px down, 1px shade. Captions on also lights a 5px LED.
- Status display: `#151413` pill, Geist Mono tabular, "PLAY 1.0×" or "PAUSED", 1px separator, current and duration,
  6px accent dot. State and rate come from the player store (`tactile-status` element), labels from Video.js i18n.
- Faders: 2px engraved line, 4px buffer (`#A49D93`) and fill (accent), 14×32 ribbed cap (12×22 mobile). Volume uses
  an ink fill and a bone cap with two ink ribs. Hit area ≥ 44px tall everywhere. The ribs are an SVG background
  sized to the cap box, so Chrome snaps them with the body (2026-11-10); cap, ribs and fill end derive from the
  one slider variable, with no transition on position, and hover never moves the cap.
- Settings menu: bone panel, radius 24, width 272, 8px padding, 48px rows with radius 14, highlighted row = key face
  plus the 1.25px outline. Rows: Speed, Captions, Quality (Quality hides itself when the source has one rendition).
  Submenus are radio lists with a back row. Escape closes and returns focus to the settings key. Speed offers
  0.5×, 1.0×, 1.25×, 1.5×, 2.0× (preference, 2026-11-09). Rows: hover = key face only, selected = check only, ring on
  keyboard `:focus-visible` only (preference, 2026-11-09).
- Icons: own family `tactile` on an 18×18 grid, from the board (play, pause, volume high/low, fullscreen enter,
  captions, settings, chevron). **Derived**, same grid and weight: volume-off, fullscreen-exit, restart, check, spinner.
- Mobile (container < 560px): 60px dock with play, times above the seek fader, mute, fullscreen. Volume and the
  Captions key hidden. **Preference** (2026-11-09): a 44 × 44 Settings key in the top-right corner, inset 8px, after
  Fullscreen in the Tab order, with its own menu opening downward from the key; Captions is a row in that menu. It
  shows and hides with the dock. Outside fullscreen that menu lists Speed and Captions only (Quality hidden, no
  scrolling in a 219px player); in fullscreen Quality returns. Paused: dock rests, 112×64 Play key centred, 32px "PAUSED 0:00 / 1:51" pill
  bottom-left.
- **Derived** intermediate tiers the board does not show: < 960px hides the volume fader; < 800px hides the status
  pill and moves the times above the seek fader.
- Focus: 2px `#2A2724` outline, 3px offset, `:focus-visible` only. Forced colors map every token to system colors.
- Motion (preference): press 70ms down / 200ms back with ≤ 1px overshoot; play↔pause morph 200ms; cap lift 1px on
  grab; LED fade 150ms; menu scale 0.98→1 + fade 180ms from the settings key; PLAY↔PAUSED crossfade; dock hide fade +
  8px drop, 150ms in / 300ms out. Ease `cubic-bezier(0.22,1,0.36,1)`. Transform and opacity only. Reduced motion keeps
  state changes and short fades, drops travel, overshoot, morph, lift and the menu scale.
- Public CSS properties: `--media-accent-color`, `--media-accent-text-color`, `--media-font-family` (defaults to
  Geist when the page loads it), `--media-border-radius`. Material tokens live in `src/styles/themes/tactile.css`.
- Font: Geist / Geist Mono as on the board. The skin does not load them; the preview does, via Google Fonts.
- Hotkeys (preference): Space, K, ←/→ seek, ↑/↓ volume, M, F, C. Status announcer kept.

## 2026-11-10 · states, dock size B, latch bar

Sources: `design/States.dc.html` (board "PLAYER · New states") and the brief of 2026-11-10. The dock size study
(`design/DockSize.dc.html`, variant B) and the active key study (`design/ActiveKey.dc.html`, variant B) were not in
the repo; their values below are the ones written in the brief (**preference**), and anything only on those boards
is not covered. Where this section and the older lines above disagree, this section wins.

- **Dock size B (desktop).** Dock 68 high, radius 34, padding 12, gap 10, inset 24 (unchanged). Keys 44, play 76 × 44,
  icons 20. Status pill 36 high, text 13, label 10 (padding 14, gap 12, separator 14: **derived**). Seek cap 12 × 26
  with three ribs, volume cap 12 × 26 with two; volume 72 wide (**derived**, 84 × 44 / 52). Hit areas: keys 44 × 44,
  play 76 × 44, both faders 44 tall. Mobile unchanged (60 / 44).
- **Scale.** The controls layer has one scale, `--tactile-scale`: 1 everywhere, 1.25 in fullscreen from 1280px wide
  (`zoom` on the layer, so dock, keys, displays, menus and tooltips grow together). `--media-scale` is capped at 1.25
  for this theme; the base theme's 1.5 and 1.75 steps do not apply. Before this the dock did not scale at all; the
  1.75 step only moved the caption offset.
- **Tiers (derived, recalibrated).** Volume fader hides under 880px, the status pill under 760px (times move above the
  seek fader); each keeps the seek fader at 125px or more. Mobile stays under 560px.
- **READY** (before the first play): the 112 × 64 play key centred on the poster and the duration in a small pill in
  the corner (inset 24 desktop, 12 mobile). No dock, not on hover either, and the dock is out of the Tab order. Tab
  reaches the big key first; Space, Enter or K start playback and focus moves to the dock's play key. The dock then
  follows the normal auto-hide. `visibility="always"` on `media-controls` shows the dock from the start. The big
  key leaves with a 150ms fade and scale 0.96 (fade only under reduced motion).
- **LOADING**: the status pill reads `LOADING` with three LEDs stepping left to right, one lit at a time, 300ms each;
  it appears 400ms after the stall (`media-buffering-indicator delay="400"`), the dock stays on screen while it
  waits, and the frame is dimmed. Under 760px, where the dock has no pill, the same display floats in the middle of
  the frame (**derived**). Reduced motion: all three LEDs dim, no stepping.
- **SEEK PREVIEW**: Mux storyboard through `media-slider-thumbnail` (`mux-video` adds the track). Bezel 176 × 99,
  bone, 1.25 ink outline, radius 12, frame inset 4 with radius 8; pointer time in a 26px display pill 6px under it;
  1.5 × 20 ink hairline on the line. 14px above the dock (8px on mobile). No transition on position. Centred on the
  pointer, kept 8px inside the player's edges. On touch it shows while dragging. Under 375px of player width the
  bezel shrinks to fit above the dock (**derived**).
- **TOOLTIPS**: one per key, name plus shortcut chip (Play K Space, Mute M, Captions C, Settings, Fullscreen F), 30px
  display pill, 13px Geist, chip 11px Geist Mono with a 1px `#6A645B` outline, 6px arrow whose tip sits 14px above
  the dock. 500ms after hover, at once on keyboard focus, never from touch. The label is the key's accessible name,
  so it reads "Enable captions", "Enter fullscreen", "Pause" as the state changes. The Play, Fullscreen and corner
  Settings tooltips align to the key's own edge so they stay inside the player (**derived**).
- **END**: the big key with the replay glyph and `END 0:26 / 0:26` in a small pill under it, both centred; the frame
  dimmed; the dock stays down until the pointer moves or the keyboard is used. Space or Enter restarts.
- **ERROR**: `NO SIGNAL` with a lit LED, "This video can't be played right now.", and a bone key "Try again" that
  reloads the source (and resumes where playback was, if it had started), on a `#1E1D1D` screen. It is the skin's
  `media-error-dialog`, so it is an alert dialog that takes focus.
- **Latch bar** (replaces the LED dot): a latched bone key (captions on, settings open) lights a 13 × 2.5 bar, radius
  2, centred, 6px from the key's bottom edge, in the accent colour, with a 150ms fade. The key still sits 1px down.
  Forced colours: the bar is `Highlight`; outline and glyph keep their colours.
- **Captions icon**: the same frame, with two lines centred in it, short over long (`M5 10.2h8M6.75 7.8h4.5`, since 2026-11-11; it was long over short against the bottom edge),
  stroke 1.4, 18 grid. The spinner icon is gone (LOADING replaced it).
- **Text.** `Loading`, `End`, `No signal`, the error sentence and `Try again` are English text in `skin.html`:
  Video.js has no translation keys for them.

## 2026-11-10 · accent rim, menu scrolling

From the brief of 2026-11-10 and `design/ActiveKey.dc.html`, variant A (the board draws it at 2×: a 3px rim on an
88px key). This replaces the latch bar above.

- **Accent rim.** A latched bone key (captions on, settings open) trades its 1.25px outline for a 2px rim in
  `--media-accent-color`; the key keeps its 44px box, sits 1px down, and its glyph stays ink. No bar, no dot. The
  rim fades in over 150ms (a colour change only, so reduced motion keeps it). The focus ring (2px ink, 3px offset) is
  a separate outline and shows around a latched key. Forced colours: the rim is `Highlight`.
- **Rim contrast.** Against the dock: bone 3.2:1, graphite 3.5:1, stone 1.6:1. On stone the rim gets the glaze's
  1px ink keyline around it (6.9:1 against the dock, 4.3:1 against the rim), the same answer the glaze already uses
  for the accent fill (**derived**). The play key is the accent colour itself and has no rim; playing still latches
  it 1px down with the pause glyph.
- **Menu scrolling.** Menu pages are clipped (`overflow: clip`). A page scrolls only while it carries
  `data-scrollable`, which the skin's script sets after the panel's transitions have ended and only when the page
  measures taller than its box; any state change on the panel or a page removes it before the next paint.
- **Menu hit-testing.** The menu panel sets `pointer-events: auto`. The corner menu (mobile) is a child of the
  click-through controls layer, not of the dock, and its rows did not take taps or clicks before.

## Measurements

Values for the dock, keys, pill, caps and volume in this table are the first build's (88px dock); the section above
has the current ones.


| Item | Value | Source |
| --- | --- | --- |
| Board player | 1200 × 675 (desktop), 390 × 219 (mobile) | observed |
| Dock inset / height / padding / gap | 24 / 88 / 0 18 / 14 (mobile 8 / 60 / 0 8 / 8) | observed |
| Dock surface | `#E7E4DE`, inset 0 1px 0 rgba(255,255,255,.7), 0 0 0 1px rgba(40,30,20,.12), 0 14px 34px rgba(30,22,14,.28) | observed |
| Key size / outline / face / shade | 52 (44 mobile) / 1.25px `#2A2724` / `#F3F0EB` / 0 2px 0 `#C2BBB1` + 0 3px 6px rgba(60,50,40,.12) | observed |
| Key latched | translateY(1px), 0 1px 0 `#C2BBB1`; settings open face `#E2DDD5` | observed |
| Play key | 96 × 52, radius 26, accent, glyph `#160C07`, shade `#8F3210` (mobile 60 × 44 r22; paused mobile 112 × 64 r32) | observed |
| Icon sizes | 22 (keys), 24 (play), 20 (mobile), 26 (big play), 16 (chevron), stroke 1.4 / 1.5 / 1.6 | observed |
| Status pill | height 44, padding 0 18, gap 14, r22, `#151413`, text `#F4F1EC`, label 11px/600/.08em `#E8E3DB`, duration `#A8A39B`, sep 1×18 `#45413C`, dot 6 accent | observed |
| Idle pill (mobile paused) | height 32, padding 0 12, gap 8, 12px, label 10px, left 12 bottom 12 | observed |
| Seek line / fill / buffer | 2px `#2A2724` / 4px accent / 4px `#888177` (board `#A49D93` raised to 3:1), both top −1px | observed / preference |
| Seek cap | 14 × 32, r5, accent, 4 ribs 8 × 1.5 rgba(40,12,2,.45) on a 3.5px pitch (SVG background), 0 2px 0 `#8F3210` + 0 3px 6px rgba(60,30,10,.25) | observed |
| Volume | 84 wide, 0 8 padding, ink fill, cap bone + 1.25 outline, 2 ribs, 0 2px 0 `#C2BBB1` | observed |
| Slider hit height | 52 desktop, 44 mobile (pseudo-element) | preference |
| Menu | 272 wide, r24, 8 padding, right 96 / bottom 124 from the player edge (12px above the dock, 12px past the key) | observed |
| Menu rows | 48 min-height, r14, 0 14 padding, 15px label, 14px mono hint, 16px chevron; highlighted `#F3F0EB` + inset 1.25 `#2A2724` | observed |
| Focus ring | 2px `#2A2724`, offset 3 | observed |
| Text colours | `#1D1B19` text, `#4A4640` soft, `#5C574F` mobile duration | observed |
| Error dialog | bone, r24, 24 padding, max 420, wide key as the close button | derived |
| Buffering | 52px key disc with a spinning arc | derived |
| Tiers 960 / 800 | volume fader hidden / pill hidden + times above seek | derived |
