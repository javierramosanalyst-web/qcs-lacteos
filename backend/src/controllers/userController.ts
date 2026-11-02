import { Request, Response } from 'express';
import { pool } from '../db';

const TURNOS = ['Jornada Continua', 'Mañana', 'Tarde', 'Noche'];

const USER_COLUMNS = `
  u.id, u.codigo_empleado, u.nombre_completo, u.rol, u.turno,
  u.linea_asignada_id, l.codigo AS linea_codigo, u.activo, u.created_at`;

async function resolveLine(identifier: unknown): Promise<string | null> {
  if (!identifier) return null;
  const res = await pool.query(
    `SELECT id FROM lineas_produccion WHERE id::text = $1 OR codigo = $1 LIMIT 1;`,
    [String(identifier)]
  );
  return res.rows[0]?.id ?? null;
}

export async function listUsers(_req: Request, res: Response): Promise<void> {
  try {
    const { rows } = await pool.query(
      `SELECT ${USER_COLUMNS}
       FROM usuarios u LEFT JOIN lineas_produccion l ON l.id = u.linea_asignada_id
       WHERE u.activo = TRUE
       ORDER BY u.rol, u.nombre_completo;`
    );
    res.json(rows);
  } catch (error) {
    console.error('[users] Error al listar usuarios:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Error al listar usuarios.' });
  }
}

export async function createUser(req: Request, res: Response): Promise<void> {
  try {
    const nombre = String(req.body.nombre_completo ?? '').trim();
    const codigo = String(req.body.codigo_empleado ?? '').trim().toUpperCase();
    const pin = String(req.body.pin ?? '').trim();
    const password = String(req.body.password ?? '').trim() || pin;
    const turno = TURNOS.includes(req.body.turno) ? req.body.turno : 'Jornada Continua';
    const rolSolicitado = req.body.rol === 'administrador' ? 'administrador' : 'operador';

    if (rolSolicitado === 'administrador' && req.user?.rol !== 'superadmin') {
      res.status(403).json({ error: 'FORBIDDEN_ROLE', message: 'Solo el superadmin puede crear administradores.' });
      return;
    }
    if (nombre.length < 3 || codigo.length < 2) {
      res.status(400).json({ error: 'MISSING_FIELDS', message: 'Nombre y código de empleado son obligatorios.' });
      return;
    }
    if (!/^\d{4,8}$/.test(pin)) {
      res.status(400).json({ error: 'INVALID_PIN', message: 'El PIN debe tener entre 4 y 8 dígitos.' });
      return;
    }

    const lineaId = await resolveLine(req.body.linea_asignada_id);
    const { rows } = await pool.query(
      `INSERT INTO usuarios (codigo_empleado, nombre_completo, rol, turno, pin_hash, password_hash, linea_asignada_id)
       VALUES ($1, $2, $3, $4, crypt($5, gen_salt('bf', 10)), crypt($6, gen_salt('bf', 10)), $7)
       RETURNING id;`,
      [codigo, nombre, rolSolicitado, turno, pin, password, lineaId]
    );
    const created = await pool.query(
      `SELECT ${USER_COLUMNS} FROM usuarios u LEFT JOIN lineas_produccion l ON l.id = u.linea_asignada_id WHERE u.id = $1;`,
      [rows[0].id]
    );
    res.status(201).json(created.rows[0]);
  } catch (error: any) {
    if (error.code === '23505') {
      res.status(409).json({ error: 'DUPLICATE_CODE', message: 'Ya existe un usuario con ese código de empleado.' });
      return;
    }
    console.error('[users] Error al crear usuario:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Error al crear el usuario.' });
  }
}

export async function updateUser(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const target = await pool.query(`SELECT rol FROM usuarios WHERE id::text = $1 AND activo = TRUE;`, [id]);
    if (target.rows.length === 0) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Usuario no encontrado.' });
      return;
    }
    if (target.rows[0].rol !== 'operador' && req.user?.rol !== 'superadmin' && req.user?.id !== id) {
      res.status(403).json({ error: 'FORBIDDEN_ROLE', message: 'Solo el superadmin puede editar administradores.' });
      return;
    }

    const nombre = req.body.nombre_completo ? String(req.body.nombre_completo).trim() : null;
    const turno = TURNOS.includes(req.body.turno) ? req.body.turno : null;
    const pin = req.body.pin ? String(req.body.pin).trim() : null;
    const password = req.body.password ? String(req.body.password).trim() : null;
    if (pin && !/^\d{4,8}$/.test(pin)) {
      res.status(400).json({ error: 'INVALID_PIN', message: 'El PIN debe tener entre 4 y 8 dígitos.' });
      return;
    }
    const lineaProvided = Object.prototype.hasOwnProperty.call(req.body, 'linea_asignada_id');
    const lineaId = lineaProvided ? await resolveLine(req.body.linea_asignada_id) : null;

    await pool.query(
      `UPDATE usuarios SET
         nombre_completo = COALESCE($2, nombre_completo),
         turno = COALESCE($3, turno),
         pin_hash = CASE WHEN $4::text IS NULL THEN pin_hash ELSE crypt($4, gen_salt('bf', 10)) END,
         password_hash = CASE WHEN $5::text IS NULL THEN password_hash ELSE crypt($5, gen_salt('bf', 10)) END,
         linea_asignada_id = CASE WHEN $6 THEN $7::uuid ELSE linea_asignada_id END,
         updated_at = NOW()
       WHERE id::text = $1;`,
      [id, nombre, turno, pin, password, lineaProvided, lineaId]
    );
    const updated = await pool.query(
      `SELECT ${USER_COLUMNS} FROM usuarios u LEFT JOIN lineas_produccion l ON l.id = u.linea_asignada_id WHERE u.id::text = $1;`,
      [id]
    );
    res.json(updated.rows[0]);
  } catch (error) {
    console.error('[users] Error al actualizar usuario:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Error al actualizar el usuario.' });
  }
}

export async function deactivateUser(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    if (req.user?.id === id) {
      res.status(400).json({ error: 'SELF_DELETE', message: 'No puedes darte de baja a ti mismo.' });
      return;
    }
    const target = await pool.query(`SELECT rol FROM usuarios WHERE id::text = $1 AND activo = TRUE;`, [id]);
    if (target.rows.length === 0) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Usuario no encontrado.' });
      return;
    }
    if (target.rows[0].rol !== 'operador' && req.user?.rol !== 'superadmin') {
      res.status(403).json({ error: 'FORBIDDEN_ROLE', message: 'Solo el superadmin puede dar de baja administradores.' });
      return;
    }
    await pool.query(`UPDATE usuarios SET activo = FALSE, updated_at = NOW() WHERE id::text = $1;`, [id]);
    res.json({ message: 'Usuario dado de baja.' });
  } catch (error) {
    console.error('[users] Error al dar de baja usuario:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Error al dar de baja el usuario.' });
  }
}
