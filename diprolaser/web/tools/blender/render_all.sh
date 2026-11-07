#!/bin/bash
# Renderiza el giro de los 6 modelos (Cycles, CPU). Unas 2 horas en 4 núcleos.
cd "$(dirname "$0")/../.."
for m in ${MODELS:-tela gamuza micro impermeable trucker bicolor}; do
  python3 tools/blender/turntable.py -- $m public/img/cap3d/$m 24 640 48 2>&1 | grep -E "^frame|Traceback|Error"
  echo "== listo $m"
done
