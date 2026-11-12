"""Efectos de sonido sintetizados (biblioteca propia en código), un cue por cada movimiento visible.
Los tiempos salen de timeline/timeline.json. Salidas: audio/stems/sfx_raw.wav y timeline/sfx_cues.json"""
import json, subprocess
from pathlib import Path
import numpy as np
from scipy import signal

V = Path(__file__).resolve().parents[1]
F = json.loads((V / "timeline/timeline.json").read_text())["F"]
SR, DUR = 48000, 18.0
N = int(SR * DUR)
L = np.zeros(N); R = np.zeros(N)
rng = np.random.default_rng(11)
tt = lambda d: np.arange(int(d * SR)) / SR
def filt(x, kind, f, o=2): return signal.sosfilt(signal.butter(o, f, kind, fs=SR, output="sos"), x)
nz = lambda d: rng.standard_normal(int(d * SR))

def impact():   t = tt(0.5); return np.sin(2*np.pi*(55*t + 60*(1-np.exp(-t*30))/30))*np.exp(-t*9) + 0.5*filt(nz(0.5), "low", 900)*np.exp(-t*30)
def clink(f=2400): t = tt(0.35); return (np.sin(2*np.pi*f*t) + 0.6*np.sin(2*np.pi*f*1.52*t) + 0.3*np.sin(2*np.pi*f*2.71*t))*np.exp(-t*16)
def ring():     t = tt(0.9); return filt(nz(0.9), "band", [1800, 5200])*np.exp(-t*4)*np.minimum(1, t*30)*0.6
def click():    t = tt(0.06); return filt(nz(0.06), "high", 2500)*np.exp(-t*90) + 0.5*np.sin(2*np.pi*900*t)*np.exp(-t*70)
def pour(d=0.9, f=700):
    t = tt(d); x = filt(nz(d), "band", [f*0.6, f*2.4])*(0.6 + 0.4*np.sin(2*np.pi*13*t + 3*np.sin(2*np.pi*3*t)))
    bub = sum(np.sin(2*np.pi*(f*1.3 + 500*rng.random())*np.clip(t - s, 0, None))*np.exp(-np.clip(t - s, 0, None)*40)*(t > s) for s in rng.uniform(0, d*0.9, 9))
    return (x + 0.35*bub)*np.minimum(1, t*12)*np.minimum(1, (d - t)*6)
def bloop(f=180): t = tt(0.3); return np.sin(2*np.pi*(f*t + 90*t*t))*np.exp(-t*12)*np.minimum(1, t*200)
def whoosh(d=0.5, f0=500, f1=3000):
    t = tt(d); x = nz(d); out = np.zeros_like(x)
    for k in range(0, len(x), 512):
        fc = f0 + (f1 - f0)*np.sin(np.pi*k/len(x)); sos = signal.butter(2, [fc*0.7, fc*1.4], "band", fs=SR, output="sos")
        out[k:k+512] = signal.sosfilt(sos, x[max(0, k-512):k+512])[-len(x[k:k+512]):]
    return out*np.sin(np.pi*t/d)**2
def tick(f=1500): t = tt(0.05); return np.sin(2*np.pi*f*t)*np.exp(-t*110) + 0.3*filt(nz(0.05), "high", 4000)*np.exp(-t*150)
def swish(d=0.22): t = tt(d); return filt(nz(d), "high", 3000)*np.sin(np.pi*t/d)**2
def thud(f=120): t = tt(0.25); return np.sin(2*np.pi*(f*t - 60*t*t))*np.exp(-t*18) + 0.3*filt(nz(0.25), "low", 500)*np.exp(-t*40)
def sparkle(): t = tt(0.5); return sum(np.sin(2*np.pi*f*t)*np.exp(-t*(9 + i*3)) for i, f in enumerate([3136, 3951, 4699]))*0.4
def press():   t = tt(0.12); return np.sin(2*np.pi*(420*t - 900*t*t))*np.exp(-t*35) + 0.5*click_pad(t)
def click_pad(t): x = np.zeros_like(t); c = click(); x[:len(c)] = c; return x
def wave():    t = tt(0.6); return np.sin(2*np.pi*(700*t + 500*t*t))*np.exp(-t*7)*0.5 + filt(nz(0.6), "band", [2500, 6000])*np.exp(-t*8)*0.4
def scratch(d): t = tt(d); return filt(nz(d), "band", [2200, 5200])*(0.5 + 0.5*np.abs(np.sin(2*np.pi*9*t)))*np.minimum(1, t*20)*np.minimum(1, (d - t)*10)
def hit():     t = tt(1.4); return np.sin(2*np.pi*(34*t + 70*(1-np.exp(-t*14))/14))*np.exp(-t*3.2) + 0.6*filt(nz(1.4), "low", 300)*np.exp(-t*12)

