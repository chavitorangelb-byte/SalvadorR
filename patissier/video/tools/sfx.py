"""Efectos de sonido sintetizados en código (sin muestras), uno por cada movimiento visible.
Los tiempos salen de la línea de tiempo (timeline.mjs) y de la página capturada, no se teclean a mano.
Uso: python3 video/tools/sfx.py  ->  video/audio/stems/sfx.wav  +  video/timeline/sfx_cues.json
"""
import json, subprocess
from pathlib import Path
import numpy as np
from scipy.signal import butter, sosfilt
import soundfile_shim as sf

ROOT = Path(__file__).resolve().parents[2]
SR, DUR = 48000, 18.0
N = int(SR * DUR)
rng = np.random.default_rng(7)
TL = json.loads(subprocess.run(['node', '-e', "import('./video/timeline/timeline.mjs').then(m=>console.log(JSON.stringify({T:m.T,VO:m.VO})))"],
                               cwd=ROOT, capture_output=True, text=True, check=True).stdout)
T = TL['T']
L = np.zeros(N); R = np.zeros(N)
CUES = []


def bp(x, f0, f1, order=2):
    return sosfilt(butter(order, [max(20, f0) / (SR / 2), min(f1, SR * 0.45) / (SR / 2)], 'band', output='sos'), x)


def lp(x, fc, order=2):
    return sosfilt(butter(order, min(fc, SR * 0.45) / (SR / 2), 'low', output='sos'), x)


def hp(x, fc, order=2):
    return sosfilt(butter(order, fc / (SR / 2), 'high', output='sos'), x)


def sweep_lp(x, f_start, f_end, q=0.7):
    """filtro de estado variable con corte que barre (exponencial) -> pasa banda"""
    n = len(x); fc = f_start * (f_end / f_start) ** (np.arange(n) / max(n - 1, 1))
    g = 2 * np.sin(np.pi * np.minimum(fc, SR * 0.2) / SR)
    low = band = 0.0; out = np.empty(n); damp = 1 / q
    for i in range(n):
        high = x[i] - low - damp * band
        band += g[i] * high; low += g[i] * band
        out[i] = band
    return out


def env(n, a, d):
    t = np.arange(n) / SR
    return np.where(t < a, (t / max(a, 1e-4)) ** 1.5, np.exp(-(t - a) / d))


def add(name, t0, sig, gain=1.0, pan=0.0, pan_end=None):
    i = int(round(t0 * SR))
    if i >= N or t0 < 0:
        return
    sig = sig[:N - i] * gain
    p = np.full(len(sig), pan) if pan_end is None else np.linspace(pan, pan_end, len(sig))
    L[i:i + len(sig)] += sig * np.cos((p + 1) * np.pi / 4) * np.sqrt(2)
    R[i:i + len(sig)] += sig * np.sin((p + 1) * np.pi / 4) * np.sqrt(2)
    CUES.append({'t': round(t0, 3), 'name': name})


# ---------- sonidos ----------
def whoosh(dur, f0, f1, q=0.9, a=0.35):
    n = int(dur * SR); x = rng.standard_normal(n)
    y = sweep_lp(x, f0, f1, q)
    t = np.arange(n) / SR; e = np.sin(np.pi * np.clip(t / dur, 0, 1)) ** 1.2
    e *= np.where(t < a * dur, 1, 1)
    return y * e / (np.abs(y).max() + 1e-9)


def silk(dur, bright=1.0):
    """roce de satén: ruido de banda media-alta con aleteo irregular"""
    n = int(dur * SR); t = np.arange(n) / SR
    x = bp(rng.standard_normal(n), 1800 * bright, 7500 * bright)
    flutter = 0.55 + 0.45 * np.abs(np.sin(2 * np.pi * (18 + 9 * rng.random()) * t + 6 * np.sin(2 * np.pi * 3.1 * t)))
    e = np.sin(np.pi * np.clip(t / dur, 0, 1)) ** 1.5
    return x * flutter * e / (np.abs(x).max() + 1e-9)


def cinch(dur=0.30):
    n = int(dur * SR); t = np.arange(n) / SR
    zip_ = bp(rng.standard_normal(n), 2500, 9000) * (0.5 + 0.5 * np.sign(np.sin(2 * np.pi * 70 * t))) * np.exp(-t / 0.08)
    creak = np.sin(2 * np.pi * (180 + 90 * t / dur) * t) * np.exp(-t / 0.05) * 0.4
    return (zip_ / (np.abs(zip_).max() + 1e-9) + creak) * 0.8


