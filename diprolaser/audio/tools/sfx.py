"""Efectos de sonido sintetizados (biblioteca propia en codigo) y su colocacion.

Un cue por cada movimiento visible: swoosh del carrusel, golpe suave por producto nuevo, zap y
chisporroteo del laser, pasadas de la impresora, tink de cristal en cada chip, cinta y papel al
abrir la caja, burbujas del liquido en los morphs, impacto en el logo, etc.
Los tiempos salen de timeline/*.json (voz real) y de los mismos desfases que usa story.mjs.
Salidas: audio/stems/sfx_raw.wav y timeline/sfx_cues.json
"""
import json, wave
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
L = np.zeros(N); R = np.zeros(N)
LOG = []


def W(txt, nth=1, after=0.0):
    c = 0
    for w in WORDS:
        if w['s'] >= after and w['w'].strip('.,').lower() == txt.lower():
            c += 1
            if c == nth: return w['s']
    raise KeyError(txt)


def tt(d): return np.arange(int(d * SR)) / SR
def flt(x, kind, f, o=2):
    f = [min(v, SR * 0.45) for v in f] if isinstance(f, (list, tuple)) else min(f, SR * 0.45)
    return signal.sosfilt(signal.butter(o, f, kind, fs=SR, output='sos'), x)
def R_(seed): return np.random.default_rng(seed)


def put(name, x, t0, db=0.0, pan=0.0):
    i = int(round(t0 * SR)); g = 10 ** (db / 20)
    a, b = max(0, i), min(N, i + len(x))
    if a >= b: return
    s = x[a - i:b - i] * g
    L[a:b] += s * np.cos((pan + 1) * np.pi / 4) * 1.4142
    R[a:b] += s * np.sin((pan + 1) * np.pi / 4) * 1.4142
    LOG.append({'t': round(t0, 3), 'sfx': name, 'db': db})


# ---------------- biblioteca ----------------
def whoosh(d, seed, lo=200, hi=3500, rev=False):
    r = R_(seed); t = tt(d); n = r.standard_normal(len(t))
    out = np.zeros_like(t); blk = 1200
    for i in range(0, len(t), blk):
        k = i / len(t); k = 1 - k if rev else k
        fc = lo + (hi - lo) * np.sin(np.pi * k) ** 1.5
        out[i:i + blk] = flt(n[i:i + blk], 'band', [fc * 0.6, fc * 1.5])
    e = np.sin(np.pi * np.clip(t / d, 0, 1)) ** 2
    return out * e


def soft_thump(seed):
    r = R_(seed); t = tt(0.35)
    f = 70 + 90 * np.exp(-t / 0.03)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.09)
    click = flt(r.standard_normal(len(t)), 'band', [1500, 5000]) * np.exp(-t / 0.006) * 0.25
    return body + click


def glass_tink(seed, f0=2600):
    r = R_(seed); t = tt(0.9)
    y = sum(a * np.sin(2 * np.pi * f0 * m * t + r.uniform(0, 6)) * np.exp(-t / dcy)
            for a, m, dcy in [(1, 1, 0.35), (0.5, 2.71, 0.18), (0.3, 4.13, 0.09), (0.2, 5.4, 0.05)])
    return y * np.clip(t / 0.001, 0, 1)


def chime(f0=880, d=2.2):
    t = tt(d)
    y = sum(a * np.sin(2 * np.pi * f0 * m * t) * np.exp(-t / dc) for a, m, dc in [(1, 1, 0.9), (0.45, 2.0, 0.6), (0.3, 3.0, 0.4), (0.18, 4.2, 0.25)])
    return y * np.clip(t / 0.004, 0, 1)


def shimmer(d, seed):
    r = R_(seed); t = tt(d); y = np.zeros_like(t)
    for k in range(18):
        f = 2400 + 5200 * r.random(); t0 = r.random() * d * 0.8
        tk = np.clip(t - t0, 0, None)
        y += np.sin(2 * np.pi * f * tk) * np.exp(-tk / 0.12) * (t > t0) * (0.4 + 0.6 * r.random())
    return y / 6 * np.sin(np.pi * np.clip(t / d, 0, 1))


def bubble(seed, f0=None):
    r = R_(seed); t = tt(0.16)
    f0 = f0 or (300 + 500 * r.random())
    f = f0 * (1 + 2.5 * t / 0.16)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.04) * np.clip(t / 0.003, 0, 1)


def gloop(d, seed):
    r = R_(seed); t = tt(d)
    f = 120 + 160 * np.sin(np.pi * t / d) + 30 * np.sin(2 * np.pi * 9 * t)
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * np.clip(t / d, 0, 1)) ** 2
    y += flt(r.standard_normal(len(t)), 'low', 600) * 0.3 * np.sin(np.pi * np.clip(t / d, 0, 1))
    return y


