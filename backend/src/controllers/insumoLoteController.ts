import { Request, Response } from 'express';
import { pool } from '../db';

const TIPOS: Record<string, { codigo: string; nombre: string; unidad: string }> = {
  leche_fresca: { codigo: 'LECHE-PROV', nombre: 'Leche fresca de proveedor', unidad: 'L' },
  cultivo: { codigo: 'CULTIVO-LACT', nombre: 'Cultivo láctico', unidad: 'g' },
  cuajo: { codigo: 'CUAJO', nombre: 'Cuajo (coagulante)', unidad: 'ml' },
  sal: { codigo: 'SAL', nombre: 'Sal', unidad: 'kg' },
};

const SELECT_LOTE = `
  SELECT il.id, ic.tipo_insumo AS tipo, il.codigo_lote, il.descripcion, il.proveedor,
         il.fecha_vencimiento, il.cantidad_recibida, ic.unidad_base AS unidad, il.activo, il.created_at
  FROM insumos_lotes il
  JOIN insumos_catalogo ic ON ic.id = il.insumo_id`;

async function catalogoId(tipo: string): Promise<string> {
  const t = TIPOS[tipo];
  const { rows } = await pool.query(
    `INSERT INTO insumos_catalogo (codigo, nombre, tipo_insumo, unidad_base)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (codigo) DO UPDATE SET nombre = insumos_catalogo.nombre
     RETURNING id;`,
    [t.codigo, t.nombre, tipo, t.unidad]
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

export async function listInsumoLotes(req: Request, res: Response): Promise<void> {
  try {
    const isAdmin = req.user?.rol === 'administrador' || req.user?.rol === 'superadmin';
    const todos = isAdmin && req.query.todos === '1';
    const tipo = typeof req.query.tipo === 'string' && TIPOS[req.query.tipo] ? req.query.tipo : null;
    const { rows } = await pool.query(
      `${SELECT_LOTE}
       WHERE ic.tipo_insumo = ANY($1::text[]) AND ($2::boolean OR il.activo = TRUE)
         AND ($3::text IS NULL OR ic.tipo_insumo = $3)
       ORDER BY il.created_at DESC;`,
      [Object.keys(TIPOS), todos, tipo]
    );
    res.json(rows);
  } catch (error) {
    console.error('[insumos] Error al listar:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'No se pudieron consultar los lotes de insumos.' });
  }
}

export async function createInsumoLote(req: Request, res: Response): Promise<void> {
  const tipo = String(req.body.tipo ?? '');
  if (!TIPOS[tipo]) return invalid(res, 'Tipo de insumo no válido.');
  const b = parseBody(req.body);
  if (!b.codigo) return invalid(res, 'El código del lote es obligatorio.');
  if (b.cantidad !== null && (!Number.isFinite(b.cantidad) || b.cantidad < 0)) return invalid(res, 'La cantidad recibida no es válida.');
  try {
    const insumoId = await catalogoId(tipo);
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
