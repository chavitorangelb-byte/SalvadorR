"""Efectos de sonido sintetizados (biblioteca propia en codigo) y su colocacion.

Un cue por cada movimiento visible: tecleo, taps, scroll con friccion, cambio de filtro,
subida de archivo, pop del boton, trazo de la linea de tinta (sutil, como aguja), etc.
Los tiempos salen de la linea de tiempo y del manifiesto de captura (taps, teclas y scrolls reales).
Salidas: video/audio/stems/sfx_raw.wav y video/timeline/sfx_cues.json
"""
import json
import subprocess
from pathlib import Path

import numpy as np
from scipy import signal

ROOT = Path(__file__).resolve().parents[2]
TL = json.loads((ROOT / "video/timeline/timeline.json").read_text())
MAN = json.loads((ROOT / "video/build/capture/manifest.json").read_text())
T = TL["T"]
SR = 48000
N = int(27.0 * SR)
L = np.zeros(N)
R = np.zeros(N)
cues = []
tt = lambda d: np.arange(int(d * SR)) / SR


def filt(x, kind, f, order=2):
    sos = signal.butter(order, f, kind, fs=SR, output="sos")
    return signal.sosfilt(sos, x)


def put(name, x, t0, gain_db=0.0, pan=0.0):
    i = int(round(t0 * SR))
    a, b = max(0, i), min(N, i + len(x))
    if b <= a:
        return
    g = 10 ** (gain_db / 20)
    seg = x[a - i:b - i] * g
    L[a:b] += seg * np.cos((pan + 1) * np.pi / 4) * 1.4142
    R[a:b] += seg * np.sin((pan + 1) * np.pi / 4) * 1.4142
    cues.append({"t": round(t0, 3), "sfx": name, "dur": round(len(x) / SR, 3), "db": gain_db})


def rng_for(seed):
    return np.random.default_rng(seed)


# ---------- biblioteca ----------
def key_click(seed):
    g = rng_for(seed)
    t = tt(0.045)
    n = filt(g.standard_normal(len(t)), "band", [2600, 7400]) * np.exp(-t / 0.006)
    body = np.sin(2 * np.pi * (1650 + 260 * g.random()) * t) * np.exp(-t / 0.004) * 0.35
    thock = np.sin(2 * np.pi * (240 + 40 * g.random()) * t) * np.exp(-t / 0.010) * 0.5
    return n + body + thock


def enter_key():
    t = tt(0.09)
    return (np.sin(2 * np.pi * 190 * t) * np.exp(-t / 0.02) * 0.8 +
            filt(rng_for(3).standard_normal(len(t)), "band", [1800, 6000]) * np.exp(-t / 0.008) * 0.6)


def tap(seed):
    g = rng_for(seed)
    t = tt(0.07)
    thump = np.sin(2 * np.pi * np.cumsum(210 - 90 * t / 0.07) / SR) * np.exp(-t / 0.014)
    tick = filt(g.standard_normal(len(t)), "high", 2400) * np.exp(-t / 0.0035) * 0.5
    return thump * 0.7 + tick


def chip_click(seed):
    a = tap(seed) * 0.6
    t = tt(0.05)
    b = np.sin(2 * np.pi * 2350 * t) * np.exp(-t / 0.006) * 0.25
    out = np.zeros(int(0.12 * SR))
    out[: len(a)] += a
    out[int(0.045 * SR): int(0.045 * SR) + len(b)] += b
    return out


def scroll_swish(d, seed):
    g = rng_for(seed)
    t = tt(d)
    env = np.clip(t / 0.05, 0, 1) * np.exp(-t / (d * 0.38))
    x = filt(g.standard_normal(len(t)), "band", [900, 3600]) * env
    grain = (g.random(len(t)) < 0.002) * g.standard_normal(len(t)) * 0.6
    return x * 0.5 + filt(grain, "band", [1500, 5000]) * env


def bounce_tick():
    t = tt(0.05)
    return np.sin(2 * np.pi * 900 * t) * np.exp(-t / 0.008) * 0.3


