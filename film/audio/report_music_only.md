# Sound · music only · 2026-11-10 11:03

video: film/motion/out/final/tactile_from_object_to_interface_1080p.mp4
grid: 30 fps · 15 f/beat · 780 frames = 26 s · frame 1 = t 0

Decision 2026-11-10: the film carries the music alone, no SFX and no room tone. The SFX cue sheet stays in cues.json / report.md.


## Music

Three Staccato Hits.mp3: cut from 56.03 s for 26 s (that point of the track lands on frame 1 / beat 1; 120 BPM = 15 frames a beat), measured -14.4 LUFS, set to -21 LUFS under the SFX (-6.6 dB), 0.5 s fade-out. End-card beats at 24.00 / 24.50 / 25.00 s.

## Loudness (measured on the muxed files, ebur128)

| file | integrated | LRA | true peak | gain | input I / TP |
| --- | --- | --- | --- | --- | --- |
| final_music_only.mp4 | **-14.0 LUFS** | 1.4 LU | **-3.6 dBTP** | linear | -21.01 / -10.76 |

Target: -14 LUFS integrated, true peak ≤ −1 dBTP. One linear gain per file after measuring (no dynamic loudness riding, which would lift the room tone of a sparse SFX track); the music mix may add a true-peak limiter on the few hits that would cross the ceiling, the SFX-only version stops at the ceiling unless run with --limit-sfx.

## ffprobe

### final_music_only.mp4

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
bit_rate=6472686
nb_frames=780
index=1
codec_name=aac
codec_type=audio
sample_rate=48000
channels=2
r_frame_rate=0/0
bit_rate=212671
nb_frames=1220
duration=26.000000
size=21756380
bit_rate=6694270
```

