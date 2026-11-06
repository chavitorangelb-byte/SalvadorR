"""Musica original en codigo para DIPROLASER. Re mayor, pulso a 84 BPM. Sin muestras: todo es sintesis.

Arco (tiempos de timeline/timeline.json, bloqueados a la voz):
  S1  piano solo, espacioso, colchon que entra
  S2  arranca el pulso (piano apagado en corcheas) + cuerdas graves
  S3  cuerdas calidas crecen; brillo al abrir la caja; GRACIAS sobre IV
  S4  crece: pulso en semicorcheas, bombo suave, bajo; un acorde por cada cambio de color
  S5  punto mas alto: ostinato de cuerdas + shaker
  S6  baja: solo piano y colchon (momento emocional)
  S7  subida corta y golpe en el logo
  S8  resolucion calida; acorde final que se sostiene hasta el fundido
Salida: audio/stems/musica_raw.wav (48 kHz estereo, sin ducking; la mezcla ajusta niveles).
"""
import json
from pathlib import Path
import numpy as np
from scipy import signal

P = Path(__file__).resolve().parents[2]
TL = json.loads((P / 'timeline/timeline.json').read_text())
WORDS = json.loads((P / 'timeline/vo_words.json').read_text())['words']
SC = {s['id']: s for s in TL['scenes']}
CUES = TL['cues']
SR = 48000
DUR = TL['duration']
N = int(DUR * SR)
BPM = 84
BEAT = 60 / BPM
rng = np.random.default_rng(11)
L = np.zeros(N); R = np.zeros(N)


def W(txt, nth=1, after=0.0):
    c = 0
    for w in WORDS:
        if w['s'] >= after and w['w'].strip('.,').lower() == txt.lower():
            c += 1
            if c == nth: return w['s']
    raise KeyError(txt)


def tt(d): return np.arange(int(d * SR)) / SR
def lp(x, fc, o=2): return signal.sosfilt(signal.butter(o, min(fc, SR * 0.45), 'low', fs=SR, output='sos'), x)
def hp(x, fc, o=2): return signal.sosfilt(signal.butter(o, fc, 'high', fs=SR, output='sos'), x)
def hz(n):
    names = {'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'E': 4, 'F': 5, 'F#': 6, 'G': 7, 'G#': 8, 'A': 9, 'A#': 10, 'B': 11}
    return 440.0 * 2 ** ((names[n[:-1]] + 12 * (int(n[-1]) + 1) - 69) / 12)


def add(x, t0, g=1.0, pan=0.0, bus=None):
    i = int(round(t0 * SR))
    if i >= N or i + len(x) <= 0: return
    a, b = max(0, i), min(N, i + len(x))
    s = x[a - i:b - i] * g
    gl, gr = np.cos((pan + 1) * np.pi / 4) * 1.4142, np.sin((pan + 1) * np.pi / 4) * 1.4142
    (bus or (L, R))[0][a:b] += s * gl
    (bus or (L, R))[1][a:b] += s * gr


# ---------------- instrumentos ----------------
def piano(f, d=3.0, vel=0.7, muted=False):
    t = tt(d)
    y = np.zeros_like(t)
    B = 0.00035
    bright = 0.6 + 0.6 * vel
    for n in range(1, 13):
        fn = f * n * np.sqrt(1 + B * n * n)
        if fn > SR * 0.42: break
        amp = (1 / n ** 1.15) * np.exp(-(n - 1) * (1.3 - bright) * 0.35)
        tau = (2.4 if not muted else 0.22) * (220 / max(f, 80)) ** 0.35 / (1 + 0.28 * n)
        y += amp * np.sin(2 * np.pi * fn * t + rng.uniform(0, 6.28)) * np.exp(-t / tau)
    att = np.clip(t / 0.003, 0, 1)
    ham = lp(rng.standard_normal(len(t)), 2500) * np.exp(-t / 0.012) * 0.08
    y = (y * att + ham) * vel
    return y * np.clip((d - t) / 0.08, 0, 1)


def saw(f, d, hmax=40):
    t = tt(d); y = np.zeros_like(t)
    for k in range(1, hmax + 1):
        if f * k > SR * 0.42: break
        y += ((-1) ** (k + 1)) * np.sin(2 * np.pi * f * k * t) / k
    return y * (2 / np.pi)


def strings(f, d, att=0.6, rel=0.9, bright=1800):
    t = tt(d + rel)
    vib = 1 + 0.0016 * np.sin(2 * np.pi * 5.1 * t + rng.uniform(0, 6))
    y = np.zeros_like(t)
    for det in (-0.006, -0.0025, 0.0, 0.003, 0.0065):
        ph = 2 * np.pi * np.cumsum(f * (1 + det) * vib) / SR
        # sierra por suma de armonicos con fase variable
        s = np.zeros_like(t)
        for k in range(1, 18):
            if f * k > SR * 0.4: break
            s += ((-1) ** (k + 1)) * np.sin(k * ph) / k
        y += s
    y = lp(y / 5, bright, 2)
    e = np.clip(t / att, 0, 1) ** 1.5 * np.clip((d + rel - t) / rel, 0, 1)
    return y * e


def bass(f, d):
    t = tt(d)
    y = np.sin(2 * np.pi * f * t) + 0.25 * lp(saw(f, d, 12), 400)
    return y * np.clip(t / 0.02, 0, 1) * np.clip((d - t) / 0.12, 0, 1)


def kick_soft():
    t = tt(0.5)
    f = 48 + 50 * np.exp(-t / 0.04)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.2)


