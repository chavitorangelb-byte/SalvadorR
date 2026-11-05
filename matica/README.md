# Matíca Café de Especialidad · demo de Elevate Negocios

Pieza spec privada: la página que se le propone al dueño y, después, el video vertical de 27 s que la presenta.
La interfaz del video **es** esta página, capturada cuadro por cuadro.

**Estado:** Fase 0 (página real) lista para revisión. El video empieza al aprobarla.

## Estructura

| Carpeta | Qué hay |
|---|---|
| `assets/` | Assets con los nombres del brief, recortados de las capturas que mandó Salvador (`tools/extract_assets.py`). |
| `site/` | La página: `index.html` (CSS y JS en línea) + `img/` + `fonts/`. Fuente de verdad. |
| `dist/matica-cafe-demo.html` | La página en un solo archivo (1.2 MB, fuentes y fotos incrustadas). Se abre sin servidor. |
| `review/fase0/` | Capturas de revisión (390 × 844 a 2×), página completa y `prueba_captura_60fps.mp4`. |
| `review/fase0_hoja_de_contacto.jpg` | Hoja de contacto de la Fase 0. |
| `tools/` | Extracción de assets, cifras tabulares, empaquetado, pruebas y capturas. |

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

## Captura del video

`window.matica` expone ganchos para Playwright: `capTick(ms)` (pausa y coloca animaciones CSS/WAAPI),
`capRects`, `tap`, `press`, `setTab`, `setTemp`, `openItem`, `addToCart`, `openCart`, `goReview`, `dropPin`, `scrollToY`.
JS y rAF se controlan con `page.clock`. `tools/capture_proof.mjs` lo demuestra: 300 cuadros a 1170 × 2532.

Fuentes: Poppins (SIL OFL 1.1). "Matica Num" son los dígitos de Poppins a ancho fijo (misma licencia).
