# Contra presentation video · brief (2026-11-10)

**Objective.** The Contra post's video for Tactile — Paper Key: the real player, pressed, in 45 s. Tone like the Iris
submission's 53 s (real captures, short kinetic titles), in our type (Michroma outlined + Geist Mono) and the tactile
language. Separate from the explainer that plays inside the player.

**Formats.** 16:9 1920 × 1080 and 4:5 1080 × 1350, 30 fps, 45 s = 1350 frames, 120 BPM (15 f/beat, bar = 2 s). The
4:5 is its own layout (title above the box, mono line and chips below), never a crop.

**Music.** "Punchy Staccato" locked to 120 BPM (atempo 0.99157), cut from 92.13 s of the stretched timeline (a downbeat
of the measured grid): groove re-enters at 2.7 s, the track's break at 31.4–35.5 s, its last hit on 43.0 s (an end-card
beat), tail gone by 44 s. −14 LUFS (music alone), TP −4.2. `scripts/contra-music.mjs`; numbers in public/contra/music.json.

**Copy (≤ 4 words a title, one accent word outlined → filled).**

| scene | s | background | title | mono line |
| --- | --- | --- | --- | --- |
| 01 Hook | 0–2 | the film's own hook (S1 f1–60, rim on the dark key), no layer | A PLAYER / YOU CAN **PRESS** (cream) | — |
| 01b | 2–4 | the flatten wipe (S5 f406–465), no text | — | — |
| 02 Ready → play | 4–10 | snow_mountain | READABLE / OVER ANY **FRAME** | READY · the dock comes up on play |
| 03 Captions · LED | 10–16 | night_street | — | captions · CC · the LED lights |
| 04 Seek preview | 16–22 | flower_market | FIND / THE **MOMENT** | hover the fader · drag the cap · preview |
| 05 Settings · speed | 22–28 | podcast_studio | — | settings · Speed 1.5× · the status pill follows |
| 06 Keyboard first | 28–34 | podcast_studio | KEYBOARD / **FIRST** | Tab · Space · M · C · F (+ kbd chips) |
| 07 One variable | 34–40 | snow_mountain | ONE VARIABLE / ANY **GLAZE** | --media-accent-color (+ 4 swatches) |
| 08 Mobile · end | 40–45 | flower_market in the 390 px player | TACTILE / **PAPER KEY** | A Video.js v10 skin · promopark.studio |

**Layout, px (64 safe margin for type).** 16:9: player box 1408 × 792 at (256, 176); title row baseline 128 (64 px);
mono baseline 1016 (22 px); chips / swatches stacked at the right margin from y 232; end: 390-px player box at
(256, 176) 480 wide, text from x 816. 4:5: box 1080 × 608 at y 371 full-bleed; title two lines, baseline 180 (72 px);
mono baseline 1060; chips in a row at y 1100. Hook title top-left in cream on the S1 frames: 16:9 baseline 330 (104 px) measures 6.7 / 7.6:1 over f1–60; 4:5
baseline 340 (68 px) on the cover crop measures 14.7:1 (higher up, near the rim, it drops to 4.6).

**Motion.** Titles one letter per frame from cut + 300 ms, words 90 ms apart, accent fill 300 ms after landing; mono
line typed from cut + 600 ms; kbd chips and swatches press with the skin's curve (70 / 200 ms); hard cuts on
downbeats; the double band once on the 4 s cut. Nothing moves while it is read.

**Captures (pending the skin session's OK).** `scripts/contra-capture.mjs`: virtual clock + stepped CSS animations,
real pointer and keyboard, media seeked per frame; `main` = the live page's hero player, `isolated` = capture/ with the
scene's clip; 1200 × 675 @1.6 (mobile 390 @3), pre-scaled lanczos to the box, pointer logged for a drawn cursor.

**Review.** Stills at 1.5 s (hook title), 2.6 s (wipe), 19.5 s (seek), 44 s (end) in both formats; contact sheet at 2 fps once rendered.