def shaker():
    t = tt(0.09)
    return hp(rng.standard_normal(len(t)), 6000) * np.exp(-t / 0.025) * np.clip(t / 0.01, 0, 1)


def riser(d):
    t = tt(d)
    n = rng.standard_normal(len(t))
    out = np.zeros_like(t)
    # barrido de banda con ruido + tono que sube
    for i in range(0, len(t), 2400):
        fc = 300 + 5000 * (i / len(t)) ** 2
        seg = n[i:i + 2400]
        out[i:i + 2400] = signal.sosfilt(signal.butter(2, [fc * 0.7, fc * 1.4], 'band', fs=SR, output='sos'), seg)
    tone = np.sin(2 * np.pi * np.cumsum(220 + 660 * (t / d) ** 2) / SR) * 0.25
    return (out * 0.7 + tone) * (t / d) ** 2


def boom():
    t = tt(3.0)
    f = 38 + 60 * np.exp(-t / 0.08)
    sub = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.9)
    body = lp(rng.standard_normal(len(t)), 900) * np.exp(-t / 0.35) * 0.4
    return sub + body


def reverb_ir(d=2.4, decay=0.55, seed=4):
    r = np.random.default_rng(seed)
    t = tt(d)
    e = np.exp(-t / decay)
    l = lp(r.standard_normal(len(t)), 6000) * e
    rr = lp(r.standard_normal(len(t)), 6000) * e
    pre = int(0.018 * SR)
    l[:pre] = 0; rr[:pre] = 0
    return l / np.sqrt(np.sum(l ** 2)), rr / np.sqrt(np.sum(rr ** 2))


