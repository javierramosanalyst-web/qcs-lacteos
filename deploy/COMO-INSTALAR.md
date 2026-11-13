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

## Celulares y tabletas (Android / iPhone)

1. Abre `http://192.168.18.10:3000` en Chrome (Android) o Safari (iPhone).
2. Menú ⋮ → **"Instalar aplicación"** / **"Agregar a pantalla de inicio"**.
3. El ícono **Lácteos Colombia** queda en el celular y al abrirlo entra a pantalla completa, sin barra de direcciones.

## Sobre el aviso "No seguro"

Ese texto lo muestra Chrome para cualquier sitio sin certificado HTTPS. En una
red interna de la planta no viaja por internet, así que no representa el riesgo
que avisa. Quitarlo exige instalar un certificado en el servidor y en cada
equipo; si la empresa lo pide, se hace después con su dominio interno.
