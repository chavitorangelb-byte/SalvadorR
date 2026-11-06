"""Efectos de sonido de Matíca, sintetizados en código (biblioteca propia, sin muestras).

Un cue por cada movimiento visible, con los tiempos de timeline/sfx_cues.json (amarrados a la voz):
la gota (plic, giro líquido, trazo, brillo), cristal (barra, celular, destello), teclas, taps,
scrolls con fricción, pestañas, selector, conteos, hielos del cold brew, hojas que suben y bajan,
el pop de "Agregar", el abanico de reseñas, el pin del mapa, whooshes y los golpes.
Salida: video/audio/stems/sfx_raw.wav (48 kHz estéreo) + audio/sfx_placed.json (lo que se colocó).
"""
import json
import subprocess
from pathlib import Path

import numpy as np
from scipy import signal

ROOT = Path(__file__).resolve().parents[1]          # matica/video
CUES = json.loads((ROOT / "timeline/sfx_cues.json").read_text())
SR = 48000
N = int(27.0 * SR)
L = np.zeros(N)
R = np.zeros(N)
placed = []
tt = lambda d: np.arange(int(d * SR)) / SR


def filt(x, kind, f, order=2):
    if kind == "band":
        f = [f[0], min(f[1], SR * 0.45)]
    else:
        f = min(f, SR * 0.45)
    sos = signal.butter(order, f, kind, fs=SR, output="sos")
    return signal.sosfilt(sos, x)


def noise(d, seed):
    return np.random.default_rng(seed).standard_normal(int(d * SR))


def env(d, a, dec):
    t = tt(d)
    return np.clip(t / max(a, 1e-4), 0, 1) * np.exp(-np.maximum(t - a, 0) / dec)


def sweep(f0, f1, d, curve=1.0):
    t = tt(d)
    k = (t / d) ** curve
    f = f0 * (f1 / f0) ** k
    return np.sin(2 * np.pi * np.cumsum(f) / SR)


def whoosh(d, f0, f1, seed, q=1.8):
    """aire con un paso de banda que barre (sube o baja)"""
    x = noise(d, seed)
    out = np.zeros_like(x)
    blocks = np.array_split(np.arange(len(x)), 48)
    zi = None
    for b, idx in enumerate(blocks):
        fc = f0 * (f1 / f0) ** (b / (len(blocks) - 1))
        sos = signal.butter(2, [fc / q, min(fc * q, SR * 0.45)], "band", fs=SR, output="sos")
        if zi is None:
            zi = signal.sosfilt_zi(sos) * 0
        y, zi = signal.sosfilt(sos, x[idx], zi=zi)
        out[idx] = y
    t = tt(d)
    return out * np.sin(np.pi * np.clip(t / d, 0, 1)) ** 1.4


def bell(f, d, dec, partials=((1, 1.0), (2.76, 0.32), (5.40, 0.12))):
    t = tt(d)
    return sum(a * np.sin(2 * np.pi * f * r * t) * np.exp(-t / (dec / (1 + 0.6 * r))) for r, a in partials) * np.clip(t / 0.002, 0, 1)


def M(*xs):
    """suma señales de distinta duración (rellena con silencio)"""
    n = max(len(x) for x in xs)
    out = np.zeros(n)
    for x in xs:
        out[: len(x)] += x
    return out


# ---------- biblioteca ----------
def s_golpe(seed):        # golpe suave de madera grave (la música pone el cuerpo)
    t = tt(0.5)
    return np.sin(2 * np.pi * np.cumsum(60 + 90 * np.exp(-t / 0.03)) / SR) * np.exp(-t / 0.16) * 0.9 + filt(noise(0.5, seed), "low", 1200) * env(0.5, 0.001, 0.03) * 0.25


def s_plic(seed):         # gota de agua: burbuja que sube de tono
    g = np.random.default_rng(seed)
    f0 = 650 + 160 * g.random()
    t = tt(0.16)
    x = sweep(f0, f0 * 2.6, 0.16, 0.45) * np.exp(-t / 0.045)
    x += filt(noise(0.16, seed + 1), "band", [2500, 9000]) * env(0.16, 0.0005, 0.003) * 0.35
    return x * 0.8


def s_cristal_in(seed):   # aparece un cristal: brillo agudo + soplo
    x = sum(bell(f, 0.9, 0.45) for f in (2350, 3490, 5120)) / 3
    return M(x * 0.5, whoosh(0.5, 1800, 5200, seed, 2.2) * 0.5)


def s_tecla(seed):
    g = np.random.default_rng(seed)
    t = tt(0.05)
    n = filt(noise(0.05, seed), "band", [2400, 7000]) * np.exp(-t / 0.005)
    body = np.sin(2 * np.pi * (1500 + 300 * g.random()) * t) * np.exp(-t / 0.004) * 0.30
    thock = np.sin(2 * np.pi * (220 + 50 * g.random()) * t) * np.exp(-t / 0.011) * 0.55
    return (n + body + thock) * (0.85 + 0.3 * g.random())


