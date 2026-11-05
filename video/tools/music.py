"""Musica original en codigo, 96 BPM, Mi menor. Sin muestras: todo es sintesis.

Capas por seccion (tiempos de la linea de tiempo del video):
  base     bajo distorsionado suave + caja seca (+ bombo muy suave de peso)
  galeria  + hi-hat en semicorcheas
  cotiza   + sintetizador grave (pad)
  13.50    lift: subida de ruido y golpe de platillo filtrado
  ingles   + guitarra en tremolo filtrada (Karplus-Strong)
  23.00    respiro: todo se apaga
  24.00    golpe grave + nota larga con cola de reverb hasta 27 s
Salida: video/audio/stems/music_raw.wav (48 kHz estereo, sin ducking; la mezcla ajusta niveles).
"""
import json
from pathlib import Path

import numpy as np
from scipy import signal

ROOT = Path(__file__).resolve().parents[2]
TL = json.loads((ROOT / "video/timeline/timeline.json").read_text())
T = TL["T"]
SR = 48000
DUR = 27.0
N = int(DUR * SR)
BEAT = 60 / 96
S16 = BEAT / 4
rng = np.random.default_rng(23)

L = np.zeros(N)
R = np.zeros(N)


def add(x, t0, gain=1.0, pan=0.0):
    i = int(round(t0 * SR))
    if i >= N or i + len(x) <= 0:
        return
    a, b = max(0, i), min(N, i + len(x))
    seg = x[a - i:b - i] * gain
    gl, gr = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    L[a:b] += seg * gl * 1.4142
    R[a:b] += seg * gr * 1.4142


def tt(d):
    return np.arange(int(d * SR)) / SR


def saw_bl(f, d, harm_max=60):
    t = tt(d)
    y = np.zeros_like(t)
    for k in range(1, harm_max + 1):
        if f * k > SR * 0.45:
            break
        y += ((-1) ** (k + 1)) * np.sin(2 * np.pi * f * k * t) / k
    return y * (2 / np.pi)


def lp(x, fc, order=2):
    sos = signal.butter(order, min(fc, SR * 0.45), "low", fs=SR, output="sos")
    return signal.sosfilt(sos, x)


def hp(x, fc, order=2):
    sos = signal.butter(order, fc, "high", fs=SR, output="sos")
    return signal.sosfilt(sos, x)


def bp(x, f1, f2, order=2):
    sos = signal.butter(order, [f1, min(f2, SR * 0.45)], "band", fs=SR, output="sos")
    return signal.sosfilt(sos, x)


def env_adsr(d, a=0.005, dcy=0.08, s=0.6, r=0.06):
    t = tt(d)
    e = np.where(t < a, t / a, s + (1 - s) * np.exp(-(t - a) / max(dcy, 1e-4)))
    rel = np.clip((d - t) / r, 0, 1)
    return e * rel


def note_hz(name):
    names = {"C": 0, "C#": 1, "D": 2, "D#": 3, "E": 4, "F": 5, "F#": 6, "G": 7, "G#": 8, "A": 9, "A#": 10, "B": 11}
    n, o = name[:-1], int(name[-1])
    return 440.0 * 2 ** ((names[n] + 12 * (o + 1) - 69) / 12)


# ---------- instrumentos ----------
def bass(f, d, drive=2.2, bright=520):
    x = 0.8 * saw_bl(f, d, 40) + 0.6 * np.sin(2 * np.pi * f / 2 * tt(d))
    x = lp(x, bright, 2)
    x = np.tanh(drive * x) / np.tanh(drive)
    return lp(x, 2400, 2) * env_adsr(d, 0.004, 0.12, 0.55, 0.05)


def kick():
    t = tt(0.42)
    f = 45 + 75 * np.exp(-t / 0.035)
    ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) * np.exp(-t / 0.16) + 0.15 * hp(rng.standard_normal(len(t)), 2500) * np.exp(-t / 0.004)


def snare():
    t = tt(0.32)
    n = bp(rng.standard_normal(len(t)), 1400, 6500) * np.exp(-t / 0.055)
    tone = np.sin(2 * np.pi * 186 * t) * np.exp(-t / 0.028) + 0.5 * np.sin(2 * np.pi * 330 * t) * np.exp(-t / 0.018)
    return 0.9 * n + 0.55 * tone


def hat(open_=False):
    d = 0.32 if open_ else 0.06
    t = tt(d)
    return hp(rng.standard_normal(len(t)), 7200, 2) * np.exp(-t / (0.11 if open_ else 0.016))


def pad_chord(freqs, d):
    out = np.zeros(int(d * SR))
    for f in freqs:
        for det in (-0.004, 0.0, 0.0045):
            out += saw_bl(f * (1 + det), d, 30)
    out = lp(out, 820, 2)
    e = np.clip(tt(d) / 0.35, 0, 1) * np.clip((d - tt(d)) / 0.4, 0, 1)
    return out * e / (len(freqs) * 3)


