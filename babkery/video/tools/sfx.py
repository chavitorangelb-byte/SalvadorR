"""SFX de Babkery sintetizados en código: un sonido por cue de timeline.json (cada uno atado a un movimiento visible).
Salida: video/audio/stems/sfx_raw.wav (48 kHz, estéreo) y sfx_cues_report.json."""
import json, subprocess
from pathlib import Path
import numpy as np
from scipy import signal

V = Path(__file__).resolve().parents[1]
TL = json.loads((V / 'timeline/timeline.json').read_text())
SR, DUR = 48000, TL['dur']
N = int(DUR * SR)
rng = np.random.default_rng(5)
out = np.zeros((2, N))
def tt(d): return np.arange(int(d * SR)) / SR
def noise(d): return rng.standard_normal(int(d * SR))
def bp(x, lo, hi, o=2): b, a = signal.butter(o, [lo / (SR / 2), hi / (SR / 2)], 'band'); return signal.lfilter(b, a, x)
def lp(x, f, o=2): b, a = signal.butter(o, f / (SR / 2)); return signal.lfilter(b, a, x)
def hp(x, f, o=2): b, a = signal.butter(o, f / (SR / 2), 'high'); return signal.lfilter(b, a, x)
def sweep_bp(x, f0, f1, q=3):   # filtro que barre (por bloques)
    y = np.zeros_like(x); blk = 512
    for i in range(0, len(x), blk):
        k = i / max(1, len(x) - 1); f = f0 * (f1 / f0) ** k
        lo, hi = f / (1 + 1 / q), min(f * (1 + 1 / q), SR / 2 - 100)
        b, a = signal.butter(1, [lo / (SR / 2), hi / (SR / 2)], 'band')
        y[i:i + blk] = signal.lfilter(b, a, x[max(0, i - 2048):i + blk])[-len(x[i:i + blk]):]
    return y
def sine(f, d, decay): x = tt(d); return np.sin(2 * np.pi * f * x) * np.exp(-x / decay)
def norm(x): return x / (np.abs(x).max() + 1e-9)

def s_impacto():
    x = tt(0.9); f = 70 + 140 * np.exp(-x / 0.03); body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-x / 0.25)
    return norm(body + 0.5 * lp(noise(0.9), 1800) * np.exp(-x / 0.04))
def s_whoosh(d=0.35): x = tt(d); return norm(sweep_bp(noise(d), 400, 3500) * np.sin(np.pi * x / d) ** 2)
def s_shimmer(d=0.5):
    x = tt(d); y = sum(np.sin(2 * np.pi * f * x + rng.uniform(0, 6)) for f in rng.uniform(2800, 7500, 7))
    return norm(y * np.exp(-x / (d / 3)) * (1 - np.exp(-x / 0.01)) + 0.2 * hp(noise(d), 6000) * np.exp(-x / 0.05))
def s_tick_madera(): x = tt(0.08); return norm(sine(1150, 0.08, 0.012) + 0.6 * sine(2400, 0.08, 0.006) + 0.3 * bp(noise(0.08), 1500, 4000) * np.exp(-x / 0.004))
def s_masa():
    x = tt(0.35); f = 90 + 60 * np.exp(-x / 0.02); y = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-x / 0.08)
    return norm(y + 0.7 * lp(noise(0.35), 700) * np.exp(-x / 0.05))
def s_papel():
    x = tt(0.22); n = bp(noise(0.22), 1500, 7000); crackle = (rng.random(len(x)) > 0.995) * rng.standard_normal(len(x))
    return norm((n * 0.6 + bp(crackle, 2000, 8000) * 3) * np.sin(np.pi * x / 0.22))
def s_swell(d=0.6): x = tt(d); return norm(sweep_bp(noise(d), 300, 1800) * (x / d) ** 2 * (1 - np.exp(-(d - x) / 0.03)))
def s_cristal(): x = tt(0.4); return norm(sine(2350, 0.4, 0.09) + 0.6 * sine(3720, 0.4, 0.05) + 0.4 * sine(5900, 0.4, 0.02) + 0.3 * hp(noise(0.4), 5000) * np.exp(-x / 0.003))
def s_campanita(): x = tt(1.2); return norm(sine(1568, 1.2, 0.5) + 0.5 * sine(1568 * 2.76, 1.2, 0.2) + 0.3 * sine(3136, 1.2, 0.35) + 0.5 * s_shimmer(1.2))
def s_aire(d=0.5): x = tt(d); return norm(lp(noise(d), 1200) * np.sin(np.pi * x / d) ** 2)
def s_contacto(): x = tt(0.18); return norm(sine(180, 0.18, 0.04) + 0.4 * lp(noise(0.18), 900) * np.exp(-x / 0.015))
def s_ping(f=1760): return norm(sine(f, 0.7, 0.25) + 0.4 * sine(f * 2.0, 0.7, 0.12) + 0.2 * sine(f * 3.01, 0.7, 0.06))
def s_tick(f=3000): x = tt(0.04); return norm(sine(f, 0.04, 0.005) + 0.4 * hp(noise(0.04), 4000) * np.exp(-x / 0.002))
def s_zip(d=0.3):
    x = tt(d); f = 900 * (3.2 ** (x / d)); y = signal.square(2 * np.pi * np.cumsum(f) / SR * 0.5) * 0.15
    return norm(bp(noise(d), 2000, 8000) * (0.4 + 0.6 * x / d) * np.sin(np.pi * x / d) + bp(y, 1000, 6000) * np.sin(np.pi * x / d))
