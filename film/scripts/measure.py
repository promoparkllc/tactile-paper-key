"""Measure a rendered frame against the skin's hex targets (Blender 5.2 headless; numpy ships with Blender).

    blender --background --factory-startup film/scene.blend --python-exit-code 1 --python film/scripts/measure.py -- \
        <frame.png> <frame_number> --set <hook|fan|flatten|match> [--zoom <out.png>] [--json <out.json>]

For each sample point (object + local offset) the point is projected through the scene camera at that frame and a
9 × 9 px patch is read from the PNG (display-referred sRGB bytes, the same numbers a screenshot would give). Printed:
median sRGB, Rec.709 luma (on the bytes, like ffmpeg signalstats YAVG), the target hex, its luma, and the per-channel
ratio target ÷ measured in linear light — the multiplier the physical base colour would need under this light
(02-3D-BLENDER: base = target ÷ light, measured). Frame statistics (mean, percentiles, clipped %) follow.
`--zoom` writes a nearest-neighbour 8 × crop around the set's engraved ring point.
"""
import bpy

assert bpy.app.version >= (5, 2, 0)

import json
import os
import subprocess
import sys

import numpy as np
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Vector

args = sys.argv[sys.argv.index('--') + 1:]
PNG, FRAME = args[0], int(args[1])
SET = args[args.index('--set') + 1] if '--set' in args else 'match'
ZOOM = args[args.index('--zoom') + 1] if '--zoom' in args else None
ZOOM2 = args[args.index('--zoom2') + 1] if '--zoom2' in args else None
JSON_OUT = args[args.index('--json') + 1] if '--json' in args else None

sc = bpy.data.scenes['Film']
sc.frame_set(FRAME)
dg = bpy.context.evaluated_depsgraph_get()
dg.update()

img = bpy.data.images.load(PNG, check_existing=True)
W, H = img.size
px = np.array(img.pixels[:], dtype=np.float32).reshape(H, W, 4)[::-1, :, :3]   # row 0 = top
px8 = np.clip(np.round(px * 255), 0, 255).astype(np.int32)
PX = 0.001


def lin(c8):
    c = np.asarray(c8, dtype=np.float64) / 255
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def hex_to_rgb(h):
    h = h.lstrip('#')
    return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)])


def luma(c8):
    return 0.2126 * c8[0] + 0.7152 * c8[1] + 0.0722 * c8[2]


def hue(c8):
    r, g, b = [float(v) / 255 for v in c8]
    mx, mn = max(r, g, b), min(r, g, b)
    if mx - mn < 1e-6:
        return None
    if mx == r:
        h = (g - b) / (mx - mn) % 6
    elif mx == g:
        h = (b - r) / (mx - mn) + 2
    else:
        h = (r - g) / (mx - mn) + 4
    return 60 * h


def project(ob, local):
    mw = ob.evaluated_get(dg).matrix_world
    co = world_to_camera_view(sc, sc.camera, mw @ Vector(local))
    return int(round(co.x * W)), int(round((1 - co.y) * H)), co.z


def patch(x, y, r=4):
    x0, x1 = max(0, x - r), min(W, x + r + 1)
    y0, y1 = max(0, y - r), min(H, y + r + 1)
    return np.median(px8[y0:y1, x0:x1].reshape(-1, 3), axis=0).astype(int)


