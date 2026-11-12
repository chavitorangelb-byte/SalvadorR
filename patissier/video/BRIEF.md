# Patissier · brief del video (demo de cortesía, pieza no oficial)

Vertical 9:16, 1080×1920, 60 fps, 120 BPM (compás = 2.0 s = 120 cuadros). 16 s de pieza + 2 s de end card = 1080 cuadros.
Fuente de verdad de los tiempos: `video/timeline/timeline.mjs` (la usan la captura de la página y el compositor).

**Estado: línea de tiempo bloqueada a la voz real** (toma "Hope", ElevenLabs eleven v4, generada a mano por Salvador).
Cada línea se cortó de la toma y se colocó en su tiempo sin acelerarla ni estirarla (`video/tools/vo_place.py`).
Tiempos de palabra medidos en la toma con la envolvente, las sibilantes y los cierres de oclusivas (sin reconocimiento de voz).

## Idea
El lazo café de la caja, el detalle que sus clientes elogian en Google. Una sola cinta de satén hace todo:
entra de golpe, se anuda en moño sobre la caja blanca, se suelta y su trazo es el marco del teléfono;
la misma línea dibuja la interfaz y al final vuelve a ser el moño que cierra sobre el logo.
Una cámara, un campo líquido, cero cortes.

## Cómo está hecho
- La interfaz del teléfono **es la página real** (`site/index.html`), capturada cuadro por cuadro: su estado es función pura de `t`.
  El cristal de las tarjetas es `backdrop-filter: blur(32px) saturate(140%)`, borde de 1 px y ruido al 2 %.
- Compositor `frame(t)` en WebGL (Three.js por software), 8 subcuadros por cuadro acumulados en flotante (obturador de 180°).
- La cinta es una sola malla con grosor real (sección elíptica) y sombreado de satén anisótropo; proyecta sombra sobre la caja.
- El marco del teléfono es la misma cinta puesta de canto. El cristal crece interpolando campos de distancia (silueta del moño → rectángulo redondeado).
- Toques 3D: el moño sobre la caja (isométrico real: 45° / 35.26°), el teléfono y el canto del cristal (refracción y filo biselado).

## Paleta (cuentagotas sobre `assets/01_logo.jpg`)
| Color | Valor | De dónde |
|---|---|---|
| Verde | `#9AB83C` | mediana del óvalo del logo (154, 184, 60) |
| Café | `#5D4D43` | mediana del trazo del gorro y las letras (≈ 93–101, 77–80, 67) |
| Rosa | `#FFB5B0` | aproximado de sus gráficos de menú (no está en el logo) |
| Crema | `#F4ECE2` | elegido para texto sobre chocolate |
| Fondo | `#0B0907` → `#1B1410` | chocolate cálido, luz arriba-izquierda, sin tonos fríos |

Tipografía: Merienda (títulos; armoniza con el rotulado del logo) y DM Sans (interfaz). Las dos SIL OFL, en `site/fonts/`.

