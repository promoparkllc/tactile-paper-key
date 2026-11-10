# Sound · 2026-11-10 10:58

video: film/motion/out/final/tactile_from_object_to_interface_1080p.mp4
grid: 30 fps · 15 f/beat · 780 frames = 26 s · frame 1 = t 0

## Cue sheet (Blender frames)

| frame | t (s) | type | sample | onset in sample | gain | peak target | note |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 166 | 5.500 | join_clunk | join_clunk_a.mp3 | 0.24 s | -6.35 dB | -6 dBFS | parts rejoin (explode[3]) |
| 226 | 7.500 | ceramic_settle | ceramic_settle_a.mp3 | 0.27 s | -12.1 dB | -12 dBFS | fan cap yellow settles (fan[1] + 0) |
| 229 | 7.600 | ceramic_settle | ceramic_settle_b.mp3 | 0.21 s | -11.64 dB | -12 dBFS | fan cap stone settles (fan[1] + 3) |
| 232 | 7.700 | ceramic_settle | ceramic_settle_a.mp3 | 0.27 s | -12.1 dB | -12 dBFS | fan cap orange settles (fan[1] + 6) |
| 235 | 7.800 | ceramic_settle | ceramic_settle_b.mp3 | 0.21 s | -11.64 dB | -12 dBFS | fan cap graphite settles (fan[1] + 9) |
| 241 | 8.000 | ceramic_settle | ceramic_settle_a.mp3 | 0.27 s | -12.1 dB | -12 dBFS | bone cap up (bone_up[1]) |
| 301 | 10.000 | key_hero | key_hero_a.mp3 | 0.62 s | 1.8 dB | -6 dBFS | the press (press) |
| 376 | 12.500 | tick_light | tick_light_a.mp3 | 0.04 s | -6.99 dB | -16 dBFS | key cc flat (keys_flat.cc) |
| 391 | 13.000 | tick_light | tick_light_b.mp3 | 0.68 s | -12.85 dB | -16 dBFS | key mute flat (keys_flat.mute) |
| 406 | 13.500 | tick_light | tick_light_c.mp3 | 0.67 s | -15.58 dB | -16 dBFS | key settings flat (keys_flat.settings) |
| 421 | 14.000 | tick_light | tick_light_a.mp3 | 0.04 s | -6.99 dB | -16 dBFS | key fs flat (keys_flat.fs) |
| 436 | 14.500 | tick_light | tick_light_b.mp3 | 0.68 s | -12.85 dB | -16 dBFS | key play flat (keys_flat.play) |
| 526 | 17.500 | fader_slide | fader_slide_a.mp3 | 1.56 s | -5.13 dB | -14 dBFS | cap stop (cap_slide[1]); the slide runs from cap_slide[0] |
| 586 | 19.500 | display_on | display_on_a.mp3 | 0 s | -9.4 dB | -18 dBFS | display lights (display_on[0]) |
| 681 | 22.667 | tick_light | tick_light_c.mp3 | 0.67 s | -15.58 dB | -16 dBFS | Tab hop (tab_hops) |
| 690 | 22.967 | tick_light | tick_light_a.mp3 | 0.04 s | -6.99 dB | -16 dBFS | Tab hop (tab_hops) |
| 699 | 23.267 | tick_light | tick_light_b.mp3 | 0.68 s | -12.85 dB | -16 dBFS | Tab hop (tab_hops) |
| 721 | 24.000 | key_hero | key_hero_b.mp3 | 0.1 s | -5.41 dB | -6 dBFS | end card beat 1 (END.start + 1·fpb) |
| 736 | 24.500 | key_hero | key_hero_c.mp3 | 0.66 s | -2.13 dB | -6 dBFS | end card beat 2 (END.start + 2·fpb) |
| 751 | 25.000 | key_hero | key_hero_a.mp3 | 0.62 s | 1.8 dB | -6 dBFS | end card beat 3 (END.start + 3·fpb) |

Room tone: room_tone_loop.mp3 over the whole film at RMS -50 dBFS (gain 16.6 dB), 0.5 s fades. Each hit is aligned by its detected onset (first 10 ms window within 12 dB of the sample's loudest), 30 ms of pre-roll kept; the fader slide's loudest point (the stop) lands on cap_slide[1] and the slide body starts at cap_slide[0].

## Music

Punchy Staccato.mp3: cut from 56.03 s for 26 s (that point of the track lands on frame 1 / beat 1; 120 BPM = 15 frames a beat), measured -15.2 LUFS, set to -21 LUFS under the SFX (-5.76 dB), 0.5 s fade-out. End-card beats at 24.00 / 24.50 / 25.00 s.

## Loudness (measured on the muxed files, ebur128)

| file | integrated | LRA | true peak | gain | input I / TP |
| --- | --- | --- | --- | --- | --- |
| final_sfx_only.mp4 | **-21.2 LUFS** | 20.4 LU | **-1.1 dBTP** | linear to the ceiling (4.6 dB; the target would need 10.6 dB) | -26.65 / -5.57 |
| final_music_sfx.mp4 | **-15.7 LUFS** | 2.4 LU | **-1.2 dBTP** | linear + true-peak limiter (0.8 dB over the ceiling caught) | -20.63 / -4.80 |

Target: −16 LUFS integrated, true peak ≤ −1 dBTP. One linear gain per file after measuring (no dynamic loudness riding, which would lift the room tone of a sparse SFX track); the music mix may add a true-peak limiter on the few hits that would cross the ceiling, the SFX-only version stops at the ceiling unless run with --limit-sfx.

## ffprobe

### final_sfx_only.mp4

```
index=0
codec_name=h264
codec_type=video
width=1920
height=1080
pix_fmt=yuv420p
color_range=tv
color_space=bt709
color_transfer=bt709
color_primaries=bt709
r_frame_rate=30/1
bit_rate=6483760
nb_frames=777
index=1
codec_name=aac
codec_type=audio
sample_rate=48000
channels=2
r_frame_rate=0/0
bit_rate=194213
nb_frames=1218
duration=25.949896
size=21649987
bit_rate=6674396
```

### final_music_sfx.mp4

```
index=0
codec_name=h264
codec_type=video
width=1920
height=1080
pix_fmt=yuv420p
color_range=tv
color_space=bt709
color_transfer=bt709
color_primaries=bt709
r_frame_rate=30/1
bit_rate=6483760
nb_frames=777
index=1
codec_name=aac
codec_type=audio
sample_rate=48000
channels=2
r_frame_rate=0/0
bit_rate=204336
nb_frames=1218
duration=25.949896
size=21682850
bit_rate=6684527
```