def s_click(): x = tt(0.09); return norm(sine(1900, 0.09, 0.008) + sine(900, 0.09, 0.02) * 0.6 + hp(noise(0.09), 3000) * np.exp(-x / 0.003))
def s_pulso(): x = tt(0.5); return norm(sine(220, 0.5, 0.18) * (1 - np.exp(-x / 0.01)) + 0.4 * sine(440, 0.5, 0.1))
def s_reverse_swell(d=0.7): x = tt(d); y = s_shimmer(d)[::-1] * 0.6 + sweep_bp(noise(d), 3000, 400) * (1 - x / d); return norm(y * np.sin(np.pi * x / d))
def s_power_down(d=0.35): x = tt(d); f = 600 * (0.15 ** (x / d)); return norm(np.sin(2 * np.pi * np.cumsum(f) / SR) * (1 - x / d) ** 1.5 + 0.3 * lp(noise(d), 800) * (1 - x / d))
def s_golpe(): x = tt(2.2); f = 38 + 50 * np.exp(-x / 0.05); return norm(np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-x / 0.7) + 0.3 * lp(noise(2.2), 200) * np.exp(-x / 0.12))
def s_atmos(): d = DUR - 16.3; x = tt(d); y = lp(noise(d), 500) * 0.5 + bp(noise(d), 2000, 4000) * 0.05; return norm(y * np.minimum(1, x / 0.8) * np.minimum(1, (d - x) / 0.6))

GEN = {
    'impacto': s_impacto, 'whoosh': s_whoosh, 'shimmer': s_shimmer, 'tick madera': s_tick_madera, 'masa': s_masa,
    'papel': s_papel, 'swell': s_swell, 'cristal': s_cristal, 'campanita': s_campanita, 'aire': s_aire, 'contacto': s_contacto,
    'ping': lambda: s_ping(1760), 'ping cristal': None, 'tick': None, 'zip': s_zip, 'tick cristal': lambda: s_tick(4200),
    'glass whoosh': lambda: norm(s_whoosh(0.4) + 0.4 * s_cristal()[: int(0.4 * SR)] * 0.5), 'click': s_click, 'pulso': s_pulso,
    'reverse swell': s_reverse_swell, 'power down': s_power_down, 'golpe grave': s_golpe, 'atmósfera': s_atmos,
}
STAR_NOTES = [1568, 1760, 1976, 2093, 2349]   # estrellas afinadas, una escala ascendente
star_i = tick_i = 0
report = []
# las fuentes anticipadas (whoosh, swell...) se adelantan para que su punto fuerte caiga en el cuadro del movimiento
LEAD = {'whoosh': 0.12, 'aire': 0.15, 'swell': 0.3, 'reverse swell': 0.0, 'glass whoosh': 0.12, 'papel': 0.0}
for c in TL['sfx']:
    fam = c['fam']
    if fam == 'ping cristal': y = s_ping(STAR_NOTES[star_i % 5]); star_i += 1
    elif fam == 'tick': y = s_tick(1800 + 120 * tick_i); tick_i += 1
    else: y = GEN[fam]()
    t0 = max(0.0, c['t'] - LEAD.get(fam, 0.0))
    i = int(round(t0 * SR)); y = y[: N - i]
    pan = float(np.clip(rng.normal(0, 0.25), -0.6, 0.6))
    l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    g = 10 ** (c['gain_db'] / 20)
    out[0, i:i + len(y)] += y * g * l * 1.414; out[1, i:i + len(y)] += y * g * r * 1.414
    report.append(dict(t=c['t'], f=c['f'], fam=fam, what=c['what']))
(V / 'audio/stems').mkdir(parents=True, exist_ok=True)
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', str(SR), '-ac', '2', '-i', '-', '-c:a', 'pcm_s24le',
                str(V / 'audio/stems/sfx_raw.wav')], input=out.T.astype(np.float32).tobytes(), check=True)
(V / 'audio/sfx_cues_report.json').write_text(json.dumps(report, ensure_ascii=False, indent=1))
print(len(report), 'cues')
