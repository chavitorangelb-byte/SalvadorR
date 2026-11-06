"""Mezcla final de DIPROLASER.

- Voz (audio/vo/voz.wav) a -16 LUFS integrados.
- Musica con ducking: en cada ventana corta (400 ms) queda al menos 12 dB debajo de la voz;
  sin voz sube a su nivel de cama (-24 LUFS corto plazo) y en el end card un poco mas.
- SFX: nivel de cama propio y al menos 8 dB debajo de la voz donde se cruzan.
- Master: ganancia a -14 LUFS integrados y limitador de pico real (4x sobremuestreo) a -1 dBTP.
- Version sin musica: voz + SFX con el mismo master.
Salidas (audio/stems/): voz.wav, musica.wav, sfx.wav (tal como entran al master), master_con_musica.wav,
master_sin_musica.wav y mezcla_reporte.json con las mediciones.
"""
import json, wave
from pathlib import Path
import numpy as np
import pyloudnorm as pyln
from scipy import signal

P = Path(__file__).resolve().parents[2]
SR = 48000
TL = json.loads((P / 'timeline/timeline.json').read_text())
DUR = TL['duration']; N = int(DUR * SR)
meter = pyln.Meter(SR)


def read(p):
    with wave.open(str(p)) as w:
        ch, sw, sr, n = w.getnchannels(), w.getsampwidth(), w.getframerate(), w.getnframes()
        raw = w.readframes(n)
        if sw == 2: x = np.frombuffer(raw, '<i2').astype(np.float64) / 32768
        else:
            b = np.frombuffer(raw, np.uint8).reshape(-1, 3)
            x = (np.pad(b, ((0, 0), (1, 0))).copy().view('<i4').reshape(-1).astype(np.float64)) / 2 ** 31
    x = x.reshape(-1, ch)
    if ch == 1: x = np.repeat(x, 2, 1)
    assert sr == SR
    out = np.zeros((N, 2)); out[:min(N, len(x))] = x[:N]
    return out


def write(p, x):
    with wave.open(str(p), 'wb') as w:
        w.setnchannels(2); w.setsampwidth(3); w.setframerate(SR)
        y = np.clip(x, -1, 1 - 2 ** -23)
        b = (y * 2 ** 23).astype('<i4').reshape(-1)
        w.writeframes(np.frombuffer(b.tobytes(), np.uint8).reshape(-1, 4)[:, :3].tobytes())


def lufs(x): return meter.integrated_loudness(x)
def db(g): return 20 * np.log10(max(g, 1e-12))


def short_term(x, win=0.4, hop=0.05):
    """sonoridad de corto plazo (K-ponderada) por ventana; devuelve tiempos y LUFS"""
    k = x.copy()
    # filtro K (BS.1770) via pyloudnorm
    for f in meter._filters.values(): k = np.stack([f.apply_filter(k[:, c]) for c in range(2)], 1)
    w, h = int(win * SR), int(hop * SR)
    ts, v = [], []
    for i in range(0, len(k) - w, h):
        ms = np.mean(k[i:i + w] ** 2, 0).sum()
        ts.append((i + w / 2) / SR); v.append(-0.691 + 10 * np.log10(ms + 1e-12))
    return np.array(ts), np.array(v)


def smooth_gain(g_db, hop=0.05, att=0.06, rel=0.35):
    out = np.zeros_like(g_db); cur = g_db[0]
    for i, g in enumerate(g_db):
        a = hop / att if g < cur else hop / rel
        cur += (g - cur) * min(1, a); out[i] = cur
    return out


def gain_curve(ts, g_db):
    return 10 ** (np.interp(np.arange(N) / SR, ts, g_db) / 20)[:, None]


def true_peak_limit(x, ceil_db=-1.0, look=0.002, rel=0.08):
    up = signal.resample_poly(x, 4, 1, axis=0)
    pk = np.abs(up).max(1).reshape(-1, 4).max(1)[:len(x)]
    pk = np.pad(pk, (0, len(x) - len(pk)), constant_values=0)
    ceil = 10 ** (ceil_db / 20) * 0.985
    need = np.minimum(1.0, ceil / np.maximum(pk, 1e-9))
    la = int(look * SR)
    need = np.minimum.accumulate(np.lib.stride_tricks.sliding_window_view(np.pad(need, (0, la), constant_values=1), la + 1).min(1)[None, :], axis=0)[0]
    g = np.ones_like(need); cur = 1.0; r = 1 / (rel * SR)
    for i, v in enumerate(need):
        cur = v if v < cur else min(v, cur + r); g[i] = cur
    return x * g[:, None]


