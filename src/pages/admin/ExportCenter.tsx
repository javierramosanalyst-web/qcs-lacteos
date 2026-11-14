import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ProductDefinition, ProductionLine, UserProfile } from '../../types';
import { ReporteLote, ReporteProduccion, fetchProductionReport } from '../../api/client';
import {
  CellValue,
  ExportColumn,
  ExportSheet,
  buildCsv,
  excelDuracion,
  excelFecha,
  exportXlsx,
  exportZip,
} from '../../utils/exporters';
import { loteDeFila } from '../../utils/lote';

/**
 * Centro de exportación del administrador.
 *
 * Un solo reporte de producción, armado en el servidor por la FECHA DE INICIO del lote (hora de
 * Colombia) y sin tope de lotes. Cada hoja tiene un solo nivel de detalle y todas se unen por
 * "Lote" + "Producto" + "Hora de inicio" (las letras del día se repiten entre productos y entre
 * lotes del mismo producto del mismo día):
 *   1. Resumen (por producto, con alertas)
 *   2. Lotes (una fila por lote)
 *   3. Una hoja por producto: una fila por lote con los tiempos de cada etapa y de cada paso
 *      y el valor de cada medición, en columnas (cada producto tiene etapas y mediciones distintas)
 *   4. Envasado (una fila por presentación)  5. Insumos (una fila por insumo)
 *   6. Correcciones (correcciones y anulaciones)
 * Fechas, horas y duraciones van como valores reales de Excel (se pueden ordenar y restar).
 */

interface ExportCenterProps {
  lines: ProductionLine[];
  products: ProductDefinition[];
  users: UserProfile[];
}

const ESTADO_LABEL: Record<string, string> = {
  EN_PROCESO: 'En proceso',
  COMPLETADO: 'Completado',
  ANULADO: 'Anulado',
  PENDIENTE: 'Pendiente',
};

const ETAPA_ESTADO: Record<string, string> = { pendiente: 'Pendiente', en_proceso: 'En proceso', completada: 'Completada' };

const card = 'bg-white rounded-2xl border border-[#D6DEEA] shadow-xs';
const TZ = 'America/Bogota';

const toDate = (v: string | number | null | undefined): Date | null => {
  if (v === null || v === undefined || v === '') return null;
  const d = new Date(v);
  return Number.isFinite(d.getTime()) ? d : null;
};

const fmtDate = (v: string | number | null | undefined): string => {
  const d = toDate(v);
  return d ? d.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: TZ }) : '';
};

const fmtTime = (v: string | number | null | undefined): string => {
  const d = toDate(v);
  return d ? d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: TZ }) : '';
};

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** Duración en segundos: la registrada o, si falta, la diferencia entre fin e inicio. */
const segundos = (dur: number | null | undefined, inicio: string | null, fin: string | null): number | null => {
  if (dur !== null && dur !== undefined && dur > 0) return dur;
  const a = toDate(inicio)?.getTime();
  const b = toDate(fin)?.getTime();
  return a !== undefined && b !== undefined && b >= a ? Math.round((b - a) / 1000) : dur ?? null;
};

/** Día en hora de Colombia, AAAA-MM-DD. */
const diaColombia = (d: Date): string => d.toLocaleDateString('en-CA', { timeZone: TZ });

