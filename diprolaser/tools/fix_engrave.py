"""Zona de grabado/impresion centrada de verdad en cada producto que se personaliza.

- Centro horizontal: punto medio de la silueta real (alfa) en la fila del grabado; en vasos con asa
  se usa la mascara del cuerpo (el asa no cuenta).
- Altura: centro del cuerpo util (en el vaso con asa, la parte ancha de arriba, sin la base angosta).
- Semiancho del cilindro (hw): medio ancho de esa fila.
Corre despues de upscale_esrgan.py; reescribe assets/productos/meta.json.
"""
import json, cv2, numpy as np
from pathlib import Path
P = Path(__file__).resolve().parents[1] / 'assets/productos'
meta = json.loads((P / 'meta.json').read_text())
# producto: (fraccion vertical del centro del grabado, usa mascara para el ancho)
CFG = {'termo_negro_1': (0.635, False), 'termo_negro_2': (0.635, False), 'termo_negro_3': (0.64, False),
       'vaso_rosa_1': (0.50, False), 'vaso_rosa_2': (0.56, False), 'vaso_verde_2': (0.58, False), 'vaso_verde_1': (0.55, False),
       'vaso_azul_1': (0.62, False), 'vaso_azul_2': (0.62, False), 'vaso_asa_crema': (0.335, True), 'vaso_asa_blanco': (0.50, True)}
for k, (fy, use_mask) in CFG.items():
    im = cv2.imread(str(P / f'{k}.png'), cv2.IMREAD_UNCHANGED); h = im.shape[0]
    m = cv2.imread(str(P / f'{k}_mask.png'), 0) if use_mask else im[..., 3]
    cy = int(fy * h)
    # promedio de varias filas alrededor del centro para no depender de una fila ruidosa
    xs0, xs1 = [], []
    for y in range(cy - 6, cy + 7):
        row = np.where(m[y] > 128)[0]
        if len(row): xs0.append(row.min()); xs1.append(row.max())
    x0, x1 = np.median(xs0), np.median(xs1)
    e = meta[k].setdefault('engrave', {})
    old = dict(e)
    e.update({'cx': float((x0 + x1) / 2), 'cy': float(cy), 'hw': float((x1 - x0) / 2) * 0.985})
    print(f"{k:18s} cx {old.get('cx', 0):6.1f}->{e['cx']:6.1f}  cy {old.get('cy', 0):6.1f}->{e['cy']:6.1f}  hw {old.get('hw', 0):6.1f}->{e['hw']:6.1f}")
(P / 'meta.json').write_text(json.dumps(meta, indent=1))
