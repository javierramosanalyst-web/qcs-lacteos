import { Request, Response } from 'express';
import { PoolClient } from 'pg';
import { pool } from '../db';

/** Helper para resolver el UUID de una línea a partir de su UUID o código (ej. 'L-FERMENT-02') */
async function resolveLineId(client: PoolClient, lineIdentifier: string): Promise<string> {
  const res = await client.query(
    `SELECT id FROM lineas_produccion WHERE id::text = $1 OR codigo = $1 LIMIT 1;`,
    [lineIdentifier]
  );
  if (res.rows.length === 0) {
    throw new Error(`Línea de producción '${lineIdentifier}' no encontrada.`);
  }
  return res.rows[0].id;
}

/**
 * GET /api/batches/
 * Retorna todos los lotes activos (padres e hijos) con estado 'PENDIENTE' o 'EN_PROCESO'.
 */
export async function getActiveBatches(_req: Request, res: Response): Promise<void> {
  try {
    const parentQuery = `
      SELECT 
        lp.id,
        lp.codigo_lote,
        lp.linea_id,
        l.nombre AS linea_nombre,
        l.codigo AS linea_codigo,
        lp.responsable_id,
        u.nombre_completo AS responsable_nombre,
        lp.fecha_produccion,
        lp.total_leche_litros,
        lp.litros_asignados,
        lp.litros_remanentes,
        lp.proveedor_principal,
        lp.lote_leche_proveedor,
        lp.estado,
        lp.iniciado_at,
        lp.dividido_at,
        lp.observaciones,
        r.temperatura_recepcion_celsius,
        r.acidez_dornic,
        r.ph_recepcion,
        r.observaciones_plataforma,
        lp.created_at
      FROM lotes_padre lp
      JOIN lineas_produccion l ON l.id = lp.linea_id
      JOIN usuarios u ON u.id = lp.responsable_id
      LEFT JOIN lote_padre_recepcion r ON r.lote_padre_id = lp.id
      WHERE lp.estado IN ('PENDIENTE', 'EN_PROCESO')
      ORDER BY lp.created_at DESC;
    `;

    const childQuery = `
      SELECT 
        lp.id,
        lp.codigo_lote,
        lp.lote_padre_id,
        p_padre.codigo_lote AS codigo_lote_padre,
        lp.lote_origen_id,
        lp.producto_id,
        p.nombre AS producto_nombre,
        p.codigo AS producto_codigo,
        lp.linea_id,
        l.nombre AS linea_nombre,
        l.codigo AS linea_codigo,
        lp.responsable_id,
        u.nombre_completo AS responsable_nombre,
        lp.norma_tecnica_aplicada,
        lp.receta_snapshot,
        lp.variante_fermentado,
        lp.volumen_leche_base_litros,
        lp.lleva_azucar,
        lp.estado,
        lp.en_ajuste,
        lp.etapa_actual_codigo,
        lp.iniciado_at,
        lp.created_at
      FROM lotes_produccion lp
      JOIN productos p ON p.id = lp.producto_id
      JOIN lineas_produccion l ON l.id = lp.linea_id
      JOIN usuarios u ON u.id = lp.responsable_id
      LEFT JOIN lotes_padre p_padre ON p_padre.id = lp.lote_padre_id
      WHERE lp.estado IN ('PENDIENTE', 'EN_PROCESO')
      ORDER BY lp.created_at DESC;
    `;

    const [parentsRes, childrenRes] = await Promise.all([
      pool.query(parentQuery),
      pool.query(childQuery),
    ]);

    res.status(200).json({
      parentBatches: parentsRes.rows,
      productionBatches: childrenRes.rows,
      parents: parentsRes.rows,
      children: childrenRes.rows,
    });
  } catch (error) {
    console.error('[batch] Error al obtener lotes activos:', error);
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Error al consultar lotes activos.',
    });
  }
}

/**
 * POST /api/batches/parent
 * Crea un lote en lotes_padre y simultáneamente sus datos de plataforma en lote_padre_recepcion
 * dentro de una única transacción ACID.
 */
