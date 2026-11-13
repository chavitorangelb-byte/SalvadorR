# Babkery · demo de Elevate Negocios

Pieza spec privada: la página que se le propone a Babkery (panadería y café, Guadalajara) y el video vertical
de 18.5 s que la presenta. No se publica ni se envía sin autorización del dueño.

## Entregables (`video/out/`)

| Archivo | Qué es |
|---|---|
| `babkery_9x16_master_60fps.mp4` | Master vertical 1080×1920, 60 fps |
| `babkery_9x16_whatsapp_30fps.mp4` | Versión ligera para WhatsApp e Instagram, 30 fps |
| `babkery_1x1_master_60fps.mp4` / `babkery_1x1_whatsapp_30fps.mp4` | Reacomodo 1:1 (1080×1080), sin recorte |
| `stems/voz.wav`, `musica.wav`, `sfx.wav`, `master.wav` | Stems a 48 kHz / 24 bits (master −14 LUFS) |
| `babkery_pagina_para_cliente.jpg` | Imagen para el cliente: seis pantallas reales de la página en celular |
| `pagina_babkery.html` | La página en un solo archivo |
| `mensaje_whatsapp.txt` | El mensaje para el dueño (va antes del video y la imagen) |
| `video/BRIEF.md` | Brief con tiempos exactos por fotograma (generado desde la línea de tiempo) |

## Estructura

| Carpeta | Qué hay |
|---|---|
| `assets/` | Fotos recortadas del catálogo de WhatsApp Business (`tools/crop_assets.py`); originales en `assets/src`. |
| `site/` | La página real: `index.html` + `img/` + `fonts/` (Fraunces e Inter, OFL). |
| `video/timeline/build_timeline.py` | Línea de tiempo maestra bloqueada a la voz: escenas, palabras, eventos, 99 cues de SFX, brief y voz colocada. |
| `video/compositor/` | `frame(t)`: campo SDF compartido (`field.mjs`), página/cierre/end card (`page.mjs`), shader y acumulación (`main.mjs`). |
| `video/render.mjs` | Render determinista: 8 subcuadros por cuadro (motion blur) → ffmpeg. `--format 916` o `11`. |
| `video/tools/` | `music.py`, `sfx.py`, `mix.py`, `render_916.sh`, `render_11.sh`, `deliver.sh`. |
| `tools/` | Recorte de assets, `client_board.js` (imagen para el cliente), `shoot_site.js`, `build_single.py`. |

## Reconstruir

```bash
python3 video/timeline/build_timeline.py      # línea de tiempo, brief y voz colocada
python3 video/tools/music.py && python3 video/tools/sfx.py && python3 video/tools/mix.py
video/tools/render_916.sh && video/tools/deliver.sh 916      # ~45 min con 4 núcleos
video/tools/render_11.sh && video/tools/deliver.sh 11
node tools/client_board.js && python3 tools/build_single.py
```

Vista rápida de cuadros: `node video/render.mjs --scale 0.5 --subs 2 --frames 120,400 --png /tmp/x`.

## Por confirmar con el dueño antes de enseñarla

- "36 horas de fermentación" y "mantequilla premium" son afirmaciones de su propio catálogo.
- Precios, horario, dirección e Instagram no aparecen a propósito (las fuentes no coinciden).
- La página manda los pedidos al WhatsApp del negocio (`?wa=52XXXXXXXXXX` para probar con otro número).