const sumarDias = (dia: string, n: number): string => {
  const d = new Date(`${dia}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

const ddmm = (dia: string) => `${dia.slice(8, 10)}/${dia.slice(5, 7)}/${dia.slice(0, 4)}`;

// ---------------------------------------------------------------------------------------------
// Construcción de las hojas
// ---------------------------------------------------------------------------------------------

type Fila = Record<string, CellValue>;

const COL_LOTE: ExportColumn[] = [
  { key: 'lote', label: 'Lote' },
  { key: 'producto', label: 'Producto' },
  { key: 'fecha', label: 'Fecha de inicio', format: 'fecha' },
  { key: 'horaIni', label: 'Hora de inicio', format: 'hora' },
];

const baseFila = (l: ReporteLote | undefined): Fila => {
  const ini = l ? excelFecha(l.iniciado_at) : null;
  return {
    lote: l ? loteDeFila(l) : '',
    producto: l?.producto_nombre ?? '',
    fecha: ini !== null ? Math.floor(ini) : null,
    horaIni: ini !== null ? ini - Math.floor(ini) : null,
  };
};

/** Nombre corto del producto para la hoja (Excel admite máximo 31 caracteres). */
const NOMBRE_HOJA: Record<string, string> = {
  'QDC-PREM': 'Doble Crema Premium',
  'QDC-IND': 'Doble Crema Industrial',
  'QP-2026': 'Queso Pera',
  'Q7C-2026': 'Queso 7 Cueros',
  'YOG-101': 'Yogur Entero',
  'KUM-102': 'Kumis',
  'YGR-103': 'Yogur Griego',
};

const ms = (iso: string | null | undefined) => toDate(iso)?.getTime() ?? null;

/**
 * Hoja de proceso de un producto: una fila por lote; en columnas, cada etapa (inicio, fin,
 * duración), cada paso con hora (hora y duración) y cada medición (valor y, si la tiene, hora).
 */
const hojaProceso = (rep: ReporteProduccion, codigo: string, lotes: ReporteLote[]): ExportSheet => {
  const ids = new Set(lotes.map((l) => l.id));
  const porId = new Map(lotes.map((l) => [l.id, l]));
  const etapas = rep.etapas.filter((e) => ids.has(e.lote_id));
  const pasos = rep.pasos.filter((p) => ids.has(p.lote_id));
  const meds = rep.mediciones.filter((m) => ids.has(m.lote_id));
  const env = rep.envasado.filter((e) => ids.has(e.lote_id));
  const ins = rep.insumos.filter((i) => ids.has(i.lote_id));

  // Envasado: una columna por tipo + presentación (unidades), en el orden en que aparecen.
  const defEnv = new Map<string, { tipo: string; presentacion: string; medida: string }>();
  env.forEach((e) => {
    const k = `${e.categoria}|${e.presentacion}`;
    if (!defEnv.has(k)) defEnv.set(k, { tipo: e.categoria, presentacion: e.presentacion, medida: e.medida });
  });
  const medidaTotal = [...new Set(env.map((e) => e.medida))].join(' / ');

  // Insumos: lote del proveedor y cantidad, en el orden de la etapa.
  const defIns = new Map<string, { orden: number; nombre: string; unidad: string }>();
  ins.forEach((i) => {
    const nombre = i.derivacion ? `${i.insumo} (${i.derivacion.replace(/_/g, ' ')})` : i.insumo;
    const k = `${i.orden ?? 99}|${nombre}`;
    if (!defIns.has(k)) defIns.set(k, { orden: i.orden ?? 99, nombre, unidad: i.unidad });
  });
  const insOrdenados = [...defIns.entries()].sort((a, b) => a[1].orden - b[1].orden);

  // Etapas del producto en orden.
  const defEtapas = [...new Map(etapas.map((e) => [e.orden, e.etapa])).entries()].sort((a, b) => a[0] - b[0]);

  // Pasos: en el orden de la etapa y, dentro de ella, por el momento típico en que ocurren.
  const defPasos = new Map<string, { orden: number; paso: string; t: number[]; conDuracion: boolean }>();
  pasos.forEach((p) => {
    const k = `${p.orden}|${p.paso}`;
    const d = defPasos.get(k) ?? { orden: p.orden, paso: p.paso, t: [], conDuracion: false };
    const ini = ms(p.inicio);
    const base = ms(porId.get(p.lote_id)?.iniciado_at);
    if (ini !== null && base !== null) d.t.push(ini - base);
    if (p.fin || (p.duracion_segundos ?? 0) > 0) d.conDuracion = true;
    defPasos.set(k, d);
  });
  const prom = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : Number.MAX_SAFE_INTEGER);
  const pasosOrdenados = [...defPasos.entries()].sort((a, b) => a[1].orden - b[1].orden || prom(a[1].t) - prom(b[1].t));

  // Mediciones: en el orden de la etapa; columna de hora solo si alguna medición la registra.
  const defMeds = new Map<string, { orden: number; parametro: string; unidad: string; conHora: boolean }>();
  meds.forEach((m) => {
    const k = `${m.orden}|${m.parametro}`;
    const d = defMeds.get(k) ?? { orden: m.orden, parametro: m.parametro, unidad: m.unidad, conHora: false };
    if (m.hora) d.conHora = true;
    defMeds.set(k, d);
  });
  const medsOrdenadas = [...defMeds.entries()].sort((a, b) => a[1].orden - b[1].orden);

  const columns: ExportColumn[] = [
    { key: 'lote', label: 'Lote' },
    { key: 'fecha', label: 'Fecha de inicio', format: 'fecha' },
    { key: 'horaIni', label: 'Hora de inicio', format: 'hora' },
    { key: 'estado', label: 'Estado' },
    { key: 'cierre', label: 'Cierre', format: 'diaHora' },
    { key: 'duracion', label: 'Duración total', format: 'duracion' },
    { key: 'responsable', label: 'Responsable' },
    { key: 'leche', label: 'Leche (L)' },
    { key: 'kg', label: 'Producido (kg)' },
    { key: 'unidades', label: 'Unidades' },
    { key: 'rend', label: 'Rendimiento (%)', format: 'decimal' },
  ];
  defEtapas.forEach(([orden, etapa]) => {
    columns.push(
      { key: `e${orden}i`, label: `${orden}. ${etapa} · inicio`, format: 'diaHora' },
      { key: `e${orden}f`, label: `${orden}. ${etapa} · fin`, format: 'diaHora' },
      { key: `e${orden}d`, label: `${orden}. ${etapa} · duración`, format: 'duracion' },
    );
  });
  pasosOrdenados.forEach(([k, d]) => {
    columns.push({ key: `p${k}h`, label: `${d.paso} · hora`, format: 'diaHora' });
    if (d.conDuracion) columns.push({ key: `p${k}d`, label: `${d.paso} · duración`, format: 'duracion' });
  });
  medsOrdenadas.forEach(([k, d]) => {
    columns.push({ key: `m${k}v`, label: `${d.parametro}${d.unidad ? ` (${d.unidad})` : ''}`, format: 'decimal', width: Math.min(Math.max(d.parametro.length + 6, 12), 40) });
    if (d.conHora) columns.push({ key: `m${k}h`, label: `${d.parametro} · hora`, format: 'diaHora' });
  });
  defEnv.forEach((d, k) => {
    columns.push({ key: `v${k}`, label: `Envasado · ${d.tipo} · ${d.presentacion} (und)` });
  });
  if (defEnv.size) columns.push({ key: 'envTotal', label: `Envasado · total (${medidaTotal})`, format: 'decimal' });
  insOrdenados.forEach(([k, d]) => {
    columns.push(
      { key: `i${k}l`, label: `${d.nombre} · lote del insumo` },
      { key: `i${k}c`, label: `${d.nombre} · cantidad (${d.unidad})`, format: 'decimal' },
    );
  });
  columns.push({ key: 'codigo', label: 'Código interno' });

  const rows: Fila[] = lotes.map((l) => {
    const f: Fila = {
      ...baseFila(l),
      estado: ESTADO_LABEL[l.estado] ?? l.estado,
      cierre: l.estado === 'COMPLETADO' ? excelFecha(l.finalizado_at) : null,
      duracion: l.estado === 'COMPLETADO' ? excelDuracion(l.duracion_total_segundos) : null,
      responsable: l.responsable_nombre,
      leche: num(l.volumen_leche_base_litros),
      kg: l.estado === 'COMPLETADO' ? l.kg_producidos : null,
      unidades: l.estado === 'COMPLETADO' ? l.unidades_producidas : null,
      rend: l.estado === 'COMPLETADO' ? l.rendimiento_pct : null,
      codigo: l.codigo_lote,
    };
    let total = 0;
    env
      .filter((e) => e.lote_id === l.id)
      .forEach((e) => {
        const k = `v${e.categoria}|${e.presentacion}`;
        f[k] = (Number(f[k]) || 0) + e.unidades;
        total += e.total;
      });
    if (total > 0) f.envTotal = Math.round(total * 1000) / 1000;
    ins
      .filter((i) => i.lote_id === l.id)
      .forEach((i) => {
        const nombre = i.derivacion ? `${i.insumo} (${i.derivacion.replace(/_/g, ' ')})` : i.insumo;
        const k = `${i.orden ?? 99}|${nombre}`;
        if (f[`i${k}l`] === undefined) {
          f[`i${k}l`] = i.lote_insumo;
          f[`i${k}c`] = num(i.cantidad);
        } else {
          f[`i${k}l`] = `${f[`i${k}l`]}, ${i.lote_insumo}`;
          f[`i${k}c`] = (Number(f[`i${k}c`]) || 0) + (num(i.cantidad) ?? 0);
        }
      });
    etapas
      .filter((e) => e.lote_id === l.id)
      .forEach((e) => {
        f[`e${e.orden}i`] = excelFecha(e.inicio);
        f[`e${e.orden}f`] = excelFecha(e.fin);
        f[`e${e.orden}d`] = e.estado === 'completada' ? excelDuracion(segundos(e.duracion_segundos, e.inicio, e.fin)) : null;
      });
    pasos
      .filter((p) => p.lote_id === l.id)
      .forEach((p) => {
        const k = `${p.orden}|${p.paso}`;
        if (f[`p${k}h`] === undefined) {
          f[`p${k}h`] = excelFecha(p.inicio);
          f[`p${k}d`] = excelDuracion(segundos(p.duracion_segundos, p.inicio, p.fin));
        }
      });
    meds
      .filter((m) => m.lote_id === l.id)
      .forEach((m) => {
        const k = `${m.orden}|${m.parametro}`;
        if (f[`m${k}v`] === undefined) {
          f[`m${k}v`] = num(m.valor);
          f[`m${k}h`] = excelFecha(m.hora);
        }
      });
    return f;
  });

  return { name: NOMBRE_HOJA[codigo] ?? lotes[0]?.producto_nombre ?? codigo, columns, rows };
};

const promedio = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const r2 = (x: number | null) => (x === null ? null : Math.round(x * 100) / 100);

export interface DescripcionFiltros {
  periodo: string;
  otros: string;
}

export const construirHojas = (rep: ReporteProduccion, filtros: DescripcionFiltros): ExportSheet[] => {
  const porId = new Map(rep.lotes.map((l) => [l.id, l]));

  // 1. Resumen por producto
  const productos = new Map<string, ReporteLote[]>();
  rep.lotes.forEach((l) => productos.set(l.producto_nombre, [...(productos.get(l.producto_nombre) ?? []), l]));
  const filasResumen: Fila[] = [...productos.entries()]
    .sort((a, b) => a[0].localeCompare(b[0], 'es'))
    .map(([producto, ls]) => {
      const ok = ls.filter((l) => l.estado === 'COMPLETADO');
      const rend = ok.map((l) => l.rendimiento_pct).filter((v): v is number => typeof v === 'number' && v > 0);
      const dur = ok.map((l) => l.duracion_total_segundos).filter((v): v is number => typeof v === 'number' && v > 0);
      return {
        producto,
        linea: ls[0].linea_nombre,
        lotes: ls.length,
        completados: ok.length,
        proceso: ls.filter((l) => l.estado === 'EN_PROCESO').length,
        anulados: ls.filter((l) => l.estado === 'ANULADO').length,
        leche: r2(ok.reduce((a, l) => a + (num(l.volumen_leche_base_litros) ?? 0), 0)),
        kg: r2(ok.reduce((a, l) => a + (l.kg_producidos ?? 0), 0)),
        unidades: ok.reduce((a, l) => a + (l.unidades_producidas ?? 0), 0),
        rend: r2(promedio(rend)),
        duracion: excelDuracion(promedio(dur)),
      };
    });
  if (filasResumen.length > 1) {
    const sum = (k: string) => filasResumen.reduce((a, f) => a + (Number(f[k]) || 0), 0);
    filasResumen.push({
      producto: 'TOTAL',
      linea: '',
      lotes: sum('lotes'),
      completados: sum('completados'),
      proceso: sum('proceso'),
      anulados: sum('anulados'),
      leche: r2(sum('leche')),
      kg: r2(sum('kg')),
      unidades: sum('unidades'),
      rend: null,
      duracion: null,
    });
  }

  const alertas: Fila[] = [];
  const ahora = Date.now();
  rep.lotes.forEach((l) => {
    const base = { lote: loteDeFila(l), producto: l.producto_nombre, fecha: baseFila(l).fecha };
    if (l.estado === 'EN_PROCESO') {
      const horas = Math.max(0, Math.round((ahora - (toDate(l.iniciado_at)?.getTime() ?? ahora)) / 3600000));
      alertas.push({ ...base, alerta: 'En proceso', detalle: `Etapa actual: ${l.etapa_actual ?? 'sin dato'} · iniciado hace ${horas} h` });
    }
    if (l.estado === 'ANULADO') {
      alertas.push({ ...base, alerta: 'Anulado', detalle: `${l.anulacion_motivo ?? 'Sin motivo'}${l.anulado_por ? ` · por ${l.anulado_por}` : ''}` });
    }
    if (l.correcciones > 0) {
      alertas.push({ ...base, alerta: 'Corregido', detalle: `${l.correcciones} corrección(es) del administrador (ver hoja Correcciones)` });
    }
    if (l.estado === 'COMPLETADO' && !(l.unidades_producidas && l.unidades_producidas > 0)) {
      alertas.push({ ...base, alerta: 'Sin envasado', detalle: 'Lote cerrado sin unidades registradas' });
    }
  });

  const resumen: ExportSheet = {
    name: 'Resumen',
    columns: [
      { key: 'producto', label: 'Producto' },
      { key: 'linea', label: 'Línea' },
      { key: 'lotes', label: 'Lotes' },
      { key: 'completados', label: 'Completados' },
      { key: 'proceso', label: 'En proceso' },
      { key: 'anulados', label: 'Anulados' },
      { key: 'leche', label: 'Leche procesada (L) *' },
      { key: 'kg', label: 'Producido (kg) *' },
      { key: 'unidades', label: 'Unidades *' },
      { key: 'rend', label: 'Rendimiento promedio (%) *', format: 'decimal' },
      { key: 'duracion', label: 'Duración promedio (h:mm) *', format: 'duracion' },
    ],
    rows: filasResumen,
    extra: [
      {
        title: alertas.length ? `Alertas (${alertas.length})` : 'Alertas: ninguna',
        columns: [
          { key: 'lote', label: 'Lote' },
          { key: 'producto', label: 'Producto' },
          { key: 'fecha', label: 'Fecha de inicio', format: 'fecha' },
          { key: 'alerta', label: 'Alerta' },
          { key: 'detalle', label: 'Detalle', width: 70 },
        ],
        rows: alertas,
      },
      {
        title: 'Datos del reporte',
        columns: [
          { key: 'campo', label: 'Campo' },
          { key: 'valor', label: 'Valor', width: 70 },
        ],
        rows: [
          { campo: 'Período', valor: filtros.periodo },
          { campo: 'Fecha usada', valor: 'Fecha de inicio del lote (hora de Colombia)' },
          { campo: 'Filtros', valor: filtros.otros || 'Ninguno' },
          { campo: 'Generado', valor: `${fmtDate(rep.generado_at)} ${fmtTime(rep.generado_at)}` },
          { campo: '* Nota', valor: 'Leche, producido, unidades, rendimiento y duración suman solo los lotes completados.' },
          { campo: 'Hojas por producto', valor: 'Una hoja por producto: una fila por lote con la hora y duración de cada etapa y cada paso, y el valor de cada medición.' },
          { campo: 'Cómo cruzar hojas', valor: 'Use Lote + Producto + Hora de inicio: las letras del lote se repiten entre productos y entre lotes del mismo producto del mismo día.' },
        ],
      },
    ],
  };

  // 2. Lotes
  const lotes: ExportSheet = {
    name: 'Lotes',
    columns: [
      { key: 'lote', label: 'Lote' },
      { key: 'producto', label: 'Producto' },
      { key: 'linea', label: 'Línea' },
      { key: 'estado', label: 'Estado' },
      { key: 'etapa', label: 'Etapa actual' },
      { key: 'responsable', label: 'Responsable' },
      { key: 'operarios', label: 'Operarios que intervinieron' },
      { key: 'fechaInicio', label: 'Fecha de inicio', format: 'fecha' },
      { key: 'horaInicio', label: 'Hora de inicio', format: 'hora' },
      { key: 'fechaFin', label: 'Fecha de cierre', format: 'fecha' },
      { key: 'horaFin', label: 'Hora de cierre', format: 'hora' },
      { key: 'duracion', label: 'Duración (h:mm)', format: 'duracion' },
      { key: 'leche', label: 'Leche (L)' },
      { key: 'kg', label: 'Producido (kg)' },
      { key: 'unidades', label: 'Unidades' },
      { key: 'rend', label: 'Rendimiento (%)', format: 'decimal' },
      { key: 'sabores', label: 'Sabores' },
      { key: 'correcciones', label: 'Correcciones' },
      { key: 'anulacion', label: 'Motivo de anulación' },
      { key: 'observaciones', label: 'Observaciones' },
      { key: 'codigo', label: 'Código interno' },
    ],
    rows: rep.lotes.map((l) => {
      const ini = excelFecha(l.iniciado_at);
      const fin = l.estado === 'COMPLETADO' ? excelFecha(l.finalizado_at) : null;
      return {
        lote: loteDeFila(l),
        producto: l.producto_nombre,
        linea: l.linea_nombre,
        estado: ESTADO_LABEL[l.estado] ?? l.estado,
        etapa: l.estado === 'EN_PROCESO' ? l.etapa_actual ?? '' : '',
        responsable: l.responsable_nombre,
        operarios: l.operarios ?? '',
        fechaInicio: ini !== null ? Math.floor(ini) : null,
        horaInicio: ini !== null ? ini - Math.floor(ini) : null,
        fechaFin: fin !== null ? Math.floor(fin) : null,
        horaFin: fin !== null ? fin - Math.floor(fin) : null,
        duracion: l.estado === 'COMPLETADO' ? excelDuracion(l.duracion_total_segundos) : null,
        leche: num(l.volumen_leche_base_litros),
        kg: l.estado === 'COMPLETADO' ? l.kg_producidos : null,
        unidades: l.estado === 'COMPLETADO' ? l.unidades_producidas : null,
        rend: l.estado === 'COMPLETADO' ? l.rendimiento_pct : null,
        sabores: l.sabores ?? '',
        correcciones: l.correcciones,
        anulacion: l.estado === 'ANULADO' ? l.anulacion_motivo ?? '' : '',
        observaciones: l.observaciones_finales ?? '',
        codigo: l.codigo_lote,
      };
    }),
  };

  // 3. Una hoja por producto: una fila por lote con tiempos y mediciones en columnas
  const porProducto = new Map<string, ReporteLote[]>();
  rep.lotes
    .filter((l) => l.estado !== 'ANULADO')
    .forEach((l) => porProducto.set(l.producto_codigo, [...(porProducto.get(l.producto_codigo) ?? []), l]));
  const hojasProceso = [...porProducto.entries()]
    .sort((a, b) => (NOMBRE_HOJA[a[0]] ?? a[0]).localeCompare(NOMBRE_HOJA[b[0]] ?? b[0], 'es'))
    .map(([codigo, ls]) => hojaProceso(rep, codigo, ls));

  // 4. Correcciones y anulaciones (envasado e insumos van en la hoja de cada producto)
  const correcciones: ExportSheet = {
    name: 'Correcciones',
    columns: [
      ...COL_LOTE,
      { key: 'accion', label: 'Acción' },
      { key: 'cuando', label: 'Fecha y hora', format: 'fechaHora' },
      { key: 'etapa', label: 'Etapa' },
      { key: 'campo', label: 'Dato' },
      { key: 'anterior', label: 'Valor anterior' },
      { key: 'nuevo', label: 'Valor nuevo' },
      { key: 'unidad', label: 'Unidad' },
      { key: 'motivo', label: 'Motivo' },
      { key: 'justificacion', label: 'Justificación', width: 50 },
      { key: 'autorizado', label: 'Autorizado por' },
    ],
    rows: rep.correcciones.map((c) => ({
      ...baseFila(porId.get(c.lote_id)),
      accion: c.accion === 'ANULACION' ? 'Anulación' : 'Corrección',
      cuando: excelFecha(c.fecha),
      etapa: c.etapa ?? '',
      campo: c.campo ?? '',
      anterior: c.accion === 'ANULACION' ? ESTADO_LABEL[c.valor_anterior ?? ''] ?? c.valor_anterior : c.valor_anterior,
      nuevo: c.accion === 'ANULACION' ? ESTADO_LABEL[c.valor_nuevo ?? ''] ?? c.valor_nuevo : c.valor_nuevo,
      unidad: c.unidad ?? '',
      motivo: c.motivo ?? '',
      justificacion: c.justificacion ?? '',
      autorizado: c.autorizado_por,
    })),
  };

  return [resumen, lotes, ...hojasProceso, correcciones];
};

const fmtDuracion = (seg: number | null | undefined): string => {
  if (!seg || seg <= 0) return '';
  const min = Math.round(seg / 60);
  return `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')} min`;
};

const fechaHoraTexto = (iso: string | null | undefined) => (iso ? `${fmtDate(iso)} ${fmtTime(iso)}` : '');
const duracionCorta = (seg: number | null | undefined) => {
  if (seg === null || seg === undefined || seg <= 0) return '';
  const min = Math.round(seg / 60);
  return min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')} min`;
};

/**
 * Ficha de un lote: todo el registro en una hoja vertical (Sección · Dato · Valor), leído de arriba
 * abajo como el registro del lote (etapas, pasos, mediciones, envasado e insumos); correcciones aparte.
 */
export const construirFicha = (rep: ReporteProduccion, l: ReporteLote): ExportSheet[] => {
  const hojas = construirHojas(rep, { periodo: '', otros: '' });
  const ok = l.estado === 'COMPLETADO';
  const filas: Fila[] = [];
  const add = (seccion: string, dato: string, valor: CellValue, detalle = '') => {
    if (valor === '' || valor === null || valor === undefined) return;
    filas.push({ seccion, dato, valor, detalle });
  };
  add('Lote', 'Lote', loteDeFila(l));
  add('Lote', 'Código interno', l.codigo_lote);
  add('Lote', 'Producto', l.producto_nombre);
  add('Lote', 'Línea', l.linea_nombre);
  add('Lote', 'Estado', ESTADO_LABEL[l.estado] ?? l.estado);
  add('Lote', 'Etapa actual', l.estado === 'EN_PROCESO' ? l.etapa_actual ?? '' : '');
  add('Lote', 'Responsable', l.responsable_nombre);
  add('Lote', 'Operarios que intervinieron', l.operarios ?? '');
  add('Lote', 'Inicio', fechaHoraTexto(l.iniciado_at));
  add('Lote', 'Cierre', ok ? fechaHoraTexto(l.finalizado_at) : '');
  add('Lote', 'Duración total', ok ? duracionCorta(l.duracion_total_segundos) : '');
  add('Producción', 'Leche (L)', num(l.volumen_leche_base_litros));
  add('Producción', 'Producido (kg)', ok ? l.kg_producidos : null);
  add('Producción', 'Unidades', ok ? l.unidades_producidas : null);
  add('Producción', 'Rendimiento (%)', ok ? l.rendimiento_pct : null);
  add('Producción', 'Sabores', l.sabores ?? '');

  const etapas = rep.etapas.filter((e) => e.lote_id === l.id).sort((a, b) => a.orden - b.orden);
  etapas.forEach((e) => {
    const sec = `Etapa ${e.orden}. ${e.etapa}`;
    const d = e.estado === 'completada' ? duracionCorta(segundos(e.duracion_segundos, e.inicio, e.fin)) : '';
    add(sec, 'Inicio de la etapa', e.inicio ? fechaHoraTexto(e.inicio) : 'Sin iniciar', e.operario ? `Operario: ${e.operario}` : '');
    add(sec, 'Fin de la etapa', e.fin ? fechaHoraTexto(e.fin) : e.inicio ? 'En proceso' : '', d ? `Duración: ${d}` : '');
    rep.pasos
      .filter((p) => p.lote_id === l.id && p.orden === e.orden)
      .forEach((p) => {
        const dp = duracionCorta(segundos(p.duracion_segundos, p.inicio, p.fin));
        add(sec, p.paso, fechaHoraTexto(p.inicio), [p.fin ? `Hasta: ${fmtTime(p.fin)}` : '', dp ? `Duración: ${dp}` : '', p.manual ? 'Hora registrada manualmente' : ''].filter(Boolean).join(' · '));
      });
    rep.mediciones
      .filter((m) => m.lote_id === l.id && m.orden === e.orden)
      .forEach((m) => add(sec, m.parametro, num(m.valor), [m.unidad, m.hora ? `Hora: ${fmtTime(m.hora)}` : ''].filter(Boolean).join(' · ')));
  });
  rep.envasado
    .filter((e) => e.lote_id === l.id)
    .forEach((e) => add('Envasado', `${e.categoria} · ${e.presentacion}`, e.unidades, `und · total ${String(e.total).replace('.', ',')} ${e.medida}`));
  rep.insumos
    .filter((i) => i.lote_id === l.id)
    .forEach((i) =>
      add('Insumos', i.derivacion ? `${i.insumo} (${i.derivacion.replace(/_/g, ' ')})` : i.insumo, num(i.cantidad), `${i.unidad} · lote ${i.lote_insumo} · ${i.etapa}`),
    );
  add('Cierre', 'Correcciones del administrador', l.correcciones);
  add('Cierre', 'Motivo de anulación', l.estado === 'ANULADO' ? l.anulacion_motivo ?? '' : '');
  add('Cierre', 'Observaciones', l.observaciones_finales ?? '');

  const registro: ExportSheet = {
    name: 'Registro del lote',
    columns: [
      { key: 'seccion', label: 'Sección', width: 34 },
      { key: 'dato', label: 'Dato', width: 48 },
      { key: 'valor', label: 'Valor', width: 22, format: 'decimal' },
      { key: 'detalle', label: 'Detalle', width: 40 },
    ],
    rows: filas,
  };
  const aparte = hojas.filter((h) => h.name === 'Correcciones' && h.rows.length > 0);
  return [registro, ...aparte];
};

// ---------------------------------------------------------------------------------------------
// Buscador de lotes (para la ficha)
// ---------------------------------------------------------------------------------------------

/** Datos mínimos de un lote para el buscador. */
interface LoteBuscable {
  id: string;
  codigo_lote: string;
  lote_dia?: string | null;
  estado: string;
  iniciado_at: string;
  producto_nombre: string;
  producto_codigo: string;
  linea_nombre: string;
  responsable_nombre: string;
}

interface LotPickerProps {
  rows: LoteBuscable[];
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
}

/** Normaliza texto para buscar sin exigir tildes ni la grafía exacta (yogurt → yogur, kumys → kumis). */
const norm = (s: string): string =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/yogh?urts?/g, 'yogur')
    .replace(/kumys|kumis/g, 'kumis')
    .replace(/[^a-z0-9/ ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const LotPicker: React.FC<LotPickerProps> = ({ rows, value, onChange, disabled }) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [producto, setProducto] = useState('');
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const selected = rows.find((r) => r.id === value) ?? null;

  const productos = useMemo(() => {
    const map = new Map<string, number>();
    rows.forEach((r) => map.set(r.producto_nombre, (map.get(r.producto_nombre) ?? 0) + 1));
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0], 'es'));
  }, [rows]);

  const groups = useMemo(() => {
    const tokens = norm(query).split(' ').filter(Boolean);
    const filtered = rows
      .filter((r) => {
        if (producto && r.producto_nombre !== producto) return false;
        if (tokens.length === 0) return true;
        const hay = norm(
          [
            r.lote_dia ?? '',
            r.codigo_lote,
            r.producto_nombre,
            r.producto_codigo,
            r.linea_nombre,
            r.responsable_nombre,
            ESTADO_LABEL[r.estado] ?? r.estado,
            fmtDate(r.iniciado_at),
            fmtTime(r.iniciado_at),
          ].join(' '),
        );
        return tokens.every((t) => hay.includes(t));
      })
      .sort((a, b) => (toDate(b.iniciado_at)?.getTime() ?? 0) - (toDate(a.iniciado_at)?.getTime() ?? 0));
    const map = new Map<string, LoteBuscable[]>();
    filtered.forEach((r) => {
      const list = map.get(r.producto_nombre);
      if (list) list.push(r);
      else map.set(r.producto_nombre, [r]);
    });
    return [...map.entries()];
  }, [rows, query, producto]);

  const total = groups.reduce((n, [, list]) => n + list.length, 0);

  const pick = (id: string) => {
    onChange(id);
    setOpen(false);
    setQuery('');
    setProducto('');
  };

  return (
    <div ref={boxRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={`w-full min-h-10 px-3 py-2 rounded-xl bg-white border text-left flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${open ? 'border-[#1B4E9B] ring-2 ring-[#1B4E9B]/15' : 'border-[#D6DEEA]'}`}
      >
        <span className="material-symbols-outlined text-[18px] text-[#1B4E9B] shrink-0">search</span>
        <span className="flex-1 min-w-0">
          {selected ? (
            <span className="flex flex-col">
              <span className="text-xs font-bold text-gray-900 break-all">{loteDeFila(selected)}</span>
              <span className="text-[11px] text-gray-500 break-words">
                {selected.producto_nombre} · {fmtDate(selected.iniciado_at)} {fmtTime(selected.iniciado_at)} ·{' '}
                {ESTADO_LABEL[selected.estado] ?? selected.estado}
              </span>
            </span>
          ) : (
            <span className="text-xs font-semibold text-gray-500">Buscar lote (ej. ABJBF), producto, fecha o responsable…</span>
          )}
        </span>
        <span className="material-symbols-outlined text-[18px] text-gray-400 shrink-0">{open ? 'expand_less' : 'expand_more'}</span>
      </button>

      {open && (
        <div className="absolute z-30 mt-1 w-full rounded-xl border border-[#D6DEEA] bg-white shadow-xl overflow-hidden">
          <div className="p-2 border-b border-[#E7ECF3] flex flex-col gap-2">
            <label className="flex flex-col gap-1">
              <span className="px-1 text-[10px] font-bold uppercase tracking-wide text-gray-500">Producto de la línea</span>
              <select
                value={producto}
                onChange={(e) => setProducto(e.target.value)}
                className="w-full h-9 px-2 rounded-lg bg-white border border-[#D6DEEA] text-xs font-bold text-gray-800 outline-none focus:border-[#1B4E9B] cursor-pointer"
              >
                <option value="">Todos los productos ({rows.length})</option>
                {productos.map(([nombre, n]) => (
                  <option key={nombre} value={nombre}>
                    {nombre} ({n})
                  </option>
                ))}
              </select>
            </label>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="O escribe el lote (ej. ABJBF), fecha (dd/mm/aaaa) o responsable"
              className="w-full h-9 px-3 rounded-lg bg-[#F7F9FC] border border-[#D6DEEA] text-xs font-semibold text-gray-800 outline-none focus:border-[#1B4E9B]"
            />
            <div className="px-1 text-[10px] font-bold text-gray-500">
              {total} lote(s){producto ? ` de ${producto}` : ''} · ordenados del más reciente al más antiguo
            </div>
          </div>
          <div className="max-h-72 overflow-y-auto">
            {groups.length === 0 && <div className="px-3 py-4 text-xs text-gray-500">Ningún lote coincide con la búsqueda.</div>}
            {groups.map(([producto, list]) => (
              <div key={producto}>
                <div className="sticky top-0 px-3 py-1.5 bg-[#F2F4F7] text-[10px] font-bold uppercase tracking-wide text-[#1B4E9B]">
                  {producto} · {list.length}
                </div>
                {list.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => pick(r.id)}
                    className={`w-full px-3 py-2 text-left flex items-start gap-2 hover:bg-[#F2F7FF] cursor-pointer ${r.id === value ? 'bg-[#EAF2FF]' : ''}`}
                  >
                    <span className="flex-1 min-w-0">
                      <span className="block text-xs font-bold text-gray-900 break-all">{loteDeFila(r)}</span>
                      <span className="block text-[11px] text-gray-500 break-words">
                        {fmtDate(r.iniciado_at)} {fmtTime(r.iniciado_at)} · {r.responsable_nombre}
                      </span>
                    </span>
                    <span
                      className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold ${r.estado === 'ANULADO' ? 'bg-red-50 text-red-700' : r.estado === 'EN_PROCESO' ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}
                    >
                      {ESTADO_LABEL[r.estado] ?? r.estado}
                    </span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};


// ---------------------------------------------------------------------------------------------
// Pantalla
// ---------------------------------------------------------------------------------------------

type Preset = 'hoy' | 'ayer' | 'semana' | 'mes' | 'mesAnterior' | 'todo';

const HOJAS_INFO: { nombre: string; desc: string; icon: string; clave: keyof ReporteProduccion | 'resumen' }[] = [
  { nombre: 'Resumen', desc: 'Totales por producto y alertas: lotes en proceso, anulados, corregidos o sin envasado.', icon: 'summarize', clave: 'resumen' },
  { nombre: 'Lotes', desc: 'Una fila por lote: inicio, cierre, duración, leche, kg, unidades y rendimiento.', icon: 'inventory_2', clave: 'lotes' },
  { nombre: 'Una hoja por producto', desc: 'Una fila por lote con todo su proceso: cada etapa y paso (hora y duración), cada medición, el envasado por presentación y cada insumo con su lote.', icon: 'schedule', clave: 'etapas' },
  { nombre: 'Correcciones', desc: 'Correcciones y anulaciones: quién, cuándo, valor anterior y nuevo, y motivo.', icon: 'history_edu', clave: 'correcciones' },
];

export const ExportCenter: React.FC<ExportCenterProps> = ({ lines, products, users }) => {
  const hoy = diaColombia(new Date());
  const [desde, setDesde] = useState(hoy);
  const [hasta, setHasta] = useState(hoy);
  const [linea, setLinea] = useState('');
  const [producto, setProducto] = useState('');
  const [estado, setEstado] = useState('');
  const [responsable, setResponsable] = useState('');
  const [lote, setLote] = useState('');
  const [rep, setRep] = useState<ReporteProduccion | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [fichaId, setFichaId] = useState('');
  const peticion = useRef(0);

  useEffect(() => {
    const id = ++peticion.current;
    setLoading(true);
    const t = window.setTimeout(() => {
      fetchProductionReport({ desde, hasta, linea, producto, estado, responsable, lote: lote.trim() })
        .then((r) => {
          if (id !== peticion.current) return;
          setRep(r);
          setError('');
        })
        .catch((err) => {
          if (id !== peticion.current) return;
          setError(err instanceof Error ? err.message : 'No se pudo cargar el reporte.');
        })
        .finally(() => {
          if (id === peticion.current) setLoading(false);
        });
    }, 300);
    return () => window.clearTimeout(t);
  }, [desde, hasta, linea, producto, estado, responsable, lote]);

  useEffect(() => {
    if (fichaId && rep && !rep.lotes.some((l) => l.id === fichaId)) setFichaId('');
  }, [rep, fichaId]);

  const setPreset = (p: Preset) => {
    if (p === 'todo') {
      setDesde('');
      setHasta('');
      return;
    }
    if (p === 'hoy') {
      setDesde(hoy);
      setHasta(hoy);
    } else if (p === 'ayer') {
      const ayer = sumarDias(hoy, -1);
      setDesde(ayer);
      setHasta(ayer);
    } else if (p === 'semana') {
      setDesde(sumarDias(hoy, -6));
      setHasta(hoy);
    } else if (p === 'mes') {
      setDesde(`${hoy.slice(0, 8)}01`);
      setHasta(hoy);
    } else {
      const primeroEste = `${hoy.slice(0, 8)}01`;
      const ultimoAnterior = sumarDias(primeroEste, -1);
      setDesde(`${ultimoAnterior.slice(0, 8)}01`);
      setHasta(ultimoAnterior);
    }
  };

  const limpiar = () => {
    setPreset('hoy');
    setLinea('');
    setProducto('');
    setEstado('');
    setResponsable('');
    setLote('');
  };

  const periodo = !desde && !hasta ? 'Todos los lotes' : desde === hasta ? ddmm(desde) : `${desde ? ddmm(desde) : 'inicio'} a ${hasta ? ddmm(hasta) : 'hoy'}`;
  const otros = [
    linea && `Línea: ${lines.find((l) => l.code === linea)?.name ?? linea}`,
    producto && `Producto: ${products.find((p) => p.code === producto)?.name ?? producto}`,
    estado && `Estado: ${ESTADO_LABEL[estado] ?? estado}`,
    responsable && `Responsable: ${responsable}`,
    lote.trim() && `Lote contiene: ${lote.trim()}`,
  ]
    .filter(Boolean)
    .join(' · ');

  const hojas = useMemo(() => (rep ? construirHojas(rep, { periodo, otros }) : []), [rep, periodo, otros]);
  const resumen = hojas[0];
  const alertas = resumen?.extra?.[0]?.rows.length ?? 0;
  const lotes = rep?.lotes ?? [];
  const conteo = {
    total: lotes.length,
    completados: lotes.filter((l) => l.estado === 'COMPLETADO').length,
    proceso: lotes.filter((l) => l.estado === 'EN_PROCESO').length,
    anulados: lotes.filter((l) => l.estado === 'ANULADO').length,
  };
  const filasPorHoja: Record<string, number> = Object.fromEntries(hojas.map((h) => [h.name, h.rows.length]));

  const nombreArchivo = () => {
    const rango = !desde && !hasta ? 'todo' : desde === hasta ? desde : `${desde || 'inicio'}_a_${hasta || hoy}`;
    return `Produccion_${rango}`;
  };

  const descargarExcel = () => {
    if (!rep) return;
    setBusy('Preparando el Excel...');
    try {
      exportXlsx(hojas, nombreArchivo());
    } finally {
      setBusy('');
    }
  };

  const descargarCsv = () => {
    if (!rep) return;
    setBusy('Preparando los CSV...');
    try {
      const archivos = hojas.map((h, i) => ({
        name: `${String(i + 1).padStart(2, '0')}_${h.name.replace(/\s+/g, '_')}.csv`,
        content: buildCsv(h),
      }));
      const al = hojas[0]?.extra?.[0];
      if (al && al.rows.length) archivos.push({ name: '08_Alertas.csv', content: buildCsv({ name: 'Alertas', columns: al.columns, rows: al.rows }) });
      exportZip(archivos, nombreArchivo());
    } finally {
      setBusy('');
    }
  };

  const descargarFicha = () => {
    if (!rep) return;
    const l = rep.lotes.find((x) => x.id === fichaId);
    if (!l) return;
    const solo = <T extends { lote_id: string }>(xs: T[]) => xs.filter((x) => x.lote_id === l.id);
    const sub: ReporteProduccion = {
      ...rep,
      lotes: [l],
      etapas: solo(rep.etapas),
      pasos: solo(rep.pasos),
      mediciones: solo(rep.mediciones),
      envasado: solo(rep.envasado),
      insumos: solo(rep.insumos),
      correcciones: solo(rep.correcciones),
    };
    exportXlsx(construirFicha(sub, l), `Ficha_${loteDeFila(l)}_${l.producto_codigo}`);
  };

  const responsables = useMemo(() => Array.from(new Set(users.map((u) => u.name))).sort((a, b) => a.localeCompare(b, 'es')), [users]);
  const presetCls = 'px-3 h-8 rounded-lg border border-[#D6DEEA] bg-white text-[11px] font-bold text-gray-700 hover:bg-[#F2F4F7] cursor-pointer';
  const inputCls = 'h-9 px-2 rounded-lg border border-[#D6DEEA] bg-white text-xs font-semibold text-gray-800 outline-none focus:border-[#1B4E9B] w-full';
  const labelCls = 'flex flex-col gap-1 text-[10px] font-bold uppercase text-gray-500';
  const sinDatos = !loading && lotes.length === 0;

  return (
    <div className="flex flex-col gap-4">
      {/* Filtros */}
      <div className={`${card} p-4 flex flex-col gap-3`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-black text-gray-900 flex items-center gap-2">
            <span className="material-symbols-outlined text-[#1B4E9B] text-[20px]">filter_alt</span>
            ¿Qué lotes quieres ver?
          </h3>
          <button className="text-[11px] font-bold text-[#1B4E9B] hover:underline cursor-pointer" onClick={limpiar}>
            Limpiar filtros
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className={presetCls} onClick={() => setPreset('hoy')}>Hoy</button>
          <button className={presetCls} onClick={() => setPreset('ayer')}>Ayer</button>
          <button className={presetCls} onClick={() => setPreset('semana')}>Últimos 7 días</button>
          <button className={presetCls} onClick={() => setPreset('mes')}>Este mes</button>
          <button className={presetCls} onClick={() => setPreset('mesAnterior')}>Mes anterior</button>
          <button className={presetCls} onClick={() => setPreset('todo')}>Todo</button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <label className={labelCls}>
            Inicio desde
            <input type="date" value={desde} max={hasta || undefined} onChange={(e) => setDesde(e.target.value)} className={inputCls} />
          </label>
          <label className={labelCls}>
            Inicio hasta
            <input type="date" value={hasta} min={desde || undefined} onChange={(e) => setHasta(e.target.value)} className={inputCls} />
          </label>
          <label className={labelCls}>
            Línea
            <select value={linea} onChange={(e) => setLinea(e.target.value)} className={inputCls}>
              <option value="">Todas</option>
              {lines.map((l) => (
                <option key={l.id} value={l.code}>
                  {l.name}
                </option>
              ))}
            </select>
          </label>
          <label className={labelCls}>
            Producto
            <select value={producto} onChange={(e) => setProducto(e.target.value)} className={inputCls}>
              <option value="">Todos</option>
              {products.map((p) => (
                <option key={p.id} value={p.code}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className={labelCls}>
            Estado
            <select value={estado} onChange={(e) => setEstado(e.target.value)} className={inputCls}>
              <option value="">Todos</option>
              <option value="COMPLETADO">Completados</option>
              <option value="EN_PROCESO">En proceso</option>
              <option value="ANULADO">Anulados</option>
            </select>
          </label>
          <label className={labelCls}>
            Responsable
            <select value={responsable} onChange={(e) => setResponsable(e.target.value)} className={inputCls}>
              <option value="">Todos</option>
              {responsables.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <label className={`${labelCls} col-span-2`}>
            Lote
            <input type="text" value={lote} onChange={(e) => setLote(e.target.value)} placeholder="Ej: ABKBF" className={`${inputCls} uppercase`} />
          </label>
        </div>
        <p className="text-[11px] text-gray-500">
          Las fechas son las de <strong>inicio del lote</strong> (hora de Colombia), las mismas de sus letras.
        </p>
      </div>

      {/* Resultado */}
      <div className={`${card} p-4 flex flex-col gap-3`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[10px] font-bold uppercase text-gray-500">{periodo}{otros ? ` · ${otros}` : ''}</div>
            <div className="text-lg font-black text-gray-900">
              {loading ? 'Cargando…' : `${conteo.total} lote${conteo.total === 1 ? '' : 's'}`}
            </div>
            {!loading && conteo.total > 0 && (
              <div className="text-[11px] text-gray-600 flex flex-wrap gap-x-3">
                <span>{conteo.completados} completados</span>
                <span>{conteo.proceso} en proceso</span>
                <span>{conteo.anulados} anulados</span>
                {alertas > 0 && <span className="font-bold text-amber-700">{alertas} alerta(s)</span>}
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={descargarExcel}
              disabled={!rep || loading || sinDatos || Boolean(busy)}
              className="h-10 px-4 rounded-xl bg-[#1B4E9B] hover:bg-[#143A73] text-white text-xs font-bold flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="material-symbols-outlined text-[18px]">download</span>
              Descargar Excel
            </button>
            <button
              onClick={descargarCsv}
              disabled={!rep || loading || sinDatos || Boolean(busy)}
              className="h-10 px-4 rounded-xl border border-[#D6DEEA] bg-white text-gray-700 text-xs font-bold flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="material-symbols-outlined text-[18px]">folder_zip</span>
              CSV (ZIP)
            </button>
          </div>
        </div>
        {error && <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-xs font-bold text-red-800">{error}</div>}
        {busy && <div className="text-xs font-bold text-[#1B4E9B]">{busy}</div>}
        {sinDatos && !error && <div className="text-xs text-gray-500">No hay lotes con estos filtros.</div>}

        {resumen && resumen.rows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-xs">
              <thead>
                <tr className="text-left text-[10px] uppercase text-gray-500 border-b border-[#D6DEEA]">
                  <th className="py-2 pr-2">Producto</th>
                  <th className="py-2 px-2 text-right">Lotes</th>
                  <th className="py-2 px-2 text-right">Leche (L)</th>
                  <th className="py-2 px-2 text-right">Producido (kg)</th>
                  <th className="py-2 px-2 text-right">Unidades</th>
                  <th className="py-2 pl-2 text-right">Rend. prom.</th>
                </tr>
              </thead>
              <tbody>
                {resumen.rows.map((f) => (
                  <tr key={String(f.producto)} className={`border-b border-[#EEF1F6] ${f.producto === 'TOTAL' ? 'font-black' : ''}`}>
                    <td className="py-1.5 pr-2 font-bold text-gray-900">{f.producto}</td>
                    <td className="py-1.5 px-2 text-right">
                      {f.lotes}
                      {Number(f.proceso) > 0 && <span className="text-amber-700"> ({f.proceso} en proceso)</span>}
                    </td>
                    <td className="py-1.5 px-2 text-right font-mono">{Number(f.leche).toLocaleString('es-CO')}</td>
                    <td className="py-1.5 px-2 text-right font-mono">{Number(f.kg).toLocaleString('es-CO')}</td>
                    <td className="py-1.5 px-2 text-right font-mono">{Number(f.unidades).toLocaleString('es-CO')}</td>
                    <td className="py-1.5 pl-2 text-right font-mono">{f.rend === null || f.rend === undefined ? '—' : `${String(f.rend).replace('.', ',')} %`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-1 text-[10px] text-gray-500">Leche, kg, unidades y rendimiento cuentan solo los lotes completados.</p>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 pt-1">
          {HOJAS_INFO.map((h, i) => (
            <div key={h.nombre} className="p-2.5 rounded-xl bg-[#F7F9FC] border border-[#E7ECF3] flex gap-2">
              <span className="material-symbols-outlined text-[18px] text-[#1B4E9B] shrink-0">{h.icon}</span>
              <div className="min-w-0">
                <div className="text-[11px] font-black text-gray-900">
                  {i + 1}. {h.nombre}
                  {rep && (
                    <span className="ml-1 font-bold text-gray-500">
                      · {h.clave === 'etapas' ? `${Math.max(hojas.length - 3, 0)} hoja(s)` : `${filasPorHoja[h.nombre] ?? 0} filas`}
                    </span>
                  )}
                </div>
                <div className="text-[10px] text-gray-500 leading-snug">{h.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Ficha de un lote */}
      <div className={`${card} p-4 flex flex-col gap-3`}>
        <h3 className="text-sm font-black text-gray-900 flex items-center gap-2">
          <span className="material-symbols-outlined text-[#1B4E9B] text-[20px]">description</span>
          Ficha de un lote
        </h3>
        <p className="text-[11px] text-gray-500">
          Todo el registro de un lote en un Excel: datos generales, etapas y tiempos, mediciones, envasado, insumos y correcciones.
          Busca entre los lotes de los filtros de arriba (usa "Todo" para buscar en cualquier fecha).
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="flex-1 min-w-0">
            <LotPicker rows={lotes} value={fichaId} onChange={setFichaId} disabled={loading || lotes.length === 0} />
          </div>
          <button
            onClick={descargarFicha}
            disabled={!fichaId || loading}
            className="h-10 px-4 rounded-xl bg-[#1B4E9B] hover:bg-[#143A73] text-white text-xs font-bold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
          >
            <span className="material-symbols-outlined text-[18px]">download</span>
            Descargar ficha
          </button>
        </div>
      </div>
    </div>
  );
};
