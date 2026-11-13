"""Musica original en codigo para Colors Boutique. 120 BPM exactos, compas = 2.0 s, 18 s.
Floral y elegante: arpa (cuerda pulsada), celesta, pizzicato, cuerdas suaves. Sin muestras.
Una capa nueva por seccion; lift en la revelacion del telefono (3.0 s); respiro 14-16 s; golpe grave en 16.0 s.
Salida: video/audio/stems/music_raw.wav (48 kHz estereo)
"""
import subprocess
from pathlib import Path

import numpy as np
from scipy import signal

ROOT = Path(__file__).resolve().parents[2]
SR, DUR, BEAT = 48000, 18.0, 0.5
N = int(DUR * SR)
rng = np.random.default_rng(11)
L, R = np.zeros(N + SR * 4), np.zeros(N + SR * 4)
SEND = np.zeros(N + SR * 4)          # envio a reverb (mono)
midi = lambda n: 440.0 * 2 ** ((n - 69) / 12)
tt = lambda d: np.arange(int(d * SR)) / SR


def put(x, t0, gain=1.0, pan=0.0, send=0.25):
    i = int(round(t0 * SR)); x = x * gain
    L[i:i + len(x)] += x * np.cos((pan + 1) * np.pi / 4); R[i:i + len(x)] += x * np.sin((pan + 1) * np.pi / 4)
    SEND[i:i + len(x)] += x * send


def pluck(f, dur, bright=0.5, seed=0):                 # Karplus-Strong: arpa y pizzicato
    n = int(SR / f); g = np.random.default_rng(seed)
    buf = g.uniform(-1, 1, n); buf = signal.lfilter([1 - bright * 0.6], [1, -bright * 0.6], buf)
    out = np.empty(int(dur * SR)); damp = 0.996 - 0.0016 * (f / 440)
    y = signal.lfilter([0.5 * damp, 0.5 * damp], [1], np.zeros(1))
    # lazo vectorizado por periodos
    cur = buf.copy(); pos = 0
    while pos < len(out):
        m = min(n, len(out) - pos); out[pos:pos + m] = cur[:m]; pos += m
        cur = damp * 0.5 * (cur + np.roll(cur, 1))
    t = tt(dur); return out * np.minimum(1, t / 0.002)


def celesta(f, dur):
    t = tt(dur)
    x = np.sin(2 * np.pi * f * t) * np.exp(-t / 0.55) + 0.45 * np.sin(2 * np.pi * 2 * f * t) * np.exp(-t / 0.30) \
        + 0.22 * np.sin(2 * np.pi * 4.07 * f * t) * np.exp(-t / 0.09) + 0.10 * np.sin(2 * np.pi * 6.3 * f * t) * np.exp(-t / 0.04)
    return x * np.minimum(1, t / 0.003)


def strings(f, dur, att=0.6, rel=0.7, voices=5, seed=0):
    t = tt(dur + rel); g = np.random.default_rng(seed); x = np.zeros(len(t))
    for v in range(voices):
        det = 2 ** (g.uniform(-9, 9) / 1200); ph = g.uniform(0, 6.28)
        vib = 1 + 0.0035 * np.sin(2 * np.pi * (4.6 + g.uniform(-0.6, 0.6)) * t + ph)
        p = 2 * np.pi * np.cumsum(f * det * vib) / SR + ph
        for h in range(1, 9): x += np.sin(h * p) / h ** 1.25
    x = signal.sosfilt(signal.butter(2, min(6000, f * 5.5), 'low', fs=SR, output='sos'), x) / voices
    env = np.minimum(1, t / att) ** 1.5 * np.minimum(1, np.maximum(0, (dur + rel - t) / rel))
    return x * env


def sub_hit(dur=1.6, f0=62, f1=36):
    t = tt(dur); f = f1 + (f0 - f1) * np.exp(-t / 0.10)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.5)
    click = signal.sosfilt(signal.butter(2, [900, 5000], 'band', fs=SR, output='sos'), rng.standard_normal(len(t))) * np.exp(-t / 0.006) * 0.25
    return np.tanh(1.6 * x) * 0.9 + click


def kick(dur=0.32):
    t = tt(dur); f = 46 + 70 * np.exp(-t / 0.028)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.12)


def shaker(dur=0.09, seed=0):
    t = tt(dur); g = np.random.default_rng(seed)
    return signal.sosfilt(signal.butter(2, [5200, 11000], 'band', fs=SR, output='sos'), g.standard_normal(len(t))) * np.exp(-t / 0.022) * np.minimum(1, t / 0.004)


# ---- armonia: Re mayor, un acorde por compas (2 s) ----
CH = {  # bajo, notas del arpegio (MIDI)
    'D': (38, [62, 66, 69, 73, 74, 78]), 'Bm': (35, [59, 62, 66, 69, 71, 74]), 'G': (43, [59, 62, 67, 71, 74, 79]),
    'A': (45, [57, 61, 64, 69, 73, 76]), 'Asus': (45, [57, 62, 64, 69, 74, 76]), 'F#m': (42, [57, 61, 66, 69, 73, 78]),
}
BARS = ['D', 'Bm', 'G', 'A', 'D', 'F#m', 'G', 'Asus', 'D']          # compas 7 (14-16 s) es el respiro
ARP = [0, 2, 3, 4, 5, 4, 3, 2]                                       # corcheas

