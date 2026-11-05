"""Morph SDF letra por letra ES -> EN (y EN -> ES) a partir de las capas capturadas.

Capas por cambio de idioma (capturadas por el arnes, 3x):
  *_pre_text.png / *_post_text.png   solo texto, fondo transparente
  *_pre_bg.png   / *_post_bg.png     todo menos el texto
Para cada cuadro del morph:
  d = mezcla de los campos de distancia (SDF) de ambos textos con un barrido
      de arriba abajo y de izquierda a derecha (cada letra cambia en su turno)
  alfa del texto = d umbralizado con antialias; color = campo de color mas cercano
  fondo = cruce de pre->post con el mismo barrido
Reemplaza en el manifiesto los cuadros de esa ventana.
"""
import json
import math
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = Path(__file__).resolve().parents[2]
CAP = ROOT / "video" / "build" / "capture"
FPS = 60
WINDOWS = {"en": (14.03, 14.90), "es": (16.33, 16.86)}
CLAMP = 48.0      # px (3x)
AA = 1.35         # ancho de antialias en px


def load(rel, mode):
    return np.asarray(Image.open(CAP / rel).convert(mode)).astype(np.float32) / 255.0


def sdf(alpha):
    inside = alpha > 0.5
    d_out = ndimage.distance_transform_edt(~inside)
    d_in = ndimage.distance_transform_edt(inside)
    d = d_out - d_in + (0.5 - alpha) * 0.9      # refinamiento subpixel aproximado
    return np.clip(d, -CLAMP, CLAMP).astype(np.float32)


def color_field(rgba):
    a = rgba[..., 3]
    has = a > 0.35
    _, (iy, ix) = ndimage.distance_transform_edt(~has, return_indices=True)
    rgb = rgba[..., :3] / np.maximum(rgba[..., 3:4], 1e-3)      # des-premultiplica si hiciera falta
    rgb = np.clip(rgba[..., :3], 0, 1)
    return rgb[iy, ix]


def main():
    man = json.loads((CAP / "manifest.json").read_text())
    for lang, (t0, t1) in WINDOWS.items():
        L = man["morph"][lang]
        pre_t, post_t = load(L["pre"]["text"], "RGBA"), load(L["post"]["text"], "RGBA")
        pre_b, post_b = load(L["pre"]["bg"], "RGB"), load(L["post"]["bg"], "RGB")
        H, W = pre_b.shape[:2]
        d0, d1 = sdf(pre_t[..., 3]), sdf(post_t[..., 3])
        c0, c1 = color_field(pre_t), color_field(post_t)
        yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
        delay = 0.52 * (yy / H) + 0.30 * (xx / W)        # arriba->abajo, izquierda->derecha
        width = 0.16
        span = 1 + delay.max() + width
        f0, f1 = math.ceil(t0 * FPS), math.floor(t1 * FPS)
        for f in range(f0, f1 + 1):
            k = (f / FPS - t0) / (t1 - t0)
            u = k * span - delay
            w = np.clip(u / width, 0, 1)
            w = w * w * (3 - 2 * w)
            melt = 2.2 * np.sin(np.pi * w)                 # adelgaza a mitad del cambio (efecto liquido)
            d = (1 - w) * d0 + w * d1 + melt
            a = np.clip(0.5 - d / AA, 0, 1)[..., None]
            col = (1 - w[..., None]) * c0 + w[..., None] * c1
            bg = (1 - w[..., None]) * pre_b + w[..., None] * post_b
            out = bg * (1 - a) + col * a
            rel = f"frames/morph_{lang}_{f:04d}.jpg"
            Image.fromarray((np.clip(out, 0, 1) * 255 + 0.5).astype(np.uint8)).save(CAP / rel, quality=93)
            man["frames"][str(f)]["files"] = [rel]
            man["frames"][str(f)]["morph"] = lang
            print(lang, f, f"k={k:.2f}")
    (CAP / "manifest.json").write_text(json.dumps(man, indent=1))
    print("morph listo")


if __name__ == "__main__":
    sys.exit(main())
