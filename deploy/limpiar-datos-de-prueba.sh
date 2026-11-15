#!/usr/bin/env bash
# =============================================================================
# Deja la base lista para empezar a producir "en serio": borra los datos de las pruebas.
#
#   bash deploy/limpiar-datos-de-prueba.sh
#
# BORRA: lotes (padre e hijos) con todas sus etapas, mediciones, insumos usados y envasado;
#        borradores y estado de las líneas; auditoría de correcciones; bitácora de accesos.
#        El contador de códigos de lote vuelve a empezar en 001.
# NO TOCA: usuarios, líneas, productos, catálogos, lotes de insumos ni sabores.
#          (Los usuarios de prueba se dan de baja desde el Panel Superadmin.)
#
# Úsalo UNA sola vez, el día de arranque, con el backend detenido y todos fuera de sesión.
# Antes de borrar hace una copia de seguridad ("antes-de-limpiar") por si hay que volver atrás.
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
[ -n "$DATABASE_URL" ] || { echo "No se encontró DATABASE_URL en $ENV_FILE"; exit 1; }
command -v psql >/dev/null || { echo "Falta psql. Instala: sudo apt install postgresql-client"; exit 1; }

LOTES="$(psql "$DATABASE_URL" -Atc 'SELECT COUNT(*) FROM lotes_produccion;')"
EVENTOS="$(psql "$DATABASE_URL" -Atc 'SELECT COUNT(*) FROM eventos_seguridad;' 2>/dev/null || echo 0)"
echo "Se borrarán $LOTES lote(s) con todo su detalle, la auditoría de correcciones y $EVENTOS evento(s) de la bitácora."
echo "Usuarios, catálogos e insumos NO se tocan."
read -r -p "Escribe BORRAR (en mayúsculas) para continuar: " RESPUESTA
[ "$RESPUESTA" = "BORRAR" ] || { echo "Cancelado. No se cambió nada."; exit 0; }

echo "Guardando primero una copia de seguridad..."
bash "$DIR_SCRIPT/respaldo-bd.sh" antes-de-limpiar

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q <<'SQL'
BEGIN;
-- La auditoría impide TRUNCATE por diseño; solo aquí, dentro de esta transacción, se suspende su protección.
ALTER TABLE auditoria_rectificaciones DISABLE TRIGGER trg_auditoria_sin_truncate;
TRUNCATE lotes_padre, lotes_produccion, borradores_lote, espacio_trabajo_linea,
         auditoria_rectificaciones, eventos_seguridad
  RESTART IDENTITY CASCADE;
ALTER TABLE auditoria_rectificaciones ENABLE TRIGGER trg_auditoria_sin_truncate;
ALTER SEQUENCE seq_codigo_lote RESTART WITH 1;
COMMIT;
SQL

echo
echo "Listo: la base quedó sin datos de prueba. Inicia de nuevo el backend."
echo "Si una tablet todavía muestra un lote viejo, cierra sesión en ella y vuelve a entrar."
