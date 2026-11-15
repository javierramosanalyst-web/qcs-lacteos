import { createHmac, timingSafeEqual } from 'node:crypto';
import { pool } from '../db';
import { NextFunction, Request, Response } from 'express';

/**
 * Módulo de autenticación JWT (HS256).
 *
 * - Emisión (signJwtHS256) y verificación (verifyJwtHS256) usando `node:crypto` (sin dependencias extra).
 * - Inyecta `req.user` con { id, rol, lineaAsignadaId }.
 *
 * Claims esperados (doc §3.4): sub (id de usuario), rol, linea_asignada_id, iat, exp.
 * Decisión de gerencia #4: un JWT válido con rol administrador/superadmin basta para
 * autorizar correcciones; aquí NO se pide reingreso de contraseña/PIN.
 */

export type RolUsuario = 'superadmin' | 'administrador' | 'operador';

export const SESSION_COOKIE = 'qcs_session';
export const SESSION_ID_COOKIE = 'qcs_sid';

/** Lee una cookie del encabezado sin dependencias externas. */
export function readCookie(req: Request, name: string): string | null {
  const header = req.headers.cookie;
  if (!header) return null;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx < 0) continue;
    if (part.slice(0, idx).trim() !== name) continue;
    return decodeURIComponent(part.slice(idx + 1).trim());
  }
  return null;
}

/** Cookie de sesión httpOnly: el navegador la envía sola y JavaScript no puede leerla. */
export function sessionCookieOptions(maxAgeSeconds: number): string {
  const secure = process.env.COOKIE_SECURE === 'true' ? '; Secure' : '';
  return `Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAgeSeconds}${secure}`;
}

export interface AuthUser {
  id: string;
  rol: RolUsuario;
  lineaAsignadaId: string | null;
}

export interface SignTokenPayload {
  sub: string;
  rol: RolUsuario;
  linea_asignada_id: string | null;
  [key: string]: unknown;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

const ROLES_VALIDOS: readonly RolUsuario[] = ['superadmin', 'administrador', 'operador'];

export interface JwtPayload {
  sub?: unknown;
  rol?: unknown;
  linea_asignada_id?: unknown;
  sid?: unknown;
  exp?: unknown;
  iat?: unknown;
  iat_ms?: unknown;
}

function decodeBase64Url(segment: string): Buffer {
  return Buffer.from(segment, 'base64url');
}

/** Emite un token firmado HS256 con node:crypto */
export function signJwtHS256(
  payload: SignTokenPayload,
  secret: string,
  expiresInSeconds = 28800
): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const ahoraMs = Date.now();
  const now = Math.floor(ahoraMs / 1000);
  const fullPayload = {
    iat: now,
    // Momento exacto de emisión (ms): para revocar sesiones sin ambigüedad dentro del mismo segundo.
    iat_ms: ahoraMs,
    exp: now + expiresInSeconds,
    ...payload,
  };

  const headerB64 = Buffer.from(JSON.stringify(header), 'utf8').toString('base64url');
  const payloadB64 = Buffer.from(JSON.stringify(fullPayload), 'utf8').toString('base64url');
  const signatureB64 = createHmac('sha256', secret)
    .update(`${headerB64}.${payloadB64}`)
    .digest('base64url');

  return `${headerB64}.${payloadB64}.${signatureB64}`;
}

/** Devuelve el payload si el token es válido; lanza Error con un motivo si no. */
export function verifyJwtHS256(token: string, secret: string): JwtPayload {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Formato de token inválido.');
  const [headerB64, payloadB64, signatureB64] = parts;

  const header = JSON.parse(decodeBase64Url(headerB64).toString('utf8')) as { alg?: string };
  // Rechaza 'none' y cualquier algoritmo distinto al esperado (evita downgrade de algoritmo).
  if (header.alg !== 'HS256') throw new Error('Algoritmo no permitido.');

  const expected = createHmac('sha256', secret).update(`${headerB64}.${payloadB64}`).digest();
  const received = decodeBase64Url(signatureB64);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
    throw new Error('Firma inválida.');
  }

  const payload = JSON.parse(decodeBase64Url(payloadB64).toString('utf8')) as JwtPayload;

  if (typeof payload.exp !== 'number' || payload.exp * 1000 <= Date.now()) {
    throw new Error('Token expirado o sin expiración.');
  }
  return payload;
}

/**
 * Revocación inmediata: además del token, cada petición confirma en la base que el usuario sigue
 * activo y toma su rol actual. Así, dar de baja a alguien le cierra la sesión al instante (antes
 * seguía entrando hasta que vencía el token de 8 h). Se guarda 5 s en memoria para no consultar
 * la base en cada petición seguida; dar de baja o editar un usuario borra su entrada al momento.
 */
interface UsuarioVigente {
  activo: boolean;
  rol: RolUsuario;
  linea_asignada_id: string | null;
  /** Milisegundos (epoch). Los tokens emitidos antes quedan sin validez (baja, reactivación o clave restablecida). */
  sesiones_desde: number | null;
}
const VIGENCIA_CACHE_MS = 5000;
const cacheUsuarios = new Map<string, { datos: UsuarioVigente | null; hasta: number }>();

