import { Request, Response } from 'express';
import { PoolClient } from 'pg';
import { pool } from '../db';

interface PresentationInput {
  formato_id?: string;
  formatoId?: string;
  formato_codigo?: string;
  formatoCodigo?: string;
  codigo?: string;
  descripcion_formato?: string;
  descripcionFormato?: string;
  capacidad_unitaria?: number;
  capacidadUnitaria?: number;
  unidad_medida?: 'L' | 'kg';
  unidadMedida?: 'L' | 'kg';
  categoria_variedad?: string;
  categoriaVariedad?: string;
  unidades_conteo?: number;
  unidadesConteo?: number;
  unidades?: number;
  cantidad?: number;
  derivacion_id?: string | null;
  derivacionId?: string | null;
  es_captura_manual?: boolean;
  esCapturaManual?: boolean;
}

/**
 * POST /api/batches/:batchId/packaging
 * Registra o actualiza conteos de presentaciones en lote_presentaciones_envasado.
 * Admite tanto un objeto individual como un arreglo de presentaciones.
 * El total_volumen_o_peso es calculado automáticamente por la base de datos (GENERATED STORED).
 */
export async function addPackagingRecord(req: Request, res: Response): Promise<void> {
  const client: PoolClient = await pool.connect();
  try {
    const batchId = res.locals.batch?.id ?? req.params.batchId;
    const bodyItems: PresentationInput[] = Array.isArray(req.body)
      ? req.body
      : (req.body.presentaciones ?? req.body.items ?? [req.body]);

    if (!bodyItems || bodyItems.length === 0) {
      res.status(400).json({
        error: 'MISSING_FIELDS',
        message: 'Debe suministrar al menos un registro de formato de envase para envasado.',
      });
      return;
    }

    await client.query('BEGIN');

    const results = [];

    for (const item of bodyItems) {
      const formatIdentifier = (
        item.formato_id ??
        item.formatoId ??
        item.formato_codigo ??
        item.formatoCodigo ??
        item.codigo ??
        ''
      ).trim();

      const unidades = Number(item.unidades_conteo ?? item.unidadesConteo ?? item.unidades ?? item.cantidad ?? 0);
      const derivacion = item.derivacion_id ?? item.derivacionId ?? null;
      const manual = item.es_captura_manual ?? item.esCapturaManual ?? false;

      if (!formatIdentifier) {
        await client.query('ROLLBACK');
        res.status(400).json({ error: 'MISSING_FORMAT', message: 'Se requiere formato_id en cada registro.' });
        return;
      }

      if (isNaN(unidades) || unidades < 0) {
        await client.query('ROLLBACK');
        res.status(400).json({ error: 'INVALID_COUNT', message: 'Las unidades de conteo deben ser un número >= 0.' });
        return;
      }

      // Buscar formato en el catálogo formatos_envase
      const formatRes = await client.query(
        `SELECT id, codigo, descripcion, tipo_linea, categoria_variedad, capacidad_unitaria, unidad_medida 
         FROM formatos_envase 
         WHERE id::text = $1 OR codigo = $1 
         LIMIT 1;`,
        [formatIdentifier]
      );

      let formatoId: string;
      let descripcion: string;
      let capacidad: number;
      let unidadMedida: string;
      let categoria: string;

      if (formatRes.rows.length > 0) {
        const f = formatRes.rows[0];
        formatoId = f.id;
        descripcion = item.descripcion_formato ?? item.descripcionFormato ?? f.descripcion;
        capacidad = Number(item.capacidad_unitaria ?? item.capacidadUnitaria ?? f.capacidad_unitaria);
        unidadMedida = item.unidad_medida ?? item.unidadMedida ?? f.unidad_medida;
        categoria = item.categoria_variedad ?? item.categoriaVariedad ?? f.categoria_variedad ?? 'estandar';
      } else {
        await client.query('ROLLBACK');
        res.status(404).json({
          error: 'FORMAT_NOT_FOUND',
          message: `Formato de envase '${formatIdentifier}' no encontrado en el catálogo maestro.`,
        });
        return;
      }

      // Inserción con UPSERT idempotente según los índices parciales uq_presentacion_*
      let query: string;
      let params: any[];

      if (derivacion) {
        query = `
          INSERT INTO lote_presentaciones_envasado (
            lote_id, derivacion_id, formato_id, descripcion_formato,
            capacidad_unitaria, unidad_medida, categoria_variedad,
            unidades_conteo, es_captura_manual
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          ON CONFLICT (lote_id, derivacion_id, formato_id, categoria_variedad) WHERE derivacion_id IS NOT NULL
          DO UPDATE SET 
            unidades_conteo = EXCLUDED.unidades_conteo,
            es_captura_manual = EXCLUDED.es_captura_manual,
            descripcion_formato = EXCLUDED.descripcion_formato,
            capacidad_unitaria = EXCLUDED.capacidad_unitaria,
            unidad_medida = EXCLUDED.unidad_medida
          RETURNING *;
        `;
        params = [batchId, derivacion, formatoId, descripcion, capacidad, unidadMedida, categoria, unidades, manual];
      } else {
        query = `
          INSERT INTO lote_presentaciones_envasado (
            lote_id, derivacion_id, formato_id, descripcion_formato,
            capacidad_unitaria, unidad_medida, categoria_variedad,
            unidades_conteo, es_captura_manual
          ) VALUES ($1, NULL, $2, $3, $4, $5, $6, $7, $8)
          ON CONFLICT (lote_id, formato_id, categoria_variedad) WHERE derivacion_id IS NULL
          DO UPDATE SET 
            unidades_conteo = EXCLUDED.unidades_conteo,
            es_captura_manual = EXCLUDED.es_captura_manual,
            descripcion_formato = EXCLUDED.descripcion_formato,
            capacidad_unitaria = EXCLUDED.capacidad_unitaria,
            unidad_medida = EXCLUDED.unidad_medida
          RETURNING *;
        `;
        params = [batchId, formatoId, descripcion, capacidad, unidadMedida, categoria, unidades, manual];
      }

      const rowRes = await client.query(query, params);
      results.push(rowRes.rows[0]);
    }

    await client.query('COMMIT');

    res.status(201).json({
      message: `Se registraron exitosamente ${results.length} presentación(es) de envasado.`,
      presentaciones: results,
    });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('[packaging] Error al registrar envasado:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message ?? 'Error al registrar envasado.' });
  } finally {
    client.release();
  }
}

/**
 * GET /api/batches/:batchId/packaging
 * Consulta las presentaciones envasadas registradas para un lote.
 */
export async function getPackagingRecords(req: Request, res: Response): Promise<void> {
  try {
    const batchId = res.locals.batch?.id ?? req.params.batchId;
    const query = `
      SELECT 
        p.*,
        fe.codigo AS formato_codigo
      FROM lote_presentaciones_envasado p
      JOIN formatos_envase fe ON fe.id = p.formato_id
      WHERE p.lote_id = $1
      ORDER BY p.created_at ASC;
    `;
    const { rows } = await pool.query(query, [batchId]);
    res.status(200).json(rows);
  } catch (error: any) {
    console.error('[packaging] Error al consultar envasado:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Error al consultar registros de envasado.' });
  }
}

