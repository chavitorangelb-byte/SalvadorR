"""Super resolucion de las fotos de producto con Real-ESRGAN x4plus (RRDBNet), solo sobre las fotos fijas.

- RGB: antes de ampliar, el color de la orilla se extiende hacia el fondo transparente (sin negro que se cuele).
- Alfa: se amplia con el mismo modelo (canal en gris) para que la silueta salga nitida.
- Se guarda a ESCALA x el original (por defecto 2x: la imagen x4 se reduce con Lanczos) y se
  escalan igual las mascaras y meta.json, para que el grabado/recolor sigan alineados.
Los originales quedan en assets/productos_1x/. Uso: python3 upscale_esrgan.py <pesos.pth> [escala]
"""
import sys, json, shutil
from pathlib import Path
import numpy as np, cv2, torch
from torch import nn
import torch.nn.functional as F

P = Path(__file__).resolve().parents[1] / 'assets'
SRC = P / 'productos_1x'; DST = P / 'productos'
SCALE = float(sys.argv[2]) if len(sys.argv) > 2 else 2.0


class RDB(nn.Module):
    def __init__(s, nf=64, gc=32):
        super().__init__()
        s.conv1 = nn.Conv2d(nf, gc, 3, 1, 1); s.conv2 = nn.Conv2d(nf + gc, gc, 3, 1, 1); s.conv3 = nn.Conv2d(nf + 2 * gc, gc, 3, 1, 1)
        s.conv4 = nn.Conv2d(nf + 3 * gc, gc, 3, 1, 1); s.conv5 = nn.Conv2d(nf + 4 * gc, nf, 3, 1, 1); s.l = nn.LeakyReLU(0.2, True)
    def forward(s, x):
        x1 = s.l(s.conv1(x)); x2 = s.l(s.conv2(torch.cat((x, x1), 1))); x3 = s.l(s.conv3(torch.cat((x, x1, x2), 1)))
        x4 = s.l(s.conv4(torch.cat((x, x1, x2, x3), 1))); x5 = s.conv5(torch.cat((x, x1, x2, x3, x4), 1))
        return x5 * 0.2 + x
class RRDB(nn.Module):
    def __init__(s, nf=64):
        super().__init__(); s.rdb1 = RDB(nf); s.rdb2 = RDB(nf); s.rdb3 = RDB(nf)
    def forward(s, x): return s.rdb3(s.rdb2(s.rdb1(x))) * 0.2 + x
class RRDBNet(nn.Module):
    def __init__(s, nf=64, nb=23):
        super().__init__()
        s.conv_first = nn.Conv2d(3, nf, 3, 1, 1); s.body = nn.Sequential(*[RRDB(nf) for _ in range(nb)]); s.conv_body = nn.Conv2d(nf, nf, 3, 1, 1)
        s.conv_up1 = nn.Conv2d(nf, nf, 3, 1, 1); s.conv_up2 = nn.Conv2d(nf, nf, 3, 1, 1); s.conv_hr = nn.Conv2d(nf, nf, 3, 1, 1)
        s.conv_last = nn.Conv2d(nf, 3, 3, 1, 1); s.l = nn.LeakyReLU(0.2, True)
    def forward(s, x):
        f = s.conv_first(x); f = f + s.conv_body(s.body(f))
        f = s.l(s.conv_up1(F.interpolate(f, scale_factor=2, mode='nearest')))
        f = s.l(s.conv_up2(F.interpolate(f, scale_factor=2, mode='nearest')))
        return s.conv_last(s.l(s.conv_hr(f)))


net = RRDBNet()
sd = torch.load(sys.argv[1], map_location='cpu', weights_only=True)
net.load_state_dict(sd.get('params_ema', sd.get('params', sd)), strict=True); net.eval()
torch.set_num_threads(4)


def sr(img):  # img float 0..1 HxWx3 (RGB)
    with torch.no_grad():
        x = torch.from_numpy(np.ascontiguousarray(img.transpose(2, 0, 1))).float()[None]
        x = F.pad(x, (8, 8, 8, 8), mode='reflect')
        y = net(x)[0, :, 32:-32, 32:-32].clamp(0, 1).numpy().transpose(1, 2, 0)
    return y


if not SRC.exists():
    shutil.copytree(DST, SRC)
meta = json.loads((SRC / 'meta.json').read_text())
for f in sorted(SRC.glob('*.png')):
    if f.stem.endswith('_mask'): continue
    im = cv2.imread(str(f), cv2.IMREAD_UNCHANGED).astype(np.float32) / 255
    h, w = im.shape[:2]
    a = im[..., 3]
    rgb = im[..., :3].copy()
    # extender el color de la orilla hacia el fondo (relleno por dilatacion sucesiva)
    known = a > 0.5
    fill = rgb.copy(); k = known.copy()
    for _ in range(24):
        if k.all(): break
        d = cv2.dilate(fill * k[..., None], np.ones((3, 3), np.uint8)); n = cv2.dilate(k.astype(np.float32), np.ones((3, 3), np.uint8))
        cnt = cv2.blur(k.astype(np.float32), (3, 3)); s = cv2.blur(fill * k[..., None], (3, 3))
        newk = (cnt > 0) & ~k
        fill[newk] = (s[newk] / cnt[newk, None]); k = k | newk
    rgb = np.where(known[..., None], rgb, fill)
    up = sr(rgb[..., ::-1].copy())[..., ::-1]
    ua = sr(np.repeat(a[..., None], 3, 2)).mean(2)
    tw, th = int(round(w * SCALE)), int(round(h * SCALE))
    up = cv2.resize(up, (tw, th), interpolation=cv2.INTER_AREA)
    ua = cv2.resize(ua, (tw, th), interpolation=cv2.INTER_AREA)
    ua = np.clip((ua - 0.04) / 0.92, 0, 1)
    out = np.dstack([np.clip(up, 0, 1), ua]) * 255
    cv2.imwrite(str(DST / f.name), out.astype(np.uint8))
    mk = SRC / f'{f.stem}_mask.png'
    if mk.exists():
        m = cv2.imread(str(mk), 0)
        cv2.imwrite(str(DST / mk.name), cv2.resize(m, (tw, th), interpolation=cv2.INTER_LINEAR))
    print(f'{f.stem:45s} {w}x{h} -> {tw}x{th}', flush=True)
for k, v in meta.items():
    v['size'] = [int(round(v['size'][0] * SCALE)), int(round(v['size'][1] * SCALE))]
    v['mask_bbox'] = [int(round(c * SCALE)) for c in v['mask_bbox']]
    if 'engrave' in v: v['engrave'] = {kk: vv * SCALE for kk, vv in v['engrave'].items()}
(DST / 'meta.json').write_text(json.dumps(meta, indent=1))
