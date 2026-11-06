"""Mascaras para recolor y zona de grabado de cada producto.

- <nombre>_mask.png: 255 donde esta la pintura (vasos/termos) o la cinta (llaveros). Fuera:
  bandas de acero, tapa, asa, herrajes. Se detecta por distancia de color al tono del cuerpo
  (mediana de una muestra central) dentro de una franja vertical; el asa se excluye por x.
- meta.json: por producto, zona de grabado en pixeles del PNG (centro, semiancho del cilindro,
  alto util), luminancia media del cuerpo (para recolor) y tipo de superficie.
"""
import json, cv2, numpy as np
from pathlib import Path
P = Path(__file__).resolve().parents[1] / 'assets/productos'
# nombre: (tipo, muestra (fx0,fy0,fx1,fy1) en fraccion, franja y (fy0,fy1), x max (fraccion) o None, umbral)
# nombre: (tipo, muestra (fx0,fy0,fx1,fy1), franja y (fy0,fy1), x max o None, umbral, peso de luminancia)
CFG = {
    'termo_negro_1':   ('pintura', (.35, .55, .65, .75), (.31, .985), None, 26, .35),
    'termo_negro_2':   ('pintura', (.35, .55, .65, .75), (.31, .985), None, 26, .35),
    'termo_negro_3':   ('pintura', (.35, .55, .65, .75), (.31, .985), None, 26, .35),
    'vaso_azul_1':     ('pintura', (.35, .5, .65, .75), (.0, 1.), None, 34, .25),
    'vaso_azul_2':     ('pintura', (.35, .5, .65, .75), (.0, 1.), None, 34, .25),
    'vaso_verde_1':    ('pintura', (.35, .4, .65, .7), (.0, 1.), None, 22, .3),
    'vaso_verde_2':    ('pintura', (.35, .45, .65, .7), (.0, 1.), None, 22, .3),
    'vaso_rosa_1':     ('pintura', (.3, .3, .7, .6), (.0, 1.), None, 12, .25),
    'vaso_rosa_2':     ('pintura', (.3, .4, .7, .65), (.0, 1.), None, 12, .25),
    'vaso_asa_crema':  ('pintura', (.1, .4, .5, .6), (.17, 1.), .62, 30, .6),
    'vaso_asa_blanco': ('pintura', (.1, .5, .5, .65), (.29, 1.), .63, 30, .6),
    'llavero_cinta_azul': ('cinta', (.05, .35, .3, .65), (.0, 1.), .52, 45, .2),
    'llavero_cinta_roja': ('cinta', (.75, .45, .95, .75), (.0, 1.), -.62, 45, .2),
}
# filas de transicion (arriba, abajo) que se deciden pixel por pixel; poco donde la tapa
# transparente deja ver la pintura o la banda refleja el color
TRANS = {'vaso_verde_2': (6, 25), 'vaso_verde_1': (25, 3)}
meta = {}
for name, (kind, s, (fy0, fy1), xmax, thr, lw) in CFG.items():
    im = cv2.imread(str(P / f'{name}.png'), cv2.IMREAD_UNCHANGED)
    h, w = im.shape[:2]
    lab = cv2.cvtColor(im[..., :3], cv2.COLOR_BGR2LAB).astype(np.float32)
    smp = lab[int(s[1] * h):int(s[3] * h), int(s[0] * w):int(s[2] * w)].reshape(-1, 3)
    ref = np.median(smp, 0)
    # distancia de color: peso bajo a la luminancia (los brillos y sombras siguen siendo pintura)
    dlt = lab - ref
    dist = np.sqrt((dlt[..., 0] * lw) ** 2 + dlt[..., 1] ** 2 + dlt[..., 2] ** 2)
    m = (dist < thr).astype(np.uint8)
    m[: int(fy0 * h)] = 0; m[int(fy1 * h):] = 0
    if xmax and xmax > 0: m[:, int(xmax * w):] = 0
    if xmax and xmax < 0: m[:, :int(-xmax * w)] = 0  # negativo: x minimo
    m &= (im[..., 3] > 128).astype(np.uint8)
    m = cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((7, 7), np.uint8))
    if kind == 'pintura':
        # cilindro vertical: si la fila tiene suficiente pintura, la fila completa de la silueta
        # es pintura (incluye el lado en sombra, que se aleja del tono de muestra)
        sil = (im[..., 3] > 128).astype(np.uint8)
        if xmax and xmax > 0: sil[:, int(xmax * w):] = 0
        sil[: int(fy0 * h)] = 0; sil[int(fy1 * h):] = 0
        # cada fila se clasifica por la mediana de color de su centro (50 % de la silueta)
        rows = np.zeros(h, np.uint8)
        for y in range(h):
            xs_ = np.where(sil[y] > 0)[0]
            if len(xs_) < 6: continue
            c0, c1 = xs_.min(), xs_.max()
            mid = lab[y, int(c0 + 0.25 * (c1 - c0)):int(c0 + 0.75 * (c1 - c0)) + 1]
            dl = np.median(mid, 0) - ref
            rows[y] = np.sqrt((dl[0] * lw) ** 2 + dl[1] ** 2 + dl[2] ** 2) < thr * 0.8
        rows = cv2.morphologyEx(rows[:, None], cv2.MORPH_CLOSE, np.ones((7, 1), np.uint8))[:, 0]
        n_, lr, sr, _ = cv2.connectedComponentsWithStats(rows[:, None])
        rows = (lr[:, 0] == 1 + np.argmax(sr[1:, cv2.CC_STAT_AREA])).astype(np.uint8)
        pm = m.copy()  # criterio por pixel (ya calculado arriba)
        m = sil * rows[:, None]
        # bandas elipticas: en las filas de transicion se decide pixel por pixel
        ry = np.where(rows > 0)[0]
        tu, td = TRANS.get(name, (25, 25))
        for y in list(range(max(0, ry.min() - tu), ry.min())) + list(range(ry.max() + 1, min(h, ry.max() + 1 + td))):
            m[y] = sil[y] & pm[y]
        m = cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((1, 9), np.uint8))  # sin astillas de reflejo
        n_, lm, sm, _ = cv2.connectedComponentsWithStats(m)
        m = (lm == 1 + np.argmax(sm[1:, cv2.CC_STAT_AREA])).astype(np.uint8)
        m = cv2.dilate(m, np.ones((1, 5), np.uint8)) & (im[..., 3] > 0).astype(np.uint8)  # hasta la orilla: sin contorno del color original
    n, labm, st, _ = cv2.connectedComponentsWithStats(m)
    if n > 1:
        big = 1 + np.argmax(st[1:, cv2.CC_STAT_AREA]); m = (labm == big).astype(np.uint8)
        m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((11, 3), np.uint8))  # reflejos verticales
    soft = cv2.GaussianBlur(m.astype(np.float32), (0, 0), 0.8) * (im[..., 3] / 255.0)
    cv2.imwrite(str(P / f'{name}_mask.png'), (soft * 255).astype(np.uint8))
    ys, xs = np.where(m > 0)
    L = lab[..., 0][m > 0] / 255.0
    entry = {'kind': kind, 'size': [w, h], 'mask_bbox': [int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1],
             'lum_median': round(float(np.median(L)), 4)}
    if kind == 'pintura':
        # zona de grabado: fila central del cuerpo; semiancho = medio ancho de la mascara en esa fila
        y0, y1 = int(ys.min()), int(ys.max())
        cy = int(y0 + 0.47 * (y1 - y0))
        row = np.where(m[cy] > 0)[0]
        entry['engrave'] = {'cx': float((row.min() + row.max()) / 2), 'cy': float(cy),
                            'hw': float((row.max() - row.min()) / 2), 'h': float(0.42 * (y1 - y0))}
    meta[name] = entry
    print(f"{name:20s} mask {m.sum():6d}px  lum {entry['lum_median']:.3f}  {entry.get('engrave', '')}")
json.dump(meta, open(P / 'meta.json', 'w'), indent=1)
