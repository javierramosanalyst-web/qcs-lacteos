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
| `backend/database/` | `init.sql` (crea las tablas) y `seed.sql` (catálogos y usuarios iniciales) |
| `docs/` | Documentación de arquitectura |

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

## 6. Usuarios iniciales

Los crea `seed.sql`. Si tu equipo cambió los PIN, usa los que defina el administrador.

| Código | Rol | Acceso |
| --- | --- | --- |
| `SA-001` | Superadmin | PIN `1234` |
| `ADM-901` | Administrador | PIN `9090` |
| `OP-104` | Operario Pasta Hilada | PIN `1040` |
| `OP-105` | Operario Fermentados | PIN `1050` |

Cambia estos PIN antes de usar el sistema en producción.

## 7. Comandos útiles

| Dónde | Comando | Para qué |
| --- | --- | --- |
| raíz | `npm run dev` | Frontend en modo desarrollo |
| raíz | `npm run build` | Compila el frontend |
| raíz | `npm run lint` | Revisa los tipos de TypeScript |
| `backend/` | `npm run dev` | API en modo desarrollo |
| `backend/` | `npx tsc --noEmit` | Revisa los tipos del backend |

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
