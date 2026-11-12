# Pastelería Artesanal Patissier · demo de Elevate Negocios

Pieza spec (demo de cortesía, no oficial, no publicada): la página que se le propone al negocio y el video vertical
de 16 s + 2 s de end card que la presenta. La interfaz del video **es** la página real, capturada cuadro por cuadro.

## Entregables (`video/out/`)
| Archivo | Qué es |
|---|---|
| `patissier_9x16_master_60fps.mp4` | Master vertical 1080×1920, 60 fps |
| `patissier_9x16_whatsapp_30fps.mp4` | Versión ligera para WhatsApp e Instagram, 30 fps |
| `patissier_1x1_master_60fps.mp4` / `patissier_1x1_whatsapp_30fps.mp4` | Re-layout real 1080×1080 (no es recorte) |
| `stems/{voz,musica,sfx,master}.wav` | 48 kHz / 24 bits |
| `patissier_pagina_para_cliente.jpg` | Imagen para el cliente: 4 pantallas reales de la página en celular |
| `mensaje_whatsapp.txt` | Mensaje para el negocio (va antes del video y la imagen) |
| `guion_locucion.txt` | Guion de la voz para ElevenLabs |

## Estructura
| Carpeta | Qué hay |
|---|---|
| `assets/` | Logo y fotos propias del negocio (sin personas ni marcas de terceros). No se editan. |
| `site/` | La página (`index.html`, `img/`, `fonts/` Merienda y DM Sans, SIL OFL). `?precios=1` muestra los precios del menú; `?wa=52…` fija el número. |
| `video/timeline/timeline.mjs` | Línea de tiempo maestra, bloqueada a la voz (la comparten captura y compositor). |
| `video/capture.mjs` | Captura la página a 60 fps y 3× (su estado es función pura de t). |
| `video/compositor/` | `frame(t)` en WebGL: cinta de satén, caja isométrica, teléfono, cristal SDF, campo líquido, tipografía cinética, end card. |
| `video/render.mjs` | Render determinista con 8 subcuadros por cuadro → ProRes. |
| `video/tools/` | Voz (`vo_place.py`), música (`music.py`), efectos (`sfx.py`), mezcla (`mix.py`), entregables (`deliver.sh`). |
| `tools/client_board.js` | Imagen para el cliente. |

## Reconstruir
```bash
node video/capture.mjs --dpr 3                                     # 1) página cuadro por cuadro (~3 min)
python3 video/tools/vo_place.py                                    # 2) voz en su lugar
cd video/tools && python3 music.py && python3 sfx.py && python3 mix.py && cd ../..   # 3) audio
node video/render.mjs --format 916 --out build/render/master_916_prores.mov          # 4) video (~50 min)
node video/render.mjs --format 11  --out build/render/master_11_prores.mov
video/tools/deliver.sh                                             # 5) entregables
node tools/client_board.js                                         # 6) imagen para el cliente
```
Cuadros sueltos: `node video/render.mjs --scale 0.5 --subs 2 --frames 120,300 --png build/x`.

## Datos
Solo datos verificados: nombre y logo, frase de su bio de Instagram, 4.8 en Google (Maps, nov 2026), una reseña real sin nombre,
sabores, tamaños por personas, minicakes, postres, servicio a domicilio, @patissierp y el teléfono (solo en el botón "Llamar" de la página).
Sin precios, sin número de WhatsApp, sin horario ni dirección, sin personajes con licencia ni marcas de terceros.
El botón "Pedir por WhatsApp" abre WhatsApp con el pedido escrito y el cliente elige el chat hasta que el dueño confirme su número.
