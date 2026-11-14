"""Efectos de sonido sintetizados en codigo (biblioteca propia, sin muestras) y su colocacion.
Un cue por cada movimiento visible: el tallo, hojas, petalos, morphs de cristal, estampado de tarjetas,
deslizamientos, parallax, chips, toque, boton, pulso del subrayado, textos. Tiempos de timeline.json.
Salidas: video/audio/stems/sfx_raw.wav y video/timeline/sfx_cues.json
"""
import json
import subprocess
from pathlib import Path

import numpy as np
from scipy import signal

ROOT = Path(__file__).resolve().parents[2]
TL = json.loads((ROOT / 'video/timeline/timeline.json').read_text())
T = TL['T']
SR = 48000
N = int(TL['DUR'] * SR)
L, R = np.zeros(N + SR), np.zeros(N + SR)
cues = []
tt = lambda d: np.arange(int(d * SR)) / SR
G = lambda s: np.random.default_rng(s)
bp = lambda x, lo, hi, o=2: signal.sosfilt(signal.butter(o, [lo, hi], 'band', fs=SR, output='sos'), x)
lp = lambda x, f, o=2: signal.sosfilt(signal.butter(o, f, 'low', fs=SR, output='sos'), x)
hp = lambda x, f, o=2: signal.sosfilt(signal.butter(o, f, 'high', fs=SR, output='sos'), x)


def put(name, x, t0, db=0.0, pan=0.0):
    i = int(round(max(0, t0) * SR)); g = 10 ** (db / 20)
    x = x[: len(L) - i] * g
    L[i:i + len(x)] += x * np.cos((pan + 1) * np.pi / 4) * 1.4142; R[i:i + len(x)] += x * np.sin((pan + 1) * np.pi / 4) * 1.4142
    cues.append({'t': round(t0, 3), 'sfx': name, 'dur': round(len(x) / SR, 3), 'db': db})


