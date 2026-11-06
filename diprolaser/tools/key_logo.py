"""Separa el logo oficial de DIPROLASER del banner (fondo rojo oscuro con hexagonos).

No se redibuja ni se recolorea: solo mascara.
- Placa de fondo: se reconstruye el fondo sin logo (inpaint) para despejar el brillo.
- Nucleo (X + placa de letras): opaco; se obtiene por luminancia (V > 130), cerrado y sin huecos.
- Fuera del nucleo: alfa = cuanto se separa el pixel de la placa (el brillo rojo queda
  semitransparente) y el color se despeja: C = (I - bg*(1-a)) / a.
Salidas:
  assets/logo/logo_diprolaser.png       logo a color con brillo, fondo transparente
  assets/logo/logo_grabado_blanco.png   version de un color derivada del mismo logo (caras de
                                        la X y letras, separadas por su contorno oscuro)
"""
import cv2, numpy as np
from pathlib import Path
P = Path(__file__).resolve().parents[1]
OUT = P / 'assets/logo'; OUT.mkdir(parents=True, exist_ok=True)
im = cv2.imread(str(P / 'assets/fuente/logo_diprolaser_banner.jpg')).astype(np.float32)
hsv = cv2.cvtColor(im.astype(np.uint8), cv2.COLOR_BGR2HSV)
V = hsv[..., 2].astype(np.float32)

core = (V > 130).astype(np.uint8)
core = cv2.morphologyEx(core, cv2.MORPH_CLOSE, np.ones((7, 7), np.uint8))
n, lab, st, _ = cv2.connectedComponentsWithStats(core)
big = 1 + np.argmax(st[1:, cv2.CC_STAT_AREA])
core = (lab == big).astype(np.uint8)
ff = core.copy(); h, w = ff.shape
cv2.floodFill(ff, np.zeros((h + 2, w + 2), np.uint8), (0, 0), 2)
core = ((ff != 2)).astype(np.uint8)               # rellena huecos internos
core = cv2.erode(core, np.ones((3, 3), np.uint8))  # el borde exterior lo resuelve la rampa

region = cv2.dilate((V > 75).astype(np.uint8), np.ones((31, 31), np.uint8))
bg = cv2.inpaint(im.astype(np.uint8), region, 25, cv2.INPAINT_TELEA).astype(np.float32)
bg = cv2.GaussianBlur(bg, (0, 0), 6)

diff = np.clip((im - bg) / np.maximum(255 - bg, 1), 0, 1).max(2)
alpha = np.clip((diff - 0.07) * 1.3, 0, 1)  # el umbral deja fuera las lineas del hexagono
alpha = np.maximum(alpha, cv2.GaussianBlur(core.astype(np.float32), (0, 0), 0.8))
alpha[region == 0] = 0
a3 = np.maximum(alpha, 1e-3)[..., None]
col = np.clip((im - bg * (1 - a3)) / a3, 0, 255)
col = np.where(core[..., None] > 0, im, col)

ys, xs = np.where(alpha > 0.03)
y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
rgba = np.dstack([col, alpha * 255])[y0:y1, x0:x1].astype(np.uint8)
cv2.imwrite(str(OUT / 'logo_diprolaser.png'), rgba)

# un color: caras brillantes de la X y letras (canal rojo alto) dentro del nucleo
R = im[..., 2]
mark = np.clip((R - 158) / 14, 0, 1)  # incluye biseles (R~174), excluye contorno de letras (R~153) * cv2.GaussianBlur(core.astype(np.float32), (0, 0), 0.7)
mark = cv2.GaussianBlur(mark, (0, 0), 0.6)
one = np.dstack([np.full_like(mark, 255)] * 3 + [mark * 255])[y0:y1, x0:x1].astype(np.uint8)
cv2.imwrite(str(OUT / 'logo_grabado_blanco.png'), one)
print('logo', rgba.shape[1], 'x', rgba.shape[0], ' recorte en banner', (x0, y0, x1, y1))