KEY_FACE = (0, -17 * PX, 2.0 * PX)             # on the face, below the icon (face objects: Key_<name>_face)
RING_BOTTOM = (0, -(26 - 0.62) * PX, 1.5 * PX)  # ink ledge, front of the key
SETS = {
    'hook': [
        ('key face (Captions, below icon)', 'Key_Captions', KEY_FACE, None),
        ('key face (Captions, lit side, toward rim)', 'Key_Captions', (9 * PX, 15 * PX, 2.0 * PX), None),
        ('key face, top area (near the LED)', 'Key_Captions', (6 * PX, 12 * PX, 2.0 * PX), None),
        ('key face, top area (left of the LED)', 'Key_Captions', (-8 * PX, 14 * PX, 2.0 * PX), None),
        ('ink ring (Captions, lit crescent, frame left)', 'Key_Captions', (-24.6 * PX, -6 * PX, 1.5 * PX), '#2A2724'),
        ('engraving floor (captions rect, left edge)', 'Key_Captions', (-8.6 * PX, 0.0, 1.75 * PX), '#2A2724'),
        ('face next to the engraving', 'Key_Captions', (-11 * PX, 0.0, 2.0 * PX), None),
        ('dock top (left of key)', 'Dock', ((960 - 600) * PX, 0.0, 0.0), None),
        ('linen (front-left)', 'Linen', (0.30, -0.36, 0.0), None),
    ],
    'fan': [
        ('Bone face (dome centre)', 'Key_GlazeBone', (0, 0, 8.2 * PX), '#F3F0EB'),
        ('Bone face (lower, toward camera)', 'Key_GlazeBone', (0, -12 * PX, 7.9 * PX), '#F3F0EB'),
        ('Graphite face (ceramic recipe #0E0E0E)', 'Key_GlazeGraphite', (0, 0, 8.2 * PX), '#0E0E0E'),
        ('Stone face', 'Key_GlazeStone', (0, 0, 8.2 * PX), '#A8A49D'),
        ('Orange face (accent)', 'Key_GlazeOrange', (0, 0, 8.2 * PX), '#D9531E'),
        ('Yellow face', 'Key_GlazeYellow', (0, 0, 8.2 * PX), '#E4C94A'),
        ('ink ring (Bone, lower edge)', 'Key_GlazeBone', (0, -(26 - 3.2) * PX, 6.8 * PX), '#2A2724'),
        ('ink ring (Orange, lower edge)', 'Key_GlazeOrange', (0, -(26 - 3.2) * PX, 6.8 * PX), '#2A2724'),
        ('background (black)', 'Linen', (0.06, -0.30, 0.0), None),
    ],
    'flatten': [
        ('key face (Captions)', 'Key_Captions', KEY_FACE, '#F3F0EB'),
        ('key face (Mute)', 'Key_Mute', KEY_FACE, '#F3F0EB'),
        ('key face (Settings)', 'Key_Settings', KEY_FACE, '#F3F0EB'),
        ('key face (Fullscreen)', 'Key_Fullscreen', KEY_FACE, '#F3F0EB'),
        ('body (between Captions and Settings)', 'Dock', ((1033 - 600) * PX, 0.0, 0.0), '#E7E4DE'),
        ('body (right of Fullscreen)', 'Dock', ((1167 - 600) * PX, 0.0, 0.0), '#E7E4DE'),
        ('ink ring (Captions, front)', 'Key_Captions', RING_BOTTOM, '#2A2724'),
        ('ink ring (Fullscreen, front)', 'Key_Fullscreen', RING_BOTTOM, '#2A2724'),
        ('ink (volume line)', 'Dock', ((890 - 600) * PX, 0.0, -1.2 * PX), '#2A2724'),
        ('shade (well under Mute)', 'Dock', ((836 - 600) * PX, -27 * PX, -2 * PX), '#C2BBB1'),
        ('linen (above the dock)', 'Linen', (0.40, -0.10, 0.0), None),
    ],
    'flat3d': [
        ('key face (Captions, physical)', 'Key_Captions', KEY_FACE, '#F3F0EB'),
        ('key face (Fullscreen, physical)', 'Key_Fullscreen', KEY_FACE, '#F3F0EB'),
        ('body bone (between Captions and Settings)', 'Dock', ((1033 - 600) * PX, 0.0, 0.0), '#E7E4DE'),
        ('body bone (above the volume line)', 'Dock', ((918 - 600) * PX, 20 * PX, 0.0), '#E7E4DE'),
        ('body bone (left of Mute)', 'Dock', ((790 - 600) * PX, 0.0, 0.0), '#E7E4DE'),
        ('body bone (right of Fullscreen)', 'Dock', ((1167 - 600) * PX, 0.0, 0.0), '#E7E4DE'),
        ('body bone (between Mute and volume)', 'Dock', ((869 - 600) * PX, -28 * PX, 0.0), '#E7E4DE'),
        ('accent (LED, lit)', 'LED', (0.0, 0.0, 2.02 * PX), '#D9531E'),
        ('ink ring (Captions, front)', 'Key_Captions', RING_BOTTOM, '#2A2724'),
        ('ink (volume line floor)', 'Dock', ((890 - 600) * PX, 0.0, -1.2 * PX), '#2A2724'),
        ('shade (well under Mute)', 'Dock', ((836 - 600) * PX, -27 * PX, -2 * PX), '#C2BBB1'),
        ('linen', 'Linen', (0.40, -0.10, 0.0), None),
    ],
    'flatflat': [
        ('key face (Captions, flat)', 'Key_Captions', KEY_FACE, '#F3F0EB'),
        ('key face (Fullscreen, flat)', 'Key_Fullscreen', KEY_FACE, '#F3F0EB'),
        ('body bone (flat)', 'Dock', ((1033 - 600) * PX, 0.0, 0.0), '#E7E4DE'),
        ('accent (LED)', 'LED', (0.0, 0.0, 2.02 * PX), '#D9531E'),
        ('ink ring (Captions, flat)', 'Key_Captions', RING_BOTTOM, '#2A2724'),
        ('ink (volume line, flat)', 'Dock', ((890 - 600) * PX, 0.0, -1.2 * PX), '#2A2724'),
        ('shade (well under Mute, flat)', 'Dock', ((836 - 600) * PX, -27 * PX, -2 * PX), '#C2BBB1'),
        ('field (#E7E4DE)', 'Linen', (0.40, -0.10, 0.0), '#E7E4DE'),
    ],
    'bodyhue': [
        ('body (between Mute and volume)', 'Dock', ((869 - 600) * PX, 0.0, 0.0), '#E7E4DE'),
        ('body (between Captions and Settings)', 'Dock', ((1033 - 600) * PX, 0.0, 0.0), '#E7E4DE'),
        ('body (above the seek line)', 'Dock', ((600 - 600) * PX, 24 * PX, 0.0), '#E7E4DE'),
        ('body (below the seek line)', 'Dock', ((500 - 600) * PX, -24 * PX, 0.0), '#E7E4DE'),
        ('body (right of the display)', 'Dock', ((403 - 600) * PX, 0.0, 0.0), '#E7E4DE'),
        ('body (left end)', 'Dock', ((33 - 600) * PX, 0.0, 0.0), '#E7E4DE'),
        ('key face (Mute)', 'Key_Mute_face', KEY_FACE, '#F3F0EB'),
        ('key face (Captions)', 'Key_Captions_face', KEY_FACE, '#F3F0EB'),
    ],
    'bodyhue7': [
        ('body (left of the display)', 'Dock', ((140 - 600) * PX, 0.0, 0.0), '#E7E4DE'),
        ('body (right of the display)', 'Dock', ((405 - 600) * PX, 0.0, 0.0), '#E7E4DE'),
        ('body (above the display)', 'Dock', ((274 - 600) * PX, 36 * PX, 0.0), '#E7E4DE'),
        ('body (below the display)', 'Dock', ((274 - 600) * PX, -36 * PX, 0.0), '#E7E4DE'),
        ('body (right, near Play)', 'Dock', ((145 - 600) * PX, 30 * PX, 0.0), '#E7E4DE'),
    ],
    'match': [
        ('key face (Captions)', 'Key_Captions', KEY_FACE, '#F3F0EB'),
        ('key face (Mute)', 'Key_Mute', KEY_FACE, '#F3F0EB'),
        ('body (between Captions and Settings)', 'Dock', ((1033 - 600) * PX, 0.0, 0.0), '#E7E4DE'),
        ('body (left of Play)', 'Dock', ((33 - 600) * PX, 0.0, 0.0), '#E7E4DE'),
        ('accent (Play face)', 'Key_Play', (-30 * PX, -14 * PX, 2.0 * PX), '#D9531E'),
        ('accent (seek fill)', 'inlay_seek_fill', (0.0, 0.0, 0.0), '#D9531E'),
        ('ink ring (Captions, front)', 'Key_Captions', RING_BOTTOM, '#2A2724'),
        ('ink (seek line)', 'Dock', ((760 - 600) * PX, 0.0, -1.2 * PX), '#2A2724'),
        ('display (right of dot)', 'Display', (105 * PX, 0.0, 0.6 * PX), '#151413'),
        ('shade (well under Mute)', 'Dock', ((836 - 600) * PX, -27 * PX, -2 * PX), '#C2BBB1'),
        ('buffer (seek)', 'inlay_seek_buffer', (0.03, 0.0, 0.0), '#888177'),
        ('background', 'Linen', (0.0, 0.2, 0.0), None),
    ],
}
ZOOM_POINT = {
    'hook': ('Key_Captions', (-24.6 * PX, -6 * PX, 1.5 * PX)),
    'fan': ('Key_GlazeBone', (0, -(26 - 3.2) * PX, 6.8 * PX)),
    'flatten': ('Key_Captions', RING_BOTTOM),
    'flat3d': ('Key_Captions', RING_BOTTOM),
    'flatflat': ('Key_Captions', RING_BOTTOM),
    'match': ('Key_Captions', RING_BOTTOM),
}

