"""Mezcla final: voz ~ -16 LUFS, música >= 12 dB por debajo de cada palabra (ducking por la voz),
efectos debajo de la voz, master -14 LUFS integrado y pico real <= -1.25 dBTP (limitador con sobremuestreo 4x).
Uso: python3 video/tools/mix.py  ->  video/audio/master.wav, video/audio/stems/*_mix.wav, video/audio/mix_report.json
"""
import json, subprocess
from pathlib import Path
import numpy as np
from scipy.signal import lfilter, resample_poly
import soundfile_shim as sf

ROOT = Path(__file__).resolve().parents[2]
SR = 48000
ST = ROOT / 'video/audio/stems'


def stereo(x):
    return np.repeat(x, 2, 1) if x.shape[1] == 1 else x


def kweight(x):
    # BS.1770 a 48 kHz
    b1, a1 = [1.53512485958697, -2.69169618940638, 1.19839281085285], [1.0, -1.69065929318241, 0.73248077421585]
    b2, a2 = [1.0, -2.0, 1.0], [1.0, -1.99004745483398, 0.99007225036621]
    return lfilter(b2, a2, lfilter(b1, a1, x, axis=0), axis=0)


def momentary(x, hop=0.1, win=0.4):
    k = kweight(x); p = (k ** 2).sum(1)
    w, h = int(win * SR), int(hop * SR)
    c = np.concatenate([[0], np.cumsum(p)])
    idx = np.arange(0, len(p) - w, h)
    ms = (c[idx + w] - c[idx]) / w
    return idx / SR + win / 2, -0.691 + 10 * np.log10(ms + 1e-12)


def integrated(x):
    t, m = momentary(x)
    m = m[m > -70]
    if not len(m):
        return -70
    rel = 10 * np.log10(np.mean(10 ** (m / 10))) - 10
    g = m[m > rel]
    return 10 * np.log10(np.mean(10 ** (g / 10)))


def true_peak_db(x):
    up = resample_poly(x, 4, 1, axis=0)
    return 20 * np.log10(np.abs(up).max() + 1e-12)


def limiter(x, ceil_db=-1.5, look=0.004, release=0.08):
    ceil = 10 ** (ceil_db / 20)
    up = np.abs(resample_poly(x, 4, 1, axis=0)).max(1)
    pk = up[:len(x) * 4].reshape(-1, 4).max(1)[:len(x)]
    need = np.minimum(1, ceil / np.maximum(pk, 1e-9))
    w = int(look * SR)
    # mínimo deslizante (adelantado) y luego media móvil: la ganancia ya bajó cuando llega el pico
    pad = np.concatenate([need, np.ones(w)])
    mins = np.min(np.lib.stride_tricks.sliding_window_view(pad, w + 1), axis=1)[:len(x)]
    sm = np.convolve(np.concatenate([np.ones(w), mins]), np.ones(w) / w, 'valid')[:len(x)]
    g = np.minimum(sm, mins)
    a = np.exp(-1 / (release * SR)); out = np.empty_like(g); cur = 1.0
    for i in range(len(g)):                                  # liberación suave
        cur = g[i] if g[i] < cur else a * cur + (1 - a) * g[i]
        out[i] = cur
    return x * out[:, None]


vo, _ = sf.read(ST / 'vo.wav'); mu, _ = sf.read(ST / 'music.wav'); fx, _ = sf.read(ST / 'sfx.wav')
n = min(len(vo), len(mu), len(fx))
vo, mu, fx = stereo(vo[:n]) * np.sqrt(0.5), mu[:n], fx[:n]
# voz a -16 LUFS
vo *= 10 ** ((-16 - integrated(vo)) / 20)
# actividad de la voz (envolvente rápida) -> ducking de música y efectos
e = np.sqrt(np.convolve((vo ** 2).sum(1), np.ones(int(0.03 * SR)) / int(0.03 * SR), 'same'))
act = (20 * np.log10(e + 1e-9) > -45).astype(float)
att, rel = np.exp(-1 / (0.04 * SR)), np.exp(-1 / (0.35 * SR))
duck = np.empty(n); cur = 0.0
for i in range(n):
    cur = (att * cur + (1 - att) * act[i]) if act[i] > cur else (rel * cur + (1 - rel) * act[i])
    duck[i] = cur
DUCK_MUSIC, DUCK_FX = 9.0, 3.0
mu_d = mu * (10 ** (-DUCK_MUSIC * duck / 20))[:, None]
fx_d = fx * (10 ** (-DUCK_FX * duck / 20))[:, None]
# nivel de música: el más alto que deja >= 12 dB entre voz y música en cada ventana con voz
tv, mv = momentary(vo)
gm = -2.0
for _ in range(40):
    _, mm = momentary(mu_d * 10 ** (gm / 20))
    speech = mv > -24          # ventanas donde la voz está hablando de verdad (hasta 8 dB bajo su nivel)
    margin = (mv - mm)[speech].min()
    if margin >= 12.3:
        break
    gm -= 0.5
music = mu_d * 10 ** (gm / 20)
fxs = fx_d * 10 ** ((-24 - integrated(fx_d)) / 20)
mix = vo + music + fxs
# master: -14 LUFS integrado, pico real <= -1.25 dBTP
g = -14 - integrated(mix)
for _ in range(6):
    out = limiter(mix * 10 ** (g / 20), -1.5)
    li = integrated(out)
    if abs(li + 14) < 0.05:
        break
    g += -14 - li
tp = true_peak_db(out)
out[int(17.5 * SR):] = 0                                     # 0.5 s de silencio al final
sf.write(ROOT / 'video/audio/master.wav', out, SR)
lin = 10 ** (g / 20)                                         # stems con la misma ganancia del master (antes del limitador)
for name, x in (('vo', vo), ('music', music), ('sfx', fxs)):
    sf.write(ST / f'{name}_mix.wav', x * lin, SR)
_, mm = momentary(music); _, ff = momentary(fxs)
rep = {'voz_LUFS': round(integrated(vo), 2), 'musica_LUFS': round(integrated(music), 2), 'sfx_LUFS': round(integrated(fxs), 2),
       'master_LUFS': round(integrated(out), 2), 'master_true_peak_dBTP': round(tp, 2),
       'voz_menos_musica_min_dB_en_ventanas_con_voz': round(float((mv - mm)[mv > -24].min()), 2),
       'voz_menos_sfx_mediana_dB_en_ventanas_con_voz': round(float(np.median((mv - ff)[mv > -24])), 2),
       'ganancia_musica_dB': gm, 'ducking_musica_dB': DUCK_MUSIC}
(ROOT / 'video/audio/mix_report.json').write_text(json.dumps(rep, indent=1, ensure_ascii=False))
print(json.dumps(rep, indent=1, ensure_ascii=False))
