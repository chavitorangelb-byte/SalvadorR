"""Coloca la toma de voz en la linea de tiempo de 27 s (cualquier voz).

1. Agrupa las palabras de Whisper (vo_words_raw.json) en las frases del guion.
2. Afina inicio y fin de cada frase con la envolvente de energia de la toma.
3. Coloca cada frase en su tiempo de video (TARGETS). Si no cabe antes de la siguiente,
   primero usa la holgura, luego acelera esa frase lo minimo (max 6 %, atempo sin cambio de tono).

Uso: python3 video/tools/vo_assemble.py <toma_48k.wav> <palabras_whisper.json>
Salidas: video/audio/stems/vo.wav (48 kHz mono) y video/timeline/vo_words.json (tiempos de VIDEO)
"""
import json
import subprocess
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[2]
SR = 48000
DUR = 27.0
OUT_WAV = ROOT / "video/audio/stems/vo.wav"
OUT_JSON = ROOT / "video/timeline/vo_words.json"

# (id, texto, inicio preferido en VIDEO, inicio mas temprano, inicio mas tarde)
TARGETS = [
    ("L1", "Alguien acaba de buscar tu estudio.", 0.40, 0.30, 0.55),
    ("L2a", "Esto es lo que debería encontrar:", 2.60, 2.45, 2.75),
    ("L2b", "veintitrés años de oficio.", 4.51, 4.45, 4.62),
    ("L3", "Tu trabajo, ordenado por estilo.", 6.62, 6.50, 6.80),
    ("L4", "Cotizaciones con su idea, directo a tu WhatsApp.", 9.45, 9.38, 9.55),
    ("L5", "Y en inglés, para quien viene de fuera.", 14.00, 13.98, 14.05),
    ("L6a", "Veintitrés años de oficio.", 20.10, 20.05, 20.20),
    ("L6b", "Ahora, su propia página.", 21.90, 21.80, 22.05),
    ("L7a", "Siniestro Tattoo.", 23.98, 23.96, 24.02),
    ("L7b", "Así se vería con Elévate.", 25.53, 25.15, 25.62),
]
NEXT_GAP = 0.14          # silencio minimo entre frases
END_LIMIT = 26.78        # la ultima palabra debe terminar antes
MAX_TEMPO = 1.06
PRE, POST, FADE = 0.035, 0.10, 0.012


def read_wav(path):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(path), "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32).astype(np.float64)


def tempo(x, f):
    if abs(f - 1) < 1e-4:
        return x
    p = subprocess.run(["ffmpeg", "-v", "error", "-f", "f64le", "-ar", str(SR), "-ac", "1", "-i", "-", "-af", f"atempo={f:.4f}",
                        "-f", "f64le", "-"], input=x.tobytes(), capture_output=True, check=True)
    return np.frombuffer(p.stdout, dtype=np.float64)


