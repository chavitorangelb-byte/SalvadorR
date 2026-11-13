"""Musica original en codigo para Adara Pastelería. 120 BPM (compas = 2.0 s), Fa mayor. Todo es sintesis.

Progresion por compas: Fa - Rem - Sib - Do (se repite).
Capas por seccion (horas de la linea de tiempo):
  0.00        golpe grave (sub) + destello de celesta
  0.50        celesta en arpegio + colchon suave
  3.00        lift: entra el pizzicato, el bajo redondo y un bombo suave en cada beat (las fichas se estampan en el kick)
  6.00        + palmas suaves en 2 y 4
  8.00        + shaker en corcheas
  10.50       todo junto
  14.00-16.00 boton de WhatsApp: se mantiene
  16.00       se adelgaza; 18.40-19.00 respiro (solo la cola del colchon)
  19.00       golpe grave + acorde final con cola hasta 22 s
Salida: audio/stems/music_raw.wav (48 kHz estereo, sin ducking; la mezcla ajusta niveles).
"""
from pathlib import Path

import numpy as np
from scipy import signal

V = Path(__file__).resolve().parents[1]
SR = 48000
DUR = 22.0
N = int(DUR * SR)
BEAT = 0.5
rng = np.random.default_rng(7)
L = np.zeros(N)
R = np.zeros(N)


def tt(d):
    return np.arange(int(d * SR)) / SR


def add(x, t0, gain=1.0, pan=0.0):
    i = int(round(t0 * SR))
    if i >= N:
        return
    a, b = max(0, i), min(N, i + len(x))
    seg = x[a - i:b - i] * gain
    L[a:b] += seg * np.cos((pan + 1) * np.pi / 4) * 1.4142
    R[a:b] += seg * np.sin((pan + 1) * np.pi / 4) * 1.4142


def lp(x, fc, order=2):
    return signal.sosfilt(signal.butter(order, min(fc, SR * 0.45), "low", fs=SR, output="sos"), x)


def hp(x, fc, order=2):
    return signal.sosfilt(signal.butter(order, fc, "high", fs=SR, output="sos"), x)


def midi(n):
    return 440.0 * 2 ** ((n - 69) / 12)


def celesta(f, d=1.6):
    t = tt(d)
    idx = 1.4 * np.exp(-t * 7)
    y = np.sin(2 * np.pi * f * t + idx * np.sin(2 * np.pi * f * 3.5 * t))
    y += 0.25 * np.sin(2 * np.pi * f * 4.0 * t) * np.exp(-t * 9)
    env = np.exp(-t * 3.2) * np.minimum(1, t / 0.002)
    return y * env


def pizz(f, d=0.5):
    n = int(SR / f)
    buf = rng.uniform(-1, 1, n)
    buf = lp(buf, 2500)
    out = np.zeros(int(d * SR))
    for i in range(len(out)):
        out[i] = buf[i % n]
        buf[i % n] = 0.5 * (buf[i % n] + buf[(i + 1) % n]) * 0.994
    t = tt(d)
    return lp(out, 3200) * np.exp(-t * 7) * np.minimum(1, t / 0.003)


def bass(f, d=0.9):
    t = tt(d)
    y = np.sin(2 * np.pi * f * t) + 0.18 * np.sin(2 * np.pi * 2 * f * t)
    y = np.tanh(1.4 * y) / np.tanh(1.4)
    env = np.minimum(1, t / 0.008) * np.exp(-t * 2.2)
    return lp(y, 900) * env


def kick(d=0.32):
    t = tt(d)
    f = 48 + 70 * np.exp(-t * 28)
    ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) * np.exp(-t * 9) * np.minimum(1, t / 0.002)


def clap(d=0.25):
    t = tt(d)
    n = rng.normal(0, 1, len(t))
    env = np.zeros_like(t)
    for k, o in enumerate([0, 0.011, 0.022]):
        env += (t >= o) * np.exp(-np.maximum(0, t - o) * (60 if k < 2 else 16))
    y = signal.sosfilt(signal.butter(2, [900, 4200], "band", fs=SR, output="sos"), n * env)
    return y


def shaker(d=0.09):
    t = tt(d)
    return hp(rng.normal(0, 1, len(t)), 6000) * np.exp(-t * 55) * np.minimum(1, t / 0.004)


def pad(freqs, d):
    t = tt(d)
    y = np.zeros_like(t)
    for f in freqs:
        for det in (-0.12, 0.0, 0.13):
            ff = f * 2 ** (det / 12)
            y += signal.sawtooth(2 * np.pi * ff * t + rng.uniform(0, 6))
    y = lp(y / (len(freqs) * 3), 1400)
    env = np.minimum(1, t / 0.35) * np.minimum(1, (d - t) / 0.4)
    return y * env


def sub_hit(d=1.6):
    t = tt(d)
    f = 38 + 40 * np.exp(-t * 9)
    ph = 2 * np.pi * np.cumsum(f) / SR
    body = np.sin(ph) * np.exp(-t * 2.4)
    click = lp(rng.normal(0, 1, len(t)), 1800) * np.exp(-t * 40) * 0.5
    return (body + click) * np.minimum(1, t / 0.002)


