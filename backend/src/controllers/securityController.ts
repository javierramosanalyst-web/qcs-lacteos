import { Request, Response } from 'express';
import { pool } from '../db';
import { EVENTOS_SEGURIDAD, EventoSeguridad } from '../services/eventosSeguridad';

const LIMITE_FILAS = 500;

/**
 * GET /api/users/eventos-seguridad?dias=30&evento=INGRESO_FALLIDO&q=OP-104
 * Bitácora de accesos para el superadmin: los últimos eventos (máx. 500) del periodo pedido.
 */
export async function listSecurityEvents(req: Request, res: Response): Promise<void> {
  try {
    const diasPedidos = Number.parseInt(String(req.query.dias ?? '30'), 10);
    const dias = Number.isFinite(diasPedidos) ? Math.min(Math.max(diasPedidos, 1), 366) : 30;
    const params: unknown[] = [dias];
    const where: string[] = [`e.registrado_at >= NOW() - ($1::int * INTERVAL '1 day')`];

    const evento = String(req.query.evento ?? '').trim().toUpperCase();
    if (evento && EVENTOS_SEGURIDAD.includes(evento as EventoSeguridad)) {
      params.push(evento);
      where.push(`e.evento = $${params.length}`);
    }

    const texto = String(req.query.q ?? '').trim().slice(0, 60);
    if (texto) {
      params.push(`%${texto}%`);
      const m = `$${params.length}`;
      where.push(`(COALESCE(u.codigo_empleado, e.codigo_empleado) ILIKE ${m} OR COALESCE(u.nombre_completo, uc.nombre_completo) ILIKE ${m})`);
    }

    const { rows } = await pool.query(
      `SELECT e.id::text AS id,
              e.evento,
              e.registrado_at,
              e.ip,
              e.detalle,
              COALESCE(u.codigo_empleado, e.codigo_empleado) AS codigo,
              COALESCE(u.nombre_completo, uc.nombre_completo) AS nombre,
              a.codigo_empleado AS actor_codigo,
              a.nombre_completo AS actor_nombre
       FROM eventos_seguridad e
       LEFT JOIN usuarios u ON u.id = e.usuario_id
       -- Intentos fallidos y bloqueos solo guardan el código escrito: si existe, se muestra el nombre.
       LEFT JOIN usuarios uc ON e.usuario_id IS NULL AND UPPER(uc.codigo_empleado) = e.codigo_empleado
       LEFT JOIN usuarios a ON a.id = e.actor_id
       WHERE ${where.join(' AND ')}
       ORDER BY e.registrado_at DESC, e.id DESC
       LIMIT ${LIMITE_FILAS};`,
      params
    );
    res.json({ dias, limite: LIMITE_FILAS, eventos: rows });
  } catch (error) {
    console.error('[seguridad] Error al consultar la bitácora:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Error al consultar la bitácora de accesos.' });
  }
}
