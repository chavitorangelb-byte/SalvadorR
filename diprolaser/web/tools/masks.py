"""Máscaras de recolor (cuerpo pintado de vasos/termos, cinta de llaveros) y datos del cilindro para el grabado.
Salida: build/masks/<nombre>.png (L) y build/masks/meta.json"""
import sys, os, json, numpy as np, cv2
from PIL import Image
from scipy import ndimage
src, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)
meta = {}
def load(n):
    im = np.asarray(Image.open(f'{src}/{n}.png').convert('RGBA'))
    return im[..., :3], im[..., 3]
def lab(rgb): return cv2.cvtColor(rgb, cv2.COLOR_RGB2LAB).astype(np.float32)
def largest(m):
    lb, n = ndimage.label(m)
    if n == 0: return m
    sizes = ndimage.sum(m, lb, range(1, n + 1))
    return lb == (1 + int(np.argmax(sizes)))
def clean(m, k=5):
    m = ndimage.binary_closing(m, np.ones((k, k)), iterations=2)
    m = ndimage.binary_opening(m, np.ones((3, 3)), iterations=1)
    m = largest(m)
    return ndimage.binary_fill_holes(m)
def by_color(n, ref_frac=(.5, .72), tol=26, llo=50, cf=.3):
    rgb, a = load(n); L = lab(rgb); h, w = a.shape
    ys, xs = np.where(a > 200); cx = int(np.median(xs))
    ry = int(ys.min() + (ys.max() - ys.min()) * ref_frac[1])
    ref = np.median(L[ry - 8:ry + 8, cx - 8:cx + 8].reshape(-1, 3), axis=0)
    d = np.sqrt(((L[..., 1:] - ref[1:]) ** 2).sum(-1) + (0.12 * (L[..., 0] - ref[0])) ** 2)
    m = (d < tol) & (a > 160)
    A = a > 200
    C = np.sqrt((L[..., 1] - 128) ** 2 + (L[..., 2] - 128) ** 2)
    Cref = float(np.sqrt((ref[1] - 128) ** 2 + (ref[2] - 128) ** 2))
    def rowc(y):
        xs_ = np.where(A[y])[0]
        if len(xs_) < 10: return 0
        l, r = xs_.min(), xs_.max(); q = (r - l) // 5
        return float(np.median(C[y, l + q:r - q + 1]))
    def rowl(y):
        xs_ = np.where(A[y])[0]
        if len(xs_) < 10: return 0.
        l, r = xs_.min(), xs_.max(); q = (r - l) // 5
        return float(np.mean(L[y, l + q:r - q + 1, 0]))
    Lref = rowl(ry)
    ok = lambda y: rowc(y) > Cref * cf and Lref - llo < rowl(y) < Lref + 90
    top = ry
    while top > 0 and ok(top - 1): top -= 1
    bot = ry
    while bot < h - 1 and ok(bot + 1): bot += 1
    body = A.copy(); body[:top + 1] = False; body[bot:] = False
    return clean(body, 3), rgb, a
def cyl(m):
    ys = np.where(m.any(1))[0]; y0, y1 = int(ys.min()), int(ys.max())
    rows = range(int(y0 + (y1 - y0) * .25), int(y0 + (y1 - y0) * .6))
    L = [np.where(m[y])[0].min() for y in rows]; R = [np.where(m[y])[0].max() for y in rows]
    l, r = float(np.median(L)), float(np.median(R))
    return {'cx': (l + r) / 2, 'r': (r - l) / 2, 'y0': y0, 'y1': y1}
def save(n, m, rgb, a, extra=None):
    m = cv2.GaussianBlur((m * 255).astype(np.uint8), (0, 0), 1.0)
    m = np.minimum(m, a)
    Image.fromarray(m, 'L').save(f'{out}/{n}.png')
    body = (m > 128)
    Lum = (rgb.astype(np.float32) @ [.2126, .7152, .0722])
    info = {'w': int(a.shape[1]), 'h': int(a.shape[0]), 'lum': float(np.median(Lum[body]))}
    if extra: info.update(extra)
    meta[n] = info
for n, tol, llo in [('vaso_azul_1', 30, 50.01), ('vaso_azul_2', 30, 50.01), ('vaso_verde_1', 26, 50), ('vaso_verde_2', 26, 50), ('vaso_rosa_1', 20, 50), ('vaso_rosa_2', 20, 85)]:
    m, rgb, a = by_color(n, tol=tol, llo=llo, cf=.22 if 'azul' in n else .3); save(n, m, rgb, a, {'cyl': cyl(m)})
# termos negros: todo el cuerpo debajo de la tapa
for n in ['termo_negro_1', 'termo_negro_2', 'termo_negro_3']:
    rgb, a = load(n); h, w = a.shape
    ys, xs = np.where(a > 200); top, bot = ys.min(), ys.max()
    cut = int(top + (bot - top) * .36)
    m = (a > 200); m[:cut] = False
    m = clean(m); save(n, m, rgb, a, {'cyl': cyl(m)})
# vasos con asa (blanco/crema): cuerpo claro bajo la banda de acero, sin asa
for n in ['vaso_asa_blanco', 'vaso_asa_crema']:
    rgb, a = load(n); h, w = a.shape; L = lab(rgb)
    sat = np.sqrt((L[..., 1] - 128) ** 2 + (L[..., 2] - 128) ** 2)
    light = (L[..., 0] > 150) & (sat < 22) & (a > 200)
    ys, xs = np.where(a > 200); top, bot = ys.min(), ys.max()
    # banda de acero: filas con más gris oscuro
    dark = ((L[..., 0] < 150) & (a > 200)).sum(1)
    band_rows = np.where(dark[top:top + (bot - top) // 2] > (a > 200).sum(1)[top:top + (bot - top) // 2] * .5)[0]
    band_bot = top + (band_rows.max() if len(band_rows) else int((bot - top) * .2)) + 4
    A = a > 200
    m = A.copy(); m[:band_bot] = False
    gap_y, gap_x = [], []
    for y in range(band_bot, bot + 1):
        row = np.where(A[y])[0]
        if len(row) < 2: continue
        g = np.where(np.diff(row) > 3)[0]
        if len(g): gap_y.append(y); gap_x.append(row[g[0]])
    if gap_y:
        k, b = np.polyfit(gap_y, gap_x, 1)
        y_a, y_b = min(gap_y) - int((bot - top) * .12), max(gap_y) + int((bot - top) * .10)
        for y in range(band_bot, bot + 1):
            row = np.where(A[y])[0]
            if not len(row): continue
            g = np.where(np.diff(row) > 3)[0]
            if len(g): m[y, row[g[0]] + 1:] = False
            elif y_a <= y <= y_b: m[y, int(k * y + b) + 1:] = False
    m = clean(m, 7); save(n, m, rgb, a, {'cyl': cyl(m)})
# cintas de llavero: la parte saturada
for n in ['llavero_cinta_azul', 'llavero_cinta_roja']:
    rgb, a = load(n); hsv = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV)
    m = (hsv[..., 1] > 90) & (hsv[..., 2] > 40) & (a > 160)
    m = clean(m, 5); save(n, m, rgb, a)
json.dump(meta, open(f'{out}/meta.json', 'w'), indent=1)
print(json.dumps({k: v.get('cyl', '') for k, v in meta.items()}, indent=0)[:1500])
