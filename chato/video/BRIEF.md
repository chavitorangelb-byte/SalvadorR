# Chato Cafecito · Brief del video por cuadro (fase 2)

Demo de cortesía privada de Elevate Negocios · pieza no oficial · no se publica sin permiso del dueño.

60 fps · 1080 cuadros · 18.0 s (16 s de pieza + 2 s de end card) · 120 BPM (compás = 2.0 s = 120 cuadros).
Formatos: 9:16 (1080×1920, principal) y 1:1 (1080×1080, re-layout real). Master a 60 fps y H.264 a 30 fps.

Estado: **aprobado por Salvador**. La voz la graba Salvador en ElevenLabs (`video/guion_locucion.txt`); los tiempos se bloquean a su toma en la fase 3.

## Idea

"Una página en capas". Un vaso transparente se llena capa por capa y cada capa de líquido se convierte en una
sección de la página. Un solo plano continuo, un solo campo líquido (SDF) y una sola cámara para todo.

## Assets: con qué se trabaja

| Asset | Estado | Cómo se usa |
|---|---|---|
| Fotos del negocio | Una: la fachada (portada de Maps, subida por el propio negocio, 3024×4032). Maps no muestra más sin cuenta. | La fachada va en el encabezado de la página y da la paleta real. Vaso, tapa y capas se construyen en código con volumen. |
| Logo | Solo captura del perfil de Instagram (círculo de ~600 px). | Solo en la end card, a tamaño moderado (≤ 300 px). En el resto, "CHATO CAFECITO" en texto neutro. El gato no se redibuja. |
| Datos | Capturas del menú, la historia del horario y la ficha de Maps. | Solo lo listado en "Textos en pantalla". |

## Paleta

| Uso | Valor | Origen |
|---|---|---|
| Fondo | `#12110E` | Brief |
| Carbón del logo | `#21211D` | Muestreado de la captura del logo |
| Crema | `#F1EBDD` | Brief (aprox.) |
| Verde salvia (tablero) | `#6F7A69` | Brief (aprox.); la captura da un tono más gris, `#707066` |
| Verde puerta | `#37463F` | Muestreado de la foto de fachada (tomada al atardecer; de día se ve más claro) |
| Madera del mostrador | `#44261B` | Muestreado de la foto de fachada |
| Ocre cerámica | `#B0883A` | Brief (aprox.) |
| Líquidos | matcha `#7C9A4B`, espresso `#3A2418`, leche `#EFE6D2` | Propuesta; se ajusta al ver el render |

Los valores "aprox." no se pueden afinar más con capturas de celular; se corrigen cuando haya fotos originales.
Nada de azul.

## Tipografía

- Títulos y kinetic type: Anton (grotesca pesada y condensada).
- Interfaz: Inter SemiBold/Bold, mínimo 40 px a 1080 de ancho.
- Sin acento manuscrito mientras no haya logo en alta (competiría con el trazo real).

## Escenas

| # | Escena | Tiempo | Cuadros |
|---|---|---|---|
| 1 | Hook: cae el vaso, capa de matcha | 0.00–2.00 s | f0000–f0120 |
| 2 | Capa de espresso → encabezado | 2.00–4.00 s | f0120–f0240 |
| 3 | Capa "Los Chatos" | 4.00–6.00 s | f0240–f0360 |
| 4 | Capa del menú + giro del vaso (3D n.º 1) | 6.00–8.00 s | f0360–f0480 |
| 5 | Capa del horario | 8.00–10.00 s | f0480–f0600 |
| 6 | Capa de ubicación + lift | 10.00–12.00 s | f0600–f0720 |
| 7 | Revelación: teléfono isométrico (3D n.º 2), botón y chip | 12.00–14.00 s | f0720–f0840 |
| 8 | Respiro y cierre: giro de cámara (3D n.º 3), nombre | 14.00–16.00 s | f0840–f0960 |
| 9 | End card | 16.00–18.00 s | f0960–f1080 |

## Cuadro por cuadro

### 1 · Hook (f0000–f0120)

| Cuadro | Qué pasa |
|---|---|
| f0000 | Golpe. El vaso transparente (pared con grosor, tapa, refracción) aterriza en el centro; anillo de contacto y sombra que crece. |
| f0000–f0010 | Squash de 6 % y rebote amortiguado; la tapa asienta 2 cuadros después. |
| f0012–f0070 | Entra la capa de matcha desde arriba; la superficie oscila y se asienta (resorte amortiguado, 3 oscilaciones). |
| f0015–f0040 | Kinetic type "EN CAPAS": entra por glifo (stagger 30 ms), "EN" pequeño arriba, "CAPAS" grande. |
| f0040–f0064 | Dos hielos caen y flotan. |
| f0100–f0120 | "EN CAPAS" se comprime hacia el vaso (morph SDF), preparando la segunda capa. |

### 2 · Encabezado (f0120–f0240)

