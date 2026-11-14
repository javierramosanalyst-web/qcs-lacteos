#!/usr/bin/env bash
# Deja el servidor accesible por el nombre  lacteoscolombia.local  (sin IP, sin puerto).
# Uso, en el servidor Ubuntu y dentro de la carpeta del proyecto:
#   sudo bash deploy/configurar-nombre-servidor.sh
# Hace: 1) pone el nombre al equipo  2) instala avahi (mDNS)  3) permite puertos 80/443 a node
#       4) abre el firewall si ufw esta activo  5) genera el certificado con ese nombre y la IP
set -euo pipefail

NOMBRE="${NOMBRE_SERVIDOR:-lacteoscolombia}"
[ "$(id -u)" -eq 0 ] || { echo "Ejecuta con sudo:  sudo bash deploy/configurar-nombre-servidor.sh"; exit 1; }

cat <<'AVISO'
ATENCION: este script ACTIVA HTTPS (HTTPS_ENABLED=true y COOKIE_SECURE=true en backend/.env).
 - Las tablets Android que no tengan instalado lacteos-ca.crt veran una pantalla de error.
 - Por HTTP el login deja de funcionar (la sesion solo se guarda por HTTPS).
 - El puerto 80 debe quedar libre (apaga nginx: sudo systemctl disable --now nginx).
Si solo quieres el nombre .local, mira la seccion "Solo el nombre, sin HTTPS" de deploy/COMO-INSTALAR.md.
AVISO
read -r -p "¿Activar HTTPS de todas formas? Escribe SI para continuar: " RESPUESTA
[ "$RESPUESTA" = "SI" ] || { echo "Cancelado. No se cambio nada."; exit 0; }

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
USUARIO="${SUDO_USER:-root}"
IP="${1:-$(hostname -I | awk '{print $1}')}"
[ -n "$IP" ] || { echo "No se pudo detectar la IP. Pásala como argumento."; exit 1; }

hostnamectl set-hostname "$NOMBRE"
if ! command -v avahi-daemon >/dev/null; then
  apt-get update -y && apt-get install -y avahi-daemon openssl libnss-mdns
fi
systemctl enable --now avahi-daemon

NODE_BIN="$(sudo -u "$USUARIO" bash -lc 'readlink -f "$(command -v node)"')"
setcap 'cap_net_bind_service=+ep' "$NODE_BIN"

if command -v ufw >/dev/null && ufw status | grep -q "Status: active"; then
  ufw allow 80/tcp
  ufw allow 443/tcp
  ufw allow 5353/udp
fi

NOMBRE_SERVIDOR="$NOMBRE" sudo -u "$USUARIO" bash "$ROOT/deploy/generar-certificado-https.sh" "$IP" | head -3

grep -q '^COOKIE_SECURE=' "$ROOT/backend/.env" 2>/dev/null || echo "COOKIE_SECURE=true" >> "$ROOT/backend/.env"
grep -q '^HTTPS_ENABLED=' "$ROOT/backend/.env" 2>/dev/null || echo "HTTPS_ENABLED=true" >> "$ROOT/backend/.env"

echo
echo "Listo. Reinicia el backend y abre desde cualquier equipo:  https://$NOMBRE.local"
echo "El celular/tablet Android necesita instalar una vez $ROOT/backend/certs/lacteos-ca.crt"
