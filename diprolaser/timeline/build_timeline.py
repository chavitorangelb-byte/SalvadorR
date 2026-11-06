"""Linea de tiempo de DIPROLASER, bloqueada a voz.wav.

1. Lee la alineacion de Whisper (vo_words_whisper.json) y corrige ortografia
   ("dale" -> "dales": verificado con los siseos de la senal; "DiPro Lacer" -> DIPROLASER).
2. Ajusta los inicios a la senal: Whisper marca ~0.1 s antes; cada final de pausa real
   (>= 80 ms bajo -45 dBFS) se asigna a la palabra cuyo inicio esta mas cerca.
3. Escribe vo_words.json, timeline.json (escenas y cues en segundos y cuadros a 60 fps) y BRIEF.md.
Uso: python3 build_timeline.py
"""
import json, subprocess
from pathlib import Path
import numpy as np

HERE = Path(__file__).resolve().parent
PROJ = HERE.parent
FPS, SR = 60, 48000
f = lambda t: int(round(t * FPS))

# --- voz ---------------------------------------------------------------------------------------
raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', str(PROJ / 'audio/vo/voz.wav'), '-f', 'f32le', '-ac', '1', '-'],
                     capture_output=True, check=True).stdout
a = np.frombuffer(raw, np.float32)
H = SR // 100
db = 20 * np.log10(np.sqrt(np.mean(a[:len(a) // H * H].reshape(-1, H) ** 2, axis=1)) + 1e-9)
act = db > -45
pauses, i = [], 0
while i < len(act):
    if not act[i]:
        j = i
        while j < len(act) and not act[j]: j += 1
        if j - i >= 8: pauses.append((i / 100, j / 100))
        i = j
    else: i += 1
voice_end = max(k for k in range(len(act)) if act[k]) / 100

words = json.load(open(HERE / 'vo_words_whisper.json'))
FIX = {18: 'dales', 42: 'láser', 58: 'DIPROLASER', 73: '449', 74: '212', 75: '8627.'}
for k, v in FIX.items(): words[k]['w'] = v
words[58]['e'] = words[59]['e']; del words[59]             # "DiPro" + "Lacer," -> DIPROLASER
for w in words: w['src'] = 'whisper'
words[0]['s'] = pauses[0][1]; words[0]['src'] = 'senal'
for p0, p1 in pauses[1:]:
    if p1 >= voice_end: continue
    # la palabra cuyo intervalo de Whisper contiene el final de la pausa (Whisper suele estirar
    # el "y" por encima del silencio); si ninguna lo contiene, la de inicio mas cercano
    inside = [n for n, w in enumerate(words) if w['s'] <= p1 < w['e']]
    k = inside[0] if inside else min(range(len(words)), key=lambda n: abs(words[n]['s'] - p1))
    if inside or abs(words[k]['s'] - p1) < 0.5:
        if k > 0: words[k - 1]['e'] = min(words[k - 1]['e'], p0)
        words[k]['s'] = p1; words[k]['src'] = 'senal'
for w in words:
    w['f'] = f(w['s'])
json.dump({'fps': FPS, 'voice_end': voice_end, 'pauses': pauses, 'words': words},
          open(HERE / 'vo_words.json', 'w'), ensure_ascii=False, indent=1)

def W(text, nth=1, after=0.0):
    """Inicio (s) de la n-esima aparicion de una palabra a partir de `after`."""
    c = 0
    for w in words:
        if w['s'] >= after and w['w'].strip('.,').lower() == text.lower():
            c += 1
            if c == nth: return w['s']
    raise KeyError(text)

# --- escenas (cada transicion arranca ~0.25 s antes de la frase que la motiva) ------------------
S = [
    ('S1', 'Llegan… y se quedan', 0.0, W('Te') - 0.24),
    ('S2', 'Una vez, y otra, y otra más', None, W('Este') - 0.24),
    ('S3', 'Gracias (caja de regalo)', None, W('con', 1, 10.8) - 0.23),
    ('S4', 'Tu logo / tu negocio / su nombre', None, W('Grabado') - 0.24),
    ('S5', 'Láser / a todo color', None, W('Porque') - 0.22),
    ('S6', 'Gracias por estar (momento emocional)', None, W('DIPROLASER') - 0.25),
    ('S7', 'DIPROLASER', None, W('Consiente') - 0.21),
    ('S8', 'Consiente a tus clientes + WhatsApp', None, 33.0),
    ('END', 'End card', None, 35.5),
]
scenes, prev = [], 0.0
for sid, name, s0, s1 in S:
    s0 = prev if s0 is None else s0
    scenes.append({'id': sid, 'name': name, 't0': round(s0, 2), 't1': round(s1, 2), 'f0': f(s0), 'f1': f(s1)})
    prev = s1

# --- cues ---------------------------------------------------------------------------------------
cues = []
def cue(t, scene, kind, what):
    cues.append({'t': round(t, 3), 'f': f(t), 'scene': scene, 'kind': kind, 'what': what})

cue(W('llegan'), 'S1', 'type', '"LLEGAN" entra deslizándose y sigue de largo')
cue(W('y', 1), 'S1', 'type', '"Y SE QUEDAN" aterriza en dorado')
cue(W('quedan'), 'S1', 'type', '"Y SE QUEDAN" asentado; quietud total hasta S2')
cue(scenes[1]['t0'], 'S2', 'motion', 'Arranca el carrusel (el termo del pedestal pasa a ser parte del anillo)')
cue(W('una'), 'S2', 'type', 'Tarjeta de cristal "UNA VEZ"')
cue(W('vez'), 'S2', 'product', 'Producto nuevo entra al anillo (sello de lealtad 1)')
cue(W('y', 1, 4.5), 'S2', 'type', 'Tarjeta "Y OTRA" se apila')
cue(W('otra', 1), 'S2', 'product', 'Producto nuevo entra al anillo (sello 2)')
cue(W('y', 1, 5.6), 'S2', 'type', 'Tarjeta "Y OTRA MÁS" se apila')
cue(W('más'), 'S2', 'product', 'Producto nuevo entra al anillo (sello 3)')
cue(scenes[2]['t0'], 'S3', 'liquid', 'El líquido rojo sube y forma la caja isométrica')
cue(W('año'), 'S3', 'liquid', 'El líquido se solidifica en caja negra + moño rojo')
cue(W('dales'), 'S3', 'box', 'La caja se abre: luz cálida dorada')
cue(W('gracias', 1), 'S3', 'type', '"GRACIAS" en dorado, grande, tracking que se cierra')
cue(W('algo'), 'S3', 'box', 'Suben la ánfora, el estuche VIP y el set de regalo')
cue(W('olvide'), 'S3', 'glass', 'Etiqueta de cristal cuelga del moño: "GRACIAS POR TU PREFERENCIA"')
cue(scenes[3]['t0'], 'S4', 'motion', 'Carrusel completo a velocidad media; frente: logo DIPROLASER grabado')
# 5 cambios cada ~0.74 s (con 6 no se alcanzaba a leer ningun nombre: quedaban 0.3 s).
# REFACCIONARIA JUAREZ va ya grabado en un producto del anillo (no cambia en el frente).
names = ['FERRETERÍA EL CLAVO', 'TALLER HERMANOS RUIZ', 'CONSTRUCTORA DÁVILA', 'PANADERÍA LA ESPIGA',
         'Sello "TU LOGO AQUÍ"']
n0, n1 = W('logo'), W('suyo') + 0.20
name_t = [n0 + k * (n1 - n0) / 4 for k in range(5)]
for t, n in zip(name_t, names):
    cue(t, 'S4', 'engrave', f'Cambio de grabado (barrido de luz 0.12 s + láser escribe 0.30 s): {n}')
cue(scenes[3]['t0'], 'S4', 'engrave', 'En el anillo ya viene grabado "REFACCIONARIA JUÁREZ" en un producto del fondo')
colors = ['azul', 'verde olivo', 'rosa', 'crema', 'rojo DIPROLASER']
step = (n1 - n0) / 4
for k, c in enumerate(colors):  # a medio camino entre cambios de nombre: una cosa a la vez
    cue(name_t[k] + step / 2, 'S4', 'recolor', f'Barrido líquido de color en vasos y cintas → {c}')
cue(W('logo'), 'S4', 'type', 'Chip de cristal "TU LOGO"')
cue(W('negocio'), 'S4', 'type', 'Chip → "TU NEGOCIO"')
cue(W('suyo'), 'S4', 'type', 'Chip → "SU NOMBRE"')
cue(scenes[4]['t0'], 'S5', 'glass', 'Entra el cristal diagonal: pantalla dividida')
cue(W('Grabado'), 'S5', 'laser', 'Láser enciende sobre el termo negro: haz, chispas, humo; logo en plata línea por línea')
cue(W('láser'), 'S5', 'type', '"LÁSER" en rojo')
cue(W('impreso'), 'S5', 'print', 'Cabezal UV empieza pasadas C → M → Y → K sobre el vaso crema')
cue(W('todo'), 'S5', 'type', '"A TODO COLOR": letras C/M/Y que se juntan en blanco')
cue(W('color'), 'S5', 'print', 'Logo a color completo; última pasada K')
cue(scenes[5]['t0'], 'S6', 'iso', 'Composición isométrica de regalo (5–6 productos), luz cálida, cámara más lenta')
tags = ['Gracias por estar', 'Gracias por tu confianza', 'Feliz año', 'Para ti, Don Luis']
for k, (t, tg) in enumerate(zip([W('Porque') + 0.48 * n for n in range(4)], tags)):  # se quedan visibles
    cue(t, 'S6', 'tag', f'Etiqueta gira y muestra: "{tg}"')
cue(W('gracias', 2), 'S6', 'type', '"GRACIAS" (dorado)')
cue(W('por', 1, 20.5), 'S6', 'type', '"POR"')
cue(W('estar'), 'S6', 'type', '"ESTAR" — se sostiene en silencio ~1 s')
cue(scenes[6]['t0'], 'S7', 'liquid', 'Todo el líquido rojo converge y forma la X')
cue(W('DIPROLASER'), 'S7', 'logo', 'Logo oficial aparece sobre la X con barrido de luz plateada (impacto)')
cue(W('promocionales'), 'S7', 'type', '"PROMOCIONALES PERSONALIZADOS" debajo del logo')
cue(W('Consiente'), 'S8', 'type', '"CONSIENTE A TUS CLIENTES"')
cue(W('este', 1, 27.5), 'S8', 'type', '"ESTE AÑO" en dorado')
cue(W('Escríbenos'), 'S8', 'glass', 'Píldora de cristal con ícono de WhatsApp')
cue(W('449'), 'S8', 'type', '"449" dentro de la píldora')
cue(W('212'), 'S8', 'type', '"212"')
cue(W('8627'), 'S8', 'type', '"8627" — número completo y centrado')
cue(W('8627') + 0.5, 'S8', 'type', '"Y en redes como DIPROLASER"')
cue(voice_end + 0.1, 'S8', 'type', '"Envíos a todo México"')
cue(33.0, 'END', 'camera', 'Se sostiene el cierre; la cámara se aleja un poco')
cue(35.1, 'END', 'fade', 'Fundido a negro (0.4 s)')
cues.sort(key=lambda c: c['t'])

tl = {'fps': FPS, 'duration': 35.5, 'frames': f(35.5), 'voice_end': voice_end, 'scenes': scenes, 'cues': cues}
json.dump(tl, open(HERE / 'timeline.json', 'w'), ensure_ascii=False, indent=1)

# --- BRIEF.md -----------------------------------------------------------------------------------
L = ['# DIPROLASER · Brief por cuadro (fase 2)', '',
     f'60 fps · {f(35.5)} cuadros · 35.5 s (33.0 s de pieza + 2.5 s de end card). Voz: ElevenLabs "Adam", 1 toma, '
     f'termina en {voice_end:.2f} s.', 'Todo sale de `diprolaser/timeline/build_timeline.py`; este documento se genera desde ahí.', '',
     '## Voz', '',
     'Sin aceleración ni estiramiento. Se abrió silencio en tres pausas naturales (cortes en −86 dBFS, ≥30 ms antes del ataque):',
     '+0.50 s antes de "Grabado a láser", +0.70 s antes de "Porque un detalle", +0.60 s antes de "DIPROLASER".',
     'Se verificó "dales las gracias" (Whisper oyó "dale"): hay dos siseos antes de "gracias".', '',
     '| # | Palabra | Inicio | Cuadro | Fuente |', '|---|---|---|---|---|']
for n, w in enumerate(words):
    L.append(f"| {n} | {w['w']} | {w['s']:.2f} s | f{w['f']:04d} | {w['src']} |")
L += ['', '## Escenas', '', '| Escena | Qué | Tiempo | Cuadros |', '|---|---|---|---|']
for s in scenes:
    L.append(f"| {s['id']} | {s['name']} | {s['t0']:.2f}–{s['t1']:.2f} s | f{s['f0']:04d}–f{s['f1']:04d} |")
L += ['', '## Cues (cada movimiento clave, en el cuadro exacto)', '', '| Cuadro | Tiempo | Escena | Tipo | Qué pasa |', '|---|---|---|---|---|']
for c in cues:
    L.append(f"| f{c['f']:04d} | {c['t']:.2f} s | {c['scene']} | {c['kind']} | {c['what']} |")
(PROJ / 'BRIEF.md').write_text('\n'.join(L) + '\n')
print(f"{len(words)} palabras, {len(scenes)} escenas, {len(cues)} cues; voz termina en {voice_end:.2f} s")
for s in scenes: print(f"  {s['id']:4s} {s['t0']:6.2f}–{s['t1']:6.2f}  {s['t1']-s['t0']:.2f} s  {s['name']}")
