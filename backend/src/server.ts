import 'dotenv/config';
// La planta trabaja en hora de Colombia. Varias horas del proceso se registran como "HH:MM" y se
// convierten con la zona del servidor; así no dependen de cómo esté configurado el PC (TZ=... la cambia).
process.env.TZ = process.env.TZ || 'America/Bogota';
import cors from 'cors';
import express, { NextFunction, Request, Response } from 'express';
import { checkDatabase, pool } from './db';
import authRoutes from './routes/authRoutes';
import auditRoutes from './routes/auditRoutes';
import batchRoutes from './routes/batchRoutes';
import catalogRoutes from './routes/catalogRoutes';
import executionRoutes from './routes/executionRoutes';
import packagingRoutes from './routes/packagingRoutes';
import userRoutes from './routes/userRoutes';
import insumoLoteRoutes from './routes/insumoLoteRoutes';
import saborYogurRoutes from './routes/saborYogurRoutes';
import workspaceRoutes from './routes/workspaceRoutes';
import { ensureSchema } from './schema';
import { purgeExpiredInsumoLotes } from './controllers/insumoLoteController';
import { purgeStaleUnstartedDrafts } from './controllers/workspaceController';
import path from 'path';
import fs from 'fs';
import http from 'http';
import https from 'https';

const app = express();
const PORT = Number(process.env.PORT ?? 3001);

const jwtSecret = process.env.JWT_SECRET ?? '';
if (jwtSecret.length < 32) {
  const msg = 'JWT_SECRET debe tener al menos 32 caracteres. Genera uno con: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'base64\'))"';
  if (process.env.NODE_ENV === 'production') {
    console.error(`[server] ${msg}`);
    process.exit(1);
  }
  console.warn(`[server] ADVERTENCIA: ${msg}`);
}

// CORS: orígenes permitidos separados por coma (por defecto, el dev server de Vite).
const allowedOrigins = (process.env.CORS_ORIGIN ?? 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Session-Id'],
  })
);
app.disable('x-powered-by');
// Detrás de un proxy (nginx, IIS, Cloudflare...) todas las peticiones llegan con la IP del proxy.
// TRUST_PROXY=loopback (nginx en el mismo PC) hace que Express use la IP real del equipo (X-Forwarded-For); así el límite
// de intentos de login por equipo no bloquea a toda la planta. Sin la variable, nada cambia.
const trustProxy = (process.env.TRUST_PROXY ?? '').trim();
if (trustProxy) {
  app.set('trust proxy', /^\d+$/.test(trustProxy) ? Number(trustProxy) : trustProxy);
  console.log(`[server] trust proxy = ${trustProxy}`);
}
app.use((_req: Request, res: Response, next: NextFunction) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'same-origin');
  next();
});
app.use(express.json({ limit: '5mb' }));

// Healthcheck (público): estado del proceso y de la conexión a PostgreSQL.
app.get('/api/health', async (_req: Request, res: Response) => {
  const dbUp = await checkDatabase();
  res.status(dbUp ? 200 : 503).json({
    status: dbUp ? 'ok' : 'degraded',
    database: dbUp ? 'up' : 'down',
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

// Rutas de API
app.use('/api/auth', authRoutes);
app.use('/api/batches', batchRoutes);
app.use('/api/batches', executionRoutes);
app.use('/api/batches', packagingRoutes);
app.use('/api/batches', auditRoutes);
app.use('/api/catalogs', catalogRoutes);
app.use('/api/users', userRoutes);
app.use('/api/insumos-lotes', insumoLoteRoutes);
app.use('/api/sabores-yogur', saborYogurRoutes);
app.use('/api/workspace', workspaceRoutes);

// Frontend compilado (npm run build en la raíz): el mismo servidor lo sirve en producción.
const frontendDist = path.resolve(__dirname, '..', '..', 'dist');
if (fs.existsSync(path.join(frontendDist, 'index.html'))) {
  app.use(express.static(frontendDist));
  app.get(/^\/(?!api\/).*/, (_req: Request, res: Response) => {
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

// 404 para rutas inexistentes.
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'NOT_FOUND', message: 'Ruta no encontrada.' });
});

// Manejador de errores centralizado: no filtra detalles internos al cliente.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[server] Error no controlado:', err);
  res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Error interno del servidor.' });
});

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`[server] API escuchando en http://localhost:${PORT} (CORS: ${allowedOrigins.join(', ')})`);
});

