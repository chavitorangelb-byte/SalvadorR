"""Recorta las fotos del catálogo de WhatsApp Business (capturas 1320x2868) a ./assets.
Detecta el área real de la foto (quita las bandas de relleno del visor) y corta por
encima de la barra de progreso del carrusel. Los originales quedan en assets/src."""
import sys, json
from pathlib import Path
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SRC, OUT = ROOT / 'assets/src', ROOT / 'assets'
Y0, Y1 = 349, 1666          # zona del visor de foto en la captura
BAR = 1622                   # la barra de progreso del carrusel vive en ~1626-1640

JOBS = {  # salida: (captura, ¿tiene barra de progreso?)
    '03_baby_babkas.jpg':               ('IMG_8541_baby_babkas.png', True),
    '04_croissant_natural.jpg':         ('IMG_8549_croissant.png', True),
    '05_rosca_de_babka.jpg':            ('IMG_8553_rosca.png', True),
    '06_babka_nutella.jpg':             ('IMG_8552_babka.png', False),
    '07_rol_canela_y_nuez.jpg':         ('IMG_8551_rol.png', True),
    '08_chocolatine.jpg':               ('IMG_8542_chocolatine.png', True),
    '09_croissant_relleno.jpg':         ('IMG_8548_croissant_relleno.png', True),
    '10_pan_de_caja_multisemillas.jpg': ('IMG_8544_pan_caja_multisemillas.png', False),
    '11_barra_rustica_natural.jpg':     ('IMG_8545_barra_natural.png', False),
    # extras del catálogo (no están en el brief; disponibles si hacen falta)
    'x12_pan_de_caja_avena_linaza.jpg': ('IMG_8547_pan_caja_avena.png', False),
    'x13_barra_rustica_multisemillas.jpg': ('IMG_8546_barra_multisemillas.png', False),
    'x14_pan_brioche.jpg':              ('IMG_8550_brioche.png', True),
}

FIX = {  # revisados a ojo sobre la captura
    '05_rosca_de_babka.jpg': (0, 637, 1320, 1377),
    '08_chocolatine.jpg': (0, 637, 1320, 1377),
}

def bounds(a, y0, y1):
    g = a[y0:y1].mean(axis=2)
    rows = np.where(g.std(axis=1) > 4)[0]
    cols = np.where(g.std(axis=0) > 4)[0]
    # columnas: banda de relleno lateral = columnas casi constantes en vertical
    return y0 + rows.min(), y0 + rows.max() + 1, cols.min(), cols.max() + 1

report = {}
for out, (src, bar) in JOBS.items():
    a = np.asarray(Image.open(SRC / src).convert('RGB'))
    y1 = BAR if bar else Y1
    t, b, l, r = bounds(a, Y0, y1)
    # los visores con relleno lateral difuminado: buscar el borde duro de la foto
    g = a[t:b].astype(float).mean(axis=2)
    dx = np.abs(np.diff(g, axis=1)).mean(axis=0)
    edges = [i for i in range(60, 260) if dx[i] > 6 * np.median(dx)]
    if edges: l = max(l, edges[-1] + 2)
    edges = [i for i in range(1060, 1260) if dx[i] > 6 * np.median(dx)]
    if edges: r = min(r, edges[0] - 1)
    if out.startswith('11_'): r, b = min(r, 1300), min(b, 1627)   # scrollbar y banda inferior del visor
    if out in FIX: l, t, r, b = FIX[out]
    im = Image.fromarray(a[t:b, l:r])
    im.save(OUT / out, quality=95, subsampling=0)
    report[out] = dict(src=src, box=[int(l), int(t), int(r), int(b)], size=im.size)
    print(out.ljust(38), im.size, (l, t, r, b))

# logo: pantalla "Business info", cuadro crema de 1320 px
a = np.asarray(Image.open(SRC / 'IMG_8538_logo.png').convert('RGB'))
cream = (a[:, 20, 0] > 200) & (a[:, 20, 2] > 120) & (a[:, 20, 2] < 215)   # columna izquierda: crema #F7E8B0
rows = np.where(cream)[0]; t, b = rows.min(), rows.max() + 1
im = Image.fromarray(a[t:b]); im.save(OUT / '02_avatar_logo_crema.jpg', quality=95, subsampling=0)
report['02_avatar_logo_crema.jpg'] = dict(src='IMG_8538_logo.png', box=[0, int(t), 1320, int(b)], size=im.size)
print('02_avatar_logo_crema.jpg'.ljust(38), im.size)
# variante blanca sobre fondo oscuro (esquina de la foto de la babka)
a = np.asarray(Image.open(SRC / 'IMG_8552_babka.png').convert('RGB'))
im = Image.fromarray(a[350:600, 190:445]); im.save(OUT / '01_logo_baja_resolucion_blanco_sobre_azul_oscuro.jpg', quality=95)
report['01_logo_baja_resolucion_blanco_sobre_azul_oscuro.jpg'] = dict(src='IMG_8552_babka.png', box=[190, 350, 445, 600], size=im.size)
print('01_logo_blanco'.ljust(38), im.size)
(OUT / 'crops.json').write_text(json.dumps(report, indent=1))