def thump(f0=95, f1=48, dur=0.45, paper=0.35):
    n = int(dur * SR); t = np.arange(n) / SR
    f = f1 + (f0 - f1) * np.exp(-t / 0.03)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.10)
    pap = bp(rng.standard_normal(n), 400, 3200) * np.exp(-t / 0.025) * paper
    return np.tanh(1.5 * (body + pap))


def wood_tick(f=1400, dur=0.07):
    n = int(dur * SR); t = np.arange(n) / SR
    return (np.sin(2 * np.pi * f * t) * np.exp(-t / 0.012) + 0.5 * np.sin(2 * np.pi * f * 2.71 * t) * np.exp(-t / 0.006)
            + 0.3 * hp(rng.standard_normal(n), 3000) * np.exp(-t / 0.002))


def glass(f=2400, dur=0.35, ring=0.09):
    n = int(dur * SR); t = np.arange(n) / SR
    x = sum(a * np.sin(2 * np.pi * f * r * t + rng.random()) * np.exp(-t / (ring / r ** 0.5)) for r, a in ((1, 1), (2.32, 0.5), (4.25, 0.3), (6.8, 0.15)))
    return x + 0.3 * hp(rng.standard_normal(n), 5000) * np.exp(-t / 0.002)


def shimmer(dur=0.8, base=2200, up=True):
    n = int(dur * SR); t = np.arange(n) / SR; out = np.zeros(n)
    for k in range(7):
        f = base * (1.12 ** k); t0 = (k / 7) * dur * 0.55 if up else (1 - k / 7) * dur * 0.55
        e = np.clip((t - t0) / 0.02, 0, 1) * np.exp(-np.clip(t - t0, 0, None) / 0.18)
        out += np.sin(2 * np.pi * f * t) * e
    return out / 3


def pop(f=700, dur=0.12):
    n = int(dur * SR); t = np.arange(n) / SR
    ff = f * (1 + 0.6 * np.exp(-t / 0.015))
    return np.sin(2 * np.pi * np.cumsum(ff) / SR) * np.exp(-t / 0.03)


def key_tick(dur=0.04):
    n = int(dur * SR); t = np.arange(n) / SR
    return bp(rng.standard_normal(n), 2000, 6000) * np.exp(-t / 0.004) + 0.4 * np.sin(2 * np.pi * 2600 * t) * np.exp(-t / 0.005)


def tap(deep=1.0):
    n = int(0.16 * SR); t = np.arange(n) / SR
    return np.sin(2 * np.pi * (240 / deep) * t) * np.exp(-t / 0.025) + 0.5 * bp(rng.standard_normal(n), 1500, 5000) * np.exp(-t / 0.004)


def swell(dur=0.9):
    """onda que sale del botón: soplo de agua grave que se abre"""
    n = int(dur * SR); t = np.arange(n) / SR
    y = sweep_lp(rng.standard_normal(n), 300, 2200, 1.4)
    tone = np.sin(2 * np.pi * (220 + 120 * t / dur) * t) * 0.25
    return (y / (np.abs(y).max() + 1e-9) + tone) * np.sin(np.pi * np.clip(t / dur, 0, 1)) ** 0.8 * np.exp(-t / 0.5)


def impact():
    n = int(2.2 * SR); t = np.arange(n) / SR
    f = 34 + 50 * np.exp(-t / 0.05)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.55)
    air = lp(rng.standard_normal(n), 900) * np.exp(-t / 0.18) * 0.5
    return np.tanh(1.8 * (body + air))


def sub(a, b, x0, x1):
    """tiempo donde el progreso de un tramo [a,b] vale entre x0 y x1 (inverso de sub() de la página)"""
    return a + (b - a) * x0, a + (b - a) * x1


# ---------- cues ----------
# 1) gancho: latigazo de la cinta, aleteos, caída y golpe de la caja
add('latigazo de la cinta', T['whip'][0], whoosh(0.5, 6000, 500, 1.2), 0.9, -0.9, 0.9)
for k, tt in enumerate((0.10, 0.20, 0.31)):
    add('aleteo de la cinta', tt, silk(0.18, 1.1), 0.30, 0.6 - 0.5 * k)
