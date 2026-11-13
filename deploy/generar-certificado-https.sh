#!/usr/bin/env bash
# Genera el certificado HTTPS de Lacteos Colombia en el servidor Ubuntu (sin interfaz).
# Uso, desde la carpeta del proyecto:
#   bash deploy/generar-certificado-https.sh            (detecta la IP sola)
#   bash deploy/generar-certificado-https.sh 192.168.18.10
# Crea backend/certs/ con server.crt, server.key y lacteos-ca.crt.
set -euo pipefail

command -v openssl >/dev/null || { echo "Falta openssl: sudo apt install -y openssl"; exit 1; }

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIR="$ROOT/backend/certs"
NOMBRE="${NOMBRE_SERVIDOR:-lacteoscolombia}"
IP="${1:-$(hostname -I | awk '{print $1}')}"
[ -n "$IP" ] || { echo "No se pudo detectar la IP. Pásala como argumento."; exit 1; }

mkdir -p "$DIR"
cd "$DIR"

cat > ext.cnf <<EOF
subjectAltName=IP:$IP,DNS:${NOMBRE}.local,DNS:${NOMBRE},DNS:localhost
basicConstraints=CA:FALSE
keyUsage=digitalSignature,keyEncipherment
extendedKeyUsage=serverAuth
EOF

openssl genrsa -out lacteos-ca.key 4096 2>/dev/null
openssl req -x509 -new -nodes -key lacteos-ca.key -sha256 -days 3650 \
  -subj "/CN=Lacteos Colombia CA/O=Lacteos Colombia" -out lacteos-ca.crt
openssl genrsa -out server.key 2048 2>/dev/null
openssl req -new -key server.key -subj "/CN=Lacteos Colombia/O=Lacteos Colombia" -out server.csr
openssl x509 -req -in server.csr -CA lacteos-ca.crt -CAkey lacteos-ca.key -CAcreateserial \
  -out server.crt -days 825 -sha256 -extfile ext.cnf 2>/dev/null

rm -f server.csr ext.cnf lacteos-ca.srl
chmod 600 *.key

NODE_BIN="$(readlink -f "$(command -v node)")"
echo
echo "Certificado creado para la IP $IP en $DIR"
echo
echo "Falta, una sola vez (permite usar el puerto 443 sin ser root):"
echo "  sudo setcap 'cap_net_bind_service=+ep' $NODE_BIN"
echo "Si usas el firewall de Ubuntu:"
echo "  sudo ufw allow 443/tcp"
echo
echo "Luego reinicia el backend y abre https://$IP desde el celular."
echo "Para el celular Android copia lacteos-ca.crt (nunca los .key), por ejemplo desde tu PC:"
echo "  scp USUARIO@$IP:$DIR/lacteos-ca.crt ."