export async function createParentBatch(req: Request, res: Response): Promise<void> {
  const client: PoolClient = await pool.connect();
  try {
    const {
      codigo_lote,
      codigoLote,
      linea_id,
      lineaId,
      total_leche_litros,
      totalMilkLiters,
      proveedor_principal,
      proveedorPrincipal,
      lote_leche_proveedor,
      loteLecheProveedor,
      fecha_produccion,
      fechaProduccion,
      observaciones,
      // Plataforma
      temperatura_recepcion_celsius,
      temperaturaRecepcion,
      acidez_dornic,
      acidezDornic,
      ph_recepcion,
      phRecepcion,
      observaciones_plataforma,
      observacionesPlataforma,
    } = req.body;

    const codigo = codigo_lote ?? codigoLote;
    const lineaRaw = linea_id ?? lineaId;
    const totalLitros = Number(total_leche_litros ?? totalMilkLiters);
    const proveedor = proveedor_principal ?? proveedorPrincipal;
    const loteProveedor = lote_leche_proveedor ?? loteLecheProveedor;
    const fecha = fecha_produccion ?? fechaProduccion ?? null;
    const obs = observaciones ?? null;

    const tempRecepcion = Number(temperatura_recepcion_celsius ?? temperaturaRecepcion);
    const acidez = acidez_dornic ?? acidezDornic ?? null;
    const ph = ph_recepcion ?? phRecepcion ?? null;
    const obsPlataforma = observaciones_plataforma ?? observacionesPlataforma ?? null;

    if (!codigo || !lineaRaw || isNaN(totalLitros) || totalLitros <= 0 || !proveedor || !loteProveedor) {
      res.status(400).json({
        error: 'MISSING_FIELDS',
        message: 'Faltan campos obligatorios: codigo_lote, linea_id, total_leche_litros (> 0), proveedor_principal, lote_leche_proveedor.',
      });
      return;
    }

    if (isNaN(tempRecepcion)) {
      res.status(400).json({
        error: 'MISSING_FIELDS',
        message: 'Se requiere la temperatura de recepción en plataforma.',
      });
      return;
    }

    await client.query('BEGIN');

    // Resolver ID de la línea
    const verifiedLineId = await resolveLineId(client, lineaRaw);

    // Responsable: usuario autenticado o especificado
    const responsableId = req.body.responsable_id ?? req.body.responsableId ?? req.user?.id;
    if (!responsableId) {
      await client.query('ROLLBACK');
      res.status(400).json({ error: 'MISSING_RESPONSABLE', message: 'No se identificó el responsable del lote.' });
      return;
    }

    // Insertar lote padre respetando chk_balance_leche_padre (litros_asignados + litros_remanentes = total)
    const insertParentSql = `
      INSERT INTO lotes_padre (
        codigo_lote,
        linea_id,
        responsable_id,
        fecha_produccion,
        total_leche_litros,
        litros_asignados,
        litros_remanentes,
        proveedor_principal,
        lote_leche_proveedor,
        estado,
        iniciado_at,
        observaciones
      ) VALUES (
        $1, $2, $3, COALESCE($4::date, CURRENT_DATE), $5, 0, $5, $6, $7, 'PENDIENTE', NOW(), $8
      ) RETURNING *;
    `;
    const parentResult = await client.query(insertParentSql, [
      String(codigo).trim(),
      verifiedLineId,
      responsableId,
      fecha,
      totalLitros,
      String(proveedor).trim(),
      String(loteProveedor).trim(),
      obs,
    ]);
    const newParent = parentResult.rows[0];

    // Insertar plataforma de recepción
    const insertRecepcionSql = `
      INSERT INTO lote_padre_recepcion (
        lote_padre_id,
        temperatura_recepcion_celsius,
        acidez_dornic,
        ph_recepcion,
        observaciones_plataforma
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING *;
    `;
    const recepcionResult = await client.query(insertRecepcionSql, [
      newParent.id,
      tempRecepcion,
      acidez !== null ? Number(acidez) : null,
      ph !== null ? Number(ph) : null,
      obsPlataforma,
    ]);

    await client.query('COMMIT');

    res.status(201).json({
      message: 'Lote padre creado exitosamente.',
      parentBatch: newParent,
      recepcion: recepcionResult.rows[0],
    });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('[batch] Error al crear lote padre:', error);
    if (error.code === '23505') {
      res.status(409).json({ error: 'DUPLICATE_CODE', message: 'El código de lote ya existe.' });
      return;
    }
    res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message ?? 'Error al registrar lote padre.' });
  } finally {
    client.release();
  }
}

