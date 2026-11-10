"""Accent constancy report: hue / luma of every accent-coloured piece on one frame per sequence, against the reference
(the seek cap in shot 6), plus the LED's frame-to-frame stability over a run of consecutive frames.

    blender --background --factory-startup film/scene.blend --python-exit-code 1 --python accent_report.py -- \
        <frames_dir> <ref_frame> <frame,frame,...> <led_run_start> <led_run_len> [--out report.json]

<frames_dir> holds <frame:04d>.png (the pass A renders or the composite). Samples: LED, seek cap top, fan orange cap,
display dot, play key face, seek fill — whichever is in frame. Target: hue within ±4° of the reference, luma ±10 %.
"""
import bpy

assert bpy.app.version >= (5, 2, 0)

import json
import os
import sys

import numpy as np
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Vector

args = sys.argv[sys.argv.index('--') + 1:]
DIR, REF, FRAMES = args[0], int(args[1]), [int(v) for v in args[2].split(',')]
LED_START, LED_LEN = int(args[3]), int(args[4])
OUT = args[args.index('--out') + 1] if '--out' in args else None
sc = bpy.data.scenes['Film']
PX = 0.001
SAMPLES = [
    ('LED', 'LED', (0.0, 0.0, 2.02 * PX)),
    ('seek cap (top)', 'Cap_SeekCap', (0.0, 10 * PX, 2.0 * PX)),
    ('fan orange cap (dome)', 'Key_GlazeOrange', (0.0, 0.0, 8.2 * PX)),
    ('display dot', 'Pill_Dot', (0.0, 0.0, 0.0007)),
    ('play key face', 'Key_Play_face', (-30 * PX, -14 * PX, 2.0 * PX)),
    ('seek fill', 'inlay_seek_fill', (30 * PX, 0.0, 0.0)),   # the inlay's origin is the track's left end (world space since dock B)
]


def load(f):
    path = os.path.join(DIR, f'{f:04d}.png')
    img = bpy.data.images.load(path, check_existing=True)
    img.reload()
    w, h = img.size
    px = np.empty(w * h * 4, dtype=np.float32)
    img.pixels.foreach_get(px)
    bpy.data.images.remove(img)
    return np.clip(np.round(px.reshape(h, w, 4)[::-1, :, :3] * 255), 0, 255).astype(int), w, h


def hue_sat_luma(c):
    r, g, b = [float(v) / 255 for v in c]
    mx, mn = max(r, g, b), min(r, g, b)
    sat = (mx - mn) / mx if mx > 0 else 0.0
    if mx - mn < 1e-6:
        h = None
    elif mx == r:
        h = 60 * ((g - b) / (mx - mn) % 6)
    elif mx == g:
        h = 60 * ((b - r) / (mx - mn) + 2)
    else:
        h = 60 * ((r - g) / (mx - mn) + 4)
    return h, sat, 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]


def sample(f, px8, w, h, radius=3):
    sc.frame_set(f)
    dg = bpy.context.evaluated_depsgraph_get()
    dg.update()
    out = {}
    for label, obname, local in SAMPLES:
        ob = bpy.data.objects.get(obname)
        if ob is None or ob.hide_render:
            continue
        ev = ob.evaluated_get(dg)
        co = world_to_camera_view(sc, sc.camera, ev.matrix_world @ Vector(local))
        x, y = int(round(co.x * w)), int(round((1 - co.y) * h))
        if co.z <= 0 or not (radius <= x < w - radius and radius <= y < h - radius):
            continue
        c = np.median(px8[y - radius:y + radius + 1, x - radius:x + radius + 1].reshape(-1, 3), axis=0).astype(int)
        hh, ss, yy = hue_sat_luma(c)
        out[label] = dict(x=x, y=y, srgb=[int(v) for v in c], hue=None if hh is None else round(hh, 1),
                          sat=round(ss, 2), luma=round(yy, 1))
    return out


rows = {}
for f in sorted(set(FRAMES + [REF])):
    px8, w, h = load(f)
    rows[f] = sample(f, px8, w, h)
ref = rows[REF].get('seek cap (top)')
print(f'\nreference: seek cap at f{REF}: {ref}')
print(f'{"frame":>6s} {"sample":24s} {"sRGB":>13s} {"hue":>6s} {"Δhue":>6s} {"sat":>5s} {"luma":>6s} {"Δluma":>7s}')
report = dict(reference=dict(frame=REF, **(ref or {})), rows={})
for f in sorted(rows):
    for label, r in rows[f].items():
        dh = None if (r['hue'] is None or ref is None or ref['hue'] is None) else ((r['hue'] - ref['hue'] + 180) % 360) - 180
        dl = None if ref is None else 100 * (r['luma'] - ref['luma']) / max(ref['luma'], 1)
        print(f'{f:6d} {label:24s} {r["srgb"][0]:3d} {r["srgb"][1]:3d} {r["srgb"][2]:3d}  '
              f'{(r["hue"] if r["hue"] is not None else float("nan")):6.1f} {(dh if dh is not None else float("nan")):+6.1f} '
              f'{r["sat"]:5.2f} {r["luma"]:6.1f} {(dl if dl is not None else float("nan")):+6.1f}%')
        report['rows'][f'{f}:{label}'] = dict(r, d_hue=None if dh is None else round(dh, 1),
                                              d_luma_pct=None if dl is None else round(dl, 1))

# LED stability over consecutive frames
lumas = []
for f in range(LED_START, LED_START + LED_LEN):
    px8, w, h = load(f)
    r = sample(f, px8, w, h).get('LED')
    if r:
        lumas.append((f, r['luma'], r['hue']))
if lumas:
    ls = [v for _, v, _ in lumas]
    hs = [hh for _, _, hh in lumas if hh is not None]
    print(f'\nLED over f{LED_START}–{LED_START + LED_LEN - 1}: luma min {min(ls):.1f} max {max(ls):.1f} '
          f'(spread {max(ls) - min(ls):.1f}, {100 * (max(ls) - min(ls)) / max(np.mean(ls), 1):.1f} % of mean) · '
          f'hue min {min(hs):.1f} max {max(hs):.1f}')
    report['led_run'] = dict(start=LED_START, length=LED_LEN, lumas=ls, hues=hs)
if OUT:
    with open(OUT, 'w', encoding='utf-8') as fh:
        json.dump(report, fh, indent=1)
