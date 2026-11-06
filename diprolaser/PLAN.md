# DIPROLASER · página web · Fase 1 (revisión del kit) y Fase 2 (plan)

Estado: fase 1 y 2 aprobadas con las recomendaciones (5 paneles, retoque de la etiqueta, fallback pre-renderizado,
"Somos fabricantes, no revendedores", upscale de promocionales). **Fase 3 entregada, esperando aprobación.**
Revisión de la fase 3: `review/fase3_revision.jpg`.
Hoja visual de hallazgos: `review/fase1_revision_kit.jpg` (interna, no es para el cliente).

---

## FASE 1 · Revisión del kit

Revisé LEEME.txt, las 12 gorras recortadas y las 22 piezas promocionales a tamaño real sobre magenta y
sobre negro, las placas, las 2 fotos de estudio, las 28 fotos de fábrica, las 3 hojas de producto,
los 3 videos (cuadro por cuadro) y las 21 capturas de referencias_estilo/.

### Lo que está bien

- **Logo a color** 1320×1274 sobre negro puro: se separa limpio por luminancia, brillo incluido.
- **Gorras recortadas** (≈640–730 px): bordes limpios. Medí el borde contra el interior de cada PNG: no hay
  halo blanco. Las mordidas que marcaron con círculos amarillos en los videos anteriores
  (copa trasera y punta de visera) **ya no aparecen** en estos recortes.
- **28 fotos de fábrica**: referencia perfecta para modelar (costuras, pespuntes de visera, forro rojo,
  snapback, perforaciones, malla).
- **Videos**: texto en pantalla claro. Ya extraje los 7 pasos del proceso (abajo).
- **Placa sin nombre** con la franja vacía, lista para el grabado en vivo.

### Problemas y lo que no alcanza (con propuesta)

