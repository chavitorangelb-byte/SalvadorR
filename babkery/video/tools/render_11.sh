#!/bin/bash
# Render del reencuadre 1:1 en 3 tramos paralelos y unión sin recodificar.
set -e
cd "$(dirname "$0")/../.."
R=video/build/render
node video/render.mjs --format 11 --scale 1 --subs 8 --fps 60 --from 0 --to 369 --out $R/11_a.mov > $R/a.log 2>&1 &
node video/render.mjs --format 11 --scale 1 --subs 8 --fps 60 --from 370 --to 739 --out $R/11_b.mov > $R/b.log 2>&1 &
node video/render.mjs --format 11 --scale 1 --subs 8 --fps 60 --from 740 --to 1109 --out $R/11_c.mov > $R/c.log 2>&1 &
wait
printf "file '11_a.mov'\nfile '11_b.mov'\nfile '11_c.mov'\n" > $R/list.txt
ffmpeg -v error -y -f concat -safe 0 -i $R/list.txt -c copy $R/master_11_prores.mov
echo listo