| Cuadro | Qué pasa |
|---|---|
| f0120–f0170 | Capa de espresso sobre el matcha; frontera con difusión que se estabiliza. |
| f0134 | "CAPAS" pulsa una vez al aterrizar la palabra de la locución (ver nota 2). |
| f0150–f0215 | El vaso se alarga y se aplana (morph SDF) hasta ser la barra del encabezado; la cámara baja con él. |
| f0200–f0240 | Encabezado legible: "CHATO CAFECITO" (texto neutro, Anton) y debajo "Centro · Aguascalientes". |

### 3 · Los Chatos (f0240–f0360)

| Cuadro | Qué pasa |
|---|---|
| f0240–f0262 | La capa siguiente se derrama bajo el encabezado y cuaja en el título "LOS CHATOS" + "Recomendación de la casa". |
| f0262, f0280, f0298 | Entran tres paneles de cristal, uno cada 18 cuadros: Mat-Chata, Coco Matchato, Naranjatto. Cada uno con su mini vaso en capas (código). |
| f0262–f0340 | El glass desenfoca de verdad el líquido que pasa detrás (blur 32 px, saturación 140 %, borde 1 px, ruido 2 %). |
| f0300–f0360 | Los mini vasos se llenan en orden; los precios son formas neutras (píldoras sin texto). |

### 4 · Menú + primer 3D (f0360–f0480)

| Cuadro | Qué pasa |
|---|---|
| f0360–f0380 | Scroll de la cámara (3 ticks) a la capa del menú. |
| f0380–f0440 | Dos columnas: "BARRA CALIENTE" y "BARRA FRÍA". Los nombres entran por fila con stagger de 2 cuadros; precio = forma neutra. |
| f0400–f0460 | Primer toque de 3D: el vaso, a la derecha del título, gira un cuarto de vuelta (90°) y deja ver las capas por dentro. |
| f0460–f0480 | El vaso vuelve de frente y la columna termina de asentarse. |

### 5 · Horario (f0480–f0600)

| Cuadro | Qué pasa |
|---|---|
| f0480–f0500 | Scroll (3 ticks) a la capa del horario. |
| f0500–f0560 | Panel de cristal "HORARIO"; tres filas entran con stagger de 8 cuadros. |
| f0550–f0590 | "Martes descansamos": coreografía propia. Las letras se recuestan 8° y se asientan, como quien se sienta. |

### 6 · Ubicación + lift (f0600–f0720)

| Cuadro | Qué pasa |
|---|---|
| f0600–f0620 | Scroll (3 ticks) a la capa de ubicación. |
| f0620–f0670 | Mapa estilizado en 2.5D (manzanas extruidas, sin nombres de calles ni negocios ajenos); cae el pin con rebote y sombra de contacto. |
| f0640–f0690 | Dirección: "Gral. Álvaro Obregón 344" / "Centro, Aguascalientes". |
| f0660–f0720 | Lift: riser de audio, la cámara empieza a alejarse y las capas se comprimen. |

### 7 · Revelación (f0720–f0840)

| Cuadro | Qué pasa |
|---|---|
| f0720 | Golpe del lift. Segundo toque de 3D: la página completa queda dentro de un teléfono en isométrico real a 30°, luz arriba-izquierda. |
| f0720–f0760 | El teléfono asienta (overshoot de 3°); sombra de contacto que crece. La interfaz se lee completa. |
| f0770–f0800 | Botón "Cómo llegar": pulsación (escala 0.96 → 1.0) y onda de contacto. |
| f0800–f0830 | Chip "@chato_cafecito": pulsación y onda más pequeña. |

### 8 · Respiro y cierre (f0840–f0960)

| Cuadro | Qué pasa |
|---|---|
| f0840–f0900 | Respiro: solo pad. Tercer toque de 3D: giro final de cámara (de 30° a frontal) y el teléfono se disuelve en el vaso (morph SDF). |
| f0880–f0930 | Las capas se asientan por última vez. |
| f0890–f0950 | "Chato Cafecito" se escribe sobre las capas, glifo por glifo (texto neutro, Anton; no imita el trazo del logo). |
| f0960 | Golpe grave. Único corte de la pieza. |

### 9 · End card (f0960–f1080)

Fondo `#12110E`. Logo de Chato (captura, ≤ 300 px, sin tocar) arriba; debajo
"Demo de cortesía de Elevate Negocios · pieza no oficial". Entrada en 12 cuadros, estático el resto.

## Textos en pantalla (todo lo que se lee)

| Sección | Texto |
|---|---|
| Kinetic | EN CAPAS |
| Encabezado | CHATO CAFECITO · Centro · Aguascalientes |
| Los Chatos | LOS CHATOS · Recomendación de la casa · Mat-Chata · Coco Matchato · Naranjatto |
| Barra caliente | Espresso · Americano · Cortadito · Flat white · Capuchino · Latte · Caramel machato · Chai latte · Matcha latte |
| Barra fría | Americano / Aerocano · Espresso / CB tonic · Coldbrew · Latte · Caramel machato · Chai latte · Matcha latte · Soda Berry Nais · Frappe |
| Horario | Lun · Mié · Jue · Vie — 8:30 a 14:00 y 16:00 a 20:00 / Sábado — 9:00 a 14:00 y 16:00 a 20:00 / Domingo — 9:00 a 16:00 / Martes descansamos |
| Ubicación | Gral. Álvaro Obregón 344 · Centro, Aguascalientes |
| Acciones | Cómo llegar · @chato_cafecito |
| Cierre | Chato Cafecito |
| End card | Demo de cortesía de Elevate Negocios · pieza no oficial |

