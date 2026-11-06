"""Música original en código para Matíca: 92 BPM, lo-fi cálido. Sin muestras: todo es síntesis.

Base: Rhodes cálido (FM de púa con campana de ataque, trémolo estéreo y saturación de cinta) +
percusión suave de madera (bombo redondo, rim de madera, bloque fantasma). Una capa por sección,
todo en la rejilla de 92 BPM y en los tiempos de la línea de tiempo amarrada a la voz:
  gancho   Rhodes filtrado que abre poco a poco; la percusión entra con el Enter
  menú     + shaker en semicorcheas (con swing)
  waffles  + bajo redondo
  pide     lift en 13.04 (subida suave + platillo) + guitarra limpia (Karplus-Strong)
  vive     + pad cálido
  23.00    respiro: la música se apaga (V sus que queda colgado)
  24.00    golpe grave + Cmaj9 larga con cola de reverb (resuelve en el end card)
Progresión: Fmaj9 | Em7 | Dm9 | Cmaj9 (dos vueltas) y Dm9 -> G13sus antes del respiro.
Salida: video/audio/stems/music_raw.wav (48 kHz estéreo, sin ducking; la mezcla ajusta niveles).
"""
import json
import subprocess
from pathlib import Path

import numpy as np
from scipy import signal

ROOT = Path(__file__).resolve().parents[1]          # matica/video
TL = json.loads((ROOT / "timeline/timeline.json").read_text())
T = TL["T"]
SR = 48000
DUR = 27.0
N = int(DUR * SR)
BPM = TL["BPM"]
BEAT = 60 / BPM
BAR = 4 * BEAT
S16 = BEAT / 4
SWING = 0.16 * S16                                   # semicorcheas impares un poco tarde
rng = np.random.default_rng(92)

L = np.zeros(N)
R = np.zeros(N)
BUS = {k: np.zeros((2, N)) for k in ("rhodes", "drums", "shaker", "bass", "guitar", "pad", "fx")}


def tt(d):
    return np.arange(int(d * SR)) / SR


def add(bus, x, t0, gain=1.0, pan=0.0):
    i = int(round(t0 * SR))
    if i >= N or i + len(x) <= 0:
        return
    a, b = max(0, i), min(N, i + len(x))
    seg = x[a - i:b - i] * gain
    gl, gr = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    BUS[bus][0, a:b] += seg * gl * 1.4142
    BUS[bus][1, a:b] += seg * gr * 1.4142


def lp(x, fc, order=2):
    sos = signal.butter(order, min(fc, SR * 0.45), "low", fs=SR, output="sos")
    return signal.sosfilt(sos, x, axis=-1)


def hp(x, fc, order=2):
    sos = signal.butter(order, fc, "high", fs=SR, output="sos")
    return signal.sosfilt(sos, x, axis=-1)


def bp(x, f1, f2, order=2):
    sos = signal.butter(order, [f1, min(f2, SR * 0.45)], "band", fs=SR, output="sos")
    return signal.sosfilt(sos, x, axis=-1)


def hz(name):
    names = {"C": 0, "C#": 1, "D": 2, "D#": 3, "E": 4, "F": 5, "F#": 6, "G": 7, "G#": 8, "A": 9, "A#": 10, "B": 11}
    n, o = name[:-1], int(name[-1])
    return 440.0 * 2 ** ((names[n] + 12 * (o + 1) - 69) / 12)


def swing(t):
    """corre las semicorcheas impares (swing lo-fi)"""
    k = round(t / S16)
    return t + (SWING if k % 2 else 0.0)


def reverb_ir(d=1.6, decay=0.5, seed=4, tone=6000):
    g = np.random.default_rng(seed)
    t = tt(d)
    irl = lp(g.standard_normal(len(t)) * np.exp(-t / decay), tone)
    irr = lp(g.standard_normal(len(t)) * np.exp(-t / decay), tone)
    s = np.sqrt(np.sum(irl ** 2))
    return irl / s, irr / s


