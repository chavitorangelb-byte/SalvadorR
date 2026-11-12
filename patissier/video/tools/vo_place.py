"""Coloca cada línea de la toma de voz en su tiempo de video (VO.lines de timeline.mjs).
Cada línea se corta de la toma con un pequeño margen y fundidos de 12 ms; no se acelera ni se estira.
Uso: python3 video/tools/vo_place.py   ->  video/audio/stems/vo.wav (48 kHz, mono, 18 s)"""
import json, subprocess, wave
from pathlib import Path
import numpy as np
ROOT = Path(__file__).resolve().parents[2]
SR, DUR, PRE, POST, FADE = 48000, 18.0, 0.04, 0.12, 0.012
vo = json.loads(subprocess.run(['node', '-e', "import('./video/timeline/timeline.mjs').then(m=>console.log(JSON.stringify(m.VO)))"],
                               cwd=ROOT, capture_output=True, text=True, check=True).stdout)
w = wave.open(str(ROOT / vo['file'])); assert w.getframerate() == SR
src = np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float64) / 32768
out = np.zeros(int(DUR * SR))
for ln in vo['lines']:
    a, b = ln['take']; a0, b0 = max(0, a - PRE), min(len(src) / SR, b + POST)
    seg = src[int(a0 * SR):int(b0 * SR)].copy(); f = int(FADE * SR)
    seg[:f] *= np.linspace(0, 1, f); seg[-f:] *= np.linspace(1, 0, f)
    i = int((ln['t'] - (a - a0)) * SR)
    assert out[i:i + len(seg)].any() == False, f"{ln['id']} se encima con la línea anterior"
    out[i:i + len(seg)] += seg
    print(f"{ln['id']}: toma {a:.2f}-{b:.2f} -> video {ln['t']:.2f}-{ln['t'] + b - a:.2f}")
assert not out[int(15.95 * SR):].any(), 'la voz debe terminar antes del corte de 16.00'
p = ROOT / 'video/audio/stems/vo.wav'
with wave.open(str(p), 'wb') as o:
    o.setnchannels(1); o.setsampwidth(2); o.setframerate(SR); o.writeframes((np.clip(out, -1, 1) * 32767).astype(np.int16).tobytes())
print('->', p)
