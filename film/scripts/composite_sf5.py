"""Composite the two passes of a flatten frame along the storyboard's slanted wipe (Blender python: numpy, bpy).

    blender --background --factory-startup film/scene.blend --python-exit-code 1 --python composite_sf5.py -- \
        <pass3d.png> <passflat.png> <frame> <out.png> [--grid 12.8] [--wipe 0.52 0.38] [--soft 24]

Left of the wipe: the 3D pass (AgX). Right: the flat pass (Standard) with the 8 px UI grid (12.8 px at ×1.6,
rgba(42,39,36,.10) over the bone field) drawn only on the field, i.e. outside the dock's projected outline, plus the
dock's UI hairline (0 0 0 1px rgba(40,30,20,.12)) as a 1.6 px edge. The wipe is a straight line from (w·x_top, 0)
to (w·x_bottom, h) with a `soft` px linear edge — the same polygon Remotion will use.
"""
import bpy

assert bpy.app.version >= (5, 2, 0)

import math
import os
import sys

import numpy as np
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Vector

args = sys.argv[sys.argv.index('--') + 1:]
A_PATH, B_PATH, FRAME, OUT = args[0], args[1], int(args[2]), args[3]


def opt(name, default, n=1):
    if name in args:
        i = args.index(name)
        vals = [float(v) for v in args[i + 1:i + 1 + n]]
        return vals[0] if n == 1 else vals
    return default


GRID = opt('--grid', 12.8)
X_TOP, X_BOT = opt('--wipe', (0.52, 0.38), 2)
SOFT = opt('--soft', 24.0)

sc = bpy.data.scenes['Film']
sc.frame_set(FRAME)
dg = bpy.context.evaluated_depsgraph_get()
dg.update()


def load(path):
    img = bpy.data.images.load(path, check_existing=True)
    img.reload()
    w, h = img.size
    return np.array(img.pixels[:], dtype=np.float32).reshape(h, w, 4)[::-1, :, :3], w, h


A, W, H = load(A_PATH)
B, W2, H2 = load(B_PATH)
assert (W, H) == (W2, H2), 'pass sizes differ'

# ---- wipe mask: 1 = flat pass (right of the line)
ys, xs = np.mgrid[0:H, 0:W].astype(np.float32)
x_line = W * (X_TOP + (X_BOT - X_TOP) * ys / max(H - 1, 1))
mask = np.clip((xs - x_line) / SOFT + 0.5, 0.0, 1.0)[..., None]

# ---- dock outline projected through the camera (convex pill → scanline fill)
dock = bpy.data.objects['Dock']
mw = dock.evaluated_get(dg).matrix_world
w_px, h_px, r_px = 1152, 88, 44
PX = 0.001
pts = []
n = 24
hw, hh = w_px / 2 * PX, h_px / 2 * PX
rr = r_px * PX
for k, (sx, sy) in enumerate(((1, 1), (-1, 1), (-1, -1), (1, -1))):
    a0 = k * math.pi / 2
    for i in range(n):
        a = a0 + (i + 0.5) * (math.pi / 2) / n
        local = Vector((sx * (hw - rr) + rr * math.cos(a), sy * (hh - rr) + rr * math.sin(a), 0.0))
        co = world_to_camera_view(sc, sc.camera, mw @ local)
        pts.append((co.x * W, (1 - co.y) * H))
poly = np.array(pts)
inside = np.zeros((H, W), dtype=bool)
for y in range(H):
    xs_cross = []
    for i in range(len(poly)):
        (x0, y0), (x1, y1) = poly[i], poly[(i + 1) % len(poly)]
        if (y0 <= y + 0.5) != (y1 <= y + 0.5):
            xs_cross.append(x0 + (y + 0.5 - y0) * (x1 - x0) / (y1 - y0))
    xs_cross.sort()
    for a, b in zip(xs_cross[0::2], xs_cross[1::2]):
        inside[y, max(0, int(round(a))):min(W, int(round(b)))] = True
# hairline: inside minus eroded(inside) by ~1.6 px → use 2 px band
er = inside.copy()
for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (-1, -1), (1, -1), (-1, 1)):
    er &= np.roll(np.roll(inside, dy, 0), dx, 1)
er2 = er.copy()
for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
    er2 &= np.roll(np.roll(er, dy, 0), dx, 1)
hairline = inside & ~er2

# ---- grid on the flat pass, field only
def lin(c):
    c = np.asarray(c, dtype=np.float32) / 255
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def to_srgb(c):
    return np.where(c <= 0.0031308, c * 12.92, 1.055 * np.power(np.clip(c, 0, None), 1 / 2.4) - 0.055)


B_lin = lin(B * 255)
ink = lin([42, 39, 36])
grid_cols = np.zeros(W, dtype=bool)
grid_rows = np.zeros(H, dtype=bool)
k = 0
while k * GRID < W:
    x = int(round(k * GRID))
    grid_cols[x:min(W, x + 2)] = True
    k += 1
k = 0
while k * GRID < H:
    y = int(round(k * GRID))
    grid_rows[y:min(H, y + 2)] = True
    k += 1
grid = (grid_cols[None, :] | grid_rows[:, None]) & ~inside
B_lin[grid] = B_lin[grid] * 0.9 + ink * 0.1
hl = lin([40, 30, 20])
B_lin[hairline] = B_lin[hairline] * 0.88 + hl * 0.12
B_out = np.clip(to_srgb(B_lin), 0, 1)

out = A * (1 - mask) + B_out * mask
img = bpy.data.images.new('composite', W, H, alpha=False)
rgba = np.concatenate([out[::-1], np.ones((H, W, 1), dtype=np.float32)], axis=2)
img.pixels.foreach_set(rgba.ravel())
img.filepath_raw = OUT
img.file_format = 'PNG'
img.save()
print('COMPOSITE OK', OUT, 'wipe', X_TOP, X_BOT, 'soft', SOFT, 'grid', GRID, 'dock polygon px', int(inside.sum()))
