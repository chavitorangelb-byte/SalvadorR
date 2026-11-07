"""Giro fotorrealista de la gorra (Cycles) con pasadas para recolorear y poner el logo en la página.
Uso: python3 turntable.py -- <modelo> <carpeta_salida> [frames] [res] [samples] [solo_frames: 0,5,10]
Por cuadro escribe:
  <i>-l.webp   luz difusa (gris, codificada sqrt(L/LMAX))
  <i>-s.webp   brillo/sheen que no depende del color (gris, sqrt(S/SMAX))
  <i>-b.webp   imagen base con tono final (para etiqueta, plástico, sombra)
  <i>-i.png    R = parte (1 corona, 2 visera, 3 abajo, 0 otro), G,B = coordenadas del logo, A = alfa
"""
import sys, os, math, time
import numpy as np
import bpy
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from scene import build, place_camera
from mathutils import Vector
import OpenEXR
from PIL import Image

LMAX, SMAX = 4.0, 2.0
EXPOSURE = 1.0

def neutral_tonemap(c):
    # Khronos PBR Neutral (el mismo que usa la página)
    start, desat = .8 - .04, .15
    x = np.minimum(np.minimum(c[..., 0], c[..., 1]), c[..., 2])
    off = np.where(x < .08, x - 6.25 * x * x, .04)
    c = c - off[..., None]
    peak = np.maximum(np.maximum(c[..., 0], c[..., 1]), c[..., 2])
    d = 1 - start
    newpeak = 1 - d * d / (peak + d - start + 1e-9)
    scale = np.where(peak < start, 1.0, newpeak / np.maximum(peak, 1e-9))
    c2 = c * scale[..., None]
    g = 1 - 1 / (desat * (peak - newpeak) + 1)
    g = np.where(peak < start, 0.0, g)
    return c2 * (1 - g[..., None]) + newpeak[..., None] * g[..., None]

def to_srgb(c):
    c = np.clip(c, 0, 1)
    return np.where(c <= .0031308, c * 12.92, 1.055 * np.power(c, 1 / 2.4) - .055)

def read_exr(path):
    out = {}
    with OpenEXR.File(path) as f:
        for p in f.parts:
            for k, v in p.channels.items(): out[k] = np.asarray(v.pixels, dtype=np.float32)
    return out

def pick(ch, *names):
    for n in names:
        for k, v in ch.items():
            if k == n or k.endswith('.' + n) or k.endswith(n): return v
    raise KeyError(names[0] + ' :: ' + ','.join(list(ch)[:40]))

