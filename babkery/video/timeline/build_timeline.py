"""Línea de tiempo maestra de Babkery, bloqueada a la voz real (ElevenLabs, voz Hope, eleven v4, toma 1).

Genera, desde una sola fuente:
  timeline.json   escenas, frases, palabras, eventos visuales y cues de SFX (en segundos y cuadros a 60 fps)
  ../BRIEF.md     brief con tiempos exactos por fotograma
  ../audio/vo/voz_colocada.wav   la voz cortada por frase y puesta en su segundo (48 kHz, 24 bits)

Los tiempos de palabra salen de la toma (Whisper medium + envolvente de 10 ms, ver vo_words_whisper.json);
cada frase se mueve en bloque (offset), nunca se acelera ni se estira.
"""
import json, subprocess
from pathlib import Path
import numpy as np

HERE = Path(__file__).resolve().parent
VIDEO = HERE.parent
FPS, SR = 60, 48000
DUR = 18.5            # 16 s de pieza + 2.5 s de end card (la última frase dura 1.98 s; ver brief)
TAKE = VIDEO / 'audio/vo/vo_take1_hope_48k.wav'

def f(t): return int(round(t * FPS))

# --- Voz: frases de la toma -----------------------------------------------------------
# cut = tramo que se corta de la toma; onset = arranque de la primera palabra en la toma;
# at = dónde arranca esa primera palabra en el video; words = arranque de cada palabra en la toma.
PHRASES = [
    dict(id='vo1', text='Capa por capa.', cut=(0.06, 1.62), onset=0.11, at=0.50,
         words=[('Capa', 0.11), ('por', 0.62), ('capa.', 0.86)]),
    dict(id='vo2', text='Croissants, babkas y masa madre.', cut=(2.60, 5.45), onset=2.67, at=3.00,
         words=[('Croissants,', 2.67), ('babkas', 3.60), ('y', 4.18), ('masa', 4.47), ('madre.', 4.82)]),
    dict(id='vo3', text='Cuatro punto siete en Google.', cut=(5.93, 7.62), onset=6.00, at=6.00,
         words=[('Cuatro', 6.00), ('punto', 6.22), ('siete', 6.48), ('en', 6.87), ('Google.', 7.14)]),
    dict(id='vo4', text='Imagina todo esto en tu propia página.', cut=(8.06, 10.72), onset=8.13, at=8.20,
         words=[('Imagina', 8.13), ('todo', 8.77), ('esto', 8.98), ('en', 9.31), ('tu', 9.54),
                ('propia', 9.73), ('página.', 9.93)]),
    dict(id='vo5', text='Pide por WhatsApp.', cut=(11.13, 12.05), onset=11.20, at=12.20,
         words=[('Pide', 11.20), ('por', 11.43), ('WhatsApp.', 11.52)]),
    dict(id='vo6', text='Babkery. Guadalajara.', cut=(12.53, 14.42), onset=12.595, at=14.20,
         words=[('Babkery.', 12.595), ('Guadalajara.', 13.51)]),
    dict(id='vo7', text='Tu página, desde mil pesos.', cut=(14.66, 16.82), onset=14.72, at=16.15,
         words=[('Tu', 14.72), ('página,', 14.88), ('desde', 15.47), ('mil', 15.75), ('pesos.', 16.21)]),
]
TAKE_END = {'vo1': 1.45, 'vo2': 5.28, 'vo3': 7.49, 'vo4': 10.54, 'vo5': 11.90, 'vo6': 14.24, 'vo7': 16.70}
for p in PHRASES:
    p['offset'] = round(p['at'] - p['onset'], 3)
    p['end'] = round(TAKE_END[p['id']] + p['offset'], 3)
    p['words'] = [dict(w=w, t=round(t + p['offset'], 3), f=f(t + p['offset'])) for w, t in p['words']]
W = {(p['id'], i): w['t'] for p in PHRASES for i, w in enumerate(p['words'])}

