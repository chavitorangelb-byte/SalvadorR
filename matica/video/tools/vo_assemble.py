"""Coloca una toma de voz (ya alineada con vo_align.py) en la línea de tiempo de 27 s.

1. Toma las palabras alineadas de la toma (<toma>_words.json) y arma los clips del guion
   (L7 se parte en "Matíca." y "Así se vería con Elévate." para que la marca caiga con el logo).
2. Afina inicio y fin de cada clip con la envolvente de energía (Whisper suele estirar
   el final de la última palabra hacia el silencio).
3. Coloca cada clip en su tiempo de video. Si no cabe antes del siguiente: primero usa
   su margen, luego empuja al siguiente dentro de su margen y, solo si aún no cabe,
   acelera ese clip lo mínimo (máx. 6 %, atempo: sin cambio de tono).

Uso: python3 matica/video/tools/vo_assemble.py matica/video/audio/vo/<toma>_words.json
Salidas: matica/video/audio/stems/vo.wav (48 kHz mono, 24 bits) y matica/video/timeline/vo_words.json
"""
import json
import subprocess
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[2]          # matica/
SR = 48000
DUR = 27.0
SCRIPT = json.loads((ROOT / "video/timeline/script.json").read_text())
OUT_WAV = ROOT / "video/audio/stems/vo.wav"
OUT_JSON = ROOT / "video/timeline/vo_words.json"

# clips: (id, línea del guion, palabras [i0, i1), inicio preferido, más temprano, más tarde)
L = {l["id"]: l for l in SCRIPT["lines"]}
CLIPS = [(l["id"], l["id"], None, l["t"], l["min_t"], l["max_t"]) for l in SCRIPT["lines"] if l["id"] != "L7"]
CLIPS += [("L7a", "L7", (0, 1), L["L7"]["t"], L["L7"]["min_t"], L["L7"]["max_t"]),
          ("L7b", "L7", (1, 6), 25.05, 24.95, 25.30)]
NEXT_GAP = 0.16          # silencio mínimo entre clips
END_LIMIT = 26.75        # la última palabra termina antes (deja aire al final)
MAX_TEMPO = 1.06
PRE, POST, FADE = 0.035, 0.12, 0.012


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