def true_peak_db(x):
    up = signal.resample_poly(x, 4, 1, axis=0)
    return db(np.abs(up).max())


voz = read(P / 'audio/vo/voz.wav')
mus = read(P / 'audio/stems/musica_raw.wav')
sfx = read(P / 'audio/stems/sfx_raw.wav')

# 1) voz a -16 LUFS
voz *= 10 ** ((-16 - lufs(voz)) / 20)
tv, lv = short_term(voz)
active = lv > -40

# 2) musica: nivel de cama y ducking contra la voz
mus *= 10 ** ((-23 - lufs(mus)) / 20)
tm, lm = short_term(mus)
# cama por escena: sigue el arco (crece en S4-S5, baja en S6, golpe en S7, abre en el end card)
SCN = {s['id']: s for s in TL['scenes']}
BED = [(0, -26), (SCN['S2']['t0'], -24), (SCN['S3']['t0'], -23), (SCN['S4']['t0'], -21), (SCN['S5']['t0'], -19.5),
       (SCN['S6']['t0'], -25.5), (SCN['S7']['t0'], -21), (SCN['S8']['t0'], -22.5), (33.0, -18.5), (DUR, -18.5)]
bed = np.interp(tm, [b[0] for b in BED], [b[1] for b in BED])
g = bed - lm                                                          # lleva la musica a su cama
lim = np.where(active, (lv - 13.0) - lm, 99.0)                       # >= 12 dB (con 1 dB de margen) bajo la voz
# anticipacion: el limite rige en las ventanas vecinas (las de 400 ms se traslapan con la frase)
from scipy.ndimage import minimum_filter1d
lim = minimum_filter1d(lim, size=11, mode='nearest')
g = np.minimum(g, lim)
g = np.clip(g, -30, 8)
gm = smooth_gain(g)
gm = np.minimum(gm, lim)                                             # el suavizado nunca rompe el margen
mus_out = mus * gain_curve(tm, gm)

# 3) SFX: cama propia y >= 8 dB bajo la voz
sfx *= 10 ** ((-25 - lufs(sfx)) / 20)
ts_, ls_ = short_term(sfx)
lim_s = np.where(active, (lv - 8.0) - ls_, 99.0)
gs = smooth_gain(np.clip(np.minimum(0.0, lim_s), -20, 0), att=0.03, rel=0.2)
gs = np.minimum(gs, np.maximum(lim_s, -20))
sfx_out = sfx * gain_curve(ts_, gs)


def master(parts):
    x = sum(parts)
    gain = 10 ** ((-14 - lufs(x)) / 20)
    y = true_peak_limit(x * gain)
    # segunda pasada fina de sonoridad tras el limitador
    g2 = 10 ** ((-14 - lufs(y)) / 20)
    y = true_peak_limit(y * g2)
    return y, gain * g2


m1, g1 = master([voz, mus_out, sfx_out])
m2, g2 = master([voz, sfx_out])
out = P / 'audio/stems'
write(out / 'voz.wav', voz * g1); write(out / 'musica.wav', mus_out * g1); write(out / 'sfx.wav', sfx_out * g1)
write(out / 'master_con_musica.wav', m1); write(out / 'master_sin_musica.wav', m2)

# reporte
_, lv2 = short_term(voz * g1); _, lm2 = short_term(mus_out * g1)
margin = (lv2 - lm2)[active]  # misma mascara de voz activa que el ducking
rep = {
    'master_con_musica': {'LUFS': round(lufs(m1), 2), 'dBTP': round(true_peak_db(m1), 2)},
    'master_sin_musica': {'LUFS': round(lufs(m2), 2), 'dBTP': round(true_peak_db(m2), 2)},
    'voz_en_master_LUFS': round(lufs(voz * g1), 2),
    'musica_bajo_voz_dB_min': round(float(margin.min()), 2), 'musica_bajo_voz_dB_mediana': round(float(np.median(margin)), 2),
    'ganancia_master_dB': round(db(g1), 2),
}
json.dump(rep, open(out / 'mezcla_reporte.json', 'w'), indent=1)
rep['nota'] = ('La voz es casi toda la energia de la pieza y la musica va >= 12 dB abajo: con el master a -14 LUFS '
               'la voz queda cerca de -14. Para dejar la voz en -16 el master quedaria en ~-16.')
json.dump(rep, open(out / 'mezcla_reporte.json', 'w'), indent=1, ensure_ascii=False)
print(json.dumps(rep, indent=1, ensure_ascii=False))