/**
 * POST /api/batches/child
 * Crea un sub-lote de producción (lotes_produccion) a partir de un lote padre o de otro lote.
 * Transaccionalmente:
 * 1) Descuenta y recalcula los litros del lote origen/padre.
 * 2) Inserta el nuevo sub-lote en lotes_produccion.
 * 3) Si los litros_remanentes del padre llegan a 0, actualiza el padre a 'COMPLETADO' con motivo DESVIO_TOTAL.
 */
export async function createChildBatch(req: Request, res: Response): Promise<void> {
  const client: PoolClient = await pool.connect();
  try {
    const {
      lote_padre_id,
      lotePadreId,
      lote_origen_id,
      loteOrigenId,
      producto_id,
      productoId,
      linea_id,
      lineaId,
      codigo_lote,
      codigoLote,
      volumen_leche_base_litros,
      volumen,
      allocatedLiters,
      variante_fermentado,
      variante,
      lleva_azucar,
      llevaAzucar,
    } = req.body;

    const parentRaw = lote_padre_id ?? lotePadreId;
    const originRaw = lote_origen_id ?? loteOrigenId;
    const productRaw = producto_id ?? productoId;
    const lineRaw = linea_id ?? lineaId;
    const vol = Number(volumen_leche_base_litros ?? volumen ?? allocatedLiters);
    const conAzucar = lleva_azucar ?? llevaAzucar ?? true;
    const varFermentado = variante_fermentado ?? variante ?? null;

    if (!parentRaw && !originRaw) {
      res.status(400).json({
        error: 'MISSING_FIELDS',
        message: 'Debe especificar el lote padre (lote_padre_id) o el lote de producción origen (lote_origen_id).',
      });
      return;
    }

    if (!productRaw || isNaN(vol) || vol <= 0) {
      res.status(400).json({
        error: 'MISSING_FIELDS',
        message: 'Se requiere producto_id y un volumen_leche_base_litros mayor a 0.',
      });
      return;
    }

    await client.query('BEGIN');

    // 1. Resolver Producto y su norma técnica
    const prodRes = await client.query(
      `SELECT id, codigo, nombre, tipo_linea, norma_tecnica 
       FROM productos 
       WHERE (id::text = $1 OR codigo = $1) AND activo = TRUE 
       LIMIT 1;`,
      [productRaw]
    );
    if (prodRes.rows.length === 0) {
      await client.query('ROLLBACK');
      res.status(404).json({ error: 'PRODUCT_NOT_FOUND', message: `Producto '${productRaw}' no encontrado.` });
      return;
    }
    const product = prodRes.rows[0];

    let verifiedParentId: string | null = null;
    let verifiedOriginId: string | null = null;
    let targetLineId: string | null = null;
    let parentUpdated: any = null;
    let parentCodePrefix = '';

    // 2. Partición desde Lote Padre
    if (parentRaw) {
      const parentRes = await client.query(
        `SELECT * FROM lotes_padre WHERE (id::text = $1 OR codigo_lote = $1) FOR UPDATE;`,
        [parentRaw]
      );
      if (parentRes.rows.length === 0) {
        await client.query('ROLLBACK');
        res.status(404).json({ error: 'PARENT_NOT_FOUND', message: 'Lote padre no encontrado.' });
        return;
      }
      const parent = parentRes.rows[0];
      if (parent.estado === 'COMPLETADO' || parent.estado === 'ANULADO') {
        await client.query('ROLLBACK');
        res.status(400).json({
          error: 'PARENT_CLOSED',
          message: `El lote padre ${parent.codigo_lote} está ${parent.estado} y no admite nuevas derivaciones.`,
        });
        return;
      }

      const remanentes = Number(parent.litros_remanentes);
      if (vol > remanentes) {
        await client.query('ROLLBACK');
        res.status(422).json({
          error: 'EXCESSIVE_VOLUME',
          message: `El volumen solicitado (${vol} L) supera los litros remanentes disponibles en el lote padre (${remanentes} L).`,
        });
        return;
      }

      verifiedParentId = parent.id;
      targetLineId = lineRaw ? await resolveLineId(client, lineRaw) : parent.linea_id;
      parentCodePrefix = parent.codigo_lote;

      const nuevoLitrosAsignados = Number(parent.litros_asignados) + vol;
      const nuevoLitrosRemanentes = remanentes - vol;
      const esDesvioTotal = nuevoLitrosRemanentes <= 0;

      // Actualizar el Lote Padre y evaluar regla de auto-cierre
      const updateParentSql = `
        UPDATE lotes_padre
        SET 
          litros_asignados = $1,
          litros_remanentes = $2,
          dividido_at = COALESCE(dividido_at, NOW()),
          estado = CASE WHEN $3 = true THEN 'COMPLETADO'::estado_lote_enum ELSE 'EN_PROCESO'::estado_lote_enum END,
          finalizado_at = CASE WHEN $3 = true THEN NOW() ELSE finalizado_at END,
          observaciones = CASE 
            WHEN $3 = true THEN 
              COALESCE(observaciones || ' | ', '') || 'Lote desviado en su totalidad hacia sub-lotes (0 L remanentes)'
            ELSE observaciones 
          END,
          updated_at = NOW()
        WHERE id = $4
        RETURNING *;
      `;
      const updateRes = await client.query(updateParentSql, [
        nuevoLitrosAsignados,
        nuevoLitrosRemanentes,
        esDesvioTotal,
        parent.id,
      ]);
      parentUpdated = updateRes.rows[0];
    } else if (originRaw) {
      // Partición desde Lote de Producción (desvío Yogur -> Kumis/Griego)
      const originRes = await client.query(
        `SELECT * FROM lotes_produccion WHERE (id::text = $1 OR codigo_lote = $1) FOR UPDATE;`,
        [originRaw]
      );
      if (originRes.rows.length === 0) {
        await client.query('ROLLBACK');
        res.status(404).json({ error: 'ORIGIN_BATCH_NOT_FOUND', message: 'Lote de origen no encontrado.' });
        return;
      }
      const origin = originRes.rows[0];
      const volOrigen = Number(origin.volumen_leche_base_litros);
      if (vol > volOrigen) {
        await client.query('ROLLBACK');
        res.status(422).json({
          error: 'EXCESSIVE_VOLUME',
          message: `El volumen a desviar (${vol} L) supera el volumen disponible en el lote origen (${volOrigen} L).`,
        });
        return;
      }

      verifiedOriginId = origin.id;
      verifiedParentId = origin.lote_padre_id;
      targetLineId = origin.linea_id;
      parentCodePrefix = origin.codigo_lote;

      const nuevoVolumenOrigen = volOrigen - vol;
      const esDesvioTotal = nuevoVolumenOrigen <= 0;

      // Actualizar lote origen
      await client.query(
        `UPDATE lotes_produccion
         SET 
           volumen_leche_base_litros = $1,
           estado = CASE WHEN $2 = true THEN 'COMPLETADO'::estado_lote_enum ELSE estado END,
           motivo_cierre = CASE WHEN $2 = true THEN 'DESVIO_TOTAL'::motivo_cierre_enum ELSE motivo_cierre END,
           finalizado_at = CASE WHEN $2 = true THEN NOW() ELSE finalizado_at END,
           observaciones_finales = CASE 
             WHEN $2 = true THEN 
               COALESCE(observaciones_finales || ' | ', '') || 'Lote desviado en su totalidad hacia sub-lotes (0 L remanentes)'
             ELSE observaciones_finales 
           END,
           updated_at = NOW()
         WHERE id = $3;`,
        [nuevoVolumenOrigen, esDesvioTotal, origin.id]
      );
    }

    if (!targetLineId) {
      targetLineId = await resolveLineId(client, lineRaw ?? 'L-FERMENT-02');
    }

    const responsableId = req.body.responsable_id ?? req.body.responsableId ?? req.user?.id;
    if (!responsableId) {
      await client.query('ROLLBACK');
      res.status(400).json({ error: 'MISSING_RESPONSABLE', message: 'No se identificó el responsable del lote.' });
      return;
    }

    // 3. Snapshot de Receta
    const recipeRes = await client.query(
      `SELECT especificaciones_json FROM recetas_estandares WHERE producto_id = $1 AND activo = TRUE ORDER BY version_receta DESC LIMIT 1;`,
      [product.id]
    );
    const recetaSnapshot = req.body.receta_snapshot ?? req.body.recetaSnapshot ?? (recipeRes.rows[0]?.especificaciones_json ?? {
      estandar: product.nombre,
      producto_codigo: product.codigo,
      fecha_creacion: new Date().toISOString(),
    });

    // 4. Etapas según catálogo
    const stagesRes = await client.query(
      `SELECT id, codigo_ui, nombre, orden_secuencia 
       FROM etapas_catalogo 
       WHERE producto_id = $1 
       ORDER BY orden_secuencia ASC;`,
      [product.id]
    );
    const initialStageCode = stagesRes.rows[0]?.codigo_ui ?? 'acidificar';

    // 5. Código del nuevo lote
    const newBatchCode = (codigo_lote ?? codigoLote ?? `${parentCodePrefix}-${product.codigo}`).trim();

    // 6. Insertar en lotes_produccion
    const insertChildSql = `
      INSERT INTO lotes_produccion (
        codigo_lote,
        lote_padre_id,
        lote_origen_id,
        producto_id,
        linea_id,
        responsable_id,
        norma_tecnica_aplicada,
        receta_snapshot,
        variante_fermentado,
        volumen_leche_base_litros,
        lleva_azucar,
        estado,
        en_ajuste,
        etapa_actual_codigo,
        iniciado_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'EN_PROCESO', false, $12, NOW()
      ) RETURNING *;
    `;
    const childResult = await client.query(insertChildSql, [
      newBatchCode,
      verifiedParentId,
      verifiedOriginId,
      product.id,
      targetLineId,
      responsableId,
      product.norma_tecnica ?? 'NTC-805',
      recetaSnapshot,
      varFermentado,
      vol,
      conAzucar,
      initialStageCode,
    ]);
    const childBatch = childResult.rows[0];

    // 7. Instanciar etapas de ejecución
    for (let i = 0; i < stagesRes.rows.length; i++) {
      const stage = stagesRes.rows[i];
      const isFirst = i === 0;
      await client.query(
        `INSERT INTO lote_etapas_ejecucion (
          lote_id,
          etapa_catalogo_id,
          estado,
          iniciado_at,
          operario_responsable_id
        ) VALUES ($1, $2, $3, $4, $5);`,
        [
          childBatch.id,
          stage.id,
          isFirst ? 'en_proceso' : 'pendiente',
          isFirst ? new Date() : null,
          isFirst ? responsableId : null,
        ]
      );
    }

    // 8. Asociar operario interviniente
    await client.query(
      `INSERT INTO lote_operarios_intervinientes (lote_id, usuario_id, rol_en_proceso)
       VALUES ($1, $2, 'Operador Inicial')
       ON CONFLICT (lote_id, usuario_id) DO NOTHING;`,
      [childBatch.id, responsableId]
    );

    // 9. Si provino de lote_origen_id, registrar en auditoría de desvíos
    if (verifiedOriginId) {
      await client.query(
        `INSERT INTO lote_extracciones_sublote (
          lote_origen_id,
          lote_destino_id,
          etapa_origen_codigo,
          litros_anteriores,
          litros_nuevos,
          es_desvio_total,
          operario_id
        ) VALUES ($1, $2, 'pasteurizacion', $3, $4, $5, $6);`,
        [
          verifiedOriginId,
          childBatch.id,
          req.body.litros_anteriores ?? 0,
          vol,
          parentUpdated ? false : (vol >= Number(req.body.volumen_total_origen ?? vol)),
          responsableId,
        ]
      );
    }

    await client.query('COMMIT');

    res.status(201).json({
      message: 'Sub-lote de producción creado exitosamente.',
      childBatch,
      parentBatchUpdated: parentUpdated,
    });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('[batch] Error al crear sub-lote:', error);
    if (error.code === '23505') {
      res.status(409).json({ error: 'DUPLICATE_CODE', message: 'El código de lote ya existe.' });
      return;
    }
    res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message ?? 'Error al registrar sub-lote de producción.' });
  } finally {
    client.release();
  }
}

