import { normalizeBatchTraceability } from '../services/traceability';
import { Request, Response } from 'express';
import { PoolClient } from 'pg';
import { pool } from '../db';

const STAGE_STATES = ['pendiente', 'en_proceso', 'completada'];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function findLine(client: PoolClient, identifier: string) {
  const res = UUID_RE.test(identifier)
    ? await client.query(`SELECT id, codigo, tipo_linea FROM lineas_produccion WHERE id = $1 LIMIT 1;`, [identifier])
    : await client.query(`SELECT id, codigo, tipo_linea FROM lineas_produccion WHERE codigo = $1 LIMIT 1;`, [identifier]);
  return res.rows[0] as { id: string; codigo: string; tipo_linea: string } | undefined;
}

function lineForbidden(req: Request, res: Response, lineId: string): boolean {
  const user = req.user;
  if (process.env.ENFORCE_LINE_ACCESS !== 'true') return false;
  if (user && user.rol === 'operador' && user.lineaAsignadaId && user.lineaAsignadaId !== lineId) {
    res.status(403).json({ error: 'LINE_FORBIDDEN', message: 'No tienes asignada esta línea de producción.' });
    return true;
  }
  return false;
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
    if (lineForbidden(req, res, line.id)) return;
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
    const cerrados = await client.query(
      `SELECT codigo_lote, estado FROM lotes_produccion
       WHERE linea_id = $1 AND estado IN ('COMPLETADO', 'ANULADO')
         AND COALESCE(finalizado_at, anulado_at, iniciado_at) > NOW() - INTERVAL '3 days';`,
      [line.id]
    );
    res.json({ line, workspace: ws.rows[0] ?? null, drafts: drafts.rows, cerrados: cerrados.rows });
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
    if (lineForbidden(req, res, line.id)) return;
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
  // Kumis / Griego nacen de un Yogur: se enlaza con el lote de Yogur de origen
  // (lote_origen_id) y con su leche (lote_padre_id), y se deja el desvío en el historial.
  const origenUi = (params.estadoUi as any)?.batch?.origenYogur ?? (params.estadoUi as any)?.origenYogur ?? null;
  let origen: { id: string; lote_padre_id: string | null; estado: string } | null = null;
  if (origenUi && typeof origenUi === 'object') {
    const byCode = origenUi.yogurId
      ? await client.query(
          `SELECT id, lote_padre_id, estado FROM lotes_produccion WHERE codigo_lote = $1 AND producto_ui_id = 'prod-yogur' LIMIT 1;`,
          [String(origenUi.yogurId)]
        )
      : { rows: [] as any[] };
    const found = byCode.rows[0]
      ?? (await client.query(
            `SELECT id, lote_padre_id, estado FROM lotes_produccion
              WHERE producto_ui_id = 'prod-yogur' AND linea_id = $1
              ORDER BY iniciado_at DESC NULLS LAST LIMIT 1;`,
            [params.lineId]
          )).rows[0];
    if (found) origen = { id: found.id, lote_padre_id: found.lote_padre_id ?? null, estado: String(found.estado) };
  }

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
       estado_ui, producto_ui_id, lote_origen_id, lote_padre_id
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'EN_PROCESO',$10,$11,$12,$13,$14)
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
      origen?.id ?? null,
      origen?.lote_padre_id ?? null,
    ]
  );
  const batch = inserted.rows[0];

  // El historial de desvíos solo admite filas mientras el Yogur siga abierto (trigger de bloqueo).
  // Si ya se cerró, el enlace lote_origen_id basta y no se arriesga el guardado del sub-lote.
  if (origen && origen.estado === 'EN_PROCESO') {
    const litros = Math.max(0, Number(origenUi.litros) || params.volumen || 0);
    await client.query(
      `INSERT INTO lote_extracciones_sublote
         (lote_origen_id, lote_destino_id, etapa_origen_codigo, litros_anteriores, litros_nuevos, es_desvio_total, operario_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7);`,
      [
        origen.id,
        batch.id,
        params.productUiId === 'prod-kumis' ? 'acidificar' : 'calentar-y-cuajar',
        0,
        litros,
        origenUi.desvioTotal === true,
        params.userId,
      ]
    );
  }

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
  body: { estado: unknown; etapaActual?: string; volumen?: number; stageStatuses?: Record<string, string> },
  supervisorId: string | null = null
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
  if (supervisorId && supervisorId !== userId) {
    await client.query(
      `INSERT INTO lote_operarios_intervinientes (lote_id, usuario_id, rol_en_proceso)
       VALUES ($1, $2, 'Supervisor (intervención)') ON CONFLICT (lote_id, usuario_id) DO NOTHING;`,
      [loteId, supervisorId]
    );
  }

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
    if (lineForbidden(req, res, line.id)) return;

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
      const codigoCliente =
        estado && typeof estado === 'object' && estado.batch && typeof estado.batch.id === 'string'
          ? estado.batch.id
          : null;
      if (codigoCliente) {
        const cerrado = await client.query(
          `SELECT codigo_lote, estado FROM lotes_produccion
            WHERE codigo_lote = $1 AND estado IN ('COMPLETADO', 'ANULADO')
            LIMIT 1;`,
          [codigoCliente]
        );
        if (cerrado.rows.length > 0) {
          await client.query('ROLLBACK');
          res.status(409).json({
            error: 'BATCH_CLOSED',
            codigo_lote: cerrado.rows[0].codigo_lote,
            estado: cerrado.rows[0].estado,
            message: 'El lote ya fue cerrado en otra sesión y no admite más cambios.',
          });
          return;
        }
      }
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
      let actorId = userId;
      let supervisorId: string | null = null;
      if (req.user?.rol !== 'operador') {
        const owner = await client.query(`SELECT responsable_id FROM lotes_produccion WHERE id = $1;`, [loteId]);
        if (owner.rows[0]?.responsable_id && owner.rows[0].responsable_id !== userId) {
          actorId = owner.rows[0].responsable_id;
          supervisorId = userId;
        }
      }
      await syncBatch(client, loteId, actorId, { estado, etapaActual, volumen: Number(volumen), stageStatuses }, supervisorId);
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
           finalizado_por_id = $4,
           updated_at = NOW()
         WHERE id = $1 AND estado = 'EN_PROCESO';`,
        [loteId, observaciones ? String(observaciones) : null, Number.isFinite(Number(elapsedSeconds)) && Number(elapsedSeconds) > 0 ? Math.round(Number(elapsedSeconds)) : null, userId]
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
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Error al guardar el lote.' });
  } finally {
    client.release();
  }
}

/** GET /api/workspace/drafts  Lista de lotes en proceso (un borrador abierto por producto) */
export async function listOpenDrafts(_req: Request, res: Response): Promise<void> {
  try {
    const { rows } = await pool.query(
      `SELECT b.producto_ui_id, b.etapa_actual, b.updated_at, b.linea_id,
              lp.codigo_lote,
              COALESCE(u.nombre_completo, 'Operador de planta') AS operador,
              u.codigo_empleado AS operador_codigo,
              (COALESCE(lp.estado = 'EN_PROCESO', FALSE) AND b.updated_at > NOW() - INTERVAL '12 hours') AS vigente,
              (b.lote_id IS NULL) AS descartable
         FROM borradores_lote b
         LEFT JOIN lotes_produccion lp ON lp.id = b.lote_id
         LEFT JOIN usuarios u ON u.id = b.actualizado_por_id
        ORDER BY b.updated_at DESC;`
    );
    res.json(rows);
  } catch (error) {
    console.error('[workspace] Error al listar borradores abiertos:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Error al listar los lotes en proceso.' });
  }
}

/** GET /api/workspace/drafts/:productUiId/estado  Estado del lote activo de un producto (para cierre en vivo) */
export async function getDraftStatus(req: Request, res: Response): Promise<void> {
  try {
    const { rows } = await pool.query(
      `SELECT b.lote_id, b.etapa_actual, lp.codigo_lote
         FROM borradores_lote b
         LEFT JOIN lotes_produccion lp ON lp.id = b.lote_id
        WHERE b.producto_ui_id = $1;`,
      [req.params.productUiId]
    );
    if (rows.length > 0) {
      res.json({
        estado: 'EN_PROCESO',
        lote_id: rows[0].lote_id,
        codigo_lote: rows[0].codigo_lote,
        etapa_actual: rows[0].etapa_actual,
        finalizado_por: null,
        finalizado_at: null,
      });
      return;
    }
    const cerrado = await pool.query(
      `SELECT lp.codigo_lote, lp.estado, lp.finalizado_at, lp.anulado_at,
              COALESCE(u.nombre_completo, 'Operador de planta') AS finalizado_por,
              u.codigo_empleado
         FROM lotes_produccion lp
         LEFT JOIN usuarios u ON u.id = COALESCE(lp.finalizado_por_id, lp.responsable_id)
        WHERE lp.producto_ui_id = $1
          AND lp.estado IN ('COMPLETADO', 'ANULADO')
          AND COALESCE(lp.finalizado_at, lp.anulado_at) > NOW() - INTERVAL '12 hours'
        ORDER BY COALESCE(lp.finalizado_at, lp.anulado_at) DESC
        LIMIT 1;`,
      [req.params.productUiId]
    );
    if (cerrado.rows.length > 0) {
      const row = cerrado.rows[0];
      res.json({
        estado: row.estado,
        lote_id: null,
        codigo_lote: row.codigo_lote,
        etapa_actual: null,
        finalizado_por: row.finalizado_por,
        finalizado_por_codigo: row.codigo_empleado,
        finalizado_at: row.finalizado_at ?? row.anulado_at,
      });
      return;
    }
    res.json({ estado: 'SIN_LOTE', lote_id: null, codigo_lote: null, etapa_actual: null, finalizado_por: null, finalizado_at: null });
  } catch (error) {
    console.error('[workspace] Error al consultar estado del lote:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Error al consultar el estado del lote.' });
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
              (SELECT COUNT(*) FROM auditoria_rectificaciones ar WHERE ar.lote_id = lp.id)::int AS rectificaciones,
              an.justificacion_tecnica AS anulacion_justificacion,
              an.registrado_at AS anulado_at,
              an.autor AS anulado_por
       FROM lotes_produccion lp
       JOIN productos p ON p.id = lp.producto_id
       JOIN lineas_produccion l ON l.id = lp.linea_id
       JOIN usuarios u ON u.id = lp.responsable_id
       LEFT JOIN LATERAL (
         SELECT ar.justificacion_tecnica, ar.registrado_at, ua.nombre_completo AS autor
         FROM auditoria_rectificaciones ar
         JOIN usuarios ua ON ua.id = ar.autorizado_por_id
         WHERE ar.lote_id = lp.id AND ar.accion = 'ANULACION'
         ORDER BY ar.registrado_at DESC LIMIT 1
       ) an ON lp.estado = 'ANULADO'
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
      `SELECT lp.id, lp.codigo_lote, lp.estado, lp.producto_ui_id, lp.estado_ui,
              lp.etapa_actual_codigo, lp.iniciado_at, lp.finalizado_at, lp.duracion_total_segundos,
              p.nombre AS producto_nombre, p.codigo AS producto_codigo,
              l.nombre AS linea_nombre, l.codigo AS linea_codigo,
              u.nombre_completo AS responsable_nombre,
              (SELECT COUNT(*) FROM auditoria_rectificaciones ar WHERE ar.lote_id = lp.id)::int AS rectificaciones
       FROM lotes_produccion lp
       JOIN productos p ON p.id = lp.producto_id
       JOIN lineas_produccion l ON l.id = lp.linea_id
       JOIN usuarios u ON u.id = lp.responsable_id
       WHERE lp.id::text = $1 OR lp.codigo_lote = $1 LIMIT 1;`,
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
      `SELECT id, producto_ui_id, estado, responsable_id, estado_ui FROM lotes_produccion WHERE ${
        UUID_RE.test(String(codigoLote)) ? 'id = $1' : 'codigo_lote = $1'
      } LIMIT 1;`,
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

    let estadoFinal = estado;
    let valorAnterior: unknown = oldValue;
    const currentUi = target.estado_ui;
    if (currentUi && typeof currentUi === 'object' && currentUi.batch && typeof fieldKey === 'string') {
      const keys = fieldKey.split('.');
      let cursor: any = currentUi.batch;
      for (let i = 0; i < keys.length - 1 && cursor !== undefined && cursor !== null; i += 1) cursor = cursor[keys[i]];
      const last = keys[keys.length - 1];
      if (cursor !== undefined && cursor !== null && typeof cursor === 'object' && last in cursor) {
        valorAnterior = typeof cursor[last] === 'object' ? JSON.stringify(cursor[last]) : cursor[last];
        const next = JSON.parse(JSON.stringify(currentUi));
        let nc: any = next.batch;
        for (let i = 0; i < keys.length - 1; i += 1) nc = nc[keys[i]];
        nc[last] = newValue;
        estadoFinal = next;
      }
    }

    await client.query('BEGIN');
    await client.query("SET LOCAL app.allow_admin_override = 'true'");
    await client.query(`UPDATE lotes_produccion SET estado_ui = $2, updated_at = NOW() WHERE id = $1;`, [target.id, estadoFinal]);
    if (target.estado === 'EN_PROCESO' && target.producto_ui_id) {
      await client.query(
        `UPDATE borradores_lote SET estado = $2, version = version + 1, updated_at = NOW()
         WHERE producto_ui_id = $1 AND lote_id = $3;`,
        [target.producto_ui_id, estadoFinal, target.id]
      );
    }
    await client.query('SAVEPOINT trazabilidad');
    try {
      await normalizeBatchTraceability(client, target.id, target.responsable_id, estadoFinal);
      await client.query('RELEASE SAVEPOINT trazabilidad');
    } catch (normError) {
      await client.query('ROLLBACK TO SAVEPOINT trazabilidad');
      console.error('[workspace] Error al normalizar trazabilidad tras rectificar:', normError);
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
        String(valorAnterior ?? ''),
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
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Error al registrar la rectificación.' });
  } finally {
    client.release();
  }
}

/** GET /api/workspace/audit  Bitácora completa de rectificaciones */
export async function listAuditLogs(_req: Request, res: Response): Promise<void> {
  try {
    const { rows } = await pool.query(
      `SELECT ar.id, ar.accion, ar.etapa_codigo, ar.etapa_label, ar.campo_modificado, ar.campo_label,
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

