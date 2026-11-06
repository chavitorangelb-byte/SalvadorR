"""Etiqueta de visera (hexágono plateado) reconstruida a partir de la foto frontal.
El logo NO se redibuja: se usa el logo oficial recortado y se pasa a tonos de grabado sobre plata."""
import sys, math, numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter
logo_p, out = sys.argv[1], sys.argv[2]
S = 1024; SS = 2                     # supersampling
W = S * SS
def hexpts(cx, cy, r):               # hexágono con punta arriba (lados verticales), como la etiqueta real
    return [(cx + r * math.cos(math.radians(a)), cy + r * math.sin(math.radians(a))) for a in (-90, -30, 30, 90, 150, 210)]
base = Image.new('RGBA', (W, W), (0, 0, 0, 0))
d = ImageDraw.Draw(base)
cx, cy, R = W * 0.43, W * 0.56, W * 0.40
SIL = (226, 224, 216, 255); EDGE = (86, 86, 88, 255); LINE = (110, 110, 112, 255)
d.polygon(hexpts(cx, cy, R), fill=EDGE)
d.polygon(hexpts(cx, cy, R * 0.955), fill=SIL)
d.polygon(hexpts(cx, cy, R * 0.90), outline=LINE, width=int(W * 0.006))
# hexágonos chicos (PREMIUM y cabezal láser) arriba a la derecha
r2 = R * 0.24
c1 = (cx + R * 0.80, cy - R * 0.98); c2 = (cx + R * 1.10, cy - R * 0.62)
for c in (c1, c2):
    d.polygon(hexpts(*c, r2), fill=EDGE)
    d.polygon(hexpts(*c, r2 * 0.88), fill=SIL)
# sello PREMIUM
fnt = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', int(r2 * 0.30))
d.ellipse([c1[0] - r2 * .62, c1[1] - r2 * .62, c1[0] + r2 * .62, c1[1] + r2 * .62], outline=LINE, width=int(W * .004))
tw = d.textlength('PREMIUM', font=fnt)
d.rectangle([c1[0] - tw / 2 - 6, c1[1] - r2 * .2, c1[0] + tw / 2 + 6, c1[1] + r2 * .2], fill=SIL, outline=LINE, width=int(W * .003))
d.text((c1[0] - tw / 2, c1[1] - r2 * .19), 'PREMIUM', font=fnt, fill=(70, 70, 72, 255))
# cabezal láser con rayos
x, y = c2
d.polygon([(x - r2 * .18, y - r2 * .62), (x + r2 * .18, y - r2 * .62), (x + r2 * .18, y - r2 * .05), (x + r2 * .07, y + r2 * .18), (x - r2 * .07, y + r2 * .18), (x - r2 * .18, y - r2 * .05)], fill=(80, 80, 82, 255))
for k in range(7):
    a = math.radians(200 + k * 20)
    d.line([(x, y + r2 * .30), (x + r2 * .42 * math.cos(a) * -1, y + r2 * .30 - r2 * .42 * math.sin(a))], fill=(80, 80, 82, 255), width=int(W * .003))
# logo oficial en tonos de grabado: X en gris oscuro, letras en plata clara con contorno oscuro (como la etiqueta real)
from scipy import ndimage
logo = Image.open(logo_p).convert('RGBA')
lw = int(R * 1.50); lh = int(logo.height * lw / logo.width)
logo = logo.resize((lw, lh), Image.LANCZOS)
la = np.asarray(logo).astype(np.float32) / 255
rgb = la[..., :3] * la[..., 3:4]                      # vuelve a premultiplicar (como se ve sobre negro)
V = rgb.max(2); mn = rgb.min(2); Sat = (V - mn) / np.maximum(V, 1e-4)
text = (Sat < .28) & (V > .55)
text = ndimage.binary_opening(text, iterations=1)
xm = (Sat > .45) & (V > .30) & ~text
xm = ndimage.binary_opening(xm, iterations=2)
xm = ndimage.binary_fill_holes(xm) if False else xm
outline = ndimage.binary_dilation(text, iterations=max(2, lw // 160)) & ~text
def soft(m, r=1.2):
    return np.clip(ndimage.gaussian_filter(m.astype(np.float32), r), 0, 1)
canvas = np.zeros((lh, lw, 4), np.float32)
def put(mask, col):
    a = soft(mask)[..., None]
    canvas[..., :3] = canvas[..., :3] * (1 - a) + np.array(col, np.float32) / 255 * a
    canvas[..., 3:] = canvas[..., 3:] * (1 - a) + a
put(xm, (78, 78, 80))
put(outline, (62, 62, 64))
put(text, (244, 243, 238))
tile = Image.fromarray((canvas * 255).astype(np.uint8), 'RGBA')
base.alpha_composite(tile, (int(cx - lw / 2), int(cy - lh / 2)))
img = base.resize((S, S), Image.LANCZOS)
img.save(out)
bb = img.getbbox(); print('label', img.size, 'bbox', bb)
