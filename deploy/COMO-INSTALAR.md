# Instalar el sistema "Lácteos Colombia" sin dirección visible

La barra con la IP (`192.168.18.10:3000`) la dibuja el navegador y ninguna
página puede ocultarla **mientras se navega en una pestaña normal**. Lo que sí
existe es el modo aplicación: el sistema se abre en una ventana propia con el
nombre de la empresa, sin barra de direcciones. Hay dos maneras:

## PC de la planta (Windows) — acceso directo

1. Copia la carpeta del proyecto (o al menos `deploy/`) al PC que va a usar el operario, o comparte `deploy` por la red.
2. Doble clic en **`Instalar-Lacteos-Colombia.bat`**.
3. Queda creado el acceso directo **"Lacteos Colombia"** en el escritorio y el sistema se abre en su ventana, sin barra y sin la IP.

- Si la IP del servidor cambia (por ejemplo al desplegar en la planta), abre el `.bat` con el Bloc de notas y cambia solo la línea `set "URL=http://192.168.18.10:3000"`.
- Si prefieren un nombre en vez de IP (`http://lacteoscolombia.local:3000`), en cada PC se agrega una línea al archivo `C:\Windows\System32\drivers\etc\hosts` (requiere abrir el Bloc de notas como administrador): `192.168.18.10   lacteoscolombia.local`. Es opcional; el acceso directo funciona igual con la IP.

## HTTPS (obligatorio para instalar en Android y para quitar "No seguro")

Chrome en Android solo instala la app sin barra cuando la página va por HTTPS.
Se hace una sola vez en el servidor:

1. Ejecuta `deploy\Generar-Certificado-HTTPS.bat` y escribe la IP del servidor (por ejemplo `192.168.18.10`). Crea `backend\certs\` (esa carpeta no se sube a Git).
2. En la raíz del proyecto: `npm run build`. En `backend\.env` pon `COOKIE_SECURE=true`.
3. Reinicia el backend (`cd backend && npm run dev`). Debe mostrar `HTTPS activo en el puerto 443`.
4. Si el puerto 443 está ocupado, agrega `HTTPS_PORT=8443` en `backend\.env` y entra por `https://IP:8443`.
5. Abre `https://192.168.18.10` (sin puerto). El servidor entrega el sistema completo; ya no hace falta el puerto 3000.
6. Permite el puerto 443 en el Firewall de Windows del servidor si los celulares no conectan.

### Android: aprobar el certificado una sola vez por celular

1. Envía `backend\certs\lacteos-ca.crt` al celular (WhatsApp, correo o USB) y guárdalo en Descargas. Nunca envíes los archivos `.key`.
2. Ajustes → Seguridad (o "Seguridad y privacidad") → Más seguridad → Cifrado y credenciales → **Instalar un certificado** → **Certificado de CA** → Instalar de todos modos → elige `lacteos-ca.crt`. El celular debe tener bloqueo de pantalla.
3. Abre `https://192.168.18.10` en Chrome. Ya no sale "No seguro".
4. Menú ⋮ → **Instalar aplicación**. Se abre como "Lácteos Colombia", sin barra.

En PC con Edge o Chrome: haz doble clic en `lacteos-ca.crt` → Instalar certificado → Equipo local → "Entidades de certificación raíz de confianza".

iPhone ya funciona sin esto, porque Safari permite "Agregar a pantalla de inicio" por HTTP.

## Celulares y tabletas (Android / iPhone)

1. Abre `http://192.168.18.10:3000` en Chrome (Android) o Safari (iPhone).
2. Menú ⋮ → **"Instalar aplicación"** / **"Agregar a pantalla de inicio"**.
3. El ícono **Lácteos Colombia** queda en el celular y al abrirlo entra a pantalla completa, sin barra de direcciones.

## Sobre el aviso "No seguro"

Ese texto lo muestra Chrome para cualquier sitio sin certificado HTTPS. En una
red interna de la planta no viaja por internet, así que no representa el riesgo
que avisa. Quitarlo exige instalar un certificado en el servidor y en cada
equipo; si la empresa lo pide, se hace después con su dominio interno.
