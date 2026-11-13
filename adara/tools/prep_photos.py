"""Prepara logo y fotos de Adara para la pagina y el video.

- Logo: se enmascara en circulo (las esquinas grises quedan transparentes). No se redibuja ni recolorea.
- Fotos: solo se desenfocan, con borde suave, los textos con nombres o dedicatorias de clientes
  (y el texto en ingles del pastel de corazon). Nada se rellena ni se recolorea.
Salidas: site/img/*.webp (pagina) y video/img/*.png (video, a resolucion original).
Uso: python3 -I adara/tools/prep_photos.py
"""
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "assets"
SITE = ROOT / "site/img"
VID = ROOT / "video/img"
SITE.mkdir(parents=True, exist_ok=True)
VID.mkdir(parents=True, exist_ok=True)

# poligonos en coordenadas relativas (0-1) de cada foto
BLUR = {
    "05_pastel_venom_spiderman": [[(0.09, 0.62), (0.20, 0.57), (0.33, 0.73), (0.52, 0.79), (0.66, 0.62), (0.86, 0.55),
                                   (0.89, 0.80), (0.67, 0.96), (0.40, 0.97), (0.16, 0.87)]],
    "09_pastel_mateo_dos_pisos": [[(0.33, 0.33), (0.68, 0.33), (0.68, 0.47), (0.33, 0.47)]],
    "11_cupcakes_dinosaurios_cherry": [[(0.17, 0.36), (0.40, 0.31), (0.51, 0.40), (0.50, 0.56), (0.30, 0.60), (0.17, 0.52)]],
    "07_pastel_navidad_pinguinos": [[(0.45, 0.17), (0.82, 0.15), (0.82, 0.34), (0.45, 0.35)]],
    "03_pastel_corazon_gris": [[(0.14, 0.14), (0.86, 0.14), (0.86, 0.44), (0.14, 0.44)]],
}


def frost(im, polys):
    w, h = im.size
    mask = Image.new("L", (w, h), 0)
    d = ImageDraw.Draw(mask)
    for p in polys:
        d.polygon([(x * w, y * h) for x, y in p], fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(w * 0.012))
    blurred = im.filter(ImageFilter.GaussianBlur(w * 0.022))
    # cristal esmerilado: un 6 % mas claro dentro del panel
    blurred = Image.blend(blurred, Image.new("RGB", (w, h), (245, 245, 245)), 0.06)
    return Image.composite(blurred, im, mask)


def logo():
    im = Image.open(SRC / "00_logo_adara_pasteleria.jpg").convert("RGB")
    w, h = im.size
    ss = 4
    m = Image.new("L", (w * ss, h * ss), 0)
    r = (w / 2 - 4.5) * ss
    ImageDraw.Draw(m).ellipse([w * ss / 2 - r, h * ss / 2 - r, w * ss / 2 + r, h * ss / 2 + r], fill=255)
    m = m.resize((w, h), Image.LANCZOS)
    out = im.convert("RGBA")
    out.putalpha(m)
    out.save(VID / "logo.png")
    out.resize((512, 512), Image.LANCZOS).save(SITE / "logo.webp", quality=92)
    out.resize((180, 180), Image.LANCZOS).save(SITE / "logo-180.png")


def photos():
    for f in sorted(SRC.glob("[01][0-9]_*.jpg")):
        if f.name.startswith("00_"):
            continue
        im = Image.open(f).convert("RGB")
        if f.stem in BLUR:
            im = frost(im, BLUR[f.stem])
        im.save(VID / (f.stem + ".png"))
        short = f.stem[:2]
        big = im if im.width <= 1000 else im.resize((1000, round(im.height * 1000 / im.width)), Image.LANCZOS)
        big.save(SITE / f"p{short}.webp", quality=84)
        print(f.stem, im.size)


logo()
photos()
