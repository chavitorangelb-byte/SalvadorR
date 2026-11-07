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
    ctr = sum(bb, Vector()) / len(bb)
    pivot = S['pivot']
    for o in pivot.children: o.location.x -= ctr.x; o.location.y -= ctr.y  # gira sobre el centro de la gorra
    views = [(i * 360 / N, 14) for i in range(N)] + [(-25, 55), (-25, -16)]
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
        place_camera(S['cam'], yaw_deg=0, pitch_deg=pitch, dist=float(os.environ.get('DIST', 6.0)), target=(0, 0, ctr.z - .08))
        t0 = time.time()
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
