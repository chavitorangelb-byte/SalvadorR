#!/bin/bash
# Entregables: master 60 fps y versión WhatsApp 30 fps por formato, con el master de audio.
# Uso: video/tools/deliver.sh 916|11
set -e
cd "$(dirname "$0")/../.."
F=${1:-916}; R=video/build/render; O=video/out; A=video/audio/stems/master.wav
mkdir -p $O/stems
NAME=$([ "$F" = 11 ] && echo 1x1 || echo 9x16)
ffmpeg -v error -y -i $R/master_${F}_prores.mov -i $A -map 0:v -map 1:a -c:v libx264 -preset slow -crf 15 -pix_fmt yuv420p \
  -color_primaries bt709 -color_trc bt709 -colorspace bt709 -c:a aac -b:a 320k -movflags +faststart -shortest $O/babkery_${NAME}_master_60fps.mp4
ffmpeg -v error -y -i $R/master_${F}_prores.mov -i $A -map 0:v -map 1:a -vf fps=30 -c:v libx264 -preset veryfast -crf 21 -maxrate 6M -bufsize 12M \
  -pix_fmt yuv420p -c:a aac -b:a 160k -movflags +faststart -shortest $O/babkery_${NAME}_whatsapp_30fps.mp4
for s in voz musica sfx master; do cp video/audio/stems/$s.wav $O/stems/$s.wav; done
ls -la $O | grep babkery_${NAME}
