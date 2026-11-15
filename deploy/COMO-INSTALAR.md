# Instalar el sistema "Lácteos Colombia" sin dirección visible

## Cómo queda en la planta (lo acordado)

- Se entra por **HTTP y con la IP del servidor** (`http://192.168.18.10`), a través de **nginx** en el puerto 80. Carga directo, sin pantallas de error; el navegador solo muestra una etiqueta pequeña de "No seguro".
- **HTTPS está apagado.** Aunque existan certificados en `backend/certs`, el backend no lo activa sin `HTTPS_ENABLED=true` en `backend/.env`.
- En `backend/.env` del servidor va `TRUST_PROXY=loopback` (nginx en el mismo PC), para que el límite de intentos de login sea por tablet.
- **No** pongan `COOKIE_SECURE=true` ni corran `configurar-nombre-servidor.sh`: por HTTP el login deja de funcionar.
- Cada equipo entra por un acceso directo: PC con `Instalar-Lacteos-Colombia.bat`, iPhone/iPad con "Agregar a pantalla de inicio" (abre a pantalla completa por HTTP) y Android con el acceso directo de Chrome (por HTTP abre con la barra visible).

¿Por qué no HTTPS? Con un certificado propio, cada tablet Android tiene que instalar `lacteos-ca.crt` a mano; si no, ve una pantalla completa de error ("La conexión no es privada"). Para HTTPS sin tocar los equipos hace falta un certificado público (dominio propio). Las secciones de HTTPS de abajo quedan para cuando se decida eso.

### Riesgo aceptado: HTTP en la red local

Por la naturaleza de la planta, el sistema funciona **solo en la red local y por HTTP**. Es una decisión tomada, con estas condiciones:

- El servidor **no se publica en internet** (ningún puerto abierto hacia afuera).
- El WiFi de la planta tiene **contraseña (WPA2 o superior)** y **no es el mismo** que el de visitantes.
- Node atiende solo a nginx (`HOST=127.0.0.1`, ver abajo), así que nadie entra directo por `IP:3001`.
- Compensan la falta de cifrado: bloqueo tras 5 intentos fallidos, cierre por inactividad, bitácora de accesos y copias de seguridad diarias.

Si algún día se necesita entrar desde fuera de la planta, primero hay que activar HTTPS con un certificado público.

## Ajustes de seguridad en `backend/.env` del servidor

| Variable | Valor en la planta | Para qué |
| --- | --- | --- |
| `TRUST_PROXY` | `loopback` | El límite de intentos de login se cuenta por tablet (nginx en el mismo PC). |
| `HOST` | `127.0.0.1` | Node solo escucha a nginx: nadie de la red entra directo por el puerto 3001. Sin la variable escucha en toda la red, como antes. **Solo póngala si nginx usa `proxy_pass http://127.0.0.1:3001`.** |
| `NODE_ENV` | `production` | El servidor no arranca sin un `JWT_SECRET` de 32 caracteres o más. |

Después de cambiar el `.env`, reinicie el backend. Para comprobar `HOST`: desde otro equipo `http://IP:3001/api/health` ya no debe abrir, y `http://IP` (nginx) sí.

## Copias de seguridad automáticas

Se hace una copia de la base: **al encender el servidor** (también después de un corte de luz), **a las 12:00** y **a las 16:30**, hora de Colombia. No detiene la planta. Se guardan en `/var/backups/qcs-lacteos` y se conservan las **últimas 60** (unas tres semanas).

Instalar una sola vez en el servidor, desde la carpeta del proyecto:

```bash
sudo apt install -y postgresql-client     # si pg_dump no está instalado
sudo bash deploy/instalar-respaldos.sh
```

Al terminar hace una copia de prueba y muestra la carpeta y los próximos horarios.

**Copia fuera del servidor (recomendado):** si se daña el disco del servidor, se pierden también las copias guardadas en él. Conecte una USB o un disco, móntelo (por ejemplo en `/media/respaldo`) y agregue en `backend/.env`:

```bash
RESPALDO_COPIA_EXTERNA=/media/respaldo
```

Si la USB no está conectada a la hora de la copia, la copia local se hace igual y queda un aviso en `/var/backups/qcs-lacteos/respaldos.log`. Lleve esa USB fuera del servidor al menos una vez por semana.