def pluck(f, d, bright=0.5):
    n = int(d * SR)
    p = int(SR / f)
    buf = rng.uniform(-1, 1, p) * 0.9
    out = np.zeros(n)
    for i in range(n):
        out[i] = buf[i % p]
        buf[i % p] = 0.5 * (buf[i % p] + buf[(i + 1) % p]) * (0.992 + 0.006 * bright)
    return out


def reverb_ir(d=1.6, decay=0.5, seed=4):
    g = np.random.default_rng(seed)
    t = tt(d)
    irl = g.standard_normal(len(t)) * np.exp(-t / decay)
    irr = g.standard_normal(len(t)) * np.exp(-t / decay)
    irl, irr = lp(irl, 6000), lp(irr, 6000)
    s = np.sqrt(np.sum(irl ** 2))
    return irl / s, irr / s


# ---------- arreglo ----------
bar = lambda i: i * 4 * BEAT
CHORDS = ["E", "E", "C", "D", "E", "C", "D", "E", "C", "D", "E"]       # raiz por compas desde 2.5 s
CHORD_TONES = {"E": ["E3", "G3", "B3"], "C": ["C3", "E3", "G3"], "D": ["D3", "F#3", "A3"]}
ROOT2 = {"E": "E2", "C": "C2", "D": "D2"}
PATTERN = [1, 0, 1, 1, 0, 1, 0, 1]
END_GROOVE = T["breath"]                    # 23.0: respiro

# golpe en f0
hit0 = np.zeros(int(1.6 * SR))
t = tt(1.6)
hit0 += np.sin(2 * np.pi * np.cumsum(38 + 60 * np.exp(-t / 0.08)) / SR) * np.exp(-t / 0.55)
hit0 += 0.35 * np.tanh(3 * saw_bl(41.2, 1.6, 30)) * np.exp(-t / 0.35)
hit0 += 0.25 * lp(rng.standard_normal(len(t)), 900) * np.exp(-t / 0.12)
add(lp(hit0, 3000), 0.0, 0.62)

# dron grave del gancho que abre filtro hacia la llegada
d = 2.55
dr = saw_bl(41.2, d, 50) * 0.5 + np.sin(2 * np.pi * 82.4 * tt(d)) * 0.3
cut = np.linspace(180, 900, len(dr))
blocks = np.array_split(np.arange(len(dr)), 60)
out = np.zeros_like(dr)
zi = None
for b, idx in enumerate(blocks):
    sos = signal.butter(2, cut[idx[0]], "low", fs=SR, output="sos")
    if zi is None:
        zi = signal.sosfilt_zi(sos) * 0
    y, zi = signal.sosfilt(sos, dr[idx], zi=zi)
    out[idx] = y
out *= np.clip(tt(d) / 0.6, 0, 1) * np.clip((d - tt(d)) / 0.15, 0, 1)
add(out, 0.0, 0.22)

# groove: bajo + caja seca + bombo suave desde el compas 2 (2.5 s) hasta el respiro
for bi in range(1, 10):
    t0 = bar(bi)
    if t0 >= END_GROOVE:
        break
    ch = CHORDS[(bi - 1) % len(CHORDS)]
    closing = t0 >= 20.0
    for e in range(8):
        te = t0 + e * BEAT / 2
        if te >= END_GROOVE - 0.01:
            break
        if closing and e % 2:
            continue
        if PATTERN[e]:
            f = note_hz(ROOT2[ch]) * (2 if (e == 5 and bi % 2 == 0) else 1)
            add(bass(f, BEAT / 2 * (1.9 if closing else 0.92), bright=380 if closing else 560), te, 0.42)
    for b in range(4):
        tb = t0 + b * BEAT
        if tb >= END_GROOVE:
            break
        if b in (0, 2) and not closing:
            add(kick(), tb, 0.38)
        if b in (1, 3) and (not closing or b == 3):
            add(snare(), tb, 0.30, 0.04)

# hi-hat desde la galeria (semicorcheas con acento)
t0 = 5.625
while t0 < END_GROOVE - 0.01:
    k = round((t0 - 5.625) / S16)
    if not (20.0 <= t0 and k % 2):
        acc = 1.0 if k % 4 == 0 else (0.55 if k % 2 == 0 else 0.38)
        add(hat(), t0, 0.075 * acc * (0.7 if 16.95 <= t0 < 20.1 else 1.0), 0.25 if k % 2 else -0.15)
    t0 += S16

# sintetizador grave en la cotizacion (9.375 -> 13.5)
for bi, t0 in enumerate(np.arange(9.375, 13.5 - 0.01, 4 * BEAT / 2)):
    ch = ["E", "C", "D", "E"][bi % 4]
    dd = min(4 * BEAT / 2, 13.5 - t0)
    x = pad_chord([note_hz(n) / 2 for n in CHORD_TONES[ch]], dd + 0.3)
    add(x, t0, 0.42, -0.3)
    add(x, t0 + 0.012, 0.42, 0.3)