# ---------------- armonia (Re mayor) ----------------
CH = {
    'D': ['D3', 'A3', 'D4', 'F#4', 'A4'], 'Dadd9': ['D3', 'A3', 'E4', 'F#4', 'A4'], 'A': ['A2', 'E3', 'C#4', 'E4', 'A4'],
    'A/C#': ['C#3', 'E3', 'A3', 'C#4', 'E4'], 'Bm': ['B2', 'F#3', 'B3', 'D4', 'F#4'], 'G': ['G2', 'D3', 'B3', 'D4', 'G4'],
    'Gmaj7': ['G2', 'D3', 'B3', 'F#4', 'A4'], 'D/F#': ['F#2', 'D3', 'A3', 'D4', 'F#4'], 'Em7': ['E2', 'B2', 'G3', 'D4', 'E4'],
    'Asus': ['A2', 'E3', 'D4', 'E4', 'A4'],
}
S1, S2, S3, S4, S5, S6, S7, S8 = (SC[k] for k in ('S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8'))
COLOR_T = [c['t'] for c in CUES if c['kind'] == 'recolor']
dipro = W('diprolaser')
prog = [
    (0.0, 'Dadd9'), (S2['t0'], 'D'), (W('otra', 1) - 0.1, 'Bm'),
    (S3['t0'], 'Gmaj7'), (W('dales') - 0.05, 'D/F#'), (W('gracias') - 0.05, 'G'), (W('olvide'), 'Asus'),
    (S4['t0'], 'D')] + [(t - 0.12, c) for t, c in zip(COLOR_T, ['A', 'Bm', 'G', 'D/F#', 'A'])] + [
    (S5['t0'], 'Bm'), (W('impreso') - 0.1, 'G'), (W('todo') - 0.1, 'A'),
    (S6['t0'], 'Gmaj7'), (W('gracias', 2) - 0.1, 'D/F#'), (W('estar') - 0.05, 'Em7'), (S6['t1'] - 0.5, 'Asus'),
    (dipro, 'D'), (W('promocionales') - 0.05, 'G'),
    (S8['t0'], 'Bm'), (W('este', 1, 27.5) - 0.1, 'G'), (W('escríbenos'), 'D'), (W('212') - 0.1, 'A'), (W('8627') - 0.1, 'D'), (33.0, 'Dadd9'),
]
prog_t = [p[0] for p in prog] + [DUR]


def chord_at(t):
    for i in range(len(prog)):
        if prog_t[i] <= t < prog_t[i + 1]: return prog[i][1]
    return prog[-1][1]


def section_gain(t):
    """intensidad global del arco 0..1"""
    pts = [(0, .35), (S2['t0'], .45), (S3['t0'], .55), (S4['t0'], .75), (S5['t0'], .9), (S6['t0'] - 0.2, .9), (S6['t0'] + 0.4, .42),
           (S7['t0'], .5), (dipro, 1.0), (S8['t0'], .7), (33.0, .6), (DUR, .5)]
    xs, ys = zip(*pts)
    return float(np.interp(t, xs, ys))


wet = (np.zeros(N), np.zeros(N))   # bus de reverb