def s_espacio(seed):
    t = tt(0.07)
    return np.sin(2 * np.pi * 165 * t) * np.exp(-t / 0.018) * 0.8 + filt(noise(0.07, seed), "band", [1500, 5000]) * np.exp(-t / 0.006) * 0.6


def s_enter(seed):
    t = tt(0.12)
    return (np.sin(2 * np.pi * 185 * t) * np.exp(-t / 0.024) + 0.5 * np.sin(2 * np.pi * 95 * t) * np.exp(-t / 0.04)
            + filt(noise(0.12, seed), "band", [1800, 6500]) * np.exp(-t / 0.008) * 0.7) * 1.05


def s_estira(seed):       # líquido que se estira: tono que se dobla con vibrato + chapoteo
    t = tt(0.55)
    f = 260 * (2.1 ** (t / 0.55)) * (1 + 0.04 * np.sin(2 * np.pi * 9 * t))
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * t / 0.55) ** 1.2 * 0.45
    return x + whoosh(0.55, 500, 2400, seed, 2.5) * 0.45


def s_tink(seed):
    return bell(1760, 0.6, 0.30) * 0.45


def s_cristal_cel(seed):  # se materializa el celular de cristal
    return M(whoosh(0.7, 900, 4200, seed, 2.0) * 0.55, sum(bell(f, 1.0, 0.55) for f in (1567, 2349, 3136)) / 3 * 0.45)


def s_giro(seed):
    return whoosh(0.5, 380, 1500, seed, 1.6) * 0.8


def s_asienta(seed):
    t = tt(0.3)
    return np.sin(2 * np.pi * np.cumsum(120 - 50 * t / 0.3) / SR) * np.exp(-t / 0.06) * 0.7 + bell(2640, 0.3, 0.12) * 0.12


def s_pantalla(seed):     # enciende la pantalla
    t = tt(0.32)
    return sweep(380, 980, 0.32, 0.6) * np.sin(np.pi * np.clip(t / 0.32, 0, 1)) * 0.35 + filt(noise(0.32, seed), "band", [3000, 9000]) * env(0.32, 0.001, 0.004) * 0.4


def s_uipop(seed):
    t = tt(0.07)
    return sweep(560, 980, 0.07, 0.5) * np.exp(-t / 0.022) * 0.7


def s_gota_giro(seed):    # la gota da vuelta: remolino líquido
    t = tt(0.42)
    gurg = np.sin(2 * np.pi * np.cumsum(420 + 140 * np.sin(2 * np.pi * 7 * t)) / SR) * np.sin(np.pi * t / 0.42) * 0.30
    return gurg + whoosh(0.42, 700, 2600, seed, 2.4) * 0.5


def s_tap(seed):          # tap en el cristal
    t = tt(0.06)
    return (filt(noise(0.06, seed), "band", [1800, 7000]) * np.exp(-t / 0.004) * 0.8
            + np.sin(2 * np.pi * 1150 * t) * np.exp(-t / 0.006) * 0.35 + np.sin(2 * np.pi * 240 * t) * np.exp(-t / 0.012) * 0.35)


def s_scroll(seed):       # scroll con fricción
    return whoosh(0.5, 1400, 520, seed, 1.5) * 0.55 + filt(noise(0.5, seed + 3), "high", 6000) * env(0.5, 0.03, 0.12) * 0.08


def s_selector(seed):
    return M(whoosh(0.14, 1200, 2600, seed, 1.8) * 0.4, bell(2100, 0.16, 0.05) * 0.18)


def s_conteo(seed, k=1, n=5):  # tic del conteo, sube de tono
    f = 1900 * 2 ** (k / max(n, 1) * 0.5)
    t = tt(0.04)
    return np.sin(2 * np.pi * f * t) * np.exp(-t / 0.008) * 0.45


def s_pestana(seed):
    return M(whoosh(0.18, 900, 2400, seed, 1.6) * 0.35, bell(1400, 0.12, 0.04) * 0.15)


def s_tarjeta_sale(seed):  # la tarjeta se despega: soplo que sube + roce de papel
    return M(whoosh(0.5, 500, 2600, seed, 1.7) * 0.7, filt(noise(0.08, seed + 2), "band", [2500, 8000]) * env(0.08, 0.002, 0.02) * 0.25)


def s_hielos(seed):       # hielos del cold brew
    g = np.random.default_rng(seed)
    out = np.zeros(int(0.4 * SR))
    for j in range(3):
        f = 2600 + 2400 * g.random()
        x = bell(f, 0.22, 0.10, ((1, 1.0), (1.47, 0.5), (2.09, 0.25))) * (0.7 - 0.15 * j)
        i = int((0.035 * j + 0.02 * g.random()) * SR)
        out[i:i + len(x)] += x[: len(out) - i]
    return out * 0.45


