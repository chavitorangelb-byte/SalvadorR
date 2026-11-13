"""Efectos de sonido sintetizados (biblioteca propia en codigo) y su colocacion.

Un cue por cada movimiento visible: trazo de betun, estallido, morphs, glifos que aterrizan, toques y teclas
en la pagina, scrolls, estampado de cada ficha, deslizamientos de cristal, parallax, orbita, clic y pulsos del boton.
Los tiempos salen de la linea de tiempo (mismos numeros que timeline.mjs), de la voz y del manifiesto de captura.
Salidas: audio/stems/sfx_raw.wav y timeline/sfx_cues.json
"""
import json
import subprocess
from pathlib import Path

import numpy as np
from scipy import signal

V = Path(__file__).resolve().parents[1]
SR = 48000
N = int(22.0 * SR)
L = np.zeros(N)
R = np.zeros(N)
cues = []
VO = {l["id"]: [w["t0"] for w in l["words"]] for l in json.loads((V / "timeline/vo_words.json").read_text())}
MAN = json.loads((V / "build/capture/manifest.json").read_text())
tt = lambda d: np.arange(int(d * SR)) / SR


def bp(x, lo, hi, order=2):
    return signal.sosfilt(signal.butter(order, [lo, min(hi, SR * 0.45)], "band", fs=SR, output="sos"), x)


def lp(x, f, order=2):
    return signal.sosfilt(signal.butter(order, f, "low", fs=SR, output="sos"), x)


def put(name, x, t0, db=0.0, pan=0.0):
    i = int(round(t0 * SR))
    a, b = max(0, i), min(N, i + len(x))
    if b <= a:
        return
    seg = x[a - i:b - i] * 10 ** (db / 20)
    L[a:b] += seg * np.cos((pan + 1) * np.pi / 4) * 1.4142
    R[a:b] += seg * np.sin((pan + 1) * np.pi / 4) * 1.4142
    cues.append({"t": round(t0, 3), "sfx": name, "dur": round(len(x) / SR, 3), "db": db})


def G(seed):
    return np.random.default_rng(seed)


def mx(*parts):
    n = max(len(p) for p in parts); y = np.zeros(n)
    for p in parts: y[:len(p)] += p
    return y


# ---------- biblioteca ----------
def whoosh(d=0.45, f0=400, f1=2400, seed=1):
    t = tt(d); n = G(seed).normal(0, 1, len(t))
    y = np.zeros_like(t); seg = 256
    for i in range(0, len(t), seg):
        u = i / len(t); fc = f0 * (f1 / f0) ** u
        y[i:i + seg] = bp(n[max(0, i - 2048):i + seg], fc * 0.7, fc * 1.4)[-len(n[i:i + seg]):]
    env = np.sin(np.pi * np.clip(t / d, 0, 1)) ** 1.6
    return y * env


def squish(d=0.5, seed=2):                       # manga pastelera: ruido grave con burbujeo
    t = tt(d); g = G(seed)
    n = lp(g.normal(0, 1, len(t)), 900)
    am = 0.6 + 0.4 * np.sin(2 * np.pi * (14 + 6 * g.random()) * t) ** 2
    y = bp(n * am, 180, 700)
    return y * np.minimum(1, t / 0.03) * np.minimum(1, (d - t) / 0.08)


def bloop(f0=700, f1=260, d=0.18):
    t = tt(d); f = f1 + (f0 - f1) * np.exp(-t * 22)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 16) * np.minimum(1, t / 0.002)


def tick(f=4200, d=0.05, seed=3):
    t = tt(d); n = G(seed).normal(0, 1, len(t))
    return (bp(n, f * 0.6, f * 1.6) * 0.7 + 0.4 * np.sin(2 * np.pi * f * 0.5 * t)) * np.exp(-t * 90)


def thud(f=88, d=0.22):
    t = tt(d); ff = f + 50 * np.exp(-t * 40)
    return np.sin(2 * np.pi * np.cumsum(ff) / SR) * np.exp(-t * 18) * np.minimum(1, t / 0.001)


def clink(base=2300, d=0.6, seed=4):
    t = tt(d); g = G(seed); y = np.zeros_like(t)
    for k, r in enumerate([1.0, 1.59, 2.21, 2.97]):
        y += np.sin(2 * np.pi * base * r * (1 + 0.004 * g.random()) * t) * np.exp(-t * (7 + 5 * k)) / (1 + k)
    return y * np.minimum(1, t / 0.001)


def stamp(seed):
    return mx(thud(), clink(2100 + 300 * (seed % 3), 0.5, seed) * 0.35, tick(5200, 0.04, seed) * 0.5)


def key(seed):
    t = tt(0.06); n = G(seed).normal(0, 1, len(t))
    return (bp(n, 1800, 5200) * 0.6 + 0.5 * np.sin(2 * np.pi * (1500 + 300 * G(seed).random()) * t)) * np.exp(-t * 110)