def whoosh(d, seed, lo=250, hi=3200, rev=False):
    g = rng_for(seed)
    t = tt(d)
    noise = g.standard_normal(len(t))
    out = np.zeros_like(noise)
    blocks = np.array_split(np.arange(len(t)), 40)
    zi = None
    for k, idx in enumerate(blocks):
        f0 = lo * (hi / lo) ** (k / len(blocks)) if not rev else hi * (lo / hi) ** (k / len(blocks))
        sos = signal.butter(2, [f0, min(f0 * 2, 20000)], "band", fs=SR, output="sos")
        if zi is None:
            zi = signal.sosfilt_zi(sos) * 0
        y, zi = signal.sosfilt(sos, noise[idx], zi=zi)
        out[idx] = y
    env = np.sin(np.pi * np.clip(t / d, 0, 1)) ** 1.6
    return out * env


def thud(seed):
    t = tt(0.16)
    g = rng_for(seed)
    return (np.sin(2 * np.pi * np.cumsum(140 - 70 * t / 0.16) / SR) * np.exp(-t / 0.035) * 0.8 +
            filt(g.standard_normal(len(t)), "band", [600, 2400]) * np.exp(-t / 0.01) * 0.25)


def shuffle(seed):
    out = np.zeros(int(0.42 * SR))
    for k in range(5):
        c = tap(seed * 10 + k) * (0.5 - 0.07 * k)
        i = int((0.03 + k * 0.07) * SR)
        out[i:i + len(c)] += c[: len(out) - i]
    return out


def pop():
    t = tt(0.16)
    f = 520 + 520 * (1 - np.exp(-t / 0.025))
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.05) * 0.8
    click = np.zeros_like(body)
    c = tap(77)[: len(body)]
    click[: len(c)] = c
    return body + click * 0.4


def ding():
    t = tt(0.55)
    return (np.sin(2 * np.pi * 1318 * t) + 0.5 * np.sin(2 * np.pi * 1975 * t)) * np.exp(-t / 0.16) * 0.35


def upload_whir(d):
    t = tt(d)
    f = 380 + 340 * (t / d) ** 1.4
    trem = 0.6 + 0.4 * np.sin(2 * np.pi * 22 * t)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * trem * np.clip(t / 0.05, 0, 1) * np.clip((d - t) / 0.06, 0, 1) * 0.25


def needle(d, seed, speed=1.0):
    """Trazo de la tinta: zumbido de maquina de tatuar muy bajo + rasgueo de punta sobre piel."""
    g = rng_for(seed)
    t = tt(d)
    f = 118 + 6 * np.sin(2 * np.pi * 0.7 * t)
    buzz = np.sign(np.sin(2 * np.pi * np.cumsum(f) / SR)) * 0.5
    buzz = filt(buzz, "band", [180, 1400]) * 0.35
    scratch = filt(g.standard_normal(len(t)), "band", [2200, 7800]) * (0.55 + 0.45 * np.sin(2 * np.pi * 9 * speed * t) ** 2) * 0.5
    env = np.clip(t / 0.03, 0, 1) * np.clip((d - t) / 0.05, 0, 1)
    return (buzz + scratch) * env


def shimmer(d, seed):
    g = rng_for(seed)
    out = np.zeros(int(d * SR))
    for k in range(int(d * 70)):
        f = 2600 + 3800 * g.random()
        gd = 0.03 + 0.04 * g.random()
        t = tt(gd)
        grain = np.sin(2 * np.pi * f * t) * np.sin(np.pi * t / gd) ** 2
        i = int(g.random() * (len(out) - len(grain)))
        out[i:i + len(grain)] += grain * (0.18 + 0.12 * g.random())
    return out * np.sin(np.pi * np.clip(np.arange(len(out)) / len(out), 0, 1))


def glass_tick():
    t = tt(0.35)
    return (np.sin(2 * np.pi * 2637 * t) + 0.6 * np.sin(2 * np.pi * 4186 * t) + 0.3 * np.sin(2 * np.pi * 5274 * t)) * np.exp(-t / 0.07) * 0.22


