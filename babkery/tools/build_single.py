"""Empaqueta site/index.html en un solo archivo autocontenido (fuentes e imagenes
incrustadas en base64). Sirve para abrirla directo en un celular o mandarla por
WhatsApp/correo sin servidor. La fuente de verdad sigue siendo site/."""
import base64
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SITE = ROOT / "site"
OUT = ROOT / "video" / "out" / "pagina_babkery.html"
MIME = {".woff2": "font/woff2", ".webp": "image/webp", ".png": "image/png", ".jpg": "image/jpeg"}

html = (SITE / "index.html").read_text()
# los preload de fuentes no aplican cuando la fuente va incrustada
html = re.sub(r'<link rel="preload"[^>]*>\n?', "", html)

cache = {}
def data_uri(rel):
    if rel not in cache:
        f = SITE / rel
        cache[rel] = f"data:{MIME[f.suffix]};base64," + base64.b64encode(f.read_bytes()).decode()
    return cache[rel]

used = sorted(set(re.findall(r"(?:fonts|img)/[\w.\-]+\.(?:woff2|webp|png|jpg)", html)))
for rel in used:
    html = html.replace(rel, data_uri(rel))

OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(html)
print("incrustados:", len(used), "->", OUT, f"{OUT.stat().st_size / 1024 / 1024:.2f} MB")
for rel in used:
    print("  ", rel)
