import sys, os, time, bpy
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from scene import build, place_camera
from mathutils import Vector
out = sys.argv[sys.argv.index('--') + 1] if '--' in sys.argv else '/tmp/poc'
model = sys.argv[sys.argv.index('--') + 2] if '--' in sys.argv and len(sys.argv) > sys.argv.index('--') + 2 else 'tela'
cols = dict(tela=dict(crown='#141416', visor='#141416', under='#c81e28'), gamuza=dict(crown='#9a6139', visor='#141416', under='#141416'))[model if model in ('tela', 'gamuza') else 'tela']
S = build(model, cols, samples=int(os.environ.get('SAMPLES', 64)), res=int(os.environ.get('RES', 720)))
sc = S['scene']
# piso justo debajo del punto más bajo de la gorra
zs = [ (o.matrix_world @ Vector(c)).z for o in sc.objects if o.type == 'MESH' and not o.is_shadow_catcher for c in o.bound_box ]
floor = [o for o in sc.objects if o.type == 'MESH' and o.is_shadow_catcher][0]; floor.location.z = min(zs) - .003
bb = [ (o.matrix_world @ Vector(c)) for o in sc.objects if o.type == 'MESH' and not o.is_shadow_catcher for c in o.bound_box ]
ctr = sum(bb, Vector()) / len(bb)
for yaw in [float(v) for v in os.environ.get('YAWS', '40,-40').split(',')]:
    place_camera(S['cam'], yaw_deg=yaw, pitch_deg=float(os.environ.get('PITCH', 12)), dist=7.4, target=tuple(ctr))
    sc.render.filepath = f'{out}_{model}_{int(yaw)}.png'
    t0 = time.time(); bpy.ops.render.render(write_still=True); print('render', yaw, round(time.time() - t0, 1), 's', flush=True)
