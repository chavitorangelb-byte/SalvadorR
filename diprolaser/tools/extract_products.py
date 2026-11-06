"""Recorta cada producto de las laminas que mando Salvador (fondo blanco) a PNG con transparencia.

- Fondo = region casi blanca conectada al borde del recorte (inundacion), asi los productos
  blancos o crema no se vuelven transparentes por dentro.
- Borde suave: en una banda de 2 px el alfa sale de la distancia al blanco; adentro es opaco.
- Descontaminacion: se quita el blanco premultiplicado del borde (C = (I - (1-a)*255) / a).
Salida: assets/productos/<nombre>.png (+ el rect de origen en assets/productos/origen.json)
"""
import json, cv2, numpy as np
from pathlib import Path
P = Path(__file__).resolve().parents[1]
SRC = P / 'assets/fuente'; OUT = P / 'assets/productos'; OUT.mkdir(parents=True, exist_ok=True)

# (lamina, x, y, w, h) de los blobs detectados, con margen
ITEMS = {
  'termo_negro_1':            ('lamina_indice', 126, 1236, 148, 328),
  'termo_negro_2':            ('lamina_indice', 523, 1236, 154, 328),
  'termo_negro_3':            ('lamina_indice', 922, 1236, 156, 328),
  'vaso_azul_1':              ('lamina_indice', 1286, 1236, 228, 328),
  'vaso_azul_2':              ('lamina_indice', 1690, 1236, 220, 328),
  'vaso_verde_1':             ('lamina_indice', 106, 1636, 188, 328),
  'vaso_verde_2':             ('lamina_vasos_asa_rosa_verde', 1119, 40, 262, 420),
  'vaso_asa_crema':           ('lamina_vasos_asa_rosa_verde', 131, 40, 238, 420),
  'vaso_asa_blanco':          ('lamina_vasos_asa_rosa_verde', 608, 40, 284, 420),
  'vaso_rosa_1':              ('lamina_vasos_asa_rosa_verde', 1646, 40, 208, 421),
  'vaso_rosa_2':              ('lamina_vasos_asa_rosa_verde', 2130, 40, 240, 421),
  'anfora_negra_grabado_diprolaser':   ('lamina_indice', 1691, 836, 218, 328),
  'estuche_vip_grabado_diprolaser':    ('lamina_indice', 436, 938, 328, 124),
  'estuche_plumas_abierto':   ('lamina_indice', 36, 907, 328, 186),
  'set_regalo_pluma_tarjetero_navaja_llavero': ('lamina_indice', 1636, 484, 328, 232),
  'llavero_cinta_azul':       ('lamina_indice', 836, 948, 328, 104),
  'llavero_cinta_roja':       ('lamina_indice', 1235, 936, 329, 128),
  'llavero_llanta':           ('lamina_cascos_llanta', 1175, 72, 350, 756),
  'llavero_casco_amarillo':   ('lamina_cascos_llanta', 71, 294, 283, 288),
  'llavero_casco_blanco':     ('lamina_cascos_llanta', 566, 311, 262, 295),
  'llavero_casco_blanco_2':   ('lamina_indice', 448, 436, 304, 328),
  'llavero_casco_luz_encendida': ('lamina_indice', 58, 436, 284, 328),
}
PAD = 10
HOLES = {'llavero_cinta_azul', 'llavero_cinta_roja', 'llavero_llanta', 'vaso_asa_crema', 'vaso_asa_blanco'}
meta = {}
for name, (sheet, x, y, w, h) in ITEMS.items():
    im = cv2.imread(str(SRC / f'{sheet}.jpg'))
    H, W = im.shape[:2]
    x0, y0, x1, y1 = max(0, x - PAD), max(0, y - PAD), min(W, x + w + PAD), min(H, y + h + PAD)
    c = im[y0:y1, x0:x1].astype(np.float32)
    d = (255 - c).max(2)                         # distancia al blanco
    near = (d < 14).astype(np.uint8)
    # inundacion desde el borde: solo el blanco conectado al exterior es fondo
    pad = cv2.copyMakeBorder(near, 1, 1, 1, 1, cv2.BORDER_CONSTANT, value=1)
    n, lab = cv2.connectedComponents(pad, connectivity=4)
    bg = (lab == lab[0, 0])[1:-1, 1:-1]
    fg = (~bg).astype(np.uint8)
    # quitar motas sueltas: quedarse con componentes grandes
    n, lab, st, _ = cv2.connectedComponentsWithStats(fg, connectivity=8)
    keep = np.zeros_like(fg)
    big = st[1:, cv2.CC_STAT_AREA].max()
    for i in range(1, n):
        if st[i, cv2.CC_STAT_AREA] > 0.004 * big: keep[lab == i] = 1
    if name in HOLES:  # aros y asas: el blanco puro (255) encerrado es hueco, no producto
        hn, hl, hs, _ = cv2.connectedComponentsWithStats(((d <= 2) & (keep > 0)).astype(np.uint8), connectivity=4)
        for i in range(1, hn):
            if hs[i, cv2.CC_STAT_AREA] >= 150:
                hole = (hl == i).astype(np.uint8)
                for _ in range(5):  # crece sobre el blanco sucio del JPEG junto al metal (d <= 40)
                    hole = cv2.dilate(hole, np.ones((3, 3), np.uint8)) & (d <= 40).astype(np.uint8)
                keep[hole > 0] = 0
    inner = cv2.erode(keep, np.ones((3, 3), np.uint8), iterations=2)
    band = cv2.dilate(keep, np.ones((3, 3), np.uint8), iterations=1) - inner
    a_soft = np.clip((d - 4) / 40.0, 0, 1)
    alpha = np.where(inner > 0, 1.0, np.where(band > 0, a_soft, 0.0)).astype(np.float32)
    alpha = cv2.GaussianBlur(alpha, (3, 3), 0.6) * np.maximum(keep, band)
    a3 = np.maximum(alpha, 1e-3)[..., None]
    col = np.clip((c - (1 - alpha[..., None]) * 255.0) / a3, 0, 255)
    # orilla: el color de la banda se toma extendiendo el interior (no del fondo blanco);
    # elimina el hilo claro que deja el JPEG sin recortar el alfa
    ext = cv2.inpaint(np.clip(col, 0, 255).astype(np.uint8), (inner == 0).astype(np.uint8), 3, cv2.INPAINT_TELEA).astype(np.float32)
    w = np.clip((0.97 - alpha) / 0.3, 0, 1)[..., None] * (inner == 0)[..., None]
    col = col * (1 - w) + ext * w
    col = np.where(alpha[..., None] > 0.02, col, 0)
    rgba = np.dstack([col, alpha * 255]).astype(np.uint8)
    ys, xs = np.where(alpha > 0.02)
    rgba = rgba[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    cv2.imwrite(str(OUT / f'{name}.png'), rgba)
    meta[name] = {'sheet': sheet, 'rect': [x0, y0, x1, y1], 'size': [int(rgba.shape[1]), int(rgba.shape[0])]}
    print(f'{name:45s} {rgba.shape[1]}x{rgba.shape[0]}')
json.dump(meta, open(OUT / 'origen.json', 'w'), indent=1)
