"""Fan intersection test: on every S3 frame, BVH overlap between every pair of glaze caps must be empty.
    blender --background --factory-startup film/scene.blend --python-exit-code 1 --python fan_test.py -- [start end] [--out report.json]
Exit code 2 when any pair intersects on any frame."""
import bpy, json, sys, os
from mathutils.bvhtree import BVHTree
args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
nums = [int(a) for a in args if a.isdigit()]
OUT = args[args.index('--out') + 1] if '--out' in args else None
sc = bpy.data.scenes['Film']
SCN = json.load(open(os.path.join(os.path.dirname(bpy.data.filepath), 'scenes.json'), encoding='utf-8'))
s3 = [s for s in SCN['scenes'] if s['id'] == 'S3'][0]
START, END = (nums[0], nums[1]) if len(nums) >= 2 else (s3['start'], s3['end'])
# every mesh part parented under a Rig_Glaze* rig, grouped per glaze
rigs = [o for o in bpy.data.objects if o.name.startswith('Rig_Glaze')]
groups = {}
for r in rigs:
    parts = [o for o in bpy.data.objects if o.type == 'MESH' and o.parent is not None and (o.parent == r or (o.parent.parent == r))]
    groups[r.name.replace('Rig_Glaze', '')] = parts
names = sorted(groups)
print('caps:', {n: [p.name for p in groups[n]] for n in names})
bad = {}
worst = (0, None, None)
for f in range(START, END + 1):
    sc.frame_set(f)
    dg = bpy.context.evaluated_depsgraph_get(); dg.update()
    trees = {}
    for n in names:
        # one BVH per glaze over all its parts (world space)
        verts, polys, off = [], [], 0
        for p in groups[n]:
            ev = p.evaluated_get(dg); me = ev.to_mesh()
            mw = ev.matrix_world
            verts += [mw @ v.co for v in me.vertices]
            polys += [[i + off for i in poly.vertices] for poly in me.polygons]
            off += len(me.vertices)
            ev.to_mesh_clear()
        trees[n] = BVHTree.FromPolygons(verts, polys, all_triangles=False, epsilon=0.0)
    for i, a in enumerate(names):
        for b in names[i + 1:]:
            ov = trees[a].overlap(trees[b])
            if ov:
                bad.setdefault(f'{a}-{b}', []).append((f, len(ov)))
                if len(ov) > worst[0]:
                    worst = (len(ov), f, f'{a}-{b}')
print(f'\nFAN TEST frames {START}-{END}: {"OK, no cap pair intersects" if not bad else "FAIL"}')
for k, v in bad.items():
    fr = [x[0] for x in v]
    print(f'  {k}: {len(fr)} frames ({fr[0]}-{fr[-1]}), max {max(x[1] for x in v)} face pairs')
if worst[1]:
    print('  worst:', worst)
if OUT:
    json.dump(dict(start=START, end=END, ok=not bad, pairs={k: v for k, v in bad.items()}), open(OUT, 'w'), indent=0)
sys.exit(2 if bad else 0)
