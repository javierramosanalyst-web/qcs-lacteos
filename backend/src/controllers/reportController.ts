import { Request, Response } from 'express';
import { pool } from '../db';
import { productionDetail, productionFlavors, productionOutcome } from './workspaceController';

/**
 * Reporte de producción por período (para el Excel del administrador y el panel).
 *
 * Todo se filtra en el servidor por la FECHA DE INICIO del lote en hora de Colombia, sin tope
 * de lotes. Devuelve una tabla por cada tipo de dato (lotes, etapas, pasos con hora, mediciones,
 * envasado, insumos y correcciones), unidas por `lote_id` (código interno; las letras del día
 * se repiten entre productos y no sirven de llave).
 */

const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Nombre legible de cada paso con hora registrado por el operario (lote_hitos_proceso.codigo_hito). */
const PASOS: Record<string, string> = {
  inicio_calentamiento: 'Inicio del calentamiento',
  temperatura_35_alcanzada: '35 °C alcanzados',
  adicion_cuajo: 'Adición de cuajo',
  adicion_cuajo_pera: 'Adición de cuajo',
  cultivo_lactico: 'Adición de cultivo láctico',
  llegada_40: '40 °C alcanzados',
  temperatura_40_alcanzada: '40 °C alcanzados',
  cuajado: 'Cuajado',
  corte: 'Corte de la cuajada',
  fin_reposo_ph58: 'Fin del reposo (pH 5,8)',
  desuerado: 'Desuerado',
  escurrido: 'Escurrido',
  prueba_hilado: 'Prueba de hilado',
  hilado_en_paila: 'Hilado en paila',
  salmuera_fria: 'Salmuera fría',
  calentamiento: 'Calentamiento (85-90 °C)',
  sostenimiento_termico: 'Sostenimiento térmico',
  adicion_azucar: 'Adición de azúcar',
  enfriamiento: 'Enfriamiento',
  trasiego_cantinas: 'Trasiego a cantinas',
  mezclado_cultivo: 'Mezclado del cultivo',
  inoculacion: 'Inoculación',
  incubacion: 'Incubación',
  traslado_cantinas_frio: 'Traslado de cantinas al frío',
  refrigeracion: 'Refrigeración',
  cuarto_frio: 'Maduración en cuarto frío',
  filtrado_telas: 'Filtrado en telas',
  batido: 'Batido',
  salida_cuarto_frio: 'Salida del cuarto frío',
  adiciones: 'Registro de adiciones',
  preparacion_tolva: 'Preparación de la tolva',
  ingreso_cuarto_frio_final: 'Ingreso al cuarto frío',
  proceso_finalizado: 'Proceso finalizado',
};

const capitalizar = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Misma clave que usa la trazabilidad para los pasos por sabor (pierde tildes y espacios). */
const claveSabor = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '_');

/** Sabores de un lote: clave -> nombre real con tildes ("guan_bana" -> "Guanábana"). */
const saboresDeLote = (estadoUi: any): Map<string, string> => {
  const lista = estadoUi?.batch?.batidoYAdiciones?.lotesSabor;
  const m = new Map<string, string>();
  if (Array.isArray(lista)) {
    for (const l of lista) {
      const nombre = String(l?.sabor ?? l?.id ?? '').trim();
      if (nombre) m.set(claveSabor(nombre), nombre);
    }
  }
  return m;
};

export const nombrePaso = (codigo: string, sabores?: Map<string, string>): string => {
  if (PASOS[codigo]) return PASOS[codigo];
  const sabor = /^(batido_a_envasado|batido|envasado)_(.+)$/.exec(codigo);
  if (sabor) {
    const que = sabor[1] === 'batido_a_envasado' ? 'Batido a envasado' : capitalizar(sabor[1]);
    const nombre = sabores?.get(sabor[2]) ?? capitalizar(sabor[2].replace(/_/g, ' '));
    return `${que} (${nombre})`;
  }
  return capitalizar(codigo.replace(/_/g, ' '));
};

/** Etapas (inicio, fin, duración y operario) y pasos con hora de un conjunto de lotes. */
async function tiemposDeLotes(ids: string[], sabores: Map<string, Map<string, string>> = new Map()) {
  if (ids.length === 0) return { etapas: [], pasos: [] };
  const etapas = await pool.query(
    `SELECT le.lote_id, ec.orden_secuencia AS orden, ec.codigo_ui, ec.nombre AS etapa, le.estado,
            le.iniciado_at AS inicio, le.finalizado_at AS fin, le.duracion_segundos,
            u.nombre_completo AS operario
     FROM lote_etapas_ejecucion le
     JOIN etapas_catalogo ec ON ec.id = le.etapa_catalogo_id
     LEFT JOIN usuarios u ON u.id = le.operario_responsable_id
     WHERE le.lote_id = ANY($1::uuid[])
     ORDER BY le.lote_id, ec.orden_secuencia;`,
    [ids]
  );
  const pasos = await pool.query(
    `SELECT h.lote_id, ec.orden_secuencia AS orden, ec.nombre AS etapa, h.codigo_hito,
            h.iniciado_at AS inicio, h.finalizado_at AS fin, h.duracion_segundos, h.es_captura_manual AS manual
     FROM lote_hitos_proceso h
     JOIN lote_etapas_ejecucion le ON le.id = h.lote_etapa_id
     JOIN etapas_catalogo ec ON ec.id = le.etapa_catalogo_id
     WHERE h.lote_id = ANY($1::uuid[])
     ORDER BY h.lote_id, COALESCE(h.iniciado_at, h.finalizado_at), ec.orden_secuencia;`,
    [ids]
  );
  return {
    etapas: etapas.rows,
    pasos: pasos.rows.map((p: any) => ({ ...p, paso: nombrePaso(p.codigo_hito, sabores.get(p.lote_id)) })),
  };
}