export function olvidarUsuarioEnCache(id: string): void {
  cacheUsuarios.delete(id);
}

async function usuarioVigente(id: string): Promise<UsuarioVigente | null> {
  const ahora = Date.now();
  const enCache = cacheUsuarios.get(id);
  if (enCache && enCache.hasta > ahora) return enCache.datos;
  const { rows } = await pool.query(
    `SELECT activo, rol::text AS rol, linea_asignada_id,
            FLOOR(EXTRACT(EPOCH FROM sesiones_desde) * 1000)::bigint AS sesiones_desde
     FROM usuarios WHERE id::text = $1;`,
    [id]
  );
  const datos = rows[0]
    ? ({ ...rows[0], sesiones_desde: rows[0].sesiones_desde === null ? null : Number(rows[0].sesiones_desde) } as UsuarioVigente)
    : null;
  if (cacheUsuarios.size > 1000) cacheUsuarios.clear();
  cacheUsuarios.set(id, { datos, hasta: ahora + VIGENCIA_CACHE_MS });
  return datos;
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    // Falla cerrado: sin secreto configurado no se acepta ningún token.
    console.error('[auth] JWT_SECRET no está configurado.');
    res.status(500).json({ error: 'AUTH_NOT_CONFIGURED', message: 'Autenticación no configurada.' });
    return;
  }

  const header = req.headers.authorization;
  const bearer = header && header.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : null;
  const token = bearer || readCookie(req, SESSION_COOKIE);
  if (!token) {
    res.status(401).json({ error: 'UNAUTHENTICATED', message: 'Sesión no iniciada.' });
    return;
  }

  try {
    const payload = verifyJwtHS256(token, secret);

    if (typeof payload.sub !== 'string' || !payload.sub) {
      throw new Error('Token sin sujeto.');
    }
    if (typeof payload.rol !== 'string' || !ROLES_VALIDOS.includes(payload.rol as RolUsuario)) {
      throw new Error('Rol inválido.');
    }

    req.user = {
      id: payload.sub,
      rol: payload.rol as RolUsuario,
      lineaAsignadaId: typeof payload.linea_asignada_id === 'string' ? payload.linea_asignada_id : null,
    };

    const sid = typeof payload.sid === 'string' ? payload.sid : null;
    if (sid) {
      const headerSid = req.headers['x-session-id'];
      const tabSid = Array.isArray(headerSid) ? headerSid[0] : headerSid;
      if (tabSid && tabSid !== sid) {
        res.status(401).json({
          error: 'SESSION_REPLACED',
          message: 'Se inició sesión con otro usuario en este dispositivo. Vuelve a ingresar.',
        });
        return;
      }
      const cookieSid = readCookie(req, SESSION_ID_COOKIE);
      if (cookieSid && cookieSid !== sid) {
        res.status(401).json({
          error: 'SESSION_REPLACED',
          message: 'Se inició sesión con otro usuario en este dispositivo. Vuelve a ingresar.',
        });
        return;
      }
    }

    const usuario = req.user;
    const emitidoEn =
      typeof payload.iat_ms === 'number' ? payload.iat_ms : typeof payload.iat === 'number' ? payload.iat * 1000 : 0;
    usuarioVigente(usuario.id)
      .then((vigente) => {
        if (vigente && vigente.activo && vigente.sesiones_desde !== null && emitidoEn < vigente.sesiones_desde) {
          res.status(401).json({
            error: 'SESSION_REVOKED',
            message: 'Tu clave fue cambiada por un administrador. Ingresa de nuevo.',
          });
          return;
        }
        if (!vigente || !vigente.activo || !ROLES_VALIDOS.includes(vigente.rol)) {
          res.status(401).json({
            error: 'SESSION_REVOKED',
            message: 'Tu usuario fue dado de baja. Consulta con el administrador.',
          });
          return;
        }
        // Rol y línea vigentes en la base (no los del token, que pudo emitirse antes de un cambio).
        usuario.rol = vigente.rol;
        usuario.lineaAsignadaId = vigente.linea_asignada_id;
        next();
      })
      .catch((error) => {
        console.error('[auth] No se pudo validar el usuario en la base:', error instanceof Error ? error.message : error);
        res.status(503).json({ error: 'DB_UNAVAILABLE', message: 'No se pudo validar la sesión. Intenta de nuevo.' });
      });
  } catch (error) {
    res.status(401).json({
      error: 'INVALID_TOKEN',
      message: error instanceof Error ? error.message : 'Token inválido.',
    });
  }
}

/** Restringe una ruta a los roles indicados. Debe ir después de `authMiddleware`. */
export function requireRole(...roles: RolUsuario[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'UNAUTHENTICATED', message: 'No autenticado.' });
      return;
    }
    if (!roles.includes(req.user.rol)) {
      res.status(403).json({ error: 'FORBIDDEN_ROLE', message: 'Tu rol no tiene permiso para esta acción.' });
      return;
    }
    next();
  };
}
