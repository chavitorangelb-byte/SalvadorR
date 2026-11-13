"""Música original de Babkery, hecha en código (numpy). 120 BPM, 4/4, compás = 2.0 s.
Fa mayor con color de jazz suave: marimba, bajo redondo, escobillas, pizzicato, pad tibio y campanitas.
Una capa nueva por sección; respiro de medio segundo antes del end card y cola tibia al final.
Salida: video/audio/stems/music_raw.wav (48 kHz, estéreo)."""
import json, subprocess
from pathlib import Path
import numpy as np
from scipy import signal

V = Path(__file__).resolve().parents[1]
TL = json.loads((V / 'timeline/timeline.json').read_text())
SR, DUR = 48000, TL['dur']
N = int(DUR * SR)
BEAT = 0.5
rng = np.random.default_rng(11)
out = np.zeros((2, N))

def midi(m): return 440.0 * 2 ** ((m - 69) / 12)
def env_adsr(n, a, d, s, r_len, sus_len):
    a, d, r_len = int(a * SR), int(d * SR), int(r_len * SR)
    e = np.zeros(n)
    i = 0
    seg = min(a, n); e[:seg] = np.linspace(0, 1, seg, endpoint=False); i = seg
    seg = min(d, n - i); e[i:i + seg] = np.linspace(1, s, seg, endpoint=False); i += seg
    hold = min(int(sus_len * SR), n - i); e[i:i + hold] = s; i += hold
    seg = min(r_len, n - i); e[i:i + seg] = np.linspace(s, 0, seg); i += seg
    return e
def add(x, t, gain=1.0, pan=0.0):
    i = int(round(t * SR))
    if i >= N: return
    x = x[: N - i]
    l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    out[0, i:i + len(x)] += x * gain * l * 1.414
    out[1, i:i + len(x)] += x * gain * r * 1.414
def tt(dur): return np.arange(int(dur * SR)) / SR