# --- Escenas ----------------------------------------------------------------------------
SCENES = [
    ('Gancho: la línea irrumpe', 0.00, 0.50),
    ('Pliegues: capa por capa', 0.50, 2.00),
    ('Trenza → espiral de la S → logo', 2.00, 3.00),
    ('La página: hero y tarjetas', 3.00, 6.00),
    ('Calificación 4.7', 6.00, 8.00),
    ('Reseñas', 8.00, 10.00),
    ('Galería: tu página', 10.00, 12.00),
    ('Pide por WhatsApp', 12.00, 14.00),
    ('Pull-back al logo', 14.00, 16.00),
    ('End card', 16.00, DUR),
]

# --- Eventos visuales (momentos clave) ---------------------------------------------------
c1, c2, c3 = W[('vo2', 0)], W[('vo2', 1)], W[('vo2', 3)]
siete, google = W[('vo3', 2)], W[('vo3', 4)]
tu, pagina = W[('vo4', 4)], W[('vo4', 6)]
pide, wa = W[('vo5', 0)], W[('vo5', 2)]
babkery, gdl = W[('vo6', 0)], W[('vo6', 1)]
mil = W[('vo7', 3)]
EVENTS = [
    (0.00, 0.00, 'Punto crema en negro total; la línea caramelo irrumpe de lado a lado (flash cálido)'),
    (0.00, 0.18, 'La línea cruza el cuadro: núcleo crema #FFF3C9, halo caramelo #E3A23B, rastro de reflejo'),
    (W[('vo1', 0)], W[('vo1', 0)] + 0.10, 'Kinetic "CAPA" aterriza (sobre "Capa")'),
    (0.82, 1.00, 'Pliegue 1: la línea se dobla sobre sí misma → 2 capas'),
    (W[('vo1', 1)], W[('vo1', 1)] + 0.10, 'Kinetic "POR CAPA" aterriza (sobre "por")'),
    (1.00, 1.18, 'Reflejo especular recorre las 2 capas'),
    (1.32, 1.50, 'Pliegue 2 → 4 capas'),
    (1.50, 1.68, 'Reflejo especular recorre las 4 capas'),
    (1.82, 2.00, 'Pliegue 3 → 8 capas: bloque laminado con grosor y bisel'),
    (2.00, 2.55, 'El bloque se retuerce en trenza de babka (SDF)'),
    (2.55, 2.95, 'La trenza se cierra en el espiral de la "S" (SDF)'),
    (2.80, 3.00, 'Emerge el logo real (asset 02, ≤460 px) dentro de un círculo de cristal'),
    (3.00, 3.40, 'El círculo de cristal crece por SDF hasta el marco de la página en celular'),
    (3.10, 3.60, 'Hero con 04 (croissants) en paralaje; encabezado "Babkery · panadería y café"'),
    (c1, c1 + 0.30, 'Tarjeta isométrica 1 "CROISSANTS" (foto 09) se levanta (sobre "Croissants")'),
    (c2, c2 + 0.30, 'Tarjeta 2 "BABKAS" (foto 03) (sobre "babkas")'),
    (c3, c3 + 0.30, 'Tarjeta 3 "MASA MADRE" (foto 10) (sobre "masa")'),
    (5.65, 5.80, 'Chip "36 horas de fermentación" pegado a la tarjeta de croissants'),
    (5.78, 6.08, 'La página se desplaza a la calificación ("CALIFICACIÓN EN GOOGLE")'),
    (6.00, 6.40, 'La harina brillante converge en 5 estrellas'),
    (6.05, 6.53, 'Estrellas 1–4 llenas y la 5.ª al 70 %, una cada 0.12 s'),
    (6.00, siete, 'Contador 0 → "4.7" (aterriza sobre "siete")'),
    (google, google + 0.15, 'Chip "más de 140 reseñas en Google" (sobre "Google")'),
    (7.90, 8.10, 'La calificación sube y deja paso a las reseñas'),
    (8.00, 8.30, 'Reseña 1: "De los mejores panes que he probado en GDL."'),
    (8.55, 8.85, 'Reseña 2: "Como están horneando ahí mismo, todo está fresco."'),
    (8.90, 9.20, 'La línea caramelo subraya "todo está fresco"'),
    (9.10, 9.40, 'Reseña 3: "Me atendieron muy bien"'),
    (9.45, 9.95, 'La cámara se aleja (0.80) y deja espacio arriba para el kinetic'),
    (9.62, 10.02, 'La página se desplaza a la galería'),
    (tu, tu + 0.10, 'Kinetic "TU" (sobre "tu")'),
    (pagina, pagina + 0.10, 'Kinetic "PÁGINA" (sobre "página")'),
    (10.00, 10.30, 'Panel de cristal 05 (rosca)'),
    (10.25, 10.55, 'Panel 07 (rol de canela y nuez)'),
    (10.50, 10.80, 'Panel 11 (barra rústica)'),
    (10.75, 11.05, 'Panel 08 (chocolatine)'),
    (11.10, 11.50, 'Reflejo viaja sobre los cristales (1)'),
    (11.50, 11.90, 'Reflejo (2) y la galería se asienta'),
    (11.92, 12.16, 'La página se desplaza al pedido: "Haz tu pedido", "Croissants, babkas y masa madre" y tres fotos (04, 03, 07)'),
    (12.00, 12.25, 'Sube el botón "PIDE POR WHATSAPP"'),
    (pide, wa, 'La línea caramelo se vuelve su subrayado (de "Pide" a "WhatsApp")'),
    (wa, wa + 0.08, 'Tap en el botón (sobre "WhatsApp")'),
    (13.00, 13.25, 'Anillo pulsa 1 (kick)'),
    (13.50, 13.75, 'Anillo pulsa 2 (kick)'),
    (14.00, 14.70, 'Pull-back: la página se reduce a silueta de celular'),
    (14.70, 14.95, 'Todo se apaga salvo un punto de luz'),
    (14.95, 15.12, 'Último pliegue de la línea; el punto se vuelve el logo (asset 02)'),
    (gdl, gdl + 0.30, 'Entra "Babkery · Guadalajara" (sobre "Guadalajara")'),
    (15.50, 16.00, 'Respiro de música'),
    (16.00, 16.00, 'Golpe grave; corte al end card (fondo #1A0F0A)'),
    (16.05, 16.40, 'Línea 1: "Precios accesibles desde $1,000 pesos por tu página"'),
    (16.40, 16.70, 'Línea 2: "Paquete de 3 videos promocionales: $1,500"'),
    (16.70, 16.95, 'Línea 3: "Elevate Negocios · Aguascalientes"'),
    (16.90, 17.10, 'Línea 4: "Demo de cortesía de Elevate Negocios · pieza no oficial"'),
    (mil, mil + 0.30, 'Subrayado caramelo bajo "$1,000" (sobre "mil")'),
]

