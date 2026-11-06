"""Retoque de placa_aguila_tres_cuartos: la etiqueta de la visera viene en espejo.
Solo se toca la zona de la etiqueta: se rellena (inpaint) y se pone la etiqueta correcta con homografía y la luz original."""
import sys, math, numpy as np, cv2
from PIL import Image
src, label_p, out = sys.argv[1:4]
im = np.asarray(Image.open(src).convert('RGBA')).astype(np.float32)
rgb = im[..., :3].copy(); a = im[..., 3]
# 1) máscara de la etiqueta vieja (zona clara dentro de su caja)
x0, y0, x1, y1 = 372, 385, 512, 505
L = rgb @ [0.2126, 0.7152, 0.0722]
m = np.zeros(a.shape, np.uint8)
box = L[y0:y1, x0:x1] > 55
m[y0:y1, x0:x1] = box
m = cv2.dilate(m, np.ones((3, 3), np.uint8), iterations=3)
lum_old = cv2.GaussianBlur(np.where(m > 0, L, 0).astype(np.float32), (0, 0), 6)
bgr = cv2.cvtColor(np.clip(rgb, 0, 255).astype(np.uint8), cv2.COLOR_RGB2BGR)
filled = cv2.inpaint(bgr, m * 255, 6, cv2.INPAINT_TELEA)
filled = cv2.cvtColor(filled, cv2.COLOR_BGR2RGB).astype(np.float32)
# 2) etiqueta correcta con homografía (vértices del hexágono -> puntos medidos en la foto)
lab = np.asarray(Image.open(label_p).convert('RGBA')).astype(np.float32)
S = lab.shape[0]; cx, cy, R = S * .43, S * .56, S * .40; c = math.cos(math.radians(30))
# 6 vértices del hexágono grande: arriba, arriba-der, abajo-der, abajo, abajo-izq, arriba-izq
srcp = np.float32([[cx, cy - R], [cx + R * c, cy - R / 2], [cx + R * c, cy + R / 2], [cx, cy + R], [cx - R * c, cy + R / 2], [cx - R * c, cy - R / 2]])
dstp = np.float32([[437, 407], [497, 468], [503, 497], [455, 483], [395, 430], [381, 392]])
K = 4
H, _ = cv2.findHomography(srcp, dstp * K, 0)
big = cv2.warpPerspective(lab, H, (a.shape[1] * K, a.shape[0] * K), flags=cv2.INTER_LINEAR)
warp = cv2.resize(big, (a.shape[1], a.shape[0]), interpolation=cv2.INTER_AREA)
la = warp[..., 3:4] / 255
# luz: la etiqueta original es más clara al centro; se toma su brillo de baja frecuencia
norm = lum_old / max(lum_old.max(), 1)
shade = (0.50 + 0.55 * np.clip(norm / 0.55, 0, 1))[..., None]
col = np.clip(warp[..., :3] * shade * 0.80, 0, 255)
res = filled * (1 - la) + col * la
outa = a.copy()
Image.fromarray(np.dstack([np.clip(res, 0, 255), outa]).astype(np.uint8), 'RGBA').save(out)
print('ok')
