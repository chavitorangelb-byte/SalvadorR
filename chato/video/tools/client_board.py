"""Lámina para el cliente: las secciones de la página de la demo dentro de un celular. JPG vertical para WhatsApp.
Antes: node tools/client_board.mjs (capturas a 1080x1920 desde el compositor)."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

V = Path(__file__).resolve().parents[1]
B = V / "build/board"
F = lambda w, s: ImageFont.truetype(str(V / f"compositor/vendor/Inter-{w}.otf"), s)
BG, CREAM, OCRE = (18, 17, 14), (241, 235, 221), (176, 136, 58)
W, SW, SH, BZ = 2160, 800, 1210, 22
SHOTS = [("sec0.png", "Portada con tu fachada"), ("sec1.png", "Los Chatos, la recomendación de la casa"), ("sec2.png", "Menú: barra caliente y barra fría"),
         ("sec3.png", "Horario de la semana"), ("sec4.png", "Ubicación con mapa y dirección"), ("phone.png", "Botón de cómo llegar y tu Instagram")]
TOP, ROW = 520, SH + 2 * BZ + 190
H = TOP + 3 * ROW + 170
im = Image.new("RGB", (W, H), BG); d = ImageDraw.Draw(im)
d.text((W / 2, 150), "Chato Cafecito", font=F("Bold", 150), fill=CREAM, anchor="mm")
d.text((W / 2, 300), "Así se vería tu página en el celular", font=F("SemiBold", 62), fill=CREAM, anchor="mm")
d.rectangle((W / 2 - 110, 372, W / 2 + 110, 380), fill=OCRE)
for i, (name, label) in enumerate(SHOTS):
    x = 180 + (i % 2) * 1000; y = TOP + (i // 2) * ROW
    src = Image.open(B / name).convert("RGB")
    shot = src.crop((100, 240, 980, 1571)).resize((SW, SH), Image.LANCZOS) if name == "phone.png" else src.crop((44, 100, 1036, 1600)).resize((SW, SH), Image.LANCZOS)
    m = Image.new("L", (SW * 2, SH * 2), 0); ImageDraw.Draw(m).rounded_rectangle((0, 0, SW * 2 - 1, SH * 2 - 1), 120, fill=255); m = m.resize((SW, SH), Image.LANCZOS)
    if name != "phone.png":
        d.rounded_rectangle((x - BZ, y - BZ, x + SW + BZ, y + SH + BZ), 80, fill=(8, 8, 7), outline=(92, 89, 80), width=3)
        im.paste(shot, (x, y), m)
        d.rounded_rectangle((x + SW / 2 - 90, y + 22, x + SW / 2 + 90, y + 66), 22, fill=(5, 5, 5))
    else:
        im.paste(shot, (x, y), m)
    d.text((x + SW / 2, y + SH + BZ + 74), label, font=F("SemiBold", 46), fill=CREAM, anchor="mm")
d.text((W / 2, H - 100), "Demo de cortesía de Elevate Negocios · pieza no oficial", font=F("SemiBold", 48), fill=OCRE, anchor="mm")
out = V / "out/chato_pagina_para_cliente.jpg"
im.save(out, quality=90); print(out, im.size)
