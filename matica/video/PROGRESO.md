# Matíca · video · progreso (para retomar si se compacta la conversación)

Rama: `claude/matica-cafe`. Todo el proyecto vive en `matica/` (Siniestro intacto en la raíz).

## Aprobado por Salvador
- Fase 0: página real (`site/index.html`), 229 pruebas (`tools/test_page.js`).
- Fases 2-3: brief por fotograma (`video/BRIEF.md`) y línea de tiempo amarrada a la voz final
  de ElevenLabs (Hope, eleven v4: `video/audio/vo/elevenlabs_hope_v4.mp3`).
- Fase 4: prueba de estilo (`review/fase4/`): celular de cristal 3D, tarjeta 3D, la gota líquida.

## Fase 5 (en curso): construir el video completo por escenas con un frame(t) compartido
1. [x] `video/capture/capture.mjs`: página completa a 60 fps y 3x (1184 cuadros, 4 subcapturas en scrolls,
   sondas, rastro de "Agregar", texturas 3D; swipe de categorías para que se vea "Waffles de yuca").
   Correr: `matica/tools/serve.sh && node matica/video/capture/capture.mjs` (~6 min; OUT=... para otra carpeta).
2. [x] Compositor completo `video/compositor/full.mjs` (index.html lo usa por omisión; `?seq=style` = prueba de estilo).
   Cámara por transiciones (`cameraAt` en timeline.mjs), push-ins con foco en sondas, tipografía fuera de la
   pantalla (celular en x .70/.30 al 60 % del alto mientras hay texto), gota con tramos amarrados a T.*.
3. [x] Audio en código: `video/tools/music.py` (92 BPM, Rhodes + madera, capas por sección, lift, respiro,
   golpe y Cmaj9 final), `sfx.py` (117 cues), `mix.py` (voz, música ≥ 12 dB bajo cada palabra medida en su
   parte sonora, ducking por palabra, master -14 LUFS / pico -1.7 dBTP; reporte en audio/mix_report.json).
   Requiere scipy (`pip install scipy`).
4. [ ] Fase 6: preview 720x1280 30 fps (`render.mjs --scale 0.6667 --subs 6 --fps 30`) + audio + hoja de 12 cuadros.
5. [ ] Fase 7: finales 9:16 (1080x1920 60 fps master + H.264 30 fps `-preset veryfast`) y re-layout real 1:1;
   stems (voz/música/efectos); HTML de la página aparte.

Calidad de fotos: ninguna foto se ve por encima de su resolución real. El push al waffle quedó en 2.05x
(la miniatura waffle-jamon.webp mide 250 px y se muestra a 92 px CSS); el del Latte en 2.2x (latte-caliente 268 px).

Notas de mezcla: la voz queda en -13.9 LUFS integrados (el brief pedía ≈ -16): con el master en -14 y la música
12 dB abajo de cada palabra, la voz es casi todo el loudness. Avisado a Salvador.

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