def rustle(d, seed):
    r = R_(seed); t = tt(d); n = r.standard_normal(len(t))
    grains = (r.random(len(t)) < 0.004).astype(float)
    g = signal.lfilter([1], [1, -0.995], grains) * 0.15
    y = flt(n, 'band', [1800, 9000]) * (0.25 + g) * np.sin(np.pi * np.clip(t / d, 0, 1))
    return y


def paper_flip(seed):
    r = R_(seed); t = tt(0.22)
    return flt(r.standard_normal(len(t)), 'band', [900, 7000]) * np.exp(-((t - 0.06) / 0.035) ** 2) * 0.9


def wood_knock(seed):
    r = R_(seed); t = tt(0.3)
    y = np.sin(2 * np.pi * 180 * t) * np.exp(-t / 0.05) + 0.5 * np.sin(2 * np.pi * 410 * t) * np.exp(-t / 0.03)
    return y + flt(r.standard_normal(len(t)), 'band', [400, 2500]) * np.exp(-t / 0.01) * 0.3


def laser_zap(d, seed):
    r = R_(seed); t = tt(d)
    f = 2200 + 900 * np.sin(2 * np.pi * 37 * t) + 400 * r.standard_normal(len(t)) * 0.1
    tone = np.sign(np.sin(2 * np.pi * np.cumsum(f) / SR)) * 0.15
    hiss = flt(r.standard_normal(len(t)), 'high', 5000) * 0.35
    e = np.clip(t / 0.01, 0, 1) * np.clip((d - t) / 0.04, 0, 1)
    return flt(tone, 'low', 7000) * e + hiss * e


def crackle(d, seed, dens=0.006):
    r = R_(seed); t = tt(d)
    imp = (r.random(len(t)) < dens) * r.uniform(-1, 1, len(t))
    y = flt(imp, 'high', 2500) * 2.0
    return y * np.clip((d - t) / 0.05, 0, 1)


def power_up(d):
    t = tt(d)
    f = 120 + 1400 * (t / d) ** 2
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * (t / d) * 0.5


def printer_pass(d, seed):
    r = R_(seed); t = tt(d)
    motor = np.sin(2 * np.pi * np.cumsum(260 + 40 * np.sin(2 * np.pi * 3 * t)) / SR) * 0.25
    ticks = flt((np.mod(t, 0.018) < 0.0012).astype(float), 'band', [1500, 6000]) * 0.5
    jet = flt(r.standard_normal(len(t)), 'band', [3000, 9000]) * 0.15
    e = np.clip(t / 0.03, 0, 1) * np.clip((d - t) / 0.05, 0, 1)
    return (motor + ticks + jet) * e


def uv_hum(d):
    t = tt(d)
    y = np.sin(2 * np.pi * 120 * t) * 0.4 + np.sin(2 * np.pi * 240 * t) * 0.2 + np.sin(2 * np.pi * 3600 * t) * 0.05
    return y * np.clip(t / 0.15, 0, 1) * np.clip((d - t) / 0.2, 0, 1)


def liquid_swish(d, seed):
    return mix(whoosh(d, seed, 300, 2400) * 0.7, bubble(seed + 1, 500) * 0.4)


def light_wipe(seed):
    return whoosh(0.18, seed, 2500, 9000) * 0.8


def impact(seed):
    r = R_(seed); t = tt(2.5)
    f = 42 + 70 * np.exp(-t / 0.06)
    sub = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.7)
    crack = flt(r.standard_normal(len(t)), 'band', [800, 7000]) * np.exp(-t / 0.05) * 0.5
    tail = flt(r.standard_normal(len(t)), 'band', [3000, 12000]) * np.exp(-t / 0.8) * 0.06
    return sub + crack + tail


def swell(d, seed):
    r = R_(seed); t = tt(d)
    n = flt(r.standard_normal(len(t)), 'band', [400, 3000])
    return n * (t / d) ** 2 * np.clip((d - t) / 0.08, 0, 1) * 0.6


def pop_soft(seed):
    t = tt(0.12); f = 600 * np.exp(-t / 0.03) + 200
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.03)


def tick(seed):
    r = R_(seed); t = tt(0.05)
    return flt(r.standard_normal(len(t)), 'band', [2000, 8000]) * np.exp(-t / 0.006)


def mix(*xs):
    n = max(len(x) for x in xs); o = np.zeros(n)
    for x in xs: o[:len(x)] += x
    return o


