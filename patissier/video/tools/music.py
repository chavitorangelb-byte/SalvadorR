"""Música original hecha en código para el video de Patissier (sin muestras).
120 BPM entero, compás = 2.0 s. Re mayor, cálida y artesanal; una capa nueva por sección:
  0-4 s   golpe grave en 0.00, pulso suave de bajo y pads cálidos
  4-8 s   + marimba (pluck de madera)
  8-12 s  + arpegio suave y pulso de bombo de fieltro
  12-14 s lift: los pads abren, brillo arriba
  14-16 s cierre; respiro de 15.5 a 16.0 (todo se retira)
  16.00   golpe grave del corte final, cola hasta 17.5 y 0.5 s de silencio
Uso: python3 video/tools/music.py  ->  video/audio/stems/music.wav (48 kHz, estéreo, 18 s)
"""
from pathlib import Path
import numpy as np
from scipy.signal import butter, sosfilt, fftconvolve
import soundfile_shim as sf

ROOT = Path(__file__).resolve().parents[2]
SR, DUR, BEAT = 48000, 18.0, 0.5
N = int(SR * DUR)
rng = np.random.default_rng(20261112)
L = np.zeros(N); R = np.zeros(N)
tt = np.arange(N) / SR


def mtof(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def lp(x, fc, order=2):
    return sosfilt(butter(order, min(fc, SR * 0.45) / (SR / 2), 'low', output='sos'), x)


def hp(x, fc, order=2):
    return sosfilt(butter(order, fc / (SR / 2), 'high', output='sos'), x)


def add(sig, t0, gain=1.0, pan=0.0):
    i = int(round(t0 * SR))
    if i >= N:
        return
    sig = sig[:N - i]
    gl, gr = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    L[i:i + len(sig)] += sig * gain * gl * np.sqrt(2)
    R[i:i + len(sig)] += sig * gain * gr * np.sqrt(2)


def env(n, a, d, s=0.0, r=None):
    """ataque a (s), decaimiento exponencial d (s) hacia s"""
    t = np.arange(n) / SR
    e = np.where(t < a, t / max(a, 1e-4), s + (1 - s) * np.exp(-(t - a) / d))
    if r:
        e *= np.clip((n / SR - t) / r, 0, 1)
    return e


# ---------- armonía (un acorde por compás) ----------
#           D maj9          Bm9             G maj9          A6/9            D maj9          Bm9             G maj9 (lift)   A sus -> A
CHORDS = [[50, 57, 61, 64, 66], [47, 54, 57, 61, 62], [43, 50, 54, 57, 59], [45, 52, 54, 57, 59],
          [50, 57, 61, 64, 66], [47, 54, 57, 61, 62], [43, 50, 54, 59, 62], [45, 52, 57, 59, 62]]
ROOT_NOTES = [38, 35, 31, 33, 38, 35, 31, 33]


def chord_at(t):
    return CHORDS[min(7, int(t // 2))]


# ---------- pads cálidos (sierras desafinadas, filtradas) ----------
def pad(notes, dur, bright):
    n = int(dur * SR); t = np.arange(n) / SR; out = np.zeros(n)
    for m in notes:
        for det in (-0.07, 0.0, 0.06):
            f = mtof(m + det); ph = rng.uniform(0, 1)
            saw = 2 * ((f * t + ph) % 1) - 1
            out += saw * (0.6 if det else 1.0)
    out = lp(out, bright, 2)
    return out / len(notes) * env(n, 0.35, 9.0, 0.85, 0.45)


for b in range(8):
    t0 = b * 2.0
    if t0 < 0.5:
        t0 = 0.45
    dur = 2.0 * (b + 1) - t0 + 0.25
    bright = 900 if b < 6 else 2600            # el lift abre el filtro
    g = 0.11 if b < 6 else 0.13
    for pan in (-0.55, 0.55):
        add(pad(chord_at(b * 2 + 0.1), dur, bright * (1.0 if pan < 0 else 1.15)), t0, g, pan)

# ---------- bajo: pulso suave en corcheas desde 0.5 ----------
def bass_note(m, dur):
    n = int(dur * SR); t = np.arange(n) / SR; f = mtof(m)
    x = np.sin(2 * np.pi * f * t) + 0.25 * np.sin(4 * np.pi * f * t)
    return np.tanh(1.4 * x) * env(n, 0.006, 0.20, 0.0)


for k in range(int(0.5 / 0.25), int(15.5 / 0.25)):
    t0 = k * 0.25; b = int(t0 // 2)
    accent = 1.0 if (k % 2 == 0) else 0.55
    add(bass_note(ROOT_NOTES[b] + (12 if k % 8 == 6 else 0), 0.24), t0, 0.16 * accent, 0)

# ---------- marimba desde 4.0 (pluck de madera: parciales 1, 3.9, 9.2) ----------
def marimba(m, dur=0.9):
    n = int(dur * SR); t = np.arange(n) / SR; f = mtof(m)
    x = (np.sin(2 * np.pi * f * t) * np.exp(-t / 0.42) + 0.30 * np.sin(2 * np.pi * f * 3.9 * t) * np.exp(-t / 0.06)
         + 0.10 * np.sin(2 * np.pi * f * 9.2 * t) * np.exp(-t / 0.02))
    return x * env(n, 0.002, 10)


PATTERN = [0, None, 2, 1, None, 3, 2, None]   # índices del acorde, en corcheas
for k in range(int(4.0 / 0.25), int(15.5 / 0.25)):
    t0 = k * 0.25; idx = PATTERN[k % 8]
    if idx is None:
        continue
    m = chord_at(t0)[1 + idx] + 12
    add(marimba(m), t0, 0.075, -0.35 + 0.7 * ((k * 3) % 5) / 4)

# ---------- arpegio desde 8.0 (semicorcheas, triángulo suave) ----------
def tri(m, dur=0.22):
    n = int(dur * SR); t = np.arange(n) / SR; f = mtof(m)
    x = 2 * np.abs(2 * ((f * t) % 1) - 1) - 1
    return lp(x, 3200) * env(n, 0.003, 0.09)


ARP = [0, 2, 4, 2, 1, 3, 4, 3]
for k in range(int(8.0 / 0.125), int(15.5 / 0.125)):
    t0 = k * 0.125; c = chord_at(t0)
    m = c[ARP[k % 8]] + 24
    swell = min(1, (t0 - 8.0) / 1.5)
    add(tri(m), t0, 0.030 * swell * (1.15 if t0 >= 12 else 1), 0.6 if k % 2 else -0.6)

# ---------- bombo de fieltro desde 8.0 (en negras, nada agresivo) ----------
def felt_kick():
    n = int(0.35 * SR); t = np.arange(n) / SR
    f = 52 + 60 * np.exp(-t / 0.025)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.11)


for k in range(int(8.0 / 0.5), int(15.5 / 0.5)):
    add(felt_kick(), k * 0.5, 0.20 if k % 2 == 0 else 0.13, 0)

# ---------- brillo del lift (12 s): campanitas altas ----------
for i, m in enumerate([78, 81, 85, 86, 90]):
    n = int(2.5 * SR); t = np.arange(n) / SR
    add(np.sin(2 * np.pi * mtof(m) * t) * env(n, 0.04, 0.9), 12.0 + i * 0.06, 0.020, -0.6 + 0.3 * i)

# ---------- golpes graves: 0.00 y 16.00 ----------
def boom(dur=2.4, f0=58, f1=36):
    n = int(dur * SR); t = np.arange(n) / SR
    f = f1 + (f0 - f1) * np.exp(-t / 0.09)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.65)
    click = lp(rng.standard_normal(n), 1800) * np.exp(-t / 0.012) * 0.35
    return np.tanh(1.6 * (body + click))


add(boom(1.8), 0.0, 0.40, 0)
add(boom(2.6), 16.0, 0.48, 0)
# acorde final del corte: D mayor abierto, largo
def final_chord():
    n = int(1.6 * SR); t = np.arange(n) / SR; out = np.zeros(n)
    for m in (38, 45, 50, 54, 57, 62, 66):
        out += np.sin(2 * np.pi * mtof(m) * t) * (1 / (1 + (m - 38) / 12))
    return out * env(n, 0.004, 0.55, 0.0, 0.3)


add(final_chord() * 0.5, 16.0, 0.20, -0.2)
add(final_chord() * 0.5, 16.0, 0.20, 0.2)

# ---------- reverb (sala cálida, IR de ruido con caída) ----------
irn = int(2.4 * SR); it = np.arange(irn) / SR
ir_l = lp(rng.standard_normal(irn), 5000) * np.exp(-it / 0.55); ir_r = lp(rng.standard_normal(irn), 5000) * np.exp(-it / 0.55)
ir_l /= np.sqrt((ir_l ** 2).sum()); ir_r /= np.sqrt((ir_r ** 2).sum())
wet_l = fftconvolve(hp(L, 180), ir_l)[:N]; wet_r = fftconvolve(hp(R, 180), ir_r)[:N]
L = L + 0.32 * wet_l; R = R + 0.32 * wet_r

# ---------- respiro antes del corte y silencio final ----------
g = np.ones(N)
breath = (tt >= 15.45) & (tt < 16.0)
g[breath] = np.clip(1 - (tt[breath] - 15.45) / 0.35, 0.12, 1)
g[tt >= 17.15] = np.clip(1 - (tt[tt >= 17.15] - 17.15) / 0.35, 0, 1)   # 0.5 s de silencio al final
g[tt >= 17.5] = 0
L *= g; R *= g
mx = max(np.abs(L).max(), np.abs(R).max())
L /= mx / 0.7; R /= mx / 0.7
out = ROOT / 'video/audio/stems/music.wav'
sf.write(out, np.stack([L, R], 1), SR)
print('->', out)
