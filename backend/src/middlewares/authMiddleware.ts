import { createHmac, timingSafeEqual } from 'node:crypto';
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

interface JwtPayload {
  sub?: unknown;
  rol?: unknown;
  linea_asignada_id?: unknown;
  exp?: unknown;
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
  const now = Math.floor(Date.now() / 1000);
  const fullPayload = {
    iat: now,
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
function verifyJwtHS256(token: string, secret: string): JwtPayload {
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

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    // Falla cerrado: sin secreto configurado no se acepta ningún token.
    console.error('[auth] JWT_SECRET no está configurado.');
    res.status(500).json({ error: 'AUTH_NOT_CONFIGURED', message: 'Autenticación no configurada.' });
    return;
  }

  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ error: 'UNAUTHENTICATED', message: 'Falta el token Bearer.' });
    return;
  }

  try {
    const payload = verifyJwtHS256(header.slice('Bearer '.length).trim(), secret);

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
    next();
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