/** GET /api/workspace/reporte?desde=AAAA-MM-DD&hasta=AAAA-MM-DD&linea=&producto=&estado=&responsable=&lote= */
export async function getProductionReport(req: Request, res: Response): Promise<void> {
  try {
    const q = req.query as Record<string, string | undefined>;
    const desde = q.desde && FECHA_RE.test(q.desde) ? q.desde : null;
    const hasta = q.hasta && FECHA_RE.test(q.hasta) ? q.hasta : null;
    const params: unknown[] = [];
    const where: string[] = [];
    const add = (condicion: (marca: string) => string, valor: unknown) => {
      params.push(valor);
      where.push(condicion(`$${params.length}`));
    };
    if (desde) add((m) => `(lp.iniciado_at AT TIME ZONE 'America/Bogota')::date >= ${m}::date`, desde);
    if (hasta) add((m) => `(lp.iniciado_at AT TIME ZONE 'America/Bogota')::date <= ${m}::date`, hasta);
    if (q.linea) add((m) => `l.codigo = ${m}`, q.linea);
    if (q.producto) add((m) => `p.codigo = ${m}`, q.producto);
    if (q.estado) add((m) => `lp.estado::text = ${m}`, q.estado);
    if (q.responsable) add((m) => `u.nombre_completo = ${m}`, q.responsable);
    if (q.lote) {
      const t = String(q.lote).trim();
      if (/^[0-9a-f-]{36}$/i.test(t)) add((m) => `lp.id::text = ${m}`, t);
      else add((m) => `(lp.lote_dia ILIKE ${m} OR lp.codigo_lote ILIKE ${m})`, `%${t}%`);
    }
    const sqlWhere = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const lotesRes = await pool.query(
      `SELECT lp.id, lp.codigo_lote, lp.lote_dia, lp.estado, lp.etapa_actual_codigo, lp.volumen_leche_base_litros,
              lp.iniciado_at, lp.finalizado_at, lp.duracion_total_segundos, lp.estado_ui, lp.observaciones_finales,
              p.nombre AS producto_nombre, p.codigo AS producto_codigo,
              l.nombre AS linea_nombre, l.codigo AS linea_codigo,
              u.nombre_completo AS responsable_nombre,
              (SELECT string_agg(DISTINCT uo.nombre_completo, ', ')
                 FROM lote_operarios_intervinientes oi JOIN usuarios uo ON uo.id = oi.usuario_id
                 WHERE oi.lote_id = lp.id) AS operarios,
              (SELECT ec.nombre FROM etapas_catalogo ec
                 WHERE ec.producto_id = lp.producto_id AND ec.codigo_ui = lp.etapa_actual_codigo LIMIT 1) AS etapa_actual,
              (SELECT COUNT(*) FROM auditoria_rectificaciones ar WHERE ar.lote_id = lp.id AND ar.accion = 'RECTIFICACION')::int AS correcciones,
              an.justificacion_tecnica AS anulacion_motivo, an.registrado_at AS anulado_at, an.autor AS anulado_por
       FROM lotes_produccion lp
       JOIN productos p ON p.id = lp.producto_id
       JOIN lineas_produccion l ON l.id = lp.linea_id
       JOIN usuarios u ON u.id = lp.responsable_id
       LEFT JOIN LATERAL (
         SELECT ar.justificacion_tecnica, ar.registrado_at, ua.nombre_completo AS autor
         FROM auditoria_rectificaciones ar JOIN usuarios ua ON ua.id = ar.autorizado_por_id
         WHERE ar.lote_id = lp.id AND ar.accion = 'ANULACION'
         ORDER BY ar.registrado_at DESC LIMIT 1
       ) an ON lp.estado = 'ANULADO'
       ${sqlWhere}
       ORDER BY lp.iniciado_at ASC;`,
      params
    );

    const lotes: any[] = [];
    const envasado: any[] = [];
    for (const r of lotesRes.rows) {
      const { estado_ui, ...rest } = r;
      const leche = Number(r.volumen_leche_base_litros) || null;
      const resultado = r.estado === 'ANULADO' ? { kg_producidos: null, unidades_producidas: null, rendimiento_pct: null } : productionOutcome(estado_ui, leche);
      lotes.push({ ...rest, volumen_leche_base_litros: leche, ...resultado, sabores: productionFlavors(estado_ui) });
      if (r.estado !== 'ANULADO') {
        for (const d of productionDetail(estado_ui)) envasado.push({ lote_id: r.id, ...d });
      }
    }
    const ids = lotes.map((l) => l.id);
    const sabores = new Map(lotesRes.rows.map((r: any) => [r.id, saboresDeLote(r.estado_ui)]));
    const { etapas, pasos } = await tiemposDeLotes(ids, sabores);

    const mediciones = ids.length
      ? (
          await pool.query(
            `SELECT m.lote_id, ec.orden_secuencia AS orden, ec.nombre AS etapa, pm.nombre AS parametro, m.valor_numerico AS valor,
                    pm.unidad, m.es_captura_manual AS manual,
                    -- Sin hora propia en pantalla, la medición queda con la hora de creación del lote: no se muestra.
                    CASE WHEN abs(extract(epoch FROM (m.registrado_at - lp.created_at))) < 0.002 THEN NULL ELSE m.registrado_at END AS hora
             FROM mediciones_fisicoquimicas m
             JOIN lotes_produccion lp ON lp.id = m.lote_id
             JOIN parametros_medicion pm ON pm.codigo = m.parametro_codigo
             JOIN lote_etapas_ejecucion le ON le.id = m.lote_etapa_id
             JOIN etapas_catalogo ec ON ec.id = le.etapa_catalogo_id
             WHERE m.lote_id = ANY($1::uuid[])
             ORDER BY m.lote_id, ec.orden_secuencia, m.registrado_at;`,
            [ids]
          )
        ).rows
      : [];

    const insumos = ids.length
      ? (
          await pool.query(
            `SELECT i.lote_id, ec.orden_secuencia AS orden, COALESCE(ec.nombre, 'Moldeo') AS etapa, i.tipo_insumo, i.insumo_nombre_snapshot AS insumo,
                    i.codigo_lote_insumo AS lote_insumo, i.cantidad_utilizada AS cantidad, i.unidad_medida AS unidad,
                    i.registrado_at AS hora, i.es_dosificacion_manual AS manual,
                    d.tipo_derivacion AS derivacion
             FROM lote_insumos_utilizados i
             LEFT JOIN lote_etapas_ejecucion le ON le.id = i.lote_etapa_id
             LEFT JOIN etapas_catalogo ec ON ec.id = le.etapa_catalogo_id
             LEFT JOIN lote_derivaciones_quesos d ON d.id = i.derivacion_id
             WHERE i.lote_id = ANY($1::uuid[])
             ORDER BY i.lote_id, ec.orden_secuencia NULLS LAST, i.registrado_at;`,
            [ids]
          )
        ).rows
      : [];

    const correcciones = ids.length
      ? (
          await pool.query(
            `SELECT ar.lote_id, ar.accion, ar.registrado_at AS fecha, ar.etapa_label AS etapa, ar.campo_label AS campo,
                    ar.valor_anterior, ar.valor_nuevo, ar.unidad, ar.categoria_motivo AS motivo,
                    ar.justificacion_tecnica AS justificacion, u.nombre_completo AS autorizado_por
             FROM auditoria_rectificaciones ar
             JOIN usuarios u ON u.id = ar.autorizado_por_id
             WHERE ar.lote_id = ANY($1::uuid[])
             ORDER BY ar.registrado_at;`,
            [ids]
          )
        ).rows
      : [];

    res.json({
      generado_at: new Date().toISOString(),
      filtros: { desde, hasta, linea: q.linea ?? null, producto: q.producto ?? null, estado: q.estado ?? null, responsable: q.responsable ?? null, lote: q.lote ?? null },
      lotes,
      etapas,
      pasos,
      mediciones,
      envasado,
      insumos,
      correcciones,
    });
  } catch (error) {
    console.error('[reporte] Error al generar el reporte:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Error al generar el reporte de producción.' });
  }
}

/** GET /api/workspace/batches/:loteId/tiempos  Etapas y pasos con hora de un lote (resumen del lote). */
export async function getBatchTimes(req: Request, res: Response): Promise<void> {
  try {
    const found = await pool.query(
      `SELECT id, estado_ui FROM lotes_produccion WHERE id::text = $1 OR codigo_lote = $1 LIMIT 1;`,
      [req.params.loteId]
    );
    if (found.rows.length === 0) {
      res.json({ etapas: [], pasos: [] });
      return;
    }
    const lote = found.rows[0];
    res.json(await tiemposDeLotes([lote.id], new Map([[lote.id, saboresDeLote(lote.estado_ui)]])));
  } catch (error) {
    console.error('[reporte] Error al consultar los tiempos del lote:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Error al consultar los tiempos del lote.' });
  }
}
