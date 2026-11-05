"""Cifras tabulares para los precios.

Poppins no trae la función OpenType 'tnum' (ni en la versión completa de Google Fonts),
y con cifras proporcionales los conteos de precio ($60 -> $65, $0 -> $180) se mueven
de lado. Aquí se arma "Matica Num": SOLO los dígitos 0-9 de Poppins, cada uno centrado
en un ancho fijo. En CSS se declara con unicode-range de dígitos y Poppins pone el resto.

Licencia: Poppins es SIL OFL 1.1 (sin Reserved Font Name); la variante lleva otro nombre
y la misma licencia (site/fonts/OFL-Poppins.txt).

Uso: python3 matica/tools/make_tnum.py
"""
import glob
from pathlib import Path

from fontTools.subset import Options, Subsetter
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "tools" / "node_modules" / "@expo-google-fonts" / "poppins"
OUT = ROOT / "site" / "fonts"
ADV = 630  # ancho fijo (unidades de 1000/em); el promedio de Poppins es 594, el 0 mide 646
DIGITS = "0123456789"

for weight, name in [(500, "500Medium"), (600, "600SemiBold"), (700, "700Bold")]:
    path = glob.glob(str(SRC / name / f"Poppins_{name}.ttf"))[0]
    font = TTFont(path)
    opts = Options()
    opts.layout_features = []
    opts.name_IDs = [0, 1, 2, 3, 4, 5, 6]
    opts.notdef_outline = True
    sub = Subsetter(opts)
    sub.populate(text=DIGITS)
    sub.subset(font)

    cmap = font.getBestCmap()
    glyf, hmtx = font["glyf"], font["hmtx"]
    for ch in DIGITS:
        gname = cmap[ord(ch)]
        adv, lsb = hmtx[gname]
        g = glyf[gname]
        shift = round((ADV - adv) / 2)
        if g.isComposite():
            for comp in g.components:
                comp.x += shift
        elif g.numberOfContours > 0:
            coords = g.getCoordinates(glyf)[0]
            coords.translate((shift, 0))
        g.recalcBounds(glyf)
        hmtx[gname] = (ADV, lsb + shift)

    # nombre propio para la variante modificada
    for rec in font["name"].names:
        if rec.nameID in (1, 4, 16):
            rec.string = "Matica Num"
        elif rec.nameID == 6:
            rec.string = f"MaticaNum-{weight}"
        elif rec.nameID == 3:
            rec.string = f"MaticaNum-{weight};tabular-digits-from-Poppins-4.004"
    font.flavor = "woff2"
    out = OUT / f"matica-num-{weight}.woff2"
    font.save(out)
    print(out.name, out.stat().st_size, "bytes")
