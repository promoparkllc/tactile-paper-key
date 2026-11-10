"""Export screen positions for the motion layer (Remotion draws leaders / grid / edges onto them).

    blender --background --factory-startup film/scene.blend --python-exit-code 1 --python export_anchors.py -- \
        <out.json> [start end] [--set s2|s3|s6|wipe]

Every frame: anchors (object + local point, or world points) projected through the scene camera into 1920 × 1080
pixel coordinates (origin top-left). `visible` is false when the point is behind the camera or outside the frame.
Sets:  s2   exploded-view callouts (default, frames 61–180)
       s3   fan: centre and dome top of every glaze cap (181–270)
       s6   fader: seek groove ends and the cap centre (466–555)
       wipe the linen wipe edge x (px) where it crosses the top and bottom frame rows (391–466), from the animated
            object attribute `wipe` (world x of the front). `film/scenes.json` (written by build_scene.py) gives the
            world points (groove ends, dock top) so nothing is typed twice.
"""
import bpy

assert bpy.app.version >= (5, 2, 0)

import json
import os
import sys

from bpy_extras.object_utils import world_to_camera_view
from mathutils import Vector

args = sys.argv[sys.argv.index('--') + 1:]
OUT = args[0]
SET = args[args.index('--set') + 1] if '--set' in args else 's2'
nums = [int(a) for a in args[1:] if a.isdigit()]
DEFAULT_RANGE = dict(s2=(61, 180), s3=(181, 270), s6=(466, 555), wipe=(391, 466))
START, END = (nums[0], nums[1]) if len(nums) >= 2 else DEFAULT_RANGE[SET]
W, H = 1920, 1080
PX = 0.001
sc = bpy.data.scenes['Film']
FILM = os.path.dirname(bpy.data.filepath)
SCENES = json.load(open(os.path.join(FILM, 'scenes.json'), encoding='utf-8'))
WORLD = SCENES['world']

if SET == 's2':
    ANCHORS = {
        # label text for Remotion · object · local point (m)
        # dock size B (2026-11-10): keys Ø 44, cap 12 × 26, pill 230.92 × 36 r18, body 68 tall
        'key_ring':   ('Ø 44 · ring 1.25',   'Key_Captions',      (0.0, 22 * PX, 1.5 * PX)),      # top of the ink ring
        'key_travel': ('↕ 2 mm travel',      'Key_Captions',      (22 * PX, 0.0, -1.0 * PX)),     # the key's right side
        'cap':        ('cap 12×26',          'Cap_SeekCap',       (0.0, 13 * PX, 2.0 * PX)),      # top end of the seek cap
        'display':    ('display r18',        'Display',           (97.46 * PX, 18 * PX, 0.6 * PX)),  # right rounded corner (in frame)
        'body':       ('body · bone',        'Dock',              (200 * PX, -34 * PX, 0.0)),      # front edge between the seek track and the mute key (mid frame in the raking view)
        'key_center': ('',                   'Key_Captions_face', (0.0, 0.0, 2.0 * PX)),
    }
elif SET == 's3':
    ANCHORS = {}
    for g in WORLD['glazes']:
        ANCHORS[f'{g.lower()}_center'] = (g, f'Key_Glaze{g}', (0.0, 0.0, 0.0))
        ANCHORS[f'{g.lower()}_top'] = ('', f'Key_Glaze{g}', (0.0, 0.0, 8.2 * PX))
elif SET == 's6':
    ANCHORS = {
        'groove_start': ('0:00', None, tuple(WORLD['seek_groove'][0])),
        'groove_end':   (SCENES['seek']['time_dur'], None, tuple(WORLD['seek_groove'][1])),
        'cap':          ('', 'Cap_SeekCap', (0.0, 0.0, 2.0 * PX)),
    }
else:
    ANCHORS = {}


def project(co):
    v = world_to_camera_view(sc, sc.camera, co)
    x, y = v.x * W, (1 - v.y) * H
    return x, y, bool(v.z > 0 and 0 <= x < W and 0 <= y < H)


frames = {}
for f in range(START, END + 1):
    sc.frame_set(f)
    dg = bpy.context.evaluated_depsgraph_get()
    dg.update()
    row = {}
    if SET == 'wipe':
        linen = bpy.data.objects['Linen'].evaluated_get(dg)
        wipe_x = float(linen['wipe'])
        z = WORLD['dock_top_z']
        pts = [project(Vector((wipe_x, y, z))) for y in [i * 0.02 for i in range(-30, 31)]]
        pts = [(x, y) for x, y, _ in pts]
        # least-squares x = a·y + b through the projected edge points, then the crossings of the top and bottom rows
        n = len(pts)
        my, mx = sum(y for _, y in pts) / n, sum(x for x, _ in pts) / n
        sxy = sum((y - my) * (x - mx) for x, y in pts)
        syy = sum((y - my) ** 2 for _, y in pts)
        a = sxy / syy if syy > 1e-9 else 0.0
        b = mx - a * my
        row = dict(wipe_m=round(wipe_x, 5), x_top=round(b, 1), x_bottom=round(a * H + b, 1),
                   visible=bool(-W <= b <= 2 * W))
    else:
        for name, (label, obname, local) in ANCHORS.items():
            if obname is None:
                co = Vector(local)
            else:
                ob = bpy.data.objects[obname].evaluated_get(dg)
                co = ob.matrix_world @ Vector(local)
            x, y, vis = project(co)
            row[name] = dict(x=round(x, 1), y=round(y, 1), visible=vis)
    frames[f] = row

with open(OUT, 'w', encoding='utf-8') as fh:
    json.dump(dict(set=SET, size=[W, H], fps=sc.render.fps, frame_base=1,
                   labels={k: v[0] for k, v in ANCHORS.items()}, frames=frames), fh, indent=0)
print('ANCHORS OK', SET, OUT, 'frames', START, END)