# armonía: un acorde por compás (2 s)
CHORDS = [  # (bajo, notas del acorde)
    (41, [57, 60, 64, 67]),   # Fmaj9  (A C E G)
    (38, [57, 60, 64, 65]),   # Dm9    (A C E F)
    (46, [57, 62, 65, 69]),   # Bbmaj7 (A D F A)
    (36, [58, 62, 64, 67]),   # C9sus  (Bb D E G)
    (41, [57, 60, 64, 67]),
    (38, [57, 60, 64, 65]),
    (46, [57, 62, 65, 69]),
    (36, [58, 62, 64, 67]),
    (41, [57, 60, 64, 67]),
    (41, [57, 60, 64, 67]),
]
def chord(t): return CHORDS[min(len(CHORDS) - 1, int(t // 2.0))]

# --- instrumentos ---
def kick(g=1.0):
    x = tt(0.35); f = 48 + 70 * np.exp(-x / 0.035)
    ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) * np.exp(-x / 0.16) * g
def bass(m, dur):
    x = tt(dur); f = midi(m)
    y = np.sin(2 * np.pi * f * x) + 0.25 * np.sin(4 * np.pi * f * x) + 0.08 * np.sin(6 * np.pi * f * x)
    y = np.tanh(1.3 * y) / np.tanh(1.3)
    return y * env_adsr(len(x), 0.008, 0.12, 0.65, 0.12, dur - 0.25)
def marimba(m, dur=0.9):
    x = tt(dur); f = midi(m)
    y = (np.sin(2 * np.pi * f * x) * np.exp(-x / 0.42) + 0.35 * np.sin(2 * np.pi * f * 3.93 * x) * np.exp(-x / 0.07)
         + 0.12 * np.sin(2 * np.pi * f * 9.2 * x) * np.exp(-x / 0.02))
    return y * (1 - np.exp(-x / 0.002))
def pizz(m):
    x = tt(0.5); f = midi(m)
    y = sum(np.sin(2 * np.pi * f * k * x) / k ** 1.4 for k in range(1, 6))
    return y * np.exp(-x / 0.12) * (1 - np.exp(-x / 0.003))
def brush(dur=0.22, g=1.0):
    n = rng.standard_normal(int(dur * SR))
    b, a = signal.butter(2, [2500 / (SR / 2), 9000 / (SR / 2)], 'band')
    y = signal.lfilter(b, a, n); x = tt(dur)
    return y * (np.sin(np.pi * x / dur) ** 1.5) * g
def tap(g=1.0):
    n = rng.standard_normal(int(0.06 * SR)); b, a = signal.butter(2, 4000 / (SR / 2), 'high')
    return signal.lfilter(b, a, n) * np.exp(-tt(0.06) / 0.012) * g
def pad(notes, dur, cutoff=1400):
    x = tt(dur); y = np.zeros(len(x))
    for m in notes:
        for det in (-0.08, 0.0, 0.07):
            f = midi(m + det)
            y += signal.sawtooth(2 * np.pi * f * x + rng.uniform(0, 6.28))
    b, a = signal.butter(2, cutoff / (SR / 2))
    y = signal.lfilter(b, a, y) / (3 * len(notes))
    return y * env_adsr(len(x), 0.6, 0.3, 0.85, 0.7, max(0, dur - 1.6))
def bell(m):
    x = tt(1.6); f = midi(m)
    y = (np.sin(2 * np.pi * f * x) * np.exp(-x / 0.7) + 0.5 * np.sin(2 * np.pi * f * 2.76 * x) * np.exp(-x / 0.25)
         + 0.25 * np.sin(2 * np.pi * f * 5.4 * x) * np.exp(-x / 0.1))
    return y * (1 - np.exp(-x / 0.001))
def hat(g=1.0):
    n = rng.standard_normal(int(0.05 * SR)); b, a = signal.butter(2, 7000 / (SR / 2), 'high')
    return signal.lfilter(b, a, n) * np.exp(-tt(0.05) / 0.009) * g

GAP0, GAP1 = 15.5, 16.0          # respiro antes del end card
def on(t): return not (GAP0 - 0.02 <= t < GAP1)

beats = np.arange(0, 16.0, BEAT)
# kick suave + bajo desde 0 (el kick marca el beat 1 en 0.00)
for b in beats:
    if not on(b) or b >= 14.0 and b % 2.0 != 0: continue
    beat_in_bar = int(round((b % 2.0) / BEAT))
    if beat_in_bar in (0, 2) or (12.0 <= b < 14.0):
        g = 0.9 if beat_in_bar == 0 else 0.6
        if b in (13.0, 13.5): g = 1.0                   # kicks de los pulsos del anillo
        add(kick(g), b, 0.55)
for bar in np.arange(0, 15.5, 2.0):
    root = chord(bar)[0]
    add(bass(root, 0.95), bar, 0.30)
    add(bass(root + 7 if bar < 14 else root, 0.45), bar + 1.0, 0.24)
    if bar >= 3.0: add(bass(root + 12, 0.2), bar + 1.75, 0.12)
# marimba melódica desde el cierre de la "S" (2.0)
MEL = [0, 2, 1, 3, 2, 1, 3, 0]
for i, t in enumerate(np.arange(2.0, 15.5, 0.25)):
    if not on(t): continue
    notes = chord(t)[1]
    if i % 8 in (5, 7) and t < 6: continue                # más aire al inicio
    m = notes[MEL[i % 8]] + (12 if (i // 8) % 2 else 0)
    vel = 0.9 if i % 2 == 0 else 0.55
    add(marimba(m), t, 0.16 * vel, pan=-0.25 + 0.5 * ((i * 3) % 5) / 4)
# escobillas y pizzicato desde 3.0
for b in np.arange(3.0, 15.5, BEAT):
    if not on(b): continue
    add(brush(0.24), b - 0.04, 0.045, pan=0.3)
    if int(round((b % 2.0) / BEAT)) in (1, 3): add(tap(), b, 0.05, pan=-0.2)
for t in np.arange(3.25, 15.5, 1.0):
    if not on(t): continue
    m = chord(t)[1][int(t * 2) % 4] - 12
    add(pizz(m), t, 0.10, pan=0.4)
# pad tibio y campanitas de cristal desde 6.0
for bar in np.arange(6.0, 14.0, 2.0):
    cut = 1200 if bar < 10 else 2600                        # lift: el pad abre su filtro
    add(pad(chord(bar)[1], 2.3, cut), bar - 0.15, 0.30, pan=0.0)
BELLS = [(6.05, 81), (6.53, 84), (7.5, 79), (8.9, 84), (9.6, 81), (10.4, 86), (11.1, 84), (11.5, 88)]
for t, m in BELLS: add(bell(m), t, 0.06, pan=0.35 if m % 2 else -0.35)
# lift 10–12: hats en semicorcheas
for t in np.arange(10.0, 12.0, 0.125): add(hat(0.8 if (t * 8) % 2 < 1 else 0.45), t, 0.05, pan=0.15)
# riser de 2 s (12–14)
x = tt(2.0)
n = rng.standard_normal(len(x))
b, a = signal.butter(2, [800 / (SR / 2), 6000 / (SR / 2)], 'band')
riser = signal.lfilter(b, a, n) * (x / 2.0) ** 2 * 0.5
f = 220 * 2 ** (x / 2.0 * 1.0)
riser += 0.25 * np.sin(2 * np.pi * np.cumsum(f) / SR) * (x / 2.0) ** 2
add(riser * np.where(x > 1.9, (2.0 - x) / 0.1, 1), 12.0, 0.18)
for t in np.arange(12.0, 14.0, 0.25): add(hat(0.6), t + 0.125, 0.045, pan=-0.15)
# 14–15.5: se adelgaza con el pull-back (solo pad bajo y marimba ya escrita)
add(pad([53, 57, 60, 64], 1.6, 900), 14.0, 0.22)
# end card: acorde tibio que respira desde el golpe (16.0) hasta el final
add(pad([53, 57, 60, 64, 67], DUR - 16.0 + 0.2, 1100), 16.0, 0.30)
add(bass(29, 1.8), 16.0, 0.30)
for i, m in enumerate([72, 76, 79]): add(marimba(m, 1.4), 16.3 + i * 0.18, 0.10)
# respiro: silencio musical limpio 15.5–16.0 (con fundido corto)
g = np.ones(N)
i0, i1 = int(GAP0 * SR), int(GAP1 * SR)
g[i0 - 2400:i0] = np.linspace(1, 0, 2400); g[i0:i1] = 0
out *= g
# un poco de sala: reverb corto por convolución con ruido decreciente
ir = rng.standard_normal((2, int(0.9 * SR))) * np.exp(-np.arange(int(0.9 * SR)) / SR / 0.25)
ir[:, : int(0.012 * SR)] = 0
wet = np.vstack([signal.fftconvolve(out[c], ir[c])[:N] for c in range(2)])
wet *= np.abs(out).max() / (np.abs(wet).max() + 1e-9) * 0.35
out = out + wet
fade = int(0.6 * SR); out[:, -fade:] *= np.linspace(1, 0, fade)
out /= np.abs(out).max() + 1e-9
out *= 0.7
(V / 'audio/stems').mkdir(parents=True, exist_ok=True)
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', str(SR), '-ac', '2', '-i', '-', '-c:a', 'pcm_s24le',
                str(V / 'audio/stems/music_raw.wav')], input=out.T.astype(np.float32).tobytes(), check=True)
print('música', DUR, 's')
