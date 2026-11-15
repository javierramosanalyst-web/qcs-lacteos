#!/usr/bin/env bash
# =============================================================================
# Restaura la base de datos de QCS Pro Lácteos desde una copia de seguridad.
#
#   bash deploy/restaurar-bd.sh                    (muestra las últimas copias y pregunta cuál)
#   bash deploy/restaurar-bd.sh /ruta/copia.dump   (restaura esa copia)
#
# ATENCIÓN: reemplaza TODOS los datos actuales por los de la copia elegida.
# Antes de restaurar:
#   1. Detén el backend (por ejemplo: pm2 stop all  o  sudo systemctl stop <servicio>).
#   2. Pide que nadie esté registrando en las tablets.
# El script hace primero una copia de lo que hay ahora ("antes-de-restaurar"), por si acaso.
# =============================================================================
set -euo pipefail

DIR_SCRIPT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${ENV_FILE:-$DIR_SCRIPT/../backend/.env}"

leer_env() {
  [ -f "$ENV_FILE" ] || return 0
  grep -E "^[[:space:]]*$1[[:space:]]*=" "$ENV_FILE" | tail -n 1 | cut -d= -f2- \
    | sed -e 's/\r$//' -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//' -e 's/^"\(.*\)"$/\1/' -e "s/^'\(.*\)'$/\1/" \
    || true
}

DATABASE_URL="${DATABASE_URL:-$(leer_env DATABASE_URL)}"
DESTINO="${RESPALDO_DIR:-$(leer_env RESPALDO_DIR)}"
DESTINO="${DESTINO:-/var/backups/qcs-lacteos}"
[ -n "$DATABASE_URL" ] || { echo "No se encontró DATABASE_URL en $ENV_FILE"; exit 1; }

ARCHIVO="${1:-}"
if [ -z "$ARCHIVO" ]; then
  mapfile -t COPIAS < <(ls -1t "$DESTINO"/qcs_*.dump 2>/dev/null | head -n 15)
  if [ "${#COPIAS[@]}" -eq 0 ]; then
    echo "No hay copias en $DESTINO"
    exit 1
  fi
  echo "Copias disponibles (la 1 es la más reciente):"
  for i in "${!COPIAS[@]}"; do
    printf "  %2d) %s  (%s)\n" "$((i + 1))" "$(basename "${COPIAS[$i]}")" "$(du -h "${COPIAS[$i]}" | cut -f1)"
  done
  read -r -p "Número de la copia a restaurar: " N
  case "$N" in ''|*[!0-9]*) echo "Número no válido."; exit 1 ;; esac
  [ "$N" -ge 1 ] && [ "$N" -le "${#COPIAS[@]}" ] || { echo "Número fuera de la lista."; exit 1; }
  ARCHIVO="${COPIAS[$((N - 1))]}"
fi

[ -f "$ARCHIVO" ] || { echo "No existe el archivo $ARCHIVO"; exit 1; }
pg_restore --list "$ARCHIVO" >/dev/null 2>&1 || { echo "El archivo no es una copia válida de pg_dump."; exit 1; }

echo
echo "Vas a restaurar: $(basename "$ARCHIVO")"
echo "Esto REEMPLAZA todos los datos actuales de la base por los de esa copia."
echo "¿Detuviste el backend y nadie está registrando en las tablets?"
read -r -p "Escribe SI (en mayúsculas) para continuar: " RESPUESTA
[ "$RESPUESTA" = "SI" ] || { echo "Cancelado. No se cambió nada."; exit 0; }

echo "Guardando primero una copia de lo que hay ahora..."
bash "$DIR_SCRIPT/respaldo-bd.sh" antes-de-restaurar

echo "Restaurando (todo o nada: si algo falla, la base queda como estaba)..."
pg_restore --clean --if-exists --no-owner --single-transaction --exit-on-error -d "$DATABASE_URL" "$ARCHIVO"

echo
echo "Restauración terminada. Inicia de nuevo el backend."
