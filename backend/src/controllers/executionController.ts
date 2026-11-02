import { Request, Response } from 'express';
import { PoolClient } from 'pg';
import { pool } from '../db';

/**
 * PUT /api/batches/:batchId/stages/:stageId
 * Actualiza el estado de una etapa ('pendiente', 'en_proceso', 'completada', 'omitida'),
 * sus marcas de tiempo y sincroniza la etapa actual del lote de producción.
 */
export async function updateStageStatus(req: Request, res: Response): Promise<void> {
  const client: PoolClient = await pool.connect();
  try {
    const batchId = res.locals.batch?.id ?? req.params.batchId;
    const { stageId } = req.params;

    if (!stageId) {
      res.status(400).json({ error: 'MISSING_PARAM', message: 'Se requiere stageId en la URL.' });
      return;
    }

    const {
      estado,
      status,
      iniciado_at,
      iniciadoAt,
      finalizado_at,
      finalizadoAt,
      segundos_duracion,
      duracion_segundos,
      durationSeconds,
      observaciones,
      operario_responsable_id,
      operarioId,
    } = req.body;

    const rawEstado = (estado ?? status ?? 'en_proceso').toLowerCase();
    const estadosValidos = ['pendiente', 'en_proceso', 'completada', 'omitida'];

    if (!estadosValidos.includes(rawEstado)) {
      res.status(400).json({
        error: 'INVALID_STATUS',
        message: `Estado de etapa inválido. Valores permitidos: ${estadosValidos.join(', ')}.`,
      });
      return;
    }

    await client.query('BEGIN');

    // 1. Buscar la etapa en lote_etapas_ejecucion (por id de etapa, id de catálogo o codigo_ui)
    const findStageSql = `
      SELECT lee.*, ec.codigo_ui, ec.nombre AS etapa_nombre, ec.orden_secuencia
      FROM lote_etapas_ejecucion lee
      JOIN etapas_catalogo ec ON ec.id = lee.etapa_catalogo_id
      WHERE lee.lote_id = $1
        AND (lee.id::text = $2 OR ec.id::text = $2 OR ec.codigo_ui = $2)
      LIMIT 1;
    `;
    const stageRes = await client.query(findStageSql, [batchId, stageId]);

    if (stageRes.rows.length === 0) {
      await client.query('ROLLBACK');
      res.status(404).json({
        error: 'STAGE_NOT_FOUND',
        message: `Etapa '${stageId}' no encontrada en el lote de producción.`,
      });
      return;
    }

    const currentStage = stageRes.rows[0];
    const responsable = operario_responsable_id ?? operarioId ?? req.user?.id ?? currentStage.operario_responsable_id;

    // Calcular timestamps según el estado
    let newIniciadoAt = iniciado_at ?? iniciadoAt ?? currentStage.iniciado_at;
    let newFinalizadoAt = finalizado_at ?? finalizadoAt ?? currentStage.finalizado_at;

    if (rawEstado === 'en_proceso' && !newIniciadoAt) {
      newIniciadoAt = new Date().toISOString();
    }
    if (rawEstado === 'completada' && !newFinalizadoAt) {
      newFinalizadoAt = new Date().toISOString();
    }

    let duracion = segundos_duracion ?? duracion_segundos ?? durationSeconds ?? currentStage.duracion_segundos;
    if (rawEstado === 'completada' && !duracion && newIniciadoAt && newFinalizadoAt) {
      const startMs = new Date(newIniciadoAt).getTime();
      const endMs = new Date(newFinalizadoAt).getTime();
      duracion = Math.max(0, Math.round((endMs - startMs) / 1000));
    }

    // 2. Actualizar registro en lote_etapas_ejecucion
    const updateStageSql = `
      UPDATE lote_etapas_ejecucion
      SET 
        estado = $1::estado_etapa_enum,
        iniciado_at = $2,
        finalizado_at = $3,
        duracion_segundos = $4,
        observaciones = COALESCE($5, observaciones),
        operario_responsable_id = $6,
        updated_at = NOW()
      WHERE id = $7
      RETURNING *;
    `;
    const updateRes = await client.query(updateStageSql, [
      rawEstado,
      newIniciadoAt,
      newFinalizadoAt,
      duracion !== undefined ? Number(duracion) : null,
      observaciones ?? null,
      responsable,
      currentStage.id,
    ]);

    // 3. Sincronizar etapa_actual_codigo en lotes_produccion si la etapa pasa a 'en_proceso'
    if (rawEstado === 'en_proceso') {
      await client.query(
        `UPDATE lotes_produccion
         SET etapa_actual_codigo = $1, updated_at = NOW()
         WHERE id = $2;`,
        [currentStage.codigo_ui, batchId]
      );
    }

    await client.query('COMMIT');

    res.status(200).json({
      message: `Etapa '${currentStage.etapa_nombre}' actualizada a estado '${rawEstado}'.`,
      stage: {
        ...updateRes.rows[0],
        codigo_ui: currentStage.codigo_ui,
        etapa_nombre: currentStage.etapa_nombre,
      },
    });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('[execution] Error al actualizar etapa:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message ?? 'Error al actualizar etapa.' });
  } finally {
    client.release();
  }
}

/**
 * POST /api/batches/:batchId/measurements
 * Inserta un registro fisicoquímico (temperatura, pH, acidez, etc.) en mediciones_fisicoquimicas.
 */
export async function addMeasurement(req: Request, res: Response): Promise<void> {
  const client: PoolClient = await pool.connect();
  try {
    const batchId = res.locals.batch?.id ?? req.params.batchId;
    const {
      parametro_codigo,
      parametroCodigo,
      parametro,
      valor_numerico,
      valorNumerico,
      valor,
      etapa_id,
      etapaId,
      etapa_codigo,
      etapaCodigo,
      es_captura_manual,
      esCapturaManual,
      operario_id,
      operarioId,
    } = req.body;

    const codigoParam = parametro_codigo ?? parametroCodigo ?? parametro;
    const val = Number(valor_numerico ?? valorNumerico ?? valor);
    const etapaRaw = etapa_id ?? etapaId ?? etapa_codigo ?? etapaCodigo;
    const manual = es_captura_manual ?? esCapturaManual ?? false;
    const operario = operario_id ?? operarioId ?? req.user?.id ?? null;

    if (!codigoParam || isNaN(val)) {
      res.status(400).json({
        error: 'MISSING_FIELDS',
        message: 'Faltan campos obligatorios: parametro_codigo y valor_numerico válido.',
      });
      return;
    }

    await client.query('BEGIN');

    // 1. Validar que el parámetro exista en el catálogo maestro
    const paramCheck = await client.query(
      `SELECT codigo, nombre, unidad FROM parametros_medicion WHERE codigo = $1 LIMIT 1;`,
      [codigoParam]
    );
    if (paramCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      res.status(400).json({
        error: 'INVALID_PARAMETER',
        message: `El parámetro de medición '${codigoParam}' no existe en el catálogo maestro.`,
      });
      return;
    }
    const paramInfo = paramCheck.rows[0];

    // 2. Resolver lote_etapa_id de la ejecución
    let loteEtapaId: string | null = null;
    if (etapaRaw) {
      const stageRes = await client.query(
        `SELECT lee.id 
         FROM lote_etapas_ejecucion lee
         JOIN etapas_catalogo ec ON ec.id = lee.etapa_catalogo_id
         WHERE lee.lote_id = $1
           AND (lee.id::text = $2 OR ec.id::text = $2 OR ec.codigo_ui = $2)
         LIMIT 1;`,
        [batchId, etapaRaw]
      );
      if (stageRes.rows.length > 0) {
        loteEtapaId = stageRes.rows[0].id;
      }
    }

    // Si no se especificó o no se encontró, tomar la etapa actualmente activa del lote
    if (!loteEtapaId) {
      const currentStageRes = await client.query(
        `SELECT lee.id 
         FROM lote_etapas_ejecucion lee
         JOIN lotes_produccion lp ON lp.id = lee.lote_id
         JOIN etapas_catalogo ec ON ec.id = lee.etapa_catalogo_id
         WHERE lee.lote_id = $1
         ORDER BY 
           CASE WHEN lee.estado = 'en_proceso' THEN 1 
                WHEN ec.codigo_ui = lp.etapa_actual_codigo THEN 2 
                ELSE 3 END,
           ec.orden_secuencia ASC
         LIMIT 1;`,
        [batchId]
      );
      if (currentStageRes.rows.length > 0) {
        loteEtapaId = currentStageRes.rows[0].id;
      }
    }

    if (!loteEtapaId) {
      await client.query('ROLLBACK');
      res.status(400).json({
        error: 'NO_STAGE_AVAILABLE',
        message: 'No se encontró ninguna etapa de ejecución activa para asociar la medición.',
      });
      return;
    }

    // 3. Insertar la medición fisicoquímica
    const insertSql = `
      INSERT INTO mediciones_fisicoquimicas (
        lote_id,
        lote_etapa_id,
        parametro_codigo,
        valor_numerico,
        es_captura_manual,
        operario_id
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *;
    `;
    const insertRes = await client.query(insertSql, [
      batchId,
      loteEtapaId,
      paramInfo.codigo,
      val,
      manual,
      operario,
    ]);

    await client.query('COMMIT');

    res.status(201).json({
      message: 'Medición registrada exitosamente.',
      measurement: {
        ...insertRes.rows[0],
        parametro_nombre: paramInfo.nombre,
        unidad: paramInfo.unidad,
      },
    });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('[execution] Error al registrar medición:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message ?? 'Error al registrar medición.' });
  } finally {
    client.release();
  }
}

/**
 * POST /api/batches/:batchId/ingredients
 * Inserta el registro del insumo/ingrediente utilizado en lote_insumos_utilizados.
 */
export async function addIngredient(req: Request, res: Response): Promise<void> {
  const client: PoolClient = await pool.connect();
  try {
    const batchId = res.locals.batch?.id ?? req.params.batchId;
    const {
      tipo_insumo,
      tipoInsumo,
      insumo_nombre_snapshot,
      insumoNombre,
      nombre,
      codigo_lote_insumo,
      codigoLoteInsumo,
      loteInsumo,
      cantidad_utilizada,
      cantidadUtilizada,
      cantidad,
      unidad_medida,
      unidadMedida,
      unidad,
      proveedor,
      supplier,
      insumo_lote_id,
      insumoLoteId,
      etapa_id,
      etapaId,
      etapa_codigo,
      etapaCodigo,
      derivacion_id,
      derivacionId,
      peso_inicial_gramos,
      pesoInicialGramos,
      peso_final_gramos,
      pesoFinalGramos,
      es_dosificacion_manual,
      esDosificacionManual,
      operario_id,
      operarioId,
    } = req.body;

    const tipo = (tipo_insumo ?? tipoInsumo ?? '').trim();
    const nombreSnapshot = (insumo_nombre_snapshot ?? insumoNombre ?? nombre ?? '').trim();
    const codigoLote = (codigo_lote_insumo ?? codigoLoteInsumo ?? loteInsumo ?? '').trim();
    const prov = proveedor ?? supplier ?? null;
    const uMedida = (unidad_medida ?? unidadMedida ?? unidad ?? 'g').trim();
    const manual = es_dosificacion_manual ?? esDosificacionManual ?? true;
    const operario = operario_id ?? operarioId ?? req.user?.id ?? null;
    const insumoLoteUuid = insumo_lote_id ?? insumoLoteId ?? null;
    const derivacionUuid = derivacion_id ?? derivacionId ?? null;

    const pInicial = peso_inicial_gramos ?? pesoInicialGramos;
    const pFinal = peso_final_gramos ?? pesoFinalGramos;

    let cant = Number(cantidad_utilizada ?? cantidadUtilizada ?? cantidad);

    // Si se pasan peso inicial y final, respetar la matemática estricta: utilizado = inicial - final
    if (pInicial !== undefined && pFinal !== undefined && pInicial !== null && pFinal !== null) {
      const calcDiff = Number(pInicial) - Number(pFinal);
      if (isNaN(cant) || cant <= 0) {
        cant = Math.max(0, calcDiff);
      }
    }

    if (!tipo || !nombreSnapshot || !codigoLote || isNaN(cant) || cant < 0) {
      res.status(400).json({
        error: 'MISSING_FIELDS',
        message: 'Faltan campos obligatorios: tipo_insumo, insumo_nombre_snapshot, codigo_lote_insumo, cantidad_utilizada (>= 0).',
      });
      return;
    }

    await client.query('BEGIN');

    // 1. Resolver lote_etapa_id (opcional en lote_insumos_utilizados)
    const etapaRaw = etapa_id ?? etapaId ?? etapa_codigo ?? etapaCodigo;
    let loteEtapaId: string | null = null;
    if (etapaRaw) {
      const stageRes = await client.query(
        `SELECT lee.id 
         FROM lote_etapas_ejecucion lee
         JOIN etapas_catalogo ec ON ec.id = lee.etapa_catalogo_id
         WHERE lee.lote_id = $1
           AND (lee.id::text = $2 OR ec.id::text = $2 OR ec.codigo_ui = $2)
         LIMIT 1;`,
        [batchId, etapaRaw]
      );
      if (stageRes.rows.length > 0) {
        loteEtapaId = stageRes.rows[0].id;
      }
    }

    if (!loteEtapaId) {
      const currentStageRes = await client.query(
        `SELECT lee.id 
         FROM lote_etapas_ejecucion lee
         JOIN lotes_produccion lp ON lp.id = lee.lote_id
         JOIN etapas_catalogo ec ON ec.id = lee.etapa_catalogo_id
         WHERE lee.lote_id = $1
         ORDER BY 
           CASE WHEN lee.estado = 'en_proceso' THEN 1 
                WHEN ec.codigo_ui = lp.etapa_actual_codigo THEN 2 
                ELSE 3 END,
           ec.orden_secuencia ASC
         LIMIT 1;`,
        [batchId]
      );
      if (currentStageRes.rows.length > 0) {
        loteEtapaId = currentStageRes.rows[0].id;
      }
    }

    // 2. Insertar insumo utilizado
    const insertSql = `
      INSERT INTO lote_insumos_utilizados (
        lote_id,
        lote_etapa_id,
        derivacion_id,
        insumo_lote_id,
        tipo_insumo,
        insumo_nombre_snapshot,
        codigo_lote_insumo,
        proveedor,
        unidad_medida,
        peso_inicial_gramos,
        peso_final_gramos,
        cantidad_utilizada,
        es_dosificacion_manual,
        operario_id
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
      ) RETURNING *;
    `;
    const insertRes = await client.query(insertSql, [
      batchId,
      loteEtapaId,
      derivacionUuid,
      insumoLoteUuid,
      tipo,
      nombreSnapshot,
      codigoLote,
      prov,
      uMedida,
      pInicial !== undefined && pInicial !== null ? Number(pInicial) : null,
      pFinal !== undefined && pFinal !== null ? Number(pFinal) : null,
      cant,
      manual,
      operario,
    ]);

    await client.query('COMMIT');

    res.status(201).json({
      message: `Insumo '${nombreSnapshot}' (${cant} ${uMedida}) registrado exitosamente.`,
      ingredient: insertRes.rows[0],
    });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('[execution] Error al registrar insumo:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message ?? 'Error al registrar insumo.' });
  } finally {
    client.release();
  }
}
