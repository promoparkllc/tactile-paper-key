"""Composite the preview/final sequence: out = A · (1 − M) + B · M per pixel (Blender python: numpy + bpy image IO).

    blender --background --factory-startup --python-exit-code 1 --python composite_seq.py -- \
        <dirA> <dirB> <dirM> <out_dir> <start> <end> [--b-from 541]

A = the 3D pass (AgX, the scene as animated), B = the flat pass (Standard, the scene as animated), M = the flat
matte (how much of each pixel is a flat UI drawing). Frames below `--b-from` have no B/M (nothing is flat yet) and
are copied from A. Files are <dir>/<frame:04d>.png; output RGB 8-bit PNG.
"""
import bpy

assert bpy.app.version >= (5, 2, 0)

import os
import shutil
import sys

import numpy as np

args = sys.argv[sys.argv.index('--') + 1:]
A_DIR, B_DIR, M_DIR, OUT, START, END = args[0], args[1], args[2], args[3], int(args[4]), int(args[5])
B_FROM = int(args[args.index('--b-from') + 1]) if '--b-from' in args else 346
TAIL = int(args[args.index('--tail-from') + 1]) if '--tail-from' in args else None   # end card: solid bone
TAIL_HEX = args[args.index('--tail-hex') + 1] if '--tail-hex' in args else '#E7E4DE'
os.makedirs(OUT, exist_ok=True)


def load(path):
    img = bpy.data.images.load(path, check_existing=True)
    img.reload()
    w, h = img.size
    px = np.empty(w * h * 4, dtype=np.float32)
    img.pixels.foreach_get(px)
    bpy.data.images.remove(img)
    return px.reshape(h, w, 4)[:, :, :3], w, h


def save(path, rgb, w, h):
    img = bpy.data.images.new('out', w, h, alpha=False)
    rgba = np.concatenate([rgb, np.ones((h, w, 1), dtype=np.float32)], axis=2)
    img.pixels.foreach_set(rgba.ravel())
    img.filepath_raw = path
    img.file_format = 'PNG'
    img.save()
    bpy.data.images.remove(img)


done = 0
for f in range(START, END + 1):
    name = f'{f:04d}.png'
    out = os.path.join(OUT, name)
    if os.path.exists(out):
        continue
    a_path = os.path.join(A_DIR, name)
    if TAIL is not None and f >= TAIL:
        if 'tail_rgb' not in globals():
            _ref, w, h = load(os.path.join(A_DIR, f'{TAIL - 1:04d}.png'))
            c = [int(TAIL_HEX.lstrip('#')[i:i + 2], 16) / 255 for i in (0, 2, 4)]
            tail_rgb = np.ones((h, w, 3), dtype=np.float32) * np.array(c, dtype=np.float32)
            tail_wh = (w, h)
        save(out, tail_rgb, *tail_wh)
        done += 1
        continue
    if f < B_FROM:
        shutil.copyfile(a_path, out)
    else:
        A, w, h = load(a_path)
        B, _, _ = load(os.path.join(B_DIR, name))
        M, _, _ = load(os.path.join(M_DIR, name))
        m = np.clip(M[:, :, :1], 0.0, 1.0)
        save(out, A * (1 - m) + B * m, w, h)
    done += 1
print('COMPOSITE SEQ OK', OUT, 'frames written', done)
