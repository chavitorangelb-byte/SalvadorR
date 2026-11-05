#!/usr/bin/env bash
# Re-renderiza un tramo de cuadros y lo empalma en el master ProRes sin recodificar el resto.
# ProRes es intra-cuadro: cada cuadro es independiente, asi que el corte es exacto y el resto se copia tal cual.
#
# Uso: video/tools/splice.sh <916|11> <desde> <hasta>        (cuadros, inclusive)
#   Si ya existe video/build/render/seg_<formato>_<desde>_<hasta>.mov, lo usa en vez de renderizar.
#   El master anterior queda como master_<formato>_prores.prev.mov.
# Despues: video/tools/deliver.sh <formato>
set -euo pipefail
cd "$(dirname "$0")/../.."
[ $# -eq 3 ] || { echo "uso: $0 <916|11> <desde> <hasta>"; exit 2; }
F=$1; A=$2; B=$3
FPS=60
R=video/build/render
M=$R/master_${F}_prores.mov
SEG=$R/seg_${F}_${A}_${B}.mov
count() { ffprobe -v error -select_streams v:0 -count_packets -show_entries stream=nb_read_packets -of csv=p=0 "$1"; }
md5at() { ffmpeg -v error -i "$1" -vf "select=eq(n\,$2)" -frames:v 1 -f md5 - 2>/dev/null; }

N=$(count "$M")
[ "$A" -ge 0 ] && [ "$B" -ge "$A" ] && [ "$B" -lt "$N" ] || { echo "rango fuera del master (0-$((N - 1)))"; exit 2; }
if [ ! -f "$SEG" ]; then
  NODE_PATH=$(npm root -g) node video/render.mjs --format "$F" --scale 1 --subs 8 --from "$A" --to "$B" --out "$SEG"
fi
[ "$(count "$SEG")" -eq $((B - A + 1)) ] || { echo "el tramo no tiene $((B - A + 1)) cuadros"; exit 1; }

T=$(mktemp -d -p "$R" splice.XXXX)
: > "$T/list.txt"
if [ "$A" -gt 0 ]; then
  ffmpeg -v error -y -i "$M" -map 0:v -c copy -frames:v "$A" "$T/a.mov"
  echo "file '$PWD/$T/a.mov'" >> "$T/list.txt"
fi
echo "file '$PWD/$SEG'" >> "$T/list.txt"
if [ "$B" -lt $((N - 1)) ]; then
  # -ss de salida con copia de flujo: descarta los paquetes anteriores a medio cuadro despues de B
  ffmpeg -v error -y -i "$M" -map 0:v -c copy -ss "$(python3 -c "print(($B + 0.5) / $FPS)")" "$T/c.mov"
  echo "file '$PWD/$T/c.mov'" >> "$T/list.txt"
fi
ffmpeg -v error -y -f concat -safe 0 -i "$T/list.txt" -map 0:v -c copy "$T/new.mov"

[ "$(count "$T/new.mov")" -eq "$N" ] || { echo "el empalme no tiene $N cuadros; el master no se toco"; exit 1; }
# los cuadros justo afuera del tramo deben ser identicos (copia de flujo)
for n in $((A - 1)) $((B + 1)); do
  [ "$n" -ge 0 ] && [ "$n" -lt "$N" ] || continue
  [ "$(md5at "$M" $n)" = "$(md5at "$T/new.mov" $n)" ] || { echo "el cuadro $n cambio al empalmar; el master no se toco"; exit 1; }
done
# informativo: si el cambio no llega a los bordes del tramo, el render determinista los reproduce igual
same=0
for n in "$A" "$B"; do [ "$(md5at "$M" $n)" = "$(md5at "$T/new.mov" $n)" ] && same=$((same + 1)); done
mv -f "$M" "$R/master_${F}_prores.prev.mov"
mv "$T/new.mov" "$M"
rm -f "$T/a.mov" "$T/c.mov" "$T/list.txt" && rmdir "$T"
echo "listo: $M ($N cuadros); tramo $A-$B reemplazado; bordes del tramo identicos al anterior: $same/2"