def impact(seed):
    t = tt(1.0)
    g = rng_for(seed)
    return (filt(g.standard_normal(len(t)), "low", 1800) * np.exp(-t / 0.09) * 0.6 +
            np.sin(2 * np.pi * np.cumsum(60 + 70 * np.exp(-t / 0.05)) / SR) * np.exp(-t / 0.35) * 0.7)


def ping():
    t = tt(0.8)
    return np.sin(2 * np.pi * 880 * t) * np.exp(-t / 0.22) * 0.25 + np.sin(2 * np.pi * 1760 * t) * np.exp(-t / 0.12) * 0.08


def air_sweep(d):
    t = tt(d)
    x = filt(rng_for(41).standard_normal(len(t)), "high", 5200)
    return x * np.sin(np.pi * t / d) ** 2 * 0.35


def kb_slide(up=True):
    return whoosh(0.22, 5 if up else 6, 600, 2600, rev=not up) * 0.6


# ---------- colocacion ----------
put("impacto_f0", impact(1), T["hit0"], -11)
put("cristal_barra", glass_tick(), 0.03, -10, 0.1)
put("tinta_entra", needle(T["inkIntoBar"][1] - T["inkIntoBar"][0] + 0.05, 2, 1.4), T["inkIntoBar"][0], -16)
for i, k in enumerate(TL["typing"]):
    put("tecla", key_click(100 + i), k["t"] - 0.004, -13 + 2 * ((i * 7) % 3 - 1) * 0.5, -0.15 + 0.3 * ((i * 5) % 7) / 6)
put("tinta_bajo_texto", needle(T["type"][1] - T["type"][0], 3, 0.8), T["type"][0], -22)
put("enter", enter_key(), T["enter"], -9)
put("barra_sale", whoosh(0.42, 7, 400, 2800), T["barOut"][0], -15)
put("tinta_contorno", needle(T["inkOutline"][1] - T["inkOutline"][0], 4, 1.8), T["inkOutline"][0], -15)
put("celular_entra", whoosh(0.65, 8, 180, 1800), T["phoneIn"][0], -14)
put("celular_asienta", thud(9), T["phoneSettle"][1] - 0.2, -18)
put("pantalla_enciende", glass_tick() * 0.6, T["screenOn"], -18)
put("push_in", whoosh(0.85, 10, 200, 1400), T["pushTitle"][0], -20)
put("tinta_subraya_23", needle(T["inkUnderline"][1] - T["inkUnderline"][0], 5, 1.2), T["inkUnderline"][0], -15)
put("pull_back", whoosh(0.55, 11, 1400, 250), T["pullHero"][0], -20)

for s in MAN["scrolls"]:
    a, b = s["t"]
    put(f"scroll_{s['to']}", scroll_swish(b - a, 20 + len(cues)), a, -15 if s["to"] != "top" else -12)
    put("rebote", bounce_tick(), b - (b - a) * 0.25, -24)

for k, delay in (("cristo", 0.0), ("leon", 0.06), ("quetzalcoatl", 0.11)):
    put(f"tarjeta_sale_{k}", whoosh(0.5, 30 + len(cues), 300, 3000), T["cardsOut"][0] + delay, -15, {'cristo': -0.2, 'leon': -0.35, 'quetzalcoatl': 0.3}[k])
    put(f"tarjeta_regresa_{k}", thud(40 + len(cues)), T["cardsBack"][1] - 0.04 + delay * 0.3, -14)
put("tarjetas_vuelven", whoosh(0.4, 33, 2600, 400), T["cardsBack"][0], -20)

for tp in MAN["taps"]:
    sel = tp["sel"]
    if "filter" in sel:
        put("tap_filtro", chip_click(50 + len(cues)), tp["t"], -11)
        put("reordena", shuffle(60 + len(cues)), tp["t"] + 0.1, -16)
    elif "lang-btn" in sel:
        put("tap_idioma", tap(70 + len(cues)), tp["t"], -10)
    elif "opt" in sel:
        put("tap_opcion", chip_click(80 + len(cues)), tp["t"], -12)
    elif "drop-btn" in sel:
        put("tap_foto", tap(90 + len(cues)), tp["t"], -11)
    else:
        put("tap", tap(95 + len(cues)), tp["t"], -10)

