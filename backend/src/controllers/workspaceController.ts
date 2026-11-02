import { normalizeBatchTraceability } from '../services/traceability';
import { Request, Response } from 'express';
import { PoolClient } from 'pg';
import { pool } from '../db';

const STAGE_STATES = ['pendiente', 'en_proceso', 'completada'];

async function findLine(client: PoolClient, identifier: string) {
  const res = await client.query(
    `SELECT id, codigo, tipo_linea FROM lineas_produccion WHERE (id::text = $1 OR codigo = $1) LIMIT 1;`,
    [identifier]
  );
  return res.rows[0] as { id: string; codigo: string; tipo_linea: string } | undefined;
}

/** GET /api/workspace/:lineCode */
export async function getWorkspace(req: Request, res: Response): Promise<void> {
  const client = await pool.connect();
  try {
    const line = await findLine(client, req.params.lineCode);
    if (!line) {
      res.status(404).json({ error: 'LINE_NOT_FOUND', message: 'Línea no encontrada.' });
      return;
    }
    const ws = await client.query(
      `SELECT estado, version FROM espacio_trabajo_linea WHERE linea_id = $1;`,
      [line.id]
    );
    const drafts = await client.query(
      `SELECT b.producto_ui_id, b.estado, b.etapa_actual, b.version, b.lote_id,
              lp.codigo_lote, lp.estado AS lote_estado
       FROM borradores_lote b
       LEFT JOIN lotes_produccion lp ON lp.id = b.lote_id
       WHERE b.linea_id = $1;`,
      [line.id]
    );
    res.json({ line, workspace: ws.rows[0] ?? null, drafts: drafts.rows });
  } catch (error) {
    console.error('[workspace] Error al cargar espacio de trabajo:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Error al cargar el espacio de trabajo.' });
  } finally {
    client.release();
  }
}

/** PUT /api/workspace/:lineCode  { estado, version } */
export async function saveWorkspace(req: Request, res: Response): Promise<void> {
  const client = await pool.connect();
  try {
    const line = await findLine(client, req.params.lineCode);
    if (!line) {
      res.status(404).json({ error: 'LINE_NOT_FOUND', message: 'Línea no encontrada.' });
      return;
    }
    const version = Number(req.body.version ?? 0);
    await client.query('BEGIN');
    const current = await client.query(
      `SELECT estado, version FROM espacio_trabajo_linea WHERE linea_id = $1 FOR UPDATE;`,
      [line.id]
    );
    if (current.rows.length > 0 && current.rows[0].version !== version) {
      await client.query('ROLLBACK');
      res.status(409).json({ error: 'VERSION_CONFLICT', current: current.rows[0] });
      return;
    }
    const result = await client.query(
      `INSERT INTO espacio_trabajo_linea (linea_id, estado, version, actualizado_por_id)
       VALUES ($1, $2, 1, $3)
       ON CONFLICT (linea_id) DO UPDATE
         SET estado = EXCLUDED.estado, version = espacio_trabajo_linea.version + 1,
             actualizado_por_id = EXCLUDED.actualizado_por_id, updated_at = NOW()
       RETURNING version;`,
      [line.id, req.body.estado ?? {}, req.user?.id ?? null]
    );
    await client.query('COMMIT');
    res.json({ version: result.rows[0].version });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[workspace] Error al guardar espacio de trabajo:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Error al guardar el espacio de trabajo.' });
  } finally {
    client.release();
  }
}

