"""Música original en código: 120 BPM (compás = 2.0 s), una capa nueva por sección. Sin samples.
Salida: audio/stems/music_raw.wav (48 kHz estéreo, 18 s)."""
import subprocess
from pathlib import Path
import numpy as np
from scipy import signal

V = Path(__file__).resolve().parents[1]
SR, DUR = 48000, 18.0
N = int(SR * DUR)
t = np.arange(N) / SR
L = np.zeros(N); R = np.zeros(N)
rng = np.random.default_rng(7)
hz = lambda m: 440.0 * 2 ** ((m - 69) / 12)
lp = lambda x, f, o=2: signal.sosfilt(signal.butter(o, f, "low", fs=SR, output="sos"), x)
hp = lambda x, f, o=2: signal.sosfilt(signal.butter(o, f, "high", fs=SR, output="sos"), x)

def add(x, t0, gain=1.0, pan=0.0):
    i = int(t0 * SR)
    if i >= N: return
    x = x[: N - i] * gain
    L[i:i + len(x)] += x * np.cos((pan + 1) * np.pi / 4)
    R[i:i + len(x)] += x * np.sin((pan + 1) * np.pi / 4)

# acordes por compás: Am9, Fmaj7, Am9, Fmaj7, Cmaj7, G6, Am9, Fmaj7, (cola) Am
CH = [[57, 60, 64, 71], [53, 57, 60, 64], [57, 60, 64, 71], [53, 57, 60, 64], [48, 55, 59, 64], [55, 59, 62, 64], [57, 60, 64, 71], [53, 57, 60, 64], [57, 60, 64, 69]]
ROOT = [33, 29, 33, 29, 36, 31, 33, 29, 33]

def env(n, a, r):
    e = np.ones(n); na, nr = int(a * SR), int(r * SR)
    e[:na] = np.linspace(0, 1, na) ** 2; e[-nr:] *= np.linspace(1, 0, nr) ** 2
    return e

# pad (todo el tema): sierras desafinadas con filtro que se abre en el lift
for b, ch in enumerate(CH):
    n = int(2.4 * SR); tt = np.arange(n) / SR
    x = np.zeros(n)
    for m in ch:
        for d in (-0.07, 0.0, 0.08):
            x += signal.sawtooth(2 * np.pi * hz(m + d) * tt + rng.uniform(0, 6)) / 3
    cut = 520 if b < 2 else 800 if b < 6 else 1500 if b == 6 else 700
    x = lp(x, cut, 3) * env(n, 0.5, 0.7)
    add(x, b * 2.0, 0.085, -0.25); add(np.roll(x, 300), b * 2.0, 0.085, 0.25)

# sub grave (desde el compás 1): nota larga por compás
for b, m in enumerate(ROOT[:8]):
    n = int(1.9 * SR); tt = np.arange(n) / SR
    x = np.sin(2 * np.pi * hz(m) * tt) * np.exp(-tt * 1.1) * np.minimum(1, tt * 60)
    x += 0.3 * np.sin(2 * np.pi * hz(m + 12) * tt) * np.exp(-tt * 2.5)
    if not 14.0 <= b * 2.0 < 15.0: add(x, b * 2.0, 0.42 if b != 7 else 0.28)

# pluck suave (desde el compás 3): arpegio en corcheas
def pluck(m, g=1.0):
    n = int(0.9 * SR); tt = np.arange(n) / SR
    x = (np.sin(2 * np.pi * hz(m) * tt) + 0.35 * signal.sawtooth(2 * np.pi * hz(m) * tt, 0.5)) * np.exp(-tt * 6.5)
    return lp(x, 2600) * g
for b in range(2, 8):
    ch = CH[b]; pat = [0, 2, 1, 3, 2, 1, 3, 2]
    for s in range(8):
        tm = b * 2.0 + s * 0.25
        if 14.0 <= tm < 15.0: continue                       # respiro
        if tm >= 15.0 and s % 2: continue
        oc = 12 if b < 6 else 24 if s % 2 else 12
        add(pluck(ch[pat[s]] + oc), tm, 0.11 if b < 6 else 0.14, 0.5 if s % 2 else -0.5)

# shaker ligero (desde el compás 5): semicorcheas con acento
for i in range(int((14.0 - 8.0) / 0.125)):
    tm = 8.0 + i * 0.125; n = int(0.07 * SR)
    x = hp(rng.standard_normal(n), 6500) * np.exp(-np.arange(n) / SR * 70)
    add(x, tm + (0.012 if i % 2 else 0), (0.05 if i % 4 == 2 else 0.028) * (1.25 if tm >= 12 else 1), 0.3)

# riser 11.0 -> 12.0 y lift pleno en 12.0
n = int(1.0 * SR); tt = np.arange(n) / SR
nz = rng.standard_normal(n); rs = np.zeros(n)
for k in range(0, n, 256):                                    # barrido de filtro
    f = 400 + 7000 * (k / n) ** 2
    seg = nz[k:k + 256]; rs[k:k + 256] = seg * (k / n) ** 1.6
rs = hp(lp(rs, 9000), 300) * 0.5 + 0.35 * np.sin(2 * np.pi * (110 * tt + 110 * tt * tt)) * tt ** 2
add(rs, 11.0, 0.16, 0.0)
def thump(f0=95, f1=42, d=0.5, g=1.0):
    n = int(d * SR); tt = np.arange(n) / SR
    ph = 2 * np.pi * (f1 * tt + (f0 - f1) * (1 - np.exp(-tt * 18)) / 18)
    return np.sin(ph) * np.exp(-tt * (5 / d)) * g
add(thump(120, 44, 0.8), 12.0, 0.75)
for b in np.arange(12.5, 14.0, 0.5): add(thump(90, 48, 0.3), b, 0.34)           # pulso del lift
# golpe grave en el corte final (16.0)
add(thump(110, 31, 1.6), 16.0, 0.95)
n = int(0.5 * SR); add(lp(rng.standard_normal(n), 220) * np.exp(-np.arange(n) / SR * 9), 16.0, 0.5)

x = np.vstack([L, R]); x[:, -int(1.2 * SR):] *= np.linspace(1, 0, int(1.2 * SR)) ** 1.5
x /= np.abs(x).max() * 1.15
subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "f32le", "-ar", str(SR), "-ac", "2", "-i", "-", "-c:a", "pcm_s24le",
                str(V / "audio/stems/music_raw.wav")], input=x.T.astype(np.float32).tobytes(), check=True)
print("musica ok")