for b, name in enumerate(BARS):
    t0 = b * 2.0; bass, notes = CH[name]
    breath, end = b == 7, b == 8
    # arpa: desde 0.5 s
    for k in range(8):
        t = t0 + k * 0.25
        if t < 0.5 or end: continue
        if breath and k % 2: continue                                 # respiro: a negras
        n = notes[ARP[k]]; vel = (0.62 if k % 2 else 0.8) * (0.7 if breath else 1.0) * (1.25 if t < 2 else 1)
        put(pluck(midi(n), 1.9, 0.55, seed=b * 8 + k), t, 0.30 * vel, pan=-0.35 + 0.1 * (ARP[k] - 2), send=0.45)
    # pizzicato (bajo): desde 2.0 s
    if b >= 1 and not breath and not end:
        for k, (bt, n) in enumerate([(0, bass), (1, bass + 12), (2, bass + 7), (3, bass + 12)]):
            put(signal.sosfilt(signal.butter(2, 900, 'low', fs=SR, output='sos'), pluck(midi(n), 0.9, 0.2, seed=300 + b * 4 + k)), t0 + bt * BEAT, 0.5 if bt == 0 else 0.34, pan=0.05, send=0.12)
    # cuerdas: lift en 3.0 s (entran con crescendo desde 2.0)
    if b >= 1 and not end:
        g = 0.05 if b == 1 else (0.085 if b < 4 else 0.105)
        if breath: g = 0.075
        st = t0 + (1.0 if b == 1 else 0)
        for j, n in enumerate([notes[0], notes[2], notes[3]] + ([notes[5]] if b >= 4 else [])):
            put(strings(midi(n), t0 + 2.0 - st - 0.1, att=0.9 if b == 1 else 0.35, seed=b * 5 + j), st, g, pan=[-0.5, 0.4, -0.15, 0.55][j], send=0.5)
    # kick suave en cada beat desde 3.0 s (no en el respiro)
    for bt in range(4):
        t = t0 + bt * BEAT
        if t >= 3.0 and not breath and not end: put(kick(), t, 0.42 if bt % 2 == 0 else 0.34, send=0.02)
    # shaker en corcheas desde 6.0 s
    if 3 <= b <= 6:
        for k in range(8): put(shaker(seed=b * 8 + k), t0 + k * 0.25, 0.05 if k % 2 == 0 else 0.085, pan=0.5, send=0.1)

# celesta: motivo desde 6.0 s (capa nueva), con respuesta una octava arriba desde 10.0 s
MOT = {3: [(0, 78), (1, 81), (2, 85), (3, 81)], 4: [(0, 86), (1.5, 81), (2, 78), (3, 81)], 5: [(0, 85), (1, 81), (2, 78), (3, 73)],
       6: [(0, 79), (1, 83), (2, 86), (3, 91)], 7: [(0, 88), (2, 86)], 2: [(2, 74), (3, 78)]}
for b, seq in MOT.items():
    for bt, n in seq:
        put(celesta(midi(n), 1.4), b * 2.0 + bt * BEAT, 0.085 if b != 7 else 0.07, pan=0.3, send=0.6)
        if b in (5, 6): put(celesta(midi(n + 12), 1.0), b * 2.0 + bt * BEAT + 0.25, 0.035, pan=-0.3, send=0.7)

# golpes graves: f0 y corte final (16.0 s); glissando de arpa hacia el end card; acorde final
put(sub_hit(), 0.0, 0.85, send=0.05)
put(sub_hit(2.0, 58, 34), 16.0, 0.95, send=0.06)
for k, n in enumerate([62, 66, 69, 74, 78, 81, 86, 90]):
    put(pluck(midi(n), 2.2, 0.6, seed=900 + k), 15.56 + k * 0.055, 0.2 + 0.012 * k, pan=-0.5 + k * 0.14, send=0.6)
for j, n in enumerate([50, 62, 66, 69, 74]):
    put(strings(midi(n), 1.5, att=0.05, rel=0.6, seed=70 + j), 16.0, 0.09, pan=[-0.2, -0.5, 0.4, 0.0, 0.5][j], send=0.6)
put(celesta(midi(86), 1.8), 16.0, 0.10, pan=0.2, send=0.7); put(celesta(midi(90), 1.6), 16.5, 0.07, pan=-0.2, send=0.7)
put(celesta(midi(93), 1.4), 17.0, 0.055, pan=0.25, send=0.7)

# reverb de sala (respuesta sintetica) y salida
def ir(seed, dur=1.9):
    t = tt(dur); g = np.random.default_rng(seed)
    x = g.standard_normal(len(t)) * np.exp(-t / 0.42); x[: int(0.012 * SR)] *= 0.2
    return signal.sosfilt(signal.butter(2, [240, 6500], 'band', fs=SR, output='sos'), x)
wetL = signal.fftconvolve(SEND, ir(1))[: len(L)]; wetR = signal.fftconvolve(SEND, ir(2))[: len(R)]
k = 0.045
out = np.vstack([L + wetL * k, R + wetR * k])[:, :N]
fade = int(0.35 * SR); out[:, -fade:] *= np.linspace(1, 0, fade) ** 1.5
out /= np.abs(out).max() / 0.8
(ROOT / 'video/audio/stems').mkdir(parents=True, exist_ok=True)
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', str(SR), '-ac', '2', '-i', '-', '-c:a', 'pcm_s24le', str(ROOT / 'video/audio/stems/music_raw.wav')],
               input=out.T.astype(np.float32).tobytes(), check=True)
print('musica', out.shape, 'pico', round(float(np.abs(out).max()), 3))
