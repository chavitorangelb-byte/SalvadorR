"""Saca los assets de Matíca de las capturas que mandó Salvador (1320x2868, iPhone).

No había archivos sueltos: todo sale de matica/assets/capturas/. Reglas del brief:
- Logo: solo máscara circular (sin redibujar, sin recolorear). Verde de origen #7CAC89.
- Fotos: solo recorte (evitando íconos de Instagram/Maps y texto encima),
  exposición suave sobre la luminancia (sin mover el color) y nitidez prudente.
- Las fotos de clientes de Google (12, 14, 15) y las que tienen personas no se usan.

Salida:
  matica/assets/   logo_matica.png, menu_referencia.jpg, foto_01..08 (nombres del brief)
  matica/site/img/ versiones para la página (.webp) + photos.json (tamaño real + LQIP)

Uso: python3 matica/tools/extract_assets.py
"""
import base64
import io
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
CAP = ROOT / "assets" / "capturas"
ASSETS = ROOT / "assets"
IMG = ROOT / "site" / "img"
IMG.mkdir(parents=True, exist_ok=True)

# Celdas del grid de Instagram (438x584, 3:4) medidas con los separadores blancos.
GRID_A = "03_ig_perfil_grid_a.png"
GRID_B = "04_ig_grid_b.png"
GRID_C = "05_ig_grid_c.png"


def cell(src, x0, y0, box):
    """Recorte dentro de una celda: box en coordenadas de la celda."""
    return src, (x0 + box[0], y0 + box[1], x0 + box[2], y0 + box[3])


# Assets con los nombres del brief (recorte limpio, sin overlays de la app)
ASSET_JOBS = {
    "menu_referencia.jpg": ("01_ig_historia_menu.png", (0, 403, 1320, 2352)),
    "foto_01_fachada.jpg": ("11_maps_foto_fachada.png", (0, 669, 1320, 2199)),
    "foto_02_arepa.jpg": ("13_maps_foto_arepa.png", (0, 996, 1320, 1869)),
    # latte con roseta (debajo de la barra de búsqueda que trae el post)
    "foto_03_latte_art.jpg": cell(GRID_A, 441, 1618, (0, 316, 404, 584)),
    # latte frío con la bolsa (sin el ícono de Reel)
    "foto_04_iced_latte_bolsa.jpg": cell(GRID_A, 0, 2205, (0, 96, 438, 584)),
    # mesa con prensa francesa (sin el ícono de carrusel)
    "foto_05_mesa_prensa.jpg": cell(GRID_C, 441, 494, (0, 90, 438, 584)),
    # bodegón con piloncillo (sin el ícono de Reel)
    "foto_06_piloncillo_bodegon.jpg": cell(GRID_C, 882, 1081, (0, 84, 438, 584)),
    # cold brew de piloncillo (debajo del título "Cold Brew PILONCILLO")
    "foto_07_cold_brew_piloncillo.jpg": cell(GRID_C, 882, 494, (0, 124, 438, 584)),
    # waffles + sándwich (sin ícono de Reel ni el subtítulo "sabes")
    "foto_08_waffles_sandwich.jpg": cell(GRID_B, 882, 2339, (0, 78, 438, 490)),
}

# Versiones para la página: (archivo de assets, recorte dentro del asset o None, ajustes)
SITE_JOBS = [
    {"id": "fachada", "src": "foto_01_fachada.jpg"},
    {"id": "arepa", "src": "foto_02_arepa.jpg", "gamma": 1.08},
    {"id": "latte-caliente", "src": "foto_03_latte_art.jpg"},
    {"id": "latte-frio", "src": "foto_04_iced_latte_bolsa.jpg", "box": (110, 74, 438, 488)},
    {"id": "filtrados", "src": "foto_05_mesa_prensa.jpg", "box": (30, 50, 400, 310)},
    {"id": "mesa", "src": "foto_05_mesa_prensa.jpg"},
    {"id": "bodegon", "src": "foto_06_piloncillo_bodegon.jpg"},
    {"id": "cold-brew-tonic", "src": "foto_07_cold_brew_piloncillo.jpg"},
    {"id": "waffles", "src": "foto_08_waffles_sandwich.jpg", "box": (0, 2, 362, 410)},
    {"id": "waffle-jamon", "src": "foto_08_waffles_sandwich.jpg", "box": (0, 42, 250, 292)},
    {"id": "sandwich", "src": "foto_08_waffles_sandwich.jpg", "box": (180, 0, 438, 258)},
]