# --- SFX: un cue por movimiento visible -------------------------------------------------
S = []
def cue(t, fam, what, gain=-12.0): S.append(dict(t=round(t, 3), f=f(t), fam=fam, what=what, gain_db=gain))
cue(0.00, 'impacto', 'Hit cálido: irrumpe la línea', -6)
cue(0.00, 'whoosh', 'Whoosh corto de la línea cruzando', -10)
cue(0.02, 'shimmer', 'Flash cálido', -16)
for word, t0 in (('CAPA', W[('vo1', 0)]), ('POR CAPA', W[('vo1', 1)])):
    glyphs = [g for g in word if g != ' ']
    for i, g in enumerate(glyphs):
        cue(t0 + i * 0.028, 'tick madera', f'Aterriza "{g}" de {word}', -22)
for i, t in enumerate((1.00, 1.50, 2.00), 1):
    cue(t, 'masa', f'Pliegue {i}: golpe suave de masa sobre mesa', -10)
    cue(t - 0.10, 'papel', f'Pliegue {i}: papel que se dobla', -16)
    cue(t + 0.06, 'shimmer', f'Reflejo especular recorre las capas tras el pliegue {i}', -22)
cue(2.00, 'masa', 'Roce de masa: el bloque se retuerce en trenza', -14)
cue(2.20, 'swell', 'Swell de la trenza', -16)
cue(2.80, 'cristal', 'Glass tap: se forma el círculo de cristal', -14)
cue(2.95, 'campanita', 'Shimmer de campanita: se cierra la "S"', -12)
cue(3.00, 'cristal', 'Glass tap: arranca el marco de la página', -14)
cue(3.40, 'cristal', 'Glass tap suave: el marco se asienta', -18)
cue(3.10, 'aire', 'Aire suave: entra el hero en paralaje', -20)
for i, (t, n) in enumerate(((c1, 'CROISSANTS'), (c2, 'BABKAS'), (c3, 'MASA MADRE')), 1):
    cue(t, 'whoosh', f'Tarjeta {i} "{n}" se levanta', -14)
    cue(t + 0.24, 'contacto', f'Tarjeta {i} hace contacto suave', -16)
