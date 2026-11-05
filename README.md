# Siniestro Tattoo Studio · demo de Elevate Negocios

Pieza spec: la página que se le propone al dueño y el video vertical de 27 s que la presenta.
La interfaz del video **es** la página real, capturada cuadro por cuadro.

## Entregables (`video/out/`)

| Archivo | Qué es |
|---|---|
| `siniestro_9x16_master_60fps.mp4` | Master vertical 1080×1920, 60 fps, H.264 alta calidad |
| `siniestro_9x16_whatsapp_30fps.mp4` | Versión para WhatsApp, 30 fps, `-preset veryfast` |
| `siniestro_1x1_master_60fps.mp4` / `siniestro_1x1_whatsapp_30fps.mp4` | Reencuadre real 1080×1080 |
| `stems/voz.wav`, `stems/musica.wav`, `stems/sfx.wav`, `stems/master.wav` | Stems a 48 kHz / 24 bits (suman el master antes del limitador) |
| `pagina_siniestro_tattoo.html` | La página en un solo archivo |
| `video/BRIEF.md` | Brief con tiempos exactos por fotograma (generado desde la línea de tiempo) |

## Estructura

| Carpeta | Qué hay |
|---|---|
| `assets/` | Originales recibidos. No se editan. |
| `site/` | La página: `index.html` + `img/` + `fonts/`. Fuente de verdad. |
| `dist/siniestro-tattoo-demo.html` | La página en un solo archivo (fuentes e imágenes incrustadas). |
| `tools/` | Recorte del logo, fotos, empaquetado y capturas de revisión de la página. |
| `video/timeline/` | `timeline.mjs` (línea de tiempo maestra, compartida por captura y compositor), voz por palabra, cues de SFX. |
| `video/capture/` | `capture.mjs` (página a 60 fps y 3× con reloj virtual), `morph.py` (morph SDF ES→EN). |
| `video/compositor/` | `frame(t)` en Three.js: celular de cristal 3D, tarjetas 3D, tinta, tipografía cinética, end card. |
| `video/render.mjs` | Render determinista: 8 subcuadros por cuadro (motion blur + antialias) → ffmpeg. |
| `video/tools/` | Voz (`vo_assemble.py`), música (`music.py`), SFX (`sfx.py`), mezcla (`mix.py`), brief y entregables. |

## Reconstruir

```bash
cd site && python3 -m http.server 8123 &          # la página para la captura
node video/capture/capture.mjs --dpr 3            # 1) capturas de la página (~7 min)
python3 video/capture/morph.py                    # 2) morph ES->EN
python3 video/tools/vo_assemble.py                # 3) voz en la línea de tiempo
python3 video/tools/music.py && python3 video/tools/sfx.py && python3 video/tools/mix.py   # 4) audio
node video/render.mjs --format 916 --out video/build/render/master_916_prores.mov       # 5) video (~1 h)
node video/render.mjs --format 11  --out video/build/render/master_11_prores.mov
video/tools/deliver.sh                            # 6) entregables
```

Ajustar un tramo sin re-renderizar todo (por ejemplo, una llave de cámara en `layout.mjs`): se re-renderizan
solo esos cuadros y se empalman en el ProRes por copia de flujo; el resto del master no se recodifica.

```bash
video/tools/splice.sh 916 1060 1160 && video/tools/deliver.sh 916
```

Vista rápida de cuadros sueltos: `node video/render.mjs --format 916 --scale 0.5 --subs 1 --frames 120,300 --png /tmp/x`.

## Página: parámetros de URL

- `?lang=en` abre en inglés (también se recuerda la última elección).
- `?filter=color` abre la galería filtrada.
- `?wa=52XXXXXXXXXX` manda las cotizaciones a otro número (para probar sin escribirle al estudio).
- `?capture=1` modo captura del video (no abre WhatsApp; zonas seguras de celular; reloj controlado).

## Datos

Verificados: nombre, dirección (Calle Rayón 262, Zona Centro, 20000 Aguascalientes, Ags.),
WhatsApp 449 209 3214, tatuando desde el 05/04/2003 (el número de años se calcula solo).

Marcadores honestos (pendientes del dueño): **Tus precios aquí**, **Tu horario aquí**,
**Tu trabajo aquí**. No se usan calificaciones, reseñas, precios, horario, ni el nombre o la cara del tatuador.

## Pendiente antes de publicar (si el dueño acepta)

- Foto original de *León y caballero*: la actual es provisional (recorte del grid de Instagram, baja resolución).
- Foto de referencia: hoy el cliente la adjunta a mano en el chat (WhatsApp no permite adjuntar desde un enlace).
  Para que viaje sola hace falta un endpoint que la guarde y devuelva un link (`CONFIG.uploadEndpoint`).
- Quitar `<meta name="robots" content="noindex">` y la línea de demo del pie.
- Dominio y hosting.

Voz: ElevenLabs (voz Eric) generada vía vidIQ; la toma anterior con Brian queda en `video/audio/vo/` como alternativa. Fuentes: Big Shoulders Display y Barlow, SIL OFL 1.1.
Música y efectos: sintetizados en código, sin muestras.