def main():
    argv = sys.argv[sys.argv.index('--') + 1:]
    model, out = argv[0], argv[1]
    N = int(argv[2]) if len(argv) > 2 else 24
    res = int(argv[3]) if len(argv) > 3 else 640
    spp = int(argv[4]) if len(argv) > 4 else 48
    only = [int(x) for x in argv[5].split(',')] if len(argv) > 5 and argv[5] else None
    os.makedirs(out, exist_ok=True)
    gray = '#7a7a7a'
    S = build(model, dict(crown=gray, visor=gray, under=gray), samples=spp, res=res)
    sc = S['scene']; vl = sc.view_layers[0]
    for k in ('use_pass_diffuse_direct', 'use_pass_diffuse_indirect', 'use_pass_diffuse_color', 'use_pass_combined'):
        setattr(vl, k, True)
    for name, typ in (('part', 'VALUE'), ('decal', 'COLOR')):
        a = vl.aovs.add(); a.name = name; a.type = typ
    if hasattr(sc.render.image_settings, 'media_type'): sc.render.image_settings.media_type = 'MULTI_LAYER_IMAGE'
    sc.render.image_settings.file_format = 'OPEN_EXR_MULTILAYER'
    sc.render.image_settings.color_depth = '32'
    sc.render.filter_size = 1.2
    # piso justo debajo y cámara centrada en la gorra
    meshes = [o for o in sc.objects if o.type == 'MESH' and not o.is_shadow_catcher]
    zs = [(o.matrix_world @ Vector(c)).z for o in meshes for c in o.bound_box]
    floor = [o for o in sc.objects if o.type == 'MESH' and o.is_shadow_catcher][0]; floor.location.z = min(zs) - .003
    bb = [(o.matrix_world @ Vector(c)) for o in meshes for c in o.bound_box]
    lo = Vector((min(v.x for v in bb), min(v.y for v in bb), min(v.z for v in bb)))
    hi = Vector((max(v.x for v in bb), max(v.y for v in bb), max(v.z for v in bb)))
    ctr = (lo + hi) / 2  # centro de la caja completa (con visera), no promedio de piezas
    pivot = S['pivot']
    for o in pivot.children: o.location.x -= ctr.x; o.location.y -= ctr.y  # gira sobre el centro de la gorra
    # distancia para que quepa completa en cualquier giro: radio horizontal máximo con margen
    R = 0.0
    for o in meshes:
        for v in o.data.vertices:
            w = o.matrix_world @ v.co; R = max(R, math.hypot(w.x - ctr.x, w.y - ctr.y))
    cam = S['cam'].data; half = math.atan(cam.sensor_width / 2 / cam.lens)
    fit = float(os.environ.get('FIT', .9))  # fracción del cuadro que puede ocupar
    dist = R * math.sqrt(1 + 1 / (math.tan(half) * fit) ** 2)
    dist = float(os.environ.get('DIST', dist))
    print(f'radio {R:.3f} distancia {dist:.2f}', flush=True)
    views = [(i * 360 / N, 14) for i in range(N)] + [(-25, 55), (-25, -16)]
    overlay = os.environ.get('OVERLAY')
    if overlay:
        from scene import simple_material, node, load_img
        before = set(sc.objects)
        bpy.ops.import_scene.gltf(filepath=os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'build', 'overlays.gltf'))
        new = [o for o in sc.objects if o not in before and o.type == 'MESH']
        for o in meshes: o.is_holdout = True  # la gorra tapa la capa pero no sale en la imagen
        floor.hide_render = True  # la sombra en el piso ya viene en el render de la gorra
        for o in new:
            keep = o.name.startswith(overlay)
            if not keep: bpy.data.objects.remove(o); continue
            o.parent = pivot; o.location.x -= ctr.x; o.location.y -= ctr.y
            for pl in o.data.polygons: pl.use_smooth = True
            rim = 'Rim' in o.name
            if overlay == 'plate':
                # metal pavonado satinado con canto pulido, como la placa real
                m = simple_material('plate' + ('rim' if rim else ''), '#4c4e55' if not rim else '#a2a5ac', rough=.38 if not rim else .24, metal=.9 if not rim else 1, coat=.08, aov_part=5)
            else:
                m = simple_material('patch' + ('rim' if rim else ''), '#7a4a26' if not rim else '#4a2a14', rough=.65, aov_part=6)
                if not rim:
                    nt = m.node_tree; b = nt.nodes['Principled BSDF']
                    tx = node(nt, 'ShaderNodeTexImage', (-400, 0)); tx.image = load_img('brown_leather_diff.jpg', 'sRGB')
                    nm = node(nt, 'ShaderNodeTexImage', (-400, -300)); nm.image = load_img('brown_leather_nor.jpg', 'Non-Color')
                    nmap = node(nt, 'ShaderNodeNormalMap', (-100, -300))
                    uvn = node(nt, 'ShaderNodeUVMap', (-700, 0)); mp = node(nt, 'ShaderNodeMapping', (-550, 0)); mp.inputs['Scale'].default_value = (1.4, 1.0, 1)
                    nt.links.new(uvn.outputs[0], mp.inputs['Vector']); nt.links.new(mp.outputs[0], tx.inputs['Vector']); nt.links.new(mp.outputs[0], nm.inputs['Vector'])
                    nt.links.new(tx.outputs['Color'], b.inputs['Base Color']); nt.links.new(nm.outputs['Color'], nmap.inputs['Color']); nt.links.new(nmap.outputs[0], b.inputs['Normal'])
            if not rim:
                nt = m.node_tree; uvn = node(nt, 'ShaderNodeUVMap', (0, -500)); aov = node(nt, 'ShaderNodeOutputAOV', (600, -400)); aov.aov_name = 'decal'
                nt.links.new(uvn.outputs[0], aov.inputs['Color'])
            o.data.materials.clear(); o.data.materials.append(m)
    tmp = os.path.join(out, '_tmp.exr'); tmp2 = os.path.join(out, '_tmpB.exr')
    GRAY = .5
    recol = [m for k, m in S['mats'].items() if k in ('front', 'crown', 'visorTop', 'visorBottom', 'edge', 'button', 'bind', 'eyelet')]
    def set_albedo(v):
        for m in recol:
            nd = m.node_tree.nodes
            if 'ALBEDO' in nd: nd['ALBEDO'].inputs[6].default_value = (v, v, v, 1)
            if 'THREAD' in nd: nd['THREAD'].inputs[7].default_value = (min(1, v * 1.5 + .012),) * 3 + (1,)
    for idx, (yaw, pitch) in enumerate(views):
        if only is not None and idx not in only: continue
        pivot.rotation_euler = (0, 0, math.radians(-yaw))
        place_camera(S['cam'], yaw_deg=0, pitch_deg=pitch, dist=dist, target=(0, 0, ctr.z - .04))
        t0 = time.time()
        if overlay:
            sc.render.filepath = tmp; bpy.ops.render.render(write_still=True); ch = read_exr(tmp)
            comb = pick(ch, 'Combined'); dec = pick(ch, 'decal')[..., :3]; a = np.clip(comb[..., 3], 0, 1)
            base = to_srgb(neutral_tonemap(comb[..., :3] / np.maximum(a, 1e-4)[..., None] * EXPOSURE))
            Image.fromarray((np.dstack([base, a]) * 255 + .5).astype(np.uint8), 'RGBA').save(os.path.join(out, f'{idx}-b.webp'), quality=86, alpha_quality=92)
            insd = ((dec[..., 0] > 0) | (dec[..., 1] > 0)) & (a > .02)  # la gorra (holdout) también escribe el AOV
            g8 = np.where(insd, np.clip(dec[..., 0] * 255, 1, 255), 0).astype(np.uint8); b8 = np.where(insd, np.clip(dec[..., 1] * 255, 1, 255), 0).astype(np.uint8)
            Image.fromarray(np.dstack([np.zeros_like(g8), g8, b8, (a * 255).astype(np.uint8)]), 'RGBA').save(os.path.join(out, f'{idx}-u.png'), optimize=True)
            print(f'capa {overlay} {idx} {time.time() - t0:.1f}s', flush=True); continue
        # dos renders sin ruido: tela en gris (A) y en negro (B). Cualquier color = B + (a / GRAY) * (A - B)
        set_albedo(GRAY); sc.render.filepath = tmp; bpy.ops.render.render(write_still=True); ch = read_exr(tmp)
        set_albedo(0.0); sc.render.filepath = tmp2; bpy.ops.render.render(write_still=True); chB = read_exr(tmp2)
        set_albedo(GRAY)
        H, W = res, res
        comb = pick(ch, 'Combined'); combB = pick(chB, 'Combined')
        L = (comb[..., :3] - combB[..., :3]) / GRAY
        D = np.full_like(L, GRAY)
        part = pick(ch, 'part.X', 'part')
        dec = pick(ch, 'decal')[..., :3]
        lum = lambda x: x[..., 0] * .2126 + x[..., 1] * .7152 + x[..., 2] * .0722
        rest = combB[..., :3]
        # imagen base con el mismo tono final que la página
        base = to_srgb(neutral_tonemap(comb[..., :3] * EXPOSURE))
        a = np.clip(comb[..., 3], 0, 1)
        flip = lambda x: x  # OpenEXR ya entrega de arriba hacia abajo
        enc = lambda v, m: (np.sqrt(np.clip(v / m, 0, 1)) * 255 + .5).astype(np.uint8)
        Image.fromarray(flip(enc(lum(L), LMAX)), 'L').save(os.path.join(out, f'{idx}-l.webp'), quality=82)
        Image.fromarray(flip(enc(np.maximum(lum(rest), 0), SMAX)), 'L').save(os.path.join(out, f'{idx}-s.webp'), quality=82)
        b8 = (np.dstack([base, a]) * 255 + .5).astype(np.uint8)
        Image.fromarray(flip(b8), 'RGBA').save(os.path.join(out, f'{idx}-b.webp'), quality=84, alpha_quality=90)
        pr = np.clip(np.round(part), 0, 4).astype(np.uint8) * 60
        insd = (dec[..., 0] > 0) & (dec[..., 0] < 1) & (dec[..., 1] > 0) & (dec[..., 1] < 1)
        gch = np.where(insd, np.clip(dec[..., 0] * 255, 1, 255), 0).astype(np.uint8)
        bch = np.where(insd, np.clip(dec[..., 1] * 255, 1, 255), 0).astype(np.uint8)
        Image.fromarray(flip(np.dstack([pr, gch, bch, (a * 255).astype(np.uint8)])), 'RGBA').save(os.path.join(out, f'{idx}-i.png'), optimize=True)
        print(f'frame {idx} yaw {yaw:.0f} pitch {pitch} {time.time() - t0:.1f}s', flush=True)
    for t in (tmp, tmp2):
        if os.path.exists(t): os.remove(t)

main()