Otros comandos:

```bash
bash deploy/respaldo-bd.sh                       # copia manual en cualquier momento
cat /var/backups/qcs-lacteos/respaldos.log       # historial de copias (OK / ERROR)
systemctl list-timers 'qcs-respaldo-*'           # próximos horarios
sudo bash deploy/instalar-respaldos.sh --quitar  # desactivar las copias automáticas
```

### Restaurar una copia

Reemplaza **todos** los datos actuales por los de la copia elegida. Antes de restaurar, detenga el backend y pida que nadie registre en las tablets.

```bash
bash deploy/restaurar-bd.sh
```

Muestra las últimas copias, pregunta cuál y pide escribir `SI`. Antes de restaurar guarda una copia de lo que hay ("antes-de-restaurar"), y si algo falla la base queda como estaba. **Pruebe una restauración una vez antes de salir a producción.**

## Base de datos nueva en el servidor

En el servidor, con PostgreSQL instalado (cambie el nombre de usuario y de base si usan otros):

```bash
sudo -u postgres createdb qcs_lacteos
sudo -u postgres psql -d qcs_lacteos -v ON_ERROR_STOP=1 -f backend/database/init.sql
sudo -u postgres psql -d qcs_lacteos -v ON_ERROR_STOP=1 -f backend/database/seed.sql
```

`init.sql` crea toda la estructura y `seed.sql` los catálogos y un único usuario:

- **SA-001**, PIN `123456`, contraseña `123456` (**temporal**).

Arranque el backend, entre con SA-001, cambie su clave en **Panel Superadmin → Mi cuenta** y registre al administrador. Él registra a los operarios, los lotes de insumos y los sabores.

**No ejecute `seed_demo.sql` ni `npm run seed:demo` en el servidor:** son datos de prueba para desarrollo.

## Si hicieron pruebas en el servidor: borrar los datos de prueba

Con el backend detenido y todos fuera de sesión:

```bash
bash deploy/limpiar-datos-de-prueba.sh
```

Pide escribir `BORRAR` y antes hace una copia de seguridad. Borra lotes (con etapas, mediciones, insumos usados y envasado), borradores, auditoría de correcciones y bitácora de accesos, y el contador de códigos de lote vuelve a 001. **No toca** usuarios, líneas, productos, catálogos, lotes de insumos ni sabores. Los usuarios de prueba se dan de baja desde el **Panel Superadmin**, y el superadmin cambia su clave en **Mi cuenta**.

### Solo el nombre, sin HTTPS (opcional)

Sin acceso al router, el nombre `.local` solo se puede anunciar desde el servidor (mDNS). Funciona en iPhone/iPad, Mac y Windows 10/11; en Android depende del equipo. En el servidor:

```bash
sudo hostnamectl set-hostname lacteoscolombia
sudo apt install -y avahi-daemon libnss-mdns
sudo systemctl enable --now avahi-daemon
```

Después se puede entrar por `http://lacteoscolombia.local` (con `http://` al escribirlo la primera vez). Donde no funcione, se sigue usando la IP.

La barra con la IP (`192.168.18.10:3000`) la dibuja el navegador y ninguna
página puede ocultarla **mientras se navega en una pestaña normal**. Lo que sí
existe es el modo aplicación: el sistema se abre en una ventana propia con el
nombre de la empresa, sin barra de direcciones. Hay dos maneras:

## PC de la planta (Windows) — acceso directo

1. Copia la carpeta del proyecto (o al menos `deploy/`) al PC que va a usar el operario, o comparte `deploy` por la red.
2. Doble clic en **`Instalar-Lacteos-Colombia.bat`**.
3. Queda creado el acceso directo **"Lacteos Colombia"** en el escritorio y el sistema se abre en su ventana, sin barra y sin la IP.

- Si la IP del servidor cambia (por ejemplo al desplegar en la planta), abre el `.bat` con el Bloc de notas y cambia solo la línea `set "URL=http://192.168.18.10"`.
- Si prefieren un nombre en vez de IP (`http://lacteoscolombia.local`), en cada PC se agrega una línea al archivo `C:\Windows\System32\drivers\etc\hosts` (requiere abrir el Bloc de notas como administrador): `192.168.18.10   lacteoscolombia.local`. Es opcional; el acceso directo funciona igual con la IP.