## Beat sheet (segundos · cuadro a 60 fps)
| Tiempo | Cuadros | Qué pasa | Voz |
|---|---|---|---|
| 0.00–0.50 | 0–30 | HOOK. Golpe grave en el cuadro 0; la cinta entra disparada de izquierda a derecha con latigazo y motion blur. | |
| 0.13–0.43 | 8–26 | La caja blanca cae al centro (contacto en el cuadro 26), rebota y asienta; la sombra de contacto se cierra. | |
| 0.34–1.50 | 20–90 | La cinta vuelve por arriba, rodea la caja y se anuda: punta, banda, lazo izquierdo, lazo derecho, punta. | 0.50 "Más de veinte años de repostería artesanal." |
| 1.12 | 67 | "20" aterriza (cae desde cámara, resorte). | "veinte" |
| 1.44 | 86 | "AÑOS" aterriza letra por letra (30 ms entre glifos). | "años" |
| 1.50 | 90 | El moño aprieta (resorte) y aparece el nudo. | |
| 2.00–3.00 | 120–180 | La cinta se suelta; la primera escena cae fuera de cuadro y el trazo se vuelve el marco del teléfono (giro con resorte). | |
| 2.44–2.96 | 146–178 | El cristal crece dentro del marco (SDF moño → rectángulo redondeado). | |
| 2.45–3.85 | 147–231 | HERO: logo, "Pastelería Artesanal Patissier", "Repostería artesanal" por glifo, bio real, foto del dinosaurio. | "repostería artesanal" |
| 3.70–4.30 | 222–258 | Scroll corto a la tarjeta de reseña. | |
| 3.80–5.70 | 228–342 | La línea dibuja la tarjeta de cristal; "4.8" (4.56–4.71), cinco estrellas (4.98–5.40), "en Google" (5.55). | 3.98 "Cuatro punto ocho estrellas en Google." |
| 4.62–6.05 | 277–363 | La reseña real aparece letra por letra. | |
| 6.15–7.05 | 369–423 | Scroll a la GALERÍA con parallax; la cámara orbita (6.00–8.20). Tarjetas en cascada 6.41–6.96. | 6.24 "Imagínalos en tu propia página." |
| 7.80–8.60 | 468–516 | Scroll al pedido: foto, sabores de línea y de especialidad. | |
| 8.45–9.25 | 507–555 | Fichas de tamaño en cascada: Mini 3 · Chico 8 · Mediano 14 · Grande 18 personas. | 8.43 "Elige el tamaño…" |
| 9.42 / 9.48–10.05 | 565 / 569–603 | Toque en Mediano; anillo de luz. | |
| 10.92–11.02 | 655–661 | El dedo presiona "Pedir por WhatsApp" (sin número). | 10.18 "…y pide por WhatsApp." ("WhatsApp" en 10.89) |
| 11.02–11.82 | 661–709 | El botón suelta una onda que sale del teléfono al campo líquido. | |
| 11.80–12.70 | 708–762 | Respiro y lift: la cámara se aleja, teléfono completo flotando; la página regresa a la portada. | |
| 12.70–13.95 | 762–837 | La interfaz se pliega (SDF rectángulo → moño), la cinta deja el marco y vuelve a anudarse sobre la caja, que sube. | |
| 13.34 / 14.60 | 800 / 876 | "PATISSIER" sube letra por letra; "Repostería fina" se escribe de izquierda a derecha. | 13.32 "Patissier. Repostería fina." |
| 15.62–16.00 | 937–960 | La caja sale por abajo, el texto flota hacia arriba y el medallón del logo crece. | |
| 16.00–18.00 | 960–1080 | END CARD: el medallón aterriza con golpe grave; "Demo de cortesía de Elevate Negocios · pieza no oficial". Silencio desde 17.50. | |

En 1:1 la misma pieza se re-acomoda: el teléfono va a la derecha y cada línea de la voz se lee en la columna izquierda
("4.8 / en Google", "Tu propia / página", "Elige el / tamaño", "Pide por / WhatsApp"); al final todo se centra.

## Audio
- Voz: -16 LUFS. Música en código (Re mayor, 120 BPM, capa nueva cada 4 s, lift en 12 s, respiro 15.45–16.0, golpe en 16.0),
  con ducking por la voz: al menos 12 dB por debajo en cada ventana con voz (`video/audio/mix_report.json`).
- 104 efectos sintetizados, uno por movimiento visible (`video/timeline/sfx_cues.json`).
- Master -14 LUFS integrado, pico real -1.5 dBTP (límite pedido: -1.25).

## Datos en pantalla (todos de la lista verificada)
- "Pastelería Artesanal Patissier", "Repostería artesanal", la frase de su bio, "4.8 en Google", la reseña real sin nombre.
- Sabores: Moka, Chocoqueso, 3 Leches con durazno, 3 Leches con galleta · Red Velvet, Zanahoria, Licor irlandés, Cheesecake.
  (Sin las marcas Oreo y Baileys hasta que el dueño las apruebe.)
- Tamaños: Mini 3, Chico 8, Mediano 14, Grande 18 personas. **Sin precios** (capa opcional: `?precios=1`).
- Botón "Pedir por WhatsApp" **sin número**. En la página viva abre WhatsApp con el pedido escrito y el cliente elige el chat; el número se pone en `CONFIG.wa` cuando el dueño lo confirme.
- No aparecen: horario, dirección, precios, DiDi, personajes con licencia, fotos con personas.

## Pendientes
- Volver a revisar "4.8" en Google Maps antes de mandarlo (desde esta sesión no se pudo abrir Maps).
- Si el dueño confirma: número de WhatsApp (`CONFIG.wa`), precios (`?precios=1`) y los nombres con Oreo y Baileys.
