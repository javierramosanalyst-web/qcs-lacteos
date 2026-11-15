import { Request } from 'express';
import { pool } from '../db';

/**
 * Bitácora de accesos (tabla eventos_seguridad): inicios de sesión, intentos fallidos, bloqueos,
 * cambios en usuarios y en claves. Se escribe sola desde el servidor; nunca guarda PIN ni contraseñas.
 * Un fallo al escribir la bitácora no debe tumbar la operación que la originó: solo se registra en consola.
 */
export type EventoSeguridad =
  | 'INGRESO'
  | 'INGRESO_FALLIDO'
  | 'CUENTA_BLOQUEADA'
  | 'SALIDA'
  | 'USUARIO_CREADO'
  | 'USUARIO_EDITADO'
  | 'USUARIO_BAJA'
  | 'USUARIO_REACTIVADO'
  | 'CLAVE_CAMBIADA'
  | 'CLAVE_RESTABLECIDA'
  | 'CLAVE_ACTUAL_INCORRECTA';

export const EVENTOS_SEGURIDAD: readonly EventoSeguridad[] = [
  'INGRESO',
  'INGRESO_FALLIDO',
  'CUENTA_BLOQUEADA',
  'SALIDA',
  'USUARIO_CREADO',
  'USUARIO_EDITADO',
  'USUARIO_BAJA',
  'USUARIO_REACTIVADO',
  'CLAVE_CAMBIADA',
  'CLAVE_RESTABLECIDA',
  'CLAVE_ACTUAL_INCORRECTA',
];

interface DatosEvento {
  evento: EventoSeguridad;
  /** Usuario al que se refiere el evento (si existe). */
  usuarioId?: string | null;
  /** Código de empleado tal como se escribió o el del usuario afectado. */
  codigo?: string | null;
  /** Quién hizo la acción (para cambios hechos por un administrador o el superadmin). */
  actorId?: string | null;
  detalle?: string | null;
  req?: Request;
}

const recortar = (v: unknown, max: number): string | null => {
  const s = String(v ?? '').trim();
  return s ? s.slice(0, max) : null;
};

export async function registrarEvento(d: DatosEvento): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO eventos_seguridad (evento, usuario_id, codigo_empleado, actor_id, detalle, ip)
       VALUES ($1, $2, $3, $4, $5, $6);`,
      [
        d.evento,
        d.usuarioId ?? null,
        recortar(d.codigo, 40)?.toUpperCase() ?? null,
        d.actorId ?? null,
        recortar(d.detalle, 300),
        recortar(d.req ? d.req.ip || d.req.socket?.remoteAddress : null, 64),
      ]
    );
  } catch (error) {
    console.error('[seguridad] No se pudo registrar el evento', d.evento, error instanceof Error ? error.message : error);
  }
}
