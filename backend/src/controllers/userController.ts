import { Request, Response } from 'express';
import { pool } from '../db';
import { olvidarUsuarioEnCache } from '../middlewares/authMiddleware';
import { registrarEvento } from '../services/eventosSeguridad';

const TURNOS = ['Jornada Continua', 'Mañana', 'Tarde', 'Noche'];

const USER_COLUMNS = `
  u.id, u.codigo_empleado, u.nombre_completo, u.primer_nombre, u.segundo_nombre,
  u.primer_apellido, u.segundo_apellido, u.cedula, u.rol, u.turno,
  u.linea_asignada_id, l.codigo AS linea_codigo, u.activo, u.created_at`;

/*
 * Nombres y cédula. Primer nombre y primer apellido son obligatorios; los segundos, opcionales.
 * nombre_completo se arma solo (es el que se muestra en lotes, reportes y bitácora).
 * La cédula se guarda solo con dígitos (se quitan puntos y espacios) y no se puede repetir.
 */
interface PartesNombre {
  primer_nombre: string | null;
  segundo_nombre: string | null;
  primer_apellido: string | null;
  segundo_apellido: string | null;
}
const CAMPOS_NOMBRE: (keyof PartesNombre)[] = ['primer_nombre', 'segundo_nombre', 'primer_apellido', 'segundo_apellido'];
const NOMBRE_VALIDO = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ' .-]{2,60}$/;
const limpiarTexto = (v: unknown): string | null => {
  const t = String(v ?? '').replace(/\s+/g, ' ').trim();
  return t ? t.slice(0, 60) : null;
};
const unirNombre = (p: PartesNombre): string =>
  [p.primer_nombre, p.segundo_nombre, p.primer_apellido, p.segundo_apellido].filter(Boolean).join(' ').slice(0, 120);

/** Devuelve el mensaje de error, o null si los nombres son válidos. */
function errorNombres(p: PartesNombre): string | null {
  if (!p.primer_nombre) return 'El primer nombre es obligatorio.';
  if (!p.primer_apellido) return 'El primer apellido es obligatorio.';
  for (const campo of CAMPOS_NOMBRE) {
    const v = p[campo];
    if (v && !NOMBRE_VALIDO.test(v)) {
      return `"${v}" no es válido: use solo letras (mínimo 2), espacios, guion o apóstrofo.`;
    }
  }
  return null;
}

/** Compatibilidad: si solo llega nombre_completo, primera palabra = nombre, el resto = apellido. */
function partesDesdeCompleto(completo: unknown): PartesNombre {
  const t = limpiarTexto(String(completo ?? '').slice(0, 120)) ?? '';
  const [primero, ...resto] = t.split(' ');
  return { primer_nombre: primero || null, segundo_nombre: null, primer_apellido: limpiarTexto(resto.join(' ')), segundo_apellido: null };
}

const normalizarCedula = (v: unknown): string => String(v ?? '').replace(/[\s.\-]/g, '');
const cedulaValida = (c: string): boolean => /^\d{5,12}$/.test(c);

async function mensajeCedulaRepetida(cedula: string): Promise<string> {
  const { rows } = await pool.query(`SELECT codigo_empleado, activo FROM usuarios WHERE cedula = $1;`, [cedula]);
  if (!rows[0]) return 'Ya existe un usuario con esa cédula.';
  return rows[0].activo
    ? `La cédula ya está registrada para el usuario ${rows[0].codigo_empleado}.`
    : `La cédula pertenece a ${rows[0].codigo_empleado}, que está dado de baja: reactívelo en lugar de crear uno nuevo.`;
}

// Código de empleado: letras sin tilde, números y guion; de 2 a 30 caracteres (se guarda en mayúsculas).
const CODIGO_VALIDO = /^[A-Z0-9-]{2,30}$/;
const MENSAJE_CODIGO = 'El código de empleado debe tener de 2 a 30 caracteres: solo letras (sin tildes ni Ñ), números y guion, sin espacios.';
const normalizarCodigo = (v: unknown): string => String(v ?? '').trim().toUpperCase();

// El ingreso no distingue mayúsculas, así que tampoco puede haber dos códigos que solo difieran en eso.
async function codigoOcupado(codigo: string, excluirId: string | null): Promise<boolean> {
  const { rows } = await pool.query(
    `SELECT 1 FROM usuarios WHERE UPPER(TRIM(codigo_empleado)) = $1 AND ($2::text IS NULL OR id::text <> $2) LIMIT 1;`,
    [codigo, excluirId]
  );
  return rows.length > 0;
}