# lift en 13.50: subida + platillo filtrado + bajo a la octava
d = 0.9
noise = rng.standard_normal(int(d * SR))
out = np.zeros_like(noise)
zi = None
blocks = np.array_split(np.arange(len(noise)), 50)
for b, idx in enumerate(blocks):
    f0 = 300 * (20 ** (b / len(blocks)))
    sos = signal.butter(2, [f0, min(f0 * 2.2, 20000)], "band", fs=SR, output="sos")
    if zi is None:
        zi = signal.sosfilt_zi(sos) * 0
    y, zi = signal.sosfilt(sos, noise[idx], zi=zi)
    out[idx] = y
out *= np.linspace(0, 1, len(out)) ** 2
add(out, 13.5 - d, 0.20)                     # la subida termina justo en 13.50
cym = hp(rng.standard_normal(int(1.4 * SR)), 3200) * np.exp(-tt(1.4) / 0.45)
add(cym, 13.5, 0.10, -0.2)
add(bass(note_hz("E3"), 0.5, drive=3.0), 13.5, 0.30)

# guitarra en tremolo filtrada (ingles): semicorcheas sobre Em, B y G
voicing = [["E4", "B3"], ["E4", "B3"], ["D4", "A3"], ["E4", "B3"]]
t0 = 13.5
irl, irr = reverb_ir(1.3, 0.38, 9)
gl = np.zeros(int(3.7 * SR))
gr = np.zeros(int(3.7 * SR))
k = 0
while t0 < 16.95:
    vi = int((t0 - 13.5) / (2 * BEAT)) % len(voicing)
    for j, nn in enumerate(voicing[vi]):
        p = pluck(note_hz(nn), 0.25, 0.4) * (0.85 if k % 2 else 1.0)
        i = int((t0 - 13.5) * SR)
        seg = p[: max(0, min(len(p), len(gl) - i))]
        (gl if j == 0 else gr)[i:i + len(seg)] += seg
    k += 1
    t0 += S16
g = np.vstack([gl, gr])
g = np.array([bp(ch, 520, 2900) for ch in g])
fade = np.clip((16.95 - 13.5 - np.arange(g.shape[1]) / SR) / 0.5, 0, 1) * np.clip(np.arange(g.shape[1]) / SR / 0.25, 0, 1)
g *= fade
wet = np.array([signal.fftconvolve(g[0], irl)[: g.shape[1]], signal.fftconvolve(g[1], irr)[: g.shape[1]]])
g = g * 0.8 + wet * 0.35
i = int(13.5 * SR)
L[i:i + g.shape[1]] += g[0] * 0.30
R[i:i + g.shape[1]] += g[1] * 0.30

# 24.00: golpe grave + nota larga
d = 3.0
t = tt(d)
hit = np.sin(2 * np.pi * np.cumsum(36 + 54 * np.exp(-t / 0.10)) / SR) * np.exp(-t / 0.9)
hit += 0.32 * np.tanh(3.2 * saw_bl(41.2, d, 40)) * np.exp(-t / 0.5)
hit += 0.2 * lp(rng.standard_normal(len(t)), 700) * np.exp(-t / 0.09)
hit = lp(hit, 2600)
irl, irr = reverb_ir(2.4, 0.9, 5)
hl = hit + 0.25 * signal.fftconvolve(hit, irl)[: len(hit)]
hr = hit + 0.25 * signal.fftconvolve(hit, irr)[: len(hit)]
tail = np.clip((27.0 - 24.0 - t) / 0.6, 0, 1)
i = int(24.0 * SR)
n = min(len(hl), N - i)
L[i:i + n] += (hl * tail)[:n] * 0.62
R[i:i + n] += (hr * tail)[:n] * 0.62

# un poco de sala para todo lo que no es el golpe final (caja seca: casi nada)
irl, irr = reverb_ir(0.6, 0.12, 2)
mix_l = L + 0.10 * signal.fftconvolve(L, irl)[:N]
mix_r = R + 0.10 * signal.fftconvolve(R, irr)[:N]
# respiro: silencio absoluto entre 23.0 y 24.0 (con caida corta)
tv = np.arange(N) / SR
gate = np.where((tv >= T["breath"]) & (tv < 24.0), 0.0, 1.0)
ramp = np.clip((tv - T["breath"]) / 0.06, 0, 1)
gate = np.where((tv >= T["breath"]) & (tv < 24.0), 1 - ramp, gate)
mix = np.vstack([mix_l * gate, mix_r * gate])
mix /= max(1e-9, np.abs(mix).max()) / 0.7
out = ROOT / "video/audio/stems/music_raw.wav"
import subprocess  # noqa: E402
subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "f32le", "-ar", str(SR), "-ac", "2", "-i", "-", "-c:a", "pcm_s24le", str(out)],
               input=mix.T.astype(np.float32).tobytes(), check=True)
print("musica", out, mix.shape)