def main(words_path):
    words_path = Path(words_path)
    data = json.loads(words_path.read_text())
    src = read_wav(words_path.parent / data["wav"])
    words = data["words"]

    hop = int(0.01 * SR)
    rms = np.sqrt(np.convolve(src ** 2, np.ones(hop) / hop, "same")[::hop] + 1e-12)
    db = 20 * np.log10(rms + 1e-9)
    peak = np.percentile(db[db > -60], 95) if np.any(db > -60) else -12.0
    SPEECH = peak - 28.0      # habla (deja fuera respiraciones y ruido de fondo)
    TAIL = peak - 36.0        # cola de la última palabra

    SIL_IN = 12               # un inicio solo cuenta si viene después de >= 120 ms de silencio
    SIL_OUT = 15              # un final, si le siguen >= 150 ms (las oclusivas t/k/p duran menos)

    def onset(t):
        """Inicio real: el primer cuadro de habla sostenida tras el ÚLTIMO silencio de >= 120 ms
        cerca del inicio que dio Whisper. Así no se cuela la cola de la palabra anterior ni la
        oclusión interna de una palabra ("Ma-t-íca"). Sin ese silencio, se respeta a Whisper."""
        a, b = int(max(0, t - 0.40) / 0.01), int(min(len(db) - 3, (t + 0.15) / 0.01))
        best = None
        run = 0
        for k in range(max(0, a - SIL_IN), b):
            if db[k] <= SPEECH:
                run += 1
            else:
                if run >= SIL_IN and k >= a and np.all(db[k:k + 3] > SPEECH):
                    best = k
                run = 0
        return best * 0.01 if best is not None else t

    def offset(t_last_start, t):
        """Fin real: último cuadro sobre la cola antes de >= 150 ms seguidos de silencio,
        nunca antes del final que dio Whisper menos 0.25 s."""
        a, b = int(t_last_start / 0.01), int(min(len(db) * 0.01, t + 0.40) / 0.01)
        idx = np.where(db[a:b] > TAIL)[0]
        if not len(idx):
            return t
        end = idx[0]
        for k in idx:
            if k - end > SIL_OUT:
                break
            end = k
        return max((a + end + 1) * 0.01, t - 0.25)

    clips = []
    for cid, line, rng, v0, vmin, vmax in CLIPS:
        ws = [w for w in words if w["line"] == line]
        if rng:
            ws = ws[rng[0]:rng[1]]
        # palabras que arrancan después de una pausa (inicio de frase, tras coma o punto):
        # su inicio se mide con la energía, Whisper suele errar ahí hasta 0.2 s
        ws = [dict(w) for w in ws]
        for j, w in enumerate(ws):
            if j == 0 or w["start"] - ws[j - 1]["end"] > 0.12 or ws[j - 1]["w"][-1] in ",.":
                w["start"] = round(onset(w["start"]), 3)
                if j:
                    ws[j - 1]["end"] = min(ws[j - 1]["end"], w["start"])
        s0 = ws[0]["start"]
        s1 = offset(ws[-1]["start"], ws[-1]["end"])
        clips.append({"id": cid, "line": line, "text": " ".join(w["w"] for w in ws), "v0": v0, "vmin": vmin, "vmax": vmax,
                      "s0": s0, "s1": s1, "ws": ws, "tempo": 1.0})

    # Acomodo: 1) empujar la siguiente dentro de su margen, 2) adelantar esta dentro del suyo,
    # 3) acelerar lo mínimo (máx. 6 %). Si aun así no cabe, se adelanta la frase anterior
    # dentro de su margen y se vuelve a acomodar todo (hasta 12 intentos).
    pref = [c["v0"] for c in clips]

    def fit():
        for k, c in enumerate(clips):
            c["v0"], c["tempo"] = pref[k], 1.0
        for i, c in enumerate(clips):
            prev_end = (clips[i - 1]["v0"] + (clips[i - 1]["s1"] - clips[i - 1]["s0"]) / clips[i - 1]["tempo"]) if i else 0.0
            c["v0"] = max(c["v0"], prev_end + NEXT_GAP)
            dur = c["s1"] - c["s0"]
            def room():
                nxt = clips[i + 1]["v0"] if i + 1 < len(clips) else END_LIMIT + NEXT_GAP
                return nxt - NEXT_GAP - c["v0"]
            if dur > room() and i + 1 < len(clips):
                shift = min(clips[i + 1]["vmax"] - clips[i + 1]["v0"], dur - room())
                clips[i + 1]["v0"] += max(0.0, shift)
            if dur > room():
                earliest = max(c["vmin"], prev_end + NEXT_GAP)
                c["v0"] -= max(0.0, min(c["v0"] - earliest, dur - room()))
            need = dur - room()
            # antes de acelerar: si la frase anterior aún puede adelantarse, que se adelante
            if need > 1e-3 and i > 0 and pref[i - 1] - clips[i - 1]["vmin"] > 1e-3:
                return i, need, room()
            if need > 1e-3:
                c["tempo"] = min(MAX_TEMPO, dur / room())
            deficit = dur / c["tempo"] - room()
            if deficit > 1e-3:
                return i, deficit, room()
        return None

    for _ in range(12):
        fail = fit()
        if not fail:
            break
        i, deficit, rm = fail
        if i == 0 or pref[i - 1] - clips[i - 1]["vmin"] < 1e-3:
            raise SystemExit(f"{clips[i]['id']} no cabe ni acelerando: le faltan {deficit:.2f} s (hay {rm:.2f} s)")
        pref[i - 1] = max(clips[i - 1]["vmin"], pref[i - 1] - deficit - 0.005)
    else:
        raise SystemExit("no se pudo acomodar la voz")

    out = np.zeros(int(DUR * SR) + SR)
    placed = []
    for c in clips:
        a, b = max(0, int((c["s0"] - PRE) * SR)), min(len(src), int((c["s1"] + POST) * SR))
        seg = src[a:b].copy()
        n = int(FADE * SR)
        seg[:n] *= np.linspace(0, 1, n)
        seg[-n:] *= np.linspace(1, 0, n)
        seg = tempo(seg, c["tempo"])
        start = int((c["v0"] - PRE / c["tempo"]) * SR)
        out[start:start + len(seg)] += seg
        mapped = []
        for j, w in enumerate(c["ws"]):
            ws_ = w["start"]
            we_ = c["s1"] if j == len(c["ws"]) - 1 else min(w["end"], c["s1"])
            mapped.append({"w": w["w"], "t0": round(c["v0"] + (ws_ - c["s0"]) / c["tempo"], 3),
                           "t1": round(c["v0"] + (we_ - c["s0"]) / c["tempo"], 3)})
        placed.append({"id": c["id"], "line": c["line"], "text": c["text"], "t0": round(c["v0"], 3),
                       "t1": round(c["v0"] + (c["s1"] - c["s0"]) / c["tempo"], 3), "tempo": round(c["tempo"], 4),
                       "src": [round(c["s0"], 3), round(c["s1"], 3)], "words": mapped})
    out = out[: int(DUR * SR)]
    OUT_WAV.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "f64le", "-ar", str(SR), "-ac", "1", "-i", "-", "-c:a", "pcm_s24le", str(OUT_WAV)],
                   input=out.tobytes(), check=True)
    OUT_JSON.write_text(json.dumps({"take": data["take"], "clips": placed}, ensure_ascii=False, indent=1))
    for c in placed:
        print(f'{c["id"]:4} {c["t0"]:6.2f}-{c["t1"]:6.2f} x{c["tempo"]:.3f}  ' + "  ".join(f'{w["w"]}@{w["t0"]:.2f}' for w in c["words"]))
    for x, y in zip(placed, placed[1:]):
        assert x["t1"] + 0.05 < y["t0"], (x["id"], y["id"])
    assert placed[-1]["t1"] <= END_LIMIT + 0.01
    print(f"\ntoma: {data['take']} -> {OUT_WAV.relative_to(ROOT.parent)} y {OUT_JSON.relative_to(ROOT.parent)}")


if __name__ == "__main__":
    main(sys.argv[1])
