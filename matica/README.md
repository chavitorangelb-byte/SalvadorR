# Matíca Café de Especialidad · demo de Elevate Negocios

Pieza spec privada: la página que se le propone al dueño y, después, el video vertical de 27 s que la presenta.
La interfaz del video **es** esta página, capturada cuadro por cuadro.

**Estado:** Fase 0 aprobada. Fases 2 y 3 (brief por fotograma y línea de tiempo amarrada a la voz) listas con la
**voz guía** de Eric; falta la toma final de ElevenLabs (se re-amarra con un comando, ver abajo).

## Estructura

| Carpeta | Qué hay |
|---|---|
| `assets/` | Assets con los nombres del brief, recortados de las capturas que mandó Salvador (`tools/extract_assets.py`). |
| `site/` | La página: `index.html` (CSS y JS en línea) + `img/` + `fonts/`. Fuente de verdad. |
| `dist/matica-cafe-demo.html` | La página en un solo archivo (1.2 MB, fuentes y fotos incrustadas). Se abre sin servidor. |
| `review/fase0/` | Capturas de revisión (390 × 844 a 2×), página completa y `prueba_captura_60fps.mp4`. |
| `review/fase0_hoja_de_contacto.jpg` | Hoja de contacto de la Fase 0. |
| `tools/` | Extracción de assets, cifras tabulares, empaquetado, pruebas y capturas. |
| `video/BRIEF.md` | Brief del video con tiempos exactos por fotograma (se genera desde la línea de tiempo). |
| `video/timeline/` | `script.json` (guion y márgenes), `timeline.mjs` (reglas), `vo_words.json` (voz colocada), `timeline.json` y `sfx_cues.json` (resueltos). |
| `video/audio/vo/` | Tomas de voz y su alineación palabra por palabra. |
| `video/tools/` | Alineación (Whisper), colocación de la voz, amarre, brief, animatic y `relock.sh`. |
| `review/fase2/animatic_tiempos.mp4` | Animatic de tiempos con la voz y metrónomo (no es el look final). |

## Reconstruir

```bash
cd matica/site && python3 -m http.server 8124 &       # la página
python3 matica/tools/extract_assets.py                 # assets (requiere assets/capturas/, no versionadas)
python3 matica/tools/make_tnum.py                      # dígitos tabulares "Matica Num"
python3 matica/tools/sync_photos.py                    # tamaños reales + LQIP dentro de index.html
node matica/tools/test_page.js                         # 229 pruebas: menú vs. menú impreso, carrito, textos
node matica/tools/shoot_phase0.js --dpr 2              # capturas de revisión + hoja de contacto
python3 matica/tools/build_single.py                   # dist/ en un solo archivo
node matica/tools/capture_proof.mjs                    # prueba de captura 60 fps a 3x con reloj virtual
```

`tools/` necesita `npm install` (Poppins desde npm: `@fontsource/poppins` y `@expo-google-fonts/poppins`).

## Página: parámetros de URL

- `?wa=52XXXXXXXXXX` manda "Pedir para recoger" a ese WhatsApp (para probar). Sin número muestra el mensaje con el marcador **Tu WhatsApp aquí**.
- `?capture=1` modo captura del video: zonas seguras de celular, reloj controlado, no abre enlaces ni guarda el pedido.

## Datos (todo publicado por el negocio)

- Menú y precios: transcritos de su menú impreso (`assets/menu_referencia.jpg`). Correcciones pedidas: *Chocolate* y *arúgula*. "Presa francesa" del impreso queda como "prensa francesa".
- Dirección y CP: Av. Las Américas 607-1, La Fuente, 20230 (su post de Instagram). Horario de su historia "Horario". Domingo no se menciona.
- "Abierto ahora" se calcula con la hora de Aguascalientes y solo de lunes a sábado.
- Textos de ambiente: su bio, su post "Home-office friendly" y su historia de eventos y clubs. Domicilio: su historia "Domicilio".
- Reseñas: 5 textos exactos de Google, sin nombre ni foto, firmadas "Reseña en Google".
- No se usan: teléfono, calificación ni número de reseñas, café en grano, Ten Magazine, taller de cold brew, pasaporte, bebidas de temporada.

## Pendiente del dueño

- **WhatsApp** para "Pedir para recoger" (`CONFIG.wa`).
- Enlace de su tienda en **Rappi** (hoy el botón solo indica buscar "Matíca Café" en la app).
- Confirmar que los **adicionales** (leche vegetal, jarabe, extra shot) aplican a todo Café y Otras bebidas.
- Fotos originales en alta (hoy son recortes de miniaturas de Instagram de ~400 px).
- Al publicar: quitar `<meta name="robots" content="noindex">` y la línea de demo del pie; dominio y hosting.

## Voz y línea de tiempo

La toma final viene de ElevenLabs (la saca Salvador con el guion de `video/timeline/script.json`; en el texto
para la voz va "Elévate" con acento). Para amarrar el video a una toma nueva:

```bash
pip install faster-whisper                              # una vez (el modelo medium baja solo, 1.5 GB)
matica/video/tools/relock.sh ruta/a/la_toma.mp3         # alinea, coloca, re-amarra, brief y animatic (~3 min)
```

- `vo_align.py`: Whisper palabra por palabra; la ortografía la manda el guion.
- `vo_assemble.py`: coloca cada frase en su segundo; los inicios tras pausa se miden con la energía del audio
  (Whisper se equivoca ahí hasta 0.2 s). Si una frase no cabe: empuja la siguiente, adelanta esta y, al final,
  acelera máx. 6 % sin cambiar el tono.
- `lock.mjs`: resuelve todos los momentos con reglas amarradas a palabras de la voz y a la rejilla de 92 BPM,
  y valida orden de la historia, máx. 4 palabras de tipografía en pantalla, respiro sin voz y ≥ 70 cues.

## Captura del video

`window.matica` expone ganchos para Playwright: `capTick(ms)` (pausa y coloca animaciones CSS/WAAPI),
`capRects`, `tap`, `press`, `setTab`, `setTemp`, `openItem`, `addToCart`, `openCart`, `goReview`, `dropPin`, `scrollToY`.
JS y rAF se controlan con `page.clock`. `tools/capture_proof.mjs` lo demuestra: 300 cuadros a 1170 × 2532.

Fuentes: Poppins (SIL OFL 1.1). "Matica Num" son los dígitos de Poppins a ancho fijo (misma licencia).
