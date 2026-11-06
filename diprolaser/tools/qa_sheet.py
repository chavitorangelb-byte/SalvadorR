"""Hoja de revision de recortes: cada PNG a tamano real sobre magenta y sobre negro.
Uso: python3 qa_sheet.py <carpeta_png> <salida.jpg> [escala]"""
import sys, cv2, numpy as np
from pathlib import Path
files = sorted(Path(sys.argv[1]).glob('*.png')); S = float(sys.argv[3]) if len(sys.argv) > 3 else 1
tiles = []
for f in files:
    im = cv2.imread(str(f), cv2.IMREAD_UNCHANGED)
    if S != 1: im = cv2.resize(im, None, fx=S, fy=S, interpolation=cv2.INTER_LANCZOS4)
    a = im[..., 3:4] / 255.0
    row = []
    for bgc in ((255, 0, 255), (0, 0, 0)):
        bg = np.zeros_like(im[..., :3]) + np.array(bgc, np.uint8)
        row.append((im[..., :3] * a + bg * (1 - a)).astype(np.uint8))
    t = np.hstack([row[0], np.full((im.shape[0], 6, 3), 128, np.uint8), row[1]])
    lab = np.full((28, t.shape[1], 3), 40, np.uint8)
    cv2.putText(lab, f.stem[:40], (4, 20), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1, cv2.LINE_AA)
    tiles.append(np.vstack([lab, t]))
Wmax = 1800; rows, cur, cw = [], [], 0
for t in tiles:
    if cw + t.shape[1] > Wmax and cur: rows.append(cur); cur, cw = [], 0
    cur.append(t); cw += t.shape[1] + 12
rows.append(cur)
out = []
for r in rows:
    h = max(t.shape[0] for t in r)
    out.append(np.hstack([np.vstack([np.pad(t, ((0, h - t.shape[0]), (0, 12), (0, 0)), constant_values=90)]) for t in r]))
w = max(o.shape[1] for o in out)
sheet = np.vstack([np.pad(o, ((0, 12), (0, w - o.shape[1]), (0, 0)), constant_values=90) for o in out])
cv2.imwrite(sys.argv[2], sheet, [cv2.IMWRITE_JPEG_QUALITY, 92]); print(sheet.shape)
