# BRIEF · "From object to interface" — explainer film for Tactile — Paper Key

Storyboard v2 · 2026-11-09 · Promopark Studio · status: **Stage 3 · FINAL 27.5 s rendered + QC 2026-11-10 (dock size B, fan levels, S7 reframed, latch rim of skin 7eef74a); render/final/out is final → motion: re-capture, recomposite, music cut → Mux**

## 1. Objective

One film, three jobs: (1) the video that plays inside the Tactile player (hosted on Mux); (2) the explanation of where
the skin's shapes come from — a physical dock-keypad becomes the interface; (3) the cover of the Contra case study.
The brightness curve is the argument: dark hook → day → dusk → night → bone end card. A UI that stays readable
through all of it is the demo ("Readable over any frame").

Format: 37 s · 30 fps · 1920 × 1080 (16:9). The 4:3 version (1600 × 1200) gets its own framing later, not a crop.
One continuous camera, a single hard cut (to the live skin capture). No CTA button, no URL, no generic SFX, no burned-in
subtitles.

## 2. Direction, mood, references

- Direction: the skin's own material language (bone, paper key, ink, one accent) — not Studio Dark. Closest Promopark
  mood: "Editorial Light" register with a product-film camera. The brand accent of the film is the skin's
  `--media-accent-color` #D9531E, used once per frame at most.
- Design source (priority over the bible): `../design/StoryboardV2.dc.html` (composition, light, idea per shot;
  sketches, not pixel targets), `../design/Final.dc.html` + `../design/spec.md` + `../src/styles/themes/tactile.css`
  (every dimension and colour).
- Study-only references (nothing lifted): a local folder of 3D hero references, kept outside this repo
  remarkable (rim-lit reveal in black, fanned plates), framer (extruded UI layers in space, word-by-word type),
  publish-button (macro + title), `05_device-mockup\vercel` (camera skims the surface, pulls back).
- Anti-patterns watched (00-STUDIO-DNA §3): no whoosh/pop/logo-hit, no CTA button, no burned captions, no system
  fonts, no generated normal maps, object never cut at a cover edge.

## 3. The object

An original dock-keypad built on the dock's own proportions, **1 px = 1 mm** (88 mm body, Ø 52 keys). Not a replica of
any product; no logos, no brand text.