cue(5.65, 'ping', 'Chip "36 horas de fermentación"', -14)
cue(6.00, 'shimmer', 'La harina brillante empieza a converger', -18)
for i in range(5):
    cue(6.05 + i * 0.12, 'ping cristal', f'Estrella {i + 1}' + (' al 70 % (más suave)' if i == 4 else ''),
        -13 if i < 4 else -18)
steps = ['1', '2', '3', '4', '4.1', '4.2', '4.3', '4.4', '4.5', '4.6', '4.7']
t0, t1 = 6.00, siete
for i, s in enumerate(steps):
    cue(t0 + (t1 - t0) * (i + 1) / len(steps), 'tick', f'Contador → {s}', -24 + i * 0.6)
cue(google, 'ping', 'Chip "más de 140 reseñas en Google"', -15)
cue(7.90, 'aire', 'La calificación sube', -20)
for i, t in enumerate((8.00, 8.55, 9.10), 1):
    cue(t, 'whoosh', f'Desliza la reseña {i}', -16)
    cue(t + 0.26, 'contacto', f'La reseña {i} se asienta', -20)
cue(8.90, 'zip', 'Subrayado de "todo está fresco"', -14)
cue(9.40, 'aire', 'Paralaje de las reseñas', -22)
cue(tu, 'tick cristal', 'Aterriza "TU"', -18)
cue(pagina, 'tick cristal', 'Aterriza "PÁGINA"', -16)
for i, (t, n) in enumerate(((10.00, 'rosca'), (10.25, 'rol'), (10.50, 'barra'), (10.75, 'chocolatine')), 1):
    cue(t, 'glass whoosh', f'Panel {i} de la galería ({n})', -16)
cue(11.10, 'shimmer', 'Reflejo viaja sobre los cristales (1)', -22)
cue(11.50, 'shimmer', 'Reflejo (2)', -22)
cue(11.85, 'contacto', 'La galería se asienta', -22)
cue(5.78, 'aire', 'La página se desplaza a la calificación', -20)
cue(9.45, 'aire', 'La cámara se aleja y deja espacio a "TU PÁGINA"', -20)
cue(9.62, 'whoosh', 'La página se desplaza a la galería', -18)
cue(11.92, 'whoosh', 'La página se desplaza al pedido', -18)
for i in range(3):
    cue(12.18 + i * 0.07, 'contacto', f'Foto de producto {i + 1} del pedido se asienta', -22)
