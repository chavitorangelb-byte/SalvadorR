#!/usr/bin/env bash
# Re-amarra todo el video a una toma nueva de voz (por ejemplo, la de ElevenLabs):
#   alinea con Whisper -> coloca las frases -> re-amarra la línea de tiempo -> brief -> animatic
#
# Uso: matica/video/tools/relock.sh <toma.mp3|wav>
#   HF_HOME=<cache de modelos>  (opcional; el modelo "medium" de Whisper pesa 1.5 GB)
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
VIDEO="$(dirname "$HERE")"
TAKE="${1:?uso: relock.sh <toma.mp3|wav>}"
VO_DIR="$VIDEO/audio/vo"
mkdir -p "$VO_DIR"
# la toma se guarda junto a las demás (se versiona)
if [ "$(cd "$(dirname "$TAKE")" && pwd)" != "$VO_DIR" ]; then cp -f "$TAKE" "$VO_DIR/"; fi
NAME="$(basename "$TAKE")"
STEM="${NAME%.*}"

python3 "$HERE/vo_align.py" "$VO_DIR/$NAME"
python3 "$HERE/vo_assemble.py" "$VO_DIR/${STEM}_words.json"
node "$HERE/lock.mjs"
node "$HERE/brief.mjs"
python3 "$HERE/animatic_audio.py"
node "$HERE/animatic.mjs"
echo "listo: voz $NAME amarrada; revisa matica/video/BRIEF.md y matica/review/fase2/animatic_tiempos.mp4"
