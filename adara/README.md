# Adara Pastelería · demo de Elevate Negocios

Pieza spec privada (no publicar sin permiso de la dueña): la página que se le propone y el video vertical de 22 s
(19 s de pieza + 3 s de end card) que la presenta. La voz es una toma de ElevenLabs (Jessica, eleven v4).

## Entregables (`out/`)

| Archivo | Qué es |
|---|---|
| `adara_9x16_master_60fps.mp4` | Master vertical 1080×1920, 60 fps |
| `adara_9x16_whatsapp_30fps.mp4` | Versión ligera para WhatsApp, 30 fps |
| `adara_pagina_para_cliente.jpg` | Imagen para el cliente: seis pantallas reales de la página en celular (2160×4320) |
| `mensaje_whatsapp.txt` | Mensaje para la dueña (va antes del video y la imagen) |
| `stems/` | Voz, música, SFX y master (48 kHz / 24 bits) |

## Estructura

| Carpeta | Qué hay |
|---|---|
| `assets/` | Originales recibidos. No se editan. |
| `site/` | La página (`index.html`, `img/`, `fonts/`). `?wa=52XXXXXXXXXX` conecta el número de WhatsApp (sin confirmar: por defecto abre WhatsApp sin número). |
| `tools/` | `prep_photos.py` (logo en círculo; desenfoque de nombres de clientes), `client_board.js` (imagen para el cliente), `serve.js`. |
| `video/capture/` | Captura de la página real (390×844 pt, 3×) para el celular del video. |
| `video/compositor/` | `frame(t)` en Canvas 2D: línea de betún con morph punto por punto, cristal con desenfoque real, fichas isométricas, tipografía cinética por glifo. |
| `video/timeline/` | Línea de tiempo (`timeline.mjs`), voz por palabra (`vo_words.json`), cues de SFX. |
| `video/tools/` | Voz, música, SFX, mezcla y entregables. |

## Reconstruir

```bash
python3 -I adara/tools/prep_photos.py
node adara/video/capture/capture.js
python3 -I adara/video/tools/vo_assemble.py
python3 -I adara/video/tools/music.py && python3 -I adara/video/tools/sfx.py && python3 -I adara/video/tools/mix.py
node adara/video/render.js --from 0 --to 439 --out adara/video/build/render/part_a.mov   # y 440-879 (b), 880-1319 (c)
adara/video/tools/deliver.sh
node adara/tools/client_board.js
```
