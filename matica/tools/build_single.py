"""Empaqueta matica/site/index.html en un solo archivo autocontenido (fuentes e
imágenes incrustadas en base64). Sirve para abrirla directo en un celular o mandarla
por WhatsApp/correo sin servidor. La fuente de verdad sigue siendo matica/site/.

Uso: python3 matica/tools/build_single.py
"""
import base64
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SITE = ROOT / "site"
OUT = ROOT / "dist" / "matica-cafe-demo.html"
MIME = {".woff2": "font/woff2", ".webp": "image/webp", ".png": "image/png", ".jpg": "image/jpeg"}

html = (SITE / "index.html").read_text()
# los preload no aplican cuando todo va incrustado
html = re.sub(r'<link rel="preload"[^>]*>\n?', "", html)
# og:image como data URI no sirve (y duplicaría la foto más pesada)
html = re.sub(r'<meta property="og:image"[^>]*>\n?', "", html)
# los datos estructurados (JSON-LD) conservan sus rutas: no se incrustan fotos ahí
ld_blocks = re.findall(r'<script type="application/ld\+json">.*?</script>', html, flags=re.S)
for i, blk in enumerate(ld_blocks):
    html = html.replace(blk, f"<!--LD{i}-->", 1)

cache = {}
def data_uri(rel):
    if rel not in cache:
        f = SITE / rel
        cache[rel] = f"data:{MIME[f.suffix]};base64," + base64.b64encode(f.read_bytes()).decode()
    return cache[rel]

# 1) rutas literales en HTML/CSS
used = sorted(set(re.findall(r"(?:fonts|img)/[\w.\-]+\.(?:woff2|webp|png|jpg)", html)))
# 2) fotos que el JS arma por id (img/<id>.webp): van en el mapa #imgsrc
meta = json.loads((SITE / "img" / "photos.json").read_text())
dynamic = {m["id"]: data_uri(f"img/{m['id']}.webp") for m in meta if f"img/{m['id']}.webp" not in used}
for rel in used:
    html = html.replace(rel, data_uri(rel))
html, n = re.subn(r'(<script type="application/json" id="imgsrc">)(.*?)(</script>)',
                  lambda m: m.group(1) + json.dumps(dynamic, separators=(",", ":")) + m.group(3), html, flags=re.S)
assert n == 1, "falta el bloque #imgsrc"
for i, blk in enumerate(ld_blocks):
    html = html.replace(f"<!--LD{i}-->", blk, 1)

OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(html)
print("incrustados:", len(used), "literales +", len(dynamic), "del JS ->", OUT.relative_to(ROOT.parent),
      f"{OUT.stat().st_size / 1024 / 1024:.2f} MB")
