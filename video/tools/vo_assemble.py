"""Coloca la toma de voz (ElevenLabs via vidIQ, voz Brian) en la linea de tiempo de 27 s.

La voz manda: cada linea se corta en sus silencios reales y se coloca en el tiempo de
video definido abajo (ajustado al ritmo natural de la toma). La ultima linea se acelera
5 % (atempo, sin cambio de tono) para terminar antes de 27.0 s.

Salidas:
  video/audio/stems/vo.wav                48 kHz mono, sin normalizar (la mezcla ajusta nivel)
  video/timeline/vo_words.json            palabras con inicio/fin en tiempo de VIDEO
"""
import json
import subprocess
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[2]
VO = ROOT / "video" / "audio" / "vo"
SRC = VO / "vo_take1_brian_48k.wav"
WORDS = VO / "vo_words_raw.json"
OUT_WAV = ROOT / "video" / "audio" / "stems" / "vo.wav"
OUT_JSON = ROOT / "video" / "timeline" / "vo_words.json"
SR = 48000
DUR = 27.0

# (id, texto, inicio de voz en la fuente [silencedetect], fin de voz en la fuente, inicio en VIDEO, tempo)
CLIPS = [
    ("L1", "Alguien acaba de buscar tu estudio.", 0.000, 1.754, 0.40, 1.00),
    ("L2a", "Esto es lo que debería encontrar:", 2.502, 4.111, 2.60, 1.00),
    ("L2b", "veintitrés años de oficio.", 4.661, 6.452, 4.51, 1.00),
    ("L3", "Tu trabajo, ordenado por estilo.", 7.028, 9.036, 6.62, 1.00),
    ("L4", "Cotizaciones con su idea, directo a tu WhatsApp.", 9.360, 12.539, 9.40, 1.00),
    ("L5", "Y en inglés, para quien viene de fuera.", 13.152, 15.139, 14.00, 1.00),
    ("L6a", "Veintitrés años de oficio.", 15.659, 17.157, 20.10, 1.00),
    ("L6b", "Ahora, su propia página.", 17.589, 19.236, 21.90, 1.00),
    ("L7a", "Siniestro Tattoo.", 19.608, 21.048, 23.98, 1.05),
    ("L7b", "Así se vería con Elévate.", 21.586, 22.900, 25.53, 1.05),
]
PRE, POST, FADE = 0.035, 0.10, 0.012


def read_wav(path):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(path), "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32).astype(np.float64)


def tempo(x, factor):
    if abs(factor - 1) < 1e-6:
        return x
    p = subprocess.run(["ffmpeg", "-v", "error", "-f", "f64le", "-ar", str(SR), "-ac", "1", "-i", "-",
                        "-af", f"atempo={factor}", "-f", "f64le", "-"], input=x.astype(np.float64).tobytes(),
                       capture_output=True, check=True)
    return np.frombuffer(p.stdout, dtype=np.float64)


def main():
    src = read_wav(SRC)
    words = json.loads(WORDS.read_text())
    out = np.zeros(int(DUR * SR) + SR, dtype=np.float64)
    placed = []
    for cid, text, s0, s1, v0, tf in CLIPS:
        a = max(0, int((s0 - PRE) * SR))
        b = min(len(src), int((s1 + POST) * SR))
        seg = src[a:b].copy()
        n = int(FADE * SR)
        seg[:n] *= np.linspace(0, 1, n)
        seg[-n:] *= np.linspace(1, 0, n)
        seg = tempo(seg, tf)
        start = int((v0 - PRE / tf) * SR)
        out[start:start + len(seg)] += seg
        # palabras de esta linea (whisper), remapeadas a tiempo de video
        ws = [w for w in words if s0 - 0.25 <= w["start"] < s1 + 0.05]
        mapped = []
        for i, w in enumerate(ws):
            ws_ = max(w["start"], s0) if i == 0 else w["start"]   # la 1a palabra arranca con la voz real
            t0 = v0 + (ws_ - s0) / tf
            t1 = v0 + (min(w["end"], s1 + 0.05) - s0) / tf
            mapped.append({"w": w["w"], "t0": round(t0, 3), "t1": round(t1, 3)})
        placed.append({"id": cid, "text": text, "t0": round(v0, 3), "t1": round(v0 + (s1 - s0) / tf, 3),
                       "tempo": tf, "words": mapped})
    out = out[: int(DUR * SR)]
    OUT_WAV.parent.mkdir(parents=True, exist_ok=True)
    OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "f64le", "-ar", str(SR), "-ac", "1", "-i", "-",
                    "-c:a", "pcm_s24le", str(OUT_WAV)], input=out.tobytes(), check=True)
    OUT_JSON.write_text(json.dumps(placed, ensure_ascii=False, indent=1))
    for c in placed:
        print(f'{c["id"]:4} {c["t0"]:6.2f}-{c["t1"]:6.2f}  ' + "  ".join(f'{w["w"]}@{w["t0"]:.2f}' for w in c["words"]))
    # sin traslapes
    for x, y in zip(placed, placed[1:]):
        assert x["t1"] < y["t0"], (x["id"], y["id"])
    assert placed[-1]["t1"] < 26.85


if __name__ == "__main__":
    main()