# acordes (midi): Fa, Rem, Sib, Do
CH = [[53, 57, 60, 65], [50, 53, 57, 62], [46, 50, 53, 58], [48, 52, 55, 60]]
ROOT = [41, 38, 46 - 12, 36]
ARP = [[65, 69, 72, 77, 72, 69, 72, 76], [62, 65, 69, 74, 69, 65, 69, 72], [58, 62, 65, 70, 65, 62, 65, 69], [60, 64, 67, 72, 67, 64, 67, 70]]

# golpe inicial
add(sub_hit(), 0.0, 0.95)
add(celesta(midi(89), 1.2), 0.0, 0.35, 0.3)
add(celesta(midi(84), 1.2), 0.47, 0.30, -0.3)

for bar in range(11):                       # 11 compases x 2 s = 22 s
    t0 = bar * 2.0
    c = bar % 4
    if t0 >= 19.0:
        break
    breath = 18.4 <= t0 + 2.0 and t0 >= 16.0
    # colchon (desde 0.5 s)
    if t0 + 2.0 > 0.5:
        st = max(t0, 0.5)
        dur = 2.0 - (st - t0) + (0.05 if t0 + 2 < 18 else 0)
        if t0 >= 18.0:
            dur = 1.0
        add(pad([midi(n) for n in CH[c]], dur + 0.4), st, 0.18 if t0 < 16 else 0.13)
    # celesta en corcheas
    for k in range(8):
        tk = t0 + k * 0.25
        if tk < 0.5 or tk >= 18.4:
            continue
        if 16.0 <= tk and k % 2:
            continue
        add(celesta(midi(ARP[c][k])), tk, 0.16 if k % 2 else 0.22, 0.4 * np.sin(k))
    # pizzicato (desde 3 s)
    if t0 >= 2.0:
        for k, n in enumerate([CH[c][0] + 12, CH[c][2] + 12, CH[c][1] + 12, CH[c][3] + 12]):
            tk = t0 + k * 0.5 + 0.25
            if 3.0 <= tk < 16.0:
                add(pizz(midi(n)), tk, 0.33, -0.35 if k % 2 else 0.35)
    # bajo redondo + bombo suave en cada beat (desde 3 s)
    for k in range(4):
        tk = t0 + k * 0.5
        if 3.0 <= tk < 16.0 or (16.0 <= tk < 18.4 and k % 2 == 0):
            add(kick(), tk, 0.55 if tk < 16 else 0.35)
        if 3.0 <= tk < 18.4 and k in (0, 2, 3):
            add(bass(midi(ROOT[c] + (7 if k == 3 else 0)), 0.45 if k == 3 else 0.9), tk, 0.42)
    # palmas en 2 y 4 (desde 6 s)
    for k in (1, 3):
        tk = t0 + k * 0.5
        if 6.0 <= tk < 16.0:
            add(clap(), tk, 0.22, 0.15)
    # shaker en corcheas (desde 8 s)
    for k in range(8):
        tk = t0 + k * 0.25
        if 8.0 <= tk < 16.0:
            add(shaker(), tk, 0.10 if k % 2 else 0.06, 0.5)

# lift a los 3.00 s: subida de ruido filtrado y destello
t = tt(1.0)
rise = hp(rng.normal(0, 1, len(t)), 3000) * (t / 1.0) ** 2.5 * 0.10
add(rise, 2.0, 1.0)
add(celesta(midi(77), 1.4), 3.0, 0.3, 0.2)

# respiro 18.4-19.0: solo cola. Final: golpe grave + acorde Fa con cola hasta el final
add(sub_hit(2.6), 19.0, 1.0)
for i, n in enumerate([53, 60, 65, 69, 72]):
    add(celesta(midi(n + 12), 2.9), 19.0 + i * 0.03, 0.18, -0.4 + i * 0.2)
add(pad([midi(n) for n in [53, 57, 60, 65]], 2.95), 19.02, 0.16)

# reverberacion corta (FDN simple) para unir
def verb(x, mix=0.18):
    y = np.zeros_like(x)
    for dly, g in [(0.029, 0.5), (0.037, 0.45), (0.041, 0.42), (0.053, 0.38)]:
        d = int(dly * SR)
        b = np.zeros(d + 1); b[0] = 1
        a = np.zeros(d + 1); a[0] = 1; a[d] = -g
        y += signal.lfilter(b, a, x)
    return x + mix * lp(y / 4, 6000)


L, R = verb(L), verb(R)
fade = np.ones(N)
fade[-int(0.25 * SR):] = np.linspace(1, 0, int(0.25 * SR))
out = np.vstack([L, R]) * fade
out /= np.abs(out).max() / 0.7
(V / "audio/stems").mkdir(parents=True, exist_ok=True)
import subprocess
subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "f32le", "-ar", str(SR), "-ac", "2", "-i", "-", "-c:a", "pcm_s24le",
                str(V / "audio/stems/music_raw.wav")], input=out.T.astype(np.float32).tobytes(), check=True)
print("musica lista", out.shape[1] / SR, "s")