def tap():
    t = tt(0.07)
    return (np.sin(2 * np.pi * 1100 * t) * 0.6 + bp(G(9).normal(0, 1, len(t)), 2000, 6000) * 0.3) * np.exp(-t * 80)


def swish(d=0.3, seed=5):
    t = tt(d); n = G(seed).normal(0, 1, len(t))
    return lp(n, 2200) * (t / d) * np.exp(-((t / d) * 4) ** 2 / 2 + 0.0) * np.sin(np.pi * t / d)


def shimmer(d=0.9, seed=6):
    g = G(seed); y = np.zeros(int(d * SR))
    for k in range(9):
        f = 2400 * 2 ** (g.integers(0, 12) / 12); t0 = k * d / 11
        tk = tt(0.4); s = np.sin(2 * np.pi * f * tk) * np.exp(-tk * 12)
        i = int(t0 * SR); y[i:i + len(s)] += s[: len(y) - i] * (0.6 + 0.4 * g.random())
    return y


def liquid(d=0.45, seed=7):
    g = G(seed); y = np.zeros(int(d * SR))
    for k in range(6):
        b = bloop(500 + 500 * g.random(), 180 + 120 * g.random(), 0.14)
        i = int((k / 6) * (d - 0.14) * SR); y[i:i + len(b)] += b * (0.5 + 0.5 * g.random())
    return y + 0.3 * squish(d, seed)


def drip(seed):
    return bloop(1400 + 600 * G(seed).random(), 500, 0.09) * 0.6


# ---------- colocacion ----------
s = 0
def S():
    global s
    s += 1
    return s

# 0-0.5 golpe: trazo que cruza y estalla
put("trazo_cruza", whoosh(0.5, 300, 3200, S()), -0.05, -2, -0.4)
put("trazo_betun", squish(0.45, S()), 0.0, -6, -0.3)
put("estallido", mx(bloop(900, 220, 0.25), 0.5 * thud(70, 0.3)), 0.47, 0)
for k in range(6):
    put("gota", drip(S()), 0.52 + k * 0.045, -10, -0.8 + k * 0.3)
# remolino: la manga dibuja tres vueltas
put("remolino_trazo", squish(1.4, S()), 0.52, -5)
for k, tv in enumerate([0.95, 1.35, 1.72]):
    put("remolino_vuelta", bloop(520 + 80 * k, 300, 0.12), tv, -12, 0.3 * (k - 1))
# tipografia del inicio
for i, w in enumerate(VO["L1"]):
    put("glifo_aterriza", mx(tick(3600 + 300 * i, 0.05, S()), 0.4 * thud(140, 0.1)), w + 0.06, -8, -0.2 + 0.15 * i)
for i in range(4):
    put("glifo_sale", swish(0.22, S()), 1.95 + 0.05 * i, -14, 0.2)
# morph al aro y logo
put("morph_aro", liquid(0.42, S()), 2.0, -6)
put("logo_aparece", shimmer(0.8, S()), 2.25, -10)
# telefono
put("morph_telefono", liquid(0.46, S()), 3.0, -6)
put("logo_vuela", whoosh(0.45, 1200, 400, S()), 3.0, -10, 0.2)
put("fondo_foto", whoosh(0.5, 200, 900, S()), 3.0, -14)
for a, b in [(3.02, 3.36), (3.70, 4.14), (4.45, 5.00)]:
    put("scroll", swish(b - a, S()), a, -14, 0.1)
for tv in [3.41, 4.21, 5.07, 5.42]:
    put("toque", tap(), tv, -8, 0.05)
for k, tv in enumerate([3.41, 4.21, 5.07, 5.50]):
    put("ficha_cae", whoosh(0.3, 2400, 600, S()), tv - 0.30, -12, -0.5 if k % 2 == 0 else 0.5)
    put("ficha_estampa", stamp(S()), tv, -2, -0.5 if k % 2 == 0 else 0.5)
n = len(MAN["typeSteps"])
for k in range(n):
    put("tecla", key(S()), 5.50 + (0.55 * k) / n, -16, 0.05)
for k in range(4):
    put("ficha_sale", swish(0.3, S()), 5.85 + 0.06 * k, -12, -0.6 if k % 2 == 0 else 0.6)
# 6-8 paneles en profundidad
put("telefono_atras", whoosh(0.6, 900, 300, S()), 5.95, -10, 0.4)
put("morph_cinta", liquid(0.5, S()), 5.95, -8)
for k, tv in enumerate([6.15, 6.55, 6.95]):
    put("panel_parallax", whoosh(0.55, 500 + 200 * k, 1800, S()), tv, -10, 0.8 - 0.5 * k)
for i, wi in enumerate([1, 2, 3]):
    put("glifo_aterriza", tick(3300 + 250 * i, 0.05, S()), VO["L3"][wi] + 0.05, -9)
for i in range(3):
    put("glifo_sale", swish(0.22, S()), 7.72 + 0.04 * i, -14)
