# Colors Boutique · demo de Elevate Negocios

Pieza spec (no oficial, no publicada): la página que se le propone a la florería y el video de 18 s
(16 s + 2 s de end card) que la presenta. Idea del video: "El tallo", una sola línea que florece,
se vuelve el marco del teléfono y termina como subrayado del botón de WhatsApp.

## Estructura

| Carpeta | Qué hay |
|---|---|
| `assets/` | Fotos recibidas (capturas de Instagram) y el prompt original. No se editan. |
| `site/` | La página: `index.html` + `img/` (recortes de `tools/prep_photos.py`) + `fonts/`. |
| `tools/` | Recortes de fotos, capturas de revisión y `client_board.js` (imagen para el cliente). |
| `video/timeline/` | `timeline.mjs` (línea de tiempo maestra), voz por palabra, cues de SFX. |
| `video/compositor/` | `frame(t)` en Three.js: campo líquido SDF, teléfono y paneles de cristal, tipografía cinética. |
| `video/tools/` | Captura de la página, voz (`vo_assemble.py`), música, SFX, mezcla. |
| `video/out/` | Entregables. |

## Reconstruir

```bash
python3 colors/tools/prep_photos.py                       # recortes de las fotos
node colors/video/tools/capture_page.js                   # la página real para la pantalla del teléfono
python3 colors/video/tools/vo_assemble.py <toma.mp3>      # voz en la línea de tiempo (por palabra)
node colors/video/tools/timeline_json.mjs
python3 colors/video/tools/music.py && python3 colors/video/tools/sfx.py && python3 colors/video/tools/mix.py
node colors/video/render.mjs --format 916 --out colors/video/build/render/master_916_prores.mov
node colors/video/render.mjs --format 11  --out colors/video/build/render/master_11_prores.mov
node colors/tools/client_board.js                         # imagen para el cliente
```

Vista rápida: `node colors/video/render.mjs --format 916 --scale 0.5 --subs 1 --frames 120,300 --png /tmp/x`.

## Página: parámetros de URL

- `?wa=52XXXXXXXXXX` manda los mensajes a ese número. Sin él, WhatsApp abre con el mensaje escrito para elegir el chat
  (no hay número confirmado: el negocio muestra dos distintos).
- `?filter=bouquets` abre el catálogo filtrado. `?capture=1` es el modo de captura.

## Datos

Usados (de su bio y su descripción de WhatsApp): nombre, "Florería · Querétaro", "algo único para ese día especial",
"flores y follajes de alta calidad", equipo en la ciudad de Querétaro, flores de invernaderos de México.

No se usan hasta confirmar con el dueño: precios, teléfono, dirección, horario, usuario de Instagram, "más de quince años",
reseñas. En la página quedan como marcadores honestos: **Tus precios aquí**, **Tu horario aquí**, **Tu dirección aquí**.
Los precios del end card del video son los de Elevate Negocios.

## Pendiente antes de publicar (si el dueño acepta)

- Fotos originales (las actuales son capturas de Instagram) y el logo en alta resolución.
- Número de WhatsApp, precios, horario y dirección confirmados.
- Quitar `<meta name="robots" content="noindex">` y la línea de demo del pie. Dominio y hosting.

Fuentes: Playfair Display y Jost (SIL OFL 1.1). Música y efectos: sintetizados en código, sin muestras.
