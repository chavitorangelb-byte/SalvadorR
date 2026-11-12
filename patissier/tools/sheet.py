"""Hoja de contactos rápida de cuadros sueltos (revisión interna). Uso: sheet.py <carpeta> <salida> [cols] [ancho]"""
import sys, glob
from PIL import Image, ImageDraw
d, out = sys.argv[1], sys.argv[2]; cols = int(sys.argv[3]) if len(sys.argv) > 3 else 4; tw = int(sys.argv[4]) if len(sys.argv) > 4 else 300
fs = sorted(glob.glob(d + '/*.png'))
ims = [Image.open(f).convert('RGB') for f in fs]
th = round(tw * ims[0].height / ims[0].width); rows = -(-len(ims) // cols)
s = Image.new('RGB', (cols * (tw + 6), rows * (th + 6)), (70, 70, 70)); dr = ImageDraw.Draw(s)
for i, (f, im) in enumerate(zip(fs, ims)):
    x, y = (i % cols) * (tw + 6), (i // cols) * (th + 6); s.paste(im.resize((tw, th), Image.LANCZOS), (x, y))
    n = int(f.split('_f')[-1][:4]); dr.text((x + 6, y + 4), f'f{n}  {n/60:.2f}s', fill=(255, 255, 0))
s.save(out)
