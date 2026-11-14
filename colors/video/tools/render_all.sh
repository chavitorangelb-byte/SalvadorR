#!/usr/bin/env bash
# Render completo en paralelo: cada formato en dos mitades (ProRes) que luego se empalman por copia de flujo.
# Uso: colors/video/tools/render_all.sh [916] [11]
set -euo pipefail
cd "$(dirname "$0")/../../.."
B=colors/video/build/render; mkdir -p "$B"
FORMATS=("$@"); [ ${#FORMATS[@]} -gt 0 ] || FORMATS=(916 11)
LAST=1109; MID=554
pids=()
for F in "${FORMATS[@]}"; do
  node colors/video/render.mjs --format "$F" --from 0 --to $MID --out "$B/part_${F}_a.mov" > "$B/log_${F}_a.txt" 2>&1 & pids+=($!)
  node colors/video/render.mjs --format "$F" --from $((MID + 1)) --to $LAST --out "$B/part_${F}_b.mov" > "$B/log_${F}_b.txt" 2>&1 & pids+=($!)
done
for p in "${pids[@]}"; do wait "$p"; done
for F in "${FORMATS[@]}"; do
  printf "file 'part_%s_a.mov'\nfile 'part_%s_b.mov'\n" "$F" "$F" > "$B/list_$F.txt"
  ffmpeg -v error -y -f concat -safe 0 -i "$B/list_$F.txt" -c copy "$B/master_${F}_prores.mov"
  ffprobe -v error -count_frames -select_streams v:0 -show_entries stream=nb_read_frames,width,height -of csv=p=0 "$B/master_${F}_prores.mov"
done
