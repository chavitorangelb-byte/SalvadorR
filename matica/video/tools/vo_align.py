"""Alinea una toma de voz palabra por palabra (faster-whisper) y la deja lista para colocarla.

Funciona con cualquier toma (la guía de vidIQ o las de ElevenLabs que mande Salvador):
1. Convierte la toma a WAV 48 kHz mono (video/audio/vo/<nombre>_48k.wav).
2. Transcribe con Whisper (español, marcas por palabra) usando el guion como pista.
3. Empata lo transcrito con las palabras del guion (las del guion mandan en la
   ortografía: "Matíca", "Elévate"...) y guarda <nombre>_words.json.
4. Reporta cuánto dura cada frase contra su ventana del brief.

Uso: HF_HOME=<cache> python3 matica/video/tools/vo_align.py <toma.mp3|wav> [--model medium]
(o todo de una vez: matica/video/tools/relock.sh <toma>)
"""
import json
import re
import subprocess
import sys
import unicodedata
from difflib import SequenceMatcher
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]          # matica/
SCRIPT = json.loads((ROOT / "video/timeline/script.json").read_text())


def norm(w):
    w = unicodedata.normalize("NFD", w.lower())
    w = "".join(c for c in w if unicodedata.category(c) != "Mn")
    return re.sub(r"[^a-z0-9]", "", w)


def main(take, model="medium"):
    take = Path(take)
    out_dir = ROOT / "video/audio/vo"
    out_dir.mkdir(parents=True, exist_ok=True)
    wav = out_dir / f"{take.stem}_48k.wav"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(take), "-ac", "1", "-ar", "48000", "-c:a", "pcm_s24le", str(wav)], check=True)

    import numpy as np
    from faster_whisper import WhisperModel
    # se decodifica con ffmpeg (el PyAV instalado no acepta los argumentos de faster-whisper)
    pcm = subprocess.run(["ffmpeg", "-v", "error", "-i", str(wav), "-ac", "1", "-ar", "16000", "-f", "f32le", "-"],
                         capture_output=True, check=True).stdout
    audio = np.frombuffer(pcm, dtype=np.float32)
    m = WhisperModel(model, device="cpu", compute_type="int8")
    script_text = " ".join(l["text"] for l in SCRIPT["lines"])
    segs, _ = m.transcribe(audio, language="es", word_timestamps=True, beam_size=5,
                           initial_prompt=script_text, condition_on_previous_text=False, vad_filter=False)
    heard = [{"w": w.word.strip(), "start": round(w.start, 3), "end": round(w.end, 3), "p": round(w.probability, 3)}
             for s in segs for w in s.words if w.word.strip()]

    # Empatar con el guion: Whisper puede partir o juntar palabras ("Pet friendly", "Elévate")
    want = [(li, wi, w) for li, l in enumerate(SCRIPT["lines"]) for wi, w in enumerate(l["text"].split())]
    a = [norm(w) for _, _, w in want]
    b = [norm(h["w"]) for h in heard]
    sm = SequenceMatcher(a=a, b=b, autojunk=False)
    times = [None] * len(want)
    for tag, i1, i2, j1, j2 in sm.get_opcodes():
        if tag == "equal":
            for k in range(i2 - i1):
                times[i1 + k] = (heard[j1 + k]["start"], heard[j1 + k]["end"], heard[j1 + k]["p"])
        elif j2 > j1:   # reemplazo: reparte el tramo oído entre las palabras del guion
            t0, t1 = heard[j1]["start"], heard[j2 - 1]["end"]
            n = i2 - i1
            lens = [max(1, len(a[i1 + k])) for k in range(n)]
            acc = 0
            for k in range(n):
                s = t0 + (t1 - t0) * acc / sum(lens)
                acc += lens[k]
                e = t0 + (t1 - t0) * acc / sum(lens)
                times[i1 + k] = (round(s, 3), round(e, 3), 0.0)
    missing = [want[k][2] for k, t in enumerate(times) if t is None]
    if missing:
        raise SystemExit(f"No se oyeron estas palabras del guion: {missing}\nWhisper oyó: {' '.join(h['w'] for h in heard)}")
    words = [{"line": SCRIPT["lines"][li]["id"], "w": w, "start": t[0], "end": t[1], "p": t[2]}
             for (li, wi, w), t in zip(want, times)]
    out_json = out_dir / f"{take.stem}_words.json"
    out_json.write_text(json.dumps({"take": take.name, "wav": wav.name, "heard": heard, "words": words}, ensure_ascii=False, indent=1))

    print(f"Whisper oyó: {' '.join(h['w'] for h in heard)}\n")
    print(f"{'frase':4} {'dura':>6}  {'ventana':>7}  texto")
    for l in SCRIPT["lines"]:
        ws = [w for w in words if w["line"] == l["id"]]
        dur = ws[-1]["end"] - ws[0]["start"]
        flag = "OK" if dur <= l["max"] else "LARGA"
        print(f"{l['id']:4} {dur:6.2f}  {l['max']:7.2f}  {flag:5} {l['text']}")
    print(f"\n-> {out_json.relative_to(ROOT.parent)}  y  {wav.relative_to(ROOT.parent)}")


if __name__ == "__main__":
    args = sys.argv[1:]
    model = "medium"
    if "--model" in args:
        i = args.index("--model"); model = args[i + 1]; args = args[:i] + args[i + 2:]
    main(args[0], model)