| # | Hallazgo | Propuesta |
|---|---|---|
| 1 | **Etiqueta de visera en espejo** en los 4 recortes de Placa Águila: "DIPROLASER" se lee al revés (las fotos de estudio parecen volteadas y la placa DAVILA se puso después). Incluye `placa_aguila_tres_cuartos.png`, la que pediste para el hero. | Retoco solo esa zona: pongo la etiqueta correcta con warp de perspectiva sobre la misma superficie, con su luz. Nada más del recorte se toca. |
| 2 | **La gorra real es de 5 paneles, no de 6.** Todas las fotos muestran el frente de una sola pieza (A-frame), sin costura al centro. | Modelo 5 paneles. Con 6, la costura central partiría el logo del cliente a la mitad y ya no sería su gorra. |
| 3 | **Promocionales en baja resolución**: termos de 148 px de ancho, vasos de 190–260, llaveros de cinta de 105 px de alto. En un celular (3x) un vaso mostrado a 160 px necesita ~480 px. | Pedir fotos mejores al cliente (lo ideal). Mientras: subo ×4 con Real-ESRGAN (ya verifiqué que el modelo se descarga aquí; lo pruebo en la fase 3) y lo comparo lado a lado; solo se queda si respeta el producto. El carrusel se diseña para no mostrarlos más grandes de lo que aguantan. Los cascos tienen bordes dentados: limpio solo el borde. Las tapas transparentes traen el fondo blanco "horneado": sobre negro se leen como tapa esmerilada, lo dejo así. |
| 4 | **Placa vectorizada tosca**: el escudo del PNG tiene letras y plumas chorreadas; las placas reales (SINALOA, JUÁREZ) son mucho más finas. A 920 px aguanta en tamaño medio, no a pantalla completa. | Pedir el archivo que usan para grabar. Plan B: la muestro a ~380 px con shader de metal y el nombre nítido encima. |
| 5 | **Stanley y YETI con el logo borrado**: `vaso_asa_*` son Stanley Quencher y `vaso_rosa_*` son YETI Rambler en la hoja original. Los recortes ya vienen limpios (cumplen la regla), pero la silueta Stanley se reconoce. | Los uso tal cual. Conviene confirmar si venden esas marcas o equivalentes genéricos; si son originales, borrar la marca de la foto es raro. |
| 6 | **DIPRO CAPS**: el personaje (sombrero de copa, bigote, costal de dinero) se parece mucho a Mr. Monopoly de Hasbro. Ya sale en sus videos aprobados. | Lo trato como suyo, pero no lo hago protagonista: solo en "Ver foto real" del modelo Bordado y en los videos. Ni hero ni imagen para compartir. |
| 7 | **Logo de un color blanco**: trazado tosco, la X tiene bordes rasgados. | No lo uso en pantalla. Para el grabado en plata derivo la versión de un tono del logo oficial por luminancia (sin redibujar). |
| 8 | **No hay archivo plano de la etiqueta hexagonal**, solo fotos en ángulo. | Pedir el archivo. Si no hay, la reconstruyo: hexágono plateado + logo oficial recortado + los dos hexágonos chicos (PREMIUM y cabezal láser) redibujados fieles a la foto frontal de `captura_video_07`. |
| 9 | **Faltan fotos de técnicas**: no hay ninguna foto de parche de piel, de impresión a todo color ni de grabado láser sobre gorra. La única muestra de bordado es DIPRO CAPS. No hay gorras reales en azul marino, gris, verde olivo ni blanco. | Esas técnicas y colores serán simulación del configurador. "Ver foto real" muestra el modelo real más cercano y lo dice ("Foto real del modelo; el color puede variar"). |
| 10 | **Datos que dicen sus videos y no estaban en tu lista**: "+60 modelos" (video 1 dice también "+27"), "50 % de anticipo para iniciar la fabricación / 50 % restante al entregar", "No somos revendedores", "Cotiza directo con fabricantes", "Más fresca: microperforaciones atrás para que respire", "Antes de fabricar, te mandamos una muestra digital". | Pediste que "Cómo trabajamos" use solo lo del video, así que ahí van (incluido el 50/50). Fuera de esa sección los uso solo si apruebas (ver decisiones). |
| 11 | **Visor sin WebGL "con fotos reales y drag entre ángulos"**: solo Placa Águila tiene varios ángulos (4). Los demás modelos tienen una sola foto. | Ver decisión 5. |
| 12 | Videos: 720×1280, 30 fps, 1.9–2.5 MB. | Sirven. Los re-codifico a ~1 MB con póster AVIF y `preload="none"`. |
| 13 | `foto_gorra_camioneta_*` son historias de Instagram con una camioneta de marca. | Solo referencia de estilo, no van en la página. `NO_USAR_*` no se usa ni se versiona. |

**Ojo legal, solo para que lo tengas en el radar:** el uso del Escudo Nacional está regulado en México
(Ley sobre el Escudo, la Bandera y el Himno Nacionales). Es su producto y está por todos lados en el mercado;
no lo freno, pero si el cliente pregunta, que lo sepa.

### Pasos del video 02 (texto exacto en pantalla)

| Paso | Título | Texto |
|---|---|---|
| Entrada | ¿Tienes una idea? | ¿Tienes una idea para tus gorras... pero no sabes por dónde empezar? |
| 01 · Contacto | Tu idea comienza aquí | Escríbenos y cuéntanos qué tienes en mente. |
| 02 · Asesoría | Te asesoramos de principio a fin | Material, uso y colores... según lo que necesitas y tu presupuesto. *(chips: Gamuza, Tela, Microperforada · Empresa, Evento, Marca · "A tu medida y presupuesto")* |
| 03 · Modelo | Elige tu estilo | Elige tu estilo entre más de 60 modelos. |
| 04 · Diseño | Hazla tuya | Adaptamos tu logo o tu diseño a la gorra. |
| 05 · Muestra | Visualiza tu diseño | Antes de fabricar, te mandamos una muestra digital para que veas cómo va a quedar. |
| 06 · Aprobación | Aprueba y comenzamos | ¿Te gustó? Apruebas, das el 50 % de anticipo... y comenzamos a fabricar. |
| 07 · Entrega | Recibe tus gorras | Recibes tus gorras y pagas el 50 % restante al entregar. |
| Cierre | Tu idea, hecha realidad | Cuéntanos tu idea. En DIPROLASER te acompañamos en cada detalle. |