// HTTPS opcional, APAGADO por defecto: solo se enciende con HTTPS_ENABLED=true en backend/.env y si existen
// backend/certs/server.crt y server.key (ver deploy/COMO-INSTALAR.md). Con un certificado propio, las tablets
// Android que no lo tengan instalado ven una pantalla de error; por eso no basta con que existan los archivos.
// Encendido, el mismo servidor atiende por HTTPS (HTTPS_PORT, por defecto 443) y redirige el puerto 80 a https.
const certDir = path.resolve(__dirname, '..', 'certs');
const certFile = process.env.HTTPS_CERT_FILE ?? path.join(certDir, 'server.crt');
const keyFile = process.env.HTTPS_KEY_FILE ?? path.join(certDir, 'server.key');
const httpsActivado = process.env.HTTPS_ENABLED === 'true';
if (!httpsActivado && fs.existsSync(certFile) && fs.existsSync(keyFile)) {
  console.log('[server] Hay certificados en backend/certs, pero HTTPS está apagado (HTTPS_ENABLED no es true). Se atiende solo por HTTP.');
}
if (httpsActivado && fs.existsSync(certFile) && fs.existsSync(keyFile)) {
  const HTTPS_PORT = Number(process.env.HTTPS_PORT ?? 443);
  https
    .createServer({ cert: fs.readFileSync(certFile), key: fs.readFileSync(keyFile) }, app)
    .on('error', (err) => console.error(`[server] No se pudo abrir HTTPS en el puerto ${HTTPS_PORT}:`, err.message))
    .listen(HTTPS_PORT, '0.0.0.0', () => console.log(`[server] HTTPS activo en el puerto ${HTTPS_PORT}`));

  // Quien escriba el nombre sin https:// (puerto 80) pasa solo a la versión segura.
  const HTTP_REDIRECT_PORT = Number(process.env.HTTP_REDIRECT_PORT ?? 80);
  if (HTTP_REDIRECT_PORT > 0) {
    const publicPort = process.env.HTTPS_PUBLIC_PORT ?? (HTTPS_PORT === 443 ? '' : String(HTTPS_PORT));
    http
      .createServer((req, res) => {
        const host = String(req.headers.host ?? '').replace(/:\d+$/, '');
        res.writeHead(301, { Location: `https://${host}${publicPort ? `:${publicPort}` : ''}${req.url ?? '/'}` });
        res.end();
      })
      .on('error', (err) => console.error(`[server] No se pudo abrir la redirección en el puerto ${HTTP_REDIRECT_PORT}:`, err.message))
      .listen(HTTP_REDIRECT_PORT, '0.0.0.0', () => console.log(`[server] Redirección http -> https en el puerto ${HTTP_REDIRECT_PORT}`));
  }
}

ensureSchema()
  .then(() => {
    console.log('[server] Esquema de base de datos verificado.');
    const purge = () => purgeExpiredInsumoLotes().catch((err) => console.error('[server] Limpieza de papelera:', err.message));
    void purge();
    setInterval(purge, 24 * 60 * 60 * 1000).unref();
    // Borradores sin lote abandonados (> 8 h sin cambios): revisión cada 30 minutos.
    const purgeDrafts = () =>
      purgeStaleUnstartedDrafts().catch((err) => console.error('[server] Limpieza de borradores:', err.message));
    void purgeDrafts();
    setInterval(purgeDrafts, 30 * 60 * 1000).unref();
  })
  .catch((err) => console.error('[server] No se pudo verificar el esquema:', err.message));

// Cierre ordenado: deja de aceptar peticiones y libera el pool.
function shutdown(signal: string): void {
  console.log(`[server] ${signal} recibido, cerrando...`);
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

export default app;