cue(12.02, 'tick madera', 'Aterriza "Haz tu pedido"', -20)
cue(12.00, 'whoosh', 'Sube el botón de WhatsApp', -14)
cue(pide, 'zip', 'La línea se vuelve el subrayado del botón', -14)
cue(wa, 'click', 'Tap en "PIDE POR WHATSAPP"', -10)
cue(13.00, 'pulso', 'Anillo pulsa 1 (con el kick)', -16)
cue(13.50, 'pulso', 'Anillo pulsa 2 (con el kick)', -16)
cue(14.00, 'reverse swell', 'Pull-back de la cámara', -12)
cue(14.70, 'power down', 'Se apagan las luces', -14)
cue(14.95, 'shimmer', 'Queda un punto de luz', -20)
cue(15.00, 'papel', 'Último pliegue de la línea', -16)
cue(15.12, 'impacto', 'Hit: el punto se vuelve el logo', -10)
cue(gdl + 0.02, 'tick madera', 'Entra "Babkery · Guadalajara"', -20)
cue(16.00, 'golpe grave', 'Golpe grave: end card', -6)
for i, t in enumerate((16.05, 16.40, 16.70, 16.90), 1):
    cue(t, 'tick madera', f'Aterriza la línea {i} del end card', -20 - i)
cue(mil, 'zip', 'Subrayado caramelo bajo "$1,000"', -16)
cue(16.30, 'atmósfera', 'Atmósfera mínima hasta el final (cuarto cálido)', -30)
S.sort(key=lambda c: c['t'])

MUSIC = [
    (0.00, 2.00, 'Kick suave + bajo redondo'),
    (2.00, 3.00, 'Entra la marimba melódica al cerrarse la "S"'),
    (3.00, 6.00, 'Escobillas y pizzicato'),
    (6.00, 10.00, 'Pad tibio y campanitas de cristal'),
    (10.00, 12.00, 'Lift'),
    (12.00, 14.00, 'Riser de 2 s; kicks en 13.00 y 13.50 para los pulsos del anillo'),
    (14.00, 15.50, 'Se adelgaza con el pull-back'),
    (15.50, 16.00, 'Respiro (silencio musical)'),
    (16.00, DUR, 'Golpe grave y cola tibia del pad; atmósfera mínima'),
]

# --- Voz colocada -------------------------------------------------------------------------
def place_voice():
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', str(TAKE), '-f', 'f64le', '-ac', '1', '-ar', str(SR), '-'],
                         capture_output=True, check=True).stdout
    a = np.frombuffer(raw, np.float64)
    out = np.zeros(int(DUR * SR))
    fade = int(0.012 * SR)
    for p in PHRASES:
        s, e = (int(x * SR) for x in p['cut'])
        seg = a[s:e].copy()
        seg[:fade] *= np.linspace(0, 1, fade); seg[-fade:] *= np.linspace(1, 0, fade)
        start = int(round((p['cut'][0] + p['offset']) * SR))
        assert start >= 0 and start + len(seg) <= len(out), p['id']
        out[start:start + len(seg)] += seg
    pcm = (np.clip(out, -1, 1) * (2 ** 31 - 1)).astype('<i4').tobytes()
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 's32le', '-ar', str(SR), '-ac', '1', '-i', '-',
                    '-c:a', 'pcm_s24le', str(VIDEO / 'audio/vo/voz_colocada.wav')], input=pcm, check=True)

def overlaps():
    for a, b in zip(PHRASES, PHRASES[1:]):
        assert a['end'] < b['at'], (a['id'], b['id'])
    assert PHRASES[-1]['end'] < DUR

