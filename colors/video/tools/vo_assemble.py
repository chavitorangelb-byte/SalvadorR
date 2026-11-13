"""Coloca la toma de voz (ElevenLabs) en la linea de tiempo de 18 s y la amarra palabra por palabra.

1. Transcribe con tiempos por palabra (faster-whisper) y separa las 8 frases del guion por sus pausas.
2. Afina inicio y fin de cada frase con la energia de la toma.
3. Coloca cada frase en su inicio preferido. Si no cabe: usa holgura y, como ultimo recurso, acelera
   esa frase lo minimo (max 6 %, sin cambiar el tono). Nunca se inventa audio.
Uso: python3 colors/video/tools/vo_assemble.py <toma.mp3|wav> [--model small]
Salidas: video/audio/stems/vo.wav (48 kHz mono) y video/timeline/vo_words.json (tiempos de VIDEO)
"""
import json
import re
import subprocess
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[2]
SR, DUR = 48000, 18.0
OUT_WAV, OUT_JSON = ROOT / "video/audio/stems/vo.wav", ROOT / "video/timeline/vo_words.json"
# (id, texto, inicio preferido, mas temprano, mas tarde)
TARGETS = [
    ("L1", "Algo único para ese día especial.", 0.50, 0.42, 0.62),
    ("L2", "Bouquets, orquídeas y cajas de flores.", 3.85, 3.70, 4.05),
    ("L3", "Flores y follajes de alta calidad.", 6.00, 5.95, 6.25),
    ("L4", "Imagina todo esto en tu propia página.", 8.20, 8.05, 8.40),
    ("L5", "Y centros de mesa para tus eventos.", 10.40, 10.30, 10.65),
    ("L6", "Pide por WhatsApp.", 12.40, 12.35, 12.65),
    ("L7", "Colors Boutique. Querétaro.", 14.40, 14.25, 14.65),
    ("L8", "Tu página, desde mil pesos.", 16.30, 16.15, 16.50),
]
NEXT_GAP, END_LIMIT, MAX_TEMPO = 0.12, 17.85, 1.06
PRE, POST, FADE = 0.035, 0.10, 0.012
syl = lambda w: max(1, len(re.findall(r"[aeiouáéíóúü]+", w.lower())))


def read_wav(path):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(path), "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"], capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32).astype(np.float64)


def tempo(x, f):
    if abs(f - 1) < 1e-4:
        return x
    p = subprocess.run(["ffmpeg", "-v", "error", "-f", "f64le", "-ar", str(SR), "-ac", "1", "-i", "-", "-af", f"atempo={f:.4f}", "-f", "f64le", "-"], input=x.tobytes(), capture_output=True, check=True)
    return np.frombuffer(p.stdout, dtype=np.float64)


def transcribe(path, model):
    from faster_whisper import WhisperModel
    m = WhisperModel(model, device="cpu", compute_type="int8")
    segs, _ = m.transcribe(str(path), language="es", word_timestamps=True, vad_filter=False,
                           initial_prompt="Colors Boutique, Querétaro. Bouquets, orquídeas y cajas de flores. Pide por WhatsApp.")
    return [{"w": w.word.strip(), "start": float(w.start), "end": float(w.end)} for s in segs for w in s.words if w.word.strip()]