rows = []
print(f'\nframe {FRAME} · set {SET} · {os.path.basename(PNG)} · {W}×{H}')
print(f'{"sample":44s} {"px":>11s}  {"sRGB":>13s} {"Y":>5s}   {"target":>8s} {"Yt":>5s}  {"ratio lin (r g b)":>22s}')
for label, obname, local, target in SETS[SET]:
    ob = bpy.data.objects.get(obname)
    if ob is None:
        print(f'{label:44s} (no object {obname})')
        continue
    x, y, z = project(ob, local)
    if z <= 0 or not (0 <= x < W and 0 <= y < H):
        print(f'{label:44s} off frame ({x},{y})')
        continue
    c = patch(x, y)
    yv = luma(c)
    row = dict(label=label, x=x, y=y, srgb=[int(v) for v in c], luma=round(float(yv), 1))
    if target:
        t = hex_to_rgb(target)
        ratio = lin(t) / np.maximum(lin(c), 1e-4)
        row.update(target=target, target_luma=round(float(luma(t)), 1), ratio=[round(float(v), 3) for v in ratio])
        hm, ht = hue(c), hue(t)
        sat = (int(max(c)) - int(min(c))) / max(int(max(c)), 1)
        hue_txt = f'  hue {hm:5.1f}° (target {ht:5.1f}°, Δ {((hm - ht + 180) % 360) - 180:+5.1f}°) sat {sat:.2f}' if hm is not None and ht is not None else f'  sat {sat:.2f}'
        row['sat'] = round(sat, 3)
        if hm is not None and ht is not None:
            row['hue'], row['target_hue'] = round(hm, 1), round(ht, 1)
        print(f'{label:44s} {x:5d},{y:5d}  {c[0]:3d} {c[1]:3d} {c[2]:3d}  {yv:5.1f}   {target:>8s} {luma(t):5.1f}  '
              f'{ratio[0]:6.3f} {ratio[1]:6.3f} {ratio[2]:6.3f}{hue_txt}')
    else:
        print(f'{label:44s} {x:5d},{y:5d}  {c[0]:3d} {c[1]:3d} {c[2]:3d}  {yv:5.1f}')
    rows.append(row)

