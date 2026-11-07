#!/bin/bash
# Entregables finales de DIPROLASER a partir de los .mov ProRes renderizados por mitades.
# Uso: bash tools/deliver.sh 916|11
set -e
cd "$(dirname "$0")/.."
F=$1; OUT=out; mkdir -p $OUT build/final
# piezas en orden (a2 completa a cuando el render de a se corto por tiempo)
: > build/final/${F}_list.txt
for p in a a2 b c; do [ -f build/final/${F}_$p.mov ] && echo "file '$PWD/build/final/${F}_$p.mov'" >> build/final/${F}_list.txt; done
cat build/final/${F}_list.txt
ffmpeg -v error -y -f concat -safe 0 -i build/final/${F}_list.txt -c copy build/final/${F}_full.mov
N=$(ffprobe -v error -count_frames -select_streams v:0 -show_entries stream=nb_read_frames -of csv=p=0 build/final/${F}_full.mov)
echo "cuadros: $N (esperados 2130)"
NAME=$([ "$F" = "916" ] && echo "diprolaser_9x16" || echo "diprolaser_1x1")
COMMON="-c:v libx264 -preset slow -pix_fmt yuv420p -color_primaries bt709 -color_trc bt709 -colorspace bt709 -movflags +faststart"
# master 60 fps con musica / sin musica (H.264 alta calidad, audio AAC 320k)
ffmpeg -v error -y -i build/final/${F}_full.mov -i audio/stems/master_con_musica.wav $COMMON -b:v 30M -maxrate 40M -bufsize 60M -profile:v high -level 5.1 -c:a aac -b:a 320k -shortest $OUT/${NAME}_master_60fps.mp4
ffmpeg -v error -y -i build/final/${F}_full.mov -i audio/stems/master_sin_musica.wav $COMMON -b:v 30M -maxrate 40M -bufsize 60M -profile:v high -level 5.1 -c:a aac -b:a 320k -shortest $OUT/${NAME}_sin_musica_60fps.mp4
# version WhatsApp / Instagram: 30 fps, H.264, < 16 MB
ffmpeg -v error -y -i build/final/${F}_full.mov -i audio/stems/master_con_musica.wav -vf "fps=30" $COMMON -b:v 3000k -maxrate 3600k -bufsize 6000k -profile:v high -level 4.1 -c:a aac -b:a 128k -shortest $OUT/${NAME}_whatsapp_30fps.mp4
# portada HD (cierre real) y stems
ffmpeg -v error -y -ss 33.2 -i build/final/${F}_full.mov -frames:v 1 -q:v 2 $OUT/diprolaser_portada_9x16_hd.jpg
mkdir -p $OUT/stems && cp audio/stems/voz.wav audio/stems/musica.wav audio/stems/sfx.wav $OUT/stems/
ls -la $OUT/