def main(take, model="small"):
    src = read_wav(take)
    words = transcribe(take, model)
    print("transcripcion:", " ".join(w["w"] for w in words))
    (ROOT / "video/audio/vo").mkdir(parents=True, exist_ok=True)
    (ROOT / "video/audio/vo/vo_words_raw.json").write_text(json.dumps(words, ensure_ascii=False, indent=1))
    hop = int(0.01 * SR)
    rms = np.sqrt(np.convolve(src ** 2, np.ones(hop) / hop, "same")[::hop] + 1e-12)
    on = 20 * np.log10(rms + 1e-9) > (20 * np.log10(rms.max()) - 38)

    def onset(t):
        a, b = int(max(0, t - 0.35) / 0.01), int((t + 0.08) / 0.01); idx = np.where(on[a:b])[0]
        return (a + idx[0]) * 0.01 if len(idx) else t

    def offset(t):
        a, b = int(max(0, t - 0.08) / 0.01), int(min(len(on) * 0.01, t + 0.5) / 0.01); idx = np.where(on[a:b])[0]
        return (a + idx[-1] + 1) * 0.01 if len(idx) else t

    # 1) las 7 pausas mas largas entre palabras separan las 8 frases
    gaps = sorted(range(1, len(words)), key=lambda i: words[i]["start"] - words[i - 1]["end"], reverse=True)[: len(TARGETS) - 1]
    cuts = [0] + sorted(gaps) + [len(words)]
    clips = []
    for (cid, text, v0, vmin, vmax), a, b in zip(TARGETS, cuts, cuts[1:]):
        ws, script = words[a:b], text.split()
        s0, s1 = onset(ws[0]["start"]), offset(ws[-1]["end"])
        if len(ws) == len(script):
            tw = [(max(s0, w["start"]) if j else s0, min(s1, w["end"])) for j, w in enumerate(ws)]
        else:                                           # conteo distinto: reparte la frase por silabas
            print(f"aviso {cid}: la transcripcion dio {len(ws)} palabras y el guion {len(script)}; reparto por silabas")
            tot = sum(syl(w) for w in script); acc = 0; tw = []
            for w in script:
                tw.append((s0 + (s1 - s0) * acc / tot, s0 + (s1 - s0) * (acc + syl(w)) / tot)); acc += syl(w)
        clips.append({"id": cid, "text": text, "v0": v0, "vmin": vmin, "vmax": vmax, "s0": s0, "s1": s1, "script": script, "tw": tw, "tempo": 1.0,
                      "heard": " ".join(w["w"] for w in ws)})
    # 2) acomodar
    for i, c in enumerate(clips):
        prev_end = (clips[i - 1]["v0"] + (clips[i - 1]["s1"] - clips[i - 1]["s0"]) / clips[i - 1]["tempo"]) if i else 0.0
        c["v0"] = max(c["v0"], prev_end + NEXT_GAP)
        nxt = clips[i + 1]["v0"] if i + 1 < len(clips) else END_LIMIT + NEXT_GAP
        room, dur = nxt - NEXT_GAP - c["v0"], c["s1"] - c["s0"]
        if dur > room:
            back = min(c["v0"] - max(c["vmin"], prev_end + NEXT_GAP), dur - room); back = max(0, back)
            c["v0"] -= back; room += back
        if dur > room and i + 1 < len(clips):
            shift = min(clips[i + 1]["vmax"] - clips[i + 1]["v0"], dur - room); shift = max(0, shift)
            clips[i + 1]["v0"] += shift; room += shift
        if dur > room:
            c["tempo"] = dur / room
            if c["tempo"] > MAX_TEMPO:
                print(f"AVISO {c['id']}: dura {dur:.2f} s y hay {room:.2f} s; haria falta x{c['tempo']:.3f} (max {MAX_TEMPO}). Hay que mover la linea de tiempo.")
    # 3) colocar
    out = np.zeros(int(DUR * SR) + SR); placed = []
    for c in clips:
        a, b = max(0, int((c["s0"] - PRE) * SR)), min(len(src), int((c["s1"] + POST) * SR))
        seg = src[a:b].copy(); n = int(FADE * SR)
        seg[:n] *= np.linspace(0, 1, n); seg[-n:] *= np.linspace(1, 0, n)
        seg = tempo(seg, c["tempo"])
        start = max(0, int((c["v0"] - PRE / c["tempo"]) * SR))
        out[start:start + len(seg)] += seg
        mapped = [{"w": w, "t0": round(c["v0"] + (t0 - c["s0"]) / c["tempo"], 3), "t1": round(c["v0"] + (t1 - c["s0"]) / c["tempo"], 3)} for w, (t0, t1) in zip(c["script"], c["tw"])]
        placed.append({"id": c["id"], "text": c["text"], "heard": c["heard"], "t0": round(c["v0"], 3), "t1": round(c["v0"] + (c["s1"] - c["s0"]) / c["tempo"], 3),
                       "tempo": round(c["tempo"], 4), "src": [round(c["s0"], 3), round(c["s1"], 3)], "words": mapped})
    out = out[: int(DUR * SR)]
    OUT_WAV.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "f64le", "-ar", str(SR), "-ac", "1", "-i", "-", "-c:a", "pcm_s24le", str(OUT_WAV)], input=out.tobytes(), check=True)
    OUT_JSON.write_text(json.dumps(placed, ensure_ascii=False, indent=1))
    for c in placed:
        print(f'{c["id"]:3} {c["t0"]:6.2f}-{c["t1"]:6.2f} x{c["tempo"]:.3f} [{c["heard"]}]  ' + "  ".join(f'{w["w"]}@{w["t0"]:.2f}' for w in c["words"]))


if __name__ == "__main__":
    a = [x for x in sys.argv[1:] if not x.startswith("--")]
    main(a[0], sys.argv[sys.argv.index("--model") + 1] if "--model" in sys.argv else "small")
