"""Copia site/img/photos.json (tamaño real + LQIP) dentro de index.html.

La página lo lee para: no mostrar una foto más grande que su resolución real
(polaroid de la ficha) y pintar un placeholder borroso mientras carga.
Uso: python3 matica/tools/sync_photos.py
"""
import json
import re
from pathlib import Path

SITE = Path(__file__).resolve().parent.parent / "site"
meta = json.loads((SITE / "img" / "photos.json").read_text())
compact = json.dumps({m["id"]: {"w": m["w"], "h": m["h"], "q": m["lqip"]} for m in meta}, separators=(",", ":"))
page = SITE / "index.html"
html = page.read_text()
new, n = re.subn(r'(<script type="application/json" id="photos">)(.*?)(</script>)',
                 lambda m: m.group(1) + compact + m.group(3), html, flags=re.S)
assert n == 1, "no encontré el bloque de fotos"
page.write_text(new)
print("photos.json ->", page.name, f"({len(compact)} bytes, {len(meta)} fotos)")
