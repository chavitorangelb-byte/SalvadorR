# Patissier · brief del video (demo de cortesía, pieza no oficial)

Vertical 9:16, 1080×1920, 60 fps, 120 BPM (compás = 2.0 s = 120 cuadros). 16 s de pieza + 2 s de end card = 1080 cuadros.
Fuente de verdad de los tiempos: `video/timeline/timeline.mjs` (la usan la captura de la página y el compositor).

**Estado: fase de preview.** Tiempos de locución PLANEADOS (no hay toma todavía, falta la clave de ElevenLabs).
Cuando exista la toma, se miden las palabras y todo lo marcado con (voz) se mueve a la voz.

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

## Beat sheet (segundos · cuadro)
| Tiempo | Cuadros | Qué pasa |
|---|---|---|
| 0.00–0.50 | 0–30 | HOOK. Pantalla oscura; en el cuadro 0 la cinta entra disparada de izquierda a derecha con latigazo y motion blur. |
| 0.13–0.43 | 8–26 | La caja blanca cae al centro (contacto en el cuadro 26), rebota y asienta; la sombra de contacto se cierra. |
| 0.34–1.50 | 20–90 | La cinta vuelve por arriba, rodea la caja y se anuda: punta, banda, lazo izquierdo, lazo derecho, punta. |
| 0.86 | 52 | "20" aterriza (voz: "veinte"). |
| 1.16 | 70 | "AÑOS" aterriza letra por letra, 30 ms entre glifos (voz: "años"). |
| 1.42 | 85 | El moño aprieta (resorte) y aparece el nudo. |
| 2.00–3.00 | 120–180 | La cinta se suelta; la primera escena cae fuera de cuadro y el trazo viaja a su lugar como marco del teléfono (giro que asienta con resorte). |
| 2.44–2.96 | 146–178 | El cristal crece dentro del marco (SDF moño → rectángulo redondeado). |
| 2.55–3.95 | 153–237 | HERO de la página: logo, "Pastelería Artesanal Patissier", título "Repostería artesanal" por glifo, bio real y foto del pastel de dinosaurio. |
| 3.86–4.50 | 232–270 | Scroll corto para dejar la tarjeta de reseña en zona segura. |
| 4.00–5.30 | 240–318 | La línea dibuja la tarjeta de cristal; "4.8", cinco estrellas en cascada y "en Google" (voz: "cuatro punto ocho"). |
| 4.55–5.90 | 273–354 | La reseña real aparece letra por letra dentro del cristal. |
| 6.00–6.95 | 360–417 | Scroll a la GALERÍA (rosa con fresas, dos pisos con flores, red velvet) con parallax; la cámara orbita ligeramente. |
| 7.86–8.72 | 472–523 | Scroll al pedido. Sabores visibles; foto de red velvet. |
| 8.42–9.30 | 505–558 | SELECTOR DE TAMAÑOS: Mini 3 · Chico 8 · Mediano 14 · Grande 18 personas, en cascada (voz: "Elige el tamaño"). |
| 9.42–10.05 | 565–603 | Toque en Mediano; anillo de luz. |
| 10.62–11.05 | 637–663 | Círculo de contacto sobre "Pedir por WhatsApp"; el botón se hunde (voz: "y pide por WhatsApp"). |
| 11.05–11.85 | 663–711 | El botón suelta una onda que sale del teléfono al campo líquido. |
| 12.00–13.40 | 720–804 | Respiro y lift: la cámara se aleja, teléfono completo con la web viva (regresa a la portada). |
| 14.00–15.20 | 840–912 | La interfaz se pliega hacia el moño (SDF inverso). "PATISSIER" y "Repostería fina" (voz). |
| 16.00–18.00 | 960–1080 | END CARD: logo oficial moderado en medallón blanco y "Demo de cortesía de Elevate Negocios · pieza no oficial". Golpe grave en 16.00; 0.5 s de silencio al final. |

Hecho y verificado en cuadros: 0.00–5.00 s. Diseñado pero aún sin construir en el compositor: cámara de 6 s en adelante, onda del botón, plegado final y end card.

## Locución (planeada; español de México, cálida, sin prisa)
| Inicio | Línea |
|---|---|
| 0.50 | Más de veinte años de repostería artesanal. |
| 4.00 | Cuatro punto ocho estrellas en Google. |
| 6.20 | Imagínalos en tu propia página. |
| 8.40 | Elige el tamaño… |
| 10.20 | …y pide por WhatsApp. |
| 13.60 | Patissier. Repostería fina. |

## Datos en pantalla (todos de la lista verificada)
- "Pastelería Artesanal Patissier", "Repostería artesanal", la frase de su bio, "4.8 en Google", la reseña real sin nombre.
- Sabores: Moka, Chocoqueso, 3 Leches con durazno, 3 Leches con galleta · Red Velvet, Zanahoria, Licor irlandés, Cheesecake.
  (Sin las marcas Oreo y Baileys hasta que el dueño las apruebe.)
- Tamaños: Mini 3, Chico 8, Mediano 14, Grande 18 personas. **Sin precios** (capa opcional: `?precios=1`).
- Botón "Pedir por WhatsApp" **sin número**. En la página viva abre WhatsApp con el pedido escrito y el cliente elige el chat; el número se pone en `CONFIG.wa` cuando el dueño lo confirme.
- No aparecen: horario, dirección, precios, DiDi, personajes con licencia, fotos con personas.

## Pendientes antes del render completo
1. Clave de ElevenLabs para la voz (2 tomas) y bloquear la línea de tiempo a la toma elegida.
2. Volver a revisar "4.8" en Google Maps el día del render.
3. Aprobación del preview (hook + teléfono).
