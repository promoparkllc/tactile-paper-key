"""Tactile — Paper Key · "From object to interface" (storyboard v2) · scene builder (Blender 5.2, Python 3.13).

Rebuilds the whole .blend from scratch: the physical dock-keypad (built on the dock's own pixel proportions, 1 px =
1 mm), its materials, the five glaze caps of the reveal, the linen it rests on (which becomes the flat UI canvas
behind a wipe), the lights of every phase (black hook / bright studio / low key / morning window / neutral / dusk /
night lamp) and one continuous camera over the 975 Blender frames of shots 1–8. Shot 9 (end card) and all type,
callouts, grid and code are Remotion, composited over the render.

Run (headless):
    blender --background --factory-startup --python-exit-code 1 --python film/scripts/build_scene.py
Every constant below can be overridden by an environment variable of the same name (iterate without editing code):
    BLEND=film/scene.blend SAMPLES=64 SUN_STRENGTH=4 blender ... --python build_scene.py

Design source: design/StoryboardV2.dc.html (composition, light, idea per shot — sketches, not pixel targets),
design/Final.dc.html + design/spec.md + src/styles/themes/tactile.css (every dimension and colour). Rules baked in
(00-STUDIO-DNA, 01-MOTION, 02-3D-BLENDER, promopark-blender skill):
  - bpy.data / bmesh only; the one operator is wm.save_as_mainfile. Saved before anything is built.
  - no boolean on lathe fans: everything is a rounded-rect sweep closed by one n-gon; engravings are cut into that flat
    n-gon and get a separate ink inlay for the floor.
  - colours: flat (UI) emission values come from film/calib/flat_colors.json (measured, see calibrate_flat.py) and
    physical bases from film/calib/phys_colors.json (measured on render, see measure.py); raw hex is the fallback.
  - view transform Standard: the flat UI state must render every hex exactly, and Blender 5.2's Khronos PBR Neutral
    LUT turns neutral darks orange (42,39,36 → 21,14,6) while AgX flattens the bone to 188 (measured 2026-11-09).
    Exposure is set by the lights, not by the transform.
  - Cycles, GPU, OIDN, adaptive off, 1920×1080, 30 fps.
  - Deviation from the kit default: film_transparent is OFF. The environment (linen, window shadows, studio) is the
    shot, and the last frame has to match a real screenshot luma for luma, so the background is rendered.
"""
import bpy

assert bpy.app.version >= (5, 2, 0), bpy.app.version_string

import bmesh
import json
import math
import os
import re
from mathutils import Matrix, Vector

ENV = os.environ.get
HERE = os.path.dirname(os.path.abspath(__file__))
FILM = os.path.abspath(os.path.join(HERE, '..'))


def envf(name, default):
    return float(ENV(name, default))


# ================================================================ constants (all overridable through the environment)
BLEND = os.path.abspath(ENV('BLEND', os.path.join(FILM, 'scene.blend')))
FONT_DIR = os.path.join(FILM, 'assets', 'fonts')
FONT_MONO_600 = ENV('FONT_MONO_600', os.path.join(FONT_DIR, 'GeistMono-SemiBold.ttf'))
FONT_MONO_500 = ENV('FONT_MONO_500', os.path.join(FONT_DIR, 'GeistMono-Medium.ttf'))
CALIB_FLAT = os.path.join(FILM, 'calib', 'flat_colors.json')     # hex → linear emission that renders as that hex
CALIB_PHYS = os.path.join(FILM, 'calib', 'phys_colors.json')     # material name → linear base multiplier (r, g, b)

# --- render
RES = (int(ENV('RES_X', 1920)), int(ENV('RES_Y', 1080)))
SAMPLES = int(ENV('SAMPLES', 64))
VIEW_TRANSFORM = ENV('VIEW_TRANSFORM', 'Standard')
EXPOSURE = envf('EXPOSURE', 0.0)

# --- scale: the dock is 68 px tall in the UI (dock size B); the object is built at 1 px = 1 mm (68 mm body, 44 mm keys).
PX = envf('PX_M', 0.001)                      # metres per CSS pixel
PLAYER_W, PLAYER_H = 1200, 675                # the board's player; the hand-off frame is this × 1.6 = 1920 × 1080

# --- layout in CSS px, dock size B: measured on the live skin at 1200 × 675 with getBoundingClientRect (2026-11-10,
#     design/fidelity.md "States, dock size B"); x values are centres unless noted
DOCK = dict(x=24, y=583, w=1152, h=68, r=34)
KEY_D, KEY_R = 44, 22
K_KEY = KEY_D / 52.0                          # the hook, press and fan framings were tuned on 52 mm keys: distances scale
PLAY_W, PLAY_H, PLAY_R = 76, 44, 22
PILL_W, PILL_H, PILL_R = 230.92, 36, 18
CAP_W, CAP_H, CAP_R = 12, 26, 5
OUTLINE = 1.25                                # ink ring width
TRACK = 2.0                                   # engraved seek / volume line
FILL = 4.0                                    # fill and buffer bars
DOCK_CY = DOCK['y'] + DOCK['h'] / 2          # 607
X_PLAY, X_PILL = 74, 237.46                  # centres (play 36–112, pill 122–352.92)
SEEK_X0, SEEK_X1 = 372.92, 856.0              # track ends (483.08 wide); the cap travels inside them by its own width
X_MUTE, X_CC, X_SETTINGS, X_FS = 898, 1034, 1088, 1142
VOL_X0, VOL_X1 = 936, 996                     # 60 wide track inside the 72 px fader
FPS = 30
BPM, FPB = 120, 15                            # 120 BPM at 30 fps: 15 frames per beat; beats come from time, not sums


def B(k):
    """Frame of beat k (frame 1 = 0 s)."""
    return 1 + FPB * k


FILM_S = (B(55) - 1) / FPS                    # 27.5 s: 2 · 4 · 3 · 2.5 · 4 · 3 · 3 · 4 · 2.5 (hand-off 1.5 s + live 2.5 s)
HARD_CUT = B(45)                              # 676 = 22.5 s: the live capture starts here
SEEK_FILL = envf('SEEK_FILL', (HARD_CUT - 1) / FPS / FILM_S)   # the player plays THIS film: 86.5 % at the cut
SEEK_END = (B(50) - 1) / FPS / FILM_S         # 90.9 % at the end of the hand-off (the stand-in keeps playing)
SEEK_BUFFER = envf('SEEK_BUFFER', 1.0)        # the live capture has the whole film buffered
SEEK_FROM = 0.10                              # where the cap waits before shot 6 slides it to SEEK_FILL
VOL_FILL = envf('VOL_FILL', 0.80)             # >= 0.75 shows the volume-high glyph: the live capture must use --volume 0.8
TIME_DUR = ENV('TIME_DUR', '0:27')            # the film's duration as the player shows it (27.5 s → 0:27)
TIME_CUR_SECONDS = list(range(18, 26))        # current-time variants the display can show (18–25 s)
LABEL = ENV('LABEL', 'PLAY')                  # status pill: state label and rate, 10 px 600 tracking 0.08 em
LABEL_RATE = ENV('LABEL_RATE', '1.0×')
ICON_PX, ICON_PLAY_PX = 20, 20
RIM_W = 2.0                                    # latched key (captions on): a 2 px accent rim replaces the 1.25 ink ring
#                                                (--tactile-rim-w, skin 7eef74a); the glyph stays ink, the face stays key
LATCH_TRAVEL = 1.0                             # a latched key sits 1 px lower (--tactile-latch-travel)
DOT_D = 6                                      # accent dot in the display pill

# --- physical depths (film; in px = mm)
DOCK_T = envf('DOCK_T', 16.0)                 # body thickness
DOCK_EDGE_R = envf('DOCK_EDGE_R', 6.0)        # rounded top edge
KEY_PROUD = 2.0                               # keys sit 2 px proud (= --tactile-press-depth); a press is 2 mm
WELL_DEPTH = 2.0                              # key well under the cap
WELL_OFFSET = 2.0                             # the well is eccentric by the UI shade offset (0 2px 0 shade)
WELL_CLEAR = 0.25
LEDGE_DEPTH = 0.5                             # the ink ring is a 0.5 mm deep ledge, OUTLINE wide, at the very edge
FACE_EDGE_R = 0.6                             # rounding of the key face edge, inside the ledge
GROOVE_DEPTH = 1.2                            # seek / volume channel
ENGRAVE_DEPTH = envf('ENGRAVE_DEPTH', 0.25)   # icon strokes: engraved, not a cavity (round 2)
PILL_PROUD = 0.6                              # display glass
CAP_PROUD = 2.0                               # fader caps ride 2 mm above the body
FLAT_EPS = envf('FLAT_EPS', 0.01)             # z-scale of a fully flattened piece (never 0: the ink stays below)
EXPL_D, EXPL_LENS = 0.58, 42.0                         # shot 2 tight pose: distance to the cluster / lens (raking view)
EXPL_D_WIDE = 1.7                                      # the pull-back to the whole body (f150 → 176): all of it in frame
EXPL_H = EXPL_D * 24.0 / EXPL_LENS                      # 0.33 m visible height at the target
# layer lifts in metres. The camera rakes along the body (display far and high, keys near and low), so the lifted
# display must stay ≥ 100 px below the top edge while the resting keys stay above the bottom edge: absolute lifts,
# not a fraction of EXPL_H; still 1 : 1.6 : 2.2 (keys : caps : display) and every layer clears the one below
EXPLODE = dict(keys=0.050, caps=0.080, display=0.110)
PASS_GAIN_S45 = (1.11, 1.11, 1.11)                      # measured base compensation for bone/keys under the S4–S5 sun (AgX)
GAIN_S6 = (0.97, 1.075, 1.16)                             # dusk: measured f760 hue 27° → toward bone 40° (target ÷ light)
BACKFILL_POWER = envf('BACKFILL_POWER', 12.0)           # S4–S5: soft fill behind the dock for its far rounded edge

# --- colours (sRGB hex from tactile.css)
HEX = dict(
    bone='#E7E4DE', key='#F3F0EB', key_latched='#E2DDD5', key_shade='#C2BBB1', ink='#2A2724', text='#1D1B19',
    buffer='#888177', display='#151413', display_text='#F4F1EC', display_label='#E8E3DB', display_muted='#A8A39B',
    display_sep='#45413C', accent='#D9531E', accent_text='#160C07', accent_shade='#8F3210', rib='#893311',
    linen='#B9AE9B', field='#E6E3DE')
# rib: rgb(40 12 2 / .45) composited over the accent = #893311 (film; the UI draws it as a translucent gradient)
# Shot 3 glazes (film; from the storyboard's five plates). Each is `--media-accent-color` on the same cap.
# Five glazes on one keycap, each a distinct material (round 2): graphite = the bible's glossy black ceramic recipe,
# stone = matte, bone = bead-blasted + fine sheen, orange / yellow = satin glaze.
GLAZES = [
    ('Graphite', '#0E0E0E', dict(rough=0.15, spec=0.0, coat=1.0, coat_rough=0.05)),
    ('Stone', '#A8A49D', dict(rough=0.75, spec=0.3)),
    ('Bone', HEX['key'], dict(rough=0.42, spec=0.45, micro=0.3, sheen=0.15)),
    ('Orange', HEX['accent'], dict(rough=0.3, spec=0.5, coat=0.25, coat_rough=0.25)),
    ('Yellow', '#E4C94A', dict(rough=0.3, spec=0.5, coat=0.25, coat_rough=0.25)),
]
# Base gains per glaze under the fan light (AgX), from measure.py ratios; 1 = none. Re-measured each round.
FAN_GAINS = dict(Graphite=(1, 1, 1), Stone=(1.0, 1.06, 1.18), Bone=(1.11, 1.11, 1.11), Orange=(1, 1, 1.3), Yellow=(1, 1, 1))
FAN_ORANGE_POWER = envf('FAN_ORANGE_POWER', 4.5)      # accent key: measured f241 201,85,39 → hue 17.0°, luma 106 (brand 17°/108)
ACCENT_GAIN_S45 = (0.74, 0.68, 0.18)                  # seek cap under the morning sun: measured f480 (1.11 → 211,113,84 pink, +24 %)
ACCENT_GAIN_S6 = (1.0, 1.0, 0.2)                      # seek cap under the dusk sky (blue down): measured f526 186,90,55 → hue 16°, luma 108
CAP_KEY_POWER = envf('CAP_KEY_POWER', 0.15)           # S6 cap-only white key (0.08 m, rides with the cap): accent luma to brand
LATCH_GAIN = tuple(float(v) for v in ENV('LATCH_GAIN', '0.41,0.37,0.14').split(','))   # latch rim base gain while 3D
#                    (the rim exists only under the S4–S5 sun: latched f305, a drawing from f376): measured 2026-11-10 on
#                    f320/f340 ledge 200,86,35 = hue 18.4° / luma 106.6 against the seek cap 183,89,56 (15.6° / 106.6);
#                    the cap's own S4–S5 gain (0.74,0.68,0.18) read +30 % and the un-gained accent whitened to 229,185,171
FAN_STONE_POWER = envf('FAN_STONE_POWER', 4.0)        # stone: lighter and cooler than graphite (Δluma ≥ 40)
# View transform per shot (round 2, approved): 3D shots on AgX with bases compensated from measurements; the flat
# UI and the hand-off on Standard (exact hex). Shot 5 = two passes of the same frame composited along the wipe.
SHOT_TRANSFORM = dict(S1='AgX', S2='AgX', S3='AgX', S4='AgX', S5='AgX+Standard (two passes)', S6='AgX', S7='AgX',
                      S8='Standard')

# --- light (film)
SUN_STRENGTH = envf('SUN_STRENGTH', 13.0)           # AgX: body ≈ 217 with sky 0.35 (approved SF5 3D pass)
SUN_COLOR = ENV('SUN_COLOR', '#FFF1DC')       # ~4800 K morning
SUN_ELEV, SUN_AZIM = envf('SUN_ELEV', 34.0), envf('SUN_AZIM', 150.0)
SUN_ANGLE, GOBO_ROLL = envf('SUN_ANGLE', 3.0), envf('GOBO_ROLL', -25.0)   # soft penumbra; bars diagonal to the dock   # azimuth: 0 = from +Y (behind), 90 = from +X
SKY_COLOR, SKY_STRENGTH = ENV('SKY_COLOR', '#DCE2EA'), envf('SKY_STRENGTH', 0.35)   # shadows at 60 % of lit
STUDIO_COLOR, STUDIO_STRENGTH = '#F4F1EC', envf('STUDIO_STRENGTH', 1.0)       # shot 2 world under AgX (shadows read)
STUDIO_FLOOR = '#F2F0EC'                                                       # white studio plane, shot 2 only
STUDIO_KEY_POWER = envf('STUDIO_KEY_POWER', 40.0)     # overhead key, shot 2: contact shadows between the layers
NEUTRAL_COLOR, NEUTRAL_STRENGTH = HEX['field'], envf('NEUTRAL_STRENGTH', 0.9)  # shot 5 world
LOWKEY_COLOR, LOWKEY_STRENGTH = '#000000', envf('LOWKEY_STRENGTH', 0.0)        # shot 3: seamless black
FAN_KEY_POWER = envf('FAN_KEY_POWER', 2.0)             # general key: yellow (bone, stone, orange, graphite have their own)             # general key on all caps (orange stays out of AgX's roll-off)
FAN_KEY_BONE_POWER = envf('FAN_KEY_BONE_POWER', 23.0)  # extra key linked to the bone cap only: the hero reaches its hex           # shot 3: soft key 0.35 m square, 0.45 m front-top (calibrated on bone)
FAN_RIM_POWER = envf('FAN_RIM_POWER', 0.7)          # shot 3: two warm strips behind the fan, linked to the caps
RIM_POWER = envf('RIM_POWER', 0.2)                  # diffuse-only rim on the bevel; the flag keeps it off the face                  # shot 1 strip (0.24 m, grazing, linked to the key only)
RIM_COLOR = ENV('RIM_COLOR', '#FFD9B0')
HOOK_FILL_COLOR, HOOK_FILL = '#8E96A2', envf('HOOK_FILL', 0.4)    # at gain 0.2 under AgX: face ≈ graphite   # cool fill, an area light linked to the key only        # shot 1: faint cool fill → graphite face
DUSK_SUN_COLOR, DUSK_SKY_COLOR = '#FFD2A8', '#B8BCC8'   # paler dusk sun, cool sky fill: bone stays bone, not wood
NIGHT_SKY_COLOR, NIGHT_SKY_STRENGTH = '#1A2234', envf('NIGHT_SKY_STRENGTH', 0.03)
LAMP_POWER, LAMP_COLOR = envf('LAMP_POWER', 2.0), ENV('LAMP_COLOR', '#FF9A4A')   # ~2700 K practical: rim / accent only
LAMP_POS = (0.30, 0.22, 0.16)                 # behind-right of the display, low: a warm rim on the pill's edge
NIGHT_FILL_POWER, NIGHT_FILL_COLOR = envf('NIGHT_FILL_POWER', 2.2), '#C4C8CE'  # weak cool fill on the body: neutral bone

