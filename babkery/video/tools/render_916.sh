#!/bin/bash
# Render del master 9:16 en 3 tramos paralelos y unión sin recodificar.
set -e
cd "$(dirname "$0")/../.."
R=video/build/render
node video/render.mjs --scale 1 --subs 8 --fps 60 --from 0 --to 369 --out $R/916_a.mov > $R/a.log 2>&1 &
node video/render.mjs --scale 1 --subs 8 --fps 60 --from 370 --to 739 --out $R/916_b.mov > $R/b.log 2>&1 &
node video/render.mjs --scale 1 --subs 8 --fps 60 --from 740 --to 1109 --out $R/916_c.mov > $R/c.log 2>&1 &
wait
printf "file '916_a.mov'\nfile '916_b.mov'\nfile '916_c.mov'\n" > $R/list.txt
ffmpeg -v error -y -f concat -safe 0 -i $R/list.txt -c copy $R/master_916_prores.mov
echo listo
