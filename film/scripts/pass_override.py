"""Per-pass overrides for a single frame, run by render_frame.sh through EXTRA_PY (after the .blend is loaded).

    PASS=3d    every piece physical (flat = 0, rigs z-scale 1), linen physical, morning sun through the window,
               f/4, view transform AgX
    PASS=flat  every piece flat (flat = 1, rigs z-scale 0.01), the linen a clean bone field (#E7E4DE), view transform
               Standard
    VT=<name>  only the view transform (any pass)

Animated properties are forced by muting their F-curves first (a keyed property ignores a plain assignment).
"""
import bpy
import math
import os

from mathutils import Matrix, Vector

PASS = os.environ.get('PASS', '')
VT = os.environ.get('VT', '')
sc = bpy.data.scenes['Film']


def fcurves(idb):
    ad = idb.animation_data
    if not ad or not ad.action:
        return []
    try:
        fcs = list(ad.action.fcurves)
        if fcs:
            return fcs
    except (AttributeError, TypeError):
        pass
    out = []
    for layer in ad.action.layers:
        for strip in layer.strips:
            cb = strip.channelbag(ad.action_slot) if hasattr(strip, 'channelbag') else None
            if cb:
                out += list(cb.fcurves)
    return out


def mute(idb, prefix=None):
    for fc in fcurves(idb):
        if prefix is None or fc.data_path.startswith(prefix):
            fc.mute = True


