"""Lectura/escritura WAV PCM sin dependencias (16/24 bits). write() guarda en 24 bits."""
import wave
import numpy as np


def write(path, data, sr):
    x = np.asarray(data, dtype=np.float64)
    if x.ndim == 1:
        x = x[:, None]
    q = np.clip(np.round(x * 8388607), -8388608, 8388607).astype(np.int32)
    b = q.astype('<i4').view(np.uint8).reshape(-1, 4)[:, :3].reshape(-1)
    with wave.open(str(path), 'wb') as w:
        w.setnchannels(x.shape[1]); w.setsampwidth(3); w.setframerate(sr); w.writeframes(b.tobytes())


def read(path):
    with wave.open(str(path)) as w:
        n, ch, sw, sr = w.getnframes(), w.getnchannels(), w.getsampwidth(), w.getframerate()
        raw = np.frombuffer(w.readframes(n), np.uint8)
    if sw == 2:
        x = raw.view('<i2').astype(np.float64) / 32768
    elif sw == 3:
        a = raw.reshape(-1, 3); v = (a[:, 0].astype(np.int32) | (a[:, 1].astype(np.int32) << 8) | (a[:, 2].astype(np.int32) << 16))
        v[v >= 1 << 23] -= 1 << 24; x = v / 8388608.0
    else:
        raise ValueError(sw)
    return x.reshape(-1, ch), sr