add('caja cae', T['boxIn'][0], whoosh(0.30, 900, 2400, 1.0), 0.35, 0, 0)
land = T['boxIn'][0] + 0.30
add('caja aterriza', land, thump(105, 46, 0.5, 0.45), 0.85)
add('rebote', land + 0.11, thump(140, 70, 0.18, 0.5), 0.25)
add('asienta', land + 0.21, thump(170, 90, 0.12, 0.6), 0.12)
# 2) anudado
for k, tt in enumerate(np.linspace(T['tie'][0] + 0.28, T['tie'][1] - 0.45, 4)):
    add('la cinta rodea la caja', tt, silk(0.22, 0.9 + 0.08 * k), 0.36, [-0.5, -0.2, 0.3, 0.5][k])
add('lazo izquierdo', T['tie'][1] - 0.30, silk(0.28, 0.8), 0.40, -0.4)
add('lazo derecho', T['tie'][1] - 0.16, silk(0.26, 0.85), 0.40, 0.4)
add('el moño aprieta', T['cinch'], cinch(), 0.55)
add('"2" aterriza', T['t20'] - 0.15 + 0.15, thump(160, 80, 0.16, 0.2), 0.30, -0.2)
add('"0" aterriza', T['t20'] - 0.15 + 0.034 + 0.15, thump(150, 75, 0.16, 0.2), 0.28, 0.0)
for i in range(4):
    add('letra de "AÑOS"', T['tAnos'] + i * 0.03, wood_tick(1300 + 120 * i), 0.18, 0.1 + 0.15 * i)
# 3) el moño se suelta y se vuelve el teléfono
add('el moño se suelta', T['untie'][0], silk(0.35, 1.2), 0.5)
add('la escena cae', T['untie'][0] + 0.06, whoosh(0.6, 2500, 400, 0.9), 0.40, 0, 0)
add('la cinta dibuja el marco', T['untie'][0] + 0.30, silk(0.40, 1.0), 0.40, -0.6, 0.2)
add('la cinta cierra el marco', T['untie'][0] + 0.62, silk(0.35, 0.95), 0.36, 0.6, -0.1)
add('crece el cristal', T['glass'][0], shimmer(0.6, 2600), 0.20)
add('el cristal asienta', T['glass'][1], glass(2900, 0.4), 0.22)
# 4) portada
i0, i1 = T['intro']
add('logo aparece', i0 + 0.10, pop(620), 0.30, -0.3)
add('título "Repostería"', sub(i0, i1, 0.14, 0.46)[1], wood_tick(1100), 0.20, -0.1)
add('título "artesanal"', sub(i0, i1, 0.36, 0.70)[1], wood_tick(1250), 0.20, 0.1)
add('aparece la foto', sub(i0, i1, 0.34, 0.95)[0], whoosh(0.7, 500, 1800, 0.8), 0.22)
add('frase de la bio', sub(i0, i1, 0.50, 0.82)[0], whoosh(0.4, 3000, 6000, 0.7), 0.10, -0.5, 0.5)
add('scroll a la reseña', T['cardScroll'][0], whoosh(0.5, 700, 1600, 0.8), 0.20)
# 5) tarjeta de reseña
c0, c1 = T['card']; cl = c1 - c0
add('la línea dibuja la tarjeta', c0, shimmer(0.55, 3200), 0.16, -0.5, 0.5)
add('se abre el cristal', c0 + 0.05 * cl, glass(2300, 0.35), 0.22, -0.3)
for i, ch in enumerate('4.8'):
    add(f'"{ch}" de la calificación', c0 + (0.40 + i * 0.04) * cl, wood_tick(1500 - 120 * i), 0.20, -0.4)
for i in range(5):
    add(f'estrella {i + 1}', c0 + (0.62 + i * 0.055) * cl, glass(3200 + 260 * i, 0.25, 0.05), 0.12, -0.2 + 0.1 * i)
add('"en Google"', c0 + 0.90 * cl, pop(900, 0.10), 0.16, 0.1)
quote = '“excelente pastelería, calidad de sus ingredientes, variedad de productos, su personal super amables, todo delicioso”'
starts = [0] + [k + 1 for k, ch in enumerate(quote) if ch == ' ']
for k, s in enumerate(starts):
    add('palabra de la reseña', T['typed'][0] + (s / len(quote)) * (T['typed'][1] - T['typed'][0]), key_tick(), 0.07, -0.2 + 0.4 * (k % 3) / 2)
# 6) galería
add('scroll a la galería', T['galScroll'][0], whoosh(0.85, 500, 2600, 0.8), 0.30, 0.2, -0.2)
g0, g1 = T['gal']
add('título de la galería', g0, whoosh(0.35, 3000, 6000, 0.7), 0.08)
for i in range(4):
    add(f'tarjeta {i + 1} de la galería', g0 + (0.08 + i * 0.13) * (g1 - g0), whoosh(0.32, 1200, 3800, 1.1), 0.16, [-0.5, 0.5, -0.4, 0.2][i])
