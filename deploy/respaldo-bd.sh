#!/usr/bin/env bash
# =============================================================================
# Copia de seguridad de la base de datos de QCS Pro Lácteos.
#
#   bash deploy/respaldo-bd.sh [motivo]
#
#   motivo: arranque | mediodia | cierre | manual (por defecto: manual)
#
# Lo ejecutan solos los servicios que instala deploy/instalar-respaldos.sh
# (al encender el servidor, a las 12:00 y a las 16:30). También se puede correr a mano.
#
# - Lee DATABASE_URL de backend/.env (no hay que escribir contraseñas aquí).
# - Espera a que PostgreSQL esté listo (útil al encender tras un corte de luz).
# - Guarda en /var/backups/qcs-lacteos (o RESPALDO_DIR) y conserva las últimas 60 copias.
# - Si RESPALDO_COPIA_EXTERNA apunta a una carpeta que existe (USB, otro disco), deja otra copia allí.
# - No detiene la planta: pg_dump copia la base mientras se sigue trabajando.
# =============================================================================
set -euo pipefail

MOTIVO="${1:-manual}"
MOTIVO="$(printf '%s' "$MOTIVO" | tr -cd 'a-zA-Z0-9_-')"
[ -n "$MOTIVO" ] || MOTIVO="manual"

DIR_SCRIPT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${ENV_FILE:-$DIR_SCRIPT/../backend/.env}"

# Lee una variable de backend/.env sin ejecutar el archivo (quita comillas y fin de línea de Windows).
leer_env() {
  [ -f "$ENV_FILE" ] || return 0
  grep -E "^[[:space:]]*$1[[:space:]]*=" "$ENV_FILE" | tail -n 1 | cut -d= -f2- \
    | sed -e 's/\r$//' -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//' -e 's/^"\(.*\)"$/\1/' -e "s/^'\(.*\)'$/\1/" \
    || true
}

DATABASE_URL="${DATABASE_URL:-$(leer_env DATABASE_URL)}"
DESTINO="${RESPALDO_DIR:-$(leer_env RESPALDO_DIR)}"
DESTINO="${DESTINO:-/var/backups/qcs-lacteos}"
CONSERVAR="${RESPALDO_CONSERVAR:-$(leer_env RESPALDO_CONSERVAR)}"
CONSERVAR="${CONSERVAR:-60}"
COPIA_EXTERNA="${RESPALDO_COPIA_EXTERNA:-$(leer_env RESPALDO_COPIA_EXTERNA)}"

case "$CONSERVAR" in ''|*[!0-9]*) CONSERVAR=60 ;; esac
[ "$CONSERVAR" -ge 1 ] || CONSERVAR=60

mkdir -p "$DESTINO"
chmod 700 "$DESTINO" 2>/dev/null || true
REGISTRO="$DESTINO/respaldos.log"

anotar() {
  local linea
  linea="$(date '+%Y-%m-%d %H:%M:%S') [$MOTIVO] $*"
  echo "$linea"
  echo "$linea" >> "$REGISTRO" 2>/dev/null || true
}

if [ -z "$DATABASE_URL" ]; then
  anotar "ERROR: no se encontró DATABASE_URL en $ENV_FILE"
  exit 1
fi
for herramienta in pg_dump pg_restore pg_isready; do
  if ! command -v "$herramienta" >/dev/null 2>&1; then
    anotar "ERROR: falta $herramienta (instala el cliente de PostgreSQL: sudo apt install postgresql-client)"
    exit 1
  fi
done

# Espera hasta 3 minutos a que PostgreSQL acepte conexiones (al encender puede tardar).
listo=0
for _ in $(seq 1 36); do
  if pg_isready -q -d "$DATABASE_URL"; then listo=1; break; fi
  sleep 5
done
if [ "$listo" -ne 1 ]; then
  anotar "ERROR: PostgreSQL no respondió en 3 minutos; no se hizo la copia."
  exit 1
fi

ARCHIVO="$DESTINO/qcs_$(date +%Y-%m-%d_%H%M%S)_${MOTIVO}.dump"
TEMPORAL="$ARCHIVO.parcial"

# Se escribe primero como .parcial: si se va la luz a mitad de la copia, nunca queda un archivo
# incompleto con apariencia de copia buena.
if ! pg_dump --format=custom --compress=6 --no-owner --file="$TEMPORAL" "$DATABASE_URL" 2>>"$REGISTRO"; then
  rm -f "$TEMPORAL"
  anotar "ERROR: pg_dump falló (ver detalles arriba en $REGISTRO)."
  exit 1
fi
if ! pg_restore --list "$TEMPORAL" >/dev/null 2>&1; then
  rm -f "$TEMPORAL"
  anotar "ERROR: la copia generada no se puede leer; se descartó."
  exit 1
fi
mv "$TEMPORAL" "$ARCHIVO"
chmod 600 "$ARCHIVO" 2>/dev/null || true
anotar "OK: $(basename "$ARCHIVO") ($(du -h "$ARCHIVO" | cut -f1))"

# Restos de copias interrumpidas y copias viejas (se conservan las $CONSERVAR más recientes).
find "$DESTINO" -maxdepth 1 -name 'qcs_*.dump.parcial' -mmin +60 -delete 2>/dev/null || true
limpiar_viejas() {
  local carpeta="$1"
  ls -1t "$carpeta"/qcs_*.dump 2>/dev/null | tail -n +"$((CONSERVAR + 1))" | while IFS= read -r viejo; do
    rm -f -- "$viejo"
  done
}
limpiar_viejas "$DESTINO"

# Copia fuera del disco del servidor (opcional).
if [ -n "$COPIA_EXTERNA" ]; then
  if [ -d "$COPIA_EXTERNA" ] && [ -w "$COPIA_EXTERNA" ]; then
    if cp "$ARCHIVO" "$COPIA_EXTERNA/"; then
      limpiar_viejas "$COPIA_EXTERNA"
      anotar "OK: copia externa en $COPIA_EXTERNA"
    else
      anotar "AVISO: no se pudo copiar a $COPIA_EXTERNA"
    fi
  else
    anotar "AVISO: la carpeta externa $COPIA_EXTERNA no está disponible (¿USB desconectada?). La copia local sí se hizo."
  fi
fi
