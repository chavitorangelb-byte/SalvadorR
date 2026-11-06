"""Logo actual de DIPROLASER (fondo blanco) -> PNG sin fondo + version de una tinta para grabado.

No se redibuja ni se recolorea: solo mascara.
- Fondo: blanco conectado al borde (inundacion); el hueco de la D, encerrado por el contorno, se queda.
- Orilla: alfa por distancia al blanco en una banda de 2 px, color descontaminado (sin halo blanco).
- Grabado (una tinta): la X roja y el relleno de las letras; el contorno negro queda como separacion.
Salidas: assets/logo/logo_diprolaser.png y assets/logo/logo_grabado_blanco.png
"""
import cv2, numpy as np
from pathlib import Path
P = Path(__file__).resolve().parents[1]
im = cv2.imread(str(P / 'assets/fuente/logo_diprolaser_actual.jpg')).astype(np.float32)
h, w = im.shape[:2]
d = (255 - im).max(2)
near = (d < 16).astype(np.uint8)
pad = cv2.copyMakeBorder(near, 1, 1, 1, 1, cv2.BORDER_CONSTANT, value=1)
_, lab = cv2.connectedComponents(pad, connectivity=4)
bg = (lab == lab[0, 0])[1:-1, 1:-1]
fg = (~bg).astype(np.uint8)
inner = cv2.erode(fg, np.ones((3, 3), np.uint8), iterations=2)
band = cv2.dilate(fg, np.ones((3, 3), np.uint8)) - inner
a = np.where(inner > 0, 1.0, np.where(band > 0, np.clip((d - 6) / 60.0, 0, 1), 0.0)).astype(np.float32)
a = cv2.GaussianBlur(a, (3, 3), 0.6) * np.maximum(fg, band)
ext = cv2.inpaint(np.clip(im, 0, 255).astype(np.uint8), (inner == 0).astype(np.uint8), 3, cv2.INPAINT_TELEA).astype(np.float32)
col = np.where((inner > 0)[..., None], im, ext)
ys, xs = np.where(a > 0.02)
y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
out = np.dstack([col, a * 255])[y0:y1, x0:x1]
cv2.imwrite(str(P / 'assets/logo/logo_diprolaser.png'), out.astype(np.uint8))
# una tinta: rojo (X) o relleno claro de letras; el contorno negro = separacion
b, g, r = im[..., 0], im[..., 1], im[..., 2]
red = (r > 140) & (r - g > 90)
letter = (im.min(2) > 150) & (inner > 0)
mark = (red | letter).astype(np.float32) * (inner > 0)
mark = cv2.morphologyEx(mark, cv2.MORPH_OPEN, np.ones((2, 2), np.uint8))
mark = cv2.GaussianBlur(mark, (0, 0), 0.7)
one = np.dstack([np.full_like(mark, 255)] * 3 + [mark * 255])[y0:y1, x0:x1]
cv2.imwrite(str(P / 'assets/logo/logo_grabado_blanco.png'), one.astype(np.uint8))
print('logo', x1 - x0, 'x', y1 - y0)