put("teclado_sube", kb_slide(True), T["kbUp"][0], -18)
for i, k in enumerate(MAN.get("keys", [])):
    put("tecla_formulario", key_click(200 + i), k["t"] - 0.004, -14, 0.0)
put("teclado_baja", kb_slide(False), T["kbDown"][0], -19)
put("subida_foto", upload_whir(T["photoProgress"][1] - T["photoProgress"][0]), T["photoProgress"][0], -16)
put("foto_lista", ding(), T["photoProgress"][1], -17)
put("pop_whatsapp", pop(), T["waLift"][0] - 0.02, -9)
put("whatsapp_3d", whoosh(0.32, 34, 300, 2600), T["waLift"][0], -16)
put("whatsapp_regresa", thud(35), T["waBack"][1] - 0.03, -15)

for name, key, seed in (("tinta_circulo_cta", "inkCircleCta", 6), ("tinta_circulo_enviar", "inkCircleSubmit", 7),
                        ("tinta_circulo_idioma", "inkCircleLang", 8), ("tinta_circulo_pin", "inkCirclePin", 9)):
    a, b = T[key]
    put(name, needle(b - a, seed, 1.5), a, -16)
for g in TL["KINETIC"]:
    for line in g["lines"]:
        for w in line:
            if "underline" in w:
                a, b = w["underline"]
                put(f"tinta_subraya_{w['text'].lower()}", needle(b - a, 12 + len(cues), 1.3), a, -17)

put("morph_en", shimmer(T["morphEN"][1] - T["morphEN"][0], 13), T["morphEN"][0], -15)
put("morph_es", shimmer(T["morphES"][1] - T["morphES"][0], 14), T["morphES"][0], -17)
put("orbita", whoosh(T["orbit"][1] - T["orbit"][0], 15, 160, 900) * 0.6, T["orbit"][0], -24)
put("push_cuidados", whoosh(0.74, 16, 220, 1300), T["pushCare"][0], -21)
put("pin_late", ping(), T["inkCirclePin"][0] + 0.05, -19)
put("pull_back_cierre", whoosh(0.86, 17, 1500, 220), T["pullBack"][0], -16)
for i, (a, b) in enumerate([(T["write1"][0], 20.86), (20.88, T["write1"][1]), (T["write2"][0], 22.40), (22.42, T["write2"][1])]):
    put(f"tinta_escribe_{i + 1}", needle(b - a, 18 + i, 1.0), a, -16)
put("texto_se_va", whoosh(0.32, 19, 2600, 600), T["clear1"][0], -22)
put("salida", whoosh(0.46, 20, 1200, 200), T["outroFade"][0], -20)
put("placa_entra", whoosh(0.6, 21, 200, 2200), T["plateIn"][0], -15)
put("golpe_24", impact(22), T["hit24"], -13)
put("barrido_luz", air_sweep(T["sweep"][1] - T["sweep"][0]), T["sweep"][0], -19)
put("tinta_firma", needle(T["signature"][1] - T["signature"][0], 23, 1.4), T["signature"][0], -15)
put("texto_final", glass_tick() * 0.5, T["tagline"][0], -22)

mix = np.vstack([L, R])
peak = np.abs(mix).max()
mix = mix / max(peak, 1e-9) * 0.7
out = ROOT / "video/audio/stems/sfx_raw.wav"
subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "f32le", "-ar", str(SR), "-ac", "2", "-i", "-", "-c:a", "pcm_s24le", str(out)],
               input=mix.T.astype(np.float32).tobytes(), check=True)
(ROOT / "video/timeline/sfx_cues.json").write_text(json.dumps(sorted(cues, key=lambda c: c["t"]), ensure_ascii=False, indent=1))
print("cues:", len(cues), "->", out)
