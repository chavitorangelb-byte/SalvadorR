#!/usr/bin/env bash
# Levanta la página en http://127.0.0.1:8124/ si no está arriba (idempotente).
# Uso: matica/tools/serve.sh
set -euo pipefail
SITE="$(cd "$(dirname "$0")/../site" && pwd)"
if curl -s -o /dev/null -m 2 http://127.0.0.1:8124/; then exit 0; fi
(cd "$SITE" && nohup python3 -m http.server 8124 > /dev/null 2>&1 &)
for _ in $(seq 1 20); do curl -s -o /dev/null -m 1 http://127.0.0.1:8124/ && exit 0; sleep 0.2; done
echo "no levantó el servidor" >&2; exit 1
