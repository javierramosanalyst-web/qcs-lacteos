# QCS Pro Lácteos · Control de Producción (Lácteos Colombia)

Sistema web para registrar el control de producción de dos líneas:

- **Pasta Hilada:** Queso Doble Crema Premium, Doble Crema Industrial, Pera y 7 Cueros.
- **Fermentados:** Yogur, Kumis y Yogur Griego.

Cada fase, medición, insumo, formato de envase y resumen final queda guardado en PostgreSQL.

## Estructura

| Carpeta | Contenido |
| --- | --- |
| `/` (raíz) | Frontend: React + Vite + TypeScript + Tailwind (puerto 3000) |
| `backend/` | API: Node.js + Express + PostgreSQL (puerto 3001) |
| `backend/database/` | `init.sql` (toda la estructura), `seed.sql` (catálogos + superadmin inicial) y datos de prueba (`seed_demo*`) |
| `deploy/` | Instalación en la planta, copias de seguridad y restauración |
| `docs/` | Diseño original de la base de datos (referencia histórica) |

## 1. Programas que debes instalar

| Programa | Versión | Descarga |
| --- | --- | --- |
| Node.js (incluye npm) | 20 o superior (LTS) | https://nodejs.org |
| PostgreSQL | 16 (sirve 14 o superior) | https://www.postgresql.org/download/windows/ |
| Git | última | https://git-scm.com/downloads |
| Visual Studio Code (opcional) | última | https://code.visualstudio.com |

Durante la instalación de PostgreSQL:
- Anota la **contraseña** que le pongas al usuario `postgres`.
- Deja el puerto `5432`.
- Deja marcado **pgAdmin 4** (sirve para ver las tablas).

Para comprobar las instalaciones, abre PowerShell y ejecuta:

```powershell
node -v
npm -v
git --version
```

## 2. Descargar el proyecto

```powershell
git clone <URL_DEL_REPOSITORIO>
cd <CARPETA_DEL_REPOSITORIO>
```

## 3. Crear la base de datos

1. Abre **pgAdmin 4**, clic derecho en *Databases* > *Create* > *Database* y crea una base llamada `qcs_lacteos`.
2. Abre *Query Tool* sobre esa base y ejecuta, en este orden, el contenido de:
   1. `backend/database/init.sql`
   2. `backend/database/seed.sql`

   (También puedes hacerlo por terminal, si `psql` está en tu PATH:)

```powershell
psql -U postgres -d qcs_lacteos -f backend/database/init.sql
psql -U postgres -d qcs_lacteos -f backend/database/seed.sql
```

Con eso la base queda completa y lista: no hace falta nada más. `seed.sql` solo crea los catálogos y el superadmin `SA-001`.

**Solo en tu PC de desarrollo**, para tener usuarios, insumos y sabores de prueba:

```powershell
psql -U postgres -d qcs_lacteos -f backend/database/seed_demo.sql
cd backend; npm run seed:demo        # opcional: lotes de demostración de los 7 productos
```

Nunca ejecutes `seed_demo.sql` ni `seed:demo` en el servidor de la planta.

Si ya tienes una base de una versión anterior, no la borres: al arrancar, el backend le agrega lo que falte sin tocar los datos (`backend/src/schema.ts`).

## 4. Configurar el backend

```powershell
cd backend
copy .env.example .env
notepad .env
```

Completa los valores del archivo `.env`:

```env
PORT=3001
DATABASE_URL=postgresql://postgres:<TU_CONTRASEÑA>@localhost:5432/qcs_lacteos
CORS_ORIGIN=http://localhost:3000
JWT_SECRET=<TEXTO_LARGO_Y_ALEATORIO>
```

El archivo `.env` no se sube a git. Cada persona crea el suyo.

En producción el backend queda detrás de nginx (puerto 80, en el mismo PC). En el `.env` del servidor agrega `TRUST_PROXY=loopback`, para que el límite de intentos de login use la IP real de cada tablet. Sin esa línea, todos los equipos de la planta comparten el límite de 30 intentos cada 15 minutos. nginx debe enviar la cabecera `X-Forwarded-For` (`proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;`).

En el servidor de la planta también va `HOST=127.0.0.1` (Node solo atiende a nginx). En tu PC de desarrollo no la pongas. Las copias de seguridad automáticas, la restauración y la limpieza de datos de prueba están en `deploy/COMO-INSTALAR.md`.

HTTPS está apagado por defecto: solo se activa con `HTTPS_ENABLED=true` en `backend/.env` (y certificados en `backend/certs`). Antes de activarlo lean `deploy/COMO-INSTALAR.md`: con certificado propio, las tablets Android sin el certificado instalado ven una pantalla de error, y con `COOKIE_SECURE=true` el login solo funciona por HTTPS.

Instala y arranca:

```powershell
npm install
npm run dev
```

Debe quedar escuchando en `http://localhost:3001`. Deja esa terminal abierta.

## 5. Arrancar el frontend

En **otra** terminal PowerShell, desde la carpeta raíz del proyecto:

```powershell
npm install
npm run dev
```

Abre http://localhost:3000 en el navegador.

## 6. Cómo ingresar

Todos ingresan con su **código de empleado** (ej. `OP-104`) y su **PIN**. El mismo campo acepta la contraseña, si el usuario tiene una.

| Quién | PIN | Contraseña |
| --- | --- | --- |
| Operarios | 3 a 8 dígitos | No la necesitan. Si se deja vacía al crearlos, queda igual al PIN. |
| Administradores y superadmin | 4 a 8 dígitos | Obligatoria al crearlos: mínimo 8 caracteres y distinta del PIN. |

- El administrador asigna o restablece el PIN en **Usuarios → Editar**. Al cambiarle el PIN a un operario, el PIN anterior deja de servir.
- Cada usuario cambia su propio nombre, PIN o contraseña en **Usuarios → Mi cuenta**.
- Después de 5 intentos fallidos, el usuario queda bloqueado 15 minutos.

### Quién gestiona a quién

| Rol | Puede |
| --- | --- |
| Superadmin | Todo lo del administrador, más la pestaña **Panel Superadmin**: crear, editar, dar de baja y reactivar administradores. |
| Administrador | Crear, editar, dar de baja y reactivar operarios. No puede crear ni modificar administradores. |
| Operario | Registrar lotes en planta. |

Al reactivar un administrador, el superadmin le asigna un PIN y una contraseña nuevos.

- Dar de baja a alguien cierra su sesión al instante. Si otra persona le restablece la clave, también se cierra su sesión abierta.
- Para cambiar la propia clave se pide la contraseña o el PIN actual.
- El superadmin ve en su panel la **bitácora de accesos**: ingresos, intentos fallidos, bloqueos y cambios de usuarios y claves. Se registra sola y nunca guarda PIN ni contraseñas.

### Usuario inicial

`seed.sql` crea un solo usuario:

| Código | Rol | PIN | Contraseña |
| --- | --- | --- | --- |
| `SA-001` | Superadmin | `123456` | `123456` (temporal) |

Al entrar por primera vez, cambia el PIN y la contraseña en **Panel Superadmin → Mi cuenta** y registra al administrador de la planta. Él registra a los operarios, los lotes de insumos y los sabores.

### Datos de cada usuario

Primer nombre y primer apellido (obligatorios), segundo nombre y segundo apellido (opcionales), cédula (solo números, no se repite), código de empleado (con el que ingresa; puede ser un apodo: letras sin tildes ni Ñ, números y guion, sin espacios, no se repite) y PIN. El administrador puede corregir el código de un operario (y el superadmin el de un administrador): queda en la bitácora y la sesión de esa persona se cierra para que entre con el código nuevo. La fecha de registro y la de baja las guarda el sistema solo. Las cédulas solo las ven el administrador y el superadmin.

### Usuarios de prueba (solo desarrollo, con `seed_demo.sql`)

| Código | Rol | PIN | Contraseña |
| --- | --- | --- | --- |
| `ADM-901` / `ADM-902` | Administrador | `9090` / `9091` | `admin` |
| `OP-104` | Operario Pasta Hilada | `1040` | `1234` |
| `OP-105` | Operario Fermentados | `1050` | `1234` |
| `OP-106` a `OP-108` | Operarios | `1060` a `1080` | `1234` |

## 7. Comandos útiles

| Dónde | Comando | Para qué |
| --- | --- | --- |
| raíz | `npm run dev` | Frontend en modo desarrollo |
| raíz | `npm run build` | Compila el frontend |
| raíz | `npm run lint` | Revisa los tipos de TypeScript |
| `backend/` | `npm run dev` | API en modo desarrollo |
| `backend/` | `npx tsc --noEmit` | Revisa los tipos del backend |
| raíz y `backend/` | `npm audit` | Revisa si alguna librería tiene fallas de seguridad conocidas. Solo lee; no cambia nada |

## 8. Problemas frecuentes

| Mensaje o síntoma | Solución |
| --- | --- |
| `Falta DATABASE_URL` | No existe `backend/.env` o ejecutaste desde otra carpeta. Corre el backend dentro de `backend/`. |
| `password authentication failed` | La contraseña en `DATABASE_URL` no es la de tu `postgres`. |
| `database "qcs_lacteos" does not exist` | Crea la base (paso 3). |
| `relation ... does not exist` | Falta ejecutar `init.sql`. |
| El login no responde | Revisa que el backend esté corriendo en el puerto 3001. |
| `EADDRINUSE` | Ese puerto ya está ocupado. Cierra la otra terminal o programa que lo usa. |
| `npm` no se reconoce | Cierra y abre PowerShell después de instalar Node.js. |
| PowerShell bloquea `npm` por scripts | Ejecuta `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`. |

## 9. Flujo de trabajo en equipo con Git

```powershell
git pull
git checkout -b mi-rama
git add .
git commit -m "Descripción corta del cambio"
git push -u origin mi-rama
```

Nunca subas el archivo `.env` ni la carpeta `node_modules`.
