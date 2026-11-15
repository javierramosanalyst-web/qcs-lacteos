#!/usr/bin/env bash
# =============================================================================
# Programa las copias de seguridad automáticas de la base de datos (Ubuntu con systemd).
#
#   sudo bash deploy/instalar-respaldos.sh
#
# Crea tres momentos de copia (hora de Colombia, sin importar la zona horaria del equipo):
#   - al encender el servidor (también después de un corte de luz)
#   - todos los días a las 12:00
#   - todos los días a las 16:30
# Se puede volver a ejecutar sin problema (reemplaza la programación anterior).
# Para quitarla: sudo bash deploy/instalar-respaldos.sh --quitar
# =============================================================================
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "Ejecuta con sudo: sudo bash deploy/instalar-respaldos.sh"
  exit 1
fi

UNIDADES=(qcs-respaldo@.service qcs-respaldo-mediodia.timer qcs-respaldo-cierre.timer)

if [ "${1:-}" = "--quitar" ]; then
  systemctl disable --now qcs-respaldo-mediodia.timer qcs-respaldo-cierre.timer 2>/dev/null || true
  systemctl disable qcs-respaldo@arranque.service 2>/dev/null || true
  for u in "${UNIDADES[@]}"; do rm -f "/etc/systemd/system/$u"; done
  systemctl daemon-reload
  echo "Copias automáticas desactivadas. Las copias ya hechas siguen en /var/backups/qcs-lacteos."
  exit 0
fi

DIR_SCRIPT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT="$DIR_SCRIPT/respaldo-bd.sh"
ENV_FILE="$DIR_SCRIPT/../backend/.env"
USUARIO="${SUDO_USER:-root}"

[ -f "$SCRIPT" ] || { echo "No se encuentra $SCRIPT"; exit 1; }
[ -f "$ENV_FILE" ] || { echo "No se encuentra backend/.env (debe existir con DATABASE_URL)."; exit 1; }
command -v pg_dump >/dev/null || { echo "Falta pg_dump. Instala: sudo apt install postgresql-client"; exit 1; }

# El usuario que ejecuta las copias debe poder leer backend/.env.
if ! sudo -u "$USUARIO" test -r "$ENV_FILE"; then
  echo "El usuario $USUARIO no puede leer $ENV_FILE. Ejecuta este script con sudo desde la cuenta dueña del proyecto."
  exit 1
fi

DESTINO="/var/backups/qcs-lacteos"
mkdir -p "$DESTINO"
chown "$USUARIO" "$DESTINO"
chmod 700 "$DESTINO"

# Plantilla: qcs-respaldo@<motivo>.service ejecuta el script con ese motivo.
cat > /etc/systemd/system/qcs-respaldo@.service <<EOF
[Unit]
Description=Copia de seguridad de QCS Pro Lácteos (%i)
Wants=network-online.target
After=network-online.target postgresql.service

[Service]
Type=oneshot
User=$USUARIO
ExecStart=/bin/bash "$SCRIPT" %i
Nice=10

[Install]
WantedBy=multi-user.target
EOF

cat > /etc/systemd/system/qcs-respaldo-mediodia.timer <<'EOF'
[Unit]
Description=Copia de seguridad de QCS Pro Lácteos a las 12:00 (hora de Colombia)

[Timer]
OnCalendar=*-*-* 12:00:00 America/Bogota
Unit=qcs-respaldo@mediodia.service

[Install]
WantedBy=timers.target
EOF

cat > /etc/systemd/system/qcs-respaldo-cierre.timer <<'EOF'
[Unit]
Description=Copia de seguridad de QCS Pro Lácteos a las 16:30 (hora de Colombia)

[Timer]
OnCalendar=*-*-* 16:30:00 America/Bogota
Unit=qcs-respaldo@cierre.service

[Install]
WantedBy=timers.target
EOF

systemctl daemon-reload
systemctl enable qcs-respaldo@arranque.service >/dev/null
systemctl enable --now qcs-respaldo-mediodia.timer qcs-respaldo-cierre.timer >/dev/null

echo "Probando una copia ahora..."
if systemctl start qcs-respaldo@manual.service; then
  echo
  echo "Listo. Copias automáticas activadas:"
  echo "  - al encender el servidor"
  echo "  - 12:00 y 16:30 (hora de Colombia)"
  echo
  echo "Carpeta de copias: $DESTINO"
  ls -lh "$DESTINO" | tail -n 5
  echo
  systemctl list-timers 'qcs-respaldo-*' --no-pager || true
else
  echo
  echo "La copia de prueba falló. Revisa: journalctl -u qcs-respaldo@manual.service -n 30"
  echo "y el registro $DESTINO/respaldos.log"
  exit 1
fi
