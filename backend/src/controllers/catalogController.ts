import { Request, Response } from 'express';
import { PoolClient } from 'pg';
import { pool } from '../db';

/**
 * GET /api/catalogs/lines
 * Retorna todas las líneas de producción activas con su lista de productos autorizados.
 */
export async function getLines(_req: Request, res: Response): Promise<void> {
  try {
    const query = `
      SELECT 
        lp.id,
        lp.codigo,
        lp.nombre,
        lp.tipo_linea,
        lp.capacidad_litros,
        lp.estado,
        lp.activo,
        COALESCE(
          ARRAY_AGG(lpp.producto_id) FILTER (WHERE lpp.producto_id IS NOT NULL),
          '{}'
        ) AS allowed_product_ids,
        COALESCE(
          ARRAY_AGG(p.codigo) FILTER (WHERE p.codigo IS NOT NULL),
          '{}'
        ) AS allowed_product_codes
      FROM lineas_produccion lp
      LEFT JOIN lineas_productos_permitidos lpp ON lpp.linea_id = lp.id
      LEFT JOIN productos p ON p.id = lpp.producto_id
      WHERE lp.activo = TRUE
      GROUP BY lp.id
      ORDER BY lp.codigo ASC;
    `;

    const result = await pool.query(query);
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('[catalogs] Error al obtener líneas de producción:', error);
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Error al obtener líneas de producción.',
    });
  }
}

const LINE_STATES = ['disponible', 'en_produccion', 'mantenimiento', 'limpieza_cip'];

/** GET /api/catalogs/products */
export async function getProducts(_req: Request, res: Response): Promise<void> {
  try {
    const { rows } = await pool.query(
      `SELECT id, codigo, nombre, tipo_linea, descripcion, norma_tecnica FROM productos WHERE activo = TRUE ORDER BY codigo;`
    );
    res.json(rows);
  } catch (error) {
    console.error('[catalogs] Error al obtener productos:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Error al obtener productos.' });
  }
}

async function replaceAllowedProducts(client: PoolClient, lineId: string, codes: unknown): Promise<void> {
  if (!Array.isArray(codes)) return;
  await client.query(`DELETE FROM lineas_productos_permitidos WHERE linea_id = $1;`, [lineId]);
  await client.query(
    `INSERT INTO lineas_productos_permitidos (linea_id, producto_id)
     SELECT $1, id FROM productos WHERE codigo = ANY($2::text[]);`,
    [lineId, codes.map(String)]
  );
}

/** PUT /api/catalogs/lines/:lineId */
export async function updateLine(req: Request, res: Response): Promise<void> {
  const client = await pool.connect();
  try {
    const { lineId } = req.params;
    const capacidad = req.body.capacidad_litros !== undefined ? Number(req.body.capacidad_litros) : null;
    if (capacidad !== null && !(capacidad > 0)) {
      res.status(400).json({ error: 'INVALID_CAPACITY', message: 'La capacidad debe ser mayor que 0.' });
      return;
    }
    const estado = LINE_STATES.includes(req.body.estado) ? req.body.estado : null;
    await client.query('BEGIN');
    const { rows } = await client.query(
      `UPDATE lineas_produccion SET
         nombre = COALESCE($2, nombre),
         capacidad_litros = COALESCE($3, capacidad_litros),
         estado = COALESCE($4::estado_linea_enum, estado),
         updated_at = NOW()
       WHERE (id::text = $1 OR codigo = $1) AND activo = TRUE
       RETURNING id;`,
      [lineId, req.body.nombre ? String(req.body.nombre).trim() : null, capacidad, estado]
    );
    if (rows.length === 0) {
      await client.query('ROLLBACK');
      res.status(404).json({ error: 'LINE_NOT_FOUND', message: 'Línea no encontrada.' });
      return;
    }
    await replaceAllowedProducts(client, rows[0].id, req.body.productos);
    await client.query('COMMIT');
    res.json({ id: rows[0].id });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[catalogs] Error al actualizar línea:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Error al actualizar la línea.' });
  } finally {
    client.release();
  }
}

/** DELETE /api/catalogs/lines/:lineId (baja lógica) */
export async function deactivateLine(req: Request, res: Response): Promise<void> {
  try {
    const { lineId } = req.params;
    const active = await pool.query(
      `SELECT 1 FROM lotes_produccion lp JOIN lineas_produccion l ON l.id = lp.linea_id
       WHERE (l.id::text = $1 OR l.codigo = $1) AND lp.estado IN ('PENDIENTE','EN_PROCESO') LIMIT 1;`,
      [lineId]
    );
    if (active.rows.length > 0) {
      res.status(409).json({ error: 'LINE_BUSY', message: 'La línea tiene lotes en proceso y no se puede dar de baja.' });
      return;
    }
    const { rowCount } = await pool.query(
      `UPDATE lineas_produccion SET activo = FALSE, updated_at = NOW() WHERE id::text = $1 OR codigo = $1;`,
      [lineId]
    );
    if (!rowCount) {
      res.status(404).json({ error: 'LINE_NOT_FOUND', message: 'Línea no encontrada.' });
      return;
    }
    res.json({ message: 'Línea dada de baja.' });
  } catch (error) {
    console.error('[catalogs] Error al dar de baja línea:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Error al dar de baja la línea.' });
  }
}

/** GET /api/catalogs/lines/inactive */
export async function getInactiveLines(_req: Request, res: Response): Promise<void> {
  try {
    const { rows } = await pool.query(
      `SELECT id, codigo, nombre, tipo_linea, capacidad_litros FROM lineas_produccion WHERE activo = FALSE ORDER BY codigo;`
    );
    res.json(rows);
  } catch (error) {
    console.error('[catalogs] Error al listar líneas inactivas:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Error al listar líneas inactivas.' });
  }
}

/** POST /api/catalogs/lines/:lineId/reactivar */
export async function reactivateLine(req: Request, res: Response): Promise<void> {
  try {
    const { lineId } = req.params;
    const { rowCount } = await pool.query(
      `UPDATE lineas_produccion SET activo = TRUE, updated_at = NOW() WHERE (id::text = $1 OR codigo = $1) AND activo = FALSE;`,
      [lineId]
    );
    if (!rowCount) {
      res.status(404).json({ error: 'LINE_NOT_FOUND', message: 'Línea inactiva no encontrada.' });
      return;
    }
    res.json({ message: 'Línea reactivada.' });
  } catch (error) {
    console.error('[catalogs] Error al reactivar línea:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Error al reactivar la línea.' });
  }
}
