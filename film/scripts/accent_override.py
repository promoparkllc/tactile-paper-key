"""Accent calibration overrides for single test frames (render_frame.sh EXTRA_PY), all from env, measured with
accent_report.py; the values found are then baked into build_scene.py constants.

    ACC_FAN_POWER  FanKeyOrange energy (W)            ACC_FAN_GAIN  Key_GlazeOrange gain r,g,b
    ACC_CAP_GAIN   gain r,g,b of the seek cap parts   ACC_CAP_LIGHT power (W) of a cap-only area light (S6)
    ACC_LED_LIT    LED 'lit' value in the 3D state
Animated properties are forced by muting their F-curves first.
"""
import bpy
import os

from mathutils import Vector

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


def vec(s):
    return [float(v) for v in s.split(',')]


CAP_PARTS = [o for o in bpy.data.objects if o.name == 'Cap_SeekCap' or o.name.startswith('SeekCap_')]
if os.environ.get('ACC_FAN_POWER'):
    li = bpy.data.lights['FanKeyOrange']
    mute(li, 'energy')
    li.energy = float(os.environ['ACC_FAN_POWER'])
if os.environ.get("ACC_FAN_POS"):
    lo = bpy.data.objects["FanKeyOrange"]
    c = bpy.data.objects["Rig_GlazeOrange"].matrix_world.translation.copy()
    lo.location = c + Vector(vec(os.environ["ACC_FAN_POS"]))
    lo.rotation_euler = (c - lo.location).to_track_quat("-Z", "Y").to_euler()
if os.environ.get("ACC_FAN_GAIN"):
    ob = bpy.data.objects['Key_GlazeOrange']
    mute(ob, '["gain"]')
    ob['gain'] = vec(os.environ['ACC_FAN_GAIN'])
if os.environ.get('ACC_CAP_GAIN'):
    for ob in CAP_PARTS:
        mute(ob, '["gain"]')
        ob['gain'] = vec(os.environ['ACC_CAP_GAIN'])
if os.environ.get('ACC_CAP_LIGHT'):
    sc.frame_set(int(os.environ.get('ACC_FRAME', 526)))
    rig = bpy.data.objects['Rig_SeekCap']
    c = rig.matrix_world.translation.copy()
    ld = bpy.data.lights.new('CapKey', 'AREA')
    ld.shape, ld.size, ld.energy = 'SQUARE', float(os.environ.get('ACC_CAP_SIZE', 0.08)), float(os.environ['ACC_CAP_LIGHT'])
    ld.color = tuple(vec(os.environ.get("ACC_CAP_COLOR", "1,1,1")))
    lo = bpy.data.objects.new('CapKey', ld)
    sc.collection.objects.link(lo)
    lo.location = c + Vector(vec(os.environ.get('ACC_CAP_OFFSET', '0.03,-0.06,0.14')))
    d = c - lo.location
    lo.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    coll = bpy.data.collections.new('CapKey_receivers')
    for ob in CAP_PARTS:
        coll.objects.link(ob)
    lo.light_linking.receiver_collection = coll
    lo.visible_glossy = False
if os.environ.get('ACC_LED_LIT'):
    ob = bpy.data.objects['LED']
    mute(ob, '["lit"]')
    ob['lit'] = float(os.environ['ACC_LED_LIT'])
print('ACCENT OVERRIDE', {k: v for k, v in os.environ.items() if k.startswith('ACC_')})
