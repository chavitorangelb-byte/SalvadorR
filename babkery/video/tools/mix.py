"""Mezcla y master.

Objetivos del brief:
  voz alrededor de -16 LUFS; musica al menos 12 dB por debajo de CADA palabra;
  master -14 LUFS integrados, -1.25 dBTP.
Loudness con ponderacion K y compuerta (ITU-R BS.1770 / EBU R128). El ducking de la musica
sigue a la voz (ataque con anticipacion, liberacion suave) y su profundidad se calcula para
que la condicion de 12 dB se cumpla palabra por palabra.
Salidas en babkery/video/audio/: stems/voz.wav, stems/musica.wav, stems/sfx.wav, stems/master.wav y mix_report.json
"""
import json
import subprocess
from pathlib import Path

import numpy as np
from scipy import signal

V = Path(__file__).resolve().parents[1]
A = V / "audio"
MUSIC_BASE = -14.5      # musica sin ducking (stem); en los tramos sin voz es la que lleva el peso
SR = 48000
TL = json.loads((V / "timeline/timeline.json").read_text())
N = int(TL["dur"] * SR)
# ventanas por palabra: desde su arranque hasta el arranque de la siguiente (o el fin de la frase)
VO_WORDS = []
for p in TL["vo"]:
    ws = p["words"]
    VO_WORDS.append({"words": [{"w": w["w"], "t0": w["t"], "t1": (ws[i + 1]["t"] if i + 1 < len(ws) else p["end"])} for i, w in enumerate(ws)]})


def read(path, ch):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(path), "-ac", str(ch), "-ar", str(SR), "-f", "f32le", "-"],
                         capture_output=True, check=True).stdout
    x = np.frombuffer(raw, dtype=np.float32).astype(np.float64).reshape(-1, ch).T
    out = np.zeros((ch, N))
    out[:, : min(N, x.shape[1])] = x[:, :N]
    return out


def write(path, x):
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "f32le", "-ar", str(SR), "-ac", str(x.shape[0]), "-i", "-",
                    "-c:a", "pcm_s24le", str(path)], input=x.T.astype(np.float32).tobytes(), check=True)


# --- BS.1770 ---
K1 = ([1.53512485958697, -2.69169618940638, 1.19839281085285], [1.0, -1.69065929318241, 0.73248077421585])
K2 = ([1.0, -2.0, 1.0], [1.0, -1.99004745483398, 0.99007225036621])


def kweight(x):
    y = signal.lfilter(*K1, x, axis=-1)
    return signal.lfilter(*K2, y, axis=-1)


def ms_blocks(xk, win=0.4, hop=0.1):
    w, h = int(win * SR), int(hop * SR)
    sq = (xk ** 2).sum(axis=0)
    c = np.concatenate([[0], np.cumsum(sq)])
    starts = np.arange(0, len(sq) - w + 1, h)
    return (c[starts + w] - c[starts]) / w


def integrated(x):
    z = ms_blocks(kweight(x))
    lk = -0.691 + 10 * np.log10(z + 1e-12)
    z = z[lk > -70]
    if not len(z):
        return -70.0
    rel = -0.691 + 10 * np.log10(z.mean()) - 10
    z2 = z[(-0.691 + 10 * np.log10(z)) > rel]
    return -0.691 + 10 * np.log10(z2.mean())


def window_loudness(xk, t0, t1):
    a, b = int(t0 * SR), max(int(t0 * SR) + 1, int(t1 * SR))
    return -0.691 + 10 * np.log10((xk[:, a:b] ** 2).sum(axis=0).mean() + 1e-12)


def true_peak_db(x):
    up = signal.resample_poly(x, 4, 1, axis=-1)
    return 20 * np.log10(np.abs(up).max() + 1e-12)


def env_follow(active, attack=0.025, release=0.22, look=0.04):
    """1 donde hay voz (con anticipacion), suavizado."""
    sh = int(look * SR)
    a = np.concatenate([active[sh:], np.zeros(sh)])
    a = np.maximum(a, active)
    out = np.zeros_like(a)
    ka, kr = np.exp(-1 / (attack * SR)), np.exp(-1 / (release * SR))
    y = 0.0
    for i in range(0, len(a), 32):          # por bloques de 32 muestras (rapido y suficiente)
        v = a[i:i + 32].max()
        k = ka if v > y else kr
        y = v + (y - v) * (k ** 32)
        out[i:i + 32] = y
    return out


