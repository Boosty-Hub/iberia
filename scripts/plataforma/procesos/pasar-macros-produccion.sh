#!/bin/bash
# Pasa a PRODUCCIÓN lo cargado en pruebas del rediseño de Procesos (28-nov-2026, «publica todo en main»): enlaces
# sugeridos, y por cada macroproceso su revisión, sus archivos de origen y sus transcripciones. Idempotente.
# Requiere las migraciones 20261128100000/110000/120000 en producción y un respaldo previo.
#   bash scripts/plataforma/procesos/pasar-macros-produccion.sh 1.1 1.2 1.3 …
set -u
cd "$(dirname "$0")/../../.."
P="--destino produccion --confirmo"
N="node --env-file=.env.local scripts/plataforma/procesos"
M_DIR=plataforma/propuestas/macros
archivos() { # carga todas las carpetas de transcripción de un macroproceso
  local m=$1
  [ -d "$M_DIR/$m/archivos" ] && $N/cargar-archivos-macro.mjs --macro "$m" --carpeta "$M_DIR/$m/archivos" $P 2>&1 | grep -E '^\{|Error|Sin documento'
  for d in "$M_DIR/$m"/lotes/*/; do [ -d "$d" ] && { echo -n "  $(basename "$d") "; $N/cargar-archivos-macro.mjs --macro "$m" --carpeta "$d" $P 2>&1 | grep -E '^\{|Error|Sin documento'; }; done
  if [ "$m" = "1.2" ]; then for d in A B; do $N/cargar-archivos-macro.mjs --macro 1.1 --carpeta "$M_DIR/completar-1.1-1.2/$d" $P 2>&1 | grep -E '^\{|Error|Sin documento'; done; fi
}
if [ "${SIN_ENLACES:-}" != "1" ]; then echo "== enlaces sugeridos"; $N/cargar-enlaces.mjs $P 2>&1 | tail -2; fi
for m in "$@"; do
  echo "== $m"
  $N/cargar-macro.mjs --macro "$m" $P 2>&1 | grep -E 'Listo|Error|Sin proceso'
  $N/subir-origen-macro.mjs --macro "$m" $P 2>&1 | tail -1
  archivos "$m"
done
echo "== segunda pasada (copias anotadas cuando ya existen todos los archivos de origen)"
for m in "$@"; do archivos "$m" >/dev/null; $N/pendientes-transcripcion.mjs --macro "$m" --destino produccion; done
