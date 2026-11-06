"""Recorta el logo oficial del fondo negro por luminancia (valor HSV), sin redibujarlo ni recolorearlo.
alpha = V (con piso de ruido), color = rgb / alpha (des-premultiplicado): sobre negro queda idéntico al original."""
import sys, numpy as np
from PIL import Image
src, out = sys.argv[1], sys.argv[2]
im = np.asarray(Image.open(src).convert('RGB')).astype(np.float32) / 255
v = im.max(axis=2)
a = np.clip((v - 0.035) / (1 - 0.035), 0, 1)          # piso: el negro de la foto (~0.02-0.03) queda transparente
a = np.where(a < 0.004, 0, a)
safe = np.maximum(a, 1e-4)[..., None]
rgb = np.clip((im - 0.035 * (1 - a[..., None])) / safe, 0, 1)   # quita el aporte del fondo y des-premultiplica
rgb[a == 0] = 0
rgba = np.dstack([rgb, a])
ys, xs = np.where(a > 0.02)
pad = 12
y0, y1 = max(ys.min() - pad, 0), min(ys.max() + pad, a.shape[0])
x0, x1 = max(xs.min() - pad, 0), min(xs.max() + pad, a.shape[1])
img = Image.fromarray((rgba[y0:y1, x0:x1] * 255 + 0.5).astype(np.uint8), 'RGBA')
img.save(out)
print('logo', img.size, 'crop', (x0, y0, x1, y1))