async function createProductionBatch(
  client: PoolClient,
  params: {
    lineId: string;
    productCode: string;
    productUiId: string;
    userId: string;
    volumen: number;
    llevaAzucar: boolean;
    variante: string | null;
    estadoUi: unknown;
  }
): Promise<{ id: string; codigo_lote: string }> {
  const prod = await client.query(
    `SELECT id, codigo, norma_tecnica, nombre FROM productos WHERE codigo = $1 LIMIT 1;`,
    [params.productCode]
  );
  if (prod.rows.length === 0) throw new Error(`Producto '${params.productCode}' no existe en el catálogo.`);
  const product = prod.rows[0];

  const seq = await client.query(`SELECT nextval('seq_codigo_lote') AS n, to_char(NOW(), 'YYYYMMDD') AS d;`);
  const codigo = `${product.codigo}-${seq.rows[0].d}-${String(seq.rows[0].n).padStart(3, '0')}`;

  const recipe = await client.query(
    `SELECT especificaciones_json FROM recetas_estandares WHERE producto_id = $1 AND activo = TRUE ORDER BY version_receta DESC LIMIT 1;`,
    [product.id]
  );
  const receta = recipe.rows[0]?.especificaciones_json ?? {
    producto_codigo: product.codigo,
    estandar: product.nombre,
    norma: product.norma_tecnica,
  };

  const stages = await client.query(
    `SELECT id, codigo_ui FROM etapas_catalogo WHERE producto_id = $1 ORDER BY orden_secuencia;`,
    [product.id]
  );

  const inserted = await client.query(
    `INSERT INTO lotes_produccion (
       codigo_lote, producto_id, linea_id, responsable_id, norma_tecnica_aplicada, receta_snapshot,
       variante_fermentado, volumen_leche_base_litros, lleva_azucar, estado, etapa_actual_codigo,
       estado_ui, producto_ui_id
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'EN_PROCESO',$10,$11,$12)
     RETURNING id, codigo_lote;`,
    [
      codigo,
      product.id,
      params.lineId,
      params.userId,
      product.norma_tecnica,
      receta,
      params.variante,
      Math.max(0, params.volumen),
      params.llevaAzucar,
      stages.rows[0]?.codigo_ui ?? 'acidificar',
      params.estadoUi,
      params.productUiId,
    ]
  );
  const batch = inserted.rows[0];

  for (let i = 0; i < stages.rows.length; i++) {
    await client.query(
      `INSERT INTO lote_etapas_ejecucion (lote_id, etapa_catalogo_id, estado, iniciado_at, operario_responsable_id)
       VALUES ($1, $2, $3, $4, $5);`,
      [batch.id, stages.rows[i].id, i === 0 ? 'en_proceso' : 'pendiente', i === 0 ? new Date() : null, i === 0 ? params.userId : null]
    );
  }
  return batch;
}

async function syncBatch(
  client: PoolClient,
  loteId: string,
  userId: string,
  body: { estado: unknown; etapaActual?: string; volumen?: number; stageStatuses?: Record<string, string> }
): Promise<void> {
  await client.query(
    `UPDATE lotes_produccion SET
       estado_ui = $2,
       etapa_actual_codigo = COALESCE($3, etapa_actual_codigo),
       volumen_leche_base_litros = COALESCE($4, volumen_leche_base_litros),
       updated_at = NOW()
     WHERE id = $1 AND estado = 'EN_PROCESO';`,
    [loteId, body.estado, body.etapaActual ?? null, Number.isFinite(body.volumen) ? Math.max(0, Number(body.volumen)) : null]
  );

  const statuses = body.stageStatuses ?? {};
  for (const [codigoUi, estado] of Object.entries(statuses)) {
    if (!STAGE_STATES.includes(estado)) continue;
    await client.query(
      `UPDATE lote_etapas_ejecucion le SET
         estado = $3::estado_etapa_enum,
         iniciado_at = CASE WHEN $3 <> 'pendiente' THEN COALESCE(le.iniciado_at, NOW()) ELSE le.iniciado_at END,
         finalizado_at = CASE WHEN $3 = 'completada' THEN COALESCE(le.finalizado_at, NOW()) ELSE NULL END,
         duracion_segundos = CASE WHEN $3 = 'completada'
           THEN EXTRACT(EPOCH FROM (COALESCE(le.finalizado_at, NOW()) - COALESCE(le.iniciado_at, NOW())))::integer
           ELSE NULL END,
         operario_responsable_id = COALESCE(le.operario_responsable_id, $4),
         updated_at = NOW()
       FROM etapas_catalogo ec
       WHERE ec.id = le.etapa_catalogo_id AND le.lote_id = $1 AND ec.codigo_ui = $2
         AND le.estado::text <> $3;`,
      [loteId, codigoUi, estado, userId]
    );
  }

  await client.query(
    `INSERT INTO lote_operarios_intervinientes (lote_id, usuario_id, rol_en_proceso)
     VALUES ($1, $2, 'Operador de Etapa') ON CONFLICT (lote_id, usuario_id) DO NOTHING;`,
    [loteId, userId]
  );

  await client.query('SAVEPOINT trazabilidad');
  try {
    await normalizeBatchTraceability(client, loteId, userId, body.estado);
    await client.query('RELEASE SAVEPOINT trazabilidad');
  } catch (error) {
    await client.query('ROLLBACK TO SAVEPOINT trazabilidad');
    console.error('[workspace] Error al normalizar trazabilidad:', error);
  }
}