async function mensajeCodigoRepetido(codigo: string): Promise<string> {
  const { rows } = await pool.query(`SELECT activo FROM usuarios WHERE UPPER(TRIM(codigo_empleado)) = $1 LIMIT 1;`, [codigo]);
  if (rows[0] && rows[0].activo === false) {
    return `El código ${codigo} pertenece a un usuario dado de baja: use otro código (por ejemplo ${codigo}2) o reactive ese usuario.`;
  }
  return `El código ${codigo} ya está en uso por otro usuario. Use uno diferente (por ejemplo ${codigo}2).`;
}

async function resolveLine(identifier: unknown): Promise<string | null> {
  if (!identifier) return null;
  const res = await pool.query(
    `SELECT id FROM lineas_produccion WHERE id::text = $1 OR codigo = $1 LIMIT 1;`,
    [String(identifier)]
  );
  return res.rows[0]?.id ?? null;
}

export async function listUsers(req: Request, res: Response): Promise<void> {
  try {
    const inactivos = req.query.estado === 'inactivos';
    if (inactivos && req.user?.rol === 'operador') {
      res.status(403).json({ error: 'FORBIDDEN_ROLE', message: 'Tu rol no tiene permiso para esta acción.' });
      return;
    }
    const { rows } = await pool.query(
      `SELECT ${USER_COLUMNS}
       FROM usuarios u LEFT JOIN lineas_produccion l ON l.id = u.linea_asignada_id
       WHERE u.activo = $1
       ORDER BY u.rol, u.nombre_completo;`,
      [!inactivos]
    );
    // La cédula es un dato personal: solo la ven administradores y superadmin.
    if (req.user?.rol === 'operador') {
      for (const r of rows) delete r.cedula;
    }
    res.json(rows);
  } catch (error) {
    console.error('[users] Error al listar usuarios:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Error al listar usuarios.' });
  }
}

/**
 * PIN numérico: los operarios usan de 3 a 8 dígitos (pedido de planta: fácil de recordar);
 * administradores y superadmin conservan el mínimo de 4 dígitos.
 */
const PIN_MIN_OPERARIO = 3;
const PIN_MIN_ADMIN = 4;
const pinMinimo = (rol: unknown): number => (rol === 'operador' ? PIN_MIN_OPERARIO : PIN_MIN_ADMIN);
const pinValido = (pin: string, rol: unknown): boolean => new RegExp(`^\\d{${pinMinimo(rol)},8}$`).test(pin);
const mensajePin = (rol: unknown): string => `El PIN debe tener entre ${pinMinimo(rol)} y 8 dígitos.`;

/**
 * Cambio de la propia clave: se exige la contraseña o el PIN actual. Tras 5 intentos fallidos
 * el cambio queda bloqueado 15 minutos para ese usuario (evita adivinar el PIN con una sesión abierta).
 */
const CLAVE_ACTUAL_MAX_FALLOS = 5;
const CLAVE_ACTUAL_BLOQUEO_MS = 15 * 60 * 1000;
const fallosClaveActual = new Map<string, { count: number; resetAt: number }>();

async function verificarClaveActual(id: string, claveActual: unknown, req: Request, res: Response): Promise<boolean> {
  const ahora = Date.now();
  const registro = fallosClaveActual.get(id);
  if (registro && registro.resetAt > ahora && registro.count >= CLAVE_ACTUAL_MAX_FALLOS) {
    const min = Math.max(1, Math.ceil((registro.resetAt - ahora) / 60000));
    res.status(429).json({ error: 'TOO_MANY_ATTEMPTS', message: `Demasiados intentos con la clave actual. Intenta de nuevo en ${min} min.` });
    return false;
  }
  const actual = String(claveActual ?? '').trim();
  if (!actual) {
    res.status(400).json({ error: 'CURRENT_REQUIRED', message: 'Escribe tu contraseña o PIN actual para cambiar tu clave.' });
    return false;
  }
  const ok = await pool.query(
    `SELECT 1 FROM usuarios
     WHERE id::text = $1 AND (password_hash = crypt($2, password_hash) OR pin_hash = crypt($2, pin_hash));`,
    [id, actual]
  );
  if (ok.rows.length === 0) {
    const vigente = registro && registro.resetAt > ahora ? registro : { count: 0, resetAt: ahora + CLAVE_ACTUAL_BLOQUEO_MS };
    vigente.count += 1;
    fallosClaveActual.set(id, vigente);
    void registrarEvento({ evento: 'CLAVE_ACTUAL_INCORRECTA', usuarioId: id, req, detalle: `Intento ${vigente.count} de ${CLAVE_ACTUAL_MAX_FALLOS}` });
    res.status(400).json({ error: 'WRONG_CURRENT', message: 'La contraseña o PIN actual no es correcto.' });
    return false;
  }
  fallosClaveActual.delete(id);
  return true;
}