def s_tarjeta_entra(seed):  # la tarjeta regresa a su lugar: golpecito suave
    t = tt(0.22)
    tap = s_tap(seed)
    return np.sin(2 * np.pi * 150 * t) * np.exp(-t / 0.04) * 0.6 + np.pad(tap, (0, len(t) - len(tap)))[: len(t)] * 0.6


def s_pedido_in(seed):
    return M(whoosh(0.35, 600, 2200, seed, 1.7) * 0.45, np.pad(s_uipop(seed), (int(0.22 * SR), 0)) * 0.6)


def s_contador(seed):     # el contador del pedido hace pop
    t = tt(0.09)
    return sweep(700, 1500, 0.09, 0.4) * np.exp(-t / 0.03) * 0.55


def s_swipe(seed):
    return whoosh(0.28, 2400, 800, seed, 1.6) * 0.55


def s_gota_trazo(seed):   # la gota subraya: deslizamiento líquido
    t = tt(0.32)
    x = np.sin(2 * np.pi * np.cumsum(520 + 380 * t / 0.32) / SR) * np.sin(np.pi * t / 0.32) * 0.25
    return x + whoosh(0.32, 1800, 3600, seed, 2.6) * 0.35


def s_hoja_sube(seed):
    return whoosh(0.45, 300, 1600, seed, 1.5) * 0.6


def s_press(seed):
    t = tt(0.07)
    return np.sin(2 * np.pi * 210 * t) * np.exp(-t / 0.016) * 0.6 + filt(noise(0.07, seed), "band", [1200, 4000]) * np.exp(-t / 0.005) * 0.35


def s_pop(seed):          # "Agregar" se levanta: pop satisfactorio con un destello
    t = tt(0.35)
    x = sweep(420, 1150, 0.35, 0.25) * np.exp(-t / 0.05) * 0.8
    return x + bell(2793, 0.35, 0.16) * 0.18 + bell(4186, 0.35, 0.12) * 0.10


def s_hoja_baja(seed):
    return whoosh(0.45, 1500, 320, seed, 1.5) * 0.55


def s_gota_brillo(seed):  # brillo: campanitas en arpegio
    out = np.zeros(int(0.6 * SR))
    for j, f in enumerate((2637, 3136, 3951)):
        x = bell(f, 0.5, 0.22) * (0.5 - 0.1 * j)
        i = int(0.05 * j * SR)
        out[i:i + len(x)] += x[: len(out) - i]
    return out * 0.5


def s_trazo(seed):        # el ícono de línea se dibuja: trazo suave, agudo
    t = tt(0.6)
    return filt(noise(0.6, seed), "band", [3500, 9000]) * np.sin(np.pi * t / 0.6) ** 2 * 0.16


def s_swipe_tick(seed):
    return s_conteo(seed, 2, 4) * 0.8


def s_abanico_sale(seed):  # tres tarjetas que se abren
    out = np.zeros(int(0.6 * SR))
    for j in range(3):
        x = whoosh(0.30, 700 + 300 * j, 2600, seed + j, 1.8) * 0.45
        i = int(0.06 * j * SR)
        out[i:i + len(x)] += x[: len(out) - i]
    return out


def s_abanico_regresa(seed):
    out = np.zeros(int(0.5 * SR))
    for j in range(3):
        x = whoosh(0.26, 2400, 700, seed + j, 1.8) * 0.40
        i = int(0.05 * j * SR)
        out[i:i + len(x)] += x[: len(out) - i]
    return out


def s_pin(seed):          # el pin cae y rebota
    t = tt(0.35)
    x = sweep(900, 360, 0.08, 1.0) * np.exp(-tt(0.08) / 0.03)
    out = np.zeros(len(t))
    out[: len(x)] += x * 0.6
    b = s_plic(seed) * 0.35
    i = int(0.11 * SR)
    out[i:i + len(b)] += b[: len(out) - i]
    return out


def s_whoosh(seed):
    return whoosh(0.7, 1800, 350, seed, 1.5) * 0.8


def s_gota_cae(seed):     # la gota llega al centro: "bloop"
    t = tt(0.25)
    return sweep(300, 900, 0.25, 0.5) * np.exp(-t / 0.07) * 0.6


def s_golpe_grave(seed):
    t = tt(0.9)
    return M(np.sin(2 * np.pi * np.cumsum(46 + 60 * np.exp(-t / 0.05)) / SR) * np.exp(-t / 0.30) * 0.7, whoosh(0.5, 400, 120, seed, 1.4) * 0.25)


def s_logo_in(seed):
    return M(whoosh(0.7, 600, 3000, seed, 2.0) * 0.4, sum(bell(f, 1.2, 0.6) for f in (1047, 1568, 2093)) / 3 * 0.3)