# --- timeline on the beat grid (B(k) = frame of beat k). Hook 2 s · exploded 4 · fan 3 · press 2.5 · flatten 4 ·
# fader 3 · display 3 · hand-off 2.5 · end card 2 = 26 s. Blender renders 1–720 (the hand-off stand-in included);
# the end card (721–780) is a bone plane added at composite time, its text comes from Remotion.
S1, S2, S3, S4 = (B(0), B(4) - 1), (B(4), B(12) - 1), (B(12), B(18) - 1), (B(18), B(23) - 1)
S5, S6, S7, S8 = (B(23), B(31) - 1), (B(31), B(37) - 1), (B(37), B(43) - 1), (B(43), B(50) - 1)
END_CARD = (B(50), B(55) - 1)                 # 751–825: 2.5 s bone plane (live capture 676–750 = 2.5 s)
LAST_FRAME = S8[1]                            # 750
HARD_CUT_S = (HARD_CUT - 1) / FPS             # 22.5 s
# hero events sit on beats; the camera settles 6–10 f before and holds 12–18 f after each
F_EXPLODE = (B(5), B(7), B(9), B(11))         # apart 76 → 106 · hold · together 136 → 166 (hit: parts join)
EXPLODE_TILT = dict(keys=-6.0, caps=7.0, display=-4.0)   # degrees about X while apart
EXPLODE_LAG = dict(keys=0, caps=4, display=7)            # secondary layers start 130–230 ms after the keys
F_FAN = (B(12) + 5, B(15))                    # caps open 186 → 226 (quart in-out, staggered)
F_BONE_UP = (B(15), B(16))                    # bone rises 226 → 241 (hit)
F_PRESS = B(20)                               # 301 (hit): down 2 f, back 6 f with overshoot
F_LATCH = (F_PRESS + 4, F_PRESS + 8)          # the rim comes in 130 ms after the press (--tactile-dur-rim 150 ms)
F_KEYS_FLAT = dict(cc=B(25), mute=B(26), settings=B(27), fs=B(28), play=B(29))   # each flatten ENDS on its beat
F_FLAT_LEN = 30
F_WIPE = (B(27), B(31))                       # the linen becomes the flat canvas 391 → 466
F_CAP_SLIDE = (B(32), B(35))                  # cap slides 481 → 526 (hit: it stops)
F_FADER_FLAT = (B(36), B(37))                 # 541 → 556
F_DISPLAY_ON = (B(39), B(39) + 6)             # 586 (hit) → 592
F_DISPLAY_FLAT = (B(40), B(42))               # 601 → 631
F_DOCK_FLAT = (B(43) + 7, B(44))              # 653 → 661 (hit: everything is the dock)
F_MORPH = B(44)                               # play glyph → pause bars
STYLE_FRAMES = dict(SF1a=1, SF1b=60, SF3=241, SF5=406, MATCH=HARD_CUT - 1)