Video 01 (gorras) y video 03 (Placa Águila) confirman: "Somos fabricantes directos", "Fabricación propia ·
Aguascalientes", "Tu diseño. Tu marca.", "Repele el agua", "Envíos a toda la República", "Tu nombre, tu apellido,
tu apodo", "Tú eliges cómo llevarlo", "Escoge cualquier gorra de nuestro catálogo · Le ponemos tu placa",
"Arma la tuya", "Y en redes como DIPROLASER". Colores de sus chips: negro, rojo, camel, beige, azul marino.

---

## FASE 2 · Plan

### Arquitectura

```
diprolaser/
  kit/            originales recibidos (no se editan; NO_USAR_* fuera de git)
  web/            proyecto Vite
    index.html    HTML semántico completo: todo el texto existe sin JS (SEO, accesibilidad, LCP)
    src/
      main.js             arranque: Lenis + GSAP/ScrollTrigger, carga diferida por sección
      styles/             tokens.css, glass.css, type.css, secciones
      gl/aura.js          lienzo WebGL2 de fondo (sin Three): luz roja que respira, blobs SDF, morph X→gorra→vaso, color por sección
      sections/*.js       hero, cinta, placa, regalos, tecnicas, proceso, videos, mapa, cta
      configurator/       Three.js: cap/ (geometría), materials/, decal/, water/, ui.js, fallback.js
      lib/                whatsapp.js, logo-processing.worker.js, haptics.js, sound.js, motion.js
    public/       videos, og.jpg, favicons, _headers (caché e inmutables para Netlify)
    tools/        pipeline de assets (Python/sharp): recorte por luminancia, decontaminación de bordes,
                  máscaras de vasos y cintas, Real-ESRGAN, AVIF/WebP/srcset, mapa de México, OG, QA
    dist/         build final: se arrastra tal cual a Netlify
  review/         capturas de QA y hojas de revisión
  LEEME.md        cómo cambiar textos, fotos y links de redes
```

- **Stack**: Vite 8, JavaScript (ES modules), Three.js 0.186.1 fijo, GSAP 3.15 + ScrollTrigger, Lenis 1.3.
  Sin frameworks. Versiones exactas en `package.json`, sin `^`.
- **Presupuesto de carga**: primera pantalla < 120 KB de JS comprimido (sin Three). Three y el configurador
  (~200 KB gz) llegan con `import()` cuando la sección está a una pantalla y media.
- **Hero y Lighthouse**: el LCP es el titular + el recorte de la gorra (AVIF, precargado). La gorra 3D del hero
  aparece encima con un crossfade cuando Three ya cargó (al primer gesto o en tiempo ocioso). Así el 3D no compite con el LCP.
- **Build de preview vs producción**: `npm run build` (indexable, SEO 100) y `npm run build:preview`
  (agrega `noindex`). Se entrega la que digas.

### Mapa de secciones

1. **Hero**: líquido rojo (SDF en el lienzo de fondo) forma la X → crossfade al logo oficial recortado por luminancia.
   Gorra 3D girando lento frente a la luz roja (antes de cargar: recorte con parallax, giroscopio en Android y puntero en escritorio).
   "TU MARCA. EN TU GORRA." por letra, con peso y ancho animados. Subtítulo y los dos botones.
2. **Cinta de confianza**: marquee infinito con CSS (pausa al pasar el puntero, estático con reduced-motion).
3. **Configurador 3D** (detalle abajo). Resumen fijo de cristal con `aria-live`.
4. **Placa Águila de México**: placa grande, input con grabado láser letra por letra (haz rojo + chispas en canvas,
   serif Tinos, la misma métrica que Times y Liberation Serif, con ajuste automático al ancho de la franja). Ejemplos rotando: SALVADOR, GONZÁLEZ,
   EL FLACO, DAVID, RANGEL, DÁVILA. Carrusel de cristal con placa_aguila_* y placa_real_*. "Pide la tuya" → WhatsApp.