def srgb_to_lin(h):
    c = [int(h.lstrip('#')[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return [x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c]


def aim(ob, target, roll=0.0):
    d = Vector(target) - ob.location
    ob.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    if roll:
        ob.rotation_euler = (ob.rotation_euler.to_matrix() @ Matrix.Rotation(math.radians(roll), 3, 'Z')).to_euler()


if PASS in ('3d', 'flat'):
    flat = 1.0 if PASS == 'flat' else 0.0
    for ob in bpy.data.objects:
        if 'flat' in ob.keys():
            mute(ob, '["flat"]')
            ob['flat'] = flat
            if 'gain' in ob.keys():
                mute(ob, '["gain"]')
                ob['gain'] = [1.0, 1.0, 1.0]
        if ob.name.startswith('Rig_') and not ob.name.startswith('Rig_Glaze'):
            mute(ob, 'scale')
            ob.scale.z = 0.01 if PASS == 'flat' else 1.0
    linen = bpy.data.objects['Linen']
    mute(linen)
    linen['wipe'] = -10.0 if PASS == 'flat' else 10.0
    linen['field'] = srgb_to_lin('#E7E4DE')
    world = sc.world.node_tree
    mute(world)
    bg = next(n for n in world.nodes if n.type == 'BACKGROUND')
    sun = bpy.data.lights['Sun']
    mute(sun)
    sun_ob, gobo = bpy.data.objects['Sun'], bpy.data.objects['Gobo']
    mute(sun_ob)
    mute(gobo)
    dock_c = bpy.data.objects['Rig_Dock'].matrix_world.translation.copy()
    cam = bpy.data.cameras['Cam']
    mute(cam, 'dof.aperture_fstop')
    if PASS == '3d':
        el, az = math.radians(34.0), math.radians(150.0)
        d = Vector((math.sin(az) * math.cos(el), math.cos(az) * math.cos(el), math.sin(el)))
        sun.energy = float(os.environ.get('PASS_SUN', 4.0))
        sun_ob.location = dock_c + d * 2.0
        aim(sun_ob, dock_c)
        gobo.location = dock_c + d * 1.2
        aim(gobo, dock_c, roll=float(os.environ.get('PASS_GOBO_ROLL', -25.0)))
        bg.inputs['Color'].default_value = (*srgb_to_lin('#DCE2EA'), 1.0)
        bg.inputs['Strength'].default_value = float(os.environ.get('PASS_SKY', 0.95))   # fill: shadows at ~60 % of lit
        cam.dof.aperture_fstop = 4.0
        sc.view_settings.view_transform = 'AgX'
        g = [float(v) for v in os.environ.get('PASS_GAIN', '1,1,1').split(',')]
        for ob in bpy.data.objects:                       # measured base compensation for this pass (bone/key)
            if 'gain' in ob.keys() and not ob.name.startswith('Key_Glaze'):
                mute(ob, '["gain"]')
                ob['gain'] = g
    else:
        sun.energy = 0.0
        bg.inputs['Strength'].default_value = 0.0
        sc.view_settings.view_transform = 'Standard'
if PASS == 'matte':
    # flat matte: every material emits its own flat factor (camera-only emission is already there); lights off,
    # world black, Standard → pixel = how much of that pixel is "flat" (Standard pass) vs "3D" (AgX pass)
    for m in bpy.data.materials:
        if not m.use_nodes or m.name in ('Gobo',):
            continue
        nt = m.node_tree
        out = next((n for n in nt.nodes if n.type == 'OUTPUT_MATERIAL'), None)
        if out is None:
            continue
        em = nt.nodes.new('ShaderNodeEmission')
        em.inputs['Strength'].default_value = 1.0
        if m.name == 'Linen':
            # the linen's field factor: clamp((x − wipe)·40 + 0.5), rebuilt here
            geo = nt.nodes.new('ShaderNodeNewGeometry')
            sep = nt.nodes.new('ShaderNodeSeparateXYZ')
            nt.links.new(geo.outputs['Position'], sep.inputs['Vector'])
            a = nt.nodes.new('ShaderNodeAttribute')
            a.attribute_type, a.attribute_name = 'OBJECT', 'wipe'
            sub = nt.nodes.new('ShaderNodeMath')
            sub.operation = 'SUBTRACT'
            nt.links.new(sep.outputs['X'], sub.inputs[0])
            nt.links.new(a.outputs['Fac'], sub.inputs[1])
            mad = nt.nodes.new('ShaderNodeMath')
            mad.operation = 'MULTIPLY_ADD'
            mad.inputs[1].default_value, mad.inputs[2].default_value = 40.0, 0.5
            nt.links.new(sub.outputs['Value'], mad.inputs[0])
            cl = nt.nodes.new('ShaderNodeClamp')
            nt.links.new(mad.outputs['Value'], cl.inputs['Value'])
            fac = cl.outputs['Result']
        elif m.name in ('DisplayLabel', 'DisplayText', 'DisplayMuted', 'LED', 'DisplayDot', 'Bokeh'):
            # lit parts belong to the flat pass only when their rig is flat: read 'flat' if the object has it, else 0
            a = nt.nodes.new('ShaderNodeAttribute')
            a.attribute_type, a.attribute_name = 'OBJECT', 'flat'
            cl = nt.nodes.new('ShaderNodeClamp')
            nt.links.new(a.outputs['Fac'], cl.inputs['Value'])
            fac = cl.outputs['Result']
        else:
            a = nt.nodes.new('ShaderNodeAttribute')
            a.attribute_type, a.attribute_name = 'OBJECT', 'flat'
            cl = nt.nodes.new('ShaderNodeClamp')
            nt.links.new(a.outputs['Fac'], cl.inputs['Value'])
            fac = cl.outputs['Result']
        rgb = nt.nodes.new('ShaderNodeCombineColor')
        nt.links.new(fac, rgb.inputs['Red'])
        nt.links.new(fac, rgb.inputs['Green'])
        nt.links.new(fac, rgb.inputs['Blue'])
        nt.links.new(rgb.outputs['Color'], em.inputs['Color'])
        for l in list(out.inputs['Surface'].links):
            nt.links.remove(l)
        nt.links.new(em.outputs['Emission'], out.inputs['Surface'])
    for li in bpy.data.lights:
        mute(li)
        li.energy = 0.0
    world = sc.world.node_tree
    mute(world)
    next(n for n in world.nodes if n.type == 'BACKGROUND').inputs['Strength'].default_value = 0.0
    sc.view_settings.view_transform = 'Standard'
    sc.cycles.use_denoising = False
    sc.cycles.max_bounces = 0
if VT:
    sc.view_settings.view_transform = VT
sc.view_settings.look = 'None'
print('PASS OVERRIDE', PASS or '-', 'view transform', sc.view_settings.view_transform)