# --- Brief --------------------------------------------------------------------------------
def brief():
    L = []
    L += ['# Babkery · Brief del video por fotograma', '',
          f'60 fps · {f(DUR)} cuadros · {DUR:.1f} s (16 s de pieza + {DUR - 16:.1f} s de end card) · 120 BPM (beat = 0.5 s, compás = 2.0 s).',
          'Todo sale de `video/timeline/build_timeline.py`; este documento se genera desde ahí. Pieza spec privada: no se publica.', '',
          '## Escenas', '', '| Escena | Tiempo | Cuadros |', '|---|---|---|']
    L += [f'| {n} | {a:.2f}–{b:.2f} s | f{f(a):04d}–f{f(b):04d} |' for n, a, b in SCENES]
    L += ['', '## Locución (ElevenLabs, voz Hope, eleven v4, toma 1)', '',
          'Cada frase se movió en bloque a su lugar; ninguna se aceleró ni se estiró.', '',
          '| Frase | Entra | Termina | Palabras (arranque) |', '|---|---|---|---|']
    for p in PHRASES:
        ws = ' · '.join(f"{w['w']} f{w['f']:04d}" for w in p['words'])
        L.append(f"| {p['text']} | {p['at']:.2f} s (f{f(p['at']):04d}) | {p['end']:.2f} s | {ws} |")
    L += ['', '## Momentos clave', '', '| Momento | Tiempo |', '|---|---|']
    for a, b, d in EVENTS:
        L.append(f'| {d} | {a:.2f} s (f{f(a):04d})' + (f' – {b:.2f} s (f{f(b):04d})' if b > a else '') + ' |')
    L += ['', '## Música (original, en código)', '', '| Tramo | Capa |', '|---|---|']
    L += [f'| {a:.2f}–{b:.2f} s | {d} |' for a, b, d in MUSIC]
    L += ['', 'Música ≥ 12 dB por debajo de cada palabra (ducking por la voz). Master −14 LUFS / −1.25 dBTP; voz ≈ −16 LUFS.',
          '', f'## SFX ({len(S)} cues, uno por movimiento visible)', '', '| # | Tiempo | Cuadro | Familia | Causa visible |', '|---|---|---|---|---|']
    L += [f"| {i} | {c['t']:.3f} s | f{c['f']:04d} | {c['fam']} | {c['what']} |" for i, c in enumerate(S, 1)]
    L += ['', '## Textos en pantalla (todos verificados)', '',
          '- Kinetic: "CAPA", "POR CAPA", "TU", "PÁGINA".',
          '- Página: "Babkery", "panadería y café · Guadalajara", tarjetas "CROISSANTS", "BABKAS", "MASA MADRE",',
          '  chip "36 horas de fermentación" (afirmación del catálogo: confirmar con el dueño), "4.7",',
          '  "CALIFICACIÓN EN GOOGLE", "más de 140 reseñas en Google", etiquetas "RESEÑA DE GOOGLE",',
          '  galería "Rosca de babka", "Rol de canela y nuez", "Barra rústica", "Chocolatine",',
          '  "Haz tu pedido", "Croissants, babkas y masa madre", botón "PIDE POR WHATSAPP".',
          '- Reseñas (textuales, sin autor): "De los mejores panes que he probado en GDL." ·',
          '  "Como están horneando ahí mismo, todo está fresco." · "Me atendieron muy bien".',
          '- Cierre: "Babkery · Guadalajara". End card: las cuatro líneas del brief.',
          '- Nada de precios de productos, horario, dirección, teléfono ni usuario de Instagram.', '',
          '## Fotos por momento', '',
          '- Hero: 04 croissant natural. Tarjetas: 09 croissant relleno, 03 baby babkas, 10 pan de caja.',
          '- Galería: 05 rosca, 07 rol de canela y nuez, 11 barra rústica, 08 chocolatine.',
          '- Logo: 02 (máscara circular, sin recolorear, ≤ 460 px de ancho).', '']
    (VIDEO / 'BRIEF.md').write_text('\n'.join(L))

if __name__ == '__main__':
    overlaps()
    place_voice()
    data = dict(fps=FPS, dur=DUR, frames=f(DUR),
                scenes=[dict(name=n, t0=a, t1=b, f0=f(a), f1=f(b)) for n, a, b in SCENES],
                vo=PHRASES, events=[dict(t0=a, t1=b, f0=f(a), f1=f(b), what=d) for a, b, d in EVENTS],
                music=[dict(t0=a, t1=b, what=d) for a, b, d in MUSIC], sfx=S)
    (HERE / 'timeline.json').write_text(json.dumps(data, ensure_ascii=False, indent=1))
    brief()
    print(f'{len(S)} cues SFX · voz colocada · brief listo')
    for p in PHRASES: print(f"{p['id']} {p['at']:.2f}–{p['end']:.2f}  offset {p['offset']:+.3f}")
