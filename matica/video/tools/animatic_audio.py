"""Audio del animatic de tiempos: la voz colocada + metrónomo a 92 BPM (acento en cada compás),
golpe en f0 y en 24.00 s, silencio en el respiro (23.00–24.00) y un tic muy bajo en cada tap.
No es la música: solo sirve para juzgar el ritmo.

Uso: python3 matica/video/tools/animatic_audio.py  ->  matica/video/build/animatic/audio.wav
"""
import json
import subprocess
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]           # matica/video
SR = 48000
DUR = 27.0
TL = json.loads((ROOT / "timeline/timeline.json").read_text())
T = TL["T"]
OUT = ROOT / "build/animatic/audio.wav"


def read(path):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(path), "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32).astype(np.float64)


n = int(DUR * SR)
mix = np.zeros(n)
vo = read(ROOT / "audio/stems/vo.wav")[:n]
mix[: len(vo)] += vo

def put(t, sig, gain):
    i = int(t * SR)
    j = min(n, i + len(sig))
    if 0 <= i < n:
        mix[i:j] += gain * sig[: j - i]

tt = np.arange(int(0.03 * SR)) / SR
click = np.sin(2 * np.pi * 1800 * tt) * np.exp(-tt / 0.006)
accent = np.sin(2 * np.pi * 2600 * tt) * np.exp(-tt / 0.008)
th = np.arange(int(0.6 * SR)) / SR
thump = np.sin(2 * np.pi * (52 + 40 * np.exp(-th / 0.05)) * th) * np.exp(-th / 0.18)
tick = np.sin(2 * np.pi * 900 * tt) * np.exp(-tt / 0.004)

beat = 60 / TL["BPM"]
k = 0
while k * beat < DUR:
    t = k * beat
    if not (T["breath"] <= t < T["hit24"]):
        put(t, accent if k % 4 == 0 else click, 0.10 if k % 4 == 0 else 0.06)
    k += 1
put(T["hit0"], thump, 0.55)
put(T["hit24"], thump, 0.70)
for c in TL["SFX"]:
    if c["type"] in ("tap", "enter", "pop", "gota-plic"):
        put(c["t"], tick, 0.08)

peak = np.max(np.abs(mix))
mix *= min(1.0, 0.89 / max(peak, 1e-9))
OUT.parent.mkdir(parents=True, exist_ok=True)
subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "f64le", "-ar", str(SR), "-ac", "1", "-i", "-", "-c:a", "pcm_s16le", str(OUT)],
               input=mix.tobytes(), check=True)
print("audio del animatic ->", OUT.relative_to(ROOT.parent.parent))