| Part | Geometry (px = mm) | Material (physical) | UI equivalent |
| --- | --- | --- | --- |
| Body | pill 1152 × 88, r 44, 16 thick, 6 mm top edge | bone #E7E4DE matte, roughness 0.62, procedural bead-blast grain (bump + roughness variation, no maps) | `.tactile-dock` |
| Round keys ×4 | Ø 52, 2 proud, in an eccentric well 2 deep offset 2 down | key #F3F0EB, roughness 0.42 (a little glossier), side = shade #C2BBB1 | key + `0 2px 0 shade` |
| Ink ring | 0.5 deep ledge, 1.25 wide at the very edge, ink floor | ink #2A2724 | `1.25px solid #2A2724` |
| Icons | the skin's SVG paths (18-grid, 22/24 px), round-bottom groove 0.45 deep, exactly one stroke wide, ink inlay 0.06 mm under the face | ink | `media-icon family="tactile"` |
| Play key | 96 × 52, r 26 | accent #D9531E, side accent-shade #8F3210, engraved triangle (pause bars appear at the morph) | `.tactile-key-play` |
| Display | 244 × 44, r 22, 0.6 proud | black ceramic #151413 (roughness 0.12, coat 1.0 / 0.05) + emissive text Geist Mono 600/500 "PLAY 1.0×  0:37  1:51" + 6 px accent dot | `.tactile-pill` |
| Seek / volume | 2 wide, 1.2 deep ink channel; 4 wide flush inlays (accent fill, buffer #888177, ink volume fill) | — | `.tactile-fader` |
| Fader caps | 14 × 32 r 5, 2 proud; 4 ribs 8 × 1.5 (accent cap), 2 ink ribs + ring (bone volume cap) | accent / key | `.tactile-fader-cap` |
| Latch rim (since skin 7eef74a; was an LED, then a latch bar) | a latched key (captions on) trades its 1.25 ink ring for a 2 wide accent ring at the very edge and sits 1 lower; glyph ink, face key | accent #D9531E | `--tactile-rim-w: 2px`, `--tactile-latch-travel: 1px` |
| Glaze caps (shot 3) | 5 × Ø 52 plain caps with the ring | graphite #34343A · stone #A8A49D · bone #F3F0EB · orange #D9531E · yellow #E4C94A | `--media-accent-color` |

Every piece has a rig (empty at the dock top) and an object attribute `flat` (0 → 1). `flat` mixes the physical BSDF
into a camera-only emission of the exact UI hex and the rig's z-scale collapses to 0.01, so the piece becomes its own
UI drawing: ring → 1.25 px border, well crescent → 2 px shade, groove → 2 px line, engraving → icon.

Colour fidelity (round 2, approved): **hybrid transform.** 3D passes (shots 1–4, 6–7 and the left of shot 5) on
**AgX**; the flat UI and the hand-off (shot 8, right of shot 5) on **Standard**, where every hex is exact (flat
emissions calibrated by `scripts/calibrate_flat.py`, worst error 0 / 255 on 16 hexes). AgX was chosen over the other
filmic transforms by measurement (emission patches): AgX keeps mid grey (128 → 128) and the ink (42 → 35), bone goes
231 → 188; ACES 2.0 / 1.3 / Filmic push bone to 168–197 and darks to 12–13; Khronos PBR Neutral turns neutral darks
orange (42,39,36 → 21,14,6). Under AgX the physical bases are compensated from render measurements (02-3D-BLENDER:
base = target ÷ light) through an object attribute `gain` (RGB multiplier on Base Color, per object, so it can differ
per shot): `FAN_GAINS` for the glazes, `PASS_GAIN` for the dock and keys of a pass. Where the albedo would exceed 1
the light carries the rest (bone key power scaled by the measured ratio). Limit found: a saturated accent lit to a
bone-level exposure is desaturated by AgX's shoulder (orange → pink) whatever the base; the orange cap therefore gets
3 W where bone gets 23 W, and still reads 175/92/86 against 217/83/30 — right luma, blue too high. The hand-off accent
is exact because it is on Standard.

## 4. Assets

- `scripts/build_scene.py` — rebuilds `scene.blend` from zero (constants at the top, every one overridable by env).
- `scripts/render_frame.sh <out> <frames…>` — single frames on OptiX (`PCT`, `SAMPLES`, `BLEND`, `VT` view transform,
  `PASS=3d|flat` + `PASS_SUN`, `PASS_SKY`, `PASS_GOBO_ROLL`, `PASS_GAIN` through `scripts/pass_override.py`, `PREFIX`).
- `scripts/composite_sf5.py <3d.png> <flat.png> <frame> <out>` — the two passes along the storyboard's slanted wipe
  (52 % top → 38 % bottom, 24 px edge), 8 px grid (12.8 px at ×1.6) on the field only, dock hairline.
- `scripts/measure.py` — projects sample points through the camera, reads 9 × 9 patches, prints sRGB / luma / ratio
  to target, frame statistics, ring zoom (`--set hook|fan|flatten|match --zoom --json`).
- `scripts/calibrate_flat.py` — emission patches → `calib/flat_colors.json`.
- `assets/fonts/` — Geist Mono Medium/SemiBold (Google Fonts static), Geist Medium/SemiBold.
- `captions.en.vtt`, `captions.en.srt` — one cue per shot 4–8 (shots 1 and 9 carry on-screen titles).
- Kit: the studio's Blender kit, kept outside this repo (`render_resume_guarded.sh`, `motion_check.py`, `composite_bg.py`).
- Remotion layer (Stage 3): titles word by word, callouts, grid, CSS typing, timecodes, end card. Geist / Geist Mono.

## 5. Layout (px, 1920 × 1080 unless noted; 64 px safe margin for type)

- Hand-off frame (shot 8, f975) = the board's player 1200 × 675 at ×1.6: dock inset 38, height 141, keys 83, play key
  154 × 83, display 390 × 70, seek cap 22 × 51. Camera straight down over the player centre, 135 mm, 4.5 m: 1200 px
  = frame width. The live capture (Playwright, virtual clock, 1200 × 675 player at deviceScaleFactor 1.6, dark
  footage, `0:37 / 1:51`, 34 % played, captions on) must land on it position-for-position.
- Shot 1 title "Every **control**" left, x 64–760, baseline ~y 540 (the key sits in the right 70 % of the frame).
- Shot 2 callouts: mono 22 px, 1 px ink leaders, numbers from tactile.css: `Ø 52 · ring 1.25`, `cap 14×32`,
  `display r22`, `body r44 · bone`, `↕ 2 mm travel`.
- Shot 3 line: mono 20 px, centred, y 1000: `--media-accent-color · one variable, any glaze`.
- Shot 5 code block right of the flat keys (x ≥ 1120), mono 24 px / 1.6:
  `.key { inline-size: 52px; border: 1.25px solid #2A2724; border-radius: 50%; }`; 8 px grid (12.8 px at ×1.6) revealed
  by the wipe, 10 % ink.
- Shot 6 timecodes at both ends of the seek line, mono 24 px: `0:37` left, `1:51` right.
- Shot 9 end card: bone #E7E4DE field, "Tactile — Paper Key" 64 px Geist 600 word by word, subtitle
  "A Video.js v10 skin by Promopark Studio" 24 px, three keys press in sequence (Blender or CSS, decide at Stage 3).

## 6. Scenes (global frames, 30 fps; Blender covers 1–975)

| # | Shot | Frames | Light | Camera | Action (frames) |
| --- | --- | --- | --- | --- | --- |
| 1 | Hook · black | 1–90 | world 0; warm strip 0.08 W light-linked to the Captions key, 2–3° grazing, azimuth 115° → 195° | 100 mm f/4, 0.15 m, front-left 34° | rim slides along the bevel; title (Remotion) |
| 2 | Context · bright studio | 91–270 | uniform world #F4F1EC 0.78 (albedo renders as itself) + 8 W soft key 1.7 m | 50 mm f/8, 1.25 → 1.2 m orbit −38° → +4° | layers lift 110–170 (keys 40 mm, caps 58, display 78), hold, back 215–270; callouts (Remotion) |
| 3 | Reveal · low key | 271–420 | world #2A2520 0.02; white spot 26° 6 W 0.35 m above the bone cap; warm rim strip 0.25 W | 85 mm f/5.6, 0.44 m, 22–25° | caps fan out 271–330, bone rises 345–385; mono line (Remotion) |
| 4 | Press · morning | 421–540 | sun 5.0 #FFF1DC elev 34° through a 6 × 4-pane window gobo; sky 0.15 | 100 mm f/4, 0.19 m, 44–48° | press at 470: −2 mm in 2 f, back in 6 f with +0.6 mm overshoot; LED 472–476; **click on f470** |
| 5 | Flatten · neutral | 541–720 | sun fades by 581; uniform world #E6E3DE 0.9 | 100 → 200 mm oblique (601) → 600 mm top (691) | keys flatten staggered: Captions 570, Mute 585, Settings 600, Fullscreen 615, Play 630 (70 f each); linen wipes to the flat canvas 620–690 (x 0.75 → −0.1 m); grid + CSS (Remotion) |
| 6 | Fader · dusk | 721–840 | low orange sun 2.75 → 1.5, elev 11° → 5°, window reflection; sky #C9A38C | 85 mm f/5.6, 0.24 m skim, then top 100 mm | cap slides 10 % → 34 % 735–800, fill follows; caps + inlays flatten 800–840; timecodes (Remotion) |
| 7 | Display · night | 841–930 | world #1A2234 0.012; practical lamp 2.2 W 2700 K; 6 bokeh emitters behind | 85 mm f/2 front-right, then top 100 mm | display lights 868–880; flattens 890–930 |
| 8 | Hand-off · near black | 931–975 | lamp → 4 %, world → 0.003 | pull out to the UI frame by 961, hold to 975 | body flattens 940–968; play → pause glyph at 960; **hard cut at f976 = 32.5 s** |
| 8b | Live capture | 976–1020 | — | — | real skin, focus ring hops by Tab, captions on |
| 9 | End · bone | 1021–1110 | — | — | Remotion end card; three keys press in sequence |

Nothing holds still: every pose drifts; the camera is sampled every 4 frames along an ease-in-out path so the aim never
slips. Only the camera "cuts" are the moves themselves; the one hard cut is the hand-off.

Deviation to decide: the brief puts the hard cut "at 31 s"; with the display flattening until 31.0 s the parts need
1.5 s to settle, so the cut sits at 32.5 s and the capture runs to 34 s. Either shorten shot 7 by 1 s or accept.

## 7. Sound (proposal after preview)

Option A — designed: one click on f470 (the press), a softer second one on each settle in shot 8, room tone of the
studio under shots 2–6, nothing under the hook and the end card. Option B — mute. No music, no library SFX.

## 8b. Stage 1 · round 3 (delivered 2026-11-09, last style-frame round)

Changes: **SF1** rack focus over 0–3 s (f1 focus on the rim bevel → f90 focus on the glyph; both rendered), rim strip
spread 6°, elevation 0.8° → 0.5°, 0.2 W, diffuse-only (`visible_glossy` off: no highlight blobs), the key's top face
split into its own object so the rim is light-linked to the body/bevel/ring only and can never reach the face; cool
fill 0.4 W linked to the key, key `gain` 0.2 keyed for the hook (back to 1 by f101) → neutral graphite face; world
black until f90, studio ramps f91–106. **SF3** rebuilt again: caps lie almost flat (12° toward the camera, bone 30°),
fanned in depth on a receding arc at 36 mm pitch (~30 % overlap, Ø 52), bone in front and 10 mm higher, fan at z 0.35
m, linen hidden → seamless black, camera low (el 11–13°). Per-cap lights: 23 W key linked to bone, 0.5 W to orange
(hue before luma), 4 W cool key to stone, 2 W to yellow, graphite via a 2 W glossy-only reflector placed by mirror
direction, two warm rims 0.7 W. **SF5** gobo = two 0.10 m bars rolled −25° (diagonal to the dock), sun angle 3°
(~6 cm penumbra), sun 13 / sky 0.35 → shadow at 60 % of lit (40 % contrast), no horizontal bar; bars shifted so they
cross left of Mute and the right end, not the hero keys.

### SF1 · hook · rack focus · AgX (`SF1a_hook_f0001.png` focus on the rim, `SF1b_hook_f0090.png` focus on the glyph)

| Sample | f1 | f90 | Note |
| --- | --- | --- | --- |
| key face, centre | 22 24 26 · Y 23.7 | 22 24 26 · Y 23.7 | neutral graphite |
| key face, top area near the LED | 20 22 24 · Y 21.7 | 21 23 24 · Y 22.6 | **asked: top-area luma** |
| key face, top area left of the LED | 21 23 25 · Y 22.7 | 21 23 25 · Y 22.7 | uniform: no warm spill anywhere |
| engraving floor (captions rect) | 6 7 8 · Y 6.9 | 6 3 2 · Y 3.6 | groove vs face 24: readable, sharp at f90 |
| rim peak (15 × 15 box) | 134 110 87 · Y 113 | 212 197 183 · Y 199 | warm rim, brighter as it slides left |
| frame | p50 20 · p95 27 · max 115 · black 35 % | p50 23 · p95 65 · max 209 · black 17 % | 0 % clipped |

### SF3 · glaze fan · f372 · AgX (`SF3_fan_f0372.png`, zoom `SF3_fan_ring_x8.png`)

| Sample | sRGB | Y | Target | Yt | Hue | Note |
| --- | --- | --- | --- | --- | --- | --- |
| Bone face, dome centre | 235 235 234 | 234.9 | #F3F0EB | 240.3 | neutral | −2 % |
| Bone face, lower | 236 235 234 | 235.1 | #F3F0EB | 240.3 | | |
| **Graphite** (ceramic, via reflector) | 52 49 45 | **49.3** | — | | | **stone − graphite = 120 ≥ 40** |
| **Stone** (cool key, gain 1 / 1.06 / 1.18) | 173 168 166 | **168.9** | #A8A49D | 164.3 | 17° | lighter and cooler than graphite |
| **Orange (accent)** | 165 54 0 | 73.7 | #D9531E | 107.7 | **19.6° (target 17.0°, Δ +2.6°)** | darker burnt orange, hue in ±4° |
| Yellow | 173 136 51 | 137.7 | #E4C94A | 197.6 | 41.8° | low key |
| ink ring, orange lower edge | 103 31 1 | 44.1 | #2A2724 | 39.4 | | |
| frame | p50 0 · p95 184 · max 239 · black 86 % · clipped 0 % | | | | | seamless black, no floor band |

### SF5 · flatten · f650 · two passes (`SF5_flatten_f0650.png` composite; `SF5_pass3d_AgX_f0650.png`, `SF5_passflat_Standard_f0650.png`)

| Sample | 3D pass · AgX (sun 13, sky 0.35, gain 1.11) | Flat pass · Standard | Target |
| --- | --- | --- | --- |
| key face (Captions) | 223 219 214 · Y 219.5 | 243 240 235 · Y 240.3 **exact** | #F3F0EB |
| body bone, lit | 221 217 211 · Y 217.4 | 231 228 222 · Y 228.2 **exact** | #E7E4DE |
| body bone, in a bar shadow (between Mute and volume) | 129 131 132 · Y 130.6 → **shadow / lit = 0.60 (40 % contrast)** | — | |
| accent (LED) | 199 107 73 · hue 16.2° (Δ −0.8°) | 217 83 30 **exact** | #D9531E |
| ink, volume line | 47 43 38 · Y 43.5 | 42 39 36 **exact** | #2A2724 |
| shade, well under Mute | 80 77 74 (in shadow) | 194 187 177 **exact** | #C2BBB1 |
| frame | p50 188 · p95 219 · clipped 0 % | p50 228 · clipped 0 % | |

Contact sheet of the four frames: `frames/contact_round3.jpg`. Zooms ×8: ring and engraving for both hook frames,
bone ring for the fan, ring per pass for the flatten.

Transform note: the hook, fan and 3D pass are AgX; the flat pass is Standard. The fan's accent hue is held by exposure
(its own 0.5 W key) rather than by base gain, which is why its luma sits at 74 (low key, approved direction).

## 8a. Stage 1 · round 2 (2026-11-09, superseded by §8b)

Changes: engraving 0.45 → 0.25 mm (groove, not cavity); hook focus on the rim bevel at f/14 (2.8 × magnification: f/5.6
was 0.1 mm deep), warm rim 0.045 W + a cool fill (0.03 W, #8E96A2) both light-linked to the key, world black → graphite
face, black frame; shot 3 rebuilt: real keycap (5 mm skirt, 2 mm edge, 0.2 mm ink ledge, 1.2 mm dome), five standing
caps 46 mm apart yawed ±14°, tilted 66°, in the air at z 0.22 m with the linen hidden (seamless black), bone 16 mm
forward and 9 mm up; materials graphite = black ceramic recipe (#0E0E0E, rough 0.15, spec 0, coat 1 / 0.05, read
through a glossy-only 1.6 m reflector placed by mirror direction), stone matte 0.75, bone bead-blast + sheen 0.15,
orange / yellow satin (rough 0.3, coat 0.25); soft key 3 W on all caps + 23 W key linked to bone only + two warm rims
0.7 W linked to the caps; shot 5 = two passes of f650 composited (see §3); dock body bead-blast grain 0.5 + sheen.

### SF1 · hook · f45 · AgX (`frames/SF1_hook_f0045.png`, zooms `SF1_hook_ring_x8.png`, `SF1_hook_engraving_x8.png`)

| Sample | sRGB | Y | Note |
| --- | --- | --- | --- |
| key face, centre | 9 10 11 | 9.9 | neutral graphite (was 9 6 4 sepia) |
| key face, lit side toward the rim | 103 84 65 | 87 | warm gradient next to the rim |
| engraving floor (captions rect) | 6 5 4 | 5.1 | groove reads against the face at 38 31 25 |
| rim peak (brightest 15 × 15 box) | 194 177 161 | 180 | the warm rim |
| frame | p50 10 · p95 82 · max 182 · clipped 0 % · black (≤ 2) 36 % | | total darkness holds |

### SF3 · glaze fan · f372 · AgX (`frames/SF3_fan_f0372.png`, zoom `SF3_fan_ring_x8.png`)

| Sample | sRGB | Y | Target | Yt | Ratio (lin, r g b) |
| --- | --- | --- | --- | --- | --- |
| Bone face, dome centre (gain 1.11, key 23 W) | 229 228 227 | 228.1 | #F3F0EB | 240.3 | 1.14 1.12 1.08 |
| Bone face, lower | 227 227 226 | 226.9 | #F3F0EB | 240.3 | 1.17 1.13 1.09 |
| Graphite (ceramic #0E0E0E via reflector) | 46 44 40 | 44.1 | #0E0E0E | 14.0 | reads as the storyboard's graphite |
| Stone | 88 82 76 | 82.8 | #A8A49D | 164.3 | low key fall-off |
| Orange (gain 1.44 / 0.2 / 0.03, key 3 W) | 175 92 86 | 109.2 | #D9531E | 107.7 | luma on target, AgX keeps blue high |
| Yellow | 138 117 35 | 115.5 | #E4C94A | 197.6 | low key fall-off |
| ink ring, orange lower edge | 46 32 31 | 34.9 | #2A2724 | 39.4 | 0.85 1.4 1.3 |
| ink ring, bone lower edge | 121 118 115 | 118 | #2A2724 | 39.4 | sample lands on the lit lip (zoom) |
| frame | p50 0 · p95 219 · max 233 · clipped 0 % · black 64 % | | | | |

### SF5 · flatten · f650 · two passes (`frames/SF5_flatten_f0650.png` = composite; passes `SF5_pass3d_AgX_f0650.png`,
`SF5_passflat_Standard_f0650.png`; zooms per pass)

| Sample | 3D pass · AgX (sun 13, gain 1.11) | Flat pass · Standard | Target |
| --- | --- | --- | --- |
| key face (Captions) | 222 218 213 · Y 218.5 | 243 240 235 · Y 240.3 **exact** | #F3F0EB |
| body bone | 219 214 208 · Y 214.6 | 231 228 222 · Y 228.2 **exact** | #E7E4DE |
| accent (LED) | 199 104 67 (AgX) | 217 83 30 **exact** | #D9531E |
| ink, volume line | 76 67 58 | 42 39 36 **exact** | #2A2724 |
| shade, well under Mute | 172 156 138 (sunlit well) | 194 187 177 **exact** | #C2BBB1 |
| ink ring (Captions, 9 × 9 patch) | 161 146 126 | 83 80 75 | ring is 2 px here: the patch mixes face pixels |
| frame | p50 184 · p95 217 · clipped 0 % | p50 228 · p95 240 · clipped 0 % | |

The 3D pass keeps the window bars, contact shadows, grain and DOF; the flat pass is the UI on the 8 px grid over
#E7E4DE with the dock hairline. The ring reads in both (see zooms); its 9 × 9 median is not a valid hex check at this
camera (2 px wide line).

## 8. Stage 1 · round 1 · style frames (2026-11-09, superseded by §8a)

Renders: 1920 × 1080, Cycles OptiX, 64 spp, OIDN, Standard. Files in `frames/`, ring zooms in `frames/zoom/`,
measurements in `frames/*_measure.json`. Render time ≈ 6–7 s per frame on the RTX 3060.

### SF1 · hook · f45 (`frames/SF1_hook_f0045.png`)

| Sample | sRGB | Y | Note |
| --- | --- | --- | --- |
| key face, centre (below icon) | 9 6 4 | 6.5 | black by design |
| key face, lit side | 98 81 63 | 83 | grazing fall-off |
| rim peak (brightest 15 × 15 box) | 215 180 144 | 185 | the warm rim on the left bevel |
| frame | p50 8 · p95 80 · max 187 · clipped 0 % · black (≤ 2) 39 % | | total darkness holds |

### SF3 · glaze fan · f372 (`frames/SF3_fan_f0372.png`)

| Sample | sRGB | Y | Target | Yt | Ratio (lin, r g b) |
| --- | --- | --- | --- | --- | --- |
| Bone face (hero, under the spot) | 239 236 231 | 236.3 | #F3F0EB | 240.3 | 1.04 1.04 1.04 |
| Graphite face | 46 45 48 | 45.4 | #34343A | 52.4 | 1.26 1.31 1.43 |
| Stone face | 99 94 87 | 94.6 | #A8A49D | 164.3 | 3.1 3.3 3.5 (edge of the pool) |
| Orange face | 104 89 69 | 90.7 | #D9531E | 107.7 | hue off: warm rim + blend edge |
| Yellow face | 199 166 63 | 165.6 | #E4C94A | 197.6 | 1.36 1.53 1.38 |
| Bone ring (front ledge) | 115 111 107 | 112 | #2A2724 | 39.4 | ledge catches the spot |
| frame | p5 13 · p50 93 · p95 152 · max 254 · clipped 0 % | | | | |

Bone is calibrated to its hex within 1.7 % luma (base × 0.93 / 0.99 / 1.05 in `calib/phys_colors.json`, light power
scaled by the measured ratio 5.0 → 6.0 W). The other glazes are not forced: in low key they fall off with the pool,
which is the storyboard's "bone steps forward".

### SF5 · mid-flatten · f640 (`frames/SF5_flatten_f0640.png`)

| Sample | sRGB | Y | Target | Yt | Ratio (lin) |
| --- | --- | --- | --- | --- | --- |
| Captions face (flat = 1.0) | 243 240 235 | 240.3 | #F3F0EB | 240.3 | 1.000 — exact |
| Mute face (flat ≈ 0.79) | 239 236 231 | 236.3 | #F3F0EB | 240.3 | 1.04 |
| Settings face (flat ≈ 0.57) | 230 227 221 | 227.2 | #F3F0EB | 240.3 | 1.13 |
| Fullscreen face (flat ≈ 0.36) | 220 216 208 | 216.3 | #F3F0EB | 240.3 | 1.25 (physical under world 0.9) |
| body | 199 194 185 | 194.4 | #E7E4DE | 228.2 | 1.40 (physical, occluded) |
| Captions ring (flat) | 52 50 45 | 50.1 | #2A2724 | 39.4 | 0.67 (ring reads 10 levels light: residual physical mix + AA) |
| volume line (ink, physical) | 50 48 45 | 48.2 | #2A2724 | 39.4 | 0.69 |
| frame | p5 127 · p50 137 · p95 227 · clipped 0 % | | | | |

### Ring zooms (`frames/zoom/*_ring_x8.png`, 112 px crops × 8, nearest neighbour)

SF5: ink ledge 2 px wide at ×1.6 with the shade crescent under it — reads as the UI's 1.25 px border + 2 px shade.
SF3: bone cap front edge, in focus (the camera focuses the raised bone cap). SF1: the rim crescent on the bevel.

### Known gaps for Stage 2 (not blocking the OK)

- Shot 4 "very strong morning light": the window bars are 15 cm apart, so a 52 mm macro rarely shows a bar; consider a
  3 × 2-pane gobo or a lower sun (elev 24°) for longer shadows. Keep the clipped % at 0 under Standard.
- Shot 6 dusk reads dark brown; raise the dusk sky or add a glossy "window reflection" strip aimed by mirror placement.
- Shot 2 background is the lit linen (beige), the storyboard sketches near-white; a white studio plane keyed in for
  shot 2 only is a 5-line change if wanted.
- Hard cut at 32.5 s vs 31 s (see §6).
- Caps' 2 px UI shade is not reproduced for the fader caps (they ride on the surface, no well); ≤ 2 px mismatch at the
  hand-off.

## 10. Stage 2 · preview pipeline (2026-11-09)

Approved after round 3: hard cut 32.5 s, hand-off ×1.6, camera-only flat emission, hybrid transform, SF1 rack focus,
SF5 look. Notes applied before the preview: a 12 W back fill (1.2 × 0.3 m, linked to the body) behind the dock in
shots 4–5 so its far rounded edge no longer reads as a bar; shot 3 recomposed (camera at cap level, el 5–7°, the fan
fills ~80 % of the width) and re-timed: the caps open from a stack into the depth arc over 2 s (f276–336, quart
in-out), the far cap is the hero of the move, nearer caps travel less and start 4 f (~130 ms) later each, bone rises
last in front (f340–376), then everything keeps a 2 mm drift.

The whole film renders as three passes with the kit's guarded renderer (`scripts/render_preview.sh`, resumable):

| Pass | Frames | Transform | What |
| --- | --- | --- | --- |
| A | 1–975 | AgX | the scene as animated: the 3D world |
| B | 541–975 | Standard | the scene as animated: every flat drawing at its exact hex |
| M | 541–975 | Standard, lights off | flat matte: each material emits its `flat` factor (the linen its wipe factor) |

`composite_seq.py`: out = A · (1 − M) + B · M, so every pixel takes the 3D look while it is an object and the exact
hex the moment it is a drawing; shot 5's wipe, shot 6's fader, shot 7's display and shot 8's body all hand over the
same way. Shots 1–4 (frames < 541) are pass A alone. Lights were re-levelled for AgX (sun 13 / sky 0.35 with the
measured bone gain 1.11 in shots 4–5, studio 1.3 / 14 W, dusk sun ×0.45, lamp 5 W, night sky 0.03).

Encode: H.264 yuv420p, limited range, BT.709 tags, 30 fps. QC: contact sheets at fps 2, 6 × 4 tiles (12 s per sheet);
`motion_check.py --no-loop` (static runs > 1 s = 30 f, 0 → peak jumps, empty frames).

### Stage 2 · results (2026-11-09)

Files: `render/preview/preview.mp4` (960 × 540, 975 frames = 32.5 s, yuv420p, limited, BT.709), contact sheets
`render/preview/contact_01..03.jpg` (fps 2, 6 × 4 = 12 s each), passes in `render/preview/A|B|M`, composite in `out/`.

Render time at 50 % / 16 spp (RTX 3060, OptiX, persistent data, one process per pass):

| Pass | Frames | s / frame | Total |
| --- | --- | --- | --- |
| A · AgX | 975 | 0.36 | 5.9 min |
| B · Standard | 435 | 0.35 | 2.6 min |
| M · matte | 435 | 0.13 | 1.0 min |
| composite + encode + QC | | | ~1 min |

Final estimate at 100 % / 64 spp (×16 samples·pixels; the 1080p/64 style frames measured 6.1–7.1 s): A ≈ 6.3 s × 975
≈ 1 h 42 min, B ≈ 6.0 s × 435 ≈ 44 min, M ≈ 1.5 s × 435 ≈ 11 min, composite ≈ 5 min → **≈ 2 h 45 min**, resumable per
pass with `render_resume_guarded.sh`.

Motion check (`motion_check.py --no-loop --max-static 30`): **PASS** — longest near-static run 12 f (limit 30, nothing
holds > 1 s), no 0 → peak jump inside 12 f, no empty frame. Per-frame difference (ffmpeg tblend, 160 × 90, mean |Δ|):
median 1.09, p95 9.9, max 18.5 at f261–265 (the studio fading to black before the fan), then f748–755 (the dusk
camera dive); no isolated single-frame spike (> 3 × its neighbours). Per shot, mean / max: S1 0.8 / 2.7 · S2 2.5 / 18.5
· S3 2.4 / 12.5 · S4 3.0 / 14.6 · S5 3.2 / 8.9 · S6 3.7 / 15.8 · S7 2.4 / 6.0 · S8 3.4 / 6.0.

Fixed during the preview (two rounds of partial re-render): the shot 2 → 3 and 3 → 4 changes were masked cuts (linen
hidden / caps shown / sun on in one frame, max Δ 68) → the lights now fade to black over 14 f and come back over 30 f
while the camera flies, so the take stays continuous; the hook rim light's euler keys wrapped at 180° and swung the
strip for two frames (f67, f69) → `make_compatible` on every key. Hand-off frame 975 measured on the composite: key
face, body, play accent, display all **exact** (ratio 1.000); the 2–4 px features (ring, seek line, buffer) cannot be
read at 50 % with a 9 × 9 patch.

Remaining gaps for the final (from §8 and the preview):
1. Shot 6 dusk: the body under the low orange sun reads brown-orange like wood under AgX (`#FFB070` × 5.85); propose
   a paler sun (`#FFD2A8`), sky fill 0.5 and a bone gain 1.1 for S6, measured on f760 before the final.
2. Shot 2 studio: the background is the lit linen (beige); the storyboard sketches a near-white radial. Optional
   white studio plane keyed for S2 only.
3. Shot 4 morning: with two bars 0.1 m apart the macro rarely shows a bar; accepted as is (the bars read in shot 5).
4. The fader caps have no 2 px UI shade (they ride on the surface); ≤ 2 px mismatch at the hand-off.
5. The 4:3 (1600 × 1200) version needs its own camera framing pass; not started.
6. Remotion layer (titles, callouts, grid, CSS, timecodes, end card), the live Playwright capture, sound A/B and the
   Mux upload are Stage 3.

### Stage 2 · preview review round (2026-11-09, corrections before the final)

1. **Shot 2 rebuilt** to the storyboard: white studio floor rendered in shot 2 only (`Studio`, #F2F0EC; the linen is
   hidden there), layers lift apart on Z with slight tilts (keys 40 mm / −6°, caps 58 mm / +7°, display 78 mm / −4°),
   slow orbit (−38° → +4°) aimed 75 mm above the body so the top of the frame is free for the callouts, parts drift
   back together by f266, then the studio fades to black before the fan. **Anchors for Remotion:**
   `film/anchors_s2.json` — for every frame 91–270 the 1920 × 1080 position and visibility of `key_ring` (Ø 52 ·
   ring 1.25), `key_travel` (↕ 2 mm), `cap` (14×32), `display` (r22), `body` (r44 · bone) and `key_center`, from
   `scripts/export_anchors.py` (re-run after any camera change).
2. **Bone stays bone at dusk and night.** S6: sun #FFD2A8, cool sky #B8BCC8 at 0.6 → 0.35, body/keys gain 0.97 /
   1.075 / 1.16 (measured). S7: the warm lamp (2 W, behind-right, low) is light-linked to the display only — a rim
   on the pill — and a near-neutral fill (#C4C8CE, 2.2 W) linked to the body and pieces keeps the body neutral.
   Measured on the body: f760 → 165/160/158, saturation 0.03–0.04 (R − B ≤ 7 levels at luma 160, so the hue reads
   12–20° but is set by rounding; the bone hex itself is 0.04 saturation); f900 → 95/96/96 and 108/109/110,
   saturation 0.01–0.02, dark and neutral.
3. **Display shows the film's own time:** duration `0:38` (38.5 s), current time per second (`0:27` … `0:32`, one
   text object each, visible in its own second); at the hand-off (32.5 s) it reads `0:32 / 0:38`. The seek fill
   is therefore 32.5 / 38.5 = 84 % (the slide in shot 6 runs 10 % → 84 %), buffer 95 %. **Live capture rule:** the
   Playwright capture plays this film at t = 32.5 s, same values.
4. Shot 3 camera aims 10 mm under the caps: the fan sits in the middle third.
5. Fader caps carry the UI's 2 px shade: a shade-coloured plate (cap + 0.5 px, 2 px down) rides under each cap.

Partial preview re-rendered on all passes (the seek change touches shots 5–8 as well); results below replace the
earlier numbers.

### Stage 2 · preview review 2 (2026-11-09): re-cut to 26 s on a 120 BPM grid

**Grid.** 120 BPM at 30 fps = 15 frames per beat; `B(k) = 1 + 15·k` is computed from time, never summed. Every shot
boundary and every hero event sits on a beat. New timestamps (frame = t·30 + 1):

| Shot | Beats | Frames | Time | Hero event (beat → frame) |
| --- | --- | --- | --- | --- |
| 1 Hook | 0–4 | 1–60 | 0–2 s | rack focus rim → glyph over the whole shot |
| 2 Exploded | 4–12 | 61–180 | 2–6 s | layers apart B5→B7 (76→106), together B9→B11, **parts join B11 = f166** |
| 3 Fan | 12–18 | 181–270 | 6–9 s | caps open 186→226 (quart in-out, 3 f stagger), **bone rises B16 = f241** |
| 4 Press | 18–23 | 271–345 | 9–11.5 s | **press B20 = f301**, LED +4 f (130 ms) |
| 5 Flatten | 23–31 | 346–465 | 11.5–15.5 s | keys flatten over 30 f ending on B25…B29 (376, 391, 406, 421, 436); wipe 391→466 |
| 6 Fader | 31–37 | 466–555 | 15.5–18.5 s | cap slides 481→526, **stops B35 = f526**; groove flattens 541→556 |
| 7 Display | 37–43 | 556–645 | 18.5–21.5 s | **display lights B39 = f586**; flattens 601→631 |
| 8 Hand-off | 43–48 | 646–720 | 21.5–24 s | **parts join / body flat B44 = f661**; **hard cut B45 = f676 = 22.5 s**; stand-in 676–720 |
| 9 End card | 48–52 | 721–780 | 24–26 s | bone plane (composite), text in Remotion |

Durations: 2 · 4 · 3 · 2.5 · 4 · 3 · 3 · 2.5 · 2 = 26 s. The hand-off stand-in (676–720) is the flat UI still playing:
seek fill 86.5 % → 92.3 %, display `0:22` → `0:23`; the live Playwright capture replaces it at Stage 3 (same values at
t = 22.5 s, duration `0:26`).

**Accents with stability.** Before every hero event the camera settles with a quart ease-out 8 f before the hit and
holds exactly (no motion) 15 f after it: f158–180 (join), f233–256 (bone), f293–316 (press), f518–541 (cap stop),
f578–601 (display), f653–720 (hand-off). Every other camera move is a quart in-out of 0.6–1 s between poses (no linear
drift); inside shots the motion comes from the pieces. Secondary motions lag the hero by 4–7 f (130–230 ms): caps and
display layers in the explosion, the LED after the press, nearer caps in the fan.

**Exploded view (S2).** Camera 1.0 m / 45 mm, elevation 40–42°, orbit −58° → −35°, aimed at the key cluster at
mid height. Layer lifts are set from the visible frame height H = d · 24 / f = 0.533 m: keys 28 % (0.149 m), caps 42 %
(0.224 m), display 56 % (0.299 m), tilted −6° / +7° / −4°; white studio floor (shot 2 only), world 1.0 and a 0.6 × 0.4 m
key at 40 W for contact shadows on the layers below. `film/anchors_s2.json` regenerated for frames 61–180 (the display
anchor is its right rounded corner, the one in frame).

**Light transitions.** Fades of 12 f out / 15 f in at 180/181 and 270/271 (studio → fan → morning): no black longer
than ~0.3 s. Fan lights, hook rim and fill, sun, back fill, lamp and night fill all ride the same grid.

**Deliverables updated.** `captions.en.vtt/.srt` (shots 4–8 at 9.2–11.3, 11.7–15.3, 15.7–18.3, 18.7–21.3,
21.7–23.9 s). Showcase `DAY_T = 12.5` (flatten, bright neutral), `NIGHT_T = 20` (display lit) in
`apps/preview/src/showcase/main.ts`.

### Stage 2 · preview review 2 · QC of the first 26 s render and the accent calibration (2026-11-09)

**First render (archived as `render/preview_v1/`).** 477 s on the 3060 (A 0.36 s/f, B 0.34, M 0.15 at 50 % / 16 spp).
Findings, each fixed in `build_scene.py` before the second render:

- *Camera jump at f256→257 (diff 51.7).* The pose after the fan hold was the S4 settle at f293, so the camera flew from
  the fan to the dock while the fan lights faded → fix: hold the fan pose to `S3[1]`, cut (in the black) to a wider S4
  pose at `S4[0]`, then the quart-out settle to f293.
- *Fades popped* (S4 luma 16 → 49 → 91 in three frames). Bezier keys on light energy are linear in light, not in luma →
  `ramp()` keys the fades on a square law (energy ∝ u²): S1→S2, S2 out, S3 in/out, S4 in. Black runs stay 12 f and
  14 f (0.4 / 0.47 s), both under 0.5 s.
- *Accent not constant.* Measured on pass A (AgX) against the brand accent #D9531E (hue 17°, luma 108):

  | frame | piece | sRGB v1 | hue | luma | cause |
  | --- | --- | --- | --- | --- | --- |
  | 241 | fan orange cap | 160 52 0 | 19.5° | 71 (−34 %) | 0.5 W key too dim; AgX crushes the low blue → yellow |
  | 320 | LED | 199 104 69 | 16.2° | 122 (+13 %) | emission 1.0 + the sunlit dark base adds grey |
  | 526 | seek cap (reference) | 140 68 51 | 11.5° | 82 (−24 %) | low dusk sun + cool sky; `GAIN_S6` lifts blue for the bone |
  | 600 | display dot | 197 85 33 | 19.0° | 105 (−3 %) | fine |

  Calibrated with `scripts/accent_override.py` (env overrides on test frames) + `scripts/accent_report.py`, then baked:
  `FAN_ORANGE_POWER` 0.5 → 4.5 W and `FAN_GAINS['Orange']` (1, 1, 1.3); `LED_LIT_3D = 0.7` while the LED is 3D (keyed
  to 1.0 = exact hex at the cc flatten, where the Standard pass takes over); the seek cap gets its own compensation
  instead of the bone's (`ACCENT_GAIN_S45` (0.74, 0.68, 0.18) under the morning sun, `ACCENT_GAIN_S6` (1, 1, 0.2)
  under the dusk sky, the gain lagging the sun's fall by 15 f) and a cap-only white key `CapKey` (0.08 m, 0.15 W →
  0.21 W as the sun dies, light-linked to the cap parts, rides on the cap rig). Verified on test frames (50 %, 16 spp,
  AgX), reference = seek cap at f526:

  | frame | piece | sRGB v2 | hue | Δhue | luma | Δluma |
  | --- | --- | --- | --- | --- | --- | --- |
  | 241 | fan orange cap | 201 85 39 | 17.0° | +1.0 | 106 | −1.5 % |
  | 320 | LED | 183 90 58 | 15.4° | −0.6 | 108 | −0.4 % |
  | 481 | seek cap, slide start | 193 95 68 | 13.0° | −3.0 | 114 | +5.6 % |
  | 526 | seek cap (reference) | 186 90 55 | 16.0° | 0 | 108 | 0 |
  | 555 | seek cap, end of S6 | 197 86 33 | 19.4° | +3.4 | 106 | −1.9 % |
  | 600 | display dot | 197 85 33 | 19.0° | +3.0 | 105 | −2.6 % |

  All within ±4° / ±10 %. LED over f318–337: luma spread 1.1 (0.9 % of mean), hue 16.2–16.5° → constant.
- *motion_check* read the end card (721–780, a static bone plane by design) as a 59 f static run → the script now
  checks `preview_1-720.mp4` (the 3D film) and keeps the full `preview.mp4`. The remaining long low-motion run is the
  hand-off hold 661–720 (parts joined → UI stand-in with only the seek fill creeping): intended, flagged for review.
- *Exploded view (f61–180)* now reads: keys floating above the body with contact shadows, caps and display on their
  own layers (frames `render/preview/out/0120.png`, `0150.png`); the key cluster is about 11 % of frame height.

### Stage 2 · preview review 2 · second render QC (2026-11-09, `render/preview/`)

Full re-render 459 s (A 252 s = 0.35 s/f, B 122 s, M 50 s), then three partial re-renders after the QC below.
Deliverables: `render/preview/preview.mp4` (780 f, 26 s, H.264 yuv420p BT.709 limited), `preview_1-720.mp4` (the 3D
film without the end card, for motion_check), `contact_01..03.jpg` (fps 2, 6 × 4), `accent_report.json`.

**Motion.** Per-frame mean difference (160 × 90): median 1.15, p95 11.6; no static run under 0.25 longer than 18 f
except the accent holds and the hand-off. Largest changes: f720 (cut to the end card), f65 (hook → studio pull-back,
29.8), f176–178 (S2 fade-out, ≤ 29.7); every other frame ≤ 20. Black (YAVG < 20): f180–191 = 12 f (0.40 s) and
f269–271 = 3 f (0.10 s). Per shot (mean / max): S1 0.84 / 1.0 · S2 4.35 / 29.8 · S3 2.71 / 16.6 · S4 5.98 / 19.3 ·
S5 3.13 / 11.4 · S6 2.21 / 10.2 · S7 4.24 / 14.9 · S8 3.41 (hard cut aside).

Three more camera fixes came out of the kit's check: the S4 fade-in is now 22 f (`FADE_IN_S4`) with the settle as a
quart in-out so the picture does not start moving at full speed as it appears; S7→S8 was a hold then an 8 f quart-out
to the UI frame (a whip, read as a cut) → one 22 f in-out from the flat display to the UI frame, arriving 8 f before
the parts join at B(44); S6→S7 was a 15 f rise + 15 f settle → one 30 f in-out (1.0 s) from the cap to the display,
arriving 15 f before it lights at B(39).

`motion_check --no-loop --max-static 30` on `preview_1-720.mp4` still reports **FAIL** on two criteria, both by design:
(1) longest near-static run 56 f = the hand-off (parts joined at f661, 15 f hold, then the UI stand-in f676–720 where
only the seek fill creeps); the live Playwright capture will have the same stillness. (2) "0→peak jump": the kit flags
a still frame followed within 12 f by the film's largest change; here the stills are the end of the hook (f54–60) and
the hold after the S2 join (f169–174), followed by the S1→S2 pull-back and the S2 fade-out. That is exactly the
accent-hold grammar asked for (hold 12–18 f, then move), so it is reported, not patched further.

**Accent, measured on the render (pass A, AgX), reference = seek cap at f526:**

| frame | piece | sRGB | hue | Δhue | luma | Δluma |
| --- | --- | --- | --- | --- | --- | --- |
| 241 | fan orange cap | 201 85 39 | 17.0° | +1.0 | 106.3 | −1.5 % |
| 320 | LED | 183 91 58 | 15.8° | −0.2 | 108.2 | +0.3 % |
| 481 | seek cap, slide start | 193 95 68 | 13.0° | −3.0 | 113.9 | +5.6 % |
| 526 | seek cap (reference) | 186 90 55 | 16.0° | 0 | 107.9 | 0 |
| 555 | seek cap, end of S6 | 197 86 33 | 19.4° | +3.4 | 105.8 | −1.9 % |
| 600 | display dot | 197 85 33 | 19.0° | +3.0 | 105.1 | −2.6 % |

LED over f318–337: luma 107.1–108.2 (spread 1.0 % of mean), hue 15.4–16.2°. Brand #D9531E = hue 17°, luma 108.

**Exports for the motion layer** (contract `film/motion/README.md`), all regenerated by the build or from the built
scene, never typed: `film/scenes.json` (written by `build_scene.py`: grid, scenes, events, seek, `px_per_mm_s5` 3.84
from the top-down S5 pose, `tab_hops` 683/698/713 = 7 f after B45/B46/B47 — a proposal for the capture, change in
`TAB_HOPS`; a `world` block with the groove ends in metres), `anchors_s2.json` (61–180), `anchors_s3.json` (fan cap
centres and dome tops, 181–270), `anchors_s6.json` (groove ends + cap, 466–555), `wipe_edge.json` (x of the wipe
edge on the top and bottom rows, 391–466) via `export_anchors.py --set s2|s3|s6|wipe`.

**Final estimate** (100 %, 64 spp, from the preview's per-frame times × ~16 minus fixed overhead): A 720 f ≈ 55 min,
B 375 f ≈ 27 min, M 375 f ≈ 6 min → about 1.5 h, plus composite and encode.

**Open for Dorin:** the hand-off hold (1.5 s of UI stand-in with only the fill moving) — keep, or shorten the stand-in
to 1.0 s and give the end card 2.5 s; the exploded view's key cluster at ~11 % of frame height (callouts have room,
but the keys are small) — tighten the S2 camera or keep the whole body in frame; `tab_hops` timing.

### Stage 2 · preview 2 approved (2026-11-09) · three decisions applied · partial preview · FINAL started

1. **Hand-off / end card.** Stand-in shortened by 0.5 s: S8 = 646–705 (hard cut stays at f676 = 22.5 s, the live
   window is 676–705 = 1.0 s), end card 706–780 = 2.5 s, film still 26 s. `SEEK_END` 90.4 % at f705, display
   `0:22` → `0:23`. Caption 5 now 21.7–23.4 s. `render_preview.sh` reads its frame numbers from `scenes.json`.
2. **Exploded view.** Frames 61–150 tight on the key cluster, a raking view along the body (45 mm, 0.50 m, azimuth
   62° → 55°, elevation 34° → 36°, target 80 px left of the captions key at the keys' mid-lift): the four keys at
   28–32 % of frame height over their wells, the volume cap and groove behind, the body receding to the upper left.
   With the keys at that size the display and play key cannot be in the same frame; they enter with the pull-back:
   f150 → 176 one quart in-out to the whole body (1.5 m, 46°, 38°), hold into the fade. The layers' lifts follow the
   tight frame height (0.27 m): keys 0.075 m, caps 0.11 m, display 0.15 m. `anchors_s2.json` regenerated; the `body`
   anchor moved to the front edge beside the captions key (visible 100 / 120 frames; the rounded end never is).
3. **tab_hops** 681 / 690 / 699 (`TAB_HOPS = HARD_CUT + 5 / 14 / 23`).

Exports regenerated from the build and committed (`dc9f4d9`, film/ without render/, frames/, motion/): `scenes.json`,
`anchors_s2/s3/s6.json`, `wipe_edge.json`.

**Partial preview (S2 + S8–S9 re-rendered, 50 % / 16 spp).** Film diff median 1.15, p95 11.9; S2 mean 4.76 (pull-back
f170–178 ≤ 29); S8 mean 4.03. Black runs unchanged (12 f, 3 f). motion_check on `preview_3d.mp4` (1–705): 0→peak jump
**no longer flagged**; longest near-static run 47 = the hand-off (658–704, by design) → nothing new, so the final
starts without another STOP, as agreed.

**FINAL** `render_preview.sh final` (100 %, 64 spp, OptiX) started 2026-11-09 19:3x → `render/final/`.

### Stage 2 · FINAL render (2026-11-09, `render/final/`) · QC

`render_preview.sh final` ran 19:28 → 20:29 (3681 s): pass A 705 frames at 3.17 s/f (2236 s), pass B 360 frames at
2.92 s/f (1051 s), pass M 360 frames at 0.72 s/f (260 s), composite 780 frames, encode + QC. Output: `preview.mp4`
(1920 × 1080, 30 fps, 780 frames = 26.000 s, H.264 yuv420p, BT.709 matrix, limited range, sRGB transfer tag, same
tags as the preview), `preview_3d.mp4` (1–705, for motion_check), `out/0001–0780.png` (composite), passes `A/`, `B/`,
`M/`, `contact_01..03.jpg`, `accent_report.json`.

**Motion QC.** Kit motion_check: diff median 1.149, max 33.6, 0→peak jump **False**, empty frames none, longest
near-static run **41** = the hand-off hold 665–705 (body flat + UI stand-in, by design) → the only FAIL reason, same as
in the partial preview (47 there; the 64 spp pass has less noise so the run reads a little shorter). Own tblend
analysis: p95 12.4, largest steps are the three light fades (f64–69 explosion lights in, f175–178 pull-back into the
fade, f191–192 fan lights in; all ≤ 29 at 160 × 90), no near-static run ≥ 12 f at the 5 % threshold. Dark runs
(YAVG < 20): 180–190 (11 f = 0.37 s) and 269–271 (3 f). Nothing new against the partial preview.

**Accent on the final frames** (pass A, 7 × 7 median, reference = seek cap top at f526 = 185,89,55 · hue 15.7° ·
luma 107.0; brand #D9531E = 17° / 108):

| Frame | Piece | sRGB | hue | Δhue | luma | Δluma |
| --- | --- | --- | --- | --- | --- | --- |
| 241 | fan orange cap (dome) | 202,87,40 | 17.4° | +1.7° | 108.1 | +1.0 % |
| 320 | LED | 183,91,59 | 15.5° | −0.2° | 108.2 | +1.1 % |
| 481 | seek cap (start of slide) | 193,95,68 | 13.0° | −2.7° | 113.9 | +6.4 % |
| 526 | seek cap (stop, reference) | 185,89,55 | 15.7° | 0 | 107.0 | 0 |
| 540 | seek cap (before the groove flattens) | 187,89,52 | 16.4° | +0.7° | 107.2 | +0.2 % |
| 600 | display dot | 197,86,34 | 19.1° | +3.4° | 105.8 | −1.1 % |

All within ±4° / ±10 %. LED over f318–337: luma 107.3–108.2 (spread 0.8 % of mean), hue 15.5–16.1°. (The cap is no
longer sampled at f555: it is hidden once the groove has flattened at 541→556.)

**Visual spot check at 100 %** (f100 tight exploded view, f301 press, f526 cap stop, f676 hard cut): no fireflies,
clean DOF, hard cut lands on the UI stand-in at `0:22` with the seek fill at 86.5 %.

**Deliverable for Stage 3:** `film/render/final/preview.mp4` (26 s, no captions burned in; `captions.en.vtt/.srt`
sidecar). Next: Mux upload (Dorin), playback ID into `apps/preview/src/frame/player.ts`, Remotion layer on
`scenes.json` + anchors (film/motion), Playwright capture at 22.5 s for 1.0 s with Tab hops at 681/690/699, sound A/B
proposal, 4:3 version.

### Stage 3 · S2 reframed for the callouts (2026-11-09 evening, Dorin's point 2 after M1)

**Ask.** The motion layer needs the `cap` and `display` anchors on frame in the exploded view (five callouts, no overlaps).
In the approved final they sat above the frame until the pull-back (visible 22 / 20 of 120 frames).

**Method.** A probe (`scratchpad/s2_probe.py`, camera overridden after `frame_set`, baked animation untouched) projected
the anchors, the dock ends and the key-ring diameters through ~30 candidate poses at f61/76/91/106/136/150 in one
Blender run each, so the framing was chosen on numbers, not by eye.

**Result (build_scene.py, commits `673019b` + this one).** Raking view along the body from the right end: 0.58 m,
42 mm, elevation 17°, slow orbit 75° → 70° (f91 → 150), target 50 mm above the body between the mute key and the seek
cap; pull-back f150 → 176 to the whole body at 1.7 m / 66° / 24° (both dock ends in frame). Layer lifts absolute:
keys 50, caps 80, display 110 mm (the old 28/42/56 % of frame height put the lifted display above the top edge in this
view). Aperture f/16 on the tight poses (f/8 left the far pieces as blobs; one extra S2 render). The `body` anchor
moved to the front edge between the seek track and the mute key (the old point beside the captions key is below the
frame now).

| Anchor | Visible | Hold f106–136 (px) |
| --- | --- | --- |
| cap | f77–180 | (759 → 684, 200) |
| display | f78–180 | (738 → 653, 112–123) |
| body | f76–180 | (776 → 770, 700) |
| key_ring | f61–67, 85–180 | (1323 → 1383, 785 → 767) |
| key_travel | f61–67, 91–180 | (1247 → 1329, 856 → 837) |

Callout window from the README is `explode[1] − 500 ms` → `explode[2]` = f91–136: every anchor is on frame for all of
it. Closest anchor pair in the hold: cap–display 81 px (same x, one above the other, so labels go sideways); on
f91–100 the two cross briefly (the display lags the cap by 7 f), minimum 18 px at f94. Trade-off: the near keys are
≈ 21 % of frame height (captions key 22 % across its long axis), below the 30–35 % wished for earlier; with the display
and the cap in the same 1080p frame the keys cannot be larger without cutting them at rest (f61–90).

**Render.** Pass A f61–180 re-rendered twice at 100 % / 64 spp (472 s + 475 s, 3.95 s/frame); composite 61–180,
`preview.mp4` and `preview_3d.mp4` re-encoded, contact sheets regenerated (`render/final/`, 780 frames, 26.000 s, same
colour tags). The other shots are untouched, so the accent table above still holds. motion_check: diff median 0.872,
near-static 41 (hand-off, by design), **0→peak jump now True**: the two hits are at the hook → S2 cut (f60 → 64–66
light fade-in) and the pull-back fade (f168 → 177), the same structures as in the approved final; they trip the flag
only because the new S2 hold is stiller (median down from 1.149) and the relative near-static threshold fell with it.
Own analysis: p95 12.4, dark runs 180–190 (11 f) and 269–271 (3 f), unchanged.

**For film/motion:** `anchors_s2.json` regenerated (committed `673019b`), `scenes.json` unchanged, background frames in
`render/final/out` updated for 61–180; the Remotion layer and the final composite should use the current
`render/final/preview.mp4` / `out/`.

### Stage 3 · dock size B, fan levels, 27.5 s (2026-11-10) · one re-render pass

**Asks.** (1) The skin moved to dock size B (68 px dock, 44 keys, play 76 × 44, pill 36, cap 12 × 26, volume 72): the
flat target of S5–S8 must match the live skin at the hand-off. (2) The fan's caps passed through each other while
opening: one level per cap (≥ 3 mm), non-crossing paths, an automatic intersection test per S3 frame. (3) The live
capture lasts 2.5 s instead of 1 s (caption 5 readable, three Tab hops unhurried): film 27.5 s on the 120 BPM grid.

**Measured on the live skin** (Playwright on `film/motion/capture/index.html`, 1200 × 675, t = 22.5 s, captions
showing, volume set, dock awake; scratchpad `measure_dock.mjs`): dock x 24 w 1152 **y 583 h 68 r 34**; play 36–112
(centre 74); pill 122–352.92 × 36 (centre 237.46) with, from its centre, label −101.46 · rate −49.94 · separator
−3.94 (1 × 14) · current +9.06 · duration +52.26 · dot +95.46; seek track 372.92–856.0, the cap (12 × 26) travels
inside it by its own width (centre = x0 + 6 + (len − 12) · t) and the fill ends under the cap's centre; mute 898;
volume track 936–996 (the 72 px fader's inner 60); captions 1034; settings 1088; fullscreen 1142; icons 20; latch
bar 13 × 2.5, 6 px above the key's bottom edge, accent when captions are on; mute glyph `volume-high` only from
volume 0.75 (0.6 shows `low`).

**Object = UI, so the whole object changed** (1 px = 1 mm): keys 44, play 76 × 44, pill 230.92 × 36 r18, caps
12 × 26 with 3 / 2 ribs of 6 × 1.5, body 68 tall, the captions LED became the latch bar under the glyph (and, with skin 7eef74a, the 2 px accent rim: see
the latch rim section). Every shot re-renders. Framings tuned on 52 mm keys scale by `K_KEY = 44/52` (hook, press, fan distances and offsets); S2 keeps
its raking view with the target moved to x 845 / +45 mm and 16° so the key anchors stay inside the frame at f91
(`anchors_s2.json`: cap f77–180, display f78–180, body f76–180, key_ring f71–180, key_travel f70–180).

**Three more mismatches found while matching the flat frame to the live capture** (edge measurements on a 1920 render
scaled to 1200, scratchpad `edge_full.py`), all also present in the approved 26 s final:
- the flat frame was 0.36 % too large (play key 2 px left, fullscreen key 1.5 px right): the hand-off camera sat
  FINAL_D above z = 0 while the UI plane is the dock's top at z = 16 mm → camera at `DOCK_TOP + FINAL_D`; now every
  edge is within 0.5 px of the live DOM (play 36/111.5, pill 122.5, dot 333–338, keys 1066 / 1120 / 1163, dock 23 /
  1176);
- the pill text was ~1.5× too small: Blender's font size unit is not the CSS em (Geist Mono `HHHH` at size 13 mm
  measured 20.4 mm; the browser draws 31.2 px) → `TEXT_K = 1.52`, letter-spacing in em (`space_character = 1 +
  em / 0.6`); label and rate 10 px / 600 / 0.08 em, times 13 px / 500, each piece placed on its measured left edge;
- the seek fill rendered short from S6 on (only the SEEK_FROM length, the buffer bar over it): the inlays were
  children of `Rig_Dock`, whose flatten squashes z by 100× and turned the 0.03 mm fill-over-buffer separation into a
  z-fight → inlays in world space. `fader_x()` / `fill_len()` give the cap centre and the fill length for a fraction.

**Fan.** `scripts/fan_test.py` builds one BVH per glaze cap on every S3 frame and reports every intersecting pair
(exit 2 on any). Before: 7 pairs intersected on 4–36 frames each (181–216; worst Orange–Stone, 243 face pairs at
f200): the stack put the back caps *higher* (+9 mm · j) and the fan puts them *lower* (−4 mm · j), so every cap
crossed its neighbours' level on the way out. Now the stack keeps the fan's order 14 mm per cap (more than a cap is
thick) and the plan offsets scale with the cap; the fan pose itself (4 mm levels, the approved composition) is
unchanged. **Result: 181–270, no cap pair intersects** (`render/fan_test.json`).

**Timing.** S8 = 646–750 (hard cut f676 = 22.5 s, live window 676–750 = 2.5 s), end card 751–825 (2.5 s), film
27.5 s = 825 frames; `SEEK_FILL` at the cut 81.8 %, `SEEK_END` 90.9 %, display `0:22` → `0:24`, duration `0:27`.
`tab_hops` 688 / 710 / 732 (0.4 s after the cut, then every 0.73 s; 0.6 s left before the end card). Caption 5
21.7–24.4 s (2.7 s). `SEEK_BUFFER` 1.0 and `VOL_FILL` 0.8 so the stand-in matches a capture made with
`--volume 0.8` and the whole film buffered. DAY_T / NIGHT_T unchanged (12.5 / 20 s: flatten and display do not move).

**For film/motion** (after the render): re-capture at 22.5 s for 2.5 s with `--volume 0.8`, captions showing, Tab at
688 / 710 / 732; recomposite on the new `render/final/out`; the layer's exports are regenerated (`scenes.json`,
`anchors_s2/s3/s6.json`, `wipe_edge.json`); a new music cut for 27.5 s (last beat B(55) = 27.5 s; the last downbeat
of a 2 s bar is B(52) = 26.0 s, inside the end card 25.0–27.5 s). The 26 s final is kept in `render/final_26s/`.

**Render.** `render_preview.sh final` started 2026-11-10 (A 1–750, B/M 346–750, composite 825); results below.

### Stage 3 · FINAL render 27.5 s (2026-11-10, `render/final/`) · QC

`render_preview.sh final` ran 15:00 → 16:07 (4035 s): pass A 750 frames at 3.29 s/f (2467 s), pass B 405 frames at
2.76 s/f (1116 s), pass M 405 frames at 0.74 s/f (300 s), composite 825, encode + QC. Then one correction (below) and
a partial re-render of 542–631 in all three passes (A 220 s, B 222 s, M 68 s, recomposite 90 frames, re-encode; 568 s).
Output: `preview.mp4` (1920 × 1080, 30 fps, **825 frames = 27.500 s**, H.264 yuv420p, BT.709 matrix, limited range),
`preview_3d.mp4` (1–750, for motion_check), `out/0001–0825.png`, passes `A/`, `B/`, `M/`, `contact_01..03.jpg`,
`accent_report.json`. The 26 s final stays in `render/final_26s/`.

**Correction found in the spot check: S7 display.** With the pill text at its real size (TEXT_K) the content spans
203 mm instead of ~170 and the hold pose `orbit(PILL_C, 0.42, 22, 26)` cut the accent dot off the right edge (dot
centre projected at x 2031 > 1920 on f586–600; in the approved 26 s final the dot sat at x ≈ 1720). Probed
numerically (scratchpad `s7_probe.py`, label left edge / dot right edge at f586 for d = 0.42…0.60): **0.56 m** puts
them at 242 / 1771 px, where the approved composition had them (≈ 240 / 1770). Camera-only change, frames 542–631
(the move from the cap hold at 541, the hold, the move into the flat display pose at 631); nothing else moved.

**Motion QC.** Kit motion_check on 1–750: diff median 0.680, max 59.0, 0→peak jump True (the f60 cut and the f168
fade, documented in Stage 3 · S2), empty frames none, longest near-static run **38** = the hand-off hold (body flat
f661 + UI stand-in; the seek fill and the display still move, so the run is shorter than the 41 of the 26 s final) →
the only FAIL reason, by design. Own tblend analysis: median 2.79, p95 13.3, largest steps f64–68 (explosion lights
in, ≤ 30), f175–178 (pull-back into the fade, ≤ 28), f191–194 (fan lights in, 52 at f192 — the dark run before it
is 12 f now instead of 11), no near-static run ≥ 12 f at the 5 % threshold. Dark runs (YAVG < 20): 180–191 (12 f =
0.4 s) and 269–271 (3 f).

**Accent on the final frames** (pass A, 7 × 7 median, reference = seek cap top at f526 = 183,89,56 · hue 15.6° ·
luma 106.6; brand #D9531E = 17° / 108):

| Frame | Piece | sRGB | hue | Δhue | luma | Δluma |
| --- | --- | --- | --- | --- | --- | --- |
| 241 | fan orange cap (dome) | 202,87,41 | 17.1° | +1.5° | 108.1 | +1.4 % |
| 320 | latch bar (captions key; replaced by the rim below) | 183,91,58 | 15.8° | +0.2° | 108.2 | +1.5 % |
| 481 | seek cap (start of slide) | 191,95,69 | 12.8° | −2.8° | 113.5 | +6.5 % |
| 526 | seek cap (stop, reference) | 183,89,56 | 15.6° | 0 | 106.6 | 0 |
| 540 | seek cap (before the groove flattens) | 186,89,53 | 16.2° | +0.6° | 107.0 | +0.4 % |
| 600 | display dot | 197,86,34 | 19.1° | +3.5° | 105.8 | −0.8 % |

All within ±4° / ±10 %, the same values as the 26 s final within 0.2° / 0.5 %. Latch bar (then) over f318–337: luma
107.2–108.2 (spread 0.9 % of mean), hue 15.4–16.1°. New sample: the seek fill at f481 (inlay 30 mm into the track)
reads 184,128,114 · hue 12.0° · luma +30 %: a defocused foreground strip under the S6 key light at a raking angle,
not a calibration target (the fill's hex is exact in the flat frames through pass B).

**Flat frame f676 against the live screenshot** (overlay check in 1200-px CSS units, accent-pixel boxes): play key
37–110 × 596/597–640 (live 37–110 × 597–640), dot 333–338 × 614–619 (same), latch bar 1028–1039 × 631–632 (live
1028–1040 × 632–633), dock bone 24–1175 (same), seek fill 373–769 = 81.8 % of the 372.92–856 track (the live shot
was taken on the 26 s film at 22.5 s = 86.5 % → 792; the stand-in follows the 27.5 s film). Pill contents at 3×:
indistinguishable from the live DOM (duration 0:27 vs the screenshot's 0:26).

**Visual spot check at 100 %** (f106 raking exploded view with the key anchors in frame, f226 fan on levels, f301
press with the latch bar, f526 cap stop, f560 / f586 / f600 / f615 display, f640 flat display, f676 hard cut, f750
`0:24`): no fireflies, no z-fight on the inlays, the seek fill under the cap all the way, the caps' ribs 3 / 2, the
volume cap on its 60 px track. Contact sheets `contact_01..03.jpg`.

**Callout labels.** `export_anchors.py` still carried the 52 mm labels and local points (`Ø 52 · ring 1.25`,
`cap 14×32`, `display r22`, points 4 mm outside the new pieces); the motion layer types them verbatim → `Ø 44 · ring
1.25`, `cap 12×26`, `display r18`, points on the dock B edges (ring 22, cap end 13, pill corner 97.46 / 18, body
front −34). `anchors_s2.json` re-exported: same visibility windows (key_ring / key_travel 61–180, body 76–180, cap
77–180, display 78–180), positions moved ≤ 35 px.

**Hand-off to film/motion** (unchanged from above): re-capture at 22.5 s for 2.5 s with `--volume 0.8`, captions
showing, Tab at 688 / 710 / 732; recomposite on `render/final/out` (825 frames); `scenes.json`, `anchors_s2/s3/s6.json`,
`wipe_edge.json` current; new music cut for 27.5 s, dry end on the last downbeat (B(52) = 26.0 s inside the end card,
last beat B(55) = 27.5 s). Then Mux (new playback ID in `apps/preview/src/frame/player.ts`).


### Stage 3 · latch rim (2026-11-10) · skin 7eef74a

**Ask.** The latched captions key no longer has an LED bar: a 2 px rim in the accent colour around the key, the glyph
ink, the key 1 px down (stone adds a 1 px ink keyline, the film stays on bone). Take the bar out of the model, put the
rim in (2 px at the 44 px scale → 2 mm, like the 1.25 ring), re-render the frames where the key is latched, QC the
rim's accent against the seek cap and the flat frame against a *new* live capture, update the texts, tell film/motion.

**Measured on the live skin after 7eef74a** (Playwright on the capture page, 1200 × 675, t = 22.5 s of the 27.5 s
film, `--volume 0.8`, captions showing; scratchpad `measure_dock3.mjs`, screenshot `dock_live3.png`): captions key
box 1012–1056 × 596–640 (`translate: 0 1px`: 1 px lower than mute / settings / fullscreen at 595), computed border
`2px rgb(217, 83, 30)`, background still `#F3F0EB`, box-shadow `0 1px 0 #C2BBB1`; accent pixels on row 618 at
1012–1013 and 1054–1055, on column 1034 at 596–597 and 638–639 (2 px, inside the 44 px box). The play key (playing =
latched) sits at 36–112 × 596–640, also 1 px down.

**Model.** No separate rim piece: the captions key's ledge (1.25, ink) and the rounded face edge just inside it are
built with two materials that carry a second UI colour mixed in by the object attribute `latch` (0 → 1, `InkLatch` =
ink → accent, `KeyLatch` = key → accent, flat emission exact in pass B), and its edge radius is `RIM_W − OUTLINE` =
0.75 so ledge + edge = **2.0 mm** seen from above (1.25 ink ring + 0.75 face when unlatched, as every other key). The
top n-gon keeps the key material (it inherits the edge band's by construction). `latch` keys 0 → 1 on f305–309, the
old LED window (130 ms after the press; `--tactile-dur-rim` 150 ms). The key stays **1 mm lower** after the press
(`DOCK_TOP − LATCH_TRAVEL`, the 0.6 overshoot relative to it) and, while it flattens (346–376), the 1 mm travel
becomes the UI's `translate: 0 1px`: 1 mm down the screen (−y) and back onto the UI plane, inside its eccentric well
(the 2 mm shade crescent under it becomes 1 mm, as the latched box-shadow). The play key takes the same 1 px drop at
the morph (f661, playing = latched). The LED object, its `lit` keys and material, and the hook's light-linking entry
are gone; `scenes.json` keeps `events.led` as an alias of the new `events.latch` (305–309) for the motion layer.

**Rim accent while 3D.** The rim exists only under the S4–S5 window sun (latched f305, a drawing from f376). With the
accent's physical base and the key's own gain it whitened (229,185,171 at f320, +81 %); with the seek cap's S4–S5 gain
(0.74, 0.68, 0.18) it read +30 %; the latch colour therefore has its own gain `LATCH_GAIN` (object attribute
`latch_gain`), matte materials (spec 0.15, rough 0.6) against the sun's highlight, calibrated on f320 / f340 renders
(scratchpad `rim_probe.py`, eight points around the ledge): **(0.41, 0.37, 0.14) → ledge 200,86,35 = hue 18.4° / luma
106.6** against the cap's 15.6° / 106.6, uniform around the key at f340 (±1 luma); at f320 the far edge (top of the
frame, out of focus against the sunlit dock) blends toward bone, and the shaded face edge reads darker (163,59,4), the
3D shading. `accent_report.py` samples the rim on the key's left side (−21.4, 0, 1.5), in focus in S4.

**Flat frame f676 against the new capture** (pass B at 100 %, scratchpad `ring_check.py`, accent-pixel runs in
1200-px CSS units): rim row 618 **1012–1013 / 1054–1055**, column 1034 **596–597 / 638–639**, bbox 1012–1055 ×
596–639: identical to the DOM; play key 37–110 × 597–640 (same), the ink rings of mute / settings / fullscreen
unchanged.

**Re-render.** The LED was a dark slot in the key's face whenever the key was unlatched, so taking it out changes every
frame that shows the captions key, not only the latched window: probed per frame (scratchpad `cc_vis.py`, the key's
ring projected into the camera) the key is in frame on **1–71, 80–187, 271–465, 644–750**; pass A re-rendered on
1–187, 271–465, 644–750 (489 frames), B and M on 346–465 and 644–750 (227 each), recomposite, re-encode.
Ran 16:54 → 17:37 (2589 s): A 187 f in 770 s, 195 f in 808 s, 107 f in 124 s (3.4 s/f on the 3D shots, 1.2 s/f on the
flat hand-off); B 120 f in 456 s and 107 f in 128 s; M 120 f in 90 s and 107 f in 80 s; composite 489 frames, `preview.mp4`
825 frames = 27.500 s (same encode settings), `preview_3d.mp4`, contact sheets, `accent_report.json`. **`render/final/out`
is final.**

**Motion QC.** Kit motion_check on 1–750: diff median 0.669, max 59.0, 0→peak jump True (f60 cut / f168 fade, as before),
empty frames none, longest near-static run **73 = 678–750**, the whole hand-off hold (before, a noise-level dip around
f712 split it into 38; the seek fill and the display still move, below the kit's threshold) → the only FAIL reason, by
design. Own tblend analysis: median 2.78, p95 13.1, the same three light steps (f64–68 ≤ 30, f175–178 ≤ 28, f192 52),
no near-static run ≥ 12 f at the 5 % threshold, dark runs 180–191 (12 f) and 269–271 (3 f). Per-shot medians within
0.03 of the previous render except S4 (4.65 vs 4.87: the dark LED slot no longer flickers under the sun).

**Accent on the final frames** (pass A, 7 × 7 median, reference = seek cap top at f526 = 183,89,56 · hue 15.6° ·
luma 106.6):

| Frame | Piece | sRGB | hue | Δhue | luma | Δluma |
| --- | --- | --- | --- | --- | --- | --- |
| 241 | fan orange cap (dome) | 202,87,41 | 17.1° | +1.5° | 108.1 | +1.4 % |
| 320 | latch rim (ledge, left side) | 200,85,34 | 18.4° | +2.8° | 105.8 | −0.8 % |
| 340 | latch rim | 200,86,34 | 18.8° | +3.2° | 106.5 | −0.1 % |
| 481 | seek cap (start of slide) | 191,95,69 | 12.8° | −2.8° | 113.5 | +6.5 % |
| 526 | seek cap (stop, reference) | 183,89,56 | 15.6° | 0 | 106.6 | 0 |
| 540 | seek cap (before the groove flattens) | 186,89,53 | 16.2° | +0.6° | 107.0 | +0.4 % |
| 600 | display dot | 197,86,34 | 19.1° | +3.5° | 105.8 | −0.8 % |

All within ±4° / ±10 %. **Latch rim over f318–337: luma 105.8–106.6 (spread 0.8 % of mean), hue 18.2–18.8°** → constant
while the camera moves. (The seek fill sample at f481, 184,128,114, is the defocused foreground strip noted above, not
a target.)

**Flat frame f676 (composite) against the new live capture** (`ring_check.py`, 1200-px units): rim row 618 1012–1013 /
1054–1055, column 1034 596–597 / 638–639, bbox 1012–1055 × 596–639 — **identical to the DOM**; play key 37–110 ×
597–640 (identical, the 1 px latch drop included); mute / settings / fullscreen ink rings unchanged.

**Visual spot check at 100 %** (f40 hook: the ring's lit crescent without the dark slot, f106, f301 press, f320 / f340
rim under the sun, f376 the key becoming its drawing with the rim, f400, f676 hard cut, f750): no fireflies, the rim
reads as one 2 px line in the flat frames (8× crop against the live crop: same), the face stays key, the glyph ink.

**Texts.** This brief (pieces table, dock B section, the QC table above), `scripts/accent_report.py` and
`scripts/measure.py` (rim samples instead of the LED), `scripts/build_scene.py` (`RIM_W`, `LATCH_TRAVEL`,
`LATCH_GAIN`, `F_LATCH`). No anchor or caption names the LED; the motion layer's `events.led` keeps working.

## 9. Review gates

1. Stage 1: 3 style frames + measurements → approved after 3 rounds (2026-11-09).
2. **Stage 2 (now):** preview 50 % / 16 spp of frames 1–975, three passes, `motion_check.py` PASS, contact sheets
   fps 2 / 6 × 4, transitions checked → OK / notes.
3. Stage 3: final 100 % / 64 spp; live capture (Playwright virtual clock); Remotion layer; sound A or B; export H.264
   yuv420p BT.709 limited (ffprobe); Mux upload by Dorin; playback ID into `apps/preview/src/frame/player.ts`.