cues = []
def cue(frame, name, x, gain=1.0, pan=0.0):
    i = int(frame / 60 * SR)
    if i >= N: return
    x = x[: N - i]*gain; m = np.abs(x).max() or 1; x = x/m*gain
    L[i:i+len(x)] += x*np.cos((pan + 1)*np.pi/4); R[i:i+len(x)] += x*np.sin((pan + 1)*np.pi/4)
    cues.append({"f": round(frame), "t": round(frame/60, 3), "cue": name})

# 1 · hook
cue(F["land"], "vaso cae", impact(), 1.0); cue(F["ring"] + 2, "anillo de contacto", ring(), 0.35); cue(F["lid"], "tapa asienta", click(), 0.5)
cue(4, "hielo", clink(2600), 0.3, -0.3); cue(9, "hielo", clink(3100), 0.25, 0.3)
cue(F["matcha"][0], "entra el matcha", pour(0.95, 620), 0.5)
for f in (40, 55, 70): cue(f, "se asienta", bloop(170 + f), 0.3)
cue(F["typeIn"], "EN", swish(), 0.3, -0.2); cue(F["typeIn"] + 5, "CAPAS", thud(140), 0.45); cue(F["typePulse"], "pulso CAPAS", thud(90), 0.4)
# 2 · espresso y encabezado
cue(F["espresso"][0], "entra el espresso", pour(0.85, 480), 0.5); cue(132, "hielos chocan", clink(2800), 0.22, 0.2)
cue(150, "difusión", bloop(140), 0.28); cue(170, "se asienta", bloop(200), 0.25)
cue(F["typeOut"][0], "sale el texto", swish(0.3), 0.3); cue(F["morph"][0], "el vaso se alarga", whoosh(0.9, 300, 1800), 0.5)
cue(190, "cristal crece", ring(), 0.22); cue(F["headerIn"], "título", tick(1200), 0.4); cue(F["headerIn"] + 16, "subtítulo", tick(1700), 0.3)
cue(F["photoIn"], "foto", swish(0.35), 0.3, 0.2)
# 3 · Los Chatos
cue(F["scroll1"][0] - 4, "la capa se derrama", pour(0.7, 560), 0.42); cue(F["scroll1"][0], "scroll", whoosh(0.4, 500, 2200), 0.38)
cue(F["chatosTitle"], "LOS CHATOS", thud(130), 0.42)
for i, f in enumerate(F["panels"]): cue(f + 12, "panel de cristal", thud(100 + 20*i), 0.36, -0.3 + 0.3*i); cue(f + 26, "brillo", sparkle(), 0.12, 0.4 - 0.3*i)
for i, f in enumerate(F["minis"]): cue(f, "se llena el mini vaso", pour(0.5, 900 + 150*i), 0.26, -0.5)
# 4 · menú
cue(F["scroll2"][0] - 4, "la capa se derrama", pour(0.7, 520), 0.4)
for k in range(3): cue(F["scroll2"][0] + k*7, "tick de scroll", tick(1400 + 150*k), 0.3)
cue(F["menuTitle"], "MENÚ", thud(130), 0.42); cue(F["menuTitle"] + 10, "llega el vaso", click(), 0.3, 0.5)
for i, f in enumerate(F["cols"]): cue(f + 12, "columna", thud(105 + 15*i), 0.36, -0.4 + 0.8*i)
for k in range(4): cue(F["rows"] + k*7, "renglones", tick(2000 + 120*k), 0.2, -0.3 + 0.2*k)
cue(F["turn"][0], "gira el vaso", whoosh(0.9, 400, 1500), 0.4, 0.5); cue(F["turn"][0] + 14, "se levanta la tapa", click(), 0.35, 0.5)
cue(F["turn"][0] + 30, "hielos", clink(2500), 0.26, 0.5); cue(F["turn"][0] + 40, "hielos", clink(3300), 0.2, 0.4)
cue(F["turnBack"][0], "regresa el vaso", whoosh(0.35, 500, 1400), 0.3, 0.5); cue(F["turnBack"][1] - 2, "tapa", click(), 0.3, 0.5)
# 5 · horario
cue(F["scroll3"][0] - 4, "la capa se derrama", pour(0.7, 460), 0.4)
for k in range(3): cue(F["scroll3"][0] + k*7, "tick de scroll", tick(1400 + 150*k), 0.3)
cue(F["horTitle"], "HORARIO", thud(130), 0.42); cue(F["horPanel"] + 12, "panel", thud(100), 0.36)
for i, f in enumerate(F["horRows"]): cue(f, "día", tick(1800 + 200*i), 0.26)
cue(F["martes"], "Martes descansamos", swish(0.5), 0.34, -0.2); cue(F["martes"] + 30, "se recuestan", bloop(150), 0.3); cue(585, "se asienta", bloop(120), 0.2)
# 6 · ubicación y lift
cue(F["scroll4"][0] - 4, "la capa se derrama", pour(0.7, 500), 0.4)
for k in range(3): cue(F["scroll4"][0] + k*7, "tick de scroll", tick(1400 + 150*k), 0.3)
cue(F["ubiTitle"], "UBICACIÓN", thud(130), 0.42); cue(F["map"] + 12, "mapa", thud(95), 0.36); cue(F["map"] + 18, "manzanas suben", scratch(0.5), 0.14)
cue(F["pin"][0], "cae el pin", swish(0.2), 0.3); cue(F["pin"][0] + 12, "pin toca", thud(210), 0.5); cue(F["pin"][0] + 20, "rebote", tick(900), 0.26)
cue(F["addr"][0], "dirección", tick(1500), 0.28); cue(F["addr"][1], "colonia", tick(1800), 0.24)
cue(F["phone"][0], "la cámara se aleja", whoosh(0.7, 300, 2600), 0.5)
# 7 · teléfono
cue(F["phone"][1] - 2, "revelación", impact(), 0.8); cue(F["iso"][0] + 4, "giro a isométrico", whoosh(0.7, 400, 1700), 0.4)
cue(F["iso"][1] - 4, "el teléfono asienta", thud(85), 0.4); cue(F["bar"], "barra", swish(0.25), 0.26)
cue(F["btnLift"][0], "sube el botón", swish(0.3), 0.3, -0.3); cue(F["btnPulse"], "pulsación", press(), 0.6, -0.3); cue(F["btnPulse"] + 2, "onda", wave(), 0.3, -0.3)
cue(F["chipLift"][0], "sube el chip", swish(0.25), 0.26, 0.3); cue(F["chipPulse"], "pulsación", press(), 0.5, 0.3); cue(F["chipPulse"] + 2, "onda", wave(), 0.24, 0.3)
# 8 · cierre
cue(F["isoBack"][0], "giro final de cámara", whoosh(0.9, 350, 1500), 0.4); cue(F["wipe"][0], "la página se vacía", pour(0.6, 420), 0.34)
cue(F["cup"][0], "vuelve el vaso", whoosh(0.8, 300, 1200), 0.32); cue(900, "se asienta", bloop(150), 0.3); cue(F["lid2"], "tapa", click(), 0.4)
cue(F["cup"][1], "se asienta", bloop(110), 0.3); cue(F["name"][0], "se escribe el nombre", scratch(0.95), 0.2)
cue(F["cut"], "golpe grave", hit(), 1.0); cue(F["cut"] + 2, "end card", swish(0.3), 0.25); cue(F["cut"] + 14, "brillo final", sparkle(), 0.1)

x = np.vstack([L, R]); x /= np.abs(x).max()*1.1
subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "f32le", "-ar", str(SR), "-ac", "2", "-i", "-", "-c:a", "pcm_s24le",
                str(V / "audio/stems/sfx_raw.wav")], input=x.T.astype(np.float32).tobytes(), check=True)
cues.sort(key=lambda c: c["f"])
(V / "timeline/sfx_cues.json").write_text(json.dumps(cues, ensure_ascii=False, indent=0))
print(len(cues), "cues")