Y = 0.2126 * px8[..., 0] + 0.7152 * px8[..., 1] + 0.0722 * px8[..., 2]
if SET == 'hook':
    # the rim is wherever the frame is brightest: a 15 × 15 box-blurred luma peak (the projected ring point is a guess)
    k = 15
    cs = np.cumsum(np.cumsum(np.pad(Y, ((1, 0), (1, 0))), axis=0), axis=1)
    box = (cs[k:, k:] - cs[:-k, k:] - cs[k:, :-k] + cs[:-k, :-k]) / (k * k)
    py_, px_ = np.unravel_index(np.argmax(box), box.shape)
    py_, px_ = py_ + k // 2, px_ + k // 2
    c = patch(px_, py_, 3)
    print(f'{"rim peak (brightest 15×15 box)":44s} {px_:5d},{py_:5d}  {c[0]:3d} {c[1]:3d} {c[2]:3d}  {luma(c):5.1f}   '
          f'box mean {box.max():.1f}')
    rows.append(dict(label='rim peak', x=int(px_), y=int(py_), srgb=[int(v) for v in c], luma=round(float(luma(c)), 1)))
    HOOK_PEAK = (int(px_), int(py_))
stats = dict(mean=float(Y.mean()), p1=float(np.percentile(Y, 1)), p5=float(np.percentile(Y, 5)),
             p50=float(np.percentile(Y, 50)), p95=float(np.percentile(Y, 95)), p99=float(np.percentile(Y, 99)),
             max=float(Y.max()), clipped_pct=float(100 * (Y >= 254).mean()), black_pct=float(100 * (Y <= 2).mean()))
