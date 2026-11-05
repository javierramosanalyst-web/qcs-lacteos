import { Request, Response } from 'express';
import { pool } from '../db';

const SELECT_LOTE = `
  SELECT il.id, ic.tipo_insumo AS tipo, il.codigo_lote, il.descripcion, il.proveedor,
         il.fecha_vencimiento, il.cantidad_recibida, ic.unidad_base AS unidad, il.activo, il.created_at, il.eliminado_at
  FROM insumos_lotes il
  JOIN insumos_catalogo ic ON ic.id = il.insumo_id`;

async function tipoGestionable(tipo: string): Promise<{ codigo: string; nombre: string; unidad_base: string } | null> {
  const { rows } = await pool.query(
    `SELECT codigo, nombre, unidad_base FROM tipos_insumo WHERE codigo = $1 AND gestionable_admin AND activo;`,
    [tipo]
  );
  return rows[0] ?? null;
}

async function catalogoId(t: { codigo: string; nombre: string; unidad_base: string }): Promise<string> {
  const found = await pool.query(
    `SELECT id FROM insumos_catalogo WHERE tipo_insumo = $1 ORDER BY created_at LIMIT 1;`,
    [t.codigo]
  );
  if (found.rows[0]) return found.rows[0].id;
  const { rows } = await pool.query(
    `INSERT INTO insumos_catalogo (codigo, nombre, tipo_insumo, unidad_base)
     VALUES ($1, $2, $3, $4) RETURNING id;`,
    ['INS-' + t.codigo.toUpperCase().replace(/_/g, '-'), t.nombre, t.codigo, t.unidad_base]
  );
  return rows[0].id;
}

function parseBody(body: any) {
  const codigo = String(body.codigo_lote ?? '').trim();
  const cantidad = body.cantidad_recibida === '' || body.cantidad_recibida == null ? null : Number(body.cantidad_recibida);
  const venc = body.fecha_vencimiento ? String(body.fecha_vencimiento).slice(0, 10) : null;
  return {
    codigo,
    descripcion: String(body.descripcion ?? '').trim() || null,
    proveedor: String(body.proveedor ?? '').trim() || null,
    venc,
    cantidad,
  };
}

function invalid(res: Response, message: string) {
  res.status(400).json({ error: 'INVALID_INPUT', message });
}

export async function purgeExpiredInsumoLotes(): Promise<number> {
  const { rows } = await pool.query(
    `SELECT id FROM insumos_lotes WHERE eliminado_at IS NOT NULL AND eliminado_at < NOW() - INTERVAL '30 days';`
  );
  let purged = 0;
  for (const r of rows) {
    try {
      await pool.query(`DELETE FROM insumos_lotes WHERE id = $1;`, [r.id]);
      purged += 1;
    } catch {
      continue;
    }
  }
  return purged;
}

