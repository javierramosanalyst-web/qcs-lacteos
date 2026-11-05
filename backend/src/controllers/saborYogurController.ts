import { Request, Response } from 'express';
import { pool } from '../db';

const SELECT_SABOR = `SELECT id, nombre, activo, created_at FROM sabores_yogur`;

function invalid(res: Response, message: string) {
  res.status(400).json({ error: 'INVALID_INPUT', message });
}

function nombreDe(body: any): string {
  return String(body?.nombre ?? '').trim().replace(/\s+/g, ' ');
}

export async function listSaboresYogur(req: Request, res: Response): Promise<void> {
  try {
    const isAdmin = req.user?.rol === 'administrador' || req.user?.rol === 'superadmin';
    const todos = isAdmin && req.query.todos === '1';
    const { rows } = await pool.query(`${SELECT_SABOR} WHERE ($1::boolean OR activo = TRUE) ORDER BY nombre;`, [todos]);
    res.json(rows);
  } catch (error) {
    console.error('[sabores] Error al listar:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'No se pudieron consultar los sabores.' });
  }
}

export async function createSaborYogur(req: Request, res: Response): Promise<void> {
  const nombre = nombreDe(req.body);
  if (!nombre) return invalid(res, 'El nombre del sabor es obligatorio.');
  if (nombre.length > 80) return invalid(res, 'El nombre del sabor es demasiado largo.');
  try {
    const { rows } = await pool.query(`INSERT INTO sabores_yogur (nombre) VALUES ($1) RETURNING id, nombre, activo, created_at;`, [nombre]);
    res.status(201).json(rows[0]);
  } catch (error: any) {
    if (error.code === '23505') {
      res.status(409).json({ error: 'DUPLICATE', message: 'Ya existe un sabor con ese nombre.' });
      return;
    }
    console.error('[sabores] Error al crear:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'No se pudo registrar el sabor.' });
  }
}

export async function updateSaborYogur(req: Request, res: Response): Promise<void> {
  const nombre = nombreDe(req.body);
  if (!nombre) return invalid(res, 'El nombre del sabor es obligatorio.');
  if (nombre.length > 80) return invalid(res, 'El nombre del sabor es demasiado largo.');
  try {
    const { rows } = await pool.query(
      `UPDATE sabores_yogur SET nombre = $2 WHERE id = $1 RETURNING id, nombre, activo, created_at;`,
      [req.params.id, nombre]
    );
    if (!rows[0]) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Sabor no encontrado.' });
      return;
    }
    res.json(rows[0]);
  } catch (error: any) {
    if (error.code === '23505') {
      res.status(409).json({ error: 'DUPLICATE', message: 'Ya existe un sabor con ese nombre.' });
      return;
    }
    if (error.code === '22P02') return invalid(res, 'Identificador no válido.');
    console.error('[sabores] Error al actualizar:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'No se pudo actualizar el sabor.' });
  }
}

export async function setSaborYogurActivo(req: Request, res: Response): Promise<void> {
  const activo = req.method !== 'DELETE';
  try {
    const { rowCount } = await pool.query(`UPDATE sabores_yogur SET activo = $2 WHERE id = $1;`, [req.params.id, activo]);
    if (!rowCount) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Sabor no encontrado.' });
      return;
    }
    res.json({ message: activo ? 'Sabor reactivado.' : 'Sabor desactivado.' });
  } catch (error: any) {
    if (error.code === '22P02') return invalid(res, 'Identificador no válido.');
    console.error('[sabores] Error al cambiar estado:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'No se pudo cambiar el estado del sabor.' });
  }
}