def main(take, words_path):
    src = read_wav(take)
    words = json.loads(Path(words_path).read_text())
    # envolvente (10 ms) para afinar bordes
    hop = int(0.01 * SR)
    rms = np.sqrt(np.convolve(src ** 2, np.ones(hop) / hop, "same")[::hop] + 1e-12)
    db = 20 * np.log10(rms + 1e-9)
    on = db > -42
    def onset(t):
        a, b = int(max(0, t - 0.35) / 0.01), int((t + 0.06) / 0.01)
        idx = np.where(on[a:b])[0]
        return (a + idx[0]) * 0.01 if len(idx) else t
    def offset(t):
        a, b = int(max(0, t - 0.06) / 0.01), int(min(len(on) * 0.01, t + 0.45) / 0.01)
        idx = np.where(on[a:b])[0]
        return (a + idx[-1] + 1) * 0.01 if len(idx) else t

    # 1) agrupar palabras por frase
    k = 0
    clips = []
    for cid, text, v0, vmin, vmax in TARGETS:
        n = len(text.split())
        ws = words[k:k + n]
        if len(ws) < n:
            raise SystemExit(f"faltan palabras para {cid}")
        k += n
        s0, s1 = onset(ws[0]["start"]), offset(ws[-1]["end"])
        clips.append({"id": cid, "text": text, "v0": v0, "vmin": vmin, "vmax": vmax, "s0": s0, "s1": s1, "ws": ws, "tempo": 1.0})
    if k != len(words):
        print(f"aviso: Whisper dio {len(words)} palabras y el guion tiene {k}")

    # 2) acomodar: holgura y, si hace falta, tempo
    for i, c in enumerate(clips):
        prev_end = (clips[i - 1]["v0"] + (clips[i - 1]["s1"] - clips[i - 1]["s0"]) / clips[i - 1]["tempo"]) if i else 0.0
        c["v0"] = max(c["v0"], prev_end + NEXT_GAP)
        nxt = clips[i + 1]["v0"] if i + 1 < len(clips) else END_LIMIT + NEXT_GAP
        room = nxt - NEXT_GAP - c["v0"]
        dur = c["s1"] - c["s0"]
        if dur > room:                                  # primero, adelantarla dentro de su margen
            earliest = max(c["vmin"], prev_end + NEXT_GAP)
            back = min(c["v0"] - earliest, dur - room)
            c["v0"] -= back
            room += back
        if dur > room and i + 1 < len(clips):          # usa la holgura de la siguiente frase
            shift = min(clips[i + 1]["vmax"] - clips[i + 1]["v0"], dur - room)
            clips[i + 1]["v0"] += shift
            room += shift
        if dur > room:
            c["tempo"] = min(MAX_TEMPO, dur / room)
        if dur / c["tempo"] > room + 1e-3:
            raise SystemExit(f"{c['id']} no cabe ni acelerando: dura {dur:.2f} s y hay {room:.2f} s")

    # 3) colocar y exportar
    out = np.zeros(int(DUR * SR) + SR)
    placed = []
    for c in clips:
        a, b = max(0, int((c["s0"] - PRE) * SR)), min(len(src), int((c["s1"] + POST) * SR))
        seg = src[a:b].copy()
        n = int(FADE * SR)
        seg[:n] *= np.linspace(0, 1, n); seg[-n:] *= np.linspace(1, 0, n)
        seg = tempo(seg, c["tempo"])
        start = int((c["v0"] - PRE / c["tempo"]) * SR)
        out[start:start + len(seg)] += seg
        mapped = []
        for j, w in enumerate(c["ws"]):
            ws_ = c["s0"] if j == 0 else w["start"]
            mapped.append({"w": w["w"], "t0": round(c["v0"] + (ws_ - c["s0"]) / c["tempo"], 3),
                           "t1": round(c["v0"] + (min(w["end"], c["s1"]) - c["s0"]) / c["tempo"], 3)})
        placed.append({"id": c["id"], "text": c["text"], "t0": round(c["v0"], 3), "t1": round(c["v0"] + (c["s1"] - c["s0"]) / c["tempo"], 3),
                       "tempo": round(c["tempo"], 4), "src": [round(c["s0"], 3), round(c["s1"], 3)], "words": mapped})
    out = out[: int(DUR * SR)]
    OUT_WAV.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "f64le", "-ar", str(SR), "-ac", "1", "-i", "-", "-c:a", "pcm_s24le", str(OUT_WAV)],
                   input=out.tobytes(), check=True)
    OUT_JSON.write_text(json.dumps(placed, ensure_ascii=False, indent=1))
    for c in placed:
        print(f'{c["id"]:4} {c["t0"]:6.2f}-{c["t1"]:6.2f} x{c["tempo"]:.3f}  ' + "  ".join(f'{w["w"]}@{w["t0"]:.2f}' for w in c["words"]))
    for x, y in zip(placed, placed[1:]):
        assert x["t1"] + 0.05 < y["t0"], (x["id"], y["id"])
    assert placed[-1]["t1"] <= END_LIMIT + 0.01


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