/**
 * PUT /api/workspace/drafts/:productUiId
 * Guarda el estado vivo del lote de un producto. Si `started` es true y aún no existe
 * el lote oficial, lo crea en lotes_produccion. Si `completed` es true, cierra el lote.
 */
export async function saveDraft(req: Request, res: Response): Promise<void> {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: 'UNAUTHENTICATED', message: 'No autenticado.' });
    return;
  }
  const { productUiId } = req.params;
  const {
    lineCode,
    productCode,
    estado,
    etapaActual,
    stageStatuses,
    version,
    started,
    completed,
    volumen,
    llevaAzucar,
    variante,
    elapsedSeconds,
    observaciones,
  } = req.body;

  if (!lineCode || !productCode || estado === undefined) {
    res.status(400).json({ error: 'MISSING_FIELDS', message: 'lineCode, productCode y estado son obligatorios.' });
    return;
  }

  const client = await pool.connect();
  try {
    const line = await findLine(client, String(lineCode));
    if (!line) {
      res.status(404).json({ error: 'LINE_NOT_FOUND', message: 'Línea no encontrada.' });
      return;
    }

    await client.query('BEGIN');
    const currentRes = await client.query(
      `SELECT b.*, lp.codigo_lote FROM borradores_lote b
       LEFT JOIN lotes_produccion lp ON lp.id = b.lote_id
       WHERE b.producto_ui_id = $1 FOR UPDATE OF b;`,
      [productUiId]
    );
    const current = currentRes.rows[0];

    if (current && current.version !== Number(version ?? 0)) {
      await client.query('ROLLBACK');
      res.status(409).json({
        error: 'VERSION_CONFLICT',
        current: {
          estado: current.estado,
          version: current.version,
          lote_id: current.lote_id,
          codigo_lote: current.codigo_lote,
          etapa_actual: current.etapa_actual,
        },
      });
      return;
    }

    let loteId: string | null = current?.lote_id ?? null;
    let codigoLote: string | null = current?.codigo_lote ?? null;

    if ((started || completed) && !loteId) {
      const created = await createProductionBatch(client, {
        lineId: line.id,
        productCode: String(productCode),
        productUiId,
        userId,
        volumen: Number(volumen) || 0,
        llevaAzucar: llevaAzucar !== false,
        variante: variante ?? null,
        estadoUi: estado,
      });
      loteId = created.id;
      codigoLote = created.codigo_lote;
    }

    if (loteId) {
      await syncBatch(client, loteId, userId, { estado, etapaActual, volumen: Number(volumen), stageStatuses });
    }

    if (completed && loteId) {
      await client.query(
        `UPDATE lotes_produccion SET
           estado = 'COMPLETADO',
           finalizado_at = NOW(),
           motivo_cierre = 'CUARTO_FRIO',
           ingreso_cuarto_frio_at = NOW(),
           temp_almacenamiento_celsius = COALESCE(temp_almacenamiento_celsius, 4.0),
           observaciones_finales = COALESCE($2, observaciones_finales),
           duracion_total_segundos = COALESCE($3, EXTRACT(EPOCH FROM (NOW() - iniciado_at))::integer),
           updated_at = NOW()
         WHERE id = $1 AND estado = 'EN_PROCESO';`,
        [loteId, observaciones ? String(observaciones) : null, Number.isFinite(Number(elapsedSeconds)) && Number(elapsedSeconds) > 0 ? Math.round(Number(elapsedSeconds)) : null]
      );
      await client.query(`DELETE FROM borradores_lote WHERE producto_ui_id = $1;`, [productUiId]);
      await client.query('COMMIT');
      res.json({ completed: true, lote_id: loteId, codigo_lote: codigoLote, version: 0 });
      return;
    }

    const saved = await client.query(
      `INSERT INTO borradores_lote (producto_ui_id, linea_id, estado, etapa_actual, version, lote_id, actualizado_por_id)
       VALUES ($1, $2, $3, COALESCE($4, 'acidificar'), 1, $5, $6)
       ON CONFLICT (producto_ui_id) DO UPDATE SET
         estado = EXCLUDED.estado,
         etapa_actual = EXCLUDED.etapa_actual,
         lote_id = EXCLUDED.lote_id,
         version = borradores_lote.version + 1,
         actualizado_por_id = EXCLUDED.actualizado_por_id,
         updated_at = NOW()
       RETURNING version;`,
      [productUiId, line.id, estado, etapaActual ?? null, loteId, userId]
    );
    await client.query('COMMIT');
    res.json({ version: saved.rows[0].version, lote_id: loteId, codigo_lote: codigoLote });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('[workspace] Error al guardar lote:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message ?? 'Error al guardar el lote.' });
  } finally {
    client.release();
  }
}