def limiter(x, ceil_db=-1.25, look=0.0015, release=0.06):
    ceil = 10 ** (ceil_db / 20)
    up = signal.resample_poly(x, 4, 1, axis=-1)
    pk = np.abs(up).max(axis=0).reshape(-1, 4).max(axis=1)[: x.shape[1]]
    need = np.minimum(1.0, ceil / np.maximum(pk, 1e-12))
    lk = int(look * SR)
    need = np.minimum.accumulate(np.concatenate([need[lk:], np.ones(lk)])[::-1])[::-1] if False else need
    # minimo en ventana de anticipacion
    from scipy.ndimage import minimum_filter1d
    g = minimum_filter1d(need, size=2 * lk + 1, origin=0)
    kr = np.exp(-1 / (release * SR))
    out = np.empty_like(g)
    y = 1.0
    for i in range(len(g)):
        y = g[i] if g[i] < y else g[i] + (y - g[i]) * kr
        out[i] = y
    return x * out, float(20 * np.log10(out.min()))


def main():
    vo = read(A / "vo/voz_colocada.wav", 1)
    mu = read(A / "stems/music_raw.wav", 2)
    fx = read(A / "stems/sfx_raw.wav", 2)
    vo2 = np.vstack([vo[0], vo[0]]) * (10 ** (-3 / 20))      # voz centrada en estereo (-3 dB por canal)

    # 1) voz a -16 LUFS
    g_vo = 10 ** ((-16.0 - integrated(vo2)) / 20)
    vo2 *= g_vo

    # 2) envolvente de voz por frase (cada frase con su propia profundidad de ducking)
    envs = []
    for line in VO_WORDS:
        act = np.zeros(N)
        for w in line["words"]:
            act[int(max(0, w["t0"] - 0.02) * SR): int((w["t1"] + 0.03) * SR)] = 1.0
        envs.append(env_follow(act))
    duck_env = np.clip(np.sum(envs, axis=0), 0, 1)

    # 3) musica: presente en los tramos instrumentales; bajo cada palabra, justo 12.5 dB debajo
    mu *= 10 ** ((MUSIC_BASE - integrated(mu)) / 20)
    vk = kweight(vo2)
    words = [w for line in VO_WORDS for w in line["words"]]
    mk0 = kweight(mu)
    depths = []
    for line in VO_WORDS:
        need = max(window_loudness(mk0, w["t0"], w["t1"]) - (window_loudness(vk, w["t0"], w["t1"]) - 12.5) for w in line["words"])
        depths.append(max(0.0, need))

    def music_with(extra):
        dd = np.zeros(N)
        for e, d in zip(envs, depths):
            dd = np.maximum(dd, e * (d + extra))
        return mu * 10 ** (-dd / 20)

    extra = 0.0
    for _ in range(30):
        mk = kweight(music_with(extra))
        worst = min(window_loudness(vk, w["t0"], w["t1"]) - window_loudness(mk, w["t0"], w["t1"]) for w in words)
        if worst >= 12.2:
            break
        extra += 0.5
    mu_d = music_with(extra)
    depth = max(depths) + extra

    # 4) efectos: debajo de la voz y con un ducking leve mientras habla
    fx *= 10 ** ((-22.5 - integrated(fx)) / 20)
    fx_d = fx * 10 ** (-4.0 * duck_env / 20)

    pre = vo2 + mu_d + fx_d
    g_master = 10 ** ((-14.0 - integrated(pre)) / 20)
    vo_f, mu_f, fx_f = vo2 * g_master, mu_d * g_master, fx_d * g_master
    master, gr = limiter(vo_f + mu_f + fx_f, -1.7)
    # el limitador baja un poco el integrado: compensa una vez y vuelve a limitar
    adj = 10 ** ((-14.0 - integrated(master)) / 20)
    vo_f, mu_f, fx_f = vo_f * adj, mu_f * adj, fx_f * adj
    master, gr = limiter(vo_f + mu_f + fx_f, -1.7)

    write(A / "stems/voz.wav", vo_f)
    write(A / "stems/musica.wav", mu_f)
    write(A / "stems/sfx.wav", fx_f)
    write(A / "stems/master.wav", master)

    mk = kweight(mu_f); vk = kweight(vo_f)
    per_word = [{"w": w["w"], "t": w["t0"], "voz": round(window_loudness(vk, w["t0"], w["t1"]), 1),
                 "musica": round(window_loudness(mk, w["t0"], w["t1"]), 1)} for w in words]
    for p in per_word:
        p["dif"] = round(p["voz"] - p["musica"], 1)
    rep = {
        "master_LUFS": round(integrated(master), 2), "master_dBTP": round(true_peak_db(master), 2),
        "voz_LUFS": round(integrated(vo_f), 2), "musica_LUFS": round(integrated(mu_f), 2), "sfx_LUFS": round(integrated(fx_f), 2),
        "ducking_dB": round(depth, 1), "limitador_max_dB": round(gr, 2),
        "palabra_peor": min(per_word, key=lambda p: p["dif"]), "palabras": per_word,
    }
    (A / "mix_report.json").write_text(json.dumps(rep, ensure_ascii=False, indent=1))
    print({k: v for k, v in rep.items() if k != "palabras"})


if __name__ == "__main__":
    main()