Formas neutras, sin texto: precios, teléfono/WhatsApp, calificación y reseñas, talleres y eventos.
"Espresso / CB tonic" y "Americano / Aerocano" van como los escribe su propio menú, para que quepan a 40 px.

## Locución (ElevenLabs, la graba Salvador; español de México, 2 tomas)

| # | Línea | Entra | Kinetic / aterrizaje |
|---|---|---|---|
| 1 | Un buen cafecito se sirve en capas. | 0.40 s (f0024) | "CAPAS" pulsa en la palabra (≈ f0134) |
| 2 | Y tu negocio, con una página que también lo sea. | 4.10 s (f0246) | "LOS CHATOS" aterriza en "página" |
| 3 | Tus bebidas, tu horario y tu ubicación, ahora en el celular. | 7.90 s (f0474) | menú en "bebidas", panel en "horario", pin en "ubicación" |
| 4 | Así se vería la página de Chato Cafecito. | 12.40 s (f0744) | botón "Cómo llegar" en "página" |
| 5 | Si te gusta, la hacemos realidad. | 14.50 s (f0870) | el nombre termina de escribirse en "realidad" |

## Música (original, en código, 120 BPM)

| Sección | Capas |
|---|---|
| Compases 1–2 | Sub grave + pad |
| Compases 3–4 | + pluck suave |
| Compases 5–6 | + shaker ligero; riser de 11.0 a 12.0 s |
| Compás 7 | Lift pleno en 12.0 s |
| Compás 8 | Respiro de 14.0 a 15.0 s solo con pad; golpe grave en 16.0 s |
| End card | Cola del golpe y pad en fade |

## SFX (biblioteca propia sintetizada, mínimo 70 cues)

| Escena | Cues | Qué |
|---|---|---|
| 1 | 11 | impacto del vaso, anillo, tapa, vertido, 3 asentamientos, 2 hielos, entrada y salida del type |
| 2 | 8 | vertido, difusión, estirón del vaso, 2 whooshes de cámara, 2 ticks de texto, asentamiento |
| 3 | 11 | derrame, título, 3 paneles, 3 llenados de mini vaso, 3 brillos de cristal |
| 4 | 12 | 3 ticks de scroll, 2 títulos de columna, 4 golpes de filas, giro del vaso, chapoteo, regreso |
| 5 | 9 | 3 ticks de scroll, panel, 3 filas, "Martes descansamos", asentamiento |
| 6 | 9 | 3 ticks de scroll, mapa, caída y rebote del pin, 2 de dirección, riser |
| 7 | 8 | golpe del lift, teléfono que asienta, sombra, pulsación ×2, onda ×2, brillo |
| 8 | 7 | giro de cámara, morph, 2 asentamientos, escritura del nombre, respiro, golpe grave |
| 9 | 2 | entrada de la end card, cola |
| **Total** | **77** | |

Mezcla: voz ≈ −16 LUFS, música al menos 12 dB por debajo de cada palabra, master −14 LUFS / −1.25 dBTP.

## Zonas seguras y re-layout

- 9:16: todo lo importante entre y = 250 y y = 1580. Texto de interfaz ≥ 40 px.
- 1:1: re-layout real. El vaso va a la izquierda y la capa/sección activa a la derecha; el teléfono final se
  inclina menos y ocupa el centro; "Los Chatos" pasa de columna a fila de tres paneles.

## Notas y riesgos (para decidir antes de la fase 3)

1. **Las líneas 4 y 5 de la locución quedan muy pegadas.** La línea 4 entra en 12.40 s y dura unos 2.2 s a ritmo
   natural, así que termina hacia 14.6 s; la 5 entra en 14.50 s, justo en el respiro. La regla es acortar el texto,
   no acelerar la voz. Propuesta: línea 4 = "Así se vería la página de Chato." o mover la 5 a 14.80 s. Se decide con
   la toma real.
2. **"EN CAPAS" y su palabra.** El texto debe verse en el hook (compás 1), pero "capas" se pronuncia hacia 2.2 s.
   Propuesta: entra con el golpe en f0015 y pulsa una vez cuando la voz dice "capas".
3. **Cuatro palabras como máximo** aplica al kinetic type; el menú y el horario son interfaz y llevan más texto.
4. **Horario a 40 px**: cada día ocupa dos renglones (día arriba, horas abajo) para no bajar el tamaño.
5. **Sin fotos**, la página que se ve en el video es tipográfica, con objetos en código. Si llegan fotos
   originales, entran en la página real sin rehacer el video.

## Motor

Se reutiliza el de Siniestro: `timeline.mjs` como fuente única de tiempos, render determinista con 8 subcuadros
por cuadro → ffmpeg, voz/música/SFX/mezcla en Python. Lo nuevo es el compositor: campo líquido SDF 2.5D en WebGL
con el vaso, el glass con desenfoque real y el teléfono isométrico. Todo vive en `chato/`.