# ---------- instrumentos ----------
def rhodes(f, d, vel=0.8):
    """piano eléctrico: púa FM 1:1 con índice que decae, campana de ataque y cuerpo"""
    t = tt(d)
    idx = 1.7 * vel * np.exp(-t / 0.30) + 0.22
    car = np.sin(2 * np.pi * f * t + idx * np.sin(2 * np.pi * f * t))
    bell = np.sin(2 * np.pi * f * 7.03 * t) * np.exp(-t / 0.010) * 0.22 * vel
    body = 0.16 * np.sin(2 * np.pi * 2 * f * t) * np.exp(-t / 0.5)
    amp = np.exp(-t / (1.3 + 180 / f))
    att = np.clip(t / 0.003, 0, 1)
    rel = np.clip((d - t) / 0.10, 0, 1)
    return ((car + body) * amp + bell) * att * rel * vel


def chord_rhodes(notes, t0, d, vel=0.75, strum=0.012, gain=1.0):
    for j, n in enumerate(notes):
        add("rhodes", rhodes(hz(n), d, vel * (0.92 + 0.08 * ((j * 7) % 3) / 2)), t0 + j * strum, gain / len(notes) ** 0.5, -0.25 + 0.5 * j / max(1, len(notes) - 1))


def kick(soft=1.0):
    t = tt(0.36)
    f = 50 + 70 * np.exp(-t / 0.030)
    ph = 2 * np.pi * np.cumsum(f) / SR
    x = np.sin(ph) * np.exp(-t / 0.15)
    x += 0.08 * lp(rng.standard_normal(len(t)), 1800) * np.exp(-t / 0.004)
    return np.tanh(1.3 * x * soft) / np.tanh(1.3)


def rim():
    """rim de madera: resonancias afinadas + transitorio"""
    t = tt(0.16)
    x = (np.sin(2 * np.pi * 820 * t) * np.exp(-t / 0.030) + 0.7 * np.sin(2 * np.pi * 1310 * t) * np.exp(-t / 0.020)
         + 0.4 * np.sin(2 * np.pi * 2080 * t) * np.exp(-t / 0.012))
    x += 0.55 * bp(rng.standard_normal(len(t)), 1800, 5200) * np.exp(-t / 0.006)
    return x * 0.6


def wood_ghost():
    t = tt(0.09)
    x = np.sin(2 * np.pi * 1120 * t) * np.exp(-t / 0.018) + 0.5 * np.sin(2 * np.pi * 1730 * t) * np.exp(-t / 0.012)
    return x * 0.35


def snap():
    t = tt(0.20)
    return bp(rng.standard_normal(len(t)), 1300, 4200) * (np.exp(-t / 0.045) + 0.4 * np.exp(-np.maximum(t - 0.008, 0) / 0.030) * (t > 0.008)) * 0.45


def shaker(vel):
    t = tt(0.085)
    env = np.clip(t / 0.007, 0, 1) * np.exp(-np.maximum(t - 0.007, 0) / 0.030)
    return bp(rng.standard_normal(len(t)), 4800, 12000) * env * vel


def bass(f, d):
    t = tt(d)
    x = np.sin(2 * np.pi * f * t) + 0.22 * np.sin(2 * np.pi * 2 * f * t) + 0.06 * np.sin(2 * np.pi * 3 * f * t)
    x = np.tanh(1.4 * x) / np.tanh(1.4)
    env = np.clip(t / 0.008, 0, 1) * (0.72 + 0.28 * np.exp(-t / 0.18)) * np.clip((d - t) / 0.05, 0, 1)
    return lp(x * env, 700)


def pluck(f, d, bright=0.55):
    n = int(d * SR)
    p = max(2, int(round(SR / f)))
    buf = lp(rng.uniform(-1, 1, p * 4), 2400 + 3600 * bright)[-p:]
    out = np.zeros(n)
    fb = 0.4985 * (0.994 + 0.005 * bright)
    i = 0
    while i < n:                                     # Karplus-Strong por bloques de un periodo
        m = min(p, n - i)
        out[i:i + m] = buf[:m]
        nb = fb * (buf + np.roll(buf, -1))
        buf = nb
        i += m
    t = np.arange(n) / SR
    return hp(out, 120) * np.clip(t / 0.002, 0, 1) * np.clip((d - t) / 0.06, 0, 1)


def pad(notes, d):
    t = tt(d)
    out = np.zeros(len(t))
    for n in notes:
        f = hz(n)
        for det in (-0.0045, 0.0, 0.004):
            ph = 2 * np.pi * f * (1 + det) * t + rng.uniform(0, 6.28)
            out += (2 / np.pi) * sum(((-1) ** (k + 1)) * np.sin(k * ph) / k for k in range(1, 14) if f * k < 9000)
    out = lp(out, 900, 2)
    env = np.clip(t / 0.9, 0, 1) ** 1.5 * np.clip((d - t) / 0.8, 0, 1)
    return out * env / (len(notes) * 3)


