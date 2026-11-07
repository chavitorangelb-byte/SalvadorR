#!/bin/bash
# Renderiza el giro de los 6 modelos y las capas de placa y parche (Cycles, CPU). Unas 2 h 20 min en 4 núcleos.
# Si se interrumpe, vuelve a correrlo: se salta los modelos y cuadros que ya están completos.
cd "$(dirname "$0")/../.."
done_() { [ -f "public/img/cap3d/$1/25-$2.png" ]; }
for m in ${MODELS:-tela gamuza micro impermeable trucker bicolor}; do
  done_ $m i && { echo "== ya estaba $m"; continue; }
  SKIP_DONE=1 python3 tools/blender/turntable.py -- $m public/img/cap3d/$m 24 640 48 2>&1 | grep -E "^frame|^radio|Traceback|Error"
  echo "== listo $m"
done
for o in ${OVERLAYS:-plate patch}; do
  done_ _$o u && { echo "== ya estaba $o"; continue; }
  OVERLAY=$o python3 tools/blender/turntable.py -- tela public/img/cap3d/_$o 24 640 48 2>&1 | grep -E "^capa|^radio|Traceback|Error"
  echo "== listo $o"
done
