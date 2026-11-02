import React, { useEffect, useMemo, useState } from 'react';
import { AuditLogEntry, ProductDefinition, ProductionLine, UserProfile } from '../../types';
import { BatchHistoryRow, fetchAuditLogs, fetchBatchDetail, fetchBatchHistory, lineUiId } from '../../api/client';
import { CellValue, ExportSheet, exportCsv, exportXlsx } from '../../utils/exporters';

interface ExportCenterProps {
  lines: ProductionLine[];
  products: ProductDefinition[];
  users: UserProfile[];
}

type DatasetKey = 'historial' | 'produccion' | 'variables' | 'auditoria' | 'anulados' | 'usuarios' | 'lineas';

const ESTADO_LABEL: Record<string, string> = {
  EN_PROCESO: 'En proceso',
  COMPLETADO: 'Completado',
  ANULADO: 'Anulado',
  PENDIENTE: 'Pendiente',
};

const SHIFT_ROLE: Record<string, string> = { administrador: 'Administrador', operador: 'Operador' };

const card = 'bg-white rounded-2xl border border-[#D6DEEA] shadow-xs';

const fmtDateTime = (iso: string | null | undefined): string =>
  iso ? new Date(iso).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' }) : '';

const fmtDuration = (sec: number | null): string => {
  if (!sec || sec <= 0) return '';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return `${h}:${String(m).padStart(2, '0')}`;
};

const toNumber = (v: string | number | null | undefined): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const humanize = (key: string): string =>
  key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/^\w/, (c) => c.toUpperCase());

const flattenState = (node: unknown, trail: string[], out: { section: string; variable: string; value: CellValue }[]) => {
  if (node === null || node === undefined || node === '') return;
  if (typeof node === 'number' || typeof node === 'string' || typeof node === 'boolean') {
    const labels = trail.map((t) => (/^\d+$/.test(t) ? `#${Number(t) + 1}` : humanize(t)));
    let value: CellValue = node;
    if (typeof node === 'number' && node > 1e12 && node < 1e14) value = new Date(node).toLocaleString('es-CO');
    out.push({ section: labels[0] ?? 'Lote', variable: labels.slice(1).join(' › ') || labels[0] || '', value });
    return;
  }
  if (Array.isArray(node)) {
    node.forEach((item, i) => flattenState(item, [...trail, String(i)], out));
    return;
  }
  if (typeof node === 'object') {
    Object.entries(node as Record<string, unknown>).forEach(([k, v]) => flattenState(v, [...trail, k], out));
  }
};