# 8-10.5 orbita y galeria
put("morph_orbita", liquid(0.5, S()), 7.70, -8)
put("scroll_rapido", swish(0.5, S()), 7.85, -12)
for k in range(4):
    put("foto_entra_orbita", whoosh(0.5, 300, 2000, S()), 7.75 + 0.08 * k, -12, -0.7 + 0.45 * k)
for k, tv in enumerate([8.6, 9.2, 9.75]):
    put("orbita_pasa", whoosh(0.45, 600, 1500, S()), tv, -15, 0.6 - 0.6 * k)
for i, wi in enumerate([0, 3, 6]):
    put("glifo_aterriza", tick(3500 + 250 * i, 0.05, S()), VO["L4"][wi] + 0.05, -9)
for k in range(4):
    put("foto_a_galeria", mx(tick(2600, 0.06, S()), 0.6 * thud(180, 0.08)), 10.30 + 0.04 * k, -8, -0.3 + 0.2 * k)
put("galeria_vuela", whoosh(0.5, 2000, 500, S()), 9.93, -10)
# 10.5-14 cupcakes y galletas
put("telefono_se_aleja", whoosh(0.7, 800, 250, S()), 10.45, -12)
for i, wi in enumerate([0, 1, 2, 4]):
    put("glifo_aterriza", tick(3400 + 220 * i, 0.05, S()), VO["L5"][wi] + 0.05, -9, -0.3 + 0.2 * i)
for tv in [VO["L5"][1] - 0.1, VO["L5"][4] - 0.1]:
    put("punto", bloop(1500, 900, 0.07), tv + 0.04, -14)
for k, (tv, pan) in enumerate([(11.63, 0), (12.29, -0.6), (12.45, 0.6), (12.79, 0)]):
    put("tarjeta_entra", whoosh(0.45, 400, 1800, S()), tv - 0.32, -12, pan)
    put("tarjeta_estampa", stamp(S()), tv, -4, pan)
for tv in [11.25, 12.05, 12.95]:
    put("morph_contorno", liquid(0.4, S()), tv, -10)
for k in range(4):
    put("tarjeta_sale", swish(0.35, S()), 13.80 + 0.05 * k, -12, -0.6 + 0.4 * k)
for i in range(2):
    put("glifo_sale", swish(0.22, S()), 13.62 + 0.06 * i, -14)
# 14-16 WhatsApp
put("telefono_regresa", whoosh(0.55, 300, 1300, S()), 13.85, -10)
put("scroll", swish(0.5, S()), 13.85, -14)
put("letrero_cristal", mx(clink(2600, 0.6, S()) * 0.6, 0.5 * thud(120, 0.12)), 14.30, -8, 0)
put("boton_sube", whoosh(0.4, 500, 2600, S()), 14.05, -8)
put("icono_pop", bloop(1100, 600, 0.12), 14.20, -10)
for i, w in enumerate(VO["L6"]):
    put("glifo_aterriza", tick(3200 + 300 * i, 0.05, S()), w + 0.05, -9)
for tv in [14.5, 15.0, 15.5]:
    put("pulso_subrayado", mx(bloop(420, 220, 0.2) * 0.7, 0.3 * squish(0.15, S())), tv, -9)
put("clic_boton", mx(tap() * 1.3, tick(6000, 0.03, S())), 15.0, -4)
put("boton_regresa", swish(0.4, S()), 15.85, -10)
# 16-19 cierre
put("pull_back", whoosh(0.8, 1600, 300, S()), 16.0, -9)
put("morph_logo", liquid(0.55, S()), 16.5, -7)
put("logo_brillo", shimmer(1.0, S()), 16.6, -11)
for i, w in enumerate(VO["L7"]):
    put("glifo_aterriza", tick(3000 + 300 * i, 0.05, S()), w + 0.06, -10)
# end card
put("salida_cierre", swish(0.35, S()), 18.82, -10)
put("trazo_final", squish(0.5, S()), 19.02, -7)
for i, tv in enumerate([19.06, VO["L8"][1], VO["L8"][2], VO["L8"][4], 20.45, 20.78]):
    put("glifo_aterriza", tick(3300 + 200 * i, 0.05, S()), tv + 0.05, -11)
put("precio_destello", shimmer(0.7, S()), VO["L8"][3] + 0.04, -10)
put("precio2_pop", bloop(1300, 700, 0.1), 20.64, -12)

out = np.vstack([L, R])
out /= np.abs(out).max() / 0.8
subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "f32le", "-ar", str(SR), "-ac", "2", "-i", "-", "-c:a", "pcm_s24le",
                str(V / "audio/stems/sfx_raw.wav")], input=out.T.astype(np.float32).tobytes(), check=True)
(V / "timeline/sfx_cues.json").write_text(json.dumps(sorted(cues, key=lambda c: c["t"]), ensure_ascii=False, indent=1))
print("cues de SFX:", len(cues))