export async function listInsumoLotes(req: Request, res: Response): Promise<void> {
  try {
    const isAdmin = req.user?.rol === 'administrador' || req.user?.rol === 'superadmin';
    const todos = isAdmin && req.query.todos === '1';
    const papelera = isAdmin && req.query.papelera === '1';
    if (papelera) await purgeExpiredInsumoLotes();
    const tipo = typeof req.query.tipo === 'string' ? req.query.tipo : null;
    const { rows } = await pool.query(
      `${SELECT_LOTE}
       WHERE ic.tipo_insumo IN (SELECT codigo FROM tipos_insumo WHERE gestionable_admin AND activo) AND ($1::boolean OR il.activo = TRUE)
         AND ($2::text IS NULL OR ic.tipo_insumo = $2)
         AND (il.eliminado_at IS NOT NULL) = $3::boolean
       ORDER BY il.created_at DESC;`,
      [todos || papelera, tipo, papelera]
    );
    res.json(rows);
  } catch (error) {
    console.error('[insumos] Error al listar:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'No se pudieron consultar los lotes de insumos.' });
  }
}

export async function createInsumoLote(req: Request, res: Response): Promise<void> {
  const tipo = String(req.body.tipo ?? '');
  const b = parseBody(req.body);
  if (!b.codigo) return invalid(res, 'El código del lote es obligatorio.');
  if (b.cantidad !== null && (!Number.isFinite(b.cantidad) || b.cantidad < 0)) return invalid(res, 'La cantidad recibida no es válida.');
  try {
    const t = await tipoGestionable(tipo);
    if (!t) return invalid(res, 'Tipo de insumo no válido.');
    const insumoId = await catalogoId(t);
    const { rows } = await pool.query(
      `INSERT INTO insumos_lotes (insumo_id, codigo_lote, descripcion, proveedor, fecha_vencimiento, cantidad_recibida)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id;`,
      [insumoId, b.codigo, b.descripcion, b.proveedor, b.venc, b.cantidad]
    );
    const out = await pool.query(`${SELECT_LOTE} WHERE il.id = $1;`, [rows[0].id]);
    res.status(201).json(out.rows[0]);
  } catch (error: any) {
    if (error.code === '23505') {
      res.status(409).json({ error: 'DUPLICATE', message: 'Ya existe un lote con ese código para este insumo.' });
      return;
    }
    console.error('[insumos] Error al crear:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'No se pudo registrar el lote.' });
  }
}

export async function updateInsumoLote(req: Request, res: Response): Promise<void> {
  const b = parseBody(req.body);
  if (!b.codigo) return invalid(res, 'El código del lote es obligatorio.');
  if (b.cantidad !== null && (!Number.isFinite(b.cantidad) || b.cantidad < 0)) return invalid(res, 'La cantidad recibida no es válida.');
  try {
    const { rowCount } = await pool.query(
      `UPDATE insumos_lotes SET codigo_lote = $2, descripcion = $3, proveedor = $4, fecha_vencimiento = $5, cantidad_recibida = $6
       WHERE id = $1;`,
      [req.params.id, b.codigo, b.descripcion, b.proveedor, b.venc, b.cantidad]
    );
    if (!rowCount) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Lote no encontrado.' });
      return;
    }
    const out = await pool.query(`${SELECT_LOTE} WHERE il.id = $1;`, [req.params.id]);
    res.json(out.rows[0]);
  } catch (error: any) {
    if (error.code === '23505') {
      res.status(409).json({ error: 'DUPLICATE', message: 'Ya existe un lote con ese código para este insumo.' });
      return;
    }
    if (error.code === '22P02') return invalid(res, 'Identificador no válido.');
    console.error('[insumos] Error al actualizar:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'No se pudo actualizar el lote.' });
  }
}

export async function trashInsumoLote(req: Request, res: Response): Promise<void> {
  const restore = req.path.endsWith('/restaurar');
  try {
    const { rowCount } = await pool.query(
      `UPDATE insumos_lotes SET eliminado_at = ${restore ? 'NULL' : 'NOW()'}, activo = $2 WHERE id = $1;`,
      [req.params.id, restore]
    );
    if (!rowCount) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Lote no encontrado.' });
      return;
    }
    res.json({ message: restore ? 'Lote restaurado.' : 'Lote enviado a la papelera. Se elimina de forma permanente en 30 días.' });
  } catch (error: any) {
    if (error.code === '22P02') return invalid(res, 'Identificador no válido.');
    console.error('[insumos] Error al mover a papelera:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'No se pudo completar la operación.' });
  }
}

export async function deleteInsumoLotePermanente(req: Request, res: Response): Promise<void> {
  try {
    const { rowCount } = await pool.query(
      `DELETE FROM insumos_lotes WHERE id = $1 AND eliminado_at IS NOT NULL;`,
      [req.params.id]
    );
    if (!rowCount) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'El lote no está en la papelera.' });
      return;
    }
    res.json({ message: 'Lote eliminado permanentemente.' });
  } catch (error: any) {
    if (error.code === '23503') {
      res.status(409).json({
        error: 'IN_USE',
        message: 'Este lote ya fue usado en producciones y no se puede borrar para conservar la trazabilidad. Déjalo en la papelera.',
      });
      return;
    }
    if (error.code === '22P02') return invalid(res, 'Identificador no válido.');
    console.error('[insumos] Error al eliminar permanentemente:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'No se pudo eliminar el lote.' });
  }
}

export async function setInsumoLoteActivo(req: Request, res: Response): Promise<void> {
  const activo = req.method !== 'DELETE';
  try {
    const { rowCount } = await pool.query(`UPDATE insumos_lotes SET activo = $2 WHERE id = $1;`, [req.params.id, activo]);
    if (!rowCount) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Lote no encontrado.' });
      return;
    }
    res.json({ message: activo ? 'Lote reactivado.' : 'Lote desactivado.' });
  } catch (error: any) {
    if (error.code === '22P02') return invalid(res, 'Identificador no válido.');
    console.error('[insumos] Error al cambiar estado:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'No se pudo cambiar el estado del lote.' });
  }
}
