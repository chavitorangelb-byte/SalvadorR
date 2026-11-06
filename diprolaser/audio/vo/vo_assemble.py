"""Arma voz.wav desde la toma de ElevenLabs (Adam): 48 kHz mono, sin acelerar ni estirar.
Solo abre silencio en tres pausas naturales para dar aire a S5, S6 y S7.
Cada corte cae en el punto de menor energia dentro del hueco entre frases.
Uso: python3 vo_assemble.py <fuente.mp3> <salida.wav>
"""
import sys, subprocess, numpy as np, wave
SR = 48000
GAPS = [  # (ventana del hueco en la toma original, segundos a insertar)
    ((14.60, 14.86), 0.50),  # antes de "Grabado a laser"
    ((17.32, 17.64), 0.70),  # antes de "Porque un detalle"
    ((20.68, 21.28), 0.60),  # despues de "gracias por estar", antes de DIPROLASER
]
raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', sys.argv[1], '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'],
                     capture_output=True, check=True).stdout
a = np.frombuffer(raw, np.float32).copy()
win = int(0.02 * SR)
env = np.sqrt(np.convolve(a ** 2, np.ones(win) / win, 'same'))
out, prev, log = [], 0, []
for (t0, t1), add in GAPS:
    i0, i1 = int(t0 * SR), int(t1 * SR)
    cut = i0 + int(np.argmin(env[i0:i1]))
    seg = a[prev:cut].copy()
    f = int(0.005 * SR); seg[-f:] *= np.linspace(1, 0, f)  # micro fundido en el corte (ya es silencio)
    out += [seg, np.zeros(int(add * SR), np.float32)]
    tail = a[cut:cut + f]; a[cut:cut + f] = tail * np.linspace(0, 1, f)
    log.append((cut / SR, add)); prev = cut
out.append(a[prev:])
y = np.concatenate(out)
pcm = (np.clip(y, -1, 1) * 32767).astype('<i2')
with wave.open(sys.argv[2], 'wb') as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
for c, add in log: print(f'corte en {c:.3f} s (+{add:.2f} s)')
print(f'duracion {len(y) / SR:.2f} s')