export async function createUser(req: Request, res: Response): Promise<void> {
  try {
    const traePartes = CAMPOS_NOMBRE.some((c) => Object.prototype.hasOwnProperty.call(req.body, c));
    const partes: PartesNombre = traePartes
      ? {
          primer_nombre: limpiarTexto(req.body.primer_nombre),
          segundo_nombre: limpiarTexto(req.body.segundo_nombre),
          primer_apellido: limpiarTexto(req.body.primer_apellido),
          segundo_apellido: limpiarTexto(req.body.segundo_apellido),
        }
      : partesDesdeCompleto(req.body.nombre_completo);
    const nombre = unirNombre(partes);
    const cedula = normalizarCedula(req.body.cedula);
    const codigo = normalizarCodigo(req.body.codigo_empleado);
    const pin = String(req.body.pin ?? '').trim();
    const passwordInput = String(req.body.password ?? '').trim();
    const password = passwordInput || pin;
    const turno = TURNOS.includes(req.body.turno) ? req.body.turno : 'Jornada Continua';
    const rolSolicitado = req.body.rol === 'administrador' ? 'administrador' : 'operador';

    if (rolSolicitado === 'administrador' && req.user?.rol !== 'superadmin') {
      res.status(403).json({ error: 'FORBIDDEN_ROLE', message: 'Solo el superadmin puede crear administradores.' });
      return;
    }
    const errNombre = errorNombres(partes);
    if (errNombre) {
      res.status(400).json({ error: 'INVALID_NAME', message: errNombre });
      return;
    }
    if (!cedulaValida(cedula)) {
      res.status(400).json({ error: 'INVALID_CEDULA', message: 'La cédula es obligatoria: solo números, entre 5 y 12 dígitos.' });
      return;
    }
    if (!codigo) {
      res.status(400).json({ error: 'MISSING_FIELDS', message: 'El código de empleado es obligatorio.' });
      return;
    }
    if (!CODIGO_VALIDO.test(codigo)) {
      res.status(400).json({ error: 'INVALID_CODE', message: MENSAJE_CODIGO });
      return;
    }
    if (await codigoOcupado(codigo, null)) {
      res.status(409).json({ error: 'DUPLICATE_CODE', message: await mensajeCodigoRepetido(codigo) });
      return;
    }
    if (!pinValido(pin, rolSolicitado)) {
      res.status(400).json({ error: 'INVALID_PIN', message: mensajePin(rolSolicitado) });
      return;
    }
    if (rolSolicitado === 'administrador' && (passwordInput.length < 8 || passwordInput === pin)) {
      res.status(400).json({ error: 'INVALID_PASSWORD', message: 'Los administradores requieren una contraseña de al menos 8 caracteres, distinta del PIN.' });
      return;
    }

    const lineaId = await resolveLine(req.body.linea_asignada_id);
    const { rows } = await pool.query(
      `INSERT INTO usuarios (codigo_empleado, nombre_completo, primer_nombre, segundo_nombre, primer_apellido,
                             segundo_apellido, cedula, rol, turno, pin_hash, password_hash, linea_asignada_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, crypt($10, gen_salt('bf', 10)), crypt($11, gen_salt('bf', 10)), $12)
       RETURNING id;`,
      [
        codigo, nombre, partes.primer_nombre, partes.segundo_nombre, partes.primer_apellido, partes.segundo_apellido,
        cedula, rolSolicitado, turno, pin, password, lineaId,
      ]
    );
    const created = await pool.query(
      `SELECT ${USER_COLUMNS} FROM usuarios u LEFT JOIN lineas_produccion l ON l.id = u.linea_asignada_id WHERE u.id = $1;`,
      [rows[0].id]
    );
    void registrarEvento({
      evento: 'USUARIO_CREADO',
      usuarioId: rows[0].id,
      codigo,
      actorId: req.user?.id,
      detalle: `Rol: ${rolSolicitado}`,
      req,
    });
    res.status(201).json(created.rows[0]);
  } catch (error: any) {
    if (error.code === '23505') {
      if (String(error.constraint ?? '').includes('cedula')) {
        res.status(409).json({ error: 'DUPLICATE_CEDULA', message: await mensajeCedulaRepetida(normalizarCedula(req.body.cedula)) });
        return;
      }
      res.status(409).json({ error: 'DUPLICATE_CODE', message: await mensajeCodigoRepetido(normalizarCodigo(req.body.codigo_empleado)) });
      return;
    }
    console.error('[users] Error al crear usuario:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Error al crear el usuario.' });
  }
}