5. **Regalos para tus clientes**: "CONSIENTE A TUS CLIENTES ESTE AÑO." Caja negra con moño rojo en CSS 3D + SVG
   que se abre con el scroll y suelta los productos con luz dorada. Tabs de cristal y carrusel 3D (CSS 3D, ligero).
   Vasos y termos recoloreables (máscara del cuerpo, conservando luminancia y brillos; bandas de acero, tapa y asa fuera).
   Cintas de llavero igual. El logo del visitante (o el de DIPROLASER) grabado en plata envuelto al cilindro y sobre la placa del llavero.
   Botones de ejemplo: FERRETERÍA EL CLAVO, TALLER HERMANOS RUIZ, PANADERÍA LA ESPIGA.
6. **Técnicas**: 6 tarjetas de cristal con demo en canvas 2D en loop (solo animan las visibles, máximo 2 a la vez):
   láser con chispas, pasadas CMYK, hilo cosiendo, placa con barrido especular, parche con pespunte y quemado, gotas que resbalan.
7. **Cómo trabajamos**: los 7 pasos del video, línea de tiempo fijada que avanza con el scroll (una línea roja que se "graba").
8. **Videos**: 3 marcos de celular de cristal, carrusel con snap, autoplay silenciado con IntersectionObserver.
9. **Hecho en Aguascalientes**: México en SVG (contorno de Natural Earth, dominio público, simplificado) con arcos de luz
   que salen de Aguascalientes. Sin nombres de ciudades: solo "Envíos a todo México".
10. **CTA final + pie**: "Arma la tuya.", píldora de cristal con 449 212 8627 (texto seleccionable, centrado),
    "Búscanos en redes como DIPROLASER" (íconos sin link + `<!-- TODO: links reales -->`), logo, © DIPROLASER, "Sitio por Elevate Negocios".
- **Botón flotante de WhatsApp** con pulso suave; cuando aparece el resumen del configurador, el botón sube para no taparlo.

### Sistema visual

**Color (tokens)**

| Token | Valor | Uso |
|---|---|---|
| `--ink-0` | #050506 | fondo base |
| `--ink-1` / `--ink-2` | #0B0B0E / #141418 | capas, tarjetas |
| `--red` | #E3262F | marca: titulares grandes, botones, luz |
| `--red-text` | #FF5A61 | texto rojo chico (el #E3262F da 4.45:1 sobre negro, no pasa AA en texto chico) |
| `--gold` | #D8B25C | acentos, luz de regalo, pasos |
| `--silver` | #C9CDD3 | etiqueta, grabado, bordes de cristal |
| `--text` / `--text-2` | #F4F4F6 / rgba(244,244,246,.72) | texto |

Resplandor por sección (sale de los productos, hace morph suave entre secciones; el negro y el rojo nunca se van):
configurador = rojo de la gorra roja · placa = oro · regalos = azul de vaso #1D46B4 → olivo #59612A → rosa #E7B9CF
según la tab · técnicas = camel #B8764E · proceso y CTA = rojo DIPROLASER.

**Cristal**: `backdrop-filter: blur(32px) saturate(150%)`, borde interior de 1 px con degradado (brillo arriba a la izquierda),
reflejo especular con `--mx/--my` desde el puntero (o el giroscopio en Android; en iOS pedir permiso de movimiento es intrusivo,
ahí sigue al scroll), sombra amplia y suave. Nav flotante que se encoge al hacer scroll.
Riesgo conocido: muchos cristales encima de un lienzo animado tiran fps en gama media. Por eso el lienzo de fondo
corre a media resolución y 30 fps, y limito cuántos cristales se ven a la vez.

