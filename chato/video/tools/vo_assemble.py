"""Coloca cada línea de la toma en su tiempo de la línea de tiempo (sin acelerar la voz).
Salidas: audio/stems/voz.wav (48 kHz, 18 s) y timeline/vo_words.json (palabra -> tiempo y cuadro)."""
import json, subprocess, wave
from pathlib import Path
import numpy as np

V = Path(__file__).resolve().parents[1]
SR, DUR, FPS = 48000, 18.0, 60
# (inicio y fin de la línea en la toma, inicio en el video)
LINES = [
    ("Un buen cafecito se sirve en capas.",                           0.00,  2.60,  0.40),
    ("Y tu negocio, con una página que también lo sea.",              3.05,  6.15,  4.10),
    ("Tus bebidas, tu horario y tu ubicación, ahora en el celular.",  6.36, 10.45,  7.70),
    ("Así se vería la página de Chato Cafecito.",                    10.60, 13.32, 12.10),
    ("Si te gusta, la hacemos realidad.",                            13.48, 15.80, 14.80),
]
w = wave.open(str(V / "audio/vo/vo_take1_hope_48k.wav"))
src = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float64) / 32768
words = json.loads((V / "audio/vo/vo_words_raw.json").read_text())
out = np.zeros(int(DUR * SR))
tl = []
for text, a, b, t0 in LINES:
    seg = src[int(a * SR):int(b * SR)].copy()
    f = int(0.012 * SR)
    seg[:f] *= np.linspace(0, 1, f); seg[-f:] *= np.linspace(1, 0, f)
    # el primer sonido de la línea cae en t0: se descuenta el aire previo
    first = min(x["s"] for x in words if a - 0.05 <= x["s"] < b)
    start = int((t0 - (first - a)) * SR)
    out[start:start + len(seg)] += seg
    ws = [{"w": x["w"], "t": round(t0 + x["s"] - first, 3), "f": round((t0 + x["s"] - first) * FPS)}
          for x in words if a - 0.05 <= x["s"] < b]
    tl.append({"text": text, "t": t0, "f": round(t0 * FPS), "end": round(t0 + (b - first), 2), "words": ws})
raw = V / "audio/stems/voz_raw.wav"
with wave.open(str(raw), "w") as o:
    o.setnchannels(1); o.setsampwidth(2); o.setframerate(SR)
    o.writeframes((np.clip(out, -1, 1) * 32767).astype(np.int16).tobytes())
# nivel: -16 LUFS integrados, pico real <= -1.5 dBTP
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(raw), "-af", "loudnorm=I=-16:TP=-1.5:LRA=7:linear=true",
                "-ar", str(SR), "-c:a", "pcm_s24le", str(V / "audio/stems/voz.wav")], check=True)
raw.unlink()
(V / "timeline/vo_words.json").write_text(json.dumps(tl, ensure_ascii=False, indent=1))
for l in tl:
    print(f"{l['t']:5.2f}-{l['end']:5.2f}  {l['text']}")
    print("       " + " · ".join(f"{x['w']} f{x['f']:04d}" for x in l["words"]))