export async function updateUser(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const target = await pool.query(
      `SELECT rol, nombre_completo, codigo_empleado, cedula, primer_nombre, segundo_nombre, primer_apellido, segundo_apellido
       FROM usuarios WHERE id::text = $1 AND activo = TRUE;`,
      [id]
    );
    if (target.rows.length === 0) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Usuario no encontrado.' });
      return;
    }
    if (target.rows[0].rol !== 'operador' && req.user?.rol !== 'superadmin' && req.user?.id !== id) {
      res.status(403).json({ error: 'FORBIDDEN_ROLE', message: 'Solo el superadmin puede editar administradores.' });
      return;
    }

    // Nombres: se toman los que lleguen y se conservan los demás. Un segundo nombre/apellido
    // enviado vacío se borra; el primero no puede quedar vacío.
    const actual = target.rows[0];
    const traePartes = CAMPOS_NOMBRE.some((c) => Object.prototype.hasOwnProperty.call(req.body, c));
    let partes: PartesNombre | null = null;
    if (traePartes) {
      partes = { ...(actual as PartesNombre) };
      for (const c of CAMPOS_NOMBRE) {
        if (Object.prototype.hasOwnProperty.call(req.body, c)) partes[c] = limpiarTexto(req.body[c]);
      }
    } else if (req.body.nombre_completo) {
      partes = partesDesdeCompleto(req.body.nombre_completo);
    }
    if (partes) {
      const errNombre = errorNombres(partes);
      if (errNombre) {
        res.status(400).json({ error: 'INVALID_NAME', message: errNombre });
        return;
      }
    }
    const nombre = partes ? unirNombre(partes) : null;
    const traeCedula = Object.prototype.hasOwnProperty.call(req.body, 'cedula');
    const cedula = traeCedula ? normalizarCedula(req.body.cedula) : null;
    if (traeCedula && !cedulaValida(cedula as string)) {
      res.status(400).json({ error: 'INVALID_CEDULA', message: 'La cédula debe tener solo números, entre 5 y 12 dígitos.' });
      return;
    }
    // Código de empleado: solo se toca si llega y es distinto del actual.
    const codigoNuevo = Object.prototype.hasOwnProperty.call(req.body, 'codigo_empleado')
      ? normalizarCodigo(req.body.codigo_empleado)
      : null;
    const cambiaCodigo = codigoNuevo !== null && codigoNuevo !== String(actual.codigo_empleado).toUpperCase();
    if (cambiaCodigo && !CODIGO_VALIDO.test(codigoNuevo as string)) {
      res.status(400).json({ error: 'INVALID_CODE', message: MENSAJE_CODIGO });
      return;
    }
    if (cambiaCodigo && (await codigoOcupado(codigoNuevo as string, id))) {
      res.status(409).json({ error: 'DUPLICATE_CODE', message: await mensajeCodigoRepetido(codigoNuevo as string) });
      return;
    }
    const turno = TURNOS.includes(req.body.turno) ? req.body.turno : null;
    const pin = req.body.pin ? String(req.body.pin).trim() : null;
    const rolDestino = target.rows[0].rol;
    if (pin && !pinValido(pin, rolDestino)) {
      res.status(400).json({ error: 'INVALID_PIN', message: mensajePin(rolDestino) });
      return;
    }
    // Cambiar la propia clave exige la actual (si alguien deja la sesión abierta, otro no puede cambiarla).
    const cambiaClave = Boolean(pin) || Boolean(req.body.password && String(req.body.password).trim());
    if (cambiaClave && req.user?.id === id && !(await verificarClaveActual(id, req.body.clave_actual, req, res))) {
      return;
    }
    // Operarios: el PIN es su única clave. Al restablecerlo se reemplaza también la contraseña
    // (que al crearlos sin contraseña quedó igual al PIN) para que el PIN anterior deje de servir.
    const passwordInput = req.body.password ? String(req.body.password).trim() : null;
    if (passwordInput && rolDestino !== 'operador' && (passwordInput.length < 8 || passwordInput === pin)) {
      res.status(400).json({ error: 'INVALID_PASSWORD', message: 'La contraseña de un administrador debe tener al menos 8 caracteres y ser distinta del PIN.' });
      return;
    }
    const password = passwordInput ?? (pin && rolDestino === 'operador' ? pin : null);
    const lineaProvided = Object.prototype.hasOwnProperty.call(req.body, 'linea_asignada_id');
    const lineaId = lineaProvided ? await resolveLine(req.body.linea_asignada_id) : null;

    await pool.query(
      `UPDATE usuarios SET
         nombre_completo = COALESCE($2, nombre_completo),
         primer_nombre = CASE WHEN $9 THEN $10 ELSE primer_nombre END,
         segundo_nombre = CASE WHEN $9 THEN $11 ELSE segundo_nombre END,
         primer_apellido = CASE WHEN $9 THEN $12 ELSE primer_apellido END,
         segundo_apellido = CASE WHEN $9 THEN $13 ELSE segundo_apellido END,
         cedula = COALESCE($14, cedula),
         turno = COALESCE($3, turno),
         pin_hash = CASE WHEN $4::text IS NULL THEN pin_hash ELSE crypt($4, gen_salt('bf', 10)) END,
         password_hash = CASE WHEN $5::text IS NULL THEN password_hash ELSE crypt($5, gen_salt('bf', 10)) END,
         linea_asignada_id = CASE WHEN $6 THEN $7::uuid ELSE linea_asignada_id END,
         codigo_empleado = COALESCE($15, codigo_empleado),
         sesiones_desde = CASE WHEN $8 THEN NOW() ELSE sesiones_desde END,
         updated_at = NOW()
       WHERE id::text = $1;`,
      // Si otra persona le restablece la clave o le cambia el código, sus sesiones abiertas se
      // cierran (las propias no) para que vuelva a entrar con los datos nuevos.
      [
        id, nombre, turno, pin, password, lineaProvided, lineaId, Boolean(pin || password || cambiaCodigo) && req.user?.id !== id,
        Boolean(partes), partes?.primer_nombre ?? null, partes?.segundo_nombre ?? null,
        partes?.primer_apellido ?? null, partes?.segundo_apellido ?? null, cedula,
        cambiaCodigo ? codigoNuevo : null,
      ]
    );
    const updated = await pool.query(
      `SELECT ${USER_COLUMNS} FROM usuarios u LEFT JOIN lineas_produccion l ON l.id = u.linea_asignada_id WHERE u.id::text = $1;`,
      [id]
    );
    olvidarUsuarioEnCache(id);
    // Bitácora: qué cambió (nunca el valor de la clave).
    const codigoDestino = cambiaCodigo ? (codigoNuevo as string) : target.rows[0].codigo_empleado;
    if (cambiaCodigo) {
      void registrarEvento({
        evento: 'USUARIO_EDITADO',
        usuarioId: id,
        codigo: codigoDestino,
        actorId: req.user?.id,
        detalle: `Código: ${actual.codigo_empleado} → ${codigoNuevo}`,
        req,
      });
    }
    const esPropia = req.user?.id === id;
    if (pin || passwordInput) {
      const que = pin && passwordInput ? 'PIN y contraseña' : pin ? 'PIN' : 'Contraseña';
      void registrarEvento({
        evento: esPropia ? 'CLAVE_CAMBIADA' : 'CLAVE_RESTABLECIDA',
        usuarioId: id,
        codigo: codigoDestino,
        actorId: req.user?.id,
        detalle: que,
        req,
      });
    }
    if (cedula && cedula !== actual.cedula) {
      void registrarEvento({
        evento: 'USUARIO_EDITADO',
        usuarioId: id,
        codigo: codigoDestino,
        actorId: req.user?.id,
        detalle: actual.cedula ? 'Cédula corregida' : 'Cédula registrada',
        req,
      });
    }
    if (nombre && nombre !== target.rows[0].nombre_completo) {
      void registrarEvento({
        evento: 'USUARIO_EDITADO',
        usuarioId: id,
        codigo: codigoDestino,
        actorId: req.user?.id,
        detalle: `Nombre: ${target.rows[0].nombre_completo} → ${nombre}`,
        req,
      });
    }
    res.json(updated.rows[0]);
  } catch (error: any) {
    if (error?.code === '23505' && String(error.constraint ?? '').includes('cedula')) {
      res.status(409).json({ error: 'DUPLICATE_CEDULA', message: await mensajeCedulaRepetida(normalizarCedula(req.body.cedula)) });
      return;
    }
    if (error?.code === '23505') {
      res.status(409).json({ error: 'DUPLICATE_CODE', message: await mensajeCodigoRepetido(normalizarCodigo(req.body.codigo_empleado)) });
      return;
    }
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
    const target = await pool.query(`SELECT rol, codigo_empleado FROM usuarios WHERE id::text = $1 AND activo = TRUE;`, [id]);
    if (target.rows.length === 0) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Usuario no encontrado.' });
      return;
    }
    if (target.rows[0].rol !== 'operador' && req.user?.rol !== 'superadmin') {
      res.status(403).json({ error: 'FORBIDDEN_ROLE', message: 'Solo el superadmin puede dar de baja administradores.' });
      return;
    }
    await pool.query(`UPDATE usuarios SET activo = FALSE, sesiones_desde = NOW(), updated_at = NOW() WHERE id::text = $1;`, [id]);
    olvidarUsuarioEnCache(id);
    void registrarEvento({ evento: 'USUARIO_BAJA', usuarioId: id, codigo: target.rows[0].codigo_empleado, actorId: req.user?.id, req });
    res.json({ message: 'Usuario dado de baja.' });
  } catch (error) {
    console.error('[users] Error al dar de baja usuario:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Error al dar de baja el usuario.' });
  }
}