print(f'frame luma: mean {stats["mean"]:.1f} · p1 {stats["p1"]:.0f} · p5 {stats["p5"]:.0f} · p50 {stats["p50"]:.0f} · '
      f'p95 {stats["p95"]:.0f} · p99 {stats["p99"]:.0f} · max {stats["max"]:.0f} · clipped ≥254: {stats["clipped_pct"]:.2f} % · '
      f'black ≤2: {stats["black_pct"]:.1f} %')

if ZOOM:
    obname, local = ZOOM_POINT[SET]
    x, y, _ = project(bpy.data.objects[obname], local)
    if SET == 'hook':
        x, y = HOOK_PEAK
    r = 56 if W > 1000 else 28
    x0, y0 = min(max(0, x - r), W - 2 * r), min(max(0, y - r), H - 2 * r)
    os.makedirs(os.path.dirname(os.path.abspath(ZOOM)), exist_ok=True)
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', PNG, '-vf',
                    f'crop={2 * r}:{2 * r}:{x0}:{y0},scale={16 * r}:{16 * r}:flags=neighbor', ZOOM], check=True)
    print('zoom', ZOOM, f'crop {2 * r}px around ({x},{y}) × 8')

if ZOOM2 and SET == 'hook':
    x, y, _ = project(bpy.data.objects['Key_Captions'], (-8.6 * PX, 0.0, 1.75 * PX))
    r = 56 if W > 1000 else 28
    x0, y0 = min(max(0, x - r), W - 2 * r), min(max(0, y - r), H - 2 * r)
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', PNG, '-vf',
                    f'crop={2 * r}:{2 * r}:{x0}:{y0},scale={16 * r}:{16 * r}:flags=neighbor', ZOOM2], check=True)
    print('zoom2', ZOOM2, f'crop {2 * r}px around the engraving ({x},{y}) × 8')

if JSON_OUT:
    with open(JSON_OUT, 'w', encoding='utf-8') as fh:
        json.dump(dict(frame=FRAME, set=SET, png=PNG, size=[W, H], samples=rows, luma=stats), fh, indent=1)
