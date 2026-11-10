"""Calibrate the flat (UI) emission colours so the chosen view transform renders each hex exactly.

    blender --background --factory-startup --python-exit-code 1 --python film/scripts/calibrate_flat.py

Renders a grid of emission patches (one per hex), reads the result back, and corrects each patch's linear emission
by target ÷ measured (in linear) until every channel is within ±1 of the hex (max 6 passes). Writes
film/calib/flat_colors.json = {"#RRGGBB": [r, g, b]} (linear emission values), which build_scene.py reads.
The physical bases are NOT calibrated here (they depend on the light; see measure.py's ratio column).
"""
import bpy

assert bpy.app.version >= (5, 2, 0)

import json
import os

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
FILM = os.path.abspath(os.path.join(HERE, '..'))
OUT = os.path.join(FILM, 'calib', 'flat_colors.json')
PATCH_DIR = os.path.join(FILM, 'calib', 'patches')
VIEW_TRANSFORM = os.environ.get('VIEW_TRANSFORM', 'Standard')
HEXES = ['#E7E4DE', '#F3F0EB', '#E2DDD5', '#C2BBB1', '#2A2724', '#1D1B19', '#888177', '#151413', '#F4F1EC',
         '#E8E3DB', '#A8A39B', '#45413C', '#D9531E', '#160C07', '#8F3210', '#893311']
os.makedirs(PATCH_DIR, exist_ok=True)


def lin(c):
    c = np.asarray(c, dtype=np.float64)
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def hex_rgb(h):
    h = h.lstrip('#')
    return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], dtype=np.float64)


# scene: orthographic camera over a row of emissive squares
for ob in list(bpy.data.objects):
    bpy.data.objects.remove(ob, do_unlink=True)
sc = bpy.data.scenes[0]
sc.render.engine = 'CYCLES'
sc.cycles.device = 'CPU'
sc.cycles.samples = 8
sc.cycles.use_denoising = False
sc.render.resolution_x, sc.render.resolution_y = 64 * len(HEXES), 64
sc.render.resolution_percentage = 100
sc.render.film_transparent = False
sc.view_settings.view_transform = VIEW_TRANSFORM
sc.view_settings.look = 'None'
sc.view_settings.exposure = 0.0
sc.render.image_settings.file_format = 'PNG'
sc.render.image_settings.color_mode = 'RGB'
sc.render.image_settings.color_depth = '8'
world = bpy.data.worlds.new('Black')
world.use_nodes = True
next(n for n in world.node_tree.nodes if n.type == 'BACKGROUND').inputs['Strength'].default_value = 0.0
sc.world = world
cam = bpy.data.cameras.new('Cam')
cam.type, cam.ortho_scale = 'ORTHO', float(len(HEXES))
cam_ob = bpy.data.objects.new('Cam', cam)
cam_ob.location = (0, 0, 5)
sc.collection.objects.link(cam_ob)
sc.camera = cam_ob

mats, emis = [], []
for k, h in enumerate(HEXES):
    me = bpy.data.meshes.new(f'P{k}')
    me.from_pydata([(-0.5, -0.5, 0), (0.5, -0.5, 0), (0.5, 0.5, 0), (-0.5, 0.5, 0)], [], [(0, 1, 2, 3)])
    ob = bpy.data.objects.new(f'P{k}', me)
    ob.location = (k - (len(HEXES) - 1) / 2, 0, 0)
    sc.collection.objects.link(ob)
    m = bpy.data.materials.new(f'M{k}')
    m.use_nodes = True
    nt = m.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    em = nt.nodes.new('ShaderNodeEmission')
    em.inputs['Strength'].default_value = 1.0
    nt.links.new(em.outputs['Emission'], out.inputs['Surface'])
    me.materials.append(m)
    emis.append(em)
    mats.append(lin(hex_rgb(h) / 255))

values = [v.copy() for v in mats]
for it in range(6):
    for em, v in zip(emis, values):
        em.inputs['Color'].default_value = (*v, 1.0)
    path = os.path.join(PATCH_DIR, f'pass{it}.png')
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)
    img = bpy.data.images.load(path, check_existing=True)
    img.reload()
    px = np.array(img.pixels[:], dtype=np.float32).reshape(64, 64 * len(HEXES), 4)[:, :, :3]
    worst = 0
    for k, h in enumerate(HEXES):
        patch = px[16:48, 64 * k + 16:64 * k + 48].reshape(-1, 3)
        got = np.round(np.median(patch, axis=0) * 255)
        tgt = hex_rgb(h)
        err = int(np.max(np.abs(got - tgt)))
        worst = max(worst, err)
        if err > 1:
            values[k] = values[k] * (lin(tgt / 255) / np.maximum(lin(got / 255), 1e-5))
        print(f'pass {it} {h} → {got.astype(int).tolist()} err {err}')
    if worst <= 1:
        break

with open(OUT, 'w', encoding='utf-8') as fh:
    json.dump({h.upper(): [round(float(x), 6) for x in v] for h, v in zip(HEXES, values)}, fh, indent=1)
print('CALIB OK', OUT, 'worst error', worst, 'view transform', VIEW_TRANSFORM)
