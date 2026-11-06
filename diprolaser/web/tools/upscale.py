"""Sube x4 los promocionales con Real-ESRGAN (x4plus). Color y alfa por separado;
el color de los pixeles transparentes se extiende desde el borde para que no entre halo."""
import sys, os, glob, numpy as np, torch, cv2
from PIL import Image
from spandrel import ModelLoader
torch.set_num_threads(os.cpu_count() or 4)
model = ModelLoader().load_from_file(sys.argv[1]).model.eval()
src_dir, out_dir = sys.argv[2], sys.argv[3]
os.makedirs(out_dir, exist_ok=True)
def run(rgb):
    t = torch.from_numpy(rgb.transpose(2, 0, 1)).float().unsqueeze(0) / 255
    with torch.no_grad():
        o = model(t)
    return (o.squeeze(0).clamp(0, 1).numpy().transpose(1, 2, 0) * 255 + .5).astype(np.uint8)
def extend(rgb, a):
    m = (a > 200).astype(np.uint8)
    out = rgb.copy()
    known = m.astype(bool)
    for _ in range(24):
        if known.all(): break
        dil = cv2.dilate(out * known[..., None], np.ones((3, 3), np.uint8))
        cnt = cv2.dilate(known.astype(np.uint8), np.ones((3, 3), np.uint8)).astype(bool)
        s = cv2.blur(out * known[..., None].astype(np.uint8), (3, 3)).astype(np.float32)
        w = cv2.blur(known.astype(np.float32), (3, 3))
        newk = cnt & ~known
        out[newk] = (s[newk] / np.maximum(w[newk][:, None], 1e-4)).astype(np.uint8)
        known = known | newk
    return out
for f in sorted(glob.glob(os.path.join(src_dir, '*.png'))):
    im = np.asarray(Image.open(f).convert('RGBA'))
    rgb, a = im[..., :3], im[..., 3]
    up = run(extend(rgb, a))
    au = run(np.dstack([a, a, a]))[..., 0]
    Image.fromarray(np.dstack([up, au]), 'RGBA').save(os.path.join(out_dir, os.path.basename(f)))
    print(os.path.basename(f), im.shape[1], '->', up.shape[1], flush=True)
