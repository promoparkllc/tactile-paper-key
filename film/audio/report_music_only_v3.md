# Sound · music only · 2026-11-10 14:44

video: film/render/final/preview.mp4
grid: 30 fps · 15 f/beat · 825 frames = 27.5 s · frame 1 = t 0

Decision 2026-11-10: the film carries the music alone, no SFX and no room tone. The SFX cue sheet stays in cues.json / report.md.


## Music

Punchy Staccato.mp3: stretched from 121.02 to 120 BPM (atempo 0.99157, pitch kept), then cut from 107.133 s for 27.5 s (that point of the stretched track lands on frame 1 / beat 1; 120 BPM = 15 frames a beat), measured -14.2 LUFS, then normalised on its own to -14 LUFS, hard stop at 26.19 s of the film (25 ms fade against the click), silence to the end. End-card beats at 25.00 / 25.50 / 26.00 s.

## Loudness (measured on the muxed files, ebur128)

| file | integrated | LRA | true peak | gain | input I / TP |
| --- | --- | --- | --- | --- | --- |
| final_music_only_v3.mp4 | **-14.0 LUFS** | 3.6 LU | **-3.5 dBTP** | linear | -21.12 / -11.52 |

Target: -14 LUFS integrated, true peak ≤ −1 dBTP. One linear gain per file after measuring (no dynamic loudness riding, which would lift the room tone of a sparse SFX track); the music mix may add a true-peak limiter on the few hits that would cross the ceiling, the SFX-only version stops at the ceiling unless run with --limit-sfx.

## ffprobe

### final_music_only_v3.mp4

```
index=0
codec_name=h264
codec_type=video
width=1920
height=1080
pix_fmt=yuv420p
color_range=tv
color_space=bt709
color_transfer=iec61966-2-1
color_primaries=bt709
r_frame_rate=30/1
bit_rate=2606544
nb_frames=825
index=1
codec_name=aac
codec_type=audio
sample_rate=48000
channels=2
r_frame_rate=0/0
bit_rate=194575
nb_frames=1291
duration=27.500000
size=9660184
bit_rate=2810235
```