add('órbita de cámara', T['orbit'][0] + 0.4, whoosh(1.6, 300, 700, 0.6), 0.10, -0.4, 0.4)
# 7) pedido y tamaños
add('scroll al pedido', T['orderScroll'][0], whoosh(0.75, 500, 2400, 0.8), 0.28)
o0, o1 = T['order']
add('foto del pedido', o0 + 0.08 * (o1 - o0), whoosh(0.35, 2000, 5000, 0.7), 0.10)
for i in range(8):
    add(f'ficha de sabor {i + 1}', o0 + (0.6 + i * 0.06) * (o1 - o0), pop(760 + 40 * i, 0.08), 0.10, -0.5 + 0.14 * i)
s0, s1 = T['sizes']
for i, nm in enumerate(('Mini', 'Chico', 'Mediano', 'Grande')):
    add(f'ficha {nm}', s0 + (0.5 + i * 0.17) * (s1 - s0), glass(1900 + 230 * i, 0.3), 0.20, -0.45 + 0.3 * i)
add('dedo se acerca', T['pick'] - 0.28, whoosh(0.25, 800, 2000, 0.8), 0.07, 0.1)
add('toque en Mediano', T['pick'], tap(1.0), 0.40, 0.1)
add('anillo de luz', T['ring'][0], shimmer(0.7, 1800), 0.18, 0.1)
add('dedo se acerca al botón', T['tap'] - 0.30, whoosh(0.25, 800, 2000, 0.8), 0.07, 0.2)
add('toque en el botón', T['tap'], tap(1.4), 0.55)
add('el botón suelta', T['tapUp'], pop(520, 0.1), 0.25)
add('la onda sale del botón', T['wave'][0], swell(1.0), 0.40, -0.3, 0.3)
add('brillo de la onda', T['wave'][0] + 0.05, shimmer(0.7, 2000), 0.10)
# 8) lift y plegado
add('la cámara se aleja', T['pull'][0], whoosh(1.0, 300, 1400, 0.6), 0.32, -0.2, 0.2)
add('regresa a la portada', T['topScroll'][0], whoosh(0.7, 800, 3000, 0.8), 0.18, 0.3, -0.3)
add('la interfaz se pliega', T['fold'][0], whoosh(0.6, 2600, 700, 1.0), 0.32)
add('el cristal desaparece', T['fold'][0] + 0.45, shimmer(0.5, 2600, up=False), 0.16)
add('la cinta vuelve', T['fold'][0] + 0.20, silk(0.45, 1.0), 0.40, 0.5, -0.3)
add('la cinta se anuda', T['fold'][0] + 0.55, silk(0.40, 0.9), 0.38, -0.4, 0.2)
add('la caja sube', T['fold'][0] + 0.12, whoosh(0.7, 400, 2200, 0.9), 0.32, 0, 0)
add('la caja asienta', T['fold'][0] + 0.85, thump(120, 55, 0.35, 0.4), 0.45)
add('el moño cierra', T['fold'][1] - 0.05, cinch(), 0.50)
for k in range(3):
    add('letras de "PATISSIER"', T['tPat'] - 0.14 + 0.26 + k * 0.10, wood_tick(1150 + 150 * k), 0.18, -0.3 + 0.3 * k)
add('"Repostería fina" se escribe', T['tFina'] - 0.08, shimmer(0.6, 2400), 0.14, -0.4, 0.4)
# 9) cierre
add('la caja sale', T['exit'][0], whoosh(0.4, 2400, 400, 0.9), 0.30, 0, 0)
add('golpe grave del corte', T['endCard'], impact(), 0.90)
add('aviso de demo', T['endCard'] + 0.30, whoosh(0.5, 3000, 6000, 0.7), 0.05, -0.4, 0.4)

L[int(17.5 * SR):] = 0; R[int(17.5 * SR):] = 0
mx = max(np.abs(L).max(), np.abs(R).max())
L /= mx / 0.8; R /= mx / 0.8
sf.write(ROOT / 'video/audio/stems/sfx.wav', np.stack([L, R], 1), SR)
CUES.sort(key=lambda c: c['t'])
(ROOT / 'video/timeline/sfx_cues.json').write_text(json.dumps(CUES, ensure_ascii=False, indent=0))
print(len(CUES), 'cues ->', ROOT / 'video/audio/stems/sfx.wav')
