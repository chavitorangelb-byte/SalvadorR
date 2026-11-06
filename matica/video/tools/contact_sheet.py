"""Hoja de contactos de 12 cuadros clave del video (fase 6).

Renderiza los cuadros a resolución completa (1080x1920, 8 subcuadros) con el compositor real y los
acomoda en una hoja 4x3 con el tiempo, el cuadro y lo que pasa en cada uno.
Uso: python3 matica/video/tools/contact_sheet.py [--out matica/review/fase6/hoja_de_contactos.jpg]
"""
import json
import subprocess
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]          # matica/video
TL = json.loads((ROOT / "timeline/timeline.json").read_text())
T = TL["T"]
OUT = Path(sys.argv[sys.argv.index("--out") + 1]) if "--out" in sys.argv else ROOT.parent / "review/fase6/hoja_de_contactos.jpg"
TMP = ROOT / "build/contact"
FONT = ROOT.parent / "site/fonts"

# (tiempo, qué se ve) · tiempos tomados de la línea de tiempo amarrada a la voz
KEYS = [
    (T["type"][0] + 0.75, "La gota escribe la búsqueda"),
    (T["phoneIn"][0] + 0.36, "Dibuja el celular de cristal"),
    (T["pullLatte"][0] - 0.01, "Latte: Frío $60 → $65"),
    (T["cardFloat"][0] + 0.20, "Cold brew tonic en 3D"),
    (max(w["land"] for g in TL["KINETIC"] if g["id"] == "k-waffles" for ln in g["lines"] for w in ln) + 0.28, "WAFFLES DE YUCA"),
    (T["dropUnderlineJamon"][1] - 0.04, "Jamón serrano y matícas $95"),
    (T["addLift3D"][0] + 0.11, "\"Agregar\" salta en 3D"),
    (T["dropGlintPickup"][0] + 0.10, "Total $180 y dos salidas"),
    (next(g for g in TL["KINETIC"] if g["id"] == "k-perro")["out"][0] - 0.12, "Así se vive: pet friendly"),
    (T["pushReview2"][1] - 0.10, "Reseña en Google, legible"),
    (T["dropCircleHours"][1] - 0.04, "Horario y \"Abierto ahora\""),
    (T["disclaimer"][1] + 0.30, "End card"),
]


def main():
    frames = [round(t * 60) for t, _ in KEYS]
    TMP.mkdir(parents=True, exist_ok=True)
    for p in TMP.glob("*.png"):
        p.unlink()
    subprocess.run(["node", str(ROOT / "render.mjs"), "--scale", "1", "--subs", "8", "--fps", "60",
                    "--frames", ",".join(map(str, frames)), "--png", str(TMP)], check=True)
    cw, ch, pad, head = 360, 640, 18, 64
    cols, rows = 4, 3
    W = cols * cw + (cols + 1) * pad
    H = rows * (ch + head) + (rows + 1) * pad + 70
    sheet = Image.new("RGB", (W, H), (20, 27, 30))
    d = ImageDraw.Draw(sheet)
    try:
        fb = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 22)
        fr = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 18)
    except OSError:
        fb = fr = ImageFont.load_default()
    d.text((pad, 22), "Matíca · preview (fase 6) · 12 cuadros clave · 1080x1920, 8 subcuadros", fill=(244, 241, 234), font=fb)
    for i, ((t, what), f) in enumerate(zip(KEYS, frames)):
        im = Image.open(TMP / f"f{f:04d}.png").convert("RGB").resize((cw, ch), Image.LANCZOS)
        x = pad + (i % cols) * (cw + pad)
        y = 70 + pad + (i // cols) * (ch + head + pad)
        sheet.paste(im, (x, y))
        d.text((x, y + ch + 8), f"{t:5.2f} s · f{f:04d}", fill=(124, 172, 137), font=fr)
        d.text((x, y + ch + 32), what, fill=(244, 241, 234), font=fr)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(OUT, quality=90)
    print("hoja de contactos ->", OUT, sheet.size)


if __name__ == "__main__":
    main()
