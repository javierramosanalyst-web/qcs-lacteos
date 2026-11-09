import { Request, Response } from 'express';
import { pool } from '../db';
import { randomBytes } from 'node:crypto';
import {
  SESSION_COOKIE,
  SESSION_ID_COOKIE,
  sessionCookieOptions,
  signJwtHS256,
} from '../middlewares/authMiddleware';

/**
 * POST /api/auth/login
 * Autentica un usuario verificando la contraseña o PIN directamente en PostgreSQL
 * mediante la función crypt() de pgcrypto. Retorna el JWT firmado con HS256.
 */
export async function login(req: Request, res: Response): Promise<void> {
  try {
    const codigo_empleado = req.body.codigo_empleado ?? req.body.codigoEmpleado ?? req.body.code;
    const password_o_pin = req.body.password_o_pin ?? req.body.passwordOPin ?? req.body.password ?? req.body.pin;

    if (!codigo_empleado || !password_o_pin) {
      res.status(400).json({
        error: 'MISSING_FIELDS',
        message: 'Debe proporcionar codigo_empleado y password_o_pin.',
      });
      return;
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      console.error('[auth] JWT_SECRET no configurado.');
      res.status(500).json({
        error: 'AUTH_NOT_CONFIGURED',
        message: 'Autenticación no configurada en el servidor.',
      });
      return;
    }

    // Consulta con verificación directa en PostgreSQL usando pgcrypto crypt()
    // Valida coincidencia contra password_hash o pin_hash de forma segura
    const query = `
      SELECT 
        id,
        codigo_empleado,
        nombre_completo,
        rol,
        turno,
        linea_asignada_id,
        (SELECT codigo FROM lineas_produccion WHERE id = usuarios.linea_asignada_id) AS linea_codigo,
        activo
      FROM usuarios
      WHERE UPPER(TRIM(codigo_empleado)) = UPPER(TRIM($1))
        AND activo = TRUE
        AND (
          password_hash = crypt($2, password_hash)
          OR pin_hash = crypt($2, pin_hash)
        )
      LIMIT 1;
    `;

    const result = await pool.query(query, [String(codigo_empleado), String(password_o_pin)]);

    if (result.rows.length === 0) {
      res.status(401).json({
        error: 'INVALID_CREDENTIALS',
        message: 'Código de empleado o contraseña/PIN incorrectos.',
      });
      return;
    }

    const user = result.rows[0];

    const sessionId = randomBytes(16).toString('hex');
    const token = signJwtHS256(
      {
        sub: user.id,
        rol: user.rol,
        linea_asignada_id: user.linea_asignada_id,
        sid: sessionId,
      },
      secret,
      8 * 3600 // 8 horas (jornada de turno)
    );

    res.setHeader('Set-Cookie', [
      `${SESSION_COOKIE}=${encodeURIComponent(token)}; ${sessionCookieOptions(8 * 3600)}`,
      `${SESSION_ID_COOKIE}=${sessionId}; ${sessionCookieOptions(8 * 3600)}`,
    ]);

    res.status(200).json({
      session_id: sessionId,
      user: {
        id: user.id,
        codigo_empleado: user.codigo_empleado,
        nombre_completo: user.nombre_completo,
        rol: user.rol,
        turno: user.turno,
        linea_asignada_id: user.linea_asignada_id,
        linea_codigo: user.linea_codigo,
      },
    });
  } catch (error) {
    console.error('[auth] Error en login:', error);
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Error al procesar la autenticación.',
    });
  }
}

/** GET /api/auth/me  Valida el token y devuelve el usuario vigente (para restaurar sesión al recargar). */
export async function me(req: Request, res: Response): Promise<void> {
  try {
    const { rows } = await pool.query(
      `SELECT id, codigo_empleado, nombre_completo, rol, turno, linea_asignada_id,
              (SELECT codigo FROM lineas_produccion WHERE id = usuarios.linea_asignada_id) AS linea_codigo
       FROM usuarios WHERE id::text = $1 AND activo = TRUE;`,
      [req.user?.id]
    );
    if (rows.length === 0) {
      res.status(401).json({ error: 'USER_INACTIVE', message: 'El usuario ya no está activo.' });
      return;
    }
    res.json({ user: rows[0] });
  } catch (error) {
    console.error('[auth] Error en /me:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Error al validar la sesión.' });
  }
}

/** POST /api/auth/logout  Borra la cookie de sesión httpOnly. */
export async function logout(_req: Request, res: Response): Promise<void> {
  res.setHeader('Set-Cookie', [
    `${SESSION_COOKIE}=; ${sessionCookieOptions(0)}`,
    `${SESSION_ID_COOKIE}=; ${sessionCookieOptions(0)}`,
  ]);
  res.status(200).json({ message: 'Sesión cerrada.' });
}
