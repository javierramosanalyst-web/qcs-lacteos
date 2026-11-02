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

/**
 * GET /api/catalogs/lines/:lineId/products
 * Retorna los productos autorizados para la línea especificada (buscando por UUID o código).
 */
export async function getProductsByLine(req: Request, res: Response): Promise<void> {
  try {
    const { lineId } = req.params;

    if (!lineId) {
      res.status(400).json({
        error: 'MISSING_PARAM',
        message: 'Se requiere el identificador de la línea (lineId).',
      });
      return;
    }

    // Comprobar existencia de la línea por UUID o código (ej. 'L-FERMENT-02')
    const lineCheck = await pool.query(
      `SELECT id, codigo, nombre FROM lineas_produccion 
       WHERE (id::text = $1 OR codigo = $1) AND activo = TRUE 
       LIMIT 1;`,
      [lineId]
    );

    if (lineCheck.rows.length === 0) {
      res.status(404).json({
        error: 'LINE_NOT_FOUND',
        message: `Línea de producción '${lineId}' no encontrada o inactiva.`,
      });
      return;
    }

    const verifiedLineId = lineCheck.rows[0].id;

    const query = `
      SELECT 
        p.id,
        p.codigo,
        p.nombre,
        p.tipo_linea,
        p.descripcion,
        p.norma_tecnica,
        p.activo
      FROM lineas_productos_permitidos lpp
      JOIN productos p ON p.id = lpp.producto_id
      WHERE lpp.linea_id = $1
        AND p.activo = TRUE
      ORDER BY p.codigo ASC;
    `;

    const result = await pool.query(query, [verifiedLineId]);
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('[catalogs] Error al obtener productos de la línea:', error);
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Error al obtener productos de la línea de producción.',
    });
  }
}

const LINE_TYPES = ['pasta_hilada', 'fermentacion', 'dulces'];
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

/** POST /api/catalogs/lines */
export async function createLine(req: Request, res: Response): Promise<void> {
  const client = await pool.connect();
  try {
    const codigo = String(req.body.codigo ?? '').trim().toUpperCase();
    const nombre = String(req.body.nombre ?? '').trim();
    const tipo = String(req.body.tipo_linea ?? '');
    const capacidad = Number(req.body.capacidad_litros);
    const estado = LINE_STATES.includes(req.body.estado) ? req.body.estado : 'disponible';
    if (!codigo || !nombre || !LINE_TYPES.includes(tipo) || !(capacidad > 0)) {
      res.status(400).json({ error: 'INVALID_FIELDS', message: 'Código, nombre, tipo de línea y capacidad (> 0) son obligatorios.' });
      return;
    }
    await client.query('BEGIN');
    const { rows } = await client.query(
      `INSERT INTO lineas_produccion (codigo, nombre, tipo_linea, capacidad_litros, estado)
       VALUES ($1, $2, $3, $4, $5) RETURNING id;`,
      [codigo, nombre, tipo, capacidad, estado]
    );
    await replaceAllowedProducts(client, rows[0].id, req.body.productos ?? []);
    await client.query('COMMIT');
    res.status(201).json({ id: rows[0].id });
  } catch (error: any) {
    await client.query('ROLLBACK');
    if (error.code === '23505') {
      res.status(409).json({ error: 'DUPLICATE_CODE', message: 'Ya existe una línea con ese código.' });
      return;
    }
    console.error('[catalogs] Error al crear línea:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Error al crear la línea.' });
  } finally {
    client.release();
  }
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