/**
 * POST /api/batches/:batchId/derivations
 * Registra una derivación de sub-lote de queso (Mexicano, Finas Hierbas, etc.) en lote_derivaciones_quesos.
 */
export async function addCheeseDerivation(req: Request, res: Response): Promise<void> {
  const client: PoolClient = await pool.connect();
  try {
    const batchId = res.locals.batch?.id ?? req.params.batchId;
    const {
      tipo_derivacion,
      tipoDerivacion,
      codigo_sub_lote,
      codigoSubLote,
      lote_base_origen,
      loteBaseOrigen,
      peso_pasta_utilizado_kg,
      pesoPastaUtilizadoKg,
      pesoPasta,
      es_edicion_manual,
      esEdicionManual,
    } = req.body;

    const tipo = (tipo_derivacion ?? tipoDerivacion ?? '').trim();
    const codigo = (codigo_sub_lote ?? codigoSubLote ?? '').trim();
    const baseOrigen = lote_base_origen ?? loteBaseOrigen ?? null;
    const peso = Number(peso_pasta_utilizado_kg ?? pesoPastaUtilizadoKg ?? pesoPasta ?? 0);
    const manual = es_edicion_manual ?? esEdicionManual ?? false;

    const tiposValidos = ['mexicano', 'finas_hierbas', 'quesadilla_arequipe', 'quesadilla_bocadillo'];
    if (!tiposValidos.includes(tipo)) {
      res.status(400).json({
        error: 'INVALID_DERIVATION_TYPE',
        message: `Tipo de derivación inválido. Valores permitidos: ${tiposValidos.join(', ')}.`,
      });
      return;
    }

    if (!codigo) {
      res.status(400).json({ error: 'MISSING_CODE', message: 'Se requiere codigo_sub_lote.' });
      return;
    }

    await client.query('BEGIN');

    const upsertSql = `
      INSERT INTO lote_derivaciones_quesos (
        lote_id, tipo_derivacion, codigo_sub_lote, lote_base_origen,
        peso_pasta_utilizado_kg, es_edicion_manual
      ) VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (lote_id, tipo_derivacion)
      DO UPDATE SET
        codigo_sub_lote = EXCLUDED.codigo_sub_lote,
        lote_base_origen = EXCLUDED.lote_base_origen,
        peso_pasta_utilizado_kg = EXCLUDED.peso_pasta_utilizado_kg,
        es_edicion_manual = EXCLUDED.es_edicion_manual
      RETURNING *;
    `;
    const { rows } = await client.query(upsertSql, [batchId, tipo, codigo, baseOrigen, peso, manual]);

    await client.query('COMMIT');

    res.status(201).json({
      message: `Derivación '${tipo}' registrada exitosamente.`,
      derivacion: rows[0],
    });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('[packaging] Error al registrar derivación:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message ?? 'Error al registrar derivación.' });
  } finally {
    client.release();
  }
}