# ---------------- colocacion ----------------
S = SC
T = {k: W(*v) if isinstance(v, tuple) else W(v) for k, v in {
    'llegan': 'llegan', 'y1': ('y', 1), 'una': 'una', 'vez': 'vez', 'y2': ('y', 1, 4.5), 'otra1': ('otra', 1), 'y3': ('y', 1, 5.6), 'mas': 'más',
    'anio': 'año', 'dales': 'dales', 'gracias1': 'gracias', 'algo': 'algo', 'olvide': 'olvide', 'logo': 'logo', 'negocio': 'negocio', 'suyo': 'suyo',
    'grabado': 'grabado', 'laser': 'láser', 'impreso': 'impreso', 'todo': 'todo', 'gracias2': ('gracias', 2), 'por2': ('por', 1, 20.5), 'estar': 'estar',
    'dipro': 'diprolaser', 'promo': 'promocionales', 'consiente': 'consiente', 'a8': ('a', 1, 27), 'tus': 'tus', 'clientes': ('clientes', 1, 27),
    'este': ('este', 1, 27.5), 'escribe': 'escríbenos', 'n449': '449', 'n212': '212', 'n8627': '8627'}.items()}
ENG_T = [c['t'] for c in CUES if c['kind'] == 'engrave' and c['what'].startswith('Cambio')]
COLOR_T = [c['t'] for c in CUES if c['kind'] == 'recolor']
TAG_T = [c['t'] for c in CUES if c['kind'] == 'tag']
ENTER_T = [S['S2']['t0'] + 0.05, S['S2']['t0'] + 0.2, T['vez'], T['otra1'], T['mas'], S['S3']['t0'] + 0.6, S['S3']['t0'] + 1.2, S['S3']['t0'] + 1.8]

# S1
put('drone_swell', swell(3.0, 1) * 0.5, 0.0, -14)
put('shimmer_hilo_rojo', shimmer(1.4, 2), 0.05, -20, 0.2)
put('whoosh_llegan', whoosh(0.9, 3, 300, 4200), T['llegan'] - 0.25, -12, -0.3)
put('chime_quedan', chime(1174.7, 2.4), T['y1'] + 0.12, -20)
put('thump_quedan', soft_thump(4), T['y1'] + 0.1, -16)
put('shimmer_hilo_rojo_2', shimmer(1.2, 5), 2.4, -24, -0.2)
# S2
put('swoosh_carrusel', whoosh(1.1, 6, 150, 1800), S['S2']['t0'] - 0.2, -11)
for i, te in enumerate(ENTER_T):
    quiet = te > S['S3']['t0']
    put(f'golpe_producto_{i}', soft_thump(10 + i), te, -12 if not quiet else -24, 0.4 * np.sin(i * 2))
    put(f'tick_producto_{i}', glass_tink(20 + i, 3100 + 200 * i) * 0.4, te + 0.02, -22 if not quiet else -32, 0.4 * np.sin(i * 2))
for i, (k, mode) in enumerate([('una', 'drop'), ('y2', 'left'), ('y3', 'pop')]):
    put(f'whoosh_tarjeta_{i}', whoosh(0.45, 30 + i, 500, 5000), T[k] - 0.25, -18, [-0.2, -0.6, 0.2][i])
    put(f'tink_cristal_tarjeta_{i}', glass_tink(40 + i, 2400 + 250 * i), T[k] + 0.05, -17)
# S3
for i in range(4):
    put(f'burbuja_sube_{i}', bubble(50 + i), S['S3']['t0'] - 0.3 + i * 0.13, -20, (i - 1.5) * 0.3)
put('gloop_caja', gloop(0.5, 55), T['anio'] - 0.25, -14)
put('gloop_mono', gloop(0.4, 56), T['anio'] + 0.06, -17)
put('liston_tensa', rustle(0.35, 57), T['anio'] + 0.15, -20)
put('tapa_madera', wood_knock(58), T['dales'], -16)
put('cinta_papel_abre', rustle(0.7, 59), T['dales'] + 0.02, -15, -0.3)
put('papel_seda', rustle(0.5, 60), T['dales'] + 0.35, -21, 0.3)
put('luz_calida', shimmer(1.6, 61), T['dales'] + 0.1, -19)
put('chime_gracias', chime(1318.5, 2.6), T['gracias1'] - 0.05, -22)
for i in range(3):
    put(f'whoosh_regalo_{i}', whoosh(0.6, 62 + i, 250, 2200), T['algo'] - 0.15 + i * 0.12, -20, (i - 1) * 0.5)
put('tink_etiqueta', glass_tink(66, 2900), T['olvide'] + 0.05, -16, -0.4)
put('etiqueta_cuerda', rustle(0.25, 67), T['olvide'] + 0.1, -26, -0.4)
# S4
put('whoosh_vaso_sube', whoosh(0.7, 70, 200, 2600), S['S4']['t0'] - 0.2, -14)
put('swoosh_carrusel_rapido', whoosh(1.4, 71, 150, 1500), S['S4']['t0'] - 0.1, -17)
put('tink_chip', glass_tink(72, 2700), T['logo'] - 0.1, -16)
put('tink_chip_negocio', glass_tink(73, 3000) * 0.7, T['negocio'] - 0.1, -19)
put('tink_chip_nombre', glass_tink(74, 3300) * 0.7, T['suyo'] - 0.1, -19)
for i, te in enumerate(ENG_T):
    put(f'barrido_luz_borra_{i}', light_wipe(80 + i), te, -20, 0.1)
    put(f'laser_escribe_{i}', laser_zap(0.30, 85 + i), te + 0.12, -22, 0.2)
    put(f'chispas_{i}', crackle(0.3, 90 + i, 0.004), te + 0.12, -24, 0.2)