export async function reactivateUser(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const target = await pool.query(`SELECT rol, codigo_empleado FROM usuarios WHERE id::text = $1 AND activo = FALSE;`, [id]);
    if (target.rows.length === 0) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Usuario inactivo no encontrado.' });
      return;
    }
    if (target.rows[0].rol !== 'operador' && req.user?.rol !== 'superadmin') {
      res.status(403).json({ error: 'FORBIDDEN_ROLE', message: 'Solo el superadmin puede reactivar administradores.' });
      return;
    }
    const newPin = String(req.body?.pin ?? '').trim();
    const rolDestino = target.rows[0].rol;
    if (!pinValido(newPin, rolDestino)) {
      res.status(400).json({ error: 'INVALID_PIN', message: `Al reactivar debes asignar un PIN nuevo de ${pinMinimo(rolDestino)} a 8 dígitos.` });
      return;
    }
    // Operarios: la contraseña queda igual al PIN nuevo. Administradores: se exige una contraseña
    // propia (mínimo 8, distinta del PIN), igual que al crearlos.
    let newPassword = newPin;
    if (rolDestino !== 'operador') {
      newPassword = String(req.body?.password ?? '').trim();
      if (newPassword.length < 8 || newPassword === newPin) {
        res.status(400).json({ error: 'INVALID_PASSWORD', message: 'Al reactivar un administrador debes asignar una contraseña de al menos 8 caracteres, distinta del PIN.' });
        return;
      }
    }
    await pool.query(
      `UPDATE usuarios SET activo = TRUE, pin_hash = crypt($2, gen_salt('bf', 10)), password_hash = crypt($3, gen_salt('bf', 10)), sesiones_desde = NOW(), updated_at = NOW() WHERE id::text = $1;`,
      [id, newPin, newPassword]
    );
    olvidarUsuarioEnCache(id);
    void registrarEvento({ evento: 'USUARIO_REACTIVADO', usuarioId: id, codigo: target.rows[0].codigo_empleado, actorId: req.user?.id, req });
    res.json({ message: 'Usuario reactivado.' });
  } catch (error) {
    console.error('[users] Error al reactivar usuario:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Error al reactivar el usuario.' });
  }
}