/**
 * POST /api/batches/:batchId/complete
 * Pasa el estado del lote (padre o hijo) a 'COMPLETADO', activando los triggers de seguridad de solo lectura.
 */
export async function completeBatch(req: Request, res: Response): Promise<void> {
  const client: PoolClient = await pool.connect();
  try {
    const { batchId } = req.params;
    if (!batchId) {
      res.status(400).json({ error: 'MISSING_PARAM', message: 'Se requiere batchId en la URL.' });
      return;
    }

    const {
      motivo_cierre,
      motivoCierre,
      temp_almacenamiento_celsius,
      tempAlmacenamiento,
      lote_producto_terminado,
      loteProductoTerminado,
      fecha_vencimiento,
      fechaVencimiento,
      observaciones_finales,
      observacionesFinales,
    } = req.body;

    const motivo = motivo_cierre ?? motivoCierre ?? 'CUARTO_FRIO';
    const tempFrio = temp_almacenamiento_celsius ?? tempAlmacenamiento ?? 4.0;
    const ptLote = lote_producto_terminado ?? loteProductoTerminado ?? null;
    const fVenc = fecha_vencimiento ?? fechaVencimiento ?? null;
    const obs = observaciones_finales ?? observacionesFinales ?? null;

    await client.query('BEGIN');

    // 1. Verificar si es un lote de producción (lotes_produccion)
    const childCheck = await client.query(
      `SELECT * FROM lotes_produccion WHERE (id::text = $1 OR codigo_lote = $1) FOR UPDATE;`,
      [batchId]
    );

    if (childCheck.rows.length > 0) {
      const batch = childCheck.rows[0];
      if (batch.estado === 'COMPLETADO') {
        await client.query('ROLLBACK');
        res.status(400).json({ error: 'ALREADY_COMPLETED', message: 'El lote de producción ya se encuentra completado.' });
        return;
      }
      if (batch.estado === 'ANULADO') {
        await client.query('ROLLBACK');
        res.status(400).json({ error: 'BATCH_ANULADO', message: 'No se puede completar un lote anulado.' });
        return;
      }

      const updateSql = `
        UPDATE lotes_produccion
        SET 
          estado = 'COMPLETADO',
          finalizado_at = NOW(),
          motivo_cierre = $1::motivo_cierre_enum,
          ingreso_cuarto_frio_at = CASE WHEN $1 = 'CUARTO_FRIO' THEN NOW() ELSE ingreso_cuarto_frio_at END,
          temp_almacenamiento_celsius = COALESCE($2, temp_almacenamiento_celsius, 4.0),
          lote_producto_terminado = COALESCE($3, lote_producto_terminado),
          fecha_vencimiento = COALESCE($4::date, fecha_vencimiento),
          observaciones_finales = COALESCE($5, observaciones_finales),
          duracion_total_segundos = COALESCE(duracion_total_segundos, EXTRACT(EPOCH FROM (NOW() - iniciado_at))::integer),
          updated_at = NOW()
        WHERE id = $6
        RETURNING *;
      `;
      const updateRes = await client.query(updateSql, [
        motivo,
        tempFrio,
        ptLote,
        fVenc,
        obs,
        batch.id,
      ]);

      await client.query('COMMIT');
      res.status(200).json({
        message: `Lote ${batch.codigo_lote} completado exitosamente y bloqueado en solo lectura.`,
        batch: updateRes.rows[0],
      });
      return;
    }

    // 2. Verificar si es un lote padre (lotes_padre)
    const parentCheck = await client.query(
      `SELECT * FROM lotes_padre WHERE (id::text = $1 OR codigo_lote = $1) FOR UPDATE;`,
      [batchId]
    );

    if (parentCheck.rows.length > 0) {
      const parent = parentCheck.rows[0];
      if (parent.estado === 'COMPLETADO') {
        await client.query('ROLLBACK');
        res.status(400).json({ error: 'ALREADY_COMPLETED', message: 'El lote padre ya se encuentra completado.' });
        return;
      }
      if (parent.estado === 'ANULADO') {
        await client.query('ROLLBACK');
        res.status(400).json({ error: 'BATCH_ANULADO', message: 'No se puede completar un lote padre anulado.' });
        return;
      }

      const updateParentSql = `
        UPDATE lotes_padre
        SET 
          estado = 'COMPLETADO',
          finalizado_at = NOW(),
          observaciones = COALESCE($1, observaciones),
          updated_at = NOW()
        WHERE id = $2
        RETURNING *;
      `;
      const updateRes = await client.query(updateParentSql, [obs, parent.id]);

      await client.query('COMMIT');
      res.status(200).json({
        message: `Lote padre ${parent.codigo_lote} completado exitosamente y bloqueado en solo lectura.`,
        parentBatch: updateRes.rows[0],
      });
      return;
    }

    // 3. No encontrado en ninguna de las dos tablas
    await client.query('ROLLBACK');
    res.status(404).json({ error: 'BATCH_NOT_FOUND', message: `Lote '${batchId}' no encontrado.` });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('[batch] Error al completar lote:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message ?? 'Error al completar el lote.' });
  } finally {
    client.release();
  }
}