/**
 * POST /api/workspace/batches/:loteId/anular  { justification }
 * Anula un lote en proceso (p. ej. iniciado por error): libera el borrador del producto y deja la pista de auditoría.
 */
export async function annulBatch(req: Request, res: Response): Promise<void> {
  const adminId = req.user?.id;
  const justificacion = String(req.body.justification ?? '').trim();
  if (justificacion.length < 15) {
    res.status(400).json({ error: 'INVALID_JUSTIFICATION', message: 'La justificación debe tener al menos 15 caracteres.' });
    return;
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const lote = await client.query(
      `SELECT id, estado, producto_ui_id, codigo_lote FROM lotes_produccion
       WHERE id::text = $1 OR codigo_lote = $1 LIMIT 1 FOR UPDATE;`,
      [req.params.loteId]
    );
    if (lote.rows.length === 0) {
      await client.query('ROLLBACK');
      res.status(404).json({ error: 'BATCH_NOT_FOUND', message: 'Lote no encontrado.' });
      return;
    }
    const target = lote.rows[0];
    if (target.estado !== 'EN_PROCESO') {
      await client.query('ROLLBACK');
      res.status(409).json({ error: 'BATCH_NOT_ACTIVE', message: 'Solo se pueden anular lotes en proceso. Para un lote cerrado usa una rectificación.' });
      return;
    }
    await client.query(`UPDATE lotes_produccion SET estado = 'ANULADO', anulado_at = NOW(), anulado_por_id = $2, motivo_anulacion = $3, updated_at = NOW() WHERE id = $1;`, [target.id, adminId, justificacion]);
    await client.query(`DELETE FROM borradores_lote WHERE lote_id = $1;`, [target.id]);
    const audit = await client.query(
      `INSERT INTO auditoria_rectificaciones (
         accion, lote_id, etapa_codigo, etapa_label, tabla_destino, registro_destino_id,
         campo_modificado, campo_label, valor_anterior, valor_nuevo, unidad,
         categoria_motivo, justificacion_tecnica, autorizado_por_id, ip_address
       ) VALUES ('ANULACION', $1, 'lote', 'Lote completo', 'lotes_produccion', $1,
                 'estado', 'Estado del lote', 'EN_PROCESO', 'ANULADO', NULL,
                 'Anulación de lote', $2, $3, $4)
       RETURNING id, registrado_at;`,
      [target.id, justificacion, adminId, req.ip || req.socket.remoteAddress || null]
    );
    await client.query('COMMIT');
    res.json({ message: `Lote ${target.codigo_lote} anulado.`, ...audit.rows[0] });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('[workspace] Error al anular lote:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Error al anular el lote.' });
  } finally {
    client.release();
  }
}
