# Matíca · video · progreso (para retomar si se compacta la conversación)

Rama: `claude/matica-cafe`. Todo el proyecto vive en `matica/` (Siniestro intacto en la raíz).

## Aprobado por Salvador
- Fase 0: página real (`site/index.html`), 229 pruebas (`tools/test_page.js`).
- Fases 2-3: brief por fotograma (`video/BRIEF.md`) y línea de tiempo amarrada a la voz final
  de ElevenLabs (Hope, eleven v4: `video/audio/vo/elevenlabs_hope_v4.mp3`).
- Fase 4: prueba de estilo (`review/fase4/`): celular de cristal 3D, tarjeta 3D, la gota líquida.

## Fase 5 (en curso): construir el video completo por escenas con un frame(t) compartido
Orden de trabajo (cada paso se commitea al terminar):
1. [ ] `video/capture/capture.mjs`: página completa a 60 fps y 3x siguiendo `timeline.json`
   (acciones, sondas de rects, texturas de piezas 3D, 4 subcapturas por cuadro en scrolls).
2. [ ] Compositor completo (`video/compositor/main.mjs`, modo `?seq=full`): gancho con barra de
   búsqueda de cristal y tecleo, llegada, menú (gota rodea/rebota, push-ins con foco en sondas,
   tarjeta cold brew 3D), waffles (subrayado), pide (Agregar 3D con pop), así se vive (íconos de
   línea, abanico de reseñas 3D), visítanos (la gota rodea el horario), cierre, end card (logo
   oficial con giro 3D leve, la gota cae en la taza, destello, tagline y línea de demo).
3. [ ] Audio en código: música 92 BPM lo-fi (Rhodes + madera; capas: shaker, bajo, guitarra,
   pad; lift 13.04, respiro 23.00, golpe 24.00), SFX desde `timeline/sfx_cues.json` (111 cues),
   mezcla: voz -16 LUFS, música >= 12 dB bajo cada palabra, master -14 LUFS / -1.25 dBTP.
   Base: `video/tools/{music,sfx,mix}.py` de Siniestro (raíz del repo).
4. [ ] Fase 6: preview + hoja de contactos de 12 cuadros clave -> mostrar a Salvador.
5. [ ] Fase 7: finales 9:16 (1080x1920, 60 fps master + H.264 30 fps `-preset veryfast`) y
   re-layout real 1:1; stems; HTML de la página aparte (`dist/matica-cafe-demo.html`).

## Cómo correr (resumen)
- Página: `(cd matica/site && python3 -m http.server 8124 &)`
- Prueba de estilo: `node matica/video/capture/capture_style.mjs --dpr 2` y
  `node matica/video/render.mjs --scale 0.5 --subs 8 --fps 30 --out <mp4>`
- Re-amarrar a otra voz: `matica/video/tools/relock.sh <toma>` (Whisper medium; HF_HOME con el modelo)

## Decisiones vigentes
- Elevate se pronuncia "Elévate" (con acento en el texto para la voz; en pantalla "Elevate").
- Tipografía cinética: máx. 4 palabras; los grupos largos del brief se parten en relevos.
- En captura, la portada empieza bajo la barra de estado (la isla no tapa el letrero).
- Puntos a escuchar en la voz (avisados): "Que te encuentre a ti" sube como pregunta; "Waffles".