# ================================================================ colour helpers
def srgb_to_lin(hexstr):
    c = [int(hexstr.lstrip('#')[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)


def rgba(hexstr, mult=(1, 1, 1)):
    l = srgb_to_lin(hexstr)
    return (l[0] * mult[0], l[1] * mult[1], l[2] * mult[2], 1.0)


def load_json(path):
    if os.path.exists(path):
        with open(path, encoding='utf-8') as fh:
            return json.load(fh)
    return {}


FLAT_CAL = load_json(CALIB_FLAT)      # {"#E7E4DE": [r, g, b]} linear emission
PHYS_CAL = load_json(CALIB_PHYS)      # {"Bone": [mr, mg, mb]} base multipliers


def flat_color(hexstr):
    v = FLAT_CAL.get(hexstr.upper())
    return (v[0], v[1], v[2], 1.0) if v else rgba(hexstr)


def phys_color(name, hexstr):
    return rgba(hexstr, tuple(PHYS_CAL.get(name, (1, 1, 1))))


# ================================================================ file: wipe and save before building anything
os.makedirs(os.path.dirname(BLEND), exist_ok=True)
for ob in list(bpy.data.objects):
    bpy.data.objects.remove(ob, do_unlink=True)
for coll in (bpy.data.meshes, bpy.data.materials, bpy.data.curves, bpy.data.lights, bpy.data.cameras):
    for d in list(coll):
        coll.remove(d)
SC = bpy.data.scenes[0]
SC.name = 'Film'
bpy.ops.wm.save_as_mainfile(filepath=BLEND)

ROOT = bpy.data.collections.new('Tactile')
SC.collection.children.link(ROOT)


def link(ob, coll=None):
    (coll or ROOT).objects.link(ob)
    return ob


# ================================================================ materials
def _nodes(m):
    m.use_nodes = True
    nt = m.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    return nt


def obj_attr(nt, name):
    a = nt.nodes.new('ShaderNodeAttribute')
    a.attribute_type, a.attribute_name = 'OBJECT', name
    return a


def flat_attr(nt):
    """Object attribute 'flat' (0 = physical, 1 = flat UI colour), clamped."""
    cl = nt.nodes.new('ShaderNodeClamp')
    nt.links.new(obj_attr(nt, 'flat').outputs['Fac'], cl.inputs['Value'])
    return cl.outputs['Result']


def camera_only_emission(nt, color, strength_socket=None):
    """Emission seen by camera rays only: the flat drawing is visible but does not light the scene."""
    em = nt.nodes.new('ShaderNodeEmission')
    if isinstance(color, tuple):
        em.inputs['Color'].default_value = color
    else:
        nt.links.new(color, em.inputs['Color'])
    lp = nt.nodes.new('ShaderNodeLightPath')
    if strength_socket is None:
        nt.links.new(lp.outputs['Is Camera Ray'], em.inputs['Strength'])
    else:
        mul = nt.nodes.new('ShaderNodeMath')
        mul.operation = 'MULTIPLY'
        nt.links.new(lp.outputs['Is Camera Ray'], mul.inputs[0])
        nt.links.new(strength_socket, mul.inputs[1])
        nt.links.new(mul.outputs['Value'], em.inputs['Strength'])
    return em


def micro_surface(nt, bsdf, rough, micro):
    """Fine procedural grain (bead-blasted / powder-coat): bump + roughness variation, no texture maps."""
    tc = nt.nodes.new('ShaderNodeTexCoord')
    noise = nt.nodes.new('ShaderNodeTexNoise')
    noise.inputs['Scale'].default_value = 2600.0        # ~0.4 mm grain
    noise.inputs['Detail'].default_value = 3.0
    noise.inputs['Roughness'].default_value = 0.6
    nt.links.new(tc.outputs['Object'], noise.inputs['Vector'])
    bump = nt.nodes.new('ShaderNodeBump')
    bump.inputs['Strength'].default_value = micro
    bump.inputs['Distance'].default_value = 0.00004
    nt.links.new(noise.outputs['Fac'], bump.inputs['Height'])
    nt.links.new(bump.outputs['Normal'], bsdf.inputs['Normal'])
    rr = nt.nodes.new('ShaderNodeMapRange')
    rr.inputs['To Min'].default_value, rr.inputs['To Max'].default_value = rough - 0.08, rough + 0.08
    nt.links.new(noise.outputs['Fac'], rr.inputs['Value'])
    nt.links.new(rr.outputs['Result'], bsdf.inputs['Roughness'])


def tactile_material(name, hexstr, rough=0.5, spec=0.5, coat=0.0, coat_rough=0.1, micro=0.0, flat_hex=None,
                     sheen=0.0, latch_hex=None):
    """Principled surface mixed with a camera-only flat emission of the UI colour by the object's 'flat' attribute.

    `latch_hex`: a second UI colour the piece turns into by the object's 'latch' attribute (0 → 1), physical base
    × object attribute 'latch_gain' (RGB), flat emission exact; used by the captions key's rim."""
    m = bpy.data.materials.new(name)
    nt = _nodes(m)
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    bsdf = nt.nodes.new('ShaderNodeBsdfPrincipled')
    base = nt.nodes.new('ShaderNodeRGB')
    base.outputs[0].default_value = phys_color(name, hexstr)
    gain = nt.nodes.new('ShaderNodeMix')                  # × object attribute 'gain' (RGB, default 1): per-shot
    gain.data_type, gain.blend_type = 'RGBA', 'MULTIPLY'  # base compensation measured on render (02-3D-BLENDER)
    gain.inputs['Factor'].default_value = 1.0
    nt.links.new(base.outputs[0], gain.inputs[6])
    nt.links.new(obj_attr(nt, 'gain').outputs['Color'], gain.inputs[7])
    base_out = gain.outputs[2]
    flat_in = flat_color(flat_hex or hexstr)
    if latch_hex:                                         # the latched colour: its own gain, not the piece's
        lfac = nt.nodes.new('ShaderNodeClamp')
        nt.links.new(obj_attr(nt, 'latch').outputs['Fac'], lfac.inputs['Value'])
        on = nt.nodes.new('ShaderNodeRGB')
        on.outputs[0].default_value = phys_color('Accent', latch_hex)
        ong = nt.nodes.new('ShaderNodeMix')
        ong.data_type, ong.blend_type = 'RGBA', 'MULTIPLY'
        ong.inputs['Factor'].default_value = 1.0
        nt.links.new(on.outputs[0], ong.inputs[6])
        nt.links.new(obj_attr(nt, 'latch_gain').outputs['Color'], ong.inputs[7])
        lmix = nt.nodes.new('ShaderNodeMix')
        lmix.data_type, lmix.blend_type = 'RGBA', 'MIX'
        nt.links.new(lfac.outputs['Result'], lmix.inputs['Factor'])
        nt.links.new(base_out, lmix.inputs[6])
        nt.links.new(ong.outputs[2], lmix.inputs[7])
        base_out = lmix.outputs[2]
        foff = nt.nodes.new('ShaderNodeRGB')
        foff.outputs[0].default_value = flat_in
        fon = nt.nodes.new('ShaderNodeRGB')
        fon.outputs[0].default_value = flat_color(latch_hex)
        fmix = nt.nodes.new('ShaderNodeMix')
        fmix.data_type, fmix.blend_type = 'RGBA', 'MIX'
        nt.links.new(lfac.outputs['Result'], fmix.inputs['Factor'])
        nt.links.new(foff.outputs[0], fmix.inputs[6])
        nt.links.new(fon.outputs[0], fmix.inputs[7])
        flat_in = fmix.outputs[2]
    nt.links.new(base_out, bsdf.inputs['Base Color'])
    bsdf.inputs['Roughness'].default_value = rough
    bsdf.inputs['Specular IOR Level'].default_value = spec
    if coat:
        bsdf.inputs['Coat Weight'].default_value = coat
        bsdf.inputs['Coat Roughness'].default_value = coat_rough
    if sheen:
        bsdf.inputs['Sheen Weight'].default_value = sheen
        bsdf.inputs['Sheen Roughness'].default_value = 0.4
    if micro:
        micro_surface(nt, bsdf, rough, micro)
    em = camera_only_emission(nt, flat_in)
    mix = nt.nodes.new('ShaderNodeMixShader')
    nt.links.new(flat_attr(nt), mix.inputs['Fac'])
    nt.links.new(bsdf.outputs['BSDF'], mix.inputs[1])
    nt.links.new(em.outputs['Emission'], mix.inputs[2])
    nt.links.new(mix.outputs['Shader'], out.inputs['Surface'])
    m.diffuse_color = rgba(hexstr)
    return m


def lit_material(name, hexstr, strength=1.0, phys_hex='#101010'):
    """Display text / dot: emission of the UI colour × object attribute 'lit' (0 = off). Off it is a dark matte.
    This emission DOES light the scene a little (the display glow on the dock is wanted)."""
    m = bpy.data.materials.new(name)
    nt = _nodes(m)
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    em = nt.nodes.new('ShaderNodeEmission')
    em.inputs['Color'].default_value = flat_color(hexstr)
    mul = nt.nodes.new('ShaderNodeMath')
    mul.operation = 'MULTIPLY'
    mul.inputs[1].default_value = strength
    nt.links.new(obj_attr(nt, 'lit').outputs['Fac'], mul.inputs[0])
    nt.links.new(mul.outputs['Value'], em.inputs['Strength'])
    dark = nt.nodes.new('ShaderNodeBsdfPrincipled')
    dark.inputs['Base Color'].default_value = rgba(phys_hex)
    dark.inputs['Roughness'].default_value = 0.4
    add = nt.nodes.new('ShaderNodeAddShader')
    nt.links.new(dark.outputs['BSDF'], add.inputs[0])
    nt.links.new(em.outputs['Emission'], add.inputs[1])
    nt.links.new(add.outputs['Shader'], out.inputs['Surface'])
    m.diffuse_color = rgba(hexstr)
    return m


def linen_material():
    """Procedural linen (two crossed thread bands + slub noise, bump only) that turns into the flat UI canvas behind a
    wipe: object attribute 'wipe' = world x of the wipe front (everything with x > wipe is flat), 'field' = the flat
    colour (RGB, keyed from the storyboard's neutral bone to the night's near black)."""
    m = bpy.data.materials.new('Linen')
    nt = _nodes(m)
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    bsdf = nt.nodes.new('ShaderNodeBsdfPrincipled')
    bsdf.inputs['Roughness'].default_value = 0.85
    bsdf.inputs['Specular IOR Level'].default_value = 0.3
    bsdf.inputs['Sheen Weight'].default_value = 0.4
    tc = nt.nodes.new('ShaderNodeTexCoord')
    pitch = 1 / 0.00065                                   # ~0.65 mm thread pitch
    waves = []
    for direction in ('X', 'Y'):
        w = nt.nodes.new('ShaderNodeTexWave')
        w.wave_type, w.bands_direction, w.wave_profile = 'BANDS', direction, 'SIN'
        w.inputs['Scale'].default_value = pitch
        w.inputs['Distortion'].default_value = 1.2
        w.inputs['Detail'].default_value = 1.0
        nt.links.new(tc.outputs['Object'], w.inputs['Vector'])
        waves.append(w)
    weave = nt.nodes.new('ShaderNodeMath')
    weave.operation = 'MULTIPLY'
    nt.links.new(waves[0].outputs['Fac'], weave.inputs[0])
    nt.links.new(waves[1].outputs['Fac'], weave.inputs[1])
    slub = nt.nodes.new('ShaderNodeTexNoise')
    slub.inputs['Scale'].default_value = 45.0
    slub.inputs['Detail'].default_value = 4.0
    nt.links.new(tc.outputs['Object'], slub.inputs['Vector'])
    tone = nt.nodes.new('ShaderNodeMapRange')
    tone.inputs['To Min'].default_value, tone.inputs['To Max'].default_value = 0.78, 1.1
    nt.links.new(slub.outputs['Fac'], tone.inputs['Value'])
    col = nt.nodes.new('ShaderNodeMix')
    col.data_type, col.blend_type = 'RGBA', 'MULTIPLY'
    col.inputs['Factor'].default_value = 1.0
    col.inputs[6].default_value = rgba(HEX['linen'])
    nt.links.new(tone.outputs['Result'], col.inputs[7])
    nt.links.new(col.outputs[2], bsdf.inputs['Base Color'])
    bump = nt.nodes.new('ShaderNodeBump')
    bump.inputs['Strength'].default_value = 0.55
    bump.inputs['Distance'].default_value = 0.00025
    nt.links.new(weave.outputs['Value'], bump.inputs['Height'])
    nt.links.new(bump.outputs['Normal'], bsdf.inputs['Normal'])
    # wipe: flat where world x > wipe front: factor = clamp((x − wipe) · 40 + 0.5), a 2.5 cm soft edge
    geo = nt.nodes.new('ShaderNodeNewGeometry')
    sep = nt.nodes.new('ShaderNodeSeparateXYZ')
    nt.links.new(geo.outputs['Position'], sep.inputs['Vector'])
    sub = nt.nodes.new('ShaderNodeMath')
    sub.operation = 'SUBTRACT'
    nt.links.new(sep.outputs['X'], sub.inputs[0])
    nt.links.new(obj_attr(nt, 'wipe').outputs['Fac'], sub.inputs[1])
    mad = nt.nodes.new('ShaderNodeMath')
    mad.operation = 'MULTIPLY_ADD'
    mad.inputs[1].default_value, mad.inputs[2].default_value = 40.0, 0.5
    nt.links.new(sub.outputs['Value'], mad.inputs[0])
    cl = nt.nodes.new('ShaderNodeClamp')
    nt.links.new(mad.outputs['Value'], cl.inputs['Value'])
    em = camera_only_emission(nt, obj_attr(nt, 'field').outputs['Color'])
    mix = nt.nodes.new('ShaderNodeMixShader')
    nt.links.new(cl.outputs['Result'], mix.inputs['Fac'])
    nt.links.new(bsdf.outputs['BSDF'], mix.inputs[1])
    nt.links.new(em.outputs['Emission'], mix.inputs[2])
    nt.links.new(mix.outputs['Shader'], out.inputs['Surface'])
    m.diffuse_color = rgba(HEX['linen'])
    return m


def bokeh_material():
    m = bpy.data.materials.new('Bokeh')
    nt = _nodes(m)
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    em = camera_only_emission(nt, rgba('#FFC890'), obj_attr(nt, 'lit').outputs['Fac'])
    nt.links.new(em.outputs['Emission'], out.inputs['Surface'])
    return m


MAT = dict(
    bone=tactile_material('Bone', HEX['bone'], rough=0.62, spec=0.35, micro=0.5, sheen=0.08),   # bead-blasted body
    key=tactile_material('Key', HEX['key'], rough=0.42, spec=0.45, micro=0.12),     # a little glossier than the body
    key_shade=tactile_material('KeyShade', HEX['key_shade'], rough=0.7, spec=0.3),
    ink=tactile_material('Ink', HEX['ink'], rough=0.5, spec=0.3),
    accent=tactile_material('Accent', HEX['accent'], rough=0.42, spec=0.45, micro=0.2),
    accent_glyph=tactile_material('AccentGlyph', HEX['accent_text'], rough=0.5, spec=0.3),
    accent_shade=tactile_material('AccentShade', HEX['accent_shade'], rough=0.7, spec=0.3),
    rib=tactile_material('Rib', HEX['rib'], rough=0.5, spec=0.3),
    buffer=tactile_material('Buffer', HEX['buffer'], rough=0.55, spec=0.35),
    display=tactile_material('Display', HEX['display'], rough=0.12, spec=0.5, coat=1.0, coat_rough=0.05),
    sep=tactile_material('DisplaySep', HEX['display_sep'], rough=0.3, spec=0.3),
    label=lit_material('DisplayLabel', HEX['display_label'], 1.0),
    text=lit_material('DisplayText', HEX['display_text'], 1.0),
    muted=lit_material('DisplayMuted', HEX['display_muted'], 1.0),
    # captions key ledge + face edge: the latch rim; matte (spec 0.15, rough 0.6) so the S4 sun does not whiten it
    ink_latch=tactile_material('InkLatch', HEX['ink'], rough=0.6, spec=0.15, latch_hex=HEX['accent']),
    key_latch=tactile_material('KeyLatch', HEX['key'], rough=0.6, spec=0.15, micro=0.12, latch_hex=HEX['accent']),
    dot=lit_material('DisplayDot', HEX['accent'], 1.0, phys_hex='#241A17'),
    linen=linen_material(),
    bokeh=bokeh_material(),
    gobo=bpy.data.materials.new('Gobo'),
)
for gname, face, kw in GLAZES:                          # shot 3 glazes: five materials on one keycap
    MAT[f'glaze_{gname}'] = tactile_material(f'Glaze{gname}', face, **kw)


# ================================================================ geometry helpers (bmesh only)
def finish(me, sharp_deg=30.0):
    me.shade_smooth()
    me.set_sharp_from_angle(angle=math.radians(sharp_deg))


def rrect_outline(w, h, r, inset=0.0, n=12):
    """Rounded rectangle (w × h, corner r) shrunk by `inset`, as a closed list of 2D points (CCW).

    Arcs are sampled at half-step angles, so a circle (w = h = 2r) has no duplicate points and a rectangle's
    straight sides stay straight to within r · (1 − cos(π/4n)).
    """
    hw, hh = w / 2 - inset, h / 2 - inset
    rr = max(r - inset, 1e-5)
    cx, cy = hw - rr, hh - rr
    pts = []
    for k, (sx, sy) in enumerate(((1, 1), (-1, 1), (-1, -1), (1, -1))):
        a0 = k * math.pi / 2
        for i in range(n):
            a = a0 + (i + 0.5) * (math.pi / 2) / n
            pts.append((sx * cx + rr * math.cos(a), sy * cy + rr * math.sin(a)))
    return pts


def sweep(name, w, h, r, profile, mats, cap_top=True, cap_bottom=True, n=12):
    """Loft a rounded-rect outline through `profile` = [(inset, z, material_name), ...] (bottom → top).

    Each ring i → ring i+1 gets the material of step i+1 (the band ends there). Closed with one n-gon at each end.
    """
    bm = bmesh.new()
    rings = []
    for inset, z, _ in profile:
        rings.append([bm.verts.new((x, y, z)) for x, y in rrect_outline(w, h, r, inset, n)])
    slots = []

    def slot(mname):
        if mname not in slots:
            slots.append(mname)
        return slots.index(mname)

    for i in range(len(rings) - 1):
        mi = slot(profile[i + 1][2])
        a, b = rings[i], rings[i + 1]
        for j in range(len(a)):
            f = bm.faces.new((a[j], a[(j + 1) % len(a)], b[(j + 1) % len(a)], b[j]))
            f.material_index = mi
    if cap_bottom:
        f = bm.faces.new(list(reversed(rings[0])))
        f.material_index = slot(profile[0][2])
    if cap_top:
        f = bm.faces.new(rings[-1])
        f.material_index = slot(profile[-1][2])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for mname in slots:
        me.materials.append(mats[mname])
    finish(me)
    return me


def box_mesh(name, w, h, d, mat, z0=0.0):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co = Vector((v.co.x * w, v.co.y * h, z0 + (v.co.z + 0.5) * d))
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    me.materials.append(mat)
    return me


def new_object(name, me, loc=(0, 0, 0), parent=None, coll=None):
    ob = bpy.data.objects.new(name, me)
    ob.location = loc
    if parent is not None:
        ob.parent = parent
    link(ob, coll)
    return ob


def empty(name, loc, parent=None):
    ob = bpy.data.objects.new(name, None)
    ob.empty_display_type, ob.empty_display_size = 'PLAIN_AXES', 0.02
    ob.location = loc
    if parent is not None:
        ob.parent = parent
    link(ob)
    return ob


def evaluated_mesh(ob):
    dg = bpy.context.evaluated_depsgraph_get()
    dg.update()
    return bpy.data.meshes.new_from_object(ob.evaluated_get(dg), depsgraph=dg)


def apply_boolean(target, cutters, operation='DIFFERENCE'):
    """Cut `cutters` (objects) out of `target` with the exact solver, transferring the cutters' materials, then
    bake the result into the target's mesh and delete the cutters."""
    for k, c in enumerate(cutters):
        mod = target.modifiers.new(f'bool_{k}', 'BOOLEAN')
        mod.operation, mod.operand_type, mod.object = operation, 'OBJECT', c
        mod.solver, mod.material_mode = 'EXACT', 'TRANSFER'
    me = evaluated_mesh(target)
    me.name = target.data.name + '_cut'
    old = target.data
    for mod in list(target.modifiers):
        target.modifiers.remove(mod)
    target.data = me
    bpy.data.meshes.remove(old)
    for c in cutters:
        d = c.data
        bpy.data.objects.remove(c, do_unlink=True)
        if d and d.users == 0:
            if isinstance(d, bpy.types.Mesh):
                bpy.data.meshes.remove(d)
            elif isinstance(d, bpy.types.Curve):
                bpy.data.curves.remove(d)
    finish(me)
    return me


# ================================================================ SVG paths → polylines → tubes (engraved icons)
_TOKEN = re.compile(r'[MmLlHhVvAaZz]|-?\d*\.?\d+(?:e-?\d+)?')


def _arc_points(p0, rx, ry, phi, large, sweep_flag, p1, steps=14):
    """SVG elliptical arc (endpoint parameterisation) → points excluding p0, including p1."""
    x0, y0 = p0
    x1, y1 = p1
    if rx == 0 or ry == 0:
        return [p1]
    phi = math.radians(phi)
    cphi, sphi = math.cos(phi), math.sin(phi)
    dx, dy = (x0 - x1) / 2, (y0 - y1) / 2
    x1p, y1p = cphi * dx + sphi * dy, -sphi * dx + cphi * dy
    lam = (x1p / rx) ** 2 + (y1p / ry) ** 2
    if lam > 1:
        rx, ry = rx * math.sqrt(lam), ry * math.sqrt(lam)
    num = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p
    den = rx * rx * y1p * y1p + ry * ry * x1p * x1p
    coef = math.sqrt(max(num / den, 0.0)) * (-1 if large == sweep_flag else 1)
    cxp, cyp = coef * rx * y1p / ry, -coef * ry * x1p / rx
    cx = cphi * cxp - sphi * cyp + (x0 + x1) / 2
    cy = sphi * cxp + cphi * cyp + (y0 + y1) / 2

    def ang(ux, uy, vx, vy):
        return math.atan2(ux * vy - uy * vx, ux * vx + uy * vy)

    t1 = ang(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry)
    dt = ang((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry)
    if not sweep_flag and dt > 0:
        dt -= 2 * math.pi
    elif sweep_flag and dt < 0:
        dt += 2 * math.pi
    pts = []
    for i in range(1, steps + 1):
        t = t1 + dt * i / steps
        ex, ey = rx * math.cos(t), ry * math.sin(t)
        pts.append((cphi * ex - sphi * ey + cx, sphi * ex + cphi * ey + cy))
    pts[-1] = p1
    return pts


def svg_polylines(d):
    """Parse an SVG path (M L H V A Z, absolute or relative) into [(points, closed), ...]."""
    toks = _TOKEN.findall(d)
    i, cur, start = 0, (0.0, 0.0), (0.0, 0.0)
    cmd, out, pts = None, [], []

    def num():
        nonlocal i
        v = float(toks[i])
        i += 1
        return v

    def flush(closed):
        nonlocal pts
        if len(pts) > 1:
            out.append((pts, closed))
        pts = []

    while i < len(toks):
        if re.match(r'[A-Za-z]', toks[i]):
            cmd = toks[i]
            i += 1
            if cmd in 'Zz':
                flush(True)
                cur = start
                pts = [cur]
                continue
        rel = cmd.islower()
        c = cmd.upper()
        if c == 'M':
            x, y = num(), num()
            cur = (cur[0] + x, cur[1] + y) if rel else (x, y)
            flush(False)
            start = cur
            pts = [cur]
            cmd = 'l' if rel else 'L'
        elif c == 'L':
            x, y = num(), num()
            cur = (cur[0] + x, cur[1] + y) if rel else (x, y)
            pts.append(cur)
        elif c == 'H':
            x = num()
            cur = (cur[0] + x if rel else x, cur[1])
            pts.append(cur)
        elif c == 'V':
            y = num()
            cur = (cur[0], cur[1] + y if rel else y)
            pts.append(cur)
        elif c == 'A':
            rx, ry, phi, large, sw, x, y = num(), num(), num(), int(num()), int(num()), num(), num()
            end = (cur[0] + x, cur[1] + y) if rel else (x, y)
            pts.extend(_arc_points(cur, rx, ry, phi, large, sw, end))
            cur = end
        else:
            raise ValueError(f'unsupported SVG command {cmd}')
    flush(False)
    cleaned = []
    for p, closed in out:
        if closed and len(p) > 2 and abs(p[0][0] - p[-1][0]) < 1e-9 and abs(p[0][1] - p[-1][1]) < 1e-9:
            p = p[:-1]
        cleaned.append((p, closed))
    return cleaned


def svg_rect(x, y, w, h, rx):
    """<rect rx> as a closed path (rounded corners sampled)."""
    pts = []
    for (cx, cy, a0) in ((x + w - rx, y + rx, -90), (x + w - rx, y + h - rx, 0), (x + rx, y + h - rx, 90),
                         (x + rx, y + rx, 180)):
        for k in range(7):
            a = math.radians(a0 + 90 * k / 6)
            pts.append((cx + rx * math.cos(a), cy + rx * math.sin(a)))
    return [(pts, True)]


# Tactile icon family, from src/video/skin.ts (18 × 18 grid). Settings lines stop at the knobs (the knob masks them).
ICONS = dict(
    play=[('fill', 'M5.5 3.6 14 9l-8.5 5.4z', 0)],
    pause=[('stroke', 'M6.5 4v10M11.5 4v10', 1.6)],
    volume_high=[('stroke', 'M2.5 6.7h2.8l3.9-3.2v11l-3.9-3.2H2.5z', 1.4),
                 ('stroke', 'M12 6.3a3.8 3.8 0 0 1 0 5.4M14 4.3a6.6 6.6 0 0 1 0 9.4', 1.4)],
    captions=[('rect', (2, 4, 14, 10, 2.5), 1.4), ('stroke', 'M5 8h3M10 8h3M5 11h6', 1.4)],
    settings=[('stroke', 'M2.5 5h2.5M7.8 5h7.7M2.5 9h8M13.3 9h2.2M2.5 13h4M9.3 13h6.2', 1.4),
              ('rect', (5, 3.2, 2.8, 3.6, 1), 1.4), ('rect', (10.5, 7.2, 2.8, 3.6, 1), 1.4),
              ('rect', (6.5, 11.2, 2.8, 3.6, 1), 1.4)],
    fullscreen=[('stroke', 'M2.5 6.5v-4h4M11.5 2.5h4v4M15.5 11.5v4h-4M6.5 15.5h-4v-4', 1.5)],
)


def icon_shapes(name, size_px):
    """→ [(points_in_px_centred, closed, half_width_px or None for filled)], y up."""
    s = size_px / 18.0
    shapes = []
    for kind, data, width in ICONS[name]:
        polys = svg_rect(*data) if kind == 'rect' else svg_polylines(data)
        for pts, closed in polys:
            p = [((x - 9) * s, (9 - y) * s) for x, y in pts]
            shapes.append((p, closed or kind == 'fill', None if kind == 'fill' else width * s / 2))
    return shapes


def sphere_object(name, loc, r, mat=None, parent=None):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=12, v_segments=8, radius=r)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    finish(me, 60)
    if mat:
        me.materials.append(mat)
    ob = bpy.data.objects.new(name, me)
    ob.location = loc
    ob.parent = parent
    link(ob)
    return ob


def tube_object(name, shapes, radius, parent, z, mat=None):
    """Stroke shapes → one curve object of poly splines with a round bevel of `radius` (m), in the parent's space at
    height z. Open strokes get spheres at their ends for round caps. Returns [objects]."""
    cu = bpy.data.curves.new(name, 'CURVE')
    cu.dimensions = '3D'
    cu.fill_mode = 'FULL'
    cu.bevel_mode = 'ROUND'
    cu.bevel_resolution = 5
    cu.use_fill_caps = True
    cu.bevel_depth = radius
    ends = []
    for pts, closed, hw in shapes:
        if hw is None:
            continue
        sp = cu.splines.new('POLY')
        sp.points.add(len(pts) - 1)
        for k, (x, y) in enumerate(pts):
            sp.points[k].co = (x * PX, y * PX, 0.0, 1.0)
        sp.use_cyclic_u = closed
        if not closed:
            ends += [pts[0], pts[-1]]
    if mat:
        cu.materials.append(mat)
    ob = bpy.data.objects.new(name, cu)
    ob.location.z = z
    ob.parent = parent
    link(ob)
    out = [ob]
    for k, (x, y) in enumerate(ends):
        out.append(sphere_object(f'{name}_end{k}', (x * PX, y * PX, z), radius, mat, parent))
    return out


def fill_object(name, shapes, z0, depth, parent, scale=1.0, mat=None):
    """Filled icon shapes (the play triangle) as an extruded prism from z0 to z0 + depth, in the parent's space."""
    bm = bmesh.new()
    for pts, closed, hw in shapes:
        if hw is not None:
            continue
        cx = sum(p[0] for p in pts) / len(pts)
        cy = sum(p[1] for p in pts) / len(pts)
        ring0 = [bm.verts.new(((cx + (x - cx) * scale) * PX, (cy + (y - cy) * scale) * PX, z0)) for x, y in pts]
        ring1 = [bm.verts.new((v.co.x, v.co.y, z0 + depth)) for v in ring0]
        bm.faces.new(list(reversed(ring0)))
        bm.faces.new(ring1)
        for j in range(len(ring0)):
            bm.faces.new((ring0[j], ring0[(j + 1) % len(ring0)], ring1[(j + 1) % len(ring0)], ring1[j]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    if mat:
        me.materials.append(mat)
    ob = bpy.data.objects.new(name, me)
    ob.parent = parent
    link(ob)
    return ob


def engrave(target, icon, size_px, face_z, depth, ink_mat, parent):
    """Cut the icon into `target`'s face (z = face_z, parent space) and fill the groove with an ink inlay.

    Strokes: a round-bottomed channel `depth` mm deep and exactly one stroke width wide at the surface, cut by a
    cylinder of radius r = (hw² + d²) / 2d centred d − r under the face (spheres at the ends → round caps). The inlay
    is the same cylinder 0.06 mm thinner, so a hairline of key colour rims the ink and the ink top sits 0.06 mm under
    the face. Fills (the play triangle): a prism cut, a 0.97 × prism inlay. Returns the inlay objects.
    """
    shapes = icon_shapes(icon, size_px)
    d = depth * PX
    hw = max((h for _, _, h in shapes if h is not None), default=0.0) * PX
    cutters, inlays = [], []
    if hw:
        r = (hw * hw + d * d) / (2 * d)
        zc = face_z + d - r
        cutters += tube_object(f'{target.name}_cut', shapes, r, parent, zc)
        inlays += tube_object(f'{target.name}_ink', shapes, r - 0.00006, parent, zc, ink_mat)
    if any(h is None for _, _, h in shapes):
        cutters.append(fill_object(f'{target.name}_fillcut', shapes, face_z - d, d + 0.002, parent))
        inlays.append(fill_object(f'{target.name}_inkfill', shapes, face_z - d + 0.00002, d - 0.00008, parent,
                                  scale=0.97, mat=ink_mat))
    apply_boolean(target, cutters)
    return inlays


# ================================================================ world coordinates: UI px → metres
def wx(px):
    return (px - PLAYER_W / 2) * PX


def wy(py):
    return (PLAYER_H / 2 - py) * PX


DOCK_TOP = DOCK_T * PX
DOCK_C = Vector((wx(DOCK['x'] + DOCK['w'] / 2), wy(DOCK_CY), DOCK_TOP))

# ---------------------------------------------------------------- linen (8 × 8 m under everything, z = 0)
linen_me = bpy.data.meshes.new('Linen')
bm = bmesh.new()
bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=4.0)
bm.to_mesh(linen_me)
bm.free()
linen_me.materials.append(MAT['linen'])
LINEN = new_object('Linen', linen_me)
LINEN['wipe'] = 10.0                                      # the front starts far right: everything is linen
studio_me = bpy.data.meshes.new('Studio')
bm = bmesh.new()
bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=4.0)
bm.to_mesh(studio_me)
bm.free()
studio_me.materials.append(tactile_material('Studio', STUDIO_FLOOR, rough=0.9, spec=0.2))
STUDIO = new_object('Studio', studio_me)                  # white studio floor, rendered in shot 2 only
STUDIO['flat'] = 0.0
LINEN['field'] = list(srgb_to_lin(HEX['field']))

# ---------------------------------------------------------------- dock body
RIG_DOCK = empty('Rig_Dock', DOCK_C)
e = DOCK_EDGE_R
dock_profile = [(0.0, -DOCK_T, 'bone'), (0.0, -e, 'bone')]
for k in range(1, 7):
    a = math.radians(90 * k / 6)
    dock_profile.append((e - e * math.cos(a), -e + e * math.sin(a), 'bone'))
dock_profile = [(i * PX, z * PX, m) for i, z, m in dock_profile]
dock_me = sweep('Dock', DOCK['w'] * PX, DOCK['h'] * PX, DOCK['r'] * PX, dock_profile, MAT, n=16)
DOCK_OB = new_object('Dock', dock_me, parent=RIG_DOCK)
DOCK_OB['flat'] = 0.0

cutters = []


def well_cutter(name, cx, cy, w, h, r, mat, depth=WELL_DEPTH, dy=-WELL_OFFSET):
    me = sweep(name, (w + 2 * WELL_CLEAR) * PX, (h + 2 * WELL_CLEAR) * PX, (r + WELL_CLEAR) * PX,
               [(0.0, -depth * PX, mat), (0.0, 0.004, mat)], MAT, n=16)
    return new_object(name, me, (wx(cx) - DOCK_C.x, wy(cy) - DOCK_C.y + dy * PX, 0.0), parent=RIG_DOCK)


for nm, cx in (('mute', X_MUTE), ('cc', X_CC), ('settings', X_SETTINGS), ('fs', X_FS)):
    cutters.append(well_cutter(f'well_{nm}', cx, DOCK_CY, KEY_D, KEY_D, KEY_R, 'key_shade'))
cutters.append(well_cutter('well_play', X_PLAY, DOCK_CY, PLAY_W, PLAY_H, PLAY_R, 'accent_shade'))
for nm, x0, x1 in (('seek', SEEK_X0, SEEK_X1), ('vol', VOL_X0, VOL_X1)):
    me = box_mesh(f'groove_{nm}', (x1 - x0) * PX, TRACK * PX, GROOVE_DEPTH * PX + 0.004, MAT['ink'],
                  z0=-GROOVE_DEPTH * PX)
    cutters.append(new_object(f'groove_{nm}', me, (wx((x0 + x1) / 2) - DOCK_C.x, 0.0, 0.0), parent=RIG_DOCK))
apply_boolean(DOCK_OB, cutters)

seek_len = SEEK_X1 - SEEK_X0


def fader_x(x0, x1, frac):
    """Cap centre for a fraction: the thumb travels between x0 + CAP_W/2 and x1 - CAP_W/2 (measured on the live skin)."""
    return x0 + CAP_W / 2 + (x1 - x0 - CAP_W) * frac


def fill_len(frac):
    return fader_x(SEEK_X0, SEEK_X1, frac) - SEEK_X0


def inlay(name, x0, x1, mat, z_up=0.00002):
    """Flush bar over a channel (FILL wide, as deep as the groove), top 0.02 mm proud so it never z-fights."""
    me = box_mesh(name, (x1 - x0) * PX, FILL * PX, GROOVE_DEPTH * PX, MAT[mat], z0=-GROOVE_DEPTH * PX)
    # world-space, not under Rig_Dock: the dock's flatten squashes its children's z by 100×, which turned the 0.03 mm
    # fill-over-buffer separation into a z-fight the buffer won (the fill rendered short from S6 on; found 2026-11-10)
    ob = new_object(name, me, (wx((x0 + x1) / 2), wy(DOCK_CY), DOCK_TOP + z_up))
    ob['flat'] = 0.0
    return ob


INLAY_BUFFER = inlay('inlay_seek_buffer', fader_x(SEEK_X0, SEEK_X1, SEEK_FROM), SEEK_X0 + seek_len * SEEK_BUFFER, 'buffer')
INLAY_FILL = inlay('inlay_seek_fill', SEEK_X0, SEEK_X0 + fill_len(SEEK_FILL), 'accent', z_up=0.00005)
INLAY_FILL.location.x = wx(SEEK_X0)                      # pivot at the track start: scale.x follows the cap
for v in INLAY_FILL.data.vertices:
    v.co.x += fill_len(SEEK_FILL) / 2 * PX
INLAY_VOL = inlay('inlay_vol_fill', VOL_X0, fader_x(VOL_X0, VOL_X1, VOL_FILL), 'ink')
INLAYS = [INLAY_FILL, INLAY_BUFFER, INLAY_VOL]


# ---------------------------------------------------------------- keys
def key_profile(proud, well, face_mat, side_mat, ledge_mat='ink', edge_mat=None, er=FACE_EDGE_R):
    """Cap profile: side from the well floor up to the ink ledge, ledge (OUTLINE wide, ink floor), rounded face edge.

    A latching key passes `ledge_mat` / `edge_mat` that turn accent together and `er = RIM_W − OUTLINE`, so the ledge
    plus the edge band read as the UI's 2 px rim from above (1.25 ink ring + 0.75 face when unlatched)."""
    z_top = proud
    z_ledge = z_top - LEDGE_DEPTH
    p = [(0.0, -well, side_mat), (0.0, z_ledge, side_mat), (OUTLINE, z_ledge, ledge_mat)]
    edge_mat = edge_mat or face_mat
    for k in range(1, 6):
        a = math.radians(90 * k / 5)
        p.append((OUTLINE + er - er * math.cos(a), z_ledge + (z_top - z_ledge) * math.sin(a), edge_mat))
    p[-1] = (OUTLINE + er, z_top, edge_mat)
    return [(i * PX, z * PX, m) for i, z, m in p]


def split_top_face(ob, name):
    """Move the flat top n-gon of a sweep into its own object (same materials, same parent). Returns the new object."""
    me = ob.data
    zmax = max(v.co.z for v in me.vertices)
    bm = bmesh.new()
    bm.from_mesh(me)
    top = [f for f in bm.faces if f.normal.z > 0.9 and all(abs(v.co.z - zmax) < 1e-7 for v in f.verts)]
    fm = bpy.data.meshes.new(name)
    bm_top = bmesh.new()
    for f in top:
        vs = [bm_top.verts.new(v.co) for v in f.verts]
        nf = bm_top.faces.new(vs)
        nf.material_index = f.material_index
    bm_top.to_mesh(fm)
    bm_top.free()
    for m in me.materials:
        fm.materials.append(m)
    bmesh.ops.delete(bm, geom=top, context='FACES')
    bm.to_mesh(me)
    bm.free()
    finish(me)
    face = new_object(name, fm, parent=ob.parent)
    return face


def make_key(name, loc, w, h, r, icon, icon_px, face_mat, side_mat, glyph_mat, well=WELL_DEPTH, latch=False):
    rig = empty(f'Rig_{name}', loc)
    prof = (key_profile(KEY_PROUD, well, face_mat, side_mat, 'ink_latch', 'key_latch', RIM_W - OUTLINE) if latch
            else key_profile(KEY_PROUD, well, face_mat, side_mat))
    me = sweep(f'Key_{name}', w * PX, h * PX, r * PX, prof, MAT, n=16)
    ob = new_object(f'Key_{name}', me, parent=rig)
    face = split_top_face(ob, f'Key_{name}_face')
    if latch:                                     # the top n-gon inherits the edge band's material: the face stays key
        fm = face.data
        if MAT[face_mat].name not in [m.name for m in fm.materials]:
            fm.materials.append(MAT[face_mat])
        idx = [m.name for m in fm.materials].index(MAT[face_mat].name)
        for poly in fm.polygons:
            poly.material_index = idx
    parts = [ob, face]
    if icon:
        parts += engrave(face, icon, icon_px, KEY_PROUD * PX, ENGRAVE_DEPTH, MAT[glyph_mat], rig)
    for p in parts:
        p['flat'] = 0.0
        if latch:
            p['latch'] = 0.0
            p['latch_gain'] = list(LATCH_GAIN)
    return rig, parts


def on_dock(cx):
    return Vector((wx(cx), wy(DOCK_CY), DOCK_TOP))


KEYS = {}
KEYS['mute'] = make_key('Mute', on_dock(X_MUTE), KEY_D, KEY_D, KEY_R, 'volume_high', ICON_PX, 'key', 'key_shade', 'ink')
KEYS['cc'] = make_key('Captions', on_dock(X_CC), KEY_D, KEY_D, KEY_R, 'captions', ICON_PX, 'key', 'key_shade', 'ink',
                      latch=True)
KEYS['settings'] = make_key('Settings', on_dock(X_SETTINGS), KEY_D, KEY_D, KEY_R, 'settings', ICON_PX, 'key',
                            'key_shade', 'ink')
KEYS['fs'] = make_key('Fullscreen', on_dock(X_FS), KEY_D, KEY_D, KEY_R, 'fullscreen', ICON_PX, 'key', 'key_shade',
                      'ink')
KEYS['play'] = make_key('Play', on_dock(X_PLAY), PLAY_W, PLAY_H, PLAY_R, 'play', ICON_PLAY_PX, 'accent',
                        'accent_shade', 'accent_glyph')
PLAY_RIG, PLAY_PARTS = KEYS['play']
PLAY_GLYPH_PLAY = [p for p in PLAY_PARTS if 'ink' in p.name]
# pause bars: a second glyph that only renders from F_MORPH on, when the key is already flat
PAUSE_PARTS = tube_object('Key_Play_pause', icon_shapes('pause', ICON_PLAY_PX), 1.6 * ICON_PLAY_PX / 18 / 2 * PX,
                          PLAY_RIG, KEY_PROUD * PX, MAT['accent_glyph'])
for p in PAUSE_PARTS:
    p['flat'] = 1.0

CC_RIG, CC_PARTS = KEYS['cc']

# ---------------------------------------------------------------- shot 3: five glaze keycaps in the air, fanned like
# sample plates. A real keycap: tapered skirt, rounded edge, the 1.25 ink ring as a 0.2 mm ledge, a 1.2 mm domed top.
CAP_SKIRT_H, CAP_EDGE_R, CAP_TOP_Z, CAP_DOME = 5.0, 2.0, 7.0, 1.2        # mm


def keycap_profile(r, face_mat):
    p = [(0.0, 0.0, face_mat), (0.6, CAP_SKIRT_H, face_mat)]
    er = CAP_EDGE_R
    for k in range(1, 6):
        a = math.radians(90 * k / 5)
        p.append((0.6 + er - er * math.cos(a), CAP_SKIRT_H + er * math.sin(a), face_mat))     # ends (2.6, 7.0)
    lip = 0.6 + er
    p += [(lip, CAP_TOP_Z - 0.2, 'ink'), (lip + OUTLINE, CAP_TOP_Z - 0.2, 'ink'), (lip + OUTLINE + 0.4, CAP_TOP_Z, face_mat)]
    rho0 = r - (lip + OUTLINE + 0.4)
    for f in (0.15, 0.35, 0.55, 0.75, 0.9, 0.985):
        inset = lip + OUTLINE + 0.4 + f * rho0
        rho = r - inset
        p.append((inset, CAP_TOP_Z + CAP_DOME * (1 - (rho / rho0) ** 2), face_mat))
    return [(i * PX, z * PX, m) for i, z, m in p]


FAN_C = Vector((0.06, -1.0, 0.35))                       # in the air, well in front of the dock; linen hidden in S3
FAN_RIGS = []
for k, (gname, face, kw) in enumerate(GLAZES):
    rig = empty(f'Rig_Glaze{gname}', FAN_C)
    me = sweep(f'Key_Glaze{gname}', KEY_D * PX, KEY_D * PX, KEY_R * PX, keycap_profile(KEY_R, f'glaze_{gname}'), MAT,
               n=24)
    ob = new_object(f'Key_Glaze{gname}', me, parent=rig)
    ob['flat'] = 0.0
    ob['gain'] = list(FAN_GAINS[gname])
    FAN_RIGS.append((rig, [ob]))

# ---------------------------------------------------------------- fader caps (seek: accent, 3 ribs · volume: bone,
# ink outline, 2 ribs). Ribs are 6 × 1.5 px bars engraved 0.3 mm, 3.5 px pitch, centred (dock size B).


def make_cap(name, cx, cy, face_mat, side_mat, ribs, rib_mat, outline):
    rig = empty(f'Rig_{name}', (wx(cx), wy(cy), DOCK_TOP))
    if outline:
        prof = key_profile(CAP_PROUD, 0.0, face_mat, side_mat)
    else:
        er = 1.0
        prof = [(0.0, 0.0, side_mat), (0.0, CAP_PROUD - er, side_mat)]
        for k in range(1, 6):
            a = math.radians(90 * k / 5)
            prof.append((er - er * math.cos(a), CAP_PROUD - er + er * math.sin(a), face_mat))
        prof = [(i * PX, z * PX, m) for i, z, m in prof]
    me = sweep(f'Cap_{name}', CAP_W * PX, CAP_H * PX, CAP_R * PX, prof, MAT, n=8)
    ob = new_object(f'Cap_{name}', me, parent=rig)
    pitch, rib_w, rib_h, rd = 3.5, 6.0, 1.5, 0.3
    cutters, inlays = [], []
    for k in range(ribs):
        y = (k - (ribs - 1) / 2) * pitch
        cutters.append(new_object(f'{name}_ribcut{k}', box_mesh(f'{name}_ribcut{k}', rib_w * PX, rib_h * PX,
                                                                  rd * PX + 0.003, MAT[rib_mat],
                                                                  z0=(CAP_PROUD - rd) * PX), (0, y * PX, 0), parent=rig))
        inlays.append(new_object(f'{name}_rib{k}', box_mesh(f'{name}_rib{k}', rib_w * PX * 0.92, rib_h * PX * 0.85,
                                                              rd * PX - 0.00008, MAT[rib_mat],
                                                              z0=(CAP_PROUD - rd) * PX), (0, y * PX, 0), parent=rig))
    apply_boolean(ob, cutters)
    # the UI draws `0 2px 0 shade` under the cap: a shade-coloured plate 0.5 px larger, 2 px down, riding with it
    plate_me = sweep(f'{name}_shade', (CAP_W + 0.5) * PX, (CAP_H + 0.5) * PX, (CAP_R + 0.25) * PX,
                     [(0.0, 0.0, side_mat), (0.0, 0.00005, side_mat)], MAT, n=8)
    plate = new_object(f'{name}_shade', plate_me, (0.0, -WELL_OFFSET * PX, 0.00009), parent=rig)
    parts = [ob, plate] + inlays
    for p in parts:
        p['flat'] = 0.0
    return rig, parts


SEEK_CAP_X = fader_x(SEEK_X0, SEEK_X1, SEEK_FILL)
CAP_SEEK = make_cap('SeekCap', SEEK_CAP_X, DOCK_CY, 'accent', 'accent_shade', 3, 'rib', outline=False)
CAP_VOL = make_cap('VolCap', fader_x(VOL_X0, VOL_X1, VOL_FILL), DOCK_CY, 'key', 'key_shade', 2, 'ink',
                   outline=True)

# ---------------------------------------------------------------- display pill: black glass, label, times, dot
RIG_PILL = empty('Rig_Display', on_dock(X_PILL))
er = 0.5
pill_prof = [(0.0, -0.001, 'display'), (0.0, (PILL_PROUD - er) * PX, 'display')]
for k in range(1, 6):
    a = math.radians(90 * k / 5)
    pill_prof.append(((er - er * math.cos(a)) * PX, (PILL_PROUD - er + er * math.sin(a)) * PX, 'display'))
pill_me = sweep('Display', PILL_W * PX, PILL_H * PX, PILL_R * PX, pill_prof, MAT, n=12)
PILL = new_object('Display', pill_me, parent=RIG_PILL)
PILL['flat'] = 0.0
PILL_PARTS = [PILL]

FONTS = {p: bpy.data.fonts.load(p, check_existing=True) for p in (FONT_MONO_600, FONT_MONO_500) if os.path.exists(p)}


TEXT_K = 1.52      # Blender's font size unit → the CSS em: Geist Mono 'HHHH' at size 13 mm measures 20.4 mm, the browser
#                    draws it 31.2 px wide (4 × 0.6 em); calibrated 2026-11-10 against the live skin


def text_object(name, body, size_px, font_path, mat, tracking_em=0.0):
    """A text object sized like CSS `font-size: size_px` with `letter-spacing: tracking_em` (Geist Mono advance 0.6 em)."""
    cu = bpy.data.curves.new(name, 'FONT')
    cu.body = body
    if font_path in FONTS:
        cu.font = FONTS[font_path]
    cu.size = size_px * PX * TEXT_K
    cu.space_character = 1.0 + tracking_em / 0.6
    cu.align_x, cu.align_y = 'LEFT', 'BOTTOM_BASELINE'
    cu.extrude = 0.0
    cu.materials.append(mat)
    ob = bpy.data.objects.new(name, cu)
    link(ob)
    me = evaluated_mesh(ob)
    xs = [v.co.x for v in me.vertices]
    ys = [v.co.y for v in me.vertices]
    bpy.data.meshes.remove(me)
    return ob, (min(xs), max(xs), min(ys), max(ys))


PILL_Z = PILL_PROUD * PX + 0.00006
# Pill contents on their measured edges (live skin, dock size B, 1200 wide): from the pill's centre, left edges at
# state label -101.46, rate -49.94, separator -3.94 (1 × 14), current time +9.06, duration +52.26, dot +95.46; label
# and rate 10 px / 600 / 0.08 em, times 13 px / 500 tabular. Placing by edge keeps the flat frame on the live capture
# at the hard cut whatever the font metrics do.
PILL_EDGES = dict(label=-101.46, rate=-49.94, sep=-3.94, cur=9.06, dur=52.26, dot=95.46)
label_ob, lb = text_object('Pill_Label', LABEL, 10, FONT_MONO_600, MAT['label'], tracking_em=0.08)
rate_ob, rb = text_object('Pill_Rate', LABEL_RATE, 10, FONT_MONO_600, MAT['label'], tracking_em=0.08)
CUR_OBS = []                                              # one text object per second the display can show
for sec in TIME_CUR_SECONDS:
    ob_, bb_ = text_object(f'Pill_Current_{sec}', f'{sec // 60}:{sec % 60:02d}', 13, FONT_MONO_500, MAT['text'])
    CUR_OBS.append((sec, ob_, bb_))
cur_ob, cb = CUR_OBS[0][1], CUR_OBS[0][2]
dur_ob, db = text_object('Pill_Duration', TIME_DUR, 13, FONT_MONO_500, MAT['muted'])


def place_text(ob, bb, edge_px):
    ob.location = (edge_px * PX - bb[0], -(bb[2] + bb[3]) / 2, PILL_Z)
    ob.parent = RIG_PILL
    ob['lit'] = 0.0
    PILL_PARTS.append(ob)


place_text(label_ob, lb, PILL_EDGES['label'])
place_text(rate_ob, rb, PILL_EDGES['rate'])
for sec, o_, b_ in CUR_OBS:
    place_text(o_, b_, PILL_EDGES['cur'])
place_text(dur_ob, db, PILL_EDGES['dur'])
sep = new_object('Pill_Sep', box_mesh('Pill_Sep', 1 * PX, 14 * PX, 0.00005, MAT['sep'], z0=PILL_Z - 0.00002),
                 ((PILL_EDGES['sep'] + 0.5) * PX, 0.0, 0.0), parent=RIG_PILL)
sep['flat'] = 0.0
PILL_PARTS.append(sep)
dot_me = sweep('Pill_Dot', DOT_D * PX, DOT_D * PX, DOT_D / 2 * PX,
               [(0.0, PILL_Z - 0.0002, 'dot'), (0.0, PILL_Z, 'dot')], MAT)
DOT = new_object('Pill_Dot', dot_me, ((PILL_EDGES['dot'] + DOT_D / 2) * PX, 0.0, 0.0), parent=RIG_PILL)
DOT['lit'] = 0.0
PILL_PARTS.append(DOT)
LIT_PARTS = [label_ob, rate_ob, dur_ob, DOT] + [o_ for _, o_, _ in CUR_OBS]

# ---------------------------------------------------------------- shot 7 bokeh: small warm emitters far behind
BOKEH = []
for k, (bx, by, bz, s) in enumerate(((0.55, 1.6, 0.26, 1.0), (0.78, 1.9, 0.34, 0.6), (0.30, 1.7, 0.42, 0.8),
                                      (0.95, 1.5, 0.20, 0.45), (0.12, 2.1, 0.30, 0.5), (0.68, 2.3, 0.50, 0.35))):
    b = sphere_object(f'Bokeh{k}', (bx, by, bz), 0.004, MAT['bokeh'])
    b['lit'] = 0.0
    b.visible_shadow = False
    BOKEH.append((b, s))

# ---------------------------------------------------------------- lights
WORLD = bpy.data.worlds.new('Sky')
WORLD.use_nodes = True
W_BG = next(n for n in WORLD.node_tree.nodes if n.type == 'BACKGROUND')
W_BG.inputs['Color'].default_value = rgba(SKY_COLOR)
W_BG.inputs['Strength'].default_value = 0.0
SC.world = WORLD


def aim(ob, target, up=Vector((0, 0, 1))):
    """Point local −Z at target (lights and cameras), local +Y toward `up`."""
    d = Vector(target) - ob.location
    q = d.to_track_quat('-Z', 'Y')
    ob.rotation_euler = q.to_euler()
    z = -(ob.rotation_euler.to_matrix() @ Vector((0, 0, 1)))
    y = (up - up.dot(z) * z)
    if y.length > 1e-6:
        y.normalize()
        ob.rotation_euler = Matrix((y.cross(-z), y, -z)).transposed().to_euler()
    return ob


def sun_dir(elev_deg, azim_deg):
    """Unit vector FROM the scene TOWARD the sun. azimuth 0 = +Y (behind the dock), 90 = +X (right)."""
    el, az = math.radians(elev_deg), math.radians(azim_deg)
    return Vector((math.sin(az) * math.cos(el), math.cos(az) * math.cos(el), math.sin(el)))


def area_light(name, shape, size, size_y, power, color, loc, target, spread=180.0, up=None):
    li = bpy.data.lights.new(name, 'AREA')
    li.shape, li.size, li.energy, li.color = shape, size, power, srgb_to_lin(color)
    if shape == 'RECTANGLE':
        li.size_y = size_y
    li.spread = math.radians(spread)
    ob = link(bpy.data.objects.new(name, li))
    ob.location = Vector(loc)
    aim(ob, target, up or Vector((0, 0, 1)))
    ob.visible_camera = False
    return ob


sun_data = bpy.data.lights.new('Sun', 'SUN')
sun_data.energy, sun_data.color, sun_data.angle = 0.0, srgb_to_lin(SUN_COLOR), math.radians(SUN_ANGLE)
SUN = link(bpy.data.objects.new('Sun', sun_data))
SUN.location = DOCK_C + sun_dir(SUN_ELEV, SUN_AZIM) * 2.0
aim(SUN, DOCK_C)

# window gobo (round 3): two shadow-only bars 0.10 m wide, 1.2 m toward the sun, rolled GOBO_ROLL° so their shadows
# cross the dock diagonally; a 3° sun gives a ~6 cm penumbra (soft, ~40 % contrast with the sky fill)
MAT['gobo'].use_nodes = True


def aim_gobo(ob, target):
    aim(ob, target)
    ob.rotation_euler = (ob.rotation_euler.to_matrix() @ Matrix.Rotation(math.radians(GOBO_ROLL), 3, 'Z')).to_euler()


GOBO = empty('Gobo', DOCK_C + sun_dir(SUN_ELEV, SUN_AZIM) * 1.2)
aim_gobo(GOBO, DOCK_C)
for k, (bx, by, bw, bh) in enumerate(((-0.24, 0, 0.10, 3.0), (0.22, 0, 0.10, 3.0))):
    me = box_mesh(f'GoboBar{k}', bw, bh, 0.004, MAT['gobo'], z0=-0.002)
    ob = new_object(f'GoboBar{k}', me, (bx, by, 0.0), parent=GOBO)
    ob.visible_camera = ob.visible_diffuse = ob.visible_glossy = ob.visible_transmission = False
    ob.visible_shadow = True

CC_C = on_dock(X_CC)
PILL_C = on_dock(X_PILL)
# shot 1: a thin warm strip behind the captions key, grazing its bevel toward the camera; it slides (azimuth keyed)
RIM_PT = CC_C + Vector((-0.0245, -0.009, 0.0025))        # the bevel the rim rides (frame left) and the focus point
RIM = area_light('Rim', 'RECTANGLE', 0.26, 0.012, 0.0, RIM_COLOR, CC_C + Vector((0.1, 0.2, 0.04)), RIM_PT, spread=6)
GLYPH_PT = CC_C + Vector((0.0, 0.0, KEY_PROUD * PX))      # the engraved icon: focus target at the end of the hook
RIM.visible_glossy = False                                 # diffuse rim on the bevel only: no highlight blobs on the face
# shot 2: soft overhead key for the studio (the uniform bright world does the exposure; this gives form)
STUDIO_KEY = area_light('StudioKey', 'RECTANGLE', 0.6, 0.4, 0.0, '#FFFFFF', (0.5, -0.6, 1.5), (0.2, -0.27, 0.1))
# shot 3: low-key top light + warm rim on the fan
# shot 3: soft key from the camera side, two warm rims behind the fan (light-linked to the caps: black stays black)
FAN_KEY = area_light('FanKey', 'SQUARE', 0.6, 0.6, 0.0, '#FFFFFF', FAN_C + Vector((0.18, -0.42, 0.42)), FAN_C)
FAN_RIM_L = area_light('FanRimL', 'RECTANGLE', 0.02, 0.5, 0.0, RIM_COLOR, FAN_C + Vector((-0.42, 0.34, 0.14)), FAN_C,
                       spread=40)
FAN_RIM_R = area_light('FanRimR', 'RECTANGLE', 0.02, 0.5, 0.0, RIM_COLOR, FAN_C + Vector((0.46, 0.30, 0.10)), FAN_C,
                       spread=40)
# glossy-only reflector behind the camera: the black ceramic reads through its reflection (bible: black ceramic)
FAN_REFL = area_light('FanRefl', 'SQUARE', 2.0, 2.0, 0.0, '#FFF4E6', FAN_C + Vector((0.0, -1.2, 0.9)), FAN_C)
FAN_REFL.visible_diffuse = False
FAN_KEY_BONE = area_light('FanKeyBone', 'SQUARE', 0.5, 0.5, 0.0, '#FFFFFF', FAN_C + Vector((0.14, -0.40, 0.44)), FAN_C)
FAN_KEY_ORANGE = area_light('FanKeyOrange', 'SQUARE', 0.4, 0.4, 0.0, '#FFFFFF', FAN_C + Vector((0.10, -0.30, 0.40)), FAN_C)
FAN_KEY_STONE = area_light('FanKeyStone', 'SQUARE', 0.4, 0.4, 0.0, '#E8F0FF', FAN_C + Vector((-0.05, -0.30, 0.42)), FAN_C)


def link_only(light, names):
    coll = bpy.data.collections.new(light.name + '_receivers')
    for rig, parts in FAN_RIGS:
        if rig.name in names:
            for p in parts:
                coll.objects.link(p)
    light.light_linking.receiver_collection = coll


link_only(FAN_KEY_BONE, ('Rig_GlazeBone',))
link_only(FAN_KEY_ORANGE, ('Rig_GlazeOrange',))
link_only(FAN_KEY_STONE, ('Rig_GlazeStone',))
link_only(FAN_KEY, ('Rig_GlazeYellow',))
FAN_LL = bpy.data.collections.new('Fan_receivers')
for rig, parts in FAN_RIGS:
    for p in parts:
        FAN_LL.objects.link(p)
for li in (FAN_RIM_L, FAN_RIM_R):
    li.light_linking.receiver_collection = FAN_LL
GRAPHITE_LL = bpy.data.collections.new('Graphite_receivers')     # the reflector only reads in the black ceramic
for rig, parts in FAN_RIGS:
    if rig.name == 'Rig_GlazeGraphite':
        for p in parts:
            GRAPHITE_LL.objects.link(p)
FAN_REFL.light_linking.receiver_collection = GRAPHITE_LL
FAN_REFL.data.size = 1.6
fankey_data, fanrim_l_data, fanrim_r_data, fanrefl_data = FAN_KEY.data, FAN_RIM_L.data, FAN_RIM_R.data, FAN_REFL.data
fankeybone_data, fankeyorange_data, fankeystone_data = FAN_KEY_BONE.data, FAN_KEY_ORANGE.data, FAN_KEY_STONE.data
FAN_REFL_POWER = envf('FAN_REFL_POWER', 2.0)
# shot 4–5: soft fill behind the dock, linked to the body: its far rounded edge must not read as a dark bar
BACKFILL = area_light('BackFill', 'RECTANGLE', 1.2, 0.3, 0.0, '#F4F1EC', DOCK_C + Vector((0.2, 0.45, 0.22)),
                      DOCK_C + Vector((0.2, 0.044, 0.0)))
BACKFILL_LL = bpy.data.collections.new('BackFill_receivers')
BACKFILL_LL.objects.link(DOCK_OB)
BACKFILL.light_linking.receiver_collection = BACKFILL_LL
backfill_data = BACKFILL.data
# shot 7–8: warm practical
LAMP = area_light('Lamp', 'DISK', 0.16, 0.16, 0.0, LAMP_COLOR, LAMP_POS, PILL_C)
NIGHT_FILL = area_light('NightFill', 'SQUARE', 0.6, 0.6, 0.0, NIGHT_FILL_COLOR, DOCK_C + Vector((-0.1, -0.35, 0.5)),
                        DOCK_C + Vector((-0.1, 0, 0)))
NIGHT_LL = bpy.data.collections.new('NightFill_receivers')     # the body and its pieces, not the linen
for ob in bpy.data.objects:
    if 'flat' in ob.keys() and ob.name not in ('Linen', 'Studio'):
        NIGHT_LL.objects.link(ob)
NIGHT_FILL.light_linking.receiver_collection = NIGHT_LL
nightfill_data = NIGHT_FILL.data
LAMP_LL = bpy.data.collections.new('Lamp_receivers')           # warm practical: display and its text only
for ob in PILL_PARTS:
    LAMP_LL.objects.link(ob)
LAMP.light_linking.receiver_collection = LAMP_LL
lamp_data, rim_data, studio_data = LAMP.data, RIM.data, STUDIO_KEY.data

# ---------------------------------------------------------------- camera (one, continuous)
cam_data = bpy.data.cameras.new('Cam')
cam_data.sensor_fit, cam_data.sensor_width, cam_data.lens = 'HORIZONTAL', 36.0, 85.0
cam_data.dof.use_dof = True
cam_data.dof.aperture_fstop = 2.8
cam_data.clip_start, cam_data.clip_end = 0.01, 60.0
CAM = link(bpy.data.objects.new('Cam', cam_data))
SC.camera = CAM


# ================================================================ animation helpers
def _fcurves(idblock):
    """F-curves of an ID's action, through the legacy accessor or the 5.x layered action (slot channel bags)."""
    ad = idblock.animation_data
    if not ad or not ad.action:
        return []
    act = ad.action
    try:
        fcs = list(act.fcurves)
        if fcs:
            return fcs
    except (AttributeError, TypeError):
        pass
    out = []
    for layer in act.layers:
        for strip in layer.strips:
            cb = strip.channelbag(ad.action_slot) if hasattr(strip, 'channelbag') else None
            if cb:
                out += list(cb.fcurves)
    return out


def kf(ob, path, frame, value=None, index=-1, interp='BEZIER', easing='AUTO'):
    """Keyframe `path` on `ob` (an ID, a struct inside one, or a node socket) at `frame`; sets the value first."""
    if value is not None:
        if path.startswith('["'):
            if index >= 0:
                ob[path[2:-2]][index] = value
            else:
                ob[path[2:-2]] = value
        elif index >= 0:
            getattr(ob, path)[index] = value
        else:
            setattr(ob, path, value)
    ob.keyframe_insert(data_path=path, index=index, frame=frame)
    idb = ob.id_data
    full = path if ob == idb else ob.path_from_id(path)
    for fc in _fcurves(idb):
        if fc.data_path == full and (index < 0 or fc.array_index == index):
            for kp in fc.keyframe_points:
                if abs(kp.co.x - frame) < 0.5:
                    kp.interpolation, kp.easing = interp, easing


def key_vec(ob, path, frame, vec, interp='BEZIER', easing='AUTO'):
    for i, v in enumerate(vec):
        kf(ob, path, frame, v, i, interp, easing)


def key_flat(parts, f0, f1, rig=None, eps=FLAT_EPS):
    """Material factor 0 → 1 on every part and the rig's z-scale 1 → eps: the piece becomes its UI drawing."""
    for p in parts:
        kf(p, '["flat"]', f0, 0.0, interp='BEZIER', easing='EASE_IN_OUT')
        kf(p, '["flat"]', f1, 1.0, interp='BEZIER', easing='EASE_IN_OUT')
    if rig is not None:
        kf(rig, 'scale', f0, 1.0, 2, 'BEZIER', 'EASE_IN_OUT')
        kf(rig, 'scale', f1, eps, 2, 'BEZIER', 'EASE_IN_OUT')


def key_visible(ob, spans):
    """Render visibility: hidden everywhere except inside the (start, end) spans (CONSTANT keys)."""
    kf(ob, 'hide_render', 1, True, interp='CONSTANT')
    for a, b in spans:
        kf(ob, 'hide_render', a, False, interp='CONSTANT')
        kf(ob, 'hide_render', b + 1, True, interp='CONSTANT')


def cam_pose(frame, loc, target, lens, fstop, up=None, interp='BEZIER', easing='AUTO', focus=None):
    prev = CAM.rotation_euler.copy()
    CAM.location = Vector(loc)
    aim(CAM, target, up or Vector((0, 0, 1)))
    e = CAM.rotation_euler.copy()
    e.make_compatible(prev)                      # no long-way spins between samples
    CAM.rotation_euler = e
    key_vec(CAM, 'location', frame, CAM.location, interp, easing)
    key_vec(CAM, 'rotation_euler', frame, CAM.rotation_euler, interp, easing)
    kf(cam_data, 'lens', frame, lens, interp=interp, easing=easing)
    kf(cam_data.dof, 'aperture_fstop', frame, fstop, interp=interp, easing=easing)
    kf(cam_data.dof, 'focus_distance', frame, (Vector(focus if focus is not None else target) - Vector(loc)).length,
       interp=interp, easing=easing)


def orbit(target, dist, azim_deg, elev_deg):
    """Camera position at `dist` from target; azimuth 0 = in front (−Y, the viewer's side), 90 = right (+X)."""
    az, el = math.radians(azim_deg), math.radians(elev_deg)
    return Vector(target) + Vector((math.sin(az) * math.cos(el), -math.cos(az) * math.cos(el), math.sin(el))) * dist


def ease(t):
    """Ease-in-out (smootherstep): the camera curve of 01-MOTION (in-out quart family)."""
    return t * t * t * (t * (6 * t - 15) + 10)


def lerp(a, b, t):
    return a + (b - a) * t


SC.frame_start, SC.frame_end, SC.render.fps = 1, LAST_FRAME, FPS
for name, (a, b) in dict(S1=S1, S2=S2, S3=S3, S4=S4, S5=S5, S6=S6, S7=S7, S8=S8).items():
    SC.timeline_markers.new(name, frame=a)

# ---------------------------------------------------------------- camera moves
# Poses (frame, location, target, lens, f-stop, up, focus, ease). Between poses the camera is sampled every CAM_STEP
# frames along the segment's easing: 'inout' = quart in-out (transitions 0.6–1 s), 'out' = quart out (settling before a
# hit), 'hold' = exactly the previous pose (12–18 f after a hit). Position, target, up, lens, aperture and focus move
# together, so the aim never drifts.
UP_Z, UP_Y = Vector((0, 0, 1)), Vector((0, 1, 0))
cap_start = Vector((wx(fader_x(SEEK_X0, SEEK_X1, SEEK_FROM)), wy(DOCK_CY), DOCK_TOP + CAP_PROUD * PX))
cap_end = Vector((wx(SEEK_CAP_X), wy(DOCK_CY), DOCK_TOP + CAP_PROUD * PX))
KEYS_C = Vector(((wx(X_MUTE) + wx(X_FS)) / 2, wy(DOCK_CY), DOCK_TOP))     # centre of the five right keys
EXPL_C = Vector((wx(845), wy(DOCK_CY), DOCK_TOP + 0.045))  # between the mute key and the seek cap, 45 mm up: the raking
#                                                           frame holds display + cap + play (far) and the keys (near)
EXPL_W = Vector((wx(DOCK['x'] + DOCK['w'] / 2), wy(DOCK_CY), DOCK_TOP + 0.045))   # whole body
FINAL_LENS = 135.0
FINAL_D = PLAYER_W * PX / 36.0 * FINAL_LENS                 # 1200 px = the frame width → the UI match
rim_pt = CC_C + Vector((-0.014 * K_KEY, 0.004 * K_KEY, KEY_PROUD * PX))
FAN_PIV = FAN_C + Vector((-0.03 * K_KEY, 0.06 * K_KEY, 0.0))
FAN_T = FAN_C + Vector((-0.03 * K_KEY, 0.06 * K_KEY, -0.01))
FAN_F = FAN_C + Vector((0, -0.012 * K_KEY, 0.016 * K_KEY))
HOLD = None
POSES = [
    # S1 hook (0–2 s): extreme macro, rack focus rim → glyph
    (S1[0], orbit(rim_pt, 0.15 * K_KEY, -64, 34), rim_pt, 100, 14.0, UP_Z, RIM_PT, 'inout'),
    (S1[1], orbit(rim_pt, 0.148 * K_KEY, -56, 36), rim_pt, 100, 14.0, UP_Z, GLYPH_PT, 'inout'),
    # S2 exploded (2–6 s): pull back into the studio (1 s), slow orbit, settle before the parts join at B(11)
    # raking along the body from the right end, low (16°): the three keys near, the seek cap, the display and the play
    # key receding in one frame (`cap` and `display` anchors in frame for the callouts), slow orbit 75° → 70° to f150;
    # then a quart in-out pull-back to the whole body while the parts reunite (f150 → 176), hold into the fade
    (B(6), orbit(EXPL_C, EXPL_D, 75, 16), EXPL_C, EXPL_LENS, 16.0, UP_Z, None, 'inout'),    # f/16: the far pieces readable
    (B(10) - 1, orbit(EXPL_C, EXPL_D, 70, 16), EXPL_C, EXPL_LENS, 16.0, UP_Z, None, 'inout'),
    (B(11) + 10, orbit(EXPL_W, EXPL_D_WIDE, 66, 24), EXPL_W, EXPL_LENS, 8.0, UP_Z, None, 'inout'),
    (S2[1], HOLD, None, None, None, None, None, 'hold'),
    # S3 fan (6–9 s): arrive low (dark), hold, push in, settle before bone rises at B(16)
    (B(13) + 3, orbit(FAN_PIV, 0.48 * K_KEY, -16, 5), FAN_T, 85, 8.0, UP_Z, FAN_F, 'inout'),
    (B(14), HOLD, None, None, None, None, None, 'hold'),
    (B(16) - 8, orbit(FAN_PIV, 0.44 * K_KEY, -11, 6), FAN_T + Vector((0, 0, 0.002)), 85, 8.0, UP_Z, FAN_F, 'out'),
    (B(17), HOLD, None, None, None, None, None, 'hold'),
    (S3[1], HOLD, None, None, None, None, None, 'hold'),
    # S4 press (9–11.5 s): cut (in the black) to a wider pose, settle on the captions key 8 f before the press at
    # B(20), hold 15 f after
    (S4[0], orbit(CC_C, 0.27 * K_KEY, -30, 40), CC_C, 100, 4.0, UP_Z, None, 'inout'),
    (F_PRESS - 8, orbit(CC_C, 0.19 * K_KEY, -22, 44), CC_C, 100, 4.0, UP_Z, None, 'inout'),   # slow start under the fade-in
    (F_PRESS + 15, HOLD, None, None, None, None, None, 'hold'),
    (S5[0], orbit(KEYS_C, 1.3, -18, 55), KEYS_C, 200, 11.0, UP_Z, None, 'inout'),
    # S5 flatten (11.5–15.5 s): short eased moves, the keys drop flat on the beats
    (B(25), orbit(KEYS_C, 1.25, -14, 58), KEYS_C, 220, 11.0, UP_Z, None, 'inout'),
    (B(26), HOLD, None, None, None, None, None, 'hold'),
    (B(29), KEYS_C + Vector((0, -0.003, 0.5 * 600 / 36)), KEYS_C, 600, 22.0, UP_Y, None, 'inout'),
    (B(30), HOLD, None, None, None, None, None, 'hold'),
    # S6 fader (15.5–18.5 s): dive to the cap (1 s), follow it, settle 8 f before it stops at B(35), hold, rise
    (F_CAP_SLIDE[0], orbit(cap_start, 0.24, -52, 16), cap_start, 85, 5.6, UP_Z, None, 'inout'),
    (F_CAP_SLIDE[1] - 8, orbit(cap_end, 0.24, -34, 22), cap_end, 85, 5.6, UP_Z, None, 'out'),
    (F_CAP_SLIDE[1] + 15, HOLD, None, None, None, None, None, 'hold'),
    # S7 display (18.5–21.5 s): settle 8 f before the display lights at B(39), hold, rise as it flattens
    # S6→S7: one 30 f quart in-out (1.0 s) from the cap to the display, arriving 15 f before it lights at B(39)
    # 0.56 m (was 0.42 on the 244 × 44 pill with the 1.5× too small text): the approved composition keeps the label's
    # left edge at x ≈ 240 px and the dot's right edge at ≈ 1770 px (probed 2026-11-10 on the dock B pill)
    (F_DISPLAY_ON[0] - 15, orbit(PILL_C, 0.56, 22, 26), PILL_C, 85, 2.0, UP_Z, None, 'inout'),
    (F_DISPLAY_ON[0] + 15, HOLD, None, None, None, None, None, 'hold'),
    (F_DISPLAY_FLAT[1], PILL_C + Vector((0, -0.002, 0.75)), PILL_C, 100, 11.0, UP_Y, None, 'inout'),
    # S8 hand-off (21.5–24 s): one 22 f quart in-out from the flat display to the exact UI frame (0.73 s, no cut),
    # arriving 8 f before the parts join at B(44); hold to the end
    # FINAL_D above the UI plane (the dock's top at DOCK_TOP), not above z = 0: 16 mm closer would scale the flat frame
    # by 0.36 % and shift the play key 2 px off the live capture (measured 2026-11-10)
    (F_DOCK_FLAT[0], Vector((0, 0, DOCK_TOP + FINAL_D)), Vector((0, 0, DOCK_TOP)), FINAL_LENS, 22.0, UP_Y, None, 'inout'),
    (LAST_FRAME, HOLD, None, None, None, None, None, 'hold'),
]
CAM_STEP = 3


def ease_quart_inout(t):
    return 8 * t ** 4 if t < 0.5 else 1 - 8 * (1 - t) ** 4


def ease_quart_out(t):
    return 1 - (1 - t) ** 4


def lerp(a, b, t):
    return a + (b - a) * t


prev = None
for entry in POSES:
    f1, l1, t1_, L1, A1, u1, fo1, mode = entry
    if mode == 'hold':
        f0, l0, t0, L0, A0, u0, fo0 = prev
        cam_pose(f1, l0, t0, L0, A0, up=u0, focus=fo0, interp='LINEAR')
        prev = (f1, l0, t0, L0, A0, u0, fo0)
        continue
    if prev is None:
        cam_pose(f1, l1, t1_, L1, A1, up=u1, focus=fo1)
        prev = (f1, l1, t1_, L1, A1, u1, fo1)
        continue
    f0, l0, t0, L0, A0, u0, fo0 = prev
    ease_fn = ease_quart_out if mode == 'out' else ease_quart_inout
    frames = list(range(f0 + CAM_STEP, f1, CAM_STEP)) + [f1]
    for f in frames:
        t = ease_fn((f - f0) / (f1 - f0))
        up = Vector(u0) * (1 - t) + Vector(u1) * t
        up = up.normalized() if up.length > 1e-6 else Vector(u1)
        focus = None
        if fo0 is not None or fo1 is not None:
            focus = lerp(Vector(fo0 if fo0 is not None else t0), Vector(fo1 if fo1 is not None else t1_), t)
        cam_pose(f, lerp(Vector(l0), Vector(l1), t), lerp(Vector(t0), Vector(t1_), t), lerp(L0, L1, t),
                 lerp(A0, A1, t), up=up, focus=focus)
    prev = (f1, l1, t1_, L1, A1, u1, fo1)

# ---------------------------------------------------------------- piece animation
# S2 exploded view: layers lift apart on Z (28 / 42 / 56 % of the visible frame height) with slight tilts, hold with a
# drift, drift back together on B(11); secondary layers start 130–230 ms after the keys; studio floor only here
LAYERS = [('keys', [KEYS[k][0] for k in ('mute', 'cc', 'settings', 'fs', 'play')]),
          ('caps', [CAP_SEEK[0], CAP_VOL[0]]), ('display', [RIG_PILL])]
fa, fb, fc, fd = F_EXPLODE
for lname, rigs in LAYERS:
    lift, tilt, lag = EXPLODE[lname], math.radians(EXPLODE_TILT[lname]), EXPLODE_LAG[lname]
    for rig in rigs:
        z0 = rig.location.z
        kf(rig, 'location', fa + lag, z0, 2, 'QUART', 'EASE_IN_OUT')
        kf(rig, 'location', fb + lag, z0 + lift, 2, 'QUART', 'EASE_IN_OUT')
        kf(rig, 'location', fc + lag, z0 + lift * 1.03, 2, 'BEZIER', 'EASE_IN_OUT')     # drifts, never still
        kf(rig, 'location', fd + lag, z0, 2, 'QUART', 'EASE_IN_OUT')
        kf(rig, 'rotation_euler', fa + lag, 0.0, 0, 'QUART', 'EASE_IN_OUT')
        kf(rig, 'rotation_euler', fb + lag, tilt, 0, 'QUART', 'EASE_IN_OUT')
        kf(rig, 'rotation_euler', fc + lag, tilt * 1.1, 0, 'BEZIER', 'EASE_IN_OUT')
        kf(rig, 'rotation_euler', fd + lag, 0.0, 0, 'QUART', 'EASE_IN_OUT')
key_visible(STUDIO, [S2])

# S3 fan: caps lie almost flat, open from a stack into the depth arc (quart in-out, the far cap is the hero, nearer
# caps start 3 f later each), bone rises last in front on B(16); caps render only in S3, the linen is hidden
FAN_ORDER = ['Bone', 'Orange', 'Stone', 'Yellow', 'Graphite']            # front → back
FAN_PITCH, FAN_TILT_FLAT, FAN_TILT_BONE = 0.036 * K_KEY, math.radians(12.0), math.radians(30.0)
FAN_STAGGER = 3
key_visible(LINEN, [(1, S2[0] - 1), (S3[1] + 1, LAST_FRAME)])            # linen off in S2 (studio) and S3 (black)
BONE_RIG = None
FAN_POSE = {}
for rig, parts in FAN_RIGS:
    gname = rig.name.replace('Rig_Glaze', '')
    for p in parts:
        key_visible(p, [S3])
    j = FAN_ORDER.index(gname)
    tilt = FAN_TILT_BONE if gname == 'Bone' else FAN_TILT_FLAT
    rot = Matrix.Rotation(math.radians(-7.0 * j), 3, 'Z') @ Matrix.Rotation(tilt, 3, 'X')
    pos = FAN_C + Vector(((-0.022 * j - 0.0025 * j * j) * K_KEY, FAN_PITCH * j, -0.004 * j + (0.010 if gname == 'Bone' else 0.0)))
    # the stack keeps the fan's vertical order (every cap one level under the one in front, 14 mm: more than a cap is
    # thick), so the levels never cross while the caps slide out; scripts/fan_test.py checks BVH overlap = 0 per frame
    stack = FAN_C + Vector((0, 0.006 * K_KEY * j, -0.014 * j))
    f0 = F_FAN[0] + FAN_STAGGER * (4 - j)
    f1 = F_FAN[1] + FAN_STAGGER * (4 - j) // 2
    flat_rot = Matrix.Rotation(FAN_TILT_FLAT, 3, 'X').to_euler()
    key_vec(rig, 'location', f0, stack, 'QUART', 'EASE_IN_OUT')
    key_vec(rig, 'rotation_euler', f0, flat_rot, 'QUART', 'EASE_IN_OUT')
    if gname == 'Bone':
        key_vec(rig, 'location', f1, FAN_C, 'QUART', 'EASE_IN_OUT')
        key_vec(rig, 'rotation_euler', f1, flat_rot, 'QUART', 'EASE_IN_OUT')
        key_vec(rig, 'location', F_BONE_UP[0], FAN_C, 'QUART', 'EASE_IN_OUT')
        key_vec(rig, 'rotation_euler', F_BONE_UP[0], flat_rot, 'QUART', 'EASE_IN_OUT')
        key_vec(rig, 'location', F_BONE_UP[1], pos, 'QUART', 'EASE_OUT')
        key_vec(rig, 'rotation_euler', F_BONE_UP[1], rot.to_euler(), 'QUART', 'EASE_OUT')
        key_vec(rig, 'location', S3[1], pos + Vector((0, -0.002, 0.001)), 'BEZIER', 'EASE_IN_OUT')
        BONE_RIG = rig
    else:
        key_vec(rig, 'location', f1, pos, 'QUART', 'EASE_IN_OUT')
        key_vec(rig, 'rotation_euler', f1, rot.to_euler(), 'QUART', 'EASE_IN_OUT')
        key_vec(rig, 'location', S3[1], pos + Vector((0, 0, 0.002)), 'BEZIER', 'EASE_IN_OUT')
    FAN_POSE[gname] = (pos, rot)
# the black-ceramic reflector: mirror direction from the graphite's dome toward the S3 camera
_g_pos, _g_rot = FAN_POSE['Graphite']
_g_n = (_g_rot @ Vector((0, 0, 1))).normalized()
_g_p = _g_pos + _g_n * 0.0082
_g_cam = orbit(FAN_PIV, 0.46 * K_KEY, -13, 6)
_v = (_g_cam - _g_p).normalized()
_mirror = (2 * _g_n.dot(_v) * _g_n - _v).normalized()
FAN_REFL.location = _g_p + _mirror * 0.8
aim(FAN_REFL, _g_p)

# S4 press on B(20): down 2 mm in 2 f, back in 6 f with a ≤ 1 px overshoot; the key stays latched 1 px lower and its
# ring turns into the 2 px accent rim (secondary) 130 ms later
kf(CC_RIG, 'location', F_PRESS, DOCK_TOP, 2, 'BEZIER', 'EASE_IN')
kf(CC_RIG, 'location', F_PRESS + 2, DOCK_TOP - 2.0 * PX, 2, 'BEZIER', 'EASE_OUT')
kf(CC_RIG, 'location', F_PRESS + 6, DOCK_TOP - (LATCH_TRAVEL - 0.6) * PX, 2, 'BEZIER', 'EASE_IN_OUT')
kf(CC_RIG, 'location', F_PRESS + 8, DOCK_TOP - LATCH_TRAVEL * PX, 2, 'BEZIER', 'EASE_OUT')
for p in CC_PARTS:
    kf(p, '["latch"]', F_LATCH[0], 0.0, interp='BEZIER', easing='EASE_IN_OUT')
    kf(p, '["latch"]', F_LATCH[1], 1.0, interp='BEZIER', easing='EASE_IN_OUT')
# while it flattens, the latched key's 1 px travel becomes the UI's `translate: 0 1px` (1 mm down the screen, back
# onto the UI plane), so the flat drawing sits where the live DOM draws it (1012–1056 × 596–640 at 1200 wide)
_cc_y = CC_RIG.location.y
kf(CC_RIG, 'location', F_KEYS_FLAT['cc'] - F_FLAT_LEN, _cc_y, 1, 'BEZIER', 'EASE_IN_OUT')
kf(CC_RIG, 'location', F_KEYS_FLAT['cc'], _cc_y - LATCH_TRAVEL * PX, 1, 'BEZIER', 'EASE_IN_OUT')
kf(CC_RIG, 'location', F_KEYS_FLAT['cc'] - F_FLAT_LEN, DOCK_TOP - LATCH_TRAVEL * PX, 2, 'BEZIER', 'EASE_IN_OUT')
kf(CC_RIG, 'location', F_KEYS_FLAT['cc'], DOCK_TOP, 2, 'BEZIER', 'EASE_IN_OUT')

# S5 flatten: each key becomes its drawing over 30 f, ending on its beat; the linen wipes to the flat canvas
for nm, f_end in F_KEYS_FLAT.items():
    rig, parts = KEYS[nm]
    key_flat(parts, f_end - F_FLAT_LEN, f_end, rig=rig)
kf(LINEN, '["wipe"]', 1, 10.0, interp='CONSTANT')
kf(LINEN, '["wipe"]', F_WIPE[0], 0.75, interp='QUART', easing='EASE_IN_OUT')
kf(LINEN, '["wipe"]', F_WIPE[1], -0.1, interp='QUART', easing='EASE_IN_OUT')
kf(LINEN, '["wipe"]', F_WIPE[1] + 14, -5.0, interp='BEZIER', easing='EASE_IN_OUT')
for f, hexv in ((F_WIPE[0], HEX['field']), (S6[0], HEX['field']), (S6[1], '#CFC4B4'), (F_DISPLAY_ON[0], '#0B0A09'),
                (LAST_FRAME, '#060606')):
    key_vec(LINEN, '["field"]', f, srgb_to_lin(hexv), 'BEZIER', 'EASE_IN_OUT')

# S6 fader: the cap slides SEEK_FROM → SEEK_FILL and stops on B(35); the fill follows; caps + inlays flatten after.
# From the hard cut the stand-in keeps playing: cap and fill creep to SEEK_END by f720 (the live player would too).
seek_rig, seek_parts = CAP_SEEK
x_from, x_cut, x_end = wx(fader_x(SEEK_X0, SEEK_X1, SEEK_FROM)), wx(SEEK_CAP_X), wx(fader_x(SEEK_X0, SEEK_X1, SEEK_END))
kf(seek_rig, 'location', 1, x_from, 0, 'LINEAR')
kf(seek_rig, 'location', F_CAP_SLIDE[0], x_from, 0, 'QUART', 'EASE_IN_OUT')
kf(seek_rig, 'location', F_CAP_SLIDE[1], x_cut, 0, 'QUART', 'EASE_IN_OUT')
kf(seek_rig, 'location', HARD_CUT, x_cut, 0, 'LINEAR')
kf(seek_rig, 'location', LAST_FRAME, x_end, 0, 'LINEAR')
kf(INLAY_FILL, 'scale', 1, fill_len(SEEK_FROM) / fill_len(SEEK_FILL), 0, 'LINEAR')
kf(INLAY_FILL, 'scale', F_CAP_SLIDE[0], fill_len(SEEK_FROM) / fill_len(SEEK_FILL), 0, 'QUART', 'EASE_IN_OUT')
kf(INLAY_FILL, 'scale', F_CAP_SLIDE[1], 1.0, 0, 'QUART', 'EASE_IN_OUT')
kf(INLAY_FILL, 'scale', HARD_CUT, 1.0, 0, 'LINEAR')
kf(INLAY_FILL, 'scale', LAST_FRAME, fill_len(SEEK_END) / fill_len(SEEK_FILL), 0, 'LINEAR')
key_flat(seek_parts, *F_FADER_FLAT, rig=seek_rig)
key_flat(CAP_VOL[1], *F_FADER_FLAT, rig=CAP_VOL[0])
key_flat(INLAYS, *F_FADER_FLAT)

# the display shows the film's own time: each current-time variant renders only during its second
for sec, o_, _ in CUR_OBS:
    key_visible(o_, [(max(1, sec * FPS + 1), min(LAST_FRAME, (sec + 1) * FPS))])
# S7 display: lights on B(39), then flattens; bokeh only in S7–S8
for p in LIT_PARTS:
    kf(p, '["lit"]', F_DISPLAY_ON[0], 0.0)
    kf(p, '["lit"]', F_DISPLAY_ON[1], 1.0)
key_flat(PILL_PARTS, *F_DISPLAY_FLAT, rig=RIG_PILL)
for b_, s_ in BOKEH:
    kf(b_, '["lit"]', S6[1], 0.0)
    kf(b_, '["lit"]', S7[0] + 15, 6.0 * s_)
    kf(b_, '["lit"]', F_DOCK_FLAT[0], 6.0 * s_)
    kf(b_, '["lit"]', F_DOCK_FLAT[1], 0.0)

# S8 hand-off: the body flattens onto B(44); the play glyph becomes the pause bars (the UI is playing)
key_flat([DOCK_OB], *F_DOCK_FLAT, rig=RIG_DOCK)
for p in PLAY_GLYPH_PLAY:
    kf(p, 'hide_render', 1, False, interp='CONSTANT')
    kf(p, 'hide_render', F_MORPH, True, interp='CONSTANT')
for p in PAUSE_PARTS:
    kf(p, 'hide_render', 1, True, interp='CONSTANT')
    kf(p, 'hide_render', F_MORPH, False, interp='CONSTANT')
# playing = latched: the play key drops its 1 px travel with the glyph (the DOM draws it at 36–112 × 596–640)
kf(PLAY_RIG, 'location', F_MORPH - 1, PLAY_RIG.location.y, 1, 'CONSTANT')
kf(PLAY_RIG, 'location', F_MORPH, PLAY_RIG.location.y - LATCH_TRAVEL * PX, 1, 'CONSTANT')


# ---------------------------------------------------------------- light phases
def key_world(frame, hexv, strength):
    key_vec(W_BG.inputs['Color'], 'default_value', frame, rgba(hexv), 'BEZIER', 'EASE_IN_OUT')
    kf(W_BG.inputs['Strength'], 'default_value', frame, strength, interp='BEZIER', easing='EASE_IN_OUT')


def key_energy(light_data, frame, energy, color=None):
    kf(light_data, 'energy', frame, energy, interp='BEZIER', easing='EASE_IN_OUT')
    if color:
        key_vec(light_data, 'color', frame, srgb_to_lin(color), 'BEZIER', 'EASE_IN_OUT')


def ramp(fn, f0, f1, v0, v1, n=5):
    """Light fade on a square law: the value follows u² (u = fraction toward the lit end), so the luma on screen
    rises or falls about linearly instead of popping at one end (measured on the 26 s preview)."""
    lo, hi = min(v0, v1), max(v0, v1)
    for k in range(n):
        t = k / (n - 1)
        u = t if v1 > v0 else 1 - t
        fn(round(f0 + (f1 - f0) * t), lo + (hi - lo) * u * u)


def key_sun(frame, energy, color, elev):
    key_energy(sun_data, frame, energy, color)
    SUN.location = DOCK_C + sun_dir(elev, SUN_AZIM) * 2.0
    aim(SUN, DOCK_C)
    key_vec(SUN, 'rotation_euler', frame, SUN.rotation_euler, 'BEZIER', 'EASE_IN_OUT')
    GOBO.location = DOCK_C + sun_dir(elev, SUN_AZIM) * 1.2
    aim_gobo(GOBO, DOCK_C)
    key_vec(GOBO, 'location', frame, GOBO.location, 'BEZIER', 'EASE_IN_OUT')
    key_vec(GOBO, 'rotation_euler', frame, GOBO.rotation_euler, 'BEZIER', 'EASE_IN_OUT')


FADE = 12                                     # light fades: 12 f out / 15 f in → no black longer than ~0.3 s
FADE_IN_S4 = 22                               # the morning comes up in 22 f (0.73 s): the fastest change of the film otherwise
# S1 black: only the rim strip (sliding along the bevel, azimuth 140° → 200°) and the cool fill, both linked to the key
key_world(S1[0], '#000000', 0.0)
key_world(S1[1], '#000000', 0.0)
_prev_rim = RIM.rotation_euler.copy()
for f in range(S1[0], S1[1] + 1, 3):
    t = (f - S1[0]) / (S1[1] - S1[0])
    az = math.radians(lerp(140.0, 200.0, t))
    el = math.radians(lerp(0.8, 0.5, t))
    RIM.location = CC_C + Vector((math.sin(az) * math.cos(el), -math.cos(az) * math.cos(el), math.sin(el))) * 0.24
    aim(RIM, RIM_PT, Vector((0, 0, 1)))
    _e = RIM.rotation_euler.copy()
    _e.make_compatible(_prev_rim)
    RIM.rotation_euler = _e
    _prev_rim = _e.copy()
    key_vec(RIM, 'location', f, RIM.location, 'LINEAR')
    key_vec(RIM, 'rotation_euler', f, RIM.rotation_euler, 'LINEAR')
RIM_LL = bpy.data.collections.new('Rim_receivers')           # the rim lights the key body (bevel, ring), never the face
for p in CC_PARTS:
    if not p.name.endswith('_face'):
        RIM_LL.objects.link(p)
RIM.light_linking.receiver_collection = RIM_LL
FILL_LL = bpy.data.collections.new('Fill_receivers')         # the cool fill lights the whole key
for p in CC_PARTS:
    FILL_LL.objects.link(p)
HOOK_FILL_LIGHT = area_light('HookFill', 'SQUARE', 0.3, 0.3, 0.0, HOOK_FILL_COLOR, CC_C + Vector((-0.1, -0.1, 0.3)), CC_C)
HOOK_FILL_LIGHT.light_linking.receiver_collection = FILL_LL
HOOK_FILL_LIGHT.visible_glossy = False
hookfill_data = HOOK_FILL_LIGHT.data
for d_, p_ in ((rim_data, RIM_POWER), (hookfill_data, HOOK_FILL)):
    key_energy(d_, S1[0], p_)
    key_energy(d_, S1[1], p_)
    ramp(lambda f, v: key_energy(d_, f, v), S2[0], S2[0] + FADE, p_, 0.0)
for p in CC_PARTS:                                           # hook only: the key's base at 0.2 → graphite face
    p['gain'] = [0.2, 0.2, 0.2]
    key_vec(p, '["gain"]', S1[1], (0.2, 0.2, 0.2), 'BEZIER', 'EASE_IN_OUT')
    key_vec(p, '["gain"]', S2[0] + FADE, (1.0, 1.0, 1.0), 'BEZIER', 'EASE_IN_OUT')
# S2 studio: comes up in 15 f over the pull-back, holds, fades to black 12 f before the fan
ramp(lambda f, v: key_world(f, STUDIO_COLOR, v), S2[0], S2[0] + 15, 0.0, STUDIO_STRENGTH)
ramp(lambda f, v: key_world(f, STUDIO_COLOR, v), S2[1] - FADE, S2[1], STUDIO_STRENGTH, 0.0)
ramp(lambda f, v: key_energy(studio_data, f, v), S2[0], S2[0] + 15, 0.0, STUDIO_KEY_POWER)
ramp(lambda f, v: key_energy(studio_data, f, v), S2[1] - FADE, S2[1], STUDIO_KEY_POWER, 0.0)
# S3 low key: black world; fan lights up in 15 f, out in 12 f
key_world(S3[0], LOWKEY_COLOR, LOWKEY_STRENGTH)
key_world(S3[1], LOWKEY_COLOR, LOWKEY_STRENGTH)
for d_, p_ in ((fankey_data, FAN_KEY_POWER), (fankeybone_data, FAN_KEY_BONE_POWER), (fanrim_l_data, FAN_RIM_POWER),
               (fanrim_r_data, FAN_RIM_POWER), (fanrefl_data, FAN_REFL_POWER), (fankeyorange_data, FAN_ORANGE_POWER),
               (fankeystone_data, FAN_STONE_POWER)):
    ramp(lambda f, v: key_energy(d_, f, v), S3[0], S3[0] + 15, 0.0, p_)
    ramp(lambda f, v: key_energy(d_, f, v), S3[1] - FADE, S3[1], p_, 0.0)
# S4–S5 morning window (approved SF5 look) from the press through the flatten; bone/keys gain measured for it
ramp(lambda f, v: key_world(f, SKY_COLOR, v), S4[0], S4[0] + FADE_IN_S4, 0.0, SKY_STRENGTH)
key_world(S5[1], SKY_COLOR, SKY_STRENGTH)
ramp(lambda f, v: key_sun(f, v, SUN_COLOR, SUN_ELEV), S4[0], S4[0] + FADE_IN_S4, 0.0, SUN_STRENGTH)
key_sun(S5[1], SUN_STRENGTH, SUN_COLOR, SUN_ELEV)
ramp(lambda f, v: key_energy(backfill_data, f, v), S4[0], S4[0] + FADE_IN_S4, 0.0, BACKFILL_POWER)
key_energy(backfill_data, S5[1], BACKFILL_POWER)
key_energy(backfill_data, S6[0] + 30, 0.0)
for ob in [DOCK_OB] + [p for k in ('mute', 'settings', 'fs', 'play') for p in KEYS[k][1]] + \
        [p for p in CC_PARTS] + INLAYS + CAP_SEEK[1] + CAP_VOL[1]:
    if 'gain' not in ob.keys():
        ob['gain'] = [1.0, 1.0, 1.0]
    if ob not in CC_PARTS:
        key_vec(ob, '["gain"]', S2[0] + FADE, (1.0, 1.0, 1.0), 'BEZIER', 'EASE_IN_OUT')
    key_vec(ob, '["gain"]', S4[0], (1.0, 1.0, 1.0), 'BEZIER', 'EASE_IN_OUT')
    g45 = ACCENT_GAIN_S45 if ob in CAP_SEEK[1] else PASS_GAIN_S45   # the accent: its own measured compensation
    key_vec(ob, '["gain"]', S4[0] + 15, g45, 'BEZIER', 'EASE_IN_OUT')
    key_vec(ob, '["gain"]', S5[1], g45, 'BEZIER', 'EASE_IN_OUT')
    g6 = ACCENT_GAIN_S6 if ob in CAP_SEEK[1] else GAIN_S6   # the accent keeps its own, measured dusk compensation
    if ob in CAP_SEEK[1]:                                    # the cap's gain lags the sun's fall (f481 measured +12 %)
        key_vec(ob, '["gain"]', S6[0] + 15, g45, 'BEZIER', 'EASE_IN_OUT')
    key_vec(ob, '["gain"]', S6[0] + 30, g6, 'BEZIER', 'EASE_IN_OUT')
    key_vec(ob, '["gain"]', S6[1], g6, 'BEZIER', 'EASE_IN_OUT')
    key_vec(ob, '["gain"]', S7[0] + 15, (1.0, 1.0, 1.0), 'BEZIER', 'EASE_IN_OUT')
# S6 accent key: a small white area light riding with the seek cap, linked to the cap parts only → constant accent
CAP_KEY = area_light('CapKey', 'SQUARE', 0.08, 0.08, 0.0, '#FFFFFF', Vector((0.03, -0.06, 0.14)), Vector((0, 0, 0)))
CAP_KEY.parent = CAP_SEEK[0]                                  # local offset: the rig is never rotated
CAP_KEY.visible_glossy = False
CAP_KEY_LL = bpy.data.collections.new('CapKey_receivers')
for p in CAP_SEEK[1]:
    CAP_KEY_LL.objects.link(p)
CAP_KEY.light_linking.receiver_collection = CAP_KEY_LL
capkey_data = CAP_KEY.data
key_energy(capkey_data, S6[0] + 15, 0.0)
key_energy(capkey_data, S6[0] + 30, CAP_KEY_POWER)
key_energy(capkey_data, F_CAP_SLIDE[1], CAP_KEY_POWER)
key_energy(capkey_data, S6[1], CAP_KEY_POWER * 1.4)          # follows the dusk sun down (f541 measured −6 %)
key_energy(capkey_data, S7[0] + 15, 0.0)
# S6 dusk: pale low sun through the window, cool sky
key_sun(S6[0] + 30, SUN_STRENGTH * 0.45, DUSK_SUN_COLOR, 11.0)
key_sun(S6[1], SUN_STRENGTH * 0.25, DUSK_SUN_COLOR, 5.0)
key_sun(S7[0] + 15, 0.0, DUSK_SUN_COLOR, 3.0)
key_world(S6[0] + 30, DUSK_SKY_COLOR, 0.6)
key_world(S6[1], DUSK_SKY_COLOR, 0.35)
# S7–S8 night: warm lamp as a rim on the display, neutral fill on the body
key_world(S7[0] + 15, NIGHT_SKY_COLOR, NIGHT_SKY_STRENGTH)
key_world(S8[0], NIGHT_SKY_COLOR, NIGHT_SKY_STRENGTH)
key_world(LAST_FRAME, NIGHT_SKY_COLOR, NIGHT_SKY_STRENGTH * 0.25)
for d_, p_ in ((lamp_data, LAMP_POWER), (nightfill_data, NIGHT_FILL_POWER)):
    key_energy(d_, S6[1], 0.0)
    key_energy(d_, S7[0] + 15, p_)
    key_energy(d_, F_DOCK_FLAT[0], p_)
    key_energy(d_, F_DOCK_FLAT[1], p_ * 0.08)

for ob in bpy.data.objects:
    if 'flat' in ob.keys() and 'gain' not in ob.keys():
        ob['gain'] = [1.0, 1.0, 1.0]
SC.frame_set(1)

# ================================================================ render settings
SC.render.engine = 'CYCLES'
SC.cycles.device = 'GPU'
SC.cycles.samples = SAMPLES
SC.cycles.use_adaptive_sampling = False
SC.cycles.sample_clamp_indirect = 10.0
SC.cycles.use_denoising = True
SC.cycles.denoiser = 'OPENIMAGEDENOISE'
SC.cycles.denoising_use_gpu = True
SC.cycles.max_bounces, SC.cycles.diffuse_bounces, SC.cycles.glossy_bounces = 8, 3, 4
SC.render.resolution_x, SC.render.resolution_y = RES
SC.render.resolution_percentage = 100
SC.render.film_transparent = False
SC.render.use_persistent_data = True
SC.render.use_motion_blur = False
SC.render.motion_blur_shutter = 0.5
SC.view_settings.view_transform = VIEW_TRANSFORM
SC.view_settings.look = 'None'
SC.view_settings.exposure = EXPOSURE
SC.render.image_settings.file_format = 'PNG'
SC.render.image_settings.color_mode = 'RGB'
SC.render.image_settings.color_depth = '8'

# ---------------------------------------------------------------- timing export for the motion layer (film/motion reads
# this; the text follows the 3D timing automatically: read, never typed). Contract: film/motion/README.md.
TAB_HOPS = (HARD_CUT + 12, HARD_CUT + 34, HARD_CUT + 56)   # 688 / 710 / 732: Tab presses spread over the live window 676–750
_s5_top = POSES[[i for i, p in enumerate(POSES) if p[0] == B(29)][0]]   # the top-down S5 pose (B29–B30 hold, the wipe)
PX_PER_MM_S5 = 1920.0 / ((_s5_top[1] - _s5_top[2]).length * 36.0 / _s5_top[3] * 1000.0)
SCENES_JSON = os.path.join(os.path.dirname(BLEND), 'scenes.json')
with open(SCENES_JSON, 'w', encoding='utf-8') as fh:
    json.dump(dict(
        exported_by='film/scripts/build_scene.py', frame_base=1, fps=FPS, bpm=BPM, fpb=FPB, size=[1920, 1080],
        film_s=FILM_S, frames=END_CARD[1], hard_cut=HARD_CUT,
        scenes=[dict(id=i, n=n, name=nm, start=a, end=b) for n, (i, nm, (a, b)) in enumerate(
            (('S1', 'Hook', S1), ('S2', 'Exploded', S2), ('S3', 'Glaze', S3), ('S4', 'Press', S4), ('S5', 'Flatten', S5),
             ('S6', 'Fader', S6), ('S7', 'Display', S7), ('S8', 'Hand-off', S8), ('END', 'End', END_CARD)), 1)],
        events=dict(explode=list(F_EXPLODE), fan=list(F_FAN), bone_up=list(F_BONE_UP), press=F_PRESS, latch=list(F_LATCH), led=list(F_LATCH),
                    keys_flat=dict(F_KEYS_FLAT), flat_len=F_FLAT_LEN, wipe=list(F_WIPE), cap_slide=list(F_CAP_SLIDE),
                    fader_flat=list(F_FADER_FLAT), display_on=list(F_DISPLAY_ON), display_flat=list(F_DISPLAY_FLAT),
                    dock_flat=list(F_DOCK_FLAT), morph=F_MORPH, tab_hops=list(TAB_HOPS)),
        seek={'from': SEEK_FROM, 'fill': SEEK_FILL, 'end': SEEK_END, 'time_dur': TIME_DUR},
        px_per_mm_s5=round(PX_PER_MM_S5, 3),
        world=dict(px_m=PX, dock_top_z=DOCK_TOP,
                   seek_groove=[[wx(SEEK_X0), wy(DOCK_CY), DOCK_TOP], [wx(SEEK_X1), wy(DOCK_CY), DOCK_TOP]],
                   cap_proud=CAP_PROUD * PX, key_proud=KEY_PROUD * PX, glazes=[g[0] for g in GLAZES]),
    ), fh, indent=1)
print('SCENES JSON', SCENES_JSON, 'px/mm S5', round(PX_PER_MM_S5, 2), 'tab hops', TAB_HOPS)

# ---------------------------------------------------------------- sanity: light state at the style frames
for nm, f in STYLE_FRAMES.items():
    SC.frame_set(f)
    print(f'  {nm} f{f}: world {W_BG.inputs["Strength"].default_value:.3f} sun {sun_data.energy:.2f} '
          f'rim {rim_data.energy:.2f} fankey {fankey_data.energy:.2f} lamp {lamp_data.energy:.2f} backfill {backfill_data.energy:.1f} '
          f'wipe {LINEN["wipe"]:.2f}')
SC.frame_set(1)

# ================================================================ save
bpy.ops.wm.save_as_mainfile(filepath=BLEND)
print('BUILD OK', BLEND, 'frames', SC.frame_start, SC.frame_end, 'style frames', STYLE_FRAMES,
      'hard cut at', HARD_CUT_S, 's · film', FILM_S, 's · end card', END_CARD)
