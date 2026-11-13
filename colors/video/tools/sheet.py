"""Hoja de contactos de cuadros sueltos (revision interna). python3 sheet.py <dir> <salida.jpg> [cols] [ancho]"""
import glob, sys
from PIL import Image, ImageDraw
d, out = sys.argv[1], sys.argv[2]
cols = int(sys.argv[3]) if len(sys.argv) > 3 else 6
tw = int(sys.argv[4]) if len(sys.argv) > 4 else 300
fs = sorted(glob.glob(d + '/*.png'))
im0 = Image.open(fs[0]); th = round(tw * im0.height / im0.width)
rows = (len(fs) + cols - 1) // cols
sh = Image.new('RGB', (cols * tw, rows * th), '#000')
for i, f in enumerate(fs):
    im = Image.open(f).convert('RGB').resize((tw, th), Image.LANCZOS)
    x, y = (i % cols) * tw, (i // cols) * th
    sh.paste(im, (x, y)); ImageDraw.Draw(sh).text((x + 6, y + 6), f.split('_f')[-1][:4], fill='#ff0')
sh.save(out, quality=88); print(sh.size)
