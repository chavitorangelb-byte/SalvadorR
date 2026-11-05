"""Recorta el fondo gris plano del logo oficial sin redibujarlo ni recolorearlo.

Metodo (por region, no por umbral global):
1. Fondo = regiones grandes y conexas de gris neutro (afuera + huecos de letras).
   Las lineas finas de transicion plata/carbon dentro del logo no cuentan como
   fondo (apertura morfologica + area minima).
2. El interior del logo se deja intacto (alfa 1, color original).
3. Solo la franja que toca el fondo se ajusta: alfa por rampa de luminancia
   gris -> plata, y color des-contaminado al plata local. La sombra tenue se va.

Salida: PNG RGBA recortado al logo + vistas de control.
"""
import sys
import numpy as np
from PIL import Image
from scipy import ndimage

src, out = sys.argv[1], sys.argv[2]
im = np.array(Image.open(src).convert("RGB")).astype(np.float64)
L = im.mean(axis=2)
sat = im.max(axis=2) - im.min(axis=2)
BG = 171.0

# 1) candidatos a fondo: gris neutro entre sombra tenue y el arranque de la rampa
cand = (L > 150) & (L < 184) & (sat < 14)
cand = ndimage.binary_opening(cand, structure=np.ones((3, 3)), iterations=1)
lab, n = ndimage.label(cand)
areas = ndimage.sum(np.ones_like(L), lab, index=np.arange(1, n + 1))
keep = np.zeros(n + 1, bool)
keep[1:] = areas >= 10
bgreg = keep[lab]
# recupera los pixeles de fondo que la apertura se comio en el contorno del fondo
bgreg = ndimage.binary_dilation(bgreg, iterations=1) & (L > 150) & (L < 184) & (sat < 14) | bgreg

alpha = np.where(bgreg, 0.0, 1.0)
dist = ndimage.distance_transform_edt(~bgreg)  # distancia al fondo (para pixeles de logo)

# 2) franja de borde: pixeles de logo a <= 6 px del fondo
band = (~bgreg) & (dist <= 6)
# plata de referencia: maximo local de luminancia (el contorno es plata)
silver = ndimage.maximum_filter(np.where(L > 195, L, 0), size=7)
silver = np.where(silver < 195, 207.0, silver)
ramp = np.clip((L - BG) / np.maximum(silver - BG, 1), 0, 1)
lighter = L >= BG
# en la franja: si es mas claro que el fondo, alfa = rampa; si es gris oscuro
# (sombra o ringing del JPEG, no carbon ni rojo), alfa 0
shadowish = (~lighter) & (L > 120) & (sat < 14)
alpha = np.where(band & lighter, np.maximum(ramp, (dist > 3).astype(float)), alpha)
alpha = np.where(band & shadowish & (dist <= 2), 0.0, alpha)
# suaviza solo la franja para quitar escalones
a_s = ndimage.gaussian_filter(alpha, 0.55)
alpha = np.where(band | (bgreg & (ndimage.distance_transform_edt(bgreg) <= 2)), a_s, alpha)
alpha = np.clip(alpha, 0, 1)
alpha[alpha < 0.03] = 0.0

# 3) des-contaminar la franja clara: color = plata local
rgb = im.copy()
fix = band & lighter & (alpha < 0.999)
for c in range(3):
    ch = rgb[..., c]
    ch[fix] = silver[fix]
rgb[alpha == 0] = 0

rgba = np.dstack([rgb, alpha * 255]).round().astype(np.uint8)
ys, xs = np.where(alpha > 0.02)
pad = 6
x0, x1 = max(xs.min() - pad, 0), min(xs.max() + pad + 1, im.shape[1])
y0, y1 = max(ys.min() - pad, 0), min(ys.max() + pad + 1, im.shape[0])
crop = Image.fromarray(rgba[y0:y1, x0:x1], "RGBA")
crop.save(out, optimize=True)
print("bbox", x0, y0, x1, y1, "size", crop.size, "componentes de fondo", int(keep.sum()))

if len(sys.argv) > 3:
    prev = sys.argv[3]
    for name, col in (("carbon", (22, 22, 22)), ("hueso", (237, 234, 230)), ("rojo", (163, 32, 27))):
        bg = Image.new("RGBA", crop.size, col + (255,))
        comp = Image.alpha_composite(bg, crop).convert("RGB")
        comp.save(f"{prev}_{name}.png")
        if name == "carbon":
            z = comp.crop((0, 0, 420, crop.size[1])).resize((420 * 3, crop.size[1] * 3), Image.NEAREST)
            z.save(f"{prev}_{name}_zoom.png")
            z2 = comp.crop((480, 90, 900, crop.size[1])).resize((420 * 3, (crop.size[1] - 90) * 3), Image.NEAREST)
            z2.save(f"{prev}_{name}_zoom_tattoo.png")
            # a tamano real de uso (~900 px y ~330 px de ancho)
            for w in (900, 330):
                comp.resize((w, round(crop.size[1] * w / crop.size[0])), Image.LANCZOS).save(f"{prev}_{name}_{w}.png")
