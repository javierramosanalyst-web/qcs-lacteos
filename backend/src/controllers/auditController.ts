import { Request, Response } from 'express';
import { pool } from '../db';

/*
 * Consulta del historial de correcciones de un lote. Las correcciones se hacen por
 * POST /api/workspace/rectify (workspaceController.rectifyBatchField).
 */

/**
 * GET /api/batches/:batchId/rectifications
 * Consulta el historial inmutable de rectificaciones registradas para un lote.
 */
export async function getBatchRectifications(req: Request, res: Response): Promise<void> {
  try {
    const { batchId } = req.params;
    const query = `
      SELECT 
        ar.*,
        u.nombre_completo AS autorizado_por_nombre,
        u.codigo_empleado AS autorizado_por_codigo,
        u.rol AS autorizado_por_rol
      FROM auditoria_rectificaciones ar
      JOIN usuarios u ON u.id = ar.autorizado_por_id
      LEFT JOIN lotes_produccion lp ON lp.id = ar.lote_id
      LEFT JOIN lotes_padre p ON p.id = ar.lote_padre_id
      WHERE (ar.lote_id::text = $1 OR ar.lote_padre_id::text = $1 OR lp.codigo_lote = $1 OR p.codigo_lote = $1)
      ORDER BY ar.registrado_at DESC;
    `;
    const { rows } = await pool.query(query, [batchId]);
    res.status(200).json(rows);
  } catch (error: any) {
    console.error('[audit] Error al consultar rectificaciones:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Error al consultar historial de rectificaciones.' });
  }
}