# ---------- biblioteca ----------
def whoosh(dur, f0, f1, seed=0, q=1.2):                    # aire que pasa: ruido con filtro que barre
    t = tt(dur); n = G(seed).standard_normal(len(t)); k = t / dur
    f = f0 * (f1 / f0) ** k; out = np.zeros(len(t)); B = 1024
    for a in range(0, len(t), B):
        fc = f[min(a + B // 2, len(t) - 1)]
        out[a:a + B] = bp(np.concatenate([n[max(0, a - B):a], n[a:a + B]]), fc / (1 + 0.5 / q), min(20000, fc * (1 + 0.5 / q)))[-len(n[a:a + B]):]
    return out * np.sin(np.pi * k) ** 1.5


def grow(dur, seed=0):                                      # el tallo crece: fibra + tono que sube
    t = tt(dur); k = t / dur
    tone = np.sin(2 * np.pi * np.cumsum(220 * 2 ** (k * 1.6)) / SR) * 0.25 + np.sin(2 * np.pi * np.cumsum(331 * 2 ** (k * 1.6)) / SR) * 0.12
    grain = bp(G(seed).standard_normal(len(t)), 1800, 6500) * (0.5 + 0.5 * np.sign(np.sin(2 * np.pi * (18 + 30 * k) * t))) * 0.35
    return (tone + grain) * np.sin(np.pi * k) ** 0.8 * (0.4 + 0.6 * k)


def snip():                                                 # corte del tallo
    t = tt(0.09)
    return hp(G(4).standard_normal(len(t)), 2500) * np.exp(-t / 0.006) + np.sin(2 * np.pi * 2900 * t) * np.exp(-t / 0.012) * 0.4 + np.sin(2 * np.pi * 180 * t) * np.exp(-t / 0.02) * 0.6


def petal(seed=0, f=880):                                   # petalo / hoja que abre: soplo suave + nota
    t = tt(0.32); g = G(seed)
    air = bp(g.standard_normal(len(t)), 1200, 5200) * np.exp(-((t - 0.05) / 0.05) ** 2) * 0.5
    return air + np.sin(2 * np.pi * f * t) * np.exp(-t / 0.10) * 0.35 * np.minimum(1, t / 0.004) + np.sin(2 * np.pi * f * 2.01 * t) * np.exp(-t / 0.05) * 0.12


def chime(f=1760, dur=1.2):                                 # campanita de cristal
    t = tt(dur)
    return sum(np.sin(2 * np.pi * f * r * t) * a * np.exp(-t / d) for r, a, d in [(1, 1, 0.42), (2.76, 0.4, 0.22), (5.4, 0.2, 0.10), (8.9, 0.1, 0.05)]) * np.minimum(1, t / 0.002)


def morph(dur=0.45, up=True, seed=0):                       # morph liquido de cristal
    t = tt(dur); k = t / dur; f = 300 * 2 ** ((k if up else 1 - k) * 2.2)
    tone = np.sin(2 * np.pi * np.cumsum(f) / SR + 2.5 * np.sin(2 * np.pi * 9 * t)) * 0.4
    return (tone + whoosh(dur, 500, 4200, seed) * 0.6) * np.sin(np.pi * k)


def shimmer(dur=0.5, seed=0):                               # iris: brillo que se abre
    t = tt(dur); g = G(seed); out = np.zeros(len(t))
    for i in range(14):
        f = g.uniform(2200, 7800); d = g.uniform(0, dur * 0.7); m = t >= d
        out[m] += np.sin(2 * np.pi * f * (t[m] - d)) * np.exp(-(t[m] - d) / 0.07) * g.uniform(0.3, 1)
    return out * 0.16


def stamp(seed=0):                                          # tarjeta de cristal que se estampa
    t = tt(0.26); g = G(seed)
    thud = np.sin(2 * np.pi * np.cumsum(140 * np.exp(-t / 0.03) + 62) / SR) * np.exp(-t / 0.055)
    glass = sum(np.sin(2 * np.pi * f * t) * np.exp(-t / 0.035) for f in (2140 + 90 * seed, 3380, 5120)) * 0.12
    return thud * 0.9 + glass + hp(g.standard_normal(len(t)), 3000) * np.exp(-t / 0.004) * 0.35


def slide(dur=0.5, seed=0, f=2600):                         # cristal que se desliza
    t = tt(dur); k = t / dur
    return (bp(G(seed).standard_normal(len(t)), f * 0.8, f * 1.5) * 0.5 + np.sin(2 * np.pi * np.cumsum(f * (0.9 + 0.3 * k)) / SR) * 0.06) * np.sin(np.pi * k) ** 2


def tick(seed=0, f=3200):                                   # letra que aterriza
    t = tt(0.05)
    return np.sin(2 * np.pi * (f + 140 * (seed % 5)) * t) * np.exp(-t / 0.007) * 0.5 + np.sin(2 * np.pi * 420 * t) * np.exp(-t / 0.012) * 0.35


def pop(seed=0, f=520):                                     # chip / boton que aparece
    t = tt(0.16)
    return np.sin(2 * np.pi * np.cumsum(f * (1 + 1.3 * np.exp(-t / 0.018))) / SR) * np.exp(-t / 0.045) * np.minimum(1, t / 0.002)


def tap():
    t = tt(0.08)
    return np.sin(2 * np.pi * np.cumsum(230 - 900 * t) / SR) * np.exp(-t / 0.014) * 0.8 + hp(G(8).standard_normal(len(t)), 2400) * np.exp(-t / 0.0035) * 0.5


def scroll(dur=0.6, seed=0):
    t = tt(dur); k = t / dur
    return bp(G(seed).standard_normal(len(t)), 700, 2600) * np.exp(-k * 3.2) * np.minimum(1, t / 0.02) * 0.6


def pulse():                                                # el subrayado pulsa con el kick
    t = tt(0.3)
    return np.sin(2 * np.pi * np.cumsum(96 + 60 * np.exp(-t / 0.03)) / SR) * np.exp(-t / 0.09) * 0.8 + np.sin(2 * np.pi * 1320 * t) * np.exp(-t / 0.05) * 0.12


def riser(dur=0.9, seed=0):
    t = tt(dur); k = t / dur
    return whoosh(dur, 400, 7000, seed, q=0.8) * k ** 2 * 1.2


def sub(dur=1.0):
    t = tt(dur)
    return np.sin(2 * np.pi * np.cumsum(38 + 26 * np.exp(-t / 0.09)) / SR) * np.exp(-t / 0.35)


# ---------- cues ----------
put('golpe_grave', sub(), 0.0, -2)
put('tallo_cruza', whoosh(0.34, 700, 5200, 1), T['slash'][0], 0, -0.3)
put('corte_del_tallo', snip(), T['cut'] - 0.015, -1, 0.2)
put('tallo_crece', grow(T['grow'][1] - T['grow'][0] + 0.1, 2), T['grow'][0], -5)
put('hoja_1', petal(1, 660), 0.88, -6, -0.4); put('hoja_2', petal(2, 784), 1.02, -6, 0.4)
put('flor_abre', whoosh(0.5, 900, 3800, 3) * 0.8, T['bloom'][0], -5)
for i in range(5): put(f'petalo_{i + 1}', petal(10 + i, [988, 1175, 1319, 1480, 1760][i]), T['bloom'][0] + 0.08 + i * 0.085, -8, -0.5 + i * 0.25)
put('flor_asienta', chime(1760), T['bloom'][1] - 0.05, -9)
put('morph_flor_a_girasoles', morph(T['toSun'][1] - T['toSun'][0] + 0.1, True, 4), T['toSun'][0], -4)
put('iris_girasoles', shimmer(0.45, 5), T['irisSun'][0], -6)
put('panel_asienta', chime(1320, 0.7), T['toSun'][1], -12)
put('morph_a_circulo', morph(T['toCircle'][1] - T['toCircle'][0] + 0.1, False, 6), T['toCircle'][0], -5)
put('iris_logo', shimmer(0.45, 7), T['irisLogo'][0], -7)
put('riser_al_telefono', riser(0.55, 8), T['toPhone'][0] - 0.5, -9)
put('morph_a_telefono', morph(T['toPhone'][1] - T['toPhone'][0] + 0.15, True, 9), T['toPhone'][0], -3)
put('tallo_se_recoge', slide(0.5, 10, 1500), T['toPhone'][0], -10, 0.1)
put('iris_telefono', shimmer(0.6, 11), T['irisPhone'][0], -5)
put('pagina_enciende', chime(2093, 0.9), T['irisPhone'][0] + 0.2, -11)
put('canto_de_cristal_se_va', slide(0.4, 12, 4200), T['rimOff'][0], -12)
put('camara_a_isometrico', whoosh(0.55, 300, 1800, 13), T['irisPhone'][1], -7, -0.2)
for i, c in enumerate(TL['cards']):
    put(f'tarjeta_cae_{c["id"]}', whoosh(0.32, 2600, 500, 20 + i), c['land'] - 0.33, -6, [-0.5, 0.5, -0.3][i])
    put(f'tarjeta_estampa_{c["id"]}', stamp(i), c['land'] - 0.01, 1, [-0.4, 0.4, -0.25][i])
    put(f'sombra_contacto_{c["id"]}', chime([1568, 1760, 2093][i], 0.5), c['land'] + 0.03, -13, [-0.4, 0.4, -0.25][i])
    put(f'tarjeta_sale_{c["id"]}', whoosh(0.4, 600, 3600, 30 + i), T['cardsOff'][0] + i * 0.05, -9, [-0.4, 0.4, -0.25][i])
put('camara_parallax', whoosh(0.8, 250, 1500, 14), T['camPanels'][0], -6, 0.3)
for i in range(3):
    put(f'panel_cristal_entra_{i + 1}', slide(0.55, 40 + i, [2400, 2900, 3400][i]), T['panelsIn'][0] - 0.25 + i * 0.16, -5, [-0.5, 0.1, 0.6][i])
    put(f'panel_cristal_asienta_{i + 1}', tick(i, 1800), T['panelsIn'][1] + 0.05 + i * 0.16, -10, [-0.5, 0.1, 0.6][i])
    put(f'panel_cristal_sale_{i + 1}', slide(0.5, 50 + i, [3400, 2900, 2400][i]), T['panelsOut'][0] + i * 0.05, -8, [-0.5, 0.1, 0.6][i])
put('camara_regresa_al_telefono', whoosh(0.8, 1600, 300, 15), T['camBack'][0], -7, -0.3)
put('scroll_al_catalogo', scroll(0.7, 16), T['scrollCat'][0], -6)
for i in range(3):
    put(f'chip_aparece_{i + 1}', pop(i, [520, 620, 740][i]), T['chipsIn'][0] + i * 0.11, -5, [-0.4, 0.4, 0][i])
    put(f'chip_sale_{i + 1}', tick(60 + i, 2400), T['chipsOut'][0] + i * 0.04, -12, [-0.4, 0.4, 0][i])
put('cinta_de_petalos', whoosh(T['ribbon'][1] - T['ribbon'][0], 1400, 4200, 17, q=0.9), T['ribbon'][0], -8, 0)
put('cinta_sale', slide(0.6, 18, 3600), T['ribbon'][1] - 0.7, -13, 0.5)
put('toque_chip', tap(), T['tapChip'] - 0.01, -2); put('filtro_cambia', pop(5, 880), T['tapChip'] + 0.04, -8)
put('camara_a_eventos', whoosh(0.6, 300, 1700, 19), T['camEvents'][0], -7)
put('scroll_a_eventos', scroll(0.7, 21), T['eventsIn'][0], -7)
for i in range(3):
    put(f'evento_sale_de_la_pagina_{i + 1}', slide(0.55, 70 + i, [2200, 2700, 3200][i]), T['eventsIn'][0] + i * 0.10, -5, [-0.6, 0.6, -0.1][i])
    put(f'evento_asienta_{i + 1}', chime([1175, 1319, 1568][i], 0.5), T['eventsIn'][1] + 0.1 + i * 0.10, -13, [-0.6, 0.6, -0.1][i])
    put(f'evento_regresa_{i + 1}', slide(0.4, 80 + i, [3200, 2700, 2200][i]), T['eventsOut'][0] + i * 0.04, -9, [-0.6, 0.6, -0.1][i])
put('orbita_eventos', whoosh(1.2, 500, 900, 22, q=0.7), T['eventsIn'][1], -13)
put('camara_al_boton', whoosh(0.65, 1500, 350, 23), T['camWa'][0], -7)
put('boton_sale_de_la_barra', pop(7, 440), T['waLift'][0], -1); put('boton_cristal', chime(1568, 0.8), T['waLift'][0] + 0.12, -9)
put('tallo_subraya', grow(T['underline'][1] - T['underline'][0], 24) * 0.9, T['underline'][0], -6)
for i, t in enumerate(T['waPulse']): put(f'pulso_subrayado_{i + 1}', pulse(), t, -3 if i else -6)
put('clic_boton', tap(), T['waPulse'][0] + 0.0, -9)
put('boton_regresa', slide(0.35, 25, 2000), T['waOut'][0], -9)
put('pull_back', whoosh(0.7, 1800, 250, 26), T['pull'][0], -5)
put('scroll_al_inicio', scroll(0.6, 27), T['pull'][0], -10)
put('iris_cierre', shimmer(0.4, 28), T['irisBack'][0], -6)
put('telefono_se_cierra_al_circulo', morph(0.5, False, 29), T['irisBack'][1] - 0.05, -4)
put('circulo_asienta', chime(1175, 1.4), T['toLogo'][1] + 0.05, -8)
put('riser_al_end_card', riser(0.7, 31), T['endHit'] - 0.7, -10)
put('golpe_grave_final', sub(1.4), T['endHit'], 0)
put('logo_sube', slide(0.5, 32, 1800), T['endIn'][0], -10)
put('precio_abre', np.concatenate([np.pad(petal(90 + i, 880 + 110 * i), (int(i * 0.03 * SR), 0))[: int(0.6 * SR)] for i in range(1)] ), T['endIn'][0] + 0.12, -7)
for i, d in enumerate([0.06, 0.24, 0.40, 0.56, 0.64]): put(f'end_card_linea_{i + 1}', tick(100 + i, 2000 + 200 * i), T['endIn'][0] + d + 0.1, -10, [-0.2, 0.2, 0, -0.1, 0.1][i])
put('placa_de_cristal', pop(9, 392), T['endIn'][0] + 0.34, -8)
for i, w in enumerate(TL['words']):                         # cada palabra aterriza con su tic
    put(f'palabra_{w["text"]}', tick(i, 2600 if w['text'].islower() or w['text'][0].isupper() and w['text'][1:].islower() else 3100), w['t'] - 0.02, -11, -0.25 + 0.5 * (i % 3) / 2)
for g in TL['groups']: put(f'texto_sale_{g["id"]}', slide(0.25, 120, 5200), g['out'][0], -16)

out = np.vstack([L, R])[:, :N]
out /= max(1e-9, np.abs(out).max()) / 0.85
(ROOT / 'video/audio/stems').mkdir(parents=True, exist_ok=True)
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', str(SR), '-ac', '2', '-i', '-', '-c:a', 'pcm_s24le', str(ROOT / 'video/audio/stems/sfx_raw.wav')],
               input=out.T.astype(np.float32).tobytes(), check=True)
cues.sort(key=lambda c: c['t'])
(ROOT / 'video/timeline/sfx_cues.json').write_text(json.dumps(cues, ensure_ascii=False, indent=1))
print(len(cues), 'cues')