/** DELETE /api/workspace/drafts/:productUiId  (descarta un borrador sin lote oficial) */
export async function discardDraft(req: Request, res: Response): Promise<void> {
  try {
    const { rows } = await pool.query(
      `SELECT lote_id FROM borradores_lote WHERE producto_ui_id = $1;`,
      [req.params.productUiId]
    );
    if (rows[0]?.lote_id) {
      res.status(409).json({ error: 'BATCH_STARTED', message: 'El lote ya fue iniciado y no puede descartarse.' });
      return;
    }
    await pool.query(`DELETE FROM borradores_lote WHERE producto_ui_id = $1;`, [req.params.productUiId]);
    res.json({ message: 'Borrador descartado.' });
  } catch (error) {
    console.error('[workspace] Error al descartar borrador:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Error al descartar el borrador.' });
  }
}

/** GET /api/workspace/history?limit=50  Lotes (en proceso y cerrados) para el panel de administración */
export async function getBatchHistory(req: Request, res: Response): Promise<void> {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 500);
    const { rows } = await pool.query(
      `SELECT lp.id, lp.codigo_lote, lp.estado, lp.etapa_actual_codigo, lp.volumen_leche_base_litros,
              lp.iniciado_at, lp.finalizado_at, lp.duracion_total_segundos, lp.producto_ui_id,
              p.nombre AS producto_nombre, p.codigo AS producto_codigo,
              l.nombre AS linea_nombre, l.codigo AS linea_codigo,
              u.nombre_completo AS responsable_nombre,
              (SELECT COUNT(*) FROM auditoria_rectificaciones ar WHERE ar.lote_id = lp.id)::int AS rectificaciones
       FROM lotes_produccion lp
       JOIN productos p ON p.id = lp.producto_id
       JOIN lineas_produccion l ON l.id = lp.linea_id
       JOIN usuarios u ON u.id = lp.responsable_id
       ORDER BY lp.iniciado_at DESC
       LIMIT $1;`,
      [limit]
    );
    res.json(rows);
  } catch (error) {
    console.error('[workspace] Error al consultar historial:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Error al consultar el historial de lotes.' });
  }
}

/** GET /api/workspace/batches/:loteId  Detalle completo (estado de la UI) de un lote */
export async function getBatchDetail(req: Request, res: Response): Promise<void> {
  try {
    const { rows } = await pool.query(
      `SELECT lp.id, lp.codigo_lote, lp.estado, lp.producto_ui_id, lp.estado_ui
       FROM lotes_produccion lp WHERE lp.id::text = $1 OR lp.codigo_lote = $1 LIMIT 1;`,
      [req.params.loteId]
    );
    if (rows.length === 0) {
      res.status(404).json({ error: 'BATCH_NOT_FOUND', message: 'Lote no encontrado.' });
      return;
    }
    res.json(rows[0]);
  } catch (error) {
    console.error('[workspace] Error al consultar lote:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Error al consultar el lote.' });
  }
}

/**
 * POST /api/workspace/rectify
 * Rectificación administrativa de un dato del lote (en proceso o cerrado) con pista de auditoría inmutable.
 */