# piano: arpegios suaves por acorde (mas densos donde hay mas energia)
for i, (t0, ch) in enumerate(prog):
    t1 = prog_t[i + 1]
    notes = CH[ch]
    g = section_gain(t0)
    # acorde de apoyo (graves) + arpegio arriba
    add(piano(hz(notes[0]), min(4.0, t1 - t0 + 1.5), 0.45 * g), t0, 0.8, -0.2)
    add(piano(hz(notes[0]), min(4.0, t1 - t0 + 1.5), 0.45 * g), t0, 0.45, -0.2, wet)
    step = BEAT if g < 0.6 else BEAT / 2
    k, tn = 0, t0 + (0.05 if i else 0.2)
    while tn < t1 - 0.05:
        n = notes[1 + (k % 4)]
        f = hz(n) * (2 if (k // 4) % 2 and g > 0.7 else 1)
        v = (0.38 + 0.18 * rng.random()) * g
        add(piano(f, 2.6, v), tn, 0.7, 0.25 * np.sin(k))
        add(piano(f, 2.6, v), tn, 0.55, 0.25 * np.sin(k), wet)
        k += 1; tn += step

# melodia de piano (S1, S6, S8): pocas notas, cantables
mel = [(0.25, 'F#5', .5), (1.0, 'E5', .42), (2.12, 'A5', .55), (2.6, 'F#5', .4),
       (S6['t0'] + 0.2, 'B5', .45), (W('gracias', 2) - 0.02, 'A5', .55), (W('por', 1, 20.5), 'F#5', .45), (W('estar'), 'E5', .5), (W('estar') + 0.6, 'D5', .4),
       (S8['t0'] + 0.1, 'F#5', .4), (W('este', 1, 27.5), 'A5', .5), (W('escríbenos'), 'D6', .42), (33.0, 'F#5', .45), (33.4, 'A5', .4), (33.8, 'D6', .38)]
for t0, n, v in mel:
    add(piano(hz(n), 3.5, v), t0, 0.9, 0.1)
    add(piano(hz(n), 3.5, v), t0, 0.9, 0.1, wet)

# cuerdas: colchon desde S1 (muy bajo) que crece en S3-S5
for i, (t0, ch) in enumerate(prog):
    t1 = prog_t[i + 1]
    g = section_gain(t0)
    if t0 < S2['t0']: g *= 0.5
    if S6['t0'] <= t0 < S7['t0']: g *= 0.55
    for j, n in enumerate(CH[ch][1:]):
        f = hz(n)
        if g > 0.7 and j >= 2: f *= 2
        s = strings(f, t1 - t0 + 0.05, att=0.45 if g > 0.7 else 0.8, rel=0.7, bright=1400 + 1600 * g)
        add(s, t0, 0.075 * g, -0.5 + j * 0.33)
        add(s, t0, 0.09 * g, -0.5 + j * 0.33, wet)

# ostinato de cuerdas en S5 (punto alto)
t = S5['t0']; k = 0
while t < S6['t0'] - 0.2:
    n = CH[chord_at(t)][2 + (k % 3)]
    add(strings(hz(n) * 2, BEAT / 2 * 0.9, att=0.02, rel=0.12, bright=3200), t, 0.05, 0.3 if k % 2 else -0.3)
    t += BEAT / 2; k += 1

# pulso: piano apagado en corcheas (S2-S5), semicorcheas en S4-S5
t = S2['t0']; k = 0
while t < S6['t0'] - 0.15:
    dense = S4['t0'] <= t
    n = CH[chord_at(t)][1]
    g = section_gain(t)
    add(piano(hz(n) * 2, 0.4, 0.35 * g, muted=True), t, 0.55 if k % 2 == 0 else 0.35, 0.15)
    t += BEAT / (4 if dense else 2); k += 1

# bajo y bombo suave (S3 en adelante, salvo S6)
for i, (t0, ch) in enumerate(prog):
    t1 = prog_t[i + 1]
    if t0 < S3['t0'] or S6['t0'] <= t0 < dipro: continue
    add(bass(hz(CH[ch][0]) / (2 if hz(CH[ch][0]) > 100 else 1), t1 - t0), t0, 0.22 * section_gain(t0))
t = S4['t0']
while t < S6['t0'] - 0.2:
    add(kick_soft(), t, 0.32 * section_gain(t)); t += BEAT
t = S5['t0']
while t < S6['t0'] - 0.2:
    add(shaker(), t + BEAT / 4, 0.05, 0.4); add(shaker(), t + 3 * BEAT / 4, 0.035, -0.4); t += BEAT
t = S8['t0']
while t < 32.9:
    add(kick_soft(), t, 0.14); t += BEAT * 2

# subida y golpe en el logo
add(riser(dipro - (S7['t0'] - 0.5)), S7['t0'] - 0.5, 0.18)
add(boom(), dipro, 0.85)
add(boom(), dipro, 0.4, 0, wet)
for n in CH['D']:
    add(strings(hz(n) * 2, 2.2, att=0.01, rel=1.2, bright=4200), dipro, 0.06)

# reverb
irl, irr = reverb_ir()
Lw = signal.fftconvolve(wet[0], irl)[:N]; Rw = signal.fftconvolve(wet[1], irr)[:N]
L += Lw * 0.55; R += Rw * 0.55
# fundido final
fade = np.clip((DUR - 0.05 - np.arange(N) / SR) / 1.6, 0, 1)
L *= fade; R *= fade
x = np.stack([L, R], 1)
x = x / np.max(np.abs(x)) * 0.5
out = P / 'audio/stems'; out.mkdir(parents=True, exist_ok=True)
import wave
with wave.open(str(out / 'musica_raw.wav'), 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((x * 32767).astype('<i2').tobytes())
json.dump({'bpm': BPM, 'prog': prog}, open(out / 'musica_mapa.json', 'w'), indent=1)
print('musica', DUR, 's, acordes', len(prog))