def s_destello(seed):     # destello mínimo: dos campanas y brillo
    out = np.zeros(int(1.0 * SR))
    for j, f in enumerate((3136, 4186)):
        x = bell(f, 0.9, 0.40) * (0.45 - 0.12 * j)
        i = int(0.06 * j * SR)
        out[i:i + len(x)] += x[: len(out) - i]
    return M(out * 0.55, filt(noise(0.4, seed), "high", 7000) * env(0.4, 0.01, 0.10) * 0.06)


LIB = {
    "golpe": (s_golpe, -1.0), "gota-plic": (s_plic, -3.0), "cristal-in": (s_cristal_in, -6.0), "tecla": (s_tecla, -8.0),
    "tecla-espacio": (s_espacio, -8.0), "enter": (s_enter, -4.0), "gota-estira": (s_estira, -5.0), "trazo-cierra": (s_tink, -9.0),
    "cristal-celular": (s_cristal_cel, -5.0), "giro": (s_giro, -9.0), "asienta": (s_asienta, -7.0), "pantalla-on": (s_pantalla, -8.0),
    "ui-pop": (s_uipop, -8.0), "gota-giro": (s_gota_giro, -6.0), "tap": (s_tap, -4.0), "scroll": (s_scroll, -6.0),
    "selector": (s_selector, -7.0), "conteo": (s_conteo, -9.0), "pestana": (s_pestana, -8.0), "tarjeta-sale": (s_tarjeta_sale, -5.0),
    "hielos": (s_hielos, -6.0), "tarjeta-entra": (s_tarjeta_entra, -6.0), "pedido-in": (s_pedido_in, -6.0), "contador": (s_contador, -6.0),
    "swipe": (s_swipe, -7.0), "gota-trazo": (s_gota_trazo, -6.0), "hoja-sube": (s_hoja_sube, -7.0), "press": (s_press, -5.0),
    "pop": (s_pop, -2.0), "hoja-baja": (s_hoja_baja, -8.0), "gota-brillo": (s_gota_brillo, -6.0), "trazo": (s_trazo, -6.0),
    "swipe-tick": (s_swipe_tick, -10.0), "abanico-sale": (s_abanico_sale, -5.0), "abanico-regresa": (s_abanico_regresa, -7.0),
    "pin": (s_pin, -5.0), "whoosh": (s_whoosh, -5.0), "gota-cae": (s_gota_cae, -4.0), "golpe-grave": (s_golpe_grave, -3.0),
    "logo-in": (s_logo_in, -7.0), "destello": (s_destello, -5.0),
}
PAN = {"tecla": 0.0, "hielos": -0.25, "trazo": 0.35, "tarjeta-sale": -0.3, "tarjeta-entra": -0.2, "swipe": 0.2}


def put(kind, x, t0, gain_db, pan, note):
    i = int(round(t0 * SR))
    a, b = max(0, i), min(N, i + len(x))
    if b <= a:
        return
    g = 10 ** (gain_db / 20)
    seg = x[a - i:b - i] * g
    L[a:b] += seg * np.cos((pan + 1) * np.pi / 4) * 1.4142
    R[a:b] += seg * np.sin((pan + 1) * np.pi / 4) * 1.4142
    placed.append({"t": round(t0, 3), "tipo": kind, "nota": note, "dur": round(len(x) / SR, 3), "dB": gain_db})


counts = {}
missing = set()
for k, c in enumerate(CUES):
    kind = c["type"]
    if kind not in LIB:
        missing.add(kind)
        continue
    fn, db = LIB[kind]
    seed = 1000 + k
    if kind == "conteo":
        grp = "total" if "total" in c["note"] else "frio"
        counts[grp] = counts.get(grp, 0) + 1
        x = fn(seed, counts[grp], 12 if grp == "total" else 5)
    else:
        x = fn(seed)
    # la gota y los trazos se mueven un poco en estéreo según el lado del celular en ese momento
    put(kind, np.asarray(x, dtype=np.float64), c["t"], db, PAN.get(kind, 0.0), c.get("note", ""))
if missing:
    raise SystemExit(f"faltan sonidos para: {sorted(missing)}")

mix = np.vstack([L, R])
mix /= max(1e-9, np.abs(mix).max()) / 0.7
out = ROOT / "audio/stems/sfx_raw.wav"
out.parent.mkdir(parents=True, exist_ok=True)
subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "f32le", "-ar", str(SR), "-ac", "2", "-i", "-", "-c:a", "pcm_s24le", str(out)],
               input=mix.T.astype(np.float32).tobytes(), check=True)
(ROOT / "audio/sfx_placed.json").write_text(json.dumps(placed, ensure_ascii=False, indent=1))
print(f"efectos: {len(placed)} cues colocados -> {out}")