**Tipografía**
- Display: **Archivo variable** (ejes de ancho 62–125 y peso 100–900, con itálica). Es grotesca condensada fuerte *y* deja
  animar peso y ancho de verdad; la itálica pesada empata con el logo y con los títulos de sus videos. Alternativa: Anton.
- Texto: Inter variable. Etiquetas: Inter 600 en mayúsculas con tracking .18em (como "PASO 01 · CONTACTO" en sus videos).
- Nombre en la placa: Tinos (métrica de Times, la que pide el LEEME). Todo autoalojado y con subset latino.

**Movimiento**
- Duraciones 160 / 320 / 640 / 1200 ms. Entradas `expo.out`, morphs `power3.inOut`, magnéticos con resorte.
- Titulares: stagger de 25 ms por letra, peso 300→900 y ancho 125→70 al entrar; máscaras que revelan con el scroll.
- Scroll: Lenis + ScrollTrigger, secciones fijadas con scrub (sin saltos).
- Microinteracciones: botones magnéticos, chips que salpican líquido (metaball en canvas chico), cursor de cristal solo
  con puntero fino, vibración de 8 ms en Android (iOS no la soporta). Sonido sintetizado en WebAudio, apagado por default.
- `prefers-reduced-motion`: misma página; morphs → crossfades, sin autogiro, sin Lenis, marquee quieto.

### La gorra 3D

**Geometría procedural en código** (BufferGeometry paramétrica, ~70k triángulos), con las fotos de fábrica como referencia:
- **Copa A-frame de 5 paneles**: frente alto y casi vertical de una pieza (con entretela, arista nítida), 2 laterales y
  2 traseros. Cada panel es su propia malla (permite bicolor, malla trucker y perforaciones por panel).
- **Costuras**: hundido de la costura + doble pespunte (instancias de puntadas) + cinta interior roja visible desde abajo.
- **Botón superior** forrado, **ojales** bordados en los paneles laterales y traseros, **cierre snapback** con el arco trasero.
- **Visera** precurva con grosor y canto redondeado, 7 filas de pespunte paralelas al borde (como en las fotos),
  cara de abajo como material aparte (rojo por default, como en su producto).
- **Etiqueta hexagonal** en la visera: malla delgada que sigue la curva, metal plateado con el logo grabado.
- Morph targets para las pequeñas diferencias de copa entre modelos.

**Materiales** (MeshPhysicalMaterial + shaders propios, normales generadas en el navegador, sin texturas pesadas):
Tela (sarga diagonal), Gamuza (sheen + pelo con dirección), Microperforada (agujeros reales por alpha + forro detrás + luz trasera
que se asoma), Impermeable perforada (poliéster liso, poca rugosidad; "Échale agua": gotas que hacen perla, resbalan por la superficie
con gravedad, se juntan, rebotan en la visera y caen), Trucker (frente de gamuza + malla transparente de verdad, se ve el interior),
Bicolor (copa beige + visera negra de gamuza, como la foto).

**Color por parte**: corona, visera y abajo de la visera, con chips negro, rojo DIPROLASER, camel, beige, gris, azul marino,
verde olivo, blanco. El cambio viaja como barrido líquido desde el punto tocado (frente con borde de ruido y un brillo en la ola).
Cambio de modelo = disolución líquida + temblor tipo gelatina que se amortigua.

**Sube tu logo** (todo en un Web Worker, nada sale del teléfono): detecta fondo blanco, negro o transparente, lo quita con
borde suave y decontaminación, recorta, centra y genera los mapas por técnica. Se aplica en el espacio UV del panel frontal,
así sigue la curva exacta. Técnicas: Bordado (posterizado a ≤6 hilos, relieve por distancia, normal de puntada satinada, brillo de hilo),
Placa metálica redonda (disco con bisel, metal oscuro con el logo grabado en gris como sus placas), Parche de piel (logo quemado a láser
y pespunte perimetral), Grabado láser (tono quemado sobre la tela, pelo aplastado), Impresión a todo color (con la trama de la tela asomando).

