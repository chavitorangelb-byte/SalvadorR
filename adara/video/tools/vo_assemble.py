"""Coloca la toma de voz (una sola toma de ElevenLabs) en la linea de tiempo de 22 s.

Cada frase se corta de la toma por sus silencios (envolvente de 10 ms) y se coloca en su hora de video.
No se acelera ni se recorta ninguna frase. Las horas de cada palabra salen de Whisper + el desplazamiento.
Salidas: video/audio/stems/vo_raw.wav (48 kHz mono) y video/timeline/vo_words.json (horas de VIDEO).
Uso: python3 -I adara/video/tools/vo_assemble.py
"""
import json
import subprocess
from pathlib import Path

import numpy as np

V = Path(__file__).resolve().parents[1]
SR = 48000
DUR = 22.0
TAKE = V / "audio/vo/vo_take1_jessica_48k.wav"
WORDS = json.loads((V / "audio/vo/vo_words_raw.json").read_text())

# (id, texto, numero de palabras, inicio en VIDEO)
LINES = [
    ("L1", "Tu idea, hecha pastel.", 4, 0.50),
    ("L2", "Elige el sabor, el relleno y el tamaño.", 8, 3.00),
    ("L3", "Y cuéntanos tu diseño.", 4, 6.00),
    ("L4", "Imagina todo esto en tu propia página.", 7, 8.10),
    ("L5", "Pasteles, cupcakes, galletas y postres.", 5, 10.75),
    ("L6", "Pide por WhatsApp.", 3, 14.20),
    ("L7", "Adara Pastelería. Coyoacán.", 3, 16.40),
    ("L8", "Tu página, desde mil pesos.", 5, 19.30),
]
PRE, POST, FADE = 0.03, 0.12, 0.010


def read(path):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(path), "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32).astype(np.float64)


x = read(TAKE)
hop = SR // 100
env = np.array([np.sqrt(np.mean(x[i:i + hop] ** 2)) for i in range(0, len(x), hop)])
on = 20 * np.log10(env + 1e-9) > -45
segs, i = [], 0
while i < len(on):
    if on[i]:
        j = i
        while j < len(on) and on[j:j + 20].any():
            j += 1
        segs.append((i / 100, j / 100))
        i = j
    else:
        i += 1
assert len(segs) == len(LINES), f"esperaba {len(LINES)} frases, encontre {len(segs)}: {segs}"

out = np.zeros(int(DUR * SR))
res, wi = [], 0
for (lid, text, nw, t0), (s0, s1) in zip(LINES, segs):
    a, b = int((s0 - PRE) * SR), int((s1 + POST) * SR)
    seg = x[max(0, a):b].copy()
    f = int(FADE * SR)
    seg[:f] *= np.linspace(0, 1, f)
    seg[-f:] *= np.linspace(1, 0, f)
    off = t0 - s0
    k = int((t0 - PRE) * SR)
    out[k:k + len(seg)] += seg[: len(out) - k]
    ws = []
    for w in WORDS[wi:wi + nw]:
        ws.append({"w": w["w"], "t0": round(max(t0, w["t0"] + off), 3), "t1": round(w["t1"] + off, 3)})
    wi += nw
    ws[-1]["t1"] = round(s1 + off, 3)
    res.append({"id": lid, "text": text, "t0": t0, "t1": round(s1 + off, 3), "src": [s0, s1], "words": ws})
    print(f"{lid} {t0:6.2f}-{s1 + off:6.2f}  {text}")
assert wi == len(WORDS)
for a, b in zip(res, res[1:]):
    assert a["t1"] + 0.15 <= b["t0"], (a["id"], b["id"])
(V / "audio/stems").mkdir(parents=True, exist_ok=True)
subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "f64le", "-ar", str(SR), "-ac", "1", "-i", "-", "-c:a", "pcm_s24le",
                str(V / "audio/stems/vo_raw.wav")], input=out.tobytes(), check=True)
(V / "timeline/vo_words.json").write_text(json.dumps(res, ensure_ascii=False, indent=1))
