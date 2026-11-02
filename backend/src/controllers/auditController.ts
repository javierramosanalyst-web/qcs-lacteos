import { Request, Response } from 'express';
import { PoolClient } from 'pg';
import { pool } from '../db';

/** Lista blanca estricta de tablas y campos rectificables para prevenir SQL Injection */
const RECTIFIABLE_WHITELIST: Record<string, string[]> = {
  mediciones_fisicoquimicas: ['valor_numerico'],
  lote_insumos_utilizados: ['cantidad_utilizada', 'peso_inicial_gramos', 'peso_final_gramos'],
  lote_presentaciones_envasado: ['unidades_conteo'],
  lote_etapas_ejecucion: ['duracion_segundos', 'observaciones'],
  lotes_produccion: ['volumen_leche_base_litros', 'temp_almacenamiento_celsius', 'observaciones_finales'],
  lotes_padre: ['total_leche_litros', 'observaciones'],
  lote_padre_recepcion: ['temperatura_recepcion_celsius', 'acidez_dornic', 'ph_recepcion'],
  lote_derivaciones_quesos: ['peso_pasta_utilizado_kg'],
};

/**
 * POST /api/batches/:batchId/rectifications
 * Permite a Administradores o Superadmins rectificar un dato en lotes cerrados (o en curso)
 * ejecutando `SET LOCAL app.allow_admin_override = 'true'` y registrando la pista en auditoria_rectificaciones.
 */
export async function createBatchRectification(req: Request, res: Response): Promise<void> {
  const admin = req.user;
  if (!admin || !['administrador', 'superadmin'].includes(admin.rol)) {
    res.status(403).json({
      error: 'FORBIDDEN_ROLE',
      message: 'Solo Administrador o Superadmin pueden autorizar rectificaciones en lotes.',
    });
    return;
  }

  const { batchId } = req.params;
  const {
    tabla_destino,
    tablaDestino,
    registro_destino_id,
    registroDestinoId,
    campo_modificado,
    campoModificado,
    campo,
    campo_label,
    campoLabel,
    etapa_codigo,
    etapaCodigo,
    etapa_label,
    etapaLabel,
    nuevo_valor,
    nuevoValor,
    unidad,
    categoria_motivo,
    categoriaMotivo,
    justificacion_tecnica,
    justificacionTecnica,
    justificacion,
  } = req.body;

  const targetTable = (tabla_destino ?? tablaDestino ?? '').trim().toLowerCase();
  const targetRecordId = (registro_destino_id ?? registroDestinoId ?? '').trim();
  const targetField = (campo_modificado ?? campoModificado ?? campo ?? '').trim();
  const fieldLabel = (campo_label ?? campoLabel ?? targetField).trim();
  const stageCode = etapa_codigo ?? etapaCodigo ?? null;
  const stageLabel = etapa_label ?? etapaLabel ?? null;
  const newValue = nuevo_valor ?? nuevoValor;
  const unit = unidad ?? null;
  const reasonCategory = (categoria_motivo ?? categoriaMotivo ?? 'Ajuste operativo / Error de digitación').trim();
  const technicalJustification = (justificacion_tecnica ?? justificacionTecnica ?? justificacion ?? '').trim();

  // Validaciones
  if (!targetTable || !targetRecordId || !targetField || newValue === undefined || newValue === null) {
    res.status(400).json({
      error: 'MISSING_FIELDS',
      message: 'Faltan campos obligatorios: tabla_destino, registro_destino_id, campo_modificado, nuevo_valor.',
    });
    return;
  }

  if (technicalJustification.length < 15) {
    res.status(400).json({
      error: 'INVALID_JUSTIFICATION',
      message: 'La justificación técnica es obligatoria y debe tener al menos 15 caracteres.',
    });
    return;
  }

  const allowedFields = RECTIFIABLE_WHITELIST[targetTable];
  if (!allowedFields || !allowedFields.includes(targetField)) {
    res.status(422).json({
      error: 'FIELD_NOT_RECTIFIABLE',
      message: `El campo '${targetField}' en la tabla '${targetTable}' no está en la lista blanca de rectificación.`,
    });
    return;
  }

  const client: PoolClient = await pool.connect();
  try {
    // Resolver si batchId pertenece a lotes_produccion o lotes_padre
    let loteProduccionId: string | null = null;
    let lotePadreId: string | null = null;

    const childRes = await client.query(
      `SELECT id FROM lotes_produccion WHERE id::text = $1 OR codigo_lote = $1 LIMIT 1;`,
      [batchId]
    );

    if (childRes.rows.length > 0) {
      loteProduccionId = childRes.rows[0].id;
    } else {
      const parentRes = await client.query(
        `SELECT id FROM lotes_padre WHERE id::text = $1 OR codigo_lote = $1 LIMIT 1;`,
        [batchId]
      );
      if (parentRes.rows.length > 0) {
        lotePadreId = parentRes.rows[0].id;
      } else {
        res.status(404).json({ error: 'BATCH_NOT_FOUND', message: `Lote '${batchId}' no encontrado.` });
        return;
      }
    }

    // 1) BEGIN
    await client.query('BEGIN');

    // 2) Habilitar override administrativo temporalmente en la transacción
    await client.query("SET LOCAL app.allow_admin_override = 'true'");

    // 3) Consultar valor actual
    const readSql = `SELECT "${targetField}" AS valor_anterior FROM "${targetTable}" WHERE id = $1 LIMIT 1;`;
    const readRes = await client.query(readSql, [targetRecordId]);

    if (readRes.rows.length === 0) {
      await client.query('ROLLBACK');
      res.status(404).json({
        error: 'TARGET_RECORD_NOT_FOUND',
        message: `El registro destino '${targetRecordId}' no existe en la tabla '${targetTable}'.`,
      });
      return;
    }

    const valorAnterior = String(readRes.rows[0].valor_anterior ?? '');
    const valorNuevoStr = String(newValue);

    // 4) Ejecutar UPDATE en la fila física
    const updateSql = `UPDATE "${targetTable}" SET "${targetField}" = $1 WHERE id = $2 RETURNING *;`;
    await client.query(updateSql, [newValue, targetRecordId]);

    // 5) INSERT INTO auditoria_rectificaciones (respetando chk_un_solo_lote)
    const auditSql = `
      INSERT INTO auditoria_rectificaciones (
        accion,
        lote_id,
        lote_padre_id,
        etapa_codigo,
        etapa_label,
        tabla_destino,
        registro_destino_id,
        campo_modificado,
        campo_label,
        valor_anterior,
        valor_nuevo,
        unidad,
        categoria_motivo,
        justificacion_tecnica,
        autorizado_por_id,
        ip_address
      ) VALUES (
        'RECTIFICACION',
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15
      ) RETURNING *;
    `;

    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || req.socket.remoteAddress || '127.0.0.1';

    const auditRes = await client.query(auditSql, [
      loteProduccionId,
      lotePadreId,
      stageCode,
      stageLabel,
      targetTable,
      targetRecordId,
      targetField,
      fieldLabel,
      valorAnterior,
      valorNuevoStr,
      unit,
      reasonCategory,
      technicalJustification,
      admin.id,
      ip,
    ]);

    // 6) COMMIT
    await client.query('COMMIT');

    res.status(200).json({
      message: 'Rectificación autorizada y registrada en la bitácora de auditoría.',
      auditLog: auditRes.rows[0],
    });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('[audit] Error al aplicar rectificación:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message ?? 'Error al procesar rectificación.' });
  } finally {
    client.release();
  }
}

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