# ---------- arreglo ----------
bar = lambda m: m * BAR
VOICE = {
    "Fmaj9": ["F3", "A3", "C4", "E4", "G4"], "Em7": ["E3", "G3", "B3", "D4", "F#4"], "Dm9": ["D3", "F3", "A3", "C4", "E4"],
    "Cmaj9": ["C3", "E3", "G3", "B3", "D4"], "G13sus": ["F3", "A3", "C4", "E4"],
}
ROOT_N = {"Fmaj9": "F2", "Em7": "E2", "Dm9": "D2", "Cmaj9": "C2", "G13sus": "G2"}
FIFTH = {"Fmaj9": "C3", "Em7": "B2", "Dm9": "A2", "Cmaj9": "G2", "G13sus": "D3"}
PROG = ["Fmaj9", "Em7", "Dm9", "Cmaj9"] * 2
BREATH = T["breath"]
HIT = T["hit24"]
ENTER = T["enter"]


def chord_at(t):
    m = int(t // BAR)
    if m < 8:
        return PROG[m]
    return "Dm9" if (t - bar(8)) < 2 * BEAT else "G13sus"


# golpe en f0: madera grave y suave con el primer acorde
t = tt(1.2)
hit0 = np.sin(2 * np.pi * np.cumsum(44 + 70 * np.exp(-t / 0.05)) / SR) * np.exp(-t / 0.40)
hit0 += 0.2 * lp(rng.standard_normal(len(t)), 700) * np.exp(-t / 0.06)
add("fx", lp(hit0, 2200), 0.0, 0.55)

# Rhodes: acorde por compás en el 1, re-ataque suave en el "y" del 2 y anticipación en el 4 "y"
for m in range(0, 9):
    t0 = bar(m)
    if t0 >= BREATH:
        break
    if m < 8:
        ch = PROG[m]
        chord_rhodes(VOICE[ch], t0, min(BAR * 0.98, BREATH - t0), 0.80, gain=0.95)
        if t0 + 1.5 * BEAT < BREATH and m >= 1:
            chord_rhodes(VOICE[ch][1:], swing(t0 + 1.5 * BEAT), 1.1 * BEAT, 0.42, 0.008, gain=0.55)
        if m >= 2 and t0 + 3.5 * BEAT < BREATH:
            nxt = PROG[m + 1] if m + 1 < 8 else "Dm9"
            chord_rhodes(VOICE[nxt][2:], swing(t0 + 3.5 * BEAT), 0.45 * BEAT, 0.36, 0.006, gain=0.40)
    else:
        chord_rhodes(VOICE["Dm9"], t0, 2 * BEAT, 0.74, gain=0.9)
        chord_rhodes(VOICE["G13sus"], t0 + 2 * BEAT, BREATH - (t0 + 2 * BEAT) + 0.02, 0.70, 0.016, gain=0.85)

# percusión de madera desde el Enter (el celular llega) hasta el respiro
k0 = int(np.ceil((ENTER - 1e-6) / S16))
for k in range(k0, int(BREATH / S16) + 1):
    tb = k * S16
    if tb >= BREATH - 0.02:
        break
    st = k % 16
    tsw = swing(tb)
    if st in (0, 10) or (st == 7 and int(tb // BAR) % 2 == 1):
        add("drums", kick(1.0 if st == 0 else 0.75), tsw, 0.62 if st == 0 else 0.42)
    if st in (4, 12):
        add("drums", rim(), tsw, 0.42, 0.10)
        add("drums", snap(), tsw + 0.004, 0.22, -0.05)
    if st in (6, 14, 15) and tb > bar(2):
        add("drums", wood_ghost(), tsw, 0.30 if st != 15 else 0.18, 0.35)
# el Enter cae con un bombo aunque no sea tiempo fuerte
add("drums", kick(0.9), ENTER, 0.50)

# shaker en el menú
k = int(np.ceil(T["tapMenu"] / S16))
while k * S16 < BREATH - 0.02:
    tb = k * S16
    vel = [0.55, 0.32, 1.0, 0.40][k % 4]
    add("shaker", shaker(vel), swing(tb), 0.16, 0.30 if k % 2 else 0.18)
    k += 1

# bajo redondo desde waffles
m = int(round(T["tapWaffles"] / BAR))
while bar(m) < BREATH:
    t0 = bar(m)
    ch = chord_at(t0)
    seq = [(0.0, ROOT_N[ch], 1.4), (1.75, ROOT_N[ch], 0.4), (2.5, FIFTH[ch], 0.7), (3.5, ROOT_N[ch], 0.4)]
    if m == 8:
        seq = [(0.0, "D2", 1.6), (2.0, "G2", 1.9)]
    for b, n, dd in seq:
        tb = t0 + b * BEAT
        if tb >= BREATH - 0.02:
            continue
        dur = min(dd * BEAT, BREATH - tb)
        add("bass", bass(hz(n), dur), swing(tb), 0.55)
    m += 1

# lift en 13.04: subida suave de ruido filtrado + platillo de escobilla
LIFT = T["lift"]
d = 1.1
noise = rng.standard_normal(int(d * SR))
out = np.zeros_like(noise)
blocks = np.array_split(np.arange(len(noise)), 44)
zi = None
for b, idx in enumerate(blocks):
    f0 = 500 * (12 ** (b / len(blocks)))
    sos = signal.butter(2, [f0, min(f0 * 2.0, 20000)], "band", fs=SR, output="sos")
    if zi is None:
        zi = signal.sosfilt_zi(sos) * 0
    y, zi = signal.sosfilt(sos, noise[idx], zi=zi)
    out[idx] = y
out *= np.linspace(0, 1, len(out)) ** 2.2
add("fx", out, LIFT - d, 0.10)
cym = hp(rng.standard_normal(int(1.6 * SR)), 4200) * np.exp(-tt(1.6) / 0.55) * np.clip(tt(1.6) / 0.004, 0, 1)
add("fx", lp(cym, 11000), LIFT, 0.07, -0.25)

# guitarra limpia desde el lift: motivo de dos compases sobre las notas del acorde
MOTIF = [  # (tiempo en beats, índice de nota del acorde desde arriba, duración en beats)
    [(0.5, 0, 0.9), (1.25, 1, 0.6), (2.0, 2, 0.9), (3.0, 1, 0.5), (3.5, 0, 0.9)],
    [(0.5, 1, 0.6), (1.0, 0, 0.9), (2.25, 2, 0.6), (2.75, 1, 0.9)],
]
GT = {"Fmaj9": ["G4", "E4", "C4", "A3"], "Em7": ["F#4", "D4", "B3", "G3"], "Dm9": ["E4", "C4", "A3", "F3"],
      "Cmaj9": ["D4", "B3", "G3", "E3"], "G13sus": ["E4", "C4", "A3", "F3"]}
gtr = np.zeros((2, N))
m = int(round(LIFT / BAR))
while bar(m) < BREATH:
    t0 = bar(m)
    for b, ni, dd in MOTIF[(m - int(round(LIFT / BAR))) % 2]:
        tb = t0 + b * BEAT
        if tb >= BREATH - 0.05:
            continue
        ch = chord_at(tb)
        x = pluck(hz(GT[ch][ni]), min(dd * BEAT + 0.35, BREATH - tb + 0.05), 0.5)
        i = int(swing(tb) * SR)
        n = min(len(x), N - i)
        gtr[0, i:i + n] += x[:n] * 0.55
        gtr[1, i:i + n] += x[:n] * 0.85
    m += 1
gtr = bp(gtr, 180, 5200)
irl, irr = reverb_ir(1.2, 0.32, 9, 5000)
wet = np.array([signal.fftconvolve(gtr[0], irl)[:N], signal.fftconvolve(gtr[1], irr)[:N]])
BUS["guitar"] += gtr * 0.8 + wet * 0.30

# pad cálido desde "así se vive"
t0 = T["scrollVive"][0]
cuts = [t0] + [bar(m) for m in range(int(t0 // BAR + 1e-9) + 1, 9)] + [bar(8) + 2 * BEAT, BREATH]
cuts = sorted({round(c, 6) for c in cuts if t0 - 1e-9 <= c <= BREATH + 1e-9})
segs = [(a, b) for a, b in zip(cuts[:-1], cuts[1:]) if b - a > 0.05]
for a, b in segs:
    ch = chord_at(a + 1e-3)
    notes = [n[:-1] + str(int(n[-1]) + 1) for n in VOICE[ch][:4]]
    x = pad(notes, b - a + 0.9)
    add("pad", x, a - 0.25, 0.42, -0.35)
    add("pad", x, a - 0.25 + 0.011, 0.42, 0.35)

# trémolo estéreo del Rhodes y cinta (saturación suave + paso bajo)
tv = np.arange(N) / SR
trem = 0.12 * np.sin(2 * np.pi * 4.4 * tv)
BUS["rhodes"][0] *= 1 + trem
BUS["rhodes"][1] *= 1 - trem
# el gancho llega filtrado y abre hacia el Enter
open_k = np.clip(tv / max(ENTER, 1e-3), 0, 1)
blocks = np.array_split(np.arange(int(ENTER * SR) + int(0.3 * SR)), 40)
rh = BUS["rhodes"].copy()
for ch in range(2):
    zi = None
    for idx in blocks:
        fc = 700 * (8 ** open_k[idx[0]])
        sos = signal.butter(2, min(fc, 20000), "low", fs=SR, output="sos")
        if zi is None:
            zi = signal.sosfilt_zi(sos) * 0
        y, zi = signal.sosfilt(sos, rh[ch, idx], zi=zi)
        rh[ch, idx] = y
BUS["rhodes"] = np.tanh(1.25 * lp(rh, 5200)) / np.tanh(1.25)

# niveles relativos de cada capa
GAIN = {"rhodes": 0.78, "drums": 0.62, "shaker": 0.55, "bass": 0.62, "guitar": 0.40, "pad": 0.36, "fx": 0.85}
mix = sum(BUS[k] * g for k, g in GAIN.items())

# sala suave para todo
irl, irr = reverb_ir(1.0, 0.22, 2, 5200)
mix = mix + 0.14 * np.array([signal.fftconvolve(mix[0], irl)[:N], signal.fftconvolve(mix[1], irr)[:N]])

# respiro: la música se apaga en 23.00 (caída corta), nada hasta el golpe de 24.00
gate = np.ones(N)
ramp = np.clip((tv - BREATH) / 0.08, 0, 1)
gate = np.where(tv >= BREATH, 1 - ramp, gate)
gate[tv >= HIT] = 0.0
mix *= gate

# 24.00: golpe grave + Cmaj9 larga (resuelve el G13sus) con cola de reverb hasta el final
end = np.zeros((2, N))
t = tt(DUR - HIT)
low = np.sin(2 * np.pi * np.cumsum(38 + 52 * np.exp(-t / 0.09)) / SR) * np.exp(-t / 0.85)
low += 0.14 * lp(rng.standard_normal(len(t)), 600) * np.exp(-t / 0.07)
i = int(HIT * SR)
n = min(len(low), N - i)
end[0, i:i + n] += low[:n] * 0.70
end[1, i:i + n] += low[:n] * 0.70
save = {k: BUS[k] for k in BUS}
BUS["rhodes"] = np.zeros((2, N))
chord_rhodes(["C3", "E3", "G3", "B3", "D4", "E4"], HIT + 0.02, DUR - HIT - 0.05, 0.78, 0.018, gain=1.0)
add("rhodes", bass(hz("C2"), DUR - HIT - 0.2), HIT, 0.55)
endr = np.tanh(1.2 * lp(BUS["rhodes"], 5200)) / np.tanh(1.2)
end += endr * GAIN["rhodes"]
irl, irr = reverb_ir(2.6, 0.95, 5, 4500)
end = end + 0.28 * np.array([signal.fftconvolve(end[0], irl)[:N], signal.fftconvolve(end[1], irr)[:N]])
end *= np.clip((DUR - tv) / 0.9, 0, 1)              # cola que se va antes del último cuadro
mix += end

mix /= max(1e-9, np.abs(mix).max()) / 0.7
out = ROOT / "audio/stems/music_raw.wav"
out.parent.mkdir(parents=True, exist_ok=True)
subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "f32le", "-ar", str(SR), "-ac", "2", "-i", "-", "-c:a", "pcm_s24le", str(out)],
               input=mix.T.astype(np.float32).tobytes(), check=True)
print("música", out, f"{DUR} s", "capas:", ", ".join(GAIN))