export async function rectifyBatchField(req: Request, res: Response): Promise<void> {
  const adminId = req.user?.id;
  const {
    codigoLote,
    estado,
    stageId,
    stageLabel,
    fieldKey,
    fieldLabel,
    oldValue,
    newValue,
    unit,
    reasonCategory,
    justification,
  } = req.body;

  const justificacion = String(justification ?? '').trim();
  if (!codigoLote || !fieldKey || newValue === undefined || estado === undefined) {
    res.status(400).json({ error: 'MISSING_FIELDS', message: 'Faltan datos de la rectificación.' });
    return;
  }
  if (justificacion.length < 15) {
    res.status(400).json({ error: 'INVALID_JUSTIFICATION', message: 'La justificación debe tener al menos 15 caracteres.' });
    return;
  }

  const client = await pool.connect();
  try {
    const lote = await client.query(
      `SELECT id, producto_ui_id, estado FROM lotes_produccion WHERE codigo_lote = $1 OR id::text = $1 LIMIT 1;`,
      [String(codigoLote)]
    );
    if (lote.rows.length === 0) {
      res.status(409).json({
        error: 'BATCH_NOT_STARTED',
        message: 'El lote aún no se ha iniciado en el sistema; no hay registro oficial que rectificar.',
      });
      return;
    }
    const target = lote.rows[0];

    await client.query('BEGIN');
    await client.query("SET LOCAL app.allow_admin_override = 'true'");
    await client.query(`UPDATE lotes_produccion SET estado_ui = $2, updated_at = NOW() WHERE id = $1;`, [target.id, estado]);
    if (target.estado === 'EN_PROCESO' && target.producto_ui_id) {
      await client.query(
        `UPDATE borradores_lote SET estado = $2, version = version + 1, updated_at = NOW()
         WHERE producto_ui_id = $1 AND lote_id = $3;`,
        [target.producto_ui_id, estado, target.id]
      );
    }
    const ip = req.ip || req.socket.remoteAddress || null;
    const audit = await client.query(
      `INSERT INTO auditoria_rectificaciones (
         accion, lote_id, etapa_codigo, etapa_label, tabla_destino, registro_destino_id,
         campo_modificado, campo_label, valor_anterior, valor_nuevo, unidad,
         categoria_motivo, justificacion_tecnica, autorizado_por_id, ip_address
       ) VALUES ('RECTIFICACION', $1, $2, $3, 'lotes_produccion', $1, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING id, registrado_at;`,
      [
        target.id,
        stageId ?? null,
        stageLabel ?? null,
        String(fieldKey),
        String(fieldLabel ?? fieldKey),
        String(oldValue ?? ''),
        String(newValue),
        unit ?? null,
        String(reasonCategory ?? 'Ajuste operativo'),
        justificacion,
        adminId,
        ip,
      ]
    );
    await client.query('COMMIT');
    res.status(201).json(audit.rows[0]);
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('[workspace] Error al rectificar:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message ?? 'Error al registrar la rectificación.' });
  } finally {
    client.release();
  }
}

/** GET /api/workspace/audit  Bitácora completa de rectificaciones */
export async function listAuditLogs(_req: Request, res: Response): Promise<void> {
  try {
    const { rows } = await pool.query(
      `SELECT ar.id, ar.etapa_codigo, ar.etapa_label, ar.campo_modificado, ar.campo_label,
              ar.valor_anterior, ar.valor_nuevo, ar.unidad, ar.categoria_motivo, ar.justificacion_tecnica,
              ar.registrado_at, u.nombre_completo AS autorizado_por_nombre,
              COALESCE(lp.codigo_lote, pa.codigo_lote) AS codigo_lote,
              l.nombre AS linea_nombre
       FROM auditoria_rectificaciones ar
       JOIN usuarios u ON u.id = ar.autorizado_por_id
       LEFT JOIN lotes_produccion lp ON lp.id = ar.lote_id
       LEFT JOIN lotes_padre pa ON pa.id = ar.lote_padre_id
       LEFT JOIN lineas_produccion l ON l.id = COALESCE(lp.linea_id, pa.linea_id)
       ORDER BY ar.registrado_at DESC
       LIMIT 500;`
    );
    res.json(rows);
  } catch (error) {
    console.error('[workspace] Error al consultar auditoría:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Error al consultar la auditoría.' });
  }
}