## Nombre en vez de IP: `https://lacteoscolombia.local` (solo si se activa HTTPS)

En el servidor Ubuntu (una sola vez, dentro de la carpeta del proyecto):

```bash
git pull && npm run build
sudo bash deploy/configurar-nombre-servidor.sh
```

Ese script pide confirmación (escribir `SI`), le pone el nombre `lacteoscolombia` al equipo, instala el servicio que lo anuncia en la red (avahi/mDNS), permite los puertos 80 y 443, genera el certificado con ese nombre y activa `COOKIE_SECURE` y `HTTPS_ENABLED`. Antes apaguen nginx (`sudo systemctl disable --now nginx`), que ocupa el puerto 80. Después reinicia el backend. Desde ese momento:

- Se entra por **`https://lacteoscolombia.local`**, sin IP y sin `:3000`. Si alguien escribe `http://` o usa el puerto 80, pasa solo a https.
- **iPad/iPhone y Mac** entienden `.local` sin configurar nada. **PC con Windows 10/11** normalmente también.
- **Android:** `.local` depende de la versión del sistema y del navegador, y no está garantizado. La solución segura para todos los equipos es crear el nombre una vez en el router de la planta (sección "DNS del router" del administrador de red: nombre `lacteoscolombia.local` apuntando a la IP del servidor). Así funciona en tablets y PC sin tocar cada equipo.
- Reserva en el router una **IP fija** para el servidor, para que el nombre siempre apunte al mismo equipo.
- Una vez instalada como app (Android con certificado, iPad con "Agregar a pantalla de inicio"), **no se ve ninguna dirección**: abre como "Lácteos Colombia".
- Ingeniero con PC: `deploy\Instalar-Lacteos-Colombia.bat` crea el acceso directo "Lacteos Colombia" que abre sin barra de direcciones.

## Servidor Ubuntu sin interfaz (la planta): todo por terminal

Los `.bat` son solo para Windows. En el servidor Ubuntu, dentro de la carpeta del proyecto:

```bash
npm run build
bash deploy/generar-certificado-https.sh            # detecta la IP sola; o: ... 192.168.18.10
sudo setcap 'cap_net_bind_service=+ep' "$(readlink -f "$(command -v node)")"
sudo ufw allow 443/tcp                              # solo si usas el firewall ufw
echo "COOKIE_SECURE=true" >> backend/.env
echo "HTTPS_ENABLED=true" >> backend/.env
sudo systemctl disable --now nginx                   # libera el puerto 80 para la redirección a https
```

Reinicia el backend como lo ejecuten allá (por ejemplo `pm2 restart all` o `sudo systemctl restart <servicio>`). Debe imprimir `HTTPS activo en el puerto 443`.
Para el celular Android, copia `backend/certs/lacteos-ca.crt` a tu PC con `scp USUARIO@IP:/ruta/backend/certs/lacteos-ca.crt .` y envíalo al celular. Los pasos en el celular están más abajo.
Si prefieren no usar `setcap`, agreguen `HTTPS_PORT=8443` en `backend/.env` y entren por `https://IP:8443`.

## HTTPS (obligatorio para instalar en Android y para quitar "No seguro"; hoy apagado)

Chrome en Android solo instala la app sin barra cuando la página va por HTTPS.
Se hace una sola vez en el servidor:

1. Ejecuta `deploy\Generar-Certificado-HTTPS.bat` y escribe la IP del servidor (por ejemplo `192.168.18.10`). Crea `backend\certs\` (esa carpeta no se sube a Git).
2. En la raíz del proyecto: `npm run build`. En `backend\.env` pon `COOKIE_SECURE=true` y `HTTPS_ENABLED=true`.
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

1. Abre `http://192.168.18.10` en Chrome (Android) o Safari (iPhone).
2. Menú ⋮ → **"Instalar aplicación"** / **"Agregar a pantalla de inicio"**.
3. El ícono **Lácteos Colombia** queda en el celular y al abrirlo entra a pantalla completa, sin barra de direcciones.