const stamp = () => {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}_${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}`;
};

export const ExportCenter: React.FC<ExportCenterProps> = ({ lines, products, users }) => {
  const [history, setHistory] = useState<BatchHistoryRow[]>([]);
  const [audit, setAudit] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [lineFilter, setLineFilter] = useState('todas');
  const [estadoFilter, setEstadoFilter] = useState('todos');
  const [selected, setSelected] = useState<Set<DatasetKey>>(new Set(['historial', 'produccion', 'auditoria', 'anulados']));
  const [fichaLote, setFichaLote] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [h, a] = await Promise.all([fetchBatchHistory(500), fetchAuditLogs()]);
      setHistory(h);
      setAudit(a);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar los datos.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const inRange = (iso: string | null | undefined) => {
    if (!iso) return !from && !to;
    const t = new Date(iso).getTime();
    if (from && t < new Date(`${from}T00:00:00`).getTime()) return false;
    if (to && t > new Date(`${to}T23:59:59`).getTime()) return false;
    return true;
  };

  const filteredLots = useMemo(
    () =>
      history.filter(
        (h) =>
          inRange(h.iniciado_at) &&
          (lineFilter === 'todas' || lineUiId(h.linea_codigo) === lineFilter) &&
          (estadoFilter === 'todos' || h.estado === estadoFilter)
      ),
    [history, from, to, lineFilter, estadoFilter]
  );

  const filteredAudit = useMemo(() => {
    const lineName = lineFilter === 'todas' ? null : lines.find((l) => l.id === lineFilter)?.name;
    return audit.filter(
      (a) => inRange(new Date(a.timestamp).toISOString()) && (!lineName || a.lineName === lineName)
    );
  }, [audit, from, to, lineFilter, lines]);

  const sheets = useMemo(() => {
    const historial: ExportSheet = {
      name: 'Historial de lotes',
      columns: [
        { key: 'lote', label: 'Lote' },
        { key: 'producto', label: 'Producto' },
        { key: 'codigo', label: 'Código producto' },
        { key: 'linea', label: 'Línea' },
        { key: 'responsable', label: 'Responsable' },
        { key: 'estado', label: 'Estado' },
        { key: 'etapa', label: 'Etapa actual' },
        { key: 'leche', label: 'Leche base (L)' },
        { key: 'inicio', label: 'Inicio' },
        { key: 'fin', label: 'Fin' },
        { key: 'duracion', label: 'Duración (h:mm)' },
        { key: 'minutos', label: 'Duración (min)' },
        { key: 'rect', label: 'Rectificaciones' },
      ],
      rows: filteredLots.map((h) => ({
        lote: h.codigo_lote,
        producto: h.producto_nombre,
        codigo: h.producto_codigo,
        linea: h.linea_nombre,
        responsable: h.responsable_nombre,
        estado: ESTADO_LABEL[h.estado] ?? h.estado,
        etapa: h.estado === 'EN_PROCESO' ? humanize(h.etapa_actual_codigo ?? '') : '',
        leche: toNumber(h.volumen_leche_base_litros),
        inicio: fmtDateTime(h.iniciado_at),
        fin: fmtDateTime(h.finalizado_at),
        duracion: fmtDuration(h.duracion_total_segundos),
        minutos: h.duracion_total_segundos ? Math.round(h.duracion_total_segundos / 60) : null,
        rect: h.rectificaciones,
      })),
    };

    const byProduct = new Map<string, BatchHistoryRow[]>();
    filteredLots.forEach((h) => byProduct.set(h.producto_nombre, [...(byProduct.get(h.producto_nombre) ?? []), h]));
    const produccion: ExportSheet = {
      name: 'Resumen por producto',
      columns: [
        { key: 'producto', label: 'Producto' },
        { key: 'linea', label: 'Línea' },
        { key: 'total', label: 'Lotes totales' },
        { key: 'completados', label: 'Completados' },
        { key: 'proceso', label: 'En proceso' },
        { key: 'anulados', label: 'Anulados' },
        { key: 'leche', label: 'Leche procesada en completados (L)' },
        { key: 'promedio', label: 'Duración promedio (min)' },
        { key: 'rect', label: 'Rectificaciones' },
      ],
      rows: Array.from(byProduct.entries()).map(([producto, rows]) => {
        const done = rows.filter((r) => r.estado === 'COMPLETADO');
        const durs = done.map((r) => r.duracion_total_segundos ?? 0).filter((s) => s > 0);
        return {
          producto,
          linea: rows[0].linea_nombre,
          total: rows.length,
          completados: done.length,
          proceso: rows.filter((r) => r.estado === 'EN_PROCESO').length,
          anulados: rows.filter((r) => r.estado === 'ANULADO').length,
          leche: done.reduce((s, r) => s + (toNumber(r.volumen_leche_base_litros) ?? 0), 0),
          promedio: durs.length ? Math.round(durs.reduce((s, x) => s + x, 0) / durs.length / 60) : null,
          rect: rows.reduce((s, r) => s + r.rectificaciones, 0),
        };
      }),
    };

    const auditoria: ExportSheet = {
      name: 'Auditoría',
      columns: [
        { key: 'fecha', label: 'Fecha' },
        { key: 'lote', label: 'Lote' },
        { key: 'linea', label: 'Línea' },
        { key: 'admin', label: 'Autorizado por' },
        { key: 'etapa', label: 'Etapa' },
        { key: 'variable', label: 'Variable' },
        { key: 'anterior', label: 'Valor anterior' },
        { key: 'nuevo', label: 'Valor nuevo' },
        { key: 'unidad', label: 'Unidad' },
        { key: 'causal', label: 'Causal' },
        { key: 'just', label: 'Justificación', width: 60 },
      ],
      rows: filteredAudit.map((a) => ({
        fecha: new Date(a.timestamp).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' }),
        lote: a.batchId,
        linea: a.lineName,
        admin: a.adminName,
        etapa: a.stageLabel,
        variable: a.fieldLabel,
        anterior: a.oldValue,
        nuevo: a.newValue,
        unidad: a.unit ?? '',
        causal: a.reasonCategory,
        just: a.justificationText,
      })),
    };

    const anulados: ExportSheet = {
      name: 'Lotes anulados',
      columns: [
        { key: 'lote', label: 'Lote' },
        { key: 'producto', label: 'Producto' },
        { key: 'linea', label: 'Línea' },
        { key: 'responsable', label: 'Responsable' },
        { key: 'inicio', label: 'Inicio' },
        { key: 'por', label: 'Anulado por' },
        { key: 'fecha', label: 'Fecha de anulación' },
        { key: 'motivo', label: 'Motivo', width: 60 },
      ],
      rows: filteredLots
        .filter((h) => h.estado === 'ANULADO')
        .map((h) => ({
          lote: h.codigo_lote,
          producto: h.producto_nombre,
          linea: h.linea_nombre,
          responsable: h.responsable_nombre,
          inicio: fmtDateTime(h.iniciado_at),
          por: h.anulado_por ?? '',
          fecha: fmtDateTime(h.anulado_at),
          motivo: h.anulacion_justificacion ?? '',
        })),
    };

    const usuarios: ExportSheet = {
      name: 'Usuarios',
      columns: [
        { key: 'codigo', label: 'Código' },
        { key: 'nombre', label: 'Nombre' },
        { key: 'rol', label: 'Rol' },
        { key: 'turno', label: 'Turno' },
        { key: 'linea', label: 'Línea asignada' },
      ],
      rows: users.map((u) => ({
        codigo: u.code,
        nombre: u.name,
        rol: SHIFT_ROLE[u.role] ?? u.role,
        turno: u.shift,
        linea: lines.find((l) => l.id === u.assignedLineId)?.name ?? 'Flotante',
      })),
    };

    const lineasSheet: ExportSheet = {
      name: 'Líneas y productos',
      columns: [
        { key: 'codigo', label: 'Código línea' },
        { key: 'linea', label: 'Línea' },
        { key: 'capacidad', label: 'Capacidad (L)' },
        { key: 'estado', label: 'Estado' },
        { key: 'producto', label: 'Producto' },
        { key: 'pcodigo', label: 'Código producto' },
        { key: 'norma', label: 'Normativa' },
      ],
      rows: lines.flatMap((l) => {
        const prods = products.filter((p) => l.allowedProductIds.includes(p.id));
        const base = { codigo: l.code, linea: l.name, capacidad: l.capacityLiters, estado: humanize(l.status) };
        return prods.length
          ? prods.map((p) => ({ ...base, producto: p.name, pcodigo: p.code, norma: p.standards }))
          : [base];
      }),
    };

    return { historial, produccion, auditoria, anulados, usuarios, lineas: lineasSheet } as Record<Exclude<DatasetKey, 'variables'>, ExportSheet>;
  }, [filteredLots, filteredAudit, users, lines, products]);

  const buildVariablesSheet = async (lots: BatchHistoryRow[]): Promise<ExportSheet> => {
    const rows: Record<string, CellValue>[] = [];
    for (let i = 0; i < lots.length; i += 1) {
      const lot = lots[i];
      setBusy(`Leyendo variables del lote ${i + 1} de ${lots.length}...`);
      try {
        const detail = await fetchBatchDetail(lot.id);
        const out: { section: string; variable: string; value: CellValue }[] = [];
        flattenState(detail.estado_ui?.batch, [], out);
        out.forEach((o) =>
          rows.push({
            lote: lot.codigo_lote,
            producto: lot.producto_nombre,
            estado: ESTADO_LABEL[lot.estado] ?? lot.estado,
            seccion: o.section,
            variable: o.variable,
            valor: o.value,
          })
        );
      } catch {
        rows.push({ lote: lot.codigo_lote, producto: lot.producto_nombre, estado: lot.estado, seccion: 'Error', variable: 'No se pudo leer el lote', valor: '' });
      }
    }
    return {
      name: 'Variables de proceso',
      columns: [
        { key: 'lote', label: 'Lote' },
        { key: 'producto', label: 'Producto' },
        { key: 'estado', label: 'Estado' },
        { key: 'seccion', label: 'Fase / Sección' },
        { key: 'variable', label: 'Variable' },
        { key: 'valor', label: 'Valor', width: 40 },
      ],
      rows,
    };
  };

  const getSheet = async (key: DatasetKey): Promise<ExportSheet> =>
    key === 'variables' ? buildVariablesSheet(filteredLots.filter((l) => l.estado !== 'ANULADO')) : sheets[key];

  const runExport = async (keys: DatasetKey[], format: 'csv' | 'xlsx', filename: string) => {
    if (keys.length === 0) return;
    setBusy('Preparando archivo...');
    try {
      const built: ExportSheet[] = [];
      for (const k of keys) built.push(await getSheet(k));
      if (format === 'csv') exportCsv(built[0], filename);
      else exportXlsx(built, filename);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo generar el archivo.');
    } finally {
      setBusy('');
    }
  };

  const exportFicha = async (format: 'csv' | 'xlsx') => {
    const lot = history.find((h) => h.id === fichaLote);
    if (!lot) return;
    setBusy('Preparando ficha del lote...');
    try {
      const variables = await buildVariablesSheet([lot]);
      const resumen: ExportSheet = {
        name: 'Resumen del lote',
        columns: [
          { key: 'campo', label: 'Campo' },
          { key: 'valor', label: 'Valor', width: 50 },
        ],
        rows: sheets.historial.columns.map((c) => ({
          campo: c.label,
          valor: sheets.historial.rows.find((r) => r.lote === lot.codigo_lote)?.[c.key] ?? (c.key === 'lote' ? lot.codigo_lote : ''),
        })),
      };
      const auditLot: ExportSheet = { ...sheets.auditoria, name: 'Correcciones', rows: sheets.auditoria.rows.filter((r) => r.lote === lot.codigo_lote) };
      const name = `Ficha_${lot.codigo_lote}`;
      if (format === 'csv') exportCsv(variables, name);
      else exportXlsx([resumen, variables, auditLot], name);
    } finally {
      setBusy('');
    }
  };

  const DATASETS: { key: DatasetKey; title: string; desc: string; icon: string; count: number | string }[] = [
    { key: 'historial', title: 'Historial de lotes', desc: 'Lote, producto, responsable, estado, leche, fechas y duración.', icon: 'inventory_2', count: sheets.historial.rows.length },
    { key: 'produccion', title: 'Resumen por producto', desc: 'Lotes, completados, anulados, litros y duración promedio por producto.', icon: 'bar_chart', count: sheets.produccion.rows.length },
    { key: 'variables', title: 'Variables de proceso', desc: 'Cada dato registrado por el operario en cada fase (temperaturas, pH, insumos, lotes, tiempos).', icon: 'science', count: `${filteredLots.filter((l) => l.estado !== 'ANULADO').length} lotes` },
    { key: 'auditoria', title: 'Auditoría de correcciones', desc: 'Rectificaciones y anulaciones con valor anterior, nuevo, causal y justificación.', icon: 'verified', count: sheets.auditoria.rows.length },
    { key: 'anulados', title: 'Lotes anulados', desc: 'Lotes cancelados, quién los anuló, cuándo y por qué.', icon: 'block', count: sheets.anulados.rows.length },
    { key: 'usuarios', title: 'Usuarios', desc: 'Personal activo con rol, turno y línea asignada.', icon: 'group', count: sheets.usuarios.rows.length },
    { key: 'lineas', title: 'Líneas y productos', desc: 'Catálogo de líneas, capacidad y productos con su normativa.', icon: 'factory', count: sheets.lineas.rows.length },
  ];

  const toggle = (k: DatasetKey) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });

  const inputCls = 'w-full p-2 rounded-xl bg-white border border-[#D6DEEA] text-xs font-semibold text-gray-800 outline-none focus:border-[#1B4E9B]';
  const disabled = loading || !!busy;

  return (
    <div className="flex flex-col gap-4">
      <div className={`${card} p-5 flex flex-col gap-3`}>
        <div className="flex items-center justify-between border-b border-[#D6DEEA] pb-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#1B4E9B] text-[20px]">filter_alt</span>
            <h3 className="text-sm font-bold text-gray-900">Filtros de exportación</h3>
          </div>
          <button onClick={() => void load()} disabled={disabled} className="text-xs text-[#1B4E9B] font-bold hover:underline cursor-pointer disabled:opacity-50">
            Recargar datos
          </button>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <label className="flex flex-col gap-1 text-[10px] font-bold uppercase text-gray-500">
            Desde
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={inputCls} />
          </label>
          <label className="flex flex-col gap-1 text-[10px] font-bold uppercase text-gray-500">
            Hasta
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={inputCls} />
          </label>
          <label className="flex flex-col gap-1 text-[10px] font-bold uppercase text-gray-500">
            Línea
            <select value={lineFilter} onChange={(e) => setLineFilter(e.target.value)} className={inputCls}>
              <option value="todas">Todas las líneas</option>
              {lines.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[10px] font-bold uppercase text-gray-500">
            Estado del lote
            <select value={estadoFilter} onChange={(e) => setEstadoFilter(e.target.value)} className={inputCls}>
              <option value="todos">Todos</option>
              <option value="COMPLETADO">Completados</option>
              <option value="EN_PROCESO">En proceso</option>
              <option value="ANULADO">Anulados</option>
            </select>
          </label>
        </div>
        <p className="text-[11px] text-gray-500">
          {loading ? 'Cargando datos desde la base de datos...' : `${filteredLots.length} lotes y ${filteredAudit.length} registros de auditoría coinciden con los filtros.`}
        </p>
        {error && <div className="text-xs font-bold text-red-700">{error}</div>}
        {busy && <div className="text-xs font-bold text-[#1B4E9B]">{busy}</div>}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {DATASETS.map((d) => (
          <div key={d.key} className={`${card} p-4 flex flex-col gap-3 ${selected.has(d.key) ? 'ring-2 ring-[#1B4E9B]/30' : ''}`}>
            <div className="flex items-start gap-3">
              <input type="checkbox" checked={selected.has(d.key)} onChange={() => toggle(d.key)} className="mt-1 accent-[#1B4E9B] cursor-pointer" />
              <span className="material-symbols-outlined text-[#1B4E9B] text-[22px]">{d.icon}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-sm font-bold text-gray-900">{d.title}</h4>
                  <span className="text-[10px] font-bold text-gray-500 bg-[#F2F4F7] border border-[#D6DEEA] px-2 py-0.5 rounded-full whitespace-nowrap">
                    {d.count} {typeof d.count === 'number' ? 'filas' : ''}
                  </span>
                </div>
                <p className="text-[11px] text-gray-500 mt-0.5">{d.desc}</p>
              </div>
            </div>
            <div className="flex gap-2 mt-auto">
              <button
                onClick={() => void runExport([d.key], 'csv', `${d.title.replace(/\s+/g, '_')}_${stamp()}`)}
                disabled={disabled}
                className="flex-1 h-9 rounded-xl bg-white border border-[#D6DEEA] text-xs font-bold text-gray-700 hover:bg-[#F2F4F7] cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1"
              >
                <span className="material-symbols-outlined text-[16px]">description</span>
                CSV
              </button>
              <button
                onClick={() => void runExport([d.key], 'xlsx', `${d.title.replace(/\s+/g, '_')}_${stamp()}`)}
                disabled={disabled}
                className="flex-1 h-9 rounded-xl bg-[#5FAF32] hover:bg-[#4E9628] text-white text-xs font-bold cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1"
              >
                <span className="material-symbols-outlined text-[16px]">table_view</span>
                Excel
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className={`${card} p-5 flex flex-col gap-3`}>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#1B4E9B] text-[20px]">folder_zip</span>
            <h3 className="text-sm font-bold text-gray-900">Reporte consolidado</h3>
          </div>
          <p className="text-[11px] text-gray-500">
            Un solo archivo Excel con una hoja por cada conjunto marcado ({selected.size} seleccionados). Encabezados fijos y filtros activados.
          </p>
          <button
            onClick={() => void runExport(DATASETS.filter((d) => selected.has(d.key)).map((d) => d.key), 'xlsx', `Reporte_QCS_${stamp()}`)}
            disabled={disabled || selected.size === 0}
            className="h-10 rounded-xl bg-[#1B4E9B] hover:bg-[#143A73] text-white text-xs font-bold cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[18px]">download</span>
            Descargar reporte Excel
          </button>
        </div>

        <div className={`${card} p-5 flex flex-col gap-3`}>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#1B4E9B] text-[20px]">assignment</span>
            <h3 className="text-sm font-bold text-gray-900">Ficha completa de un lote</h3>
          </div>
          <select value={fichaLote} onChange={(e) => setFichaLote(e.target.value)} className={inputCls}>
            <option value="">Selecciona un lote...</option>
            {history.map((h) => (
              <option key={h.id} value={h.id}>
                {h.codigo_lote} · {h.producto_nombre} · {ESTADO_LABEL[h.estado] ?? h.estado}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <button
              onClick={() => void exportFicha('csv')}
              disabled={disabled || !fichaLote}
              className="flex-1 h-10 rounded-xl bg-white border border-[#D6DEEA] text-xs font-bold text-gray-700 hover:bg-[#F2F4F7] cursor-pointer disabled:opacity-50"
            >
              Variables en CSV
            </button>
            <button
              onClick={() => void exportFicha('xlsx')}
              disabled={disabled || !fichaLote}
              className="flex-1 h-10 rounded-xl bg-[#5FAF32] hover:bg-[#4E9628] text-white text-xs font-bold cursor-pointer disabled:opacity-50"
            >
              Ficha en Excel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
