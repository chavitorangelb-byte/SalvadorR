"""Prepara las fotos reales del estudio para la pagina.

Reglas del brief: recortar al tatuaje, corregir SOLO exposicion y contraste
(sobre la luminancia, sin mover el balance de color), subir nitidez con cuidado
y nunca inventar detalle. Nada de IA: solo recorte, niveles y unsharp mask.
"""
import json
import base64
import io
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
A = ROOT / "assets"
OUT = ROOT / "site" / "img"
OUT.mkdir(parents=True, exist_ok=True)

# Recortes en coordenadas del archivo original (revisados con cuadricula)
JOBS = [
    {
        "id": "cristo",
        "src": "tattoo_02_cristo_realismo_bng.jpg",
        "box": (0, 0, 1320, 912),          # triptico completo (3 angulos)
        "upscale": 1.0,
    },
    {
        "id": "espartano",
        "src": "tattoo_03_espartano_pecho_bng.jpg",
        "box": (40, 50, 1160, 680),         # 16:9, pieza completa de pecho
        "upscale": 1.0,
    },
    {
        "id": "quetzalcoatl",
        "src": "tattoo_04_quetzalcoatl_color.jpg",
        "box": (200, 420, 1320, 1820),      # 4:5, sin barbilla ni iconos de la app
        "upscale": 1.0,
    },
    {
        # PROVISIONAL: miniatura del grid de Instagram (no venia el archivo
        # tattoo_01_leon_caballero_bng.jpg). Recorte que evita el icono de Reel
        # y la ropa con texto. Baja resolucion: se reemplaza al llegar el original.
        "id": "leon",
        "src": "ref_instagram_grid_maximo_siniestro.png",
        "box": (441 + 118, 1255 + 60, 441 + 348, 1255 + 348),  # 230x288, 4:5
        "upscale": 2.0,
        # medir niveles solo sobre el tatuaje (la loseta blanca falsea el blanco)
        "meter": (0.15, 0.05, 0.95, 0.95),
        "gamma": 1.18,
        "contrast": 0.05,
    },
]


def levels_luma(img: Image.Image, lo_pct=0.4, hi_pct=99.6, gamma=1.0, contrast=0.10, meter=None):
    """Niveles sobre luminancia: escala R,G,B por el mismo factor por pixel,
    asi el tono/saturacion del tatuaje no cambia."""
    a = np.asarray(img.convert("RGB")).astype(np.float64) / 255.0
    Y = 0.2126 * a[..., 0] + 0.7152 * a[..., 1] + 0.0722 * a[..., 2]
    Ym = Y
    if meter:
        h, w = Y.shape
        Ym = Y[int(meter[1] * h):int(meter[3] * h), int(meter[0] * w):int(meter[2] * w)]
    lo, hi = np.percentile(Ym, lo_pct), np.percentile(Ym, hi_pct)
    Yn = np.clip((Y - lo) / max(hi - lo, 1e-6), 0, 1)
    if gamma != 1.0:
        Yn = Yn ** (1.0 / gamma)
    # curva S suave (contraste) centrada en 0.5
    if contrast:
        Yn = Yn + contrast * (Yn - 0.5) * (1 - np.abs(2 * Yn - 1))
        Yn = np.clip(Yn, 0, 1)
    ratio = np.where(Y > 1e-4, Yn / np.maximum(Y, 1e-4), 0)
    out = np.clip(a * ratio[..., None], 0, 1)
    # pixeles muy oscuros (ratio inestable): usar gris escalado
    dark = Y <= 1e-4
    out[dark] = Yn[dark][..., None]
    return Image.fromarray((out * 255).round().astype(np.uint8), "RGB")


def process(job):
    im = Image.open(A / job["src"]).convert("RGB").crop(job["box"])
    if job["upscale"] != 1.0:
        w, h = im.size
        im = im.resize((round(w * job["upscale"]), round(h * job["upscale"])), Image.LANCZOS)
    im = levels_luma(im, gamma=job.get("gamma", 1.0), contrast=job.get("contrast", 0.10),
                     meter=job.get("meter"))
    # nitidez prudente: radio pequeno, umbral para no levantar ruido del JPEG
    radius = 1.6 if job["upscale"] > 1 else 1.1
    im = im.filter(ImageFilter.UnsharpMask(radius=radius, percent=45, threshold=3))
    path = OUT / f"{job['id']}.webp"
    im.save(path, "WEBP", quality=86, method=6)
    # previsualizacion borrosa diminuta (LQIP) para el estado de carga
    tiny = im.resize((16, max(1, round(16 * im.height / im.width))), Image.LANCZOS)
    buf = io.BytesIO()
    tiny.save(buf, "WEBP", quality=50)
    lqip = "data:image/webp;base64," + base64.b64encode(buf.getvalue()).decode()
    return {"id": job["id"], "w": im.width, "h": im.height, "file": f"img/{path.name}",
            "kb": round(path.stat().st_size / 1024), "lqip": lqip}


if __name__ == "__main__":
    meta = [process(j) for j in JOBS]
    (OUT / "photos.json").write_text(json.dumps(meta, indent=2))
    for m in meta:
        print(m["id"], m["w"], "x", m["h"], f"{m['kb']} KB")