for i, tc in enumerate(COLOR_T):
    put(f'barrido_liquido_color_{i}', liquid_swish(0.55, 95 + i), tc - 0.12, -21, -0.6 + 0.3 * i)
# S5
put('cristal_diagonal', mix(whoosh(0.6, 100, 900, 7000), glass_tink(101, 2200) * 0.3), S['S5']['t0'] - 0.25, -15, 0.5)
put('laser_enciende', power_up(0.35), T['grabado'] - 0.35, -20, -0.2)
put('laser_graba', laser_zap(T['impreso'] + 0.5 - T['grabado'], 102), T['grabado'], -23, -0.2)
put('laser_chisporroteo', crackle(T['impreso'] + 0.5 - T['grabado'], 103), T['grabado'], -21, -0.25)
put('whoosh_laser_txt', whoosh(0.5, 104, 600, 6000), T['laser'] - 0.3, -19, 0.4)
CD = 0.27
put('uv_zumbido', uv_hum(4 * CD + 0.3), T['impreso'] - 0.1, -26, 0.3)
for i, ch in enumerate('cmyk'):
    put(f'impresora_pasada_{ch}', printer_pass(CD, 110 + i), T['impreso'] + i * CD + (0.05 if ch == 'k' else 0), -18, 0.3 + 0.1 * (i % 2))
put('shimmer_color_txt', shimmer(0.9, 115), T['todo'] - 0.2, -21, -0.3)
# S6
put('transicion_calida', swell(0.9, 120), S['S6']['t0'] - 0.6, -20)
for i, tg in enumerate(TAG_T):
    put(f'etiqueta_gira_{i}', paper_flip(121 + i), tg + 0.05, -18, [-0.5, -0.1, 0.5, 0.2][i])
put('gracias_aire', shimmer(1.0, 126) * 0.6, T['gracias2'] - 0.1, -26)
# S7
for i in range(5):
    put(f'gotas_se_juntan_{i}', bubble(130 + i, 260 + 60 * i), S['S6']['t1'] - 0.5 + i * 0.09, -22, (i - 2) * 0.35)
put('gloop_x', gloop(0.45, 136), S['S7']['t0'] - 0.05, -16)
put('subida_logo', swell(0.75, 137), T['dipro'] - 0.75, -16)
put('impacto_logo', impact(138), T['dipro'], -8)
put('barrido_plata', shimmer(1.0, 139), T['dipro'] + 0.05, -18)
put('tink_promocionales', glass_tink(140, 3400) * 0.6, T['promo'] - 0.05, -22)
# S8
put('whoosh_logo_sube', whoosh(0.6, 150, 300, 3000), S['S8']['t0'] - 0.25, -19)
for i, k in enumerate(['consiente', 'a8', 'tus', 'clientes']):
    put(f'pop_palabra_{k}', pop_soft(151 + i), T[k] - 0.05, -22, (i - 1.5) * 0.25)
put('chime_este_anio', chime(1479.98, 2.2), T['este'] - 0.05, -22)
put('tink_pildora', glass_tink(156, 2600), T['escribe'] - 0.1, -15)
for i, k in enumerate(['n449', 'n212', 'n8627']):
    put(f'tick_numero_{k}', mix(tick(160 + i), pop_soft(165 + i) * 0.3), T[k] - 0.05, -17, -0.2 + 0.2 * i)
put('redes_suave', shimmer(0.6, 170) * 0.5, T['n8627'] + 0.4, -28)
put('envios_suave', glass_tink(171, 3600) * 0.4, TL['voice_end'] + 0.05, -26)
put('cierre_aire', swell(1.4, 172) * 0.6, 33.0, -26)

x = np.stack([L, R], 1)
pk = np.max(np.abs(x)); x = x / max(pk, 1e-9) * 0.5
out = P / 'audio/stems'; out.mkdir(parents=True, exist_ok=True)
with wave.open(str(out / 'sfx_raw.wav'), 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((x * 32767).astype('<i2').tobytes())
json.dump({'n': len(LOG), 'escala': float(0.5 / max(pk, 1e-9)), 'cues': LOG}, open(P / 'timeline/sfx_cues.json', 'w'), indent=1, ensure_ascii=False)
print(f'{len(LOG)} cues de SFX')
