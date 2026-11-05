#!/usr/bin/env bash
# Entregables finales a partir de los masters ProRes y la mezcla.
#   video/out/siniestro_<formato>_master_60fps.mp4     H.264 alta calidad, 60 fps
#   video/out/siniestro_<formato>_whatsapp_30fps.mp4   H.264 -preset veryfast, 30 fps (promedia pares de cuadros)
#   video/out/stems/{voz,musica,sfx,master}.wav
set -euo pipefail
cd "$(dirname "$0")/../.."
OUT=video/out
mkdir -p "$OUT/stems"
for F in 916 11; do
  SRC="video/build/render/master_${F}_prores.mov"
  [ -f "$SRC" ] || { echo "falta $SRC"; continue; }
  NAME=$([ "$F" = 916 ] && echo 9x16 || echo 1x1)
  ffmpeg -v error -y -i "$SRC" -i video/audio/master.wav -map 0:v -map 1:a \
    -c:v libx264 -preset slow -crf 14 -profile:v high -pix_fmt yuv420p -r 60 \
    -color_primaries bt709 -color_trc bt709 -colorspace bt709 \
    -c:a aac -b:a 320k -ar 48000 -movflags +faststart -shortest "$OUT/siniestro_${NAME}_master_60fps.mp4"
  ffmpeg -v error -y -i "$SRC" -i video/audio/master.wav -map 0:v -map 1:a \
    -vf "tmix=frames=2:weights='1 1',fps=30" \
    -c:v libx264 -preset veryfast -crf 21 -maxrate 7M -bufsize 14M -profile:v high -pix_fmt yuv420p \
    -color_primaries bt709 -color_trc bt709 -colorspace bt709 \
    -c:a aac -b:a 160k -ar 48000 -movflags +faststart -shortest "$OUT/siniestro_${NAME}_whatsapp_30fps.mp4"
done
cp video/audio/stems/vo.wav "$OUT/stems/voz.wav"
cp video/audio/stems/music.wav "$OUT/stems/musica.wav"
cp video/audio/stems/sfx.wav "$OUT/stems/sfx.wav"
cp video/audio/master.wav "$OUT/stems/master.wav"
cp dist/siniestro-tattoo-demo.html "$OUT/pagina_siniestro_tattoo.html"
ls -la "$OUT" "$OUT/stems"
for f in "$OUT"/*.mp4; do
  echo "== $f"; ffprobe -v error -show_entries stream=codec_name,width,height,r_frame_rate,bit_rate -show_entries format=duration,size -of compact "$f"
  ffmpeg -hide_banner -i "$f" -af ebur128=peak=true -f null - 2>&1 | grep -E "^\s+I:|^\s+Peak:" | tr -s ' '
done
