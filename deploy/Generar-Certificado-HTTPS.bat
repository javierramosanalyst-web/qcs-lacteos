@echo off
chcp 65001 >nul
rem =====================================================================
rem  Genera el certificado HTTPS de Lacteos Colombia para la red interna.
rem  Uso: doble clic (pregunta la IP del servidor) o:
rem       Generar-Certificado-HTTPS.bat 192.168.18.10
rem  Crea en backend\certs\ :
rem     server.crt / server.key  -> los usa el servidor (no se suben a Git)
rem     lacteos-ca.crt           -> se instala UNA vez en cada celular Android
rem =====================================================================
setlocal
set "OPENSSL=C:\Program Files\Git\usr\bin\openssl.exe"
if not exist "%OPENSSL%" set "OPENSSL=C:\Program Files\OpenSSL-Win64\bin\openssl.exe"
if not exist "%OPENSSL%" (
  echo No se encontro OpenSSL. Instala Git para Windows o OpenSSL.
  pause
  exit /b 1
)

set "IP=%~1"
if "%IP%"=="" set /p IP=IP del servidor en la red (ejemplo 192.168.18.10): 
if "%IP%"=="" exit /b 1

set "DIR=%~dp0..\backend\certs"
if not exist "%DIR%" mkdir "%DIR%"
pushd "%DIR%"

> ext.cnf echo subjectAltName=IP:%IP%,DNS:lacteoscolombia.local,DNS:localhost
>> ext.cnf echo basicConstraints=CA:FALSE
>> ext.cnf echo keyUsage=digitalSignature,keyEncipherment
>> ext.cnf echo extendedKeyUsage=serverAuth

"%OPENSSL%" genrsa -out lacteos-ca.key 4096
"%OPENSSL%" req -x509 -new -nodes -key lacteos-ca.key -sha256 -days 3650 -subj "/CN=Lacteos Colombia CA/O=Lacteos Colombia" -out lacteos-ca.crt
"%OPENSSL%" genrsa -out server.key 2048
"%OPENSSL%" req -new -key server.key -subj "/CN=Lacteos Colombia/O=Lacteos Colombia" -out server.csr
"%OPENSSL%" x509 -req -in server.csr -CA lacteos-ca.crt -CAkey lacteos-ca.key -CAcreateserial -out server.crt -days 825 -sha256 -extfile ext.cnf

del server.csr ext.cnf lacteos-ca.srl 2>nul
popd

echo.
echo Listo. Certificado creado para %IP% en backend\certs\
echo 1) Reinicia el backend: cd backend ^&^& npm run dev
echo 2) Envia backend\certs\lacteos-ca.crt a cada celular Android e instalalo (ver deploy\COMO-INSTALAR.md)
echo 3) Abre https://%IP%  (sin puerto)
pause