def logo():
    """Círculo del logo: centro y radio medidos sobre el verde plano (#7CAC89).
    Máscara con antialias por supermuestreo; el interior queda intacto."""
    im = Image.open(CAP / "02_ig_foto_perfil.png").convert("RGB")
    cx, cy, r = 659.5, 1261.0, 433.6
    s = 4
    size = int(np.ceil(2 * r)) + 2
    x0, y0 = int(round(cx - size / 2)), int(round(cy - size / 2))
    crop = im.crop((x0, y0, x0 + size, y0 + size))
    yy, xx = np.mgrid[0:size * s, 0:size * s]
    ccx, ccy = (cx - x0) * s, (cy - y0) * s
    inside = ((xx + 0.5 - ccx) ** 2 + (yy + 0.5 - ccy) ** 2) <= (r * s) ** 2
    alpha = inside.reshape(size, s, size, s).mean(axis=(1, 3))
    rgba = crop.convert("RGBA")
    rgba.putalpha(Image.fromarray((alpha * 255).round().astype(np.uint8)))
    rgba.save(ASSETS / "logo_matica.png", optimize=True)
    for px in (512, 256):
        rgba.resize((px, px), Image.LANCZOS).save(IMG / f"logo-{px}.png", optimize=True)
    rgba.resize((512, 512), Image.LANCZOS).save(IMG / "logo-512.webp", "WEBP", quality=92, method=6)
    rgba.resize((256, 256), Image.LANCZOS).save(IMG / "logo-256.webp", "WEBP", quality=92, method=6)
    return rgba.size


def levels_luma(img, lo_pct=0.5, hi_pct=99.5, gamma=1.0, contrast=0.04, max_gain=1.35):
    """Exposición sobre la luminancia: el mismo factor para R, G y B en cada píxel,
    así el tono y la saturación de la comida y el café no cambian."""
    a = np.asarray(img.convert("RGB")).astype(np.float64) / 255.0
    Y = 0.2126 * a[..., 0] + 0.7152 * a[..., 1] + 0.0722 * a[..., 2]
    lo, hi = np.percentile(Y, lo_pct), np.percentile(Y, hi_pct)
    lo = min(lo, 0.04)               # no aplastar negros que ya están bien
    hi = max(hi, 1 / max_gain)       # tope de ganancia: corrección suave
    Yn = np.clip((Y - lo) / max(hi - lo, 1e-6), 0, 1)
    if gamma != 1.0:
        Yn = Yn ** (1.0 / gamma)
    if contrast:
        Yn = np.clip(Yn + contrast * (Yn - 0.5) * (1 - np.abs(2 * Yn - 1)), 0, 1)
    ratio = np.where(Y > 1e-4, Yn / np.maximum(Y, 1e-4), 1.0)
    out = np.clip(a * ratio[..., None], 0, 1)
    return Image.fromarray((out * 255).round().astype(np.uint8), "RGB")


def site_photo(job):
    im = Image.open(ASSETS / job["src"]).convert("RGB")
    if job.get("box"):
        im = im.crop(job["box"])
    im = levels_luma(im, gamma=job.get("gamma", 1.0))
    # nitidez mínima: son JPEG de Instagram, no hay que levantar artefactos
    im = im.filter(ImageFilter.UnsharpMask(radius=0.8, percent=30, threshold=4))
    path = IMG / f"{job['id']}.webp"
    im.save(path, "WEBP", quality=88, method=6)
    tiny = im.resize((16, max(1, round(16 * im.height / im.width))), Image.LANCZOS)
    buf = io.BytesIO()
    tiny.save(buf, "WEBP", quality=55)
    lqip = "data:image/webp;base64," + base64.b64encode(buf.getvalue()).decode()
    return {"id": job["id"], "w": im.width, "h": im.height, "file": f"img/{path.name}",
            "kb": round(path.stat().st_size / 1024), "lqip": lqip}


if __name__ == "__main__":
    for name, (src, box) in ASSET_JOBS.items():
        im = Image.open(CAP / src).convert("RGB").crop(box)
        im.save(ASSETS / name, "JPEG", quality=95, subsampling=0)
        print(f"{name:34s} {im.width}x{im.height}")
    print("logo_matica.png", logo())
    meta = [site_photo(j) for j in SITE_JOBS]
    # miniatura de la fachada para la tarjeta de "Visítanos" (92x108 css: 300 px alcanza a 3x)
    th = Image.open(IMG / "fachada.webp").convert("RGB")
    th = th.resize((300, round(300 * th.height / th.width)), Image.LANCZOS)
    th.save(IMG / "fachada-thumb.webp", "WEBP", quality=86, method=6)
    print("  img/fachada-thumb.webp", th.size)
    (IMG / "photos.json").write_text(json.dumps(meta, indent=2))
    for m in meta:
        print(f"  img/{m['id']}.webp {m['w']}x{m['h']} {m['kb']} KB")