**Controles**: un dedo gira (con inercia), pellizco = zoom, doble toque = frente; teclado (flechas, +/−, Inicio);
vistas Frente, Lado, Atrás, Visera; autogiro lento si nadie toca. Render bajo demanda, DPR máx. 2 (baja solo si un cuadro
pasa de 20 ms), pausa fuera de pantalla y con la pestaña oculta.

**Salida**: "Descargar mi diseño" = render a 1080×1350 con fondo de marca + resumen. En celular además "Compartir" con la
hoja nativa (manda la imagen directo a WhatsApp). "Cotizar este diseño" abre WhatsApp con el mensaje armado + la nota
"Descarga tu diseño y mándalo en el chat" (WhatsApp no deja adjuntar desde un link).

**Sin WebGL o celular muy lento**: detección por capacidad + medición de los primeros cuadros. Ver decisión 5.

### WhatsApp

Todos los botones a `https://wa.me/524492128627?text=` + `encodeURIComponent`. Plantillas exactas del brief
(configurador con los valores reales elegidos, placa con el nombre escrito, regalos con producto, color y técnica).
`?wa=52XXXXXXXXXX` para probar sin escribirle al cliente (igual que en Siniestro).

### SEO y accesibilidad

`<title>` y description en español, Open Graph 1200×630 renderizada con la gorra y el logo, favicon = logo oficial reducido
(sin redibujar; a 32 px se lee como X roja con la banda blanca), JSON-LD LocalBusiness solo con nombre, Aguascalientes,
teléfono y areaServed México. Contraste AA, foco visible, todo con teclado, alt en español, chips como radiogroups, `aria-live` en el resumen.

### Fases que siguen

3. Primera versión completa con todas las secciones.
4. Configurador a fondo + 4 ángulos de la gorra con logo de prueba.
5. Pulido: transiciones de color entre secciones, microinteracciones, sonido opcional.
6. QA: capturas en 360, 390, 430, 768, 1280 y 1920; Lighthouse móvil; fallback sin WebGL; todos los links de WhatsApp.
7. Entrega: `dist/` para Netlify + LEEME. Y por la regla del repo: imagen para el cliente (capturas reales en celular)
   y `mensaje_whatsapp.txt`. Video de presentación no está en este brief; no lo hago salvo que lo pidas.

---

## Decisiones que necesito (con mi recomendación)

1. **¿Pieza spec o encargo?** Si es demo de cortesía: pie con "Demo de cortesía de Elevate Negocios · pieza no oficial",
   `noindex`, y así van la imagen y el mensaje. Si es encargo: build indexable. *Recomiendo preguntarlo antes de la fase 7; para trabajar da igual.*
2. **Gorra de 5 paneles** (la real) en lugar de 6. *Recomiendo 5.*
3. **Hero con `placa_aguila_tres_cuartos` retocando la etiqueta espejeada.** *Recomiendo retocar; es la foto más fuerte.*
4. **Datos de sus videos fuera de "Cómo trabajamos"**: "No somos revendedores" y "+60 modelos" en hero o cinta.
   *Recomiendo sí a "Somos fabricantes, no revendedores"; "+60 modelos" solo en el paso 3, como en el video.*
5. **Fallback sin WebGL**: (a) giro con cuadros pre-renderizados de nuestra propia gorra 3D (24 ángulos por modelo,
   recoloreables por parte, logo en 2D) + botón de foto real; o (b) fotos reales de una sola vista por modelo (Placa Águila con 4) y el logo en 2D.
   *Recomiendo (a): el que no tiene WebGL sigue armando su gorra.*
6. **Promocionales**: subir ×4 con Real-ESRGAN ahora y cambiar por fotos buenas cuando lleguen. *Recomiendo ambas.*
7. **Pedir al cliente** (no bloquea): archivo de la etiqueta hexagonal, archivo vectorial de la placa, fotos de parche y de bordado
   sin el personaje, y confirmar Stanley/YETI.
