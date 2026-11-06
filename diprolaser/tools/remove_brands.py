"""Quita las marcas ajenas (STANLEY en vasos de asa, YETI en vasos rosas) de los recortes.

Cuerpo cilindrico: el sombreado cambia sobre todo en horizontal. Cada columna de la zona del
logo se rellena interpolando entre el cuerpo limpio de arriba y de abajo (o solo de arriba si
abajo esta la banda de acero), mas grano con la misma desviacion que el cuerpo vecino.
Detalles en tapa (relieves chicos) se reconstruyen con inpaint de OpenCV.
Corre sobre assets/productos/*.png ya recortados (despues de extract_products.py).
"""
import cv2, numpy as np
from pathlib import Path
P = Path(__file__).resolve().parents[1] / 'assets/productos'
rng = np.random.default_rng(7)
SAT_STEEL = 12
# nombre: (caja amplia del logo en el cuerpo x0,y0,x1,y1, 'ambos'|'arriba', [cajas de relieve en tapa])
JOBS = {
    'vaso_asa_crema':  ((22, 95, 135, 170), 'ambos', []),
    'vaso_asa_blanco': ((35, 172, 160, 236), 'ambos', [(70, 46, 112, 78)]),
    'vaso_rosa_1':     ((50, 336, 154, 388), 'arriba', []),
    'vaso_rosa_2':     ((66, 352, 160, 400), 'arriba', [(85, 22, 135, 56)]),
}
for name, (box, mode, lids) in JOBS.items():
    im = cv2.imread(str(P / f'{name}.png'), cv2.IMREAD_UNCHANGED)
    col = im[..., :3].astype(np.float32)
    x0, y0, x1, y1 = box
    roi = col[y0:y1, x0:x1]
    ref = cv2.medianBlur(np.ascontiguousarray(roi).astype(np.uint8), 31).astype(np.float32)
    dev = np.abs(roi - ref).max(2)
    m = (dev > 10).astype(np.uint8)
    m = cv2.dilate(m, np.ones((5, 5), np.uint8), iterations=2)
    ys, xs = np.where(m)
    by0, by1 = y0 + ys.min(), y0 + ys.max() + 1
    bx0, bx1 = x0 + xs.min(), x0 + xs.max() + 1
    print(f'{name}: logo en x{bx0}-{bx1} y{by0}-{by1}')
    out = col.copy()
    # muestras de arriba suavizadas entre columnas: sin rayas verticales en el parche
    colS = cv2.GaussianBlur(col, (7, 1), 0)
    band_top = None
    if mode == 'arriba':
        # borde superior de la banda de acero, columna por columna: desde la ultima fila opaca se
        # sube mientras el pixel no sea rosa ((R+B)/2 - G < 8); entre logo y banda hay franja rosa.
        bb, gg, rr = col[..., 0], col[..., 1], col[..., 2]
        pk = (rr + bb) / 2 - gg
        xs_fit, ys_fit = [], []
        for x in range(bx0 - 6, bx1 + 6):
            ys = np.where(im[:, x, 3] == 255)[0]
            if len(ys) == 0: continue
            y = ys.max()
            while y > by0 and pk[y, x] < 8: y -= 1
            xs_fit.append(x); ys_fit.append(y + 1)
        cf = np.polyfit(xs_fit, ys_fit, 2)
        band_top = lambda x: int(np.floor(np.polyval(cf, x))) - 1
        print(f'  banda de acero: {len(xs_fit)} columnas de ajuste, y~{np.polyval(cf, (bx0 + bx1) / 2):.1f} al centro')
    for x in range(bx0, bx1):
        yb = by1 if band_top is None else min(col.shape[0], band_top(x))
        above = colS[by0 - 6:by0 - 1, x].mean(0)
        sd = col[by0 - 14:by0 - 1, x].std(0)
        if mode == 'ambos':
            below = colS[by1 + 1:by1 + 6, x].mean(0)
            t = np.linspace(0, 1, by1 - by0)[:, None]
            fill = above * (1 - t) + below * t
        else:  # extrapola la pendiente vertical del cuerpo de arriba
            a2 = colS[by0 - 26:by0 - 21, x].mean(0)
            slope = (above - a2) / 20.0
            fill = above + slope * np.arange(1, yb - by0 + 1)[:, None]
        out[by0:yb, x] = fill + rng.normal(0, 1, (yb - by0, 3)) * np.minimum(sd, 2.5)
        out[yb:by1, x] = col[yb:by1, x]
    # mezcla suave en la orilla horizontal del parche
    mask = np.zeros(col.shape[:2], np.float32); mask[by0:by1, bx0:bx1] = 1
    mask = cv2.GaussianBlur(mask, (0, 0), 4)
    if band_top is not None:  # la banda de acero no se toca
        for x in range(col.shape[1]): mask[max(0, band_top(x)):, x] = 0
    out = col * (1 - mask[..., None]) + out * mask[..., None]
    res = np.clip(out, 0, 255).astype(np.uint8)
    for (lx0, ly0, lx1, ly1) in lids:
        r = res[ly0:ly1, lx0:lx1]
        refl = cv2.medianBlur(r, 9)
        lm = (np.abs(r.astype(int) - refl.astype(int)).max(2) > 12).astype(np.uint8)
        lm = cv2.dilate(lm, np.ones((3, 3), np.uint8))
        full = np.zeros(res.shape[:2], np.uint8); full[ly0:ly1, lx0:lx1] = lm
        res = cv2.inpaint(res, full, 4, cv2.INPAINT_TELEA)
    im[..., :3] = res
    cv2.imwrite(str(P / f'{name}.png'), im)
