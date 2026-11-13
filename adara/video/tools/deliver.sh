#!/usr/bin/env bash
# Entregables 9:16 a partir de las partes ProRes y la mezcla.
#   out/adara_9x16_master_60fps.mp4     H.264 alta calidad, 60 fps
#   out/adara_9x16_whatsapp_30fps.mp4   H.264 ligero, 30 fps (promedia pares de cuadros)
#   out/stems/{voz,musica,sfx,master}.wav
set -euo pipefail
cd "$(dirname "$0")/../.."          # adara/
B=video/build/render
printf "file '%s'\n" part_a.mov part_b.mov part_c1.mov part_d.mov > $B/parts.txt
ffmpeg -v error -y -f concat -safe 0 -i $B/parts.txt -c copy $B/master_916_prores.mov
mkdir -p out/stems
ffmpeg -v error -y -i $B/master_916_prores.mov -i video/audio/master.wav -map 0:v -map 1:a \
  -c:v libx264 -preset slow -crf 18 -profile:v high -pix_fmt yuv420p -r 60 \
  -color_primaries bt709 -color_trc bt709 -colorspace bt709 \
  -c:a aac -b:a 320k -ar 48000 -movflags +faststart -shortest out/adara_9x16_master_60fps.mp4
ffmpeg -v error -y -i $B/master_916_prores.mov -i video/audio/master.wav -map 0:v -map 1:a \
  -vf "tmix=frames=2:weights='1 1',fps=30" \
  -c:v libx264 -preset veryfast -crf 21 -maxrate 7M -bufsize 14M -profile:v high -pix_fmt yuv420p \
  -color_primaries bt709 -color_trc bt709 -colorspace bt709 \
  -c:a aac -b:a 160k -ar 48000 -movflags +faststart -shortest out/adara_9x16_whatsapp_30fps.mp4
cp video/audio/stems/vo.wav out/stems/voz.wav
cp video/audio/stems/music.wav out/stems/musica.wav
cp video/audio/stems/sfx.wav out/stems/sfx.wav
cp video/audio/master.wav out/stems/master.wav
for f in out/*.mp4; do
  echo "== $f"; ffprobe -v error -show_entries stream=codec_name,width,height,r_frame_rate -show_entries format=duration,size -of compact "$f"
  ffmpeg -hide_banner -i "$f" -af ebur128=peak=true -f null - 2>&1 | grep -E "^\s+I:|^\s+Peak:" | tr -s ' '
done
