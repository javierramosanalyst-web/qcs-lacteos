import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AuditLogEntry, ProductDefinition, ProductionLine, UserProfile } from '../../types';
import { BatchHistoryRow, fetchAuditLogs, fetchBatchDetail, fetchBatchHistory, lineUiId } from '../../api/client';
import { CellValue, ExportColumn, ExportSheet, buildCsv, exportCsv, exportXlsx, exportZip } from '../../utils/exporters';

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

const FILE_SLUG: Record<DatasetKey, string> = {
  historial: 'Historial_Lotes',
  produccion: 'Resumen_Producto',
  variables: 'Variables_Proceso',
  auditoria: 'Auditoria',
  anulados: 'Lotes_Anulados',
  usuarios: 'Usuarios',
  lineas: 'Lineas_Productos',
};

const PREFIX = {
  historial: '[HISTORIAL]',
  auditoria: '[AUDITORÍA]',
  anulado: '[ANULADO]',
  producto: '[PRODUCTO]',
} as const;

const card = 'bg-white rounded-2xl border border-[#D6DEEA] shadow-xs';

const fmtDateTime = (iso: string | null | undefined): string =>
  iso ? new Date(iso).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' }) : '';

const toDate = (v: string | number | null | undefined): Date | null => {
  if (v === null || v === undefined || v === '') return null;
  const d = typeof v === 'number' ? new Date(v) : /^\d{10,}$/.test(v) ? new Date(Number(v)) : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

const fmtDate = (v: string | number | null | undefined): string => {
  const d = toDate(v);
  return d ? d.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '';
};

const fmtTime = (v: string | number | null | undefined): string => {
  const d = toDate(v);
  return d ? d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }) : '';
};

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

const STAGE_LABELS: Record<string, string> = {
  acidificar: '1. Acidificar leche',
  calentarYCuajar: '2. Calentar y cuajar',
  desuerar: '3. Desuerar y escurrir',
  hilar: '4. Hilar y salar',
  moldesDesglose: '5. Moldes y pesos',
  pasteurizacion: '1. Pasteurización y enfriamiento',
  inoculacion: '2. Inoculación e incubación',
  maduracionFrio: '3. Maduración en frío',
  batidoYAdiciones: '4. Batido y adiciones',
  envasado: '5. Envasado',
  lotesLeche: 'Materia prima · lotes de leche',
  observaciones: 'Observaciones del lote',
  operariosIntervinientes: 'Equipo que intervino',
  responsableProceso: 'Responsable del proceso',
  actividadOperarios: 'Actividad por operario',
};

const VARIABLE_LABELS: Record<string, string> = {
  litrosLeche: 'Leche pasteurizada',
  litrosConfirmados: 'Leche confirmada',
  lecheFresca: 'Leche fresca',
  lecheAcida: 'Leche ácida',
  litrosLote1: 'Litros del lote de leche 1',
  litrosLote2: 'Litros del lote de leche 2',
  loteLeche1: 'Lote de leche 1',
  loteLeche2: 'Lote de leche 2',
  loteLecheFresca: 'Lote de leche fresca',
  loteAcidoAcetico: 'Lote de ácido acético',
  loteCuajo: 'Lote de cuajo',
  loteSal: 'Lote de sal',
  loteAzucar: 'Lote de azúcar',
  loteEstevia: 'Lote de estevia',
  loteSaborizante: 'Lote de saborizante',
  loteColorante: 'Lote de colorante',
  loteCultivo: 'Lote de cultivo láctico',
  cantidadGramos: 'Cantidad dosificada',
  gramosAzucar: 'Azúcar dosificada',
  kilosAzucar: 'Azúcar dosificada',
  gramosEstevia: 'Estevia dosificada',
  kilosSaborizante: 'Saborizante dosificado',
  saborizanteMl: 'Saborizante dosificado',
  coloranteMl: 'Colorante dosificado',
  acidezLA: 'Acidez (ácido láctico)',
  phActual: 'pH medido',
  phMezcla: 'pH de la mezcla',
  phEscurrido: 'pH del escurrido',
  tempBano: 'Temperatura del baño',
  temperaturaEnvasado: 'Temperatura de envasado',
  temperaturaIncubacion: 'Temperatura de incubación',
  numeroMoldes: 'Número de moldes',
  pesoTotalQueso: 'Peso total de queso',
  pesoTotalHilado: 'Peso total hilado',
  pesadoTotalHiladoKg: 'Peso total hilado',
  pesoTotalCalculadoKg: 'Peso total calculado',
  moldes100g: 'Moldes de 100 g',
  moldes200g: 'Moldes de 200 g',
  moldes400g: 'Moldes de 400 g',
  moldes800g: 'Moldes de 800 g',
  moldes1600g: 'Moldes de 1600 g',
  moldes7Cueros350g: 'Moldes 7 Cueros de 350 g',
  moldesTrenza350g: 'Moldes trenza de 350 g',
  moldesPeraGrande350g: 'Moldes Pera grande de 350 g',
  moldes60g: 'Moldes de 60 g',
  botella120ml: 'Botellas de 120 ml',
  botella200ml: 'Botellas de 200 ml',
  botella1L: 'Botellas de 1 L',
  botella2L: 'Botellas de 2 L',
  botella4L: 'Botellas de 4 L',
  bolsa4L: 'Bolsas de 4 L',
  vaso150g: 'Vasos de 150 g',
  vaso200g: 'Vasos de 200 g',
  botella1000g: 'Botellas de 1000 g',
  botella500g: 'Botellas de 500 g',
  tarro1000g: 'Tarros de 1000 g',
  tarro500g: 'Tarros de 500 g',
  vaso120g: 'Vasos de 120 g',
  bolsa4l: 'Bolsas de 4 L',
  resultado: 'Resultado de la prueba',
  exitosa: 'Prueba superada',
  tiempoTotalProceso: 'Tiempo total del proceso',
  selladoVerificado: 'Sellado verificado',
  rotuladoCumpleNTC805: 'Rotulado conforme a NTC 805',
  procesoFinalizado: 'Proceso finalizado',
  horaFinalizacion: 'Hora de finalización',
  horaInicio: 'Hora de inicio',
  horaFin: 'Hora de fin',
  horaRegistro: 'Hora de registro',
  hora40GradosReferencia: 'Hora de referencia a 40 °C',
  tiempoDesuerado: 'Tiempo de desuerado',
  segundosDesuerado: 'Tiempo de desuerado',
  tiempoDesdeDesuerado: 'Tiempo desde el desuerado',
  tiempoCalentamiento: 'Tiempo de calentamiento',
  tiempoCuajado: 'Tiempo de cuajado',
  tiempoCorte: 'Tiempo de corte',
  tiempoEscurrido: 'Tiempo de escurrido',
  duracionHilado: 'Duración del hilado',
  duracion: 'Duración',
  tipoYogur: 'Variedad de yogur',
  litrosBase: 'Litros base de la variedad',
  litrosYogurConAzucar: 'Litros destinados a yogur con azúcar',
  litrosYogurSinAzucar: 'Litros destinados a yogur sin azúcar',
  litrosYogurGriego: 'Litros destinados a yogur griego',
  litrosKumis: 'Litros destinados a kumis',
  litrosKumisDestinados: 'Litros destinados a kumis',
  incluyeKumis: 'El lote incluye kumis',
  llevaAzucar: 'El lote lleva azúcar',
  sabor: 'Sabor',
  variedad: 'Variedad',
  masaFormulada: 'Masa formulada',
  rendimiento: 'Rendimiento',
  merma: 'Merma',
  temperatura: 'Temperatura',
  temperaturaAlcanzada: 'Temperatura alcanzada',
  temperaturaSembrado: 'Temperatura de siembra',
  dosis: 'Dosis',
  dosisDv: 'Dosis de cultivo (DV)',
  adicion: 'Adición',
  adiciones: 'Adiciones',
  observaciones: 'Observaciones',
  responsable: 'Responsable',
  operario: 'Operario',
  nombre: 'Nombre',
  codigo: 'Código',
  descripcion: 'Descripción',
  motivo: 'Motivo',
  justificacion: 'Justificación',
};

const SKIP_VAR =
  /(^|\.)(id|line|lineId|productId|productName|standard|status|operator|operatorRole|version|processTimer|stageStatuses|esManual|registrado|iniciado|completado|confirmado|saved|habilitado|timestamp[A-Za-z0-9]*|hora[A-Za-z0-9]*|fecha[A-Za-z0-9]*|[a-zA-Z]+At|[a-zA-Z]+Ms)$/;

const ACRONYMS: Record<string, string> = {
  ph: 'pH',
  ntc: 'NTC',
  dv: 'DV',
  la: 'LA',
  kg: 'kg',
  ml: 'ml',
  l: 'L',
  pt100: 'PT-100',
  ui: 'UI',
};

const humanize = (key: string): string =>
  key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1 $2')
    .replace(/([A-Za-z])(\d)/g, '$1 $2')
    .replace(/(\d)([A-Za-z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .map((w) => ACRONYMS[w.toLowerCase()] ?? (/^\d/.test(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ');

const labelFor = (key: string): string => {
  if (VARIABLE_LABELS[key]) return VARIABLE_LABELS[key];
  const prefixed = /^(sinAzucar|stevia)_(.+)$/.exec(key);
  if (prefixed) {
    const base = VARIABLE_LABELS[prefixed[2]] ?? humanize(prefixed[2]);
    return `${prefixed[1] === 'sinAzucar' ? 'Sin azúcar' : 'Con estevia'} › ${base}`;
  }
  return humanize(key);
};

const unitFor = (key: string): string => {
  if (/^(sinAzucar_|stevia_)?(botella|bolsa|vaso|tarro|tarrina|moldes)/i.test(key)) return 'und';
  if (/Litros$|^litros/i.test(key)) return 'L';
  if (/Gramos$|^gramos/i.test(key)) return 'g';
  if (/Kilos$|Kg$|^kilos/i.test(key)) return 'kg';
  if (/Ml$|^ml/i.test(key)) return 'ml';
  if (/Grados|Temperatura|^temp/i.test(key)) return '°C';
  if (/Segundos$|^segundos/i.test(key)) return 's';
  if (/Minutos$|^minutos/i.test(key)) return 'min';
  if (/Porcentaje|Rendimiento|^rendimiento/i.test(key)) return '%';
  if (/^ph/i.test(key)) return 'pH';
  return '';
};

const collectVariables = (batch: unknown): { etapa: string; variable: string; valor: CellValue; unidad: string }[] => {
  const out: { etapa: string; variable: string; valor: CellValue; unidad: string }[] = [];
  const walk = (node: unknown, trail: string[]) => {
    if (node === null || node === undefined || node === '') return;
    if (typeof node === 'number' || typeof node === 'string' || typeof node === 'boolean') {
      const key = trail[trail.length - 1] ?? '';
      if (SKIP_VAR.test(key)) return;
      if (typeof node === 'number' && node === 0) return;
      const stageKey = trail[0] ?? '';
      const etapa = STAGE_LABELS[stageKey] ?? humanize(stageKey);
      const path = trail.slice(1).map((t) => (/^\d+$/.test(t) ? `#${Number(t) + 1}` : labelFor(t)));
      const variable = path.length ? path.join(' › ') : labelFor(key);
      let valor: CellValue = node;
      if (typeof node === 'boolean') valor = node ? 'Sí' : 'No';
      else if (typeof node === 'number' && node > 1e11 && node < 1e14) valor = new Date(node).toLocaleString('es-CO');
      out.push({ etapa, variable, valor, unidad: typeof node === 'number' ? unitFor(key) : '' });
      return;
    }
    if (Array.isArray(node)) {
      node.forEach((item, i) => walk(item, [...trail, String(i)]));
      return;
    }
    if (typeof node === 'object') {
      Object.entries(node as Record<string, unknown>).forEach(([k, v]) => {
        if (SKIP_VAR.test(k)) return;
        walk(v, [...trail, k]);
      });
    }
  };
  walk(batch, []);
  return out;
};

const FORMAT_LITERS: Record<string, number> = {
  botella120ml: 0.12,
  botella200ml: 0.2,
  botella1L: 1,
  botella2L: 2,
  botella4L: 4,
  bolsa4L: 4,
  vaso120g: 0.12,
  vaso150g: 0.15,
  vaso200g: 0.2,
  botella500g: 0.5,
  botella1000g: 1,
  tarro500g: 0.5,
  tarro1000g: 1,
};

const formatLiters = (key: string): number => {
  const base = key.replace(/^(sinAzucar_|stevia_)/, '');
  if (FORMAT_LITERS[base] !== undefined) return FORMAT_LITERS[base];
  const m = /(\d+(?:[.,]\d+)?)(ml|l|kg|g)$/i.exec(base);
  if (!m) return 0;
  const n = Number(m[1].replace(',', '.'));
  const u = m[2].toLowerCase();
  if (u === 'ml' || u === 'g') return n / 1000;
  return n;
};

const productionOutcome = (
  batch: any,
  lecheLitros: number | null
): { kg: number | null; unidades: number | null; rendimiento: number | null } => {
  if (!batch) return { kg: null, unidades: null, rendimiento: null };
  const leche = lecheLitros && lecheLitros > 0 ? lecheLitros : null;

  const moldes = batch.moldesDesglose ?? {};
  const moldesQueso =
    (Number(moldes.moldes100g) || 0) * 0.1 +
    (Number(moldes.moldes200g) || 0) * 0.2 +
    (Number(moldes.moldes400g) || 0) * 0.4 +
    (Number(moldes.moldes800g) || 0) * 0.8 +
    (Number(moldes.moldes1600g) || 0) * 1.6;
  const kgQueso =
    Number(batch.hilar?.pesoTotalQueso) ||
    Number(moldes.pesoTotalCalculadoKg) ||
    Number(moldes.pesadoTotalHiladoKg) ||
    moldesQueso ||
    0;
  const unidadesQueso = Number(batch.hilar?.numeroMoldes) || 0;

  const envasado = batch.envasado ?? {};
  let unidadesEnv = 0;
  let litrosEnv = 0;
  Object.entries(envasado as Record<string, unknown>).forEach(([groupKey, group]) => {
    if (!/^formatos/i.test(groupKey) || !group || typeof group !== 'object') return;
    Object.entries(group as Record<string, unknown>).forEach(([k, v]) => {
      const n = Number(v) || 0;
      if (n <= 0) return;
      unidadesEnv += n;
      litrosEnv += n * formatLiters(k);
    });
  });
  const kgEnv = Math.round(litrosEnv * 1.03 * 100) / 100;

  const kg = kgQueso > 0 ? Math.round(kgQueso * 100) / 100 : kgEnv > 0 ? kgEnv : null;
  const unidades = unidadesQueso > 0 ? unidadesQueso : unidadesEnv > 0 ? unidadesEnv : null;
  const base = kgQueso > 0 ? kgQueso : litrosEnv;
  const rendimiento = leche && base > 0 ? Math.round((base / leche) * 1000) / 10 : null;
  return { kg, unidades, rendimiento };
};

const stamp = () => {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}_${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}`;
};

interface LotPickerProps {
  rows: BatchHistoryRow[];
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
}

const LotPicker: React.FC<LotPickerProps> = ({ rows, value, onChange, disabled }) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
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

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = rows
      .filter((r) => {
        if (!q) return true;
        const hay = [
          r.codigo_lote,
          r.producto_nombre,
          r.responsable_nombre,
          ESTADO_LABEL[r.estado] ?? r.estado,
          fmtDate(r.iniciado_at),
          fmtTime(r.iniciado_at),
        ]
          .join(' ')
          .toLowerCase();
        return hay.includes(q);
      })
      .sort((a, b) => (toDate(b.iniciado_at)?.getTime() ?? 0) - (toDate(a.iniciado_at)?.getTime() ?? 0));
    const map = new Map<string, BatchHistoryRow[]>();
    filtered.forEach((r) => {
      const list = map.get(r.producto_nombre);
      if (list) list.push(r);
      else map.set(r.producto_nombre, [r]);
    });
    return [...map.entries()];
  }, [rows, query]);

  const total = groups.reduce((n, [, list]) => n + list.length, 0);

  const pick = (id: string) => {
    onChange(id);
    setOpen(false);
    setQuery('');
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
              <span className="text-xs font-bold text-gray-900 break-all">{selected.codigo_lote}</span>
              <span className="text-[11px] text-gray-500 break-words">
                {selected.producto_nombre} · {fmtDate(selected.iniciado_at)} {fmtTime(selected.iniciado_at)} ·{' '}
                {ESTADO_LABEL[selected.estado] ?? selected.estado}
              </span>
            </span>
          ) : (
            <span className="text-xs font-semibold text-gray-500">Buscar lote por código, producto, fecha o responsable…</span>
          )}
        </span>
        <span className="material-symbols-outlined text-[18px] text-gray-400 shrink-0">{open ? 'expand_less' : 'expand_more'}</span>
      </button>

      {open && (
        <div className="absolute z-30 mt-1 w-full rounded-xl border border-[#D6DEEA] bg-white shadow-xl overflow-hidden">
          <div className="p-2 border-b border-[#E7ECF3]">
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Escribe código, producto, fecha (dd/mm/aaaa) o responsable"
              className="w-full h-9 px-3 rounded-lg bg-[#F7F9FC] border border-[#D6DEEA] text-xs font-semibold text-gray-800 outline-none focus:border-[#1B4E9B]"
            />
            <div className="mt-1 px-1 text-[10px] font-bold text-gray-500">
              {total} lote(s) · ordenados del más reciente al más antiguo
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
                      <span className="block text-xs font-bold text-gray-900 break-all">{r.codigo_lote}</span>
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
  const [productFilter, setProductFilter] = useState('todos');
  const [responsableFilter, setResponsableFilter] = useState('todos');
  const [search, setSearch] = useState('');
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

  const hasFilters =
    !!from || !!to || lineFilter !== 'todas' || estadoFilter !== 'todos' || productFilter !== 'todos' || responsableFilter !== 'todos' || !!search.trim();

  const productOptions = useMemo(() => Array.from(new Set(history.map((h) => h.producto_nombre))).sort(), [history]);
  const responsableOptions = useMemo(() => Array.from(new Set(history.map((h) => h.responsable_nombre).filter(Boolean))).sort(), [history]);

  const filteredLots = useMemo(() => {
    const q = search.trim().toLowerCase();
    return history
      .filter(
        (h) =>
          inRange(h.iniciado_at) &&
          (lineFilter === 'todas' || lineUiId(h.linea_codigo) === lineFilter) &&
          (estadoFilter === 'todos' || h.estado === estadoFilter) &&
          (productFilter === 'todos' || h.producto_nombre === productFilter) &&
          (responsableFilter === 'todos' || h.responsable_nombre === responsableFilter) &&
          (!q || h.codigo_lote.toLowerCase().includes(q))
      )
      .sort((a, b) => new Date(a.iniciado_at).getTime() - new Date(b.iniciado_at).getTime());
  }, [history, from, to, lineFilter, estadoFilter, productFilter, responsableFilter, search]);

  const filteredAudit = useMemo(() => {
    const codes = new Set(filteredLots.map((h) => h.codigo_lote));
    return audit.filter((a) => !hasFilters || codes.has(a.batchId));
  }, [audit, filteredLots, hasFilters]);

  const setPreset = (days: number | 'mes' | 'todo') => {
    const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const end = new Date();
    if (days === 'todo') {
      setFrom('');
      setTo('');
      return;
    }
    const start = new Date();
    if (days === 'mes') start.setDate(1);
    else start.setDate(start.getDate() - (days - 1));
    setFrom(fmt(start));
    setTo(fmt(end));
  };

  const clearFilters = () => {
    setFrom('');
    setTo('');
    setLineFilter('todas');
    setEstadoFilter('todos');
    setProductFilter('todos');
    setResponsableFilter('todos');
    setSearch('');
  };

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
        { key: 'kg', label: 'Kg producidos' },
        { key: 'unidades', label: 'Unidades producidas' },
        { key: 'rend', label: 'Rendimiento (%)' },
        { key: 'fechaInicio', label: 'Fecha de inicio' },
        { key: 'horaInicio', label: 'Hora de inicio' },
        { key: 'fechaFin', label: 'Fecha de fin' },
        { key: 'horaFin', label: 'Hora de fin' },
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
        kg: h.kg_producidos ?? null,
        unidades: h.unidades_producidas ?? null,
        rend: h.rendimiento_pct ?? null,
        fechaInicio: fmtDate(h.iniciado_at),
        horaInicio: fmtTime(h.iniciado_at),
        fechaFin: fmtDate(h.finalizado_at),
        horaFin: fmtTime(h.finalizado_at),
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
        { key: 'kg', label: 'Kg producidos en completados' },
        { key: 'unidades', label: 'Unidades producidas en completados' },
        { key: 'rend', label: 'Rendimiento promedio (%)' },
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
          kg: Math.round(done.reduce((s, r) => s + (r.kg_producidos ?? 0), 0) * 100) / 100,
          unidades: done.reduce((s, r) => s + (r.unidades_producidas ?? 0), 0),
          rend: (() => {
            const vals = done.map((r) => r.rendimiento_pct).filter((v): v is number => typeof v === 'number' && v > 0);
            return vals.length ? Math.round((vals.reduce((s, v) => s + v, 0) / vals.length) * 10) / 10 : null;
          })(),
          promedio: durs.length ? Math.round(durs.reduce((s, x) => s + x, 0) / durs.length / 60) : null,
          rect: rows.reduce((s, r) => s + r.rectificaciones, 0),
        };
      }),
    };

    const auditoria: ExportSheet = {
      name: 'Auditoría',
      columns: [
        { key: 'fecha', label: 'Fecha' },
        { key: 'hora', label: 'Hora' },
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
        fecha: fmtDate(a.timestamp),
        hora: fmtTime(a.timestamp),
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
        { key: 'inicio', label: 'Fecha de inicio' },
        { key: 'horaInicio', label: 'Hora de inicio' },
        { key: 'por', label: 'Anulado por' },
        { key: 'fecha', label: 'Fecha de anulación' },
        { key: 'hora', label: 'Hora de anulación' },
        { key: 'motivo', label: 'Motivo', width: 60 },
      ],
      rows: filteredLots
        .filter((h) => h.estado === 'ANULADO')
        .map((h) => ({
          lote: h.codigo_lote,
          producto: h.producto_nombre,
          linea: h.linea_nombre,
          responsable: h.responsable_nombre,
          inicio: fmtDate(h.iniciado_at),
          horaInicio: fmtTime(h.iniciado_at),
          por: h.anulado_por ?? '',
          fecha: fmtDate(h.anulado_at),
          hora: fmtTime(h.anulado_at),
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

  const consolidated = useMemo<ExportSheet | null>(() => {
    if (sheets.historial.rows.length === 0) return null;

    const auditByLot = new Map<string, Record<string, CellValue>[]>();
    sheets.auditoria.rows.forEach((r) => {
      const key = String(r.lote ?? '');
      auditByLot.set(key, [...(auditByLot.get(key) ?? []), r]);
    });
    const anuladoByLot = new Map(sheets.anulados.rows.map((r) => [String(r.lote ?? ''), r]));
    const productoByName = new Map(sheets.produccion.rows.map((r) => [String(r.producto ?? ''), r]));

    const columns: ExportColumn[] = [
      ...sheets.historial.columns.map((c) => ({ key: `h_${c.key}`, label: `${PREFIX.historial} ${c.label}`, width: c.width })),
      { key: 'a_total', label: `${PREFIX.auditoria} Correcciones` },
      { key: 'a_fecha', label: `${PREFIX.auditoria} Fecha de la última corrección` },
      { key: 'a_hora', label: `${PREFIX.auditoria} Hora de la última corrección` },
      { key: 'a_etapa', label: `${PREFIX.auditoria} Etapa` },
      { key: 'a_variable', label: `${PREFIX.auditoria} Variable` },
      { key: 'a_anterior', label: `${PREFIX.auditoria} Valor anterior` },
      { key: 'a_nuevo', label: `${PREFIX.auditoria} Valor nuevo` },
      { key: 'a_causal', label: `${PREFIX.auditoria} Causal` },
      { key: 'a_just', label: `${PREFIX.auditoria} Justificación`, width: 60 },
      { key: 'a_admin', label: `${PREFIX.auditoria} Autorizado por` },
      { key: 'n_por', label: `${PREFIX.anulado} Anulado por` },
      { key: 'n_fecha', label: `${PREFIX.anulado} Fecha de anulación` },
      { key: 'n_hora', label: `${PREFIX.anulado} Hora de anulación` },
      { key: 'n_motivo', label: `${PREFIX.anulado} Motivo`, width: 60 },
      { key: 'p_total', label: `${PREFIX.producto} Lotes del producto` },
      { key: 'p_completados', label: `${PREFIX.producto} Completados` },
      { key: 'p_proceso', label: `${PREFIX.producto} En proceso` },
      { key: 'p_anulados', label: `${PREFIX.producto} Anulados` },
      { key: 'p_leche', label: `${PREFIX.producto} Leche procesada (L)` },
      { key: 'p_promedio', label: `${PREFIX.producto} Duración promedio (min)` },
    ];

    const rows = sheets.historial.rows.map((h) => {
      const lote = String(h.lote ?? '');
      const correcciones = (auditByLot.get(lote) ?? []).slice().sort((a, b) => {
        const ta = new Date(String(a.fecha ?? '')).getTime();
        const tb = new Date(String(b.fecha ?? '')).getTime();
        return (Number.isFinite(ta) ? ta : 0) - (Number.isFinite(tb) ? tb : 0);
      });
      const ultima = correcciones[correcciones.length - 1];
      const anulado = anuladoByLot.get(lote);
      const producto = productoByName.get(String(h.producto ?? ''));

      const row: Record<string, CellValue> = {};
      sheets.historial.columns.forEach((c) => {
        row[`h_${c.key}`] = h[c.key];
      });
      row.a_total = correcciones.length;
      row.a_fecha = ultima?.fecha ?? '';
      row.a_hora = ultima?.hora ?? '';
      row.a_etapa = ultima?.etapa ?? '';
      row.a_variable = ultima?.variable ?? '';
      row.a_anterior = ultima?.anterior ?? '';
      row.a_nuevo = ultima?.nuevo ?? '';
      row.a_causal = ultima?.causal ?? '';
      row.a_just = ultima?.just ?? '';
      row.a_admin = ultima?.admin ?? '';
      row.n_por = anulado?.por ?? '';
      row.n_fecha = anulado?.fecha ?? '';
      row.n_hora = anulado?.hora ?? '';
      row.n_motivo = anulado?.motivo ?? '';
      row.p_total = producto?.total ?? null;
      row.p_completados = producto?.completados ?? null;
      row.p_proceso = producto?.proceso ?? null;
      row.p_anulados = producto?.anulados ?? null;
      row.p_leche = producto?.leche ?? null;
      row.p_promedio = producto?.promedio ?? null;
      return row;
    });

    return { name: 'Datos Consolidados', columns, rows };
  }, [sheets]);

  const buildVariablesSheet = async (lots: BatchHistoryRow[]): Promise<ExportSheet> => {
    const rows: Record<string, CellValue>[] = [];
    for (let i = 0; i < lots.length; i += 1) {
      const lot = lots[i];
      setBusy(`Leyendo variables del lote ${i + 1} de ${lots.length}...`);
      try {
        const detail = await fetchBatchDetail(lot.id);
        const out = collectVariables(detail.estado_ui?.batch);
        out.forEach((o) =>
          rows.push({
            lote: lot.codigo_lote,
            producto: lot.producto_nombre,
            linea: lot.linea_nombre,
            estado: ESTADO_LABEL[lot.estado] ?? lot.estado,
            etapa: o.etapa,
            variable: o.variable,
            valor: o.valor,
            unidad: o.unidad,
          })
        );
      } catch {
        rows.push({ lote: lot.codigo_lote, producto: lot.producto_nombre, linea: lot.linea_nombre, estado: lot.estado, etapa: 'Error', variable: 'No se pudo leer el lote', valor: '', unidad: '' });
      }
    }
    return {
      name: 'Variables de proceso',
      columns: [
        { key: 'lote', label: 'Lote' },
        { key: 'producto', label: 'Producto' },
        { key: 'linea', label: 'Línea' },
        { key: 'estado', label: 'Estado' },
        { key: 'etapa', label: 'Etapa del proceso' },
        { key: 'variable', label: 'Variable registrada', width: 45 },
        { key: 'valor', label: 'Valor', width: 40 },
        { key: 'unidad', label: 'Unidad' },
      ],
      rows,
    };
  };

  const getSheet = async (key: DatasetKey): Promise<ExportSheet> =>
    key === 'variables' ? buildVariablesSheet(filteredLots.filter((l) => l.estado !== 'ANULADO')) : sheets[key];

  const ORDER: DatasetKey[] = ['historial', 'produccion', 'variables', 'auditoria', 'anulados', 'usuarios', 'lineas'];

  const filterSummary = (): string => {
    const parts: string[] = [];
    if (from || to) parts.push(`Fechas: ${from || 'inicio'} a ${to || 'hoy'}`);
    if (lineFilter !== 'todas') parts.push(`Línea: ${lines.find((l) => l.id === lineFilter)?.name ?? lineFilter}`);
    if (productFilter !== 'todos') parts.push(`Producto: ${productFilter}`);
    if (estadoFilter !== 'todos') parts.push(`Estado: ${ESTADO_LABEL[estadoFilter] ?? estadoFilter}`);
    if (responsableFilter !== 'todos') parts.push(`Responsable: ${responsableFilter}`);
    if (search.trim()) parts.push(`Lote contiene: ${search.trim()}`);
    return parts.length ? parts.join(' | ') : 'Sin filtros (todos los lotes)';
  };

  const runExport = async (format: 'csv' | 'xlsx') => {
    const keys = ORDER.filter((k) => selected.has(k));
    if (keys.length === 0) return;
    setBusy('Preparando archivo...');
    try {
      const built: { key: DatasetKey; sheet: ExportSheet }[] = [];
      for (const k of keys) built.push({ key: k, sheet: await getSheet(k) });
      const base = `QCS_${stamp()}`;
      if (format === 'csv') {
        if (built.length === 1) exportCsv(built[0].sheet, `${FILE_SLUG[built[0].key]}_${stamp()}`);
        else
          exportZip(
            built.map(({ key, sheet }) => ({
              name: `${String(ORDER.indexOf(key) + 1).padStart(2, '0')}_${FILE_SLUG[key]}.csv`,
              content: buildCsv(sheet),
            })),
            base
          );
      } else {
        const indice: ExportSheet = {
          name: 'Índice',
          columns: [
            { key: 'hoja', label: 'Hoja' },
            { key: 'contenido', label: 'Contenido', width: 70 },
            { key: 'filas', label: 'Filas' },
          ],
          rows: [
            { hoja: 'Datos Consolidados', contenido: 'Una fila por lote: historial unido con auditoría, anulación y resumen del producto. Los encabezados llevan el prefijo [HISTORIAL], [AUDITORÍA], [ANULADO] o [PRODUCTO] según su origen.', filas: consolidated?.rows.length ?? 0 },
            ...built.map(({ key, sheet }) => ({
              hoja: sheet.name,
              contenido: DATASETS.find((d) => d.key === key)?.desc ?? '',
              filas: sheet.rows.length,
            })),
            { hoja: 'Filtros aplicados', contenido: filterSummary(), filas: null },
            { hoja: 'Generado', contenido: new Date().toLocaleString('es-CO'), filas: null },
            { hoja: 'Relación entre hojas', contenido: 'La columna "Lote" enlaza Historial, Variables de proceso, Auditoría y Lotes anulados. En Datos Consolidados cada lote aparece una sola vez; si no tiene auditoría o no fue anulado, esas celdas quedan vacías.', filas: null },
          ],
        };
        const sheetsOut: ExportSheet[] = [indice];
        if (consolidated) sheetsOut.push(consolidated);
        built.forEach(({ sheet }) => sheetsOut.push(sheet));
        exportXlsx(sheetsOut, base);
      }
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
          { key: 'campo', label: 'Dato del lote', width: 42 },
          { key: 'valor', label: 'Valor', width: 50 },
        ],
        rows: [
          { campo: 'Código del lote', valor: lot.codigo_lote },
          { campo: 'Producto', valor: lot.producto_nombre },
          { campo: 'Código del producto', valor: lot.producto_codigo },
          { campo: 'Línea de producción', valor: lot.linea_nombre },
          { campo: 'Responsable del lote', valor: lot.responsable_nombre },
          { campo: 'Estado del lote', valor: ESTADO_LABEL[lot.estado] ?? lot.estado },
          { campo: 'Etapa actual', valor: lot.estado === 'EN_PROCESO' ? humanize(lot.etapa_actual_codigo ?? '') : 'Proceso terminado' },
          { campo: 'Leche base utilizada (L)', valor: toNumber(lot.volumen_leche_base_litros) },
          { campo: 'Kg producidos', valor: lot.kg_producidos ?? null },
          { campo: 'Unidades producidas', valor: lot.unidades_producidas ?? null },
          { campo: 'Rendimiento (%)', valor: lot.rendimiento_pct ?? null },
          { campo: 'Fecha de inicio', valor: fmtDate(lot.iniciado_at) },
          { campo: 'Hora de inicio', valor: fmtTime(lot.iniciado_at) },
          { campo: 'Fecha de fin', valor: fmtDate(lot.finalizado_at) },
          { campo: 'Hora de fin', valor: fmtTime(lot.finalizado_at) },
          { campo: 'Duración total (h:mm)', valor: fmtDuration(lot.duracion_total_segundos) },
          { campo: 'Duración total (min)', valor: lot.duracion_total_segundos ? Math.round(lot.duracion_total_segundos / 60) : null },
          { campo: 'Rectificaciones registradas', valor: lot.rectificaciones },
          { campo: 'Anulado por', valor: lot.anulado_por ?? '' },
          { campo: 'Fecha de anulación', valor: fmtDate(lot.anulado_at) },
          { campo: 'Hora de anulación', valor: fmtTime(lot.anulado_at) },
          { campo: 'Motivo de anulación', valor: lot.anulacion_justificacion ?? '' },
        ],
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
  const selectedList = ORDER.filter((k) => selected.has(k));
  const presetCls = 'px-3 h-8 rounded-lg border border-[#D6DEEA] bg-white text-[11px] font-bold text-gray-700 hover:bg-[#F2F4F7] cursor-pointer';
  const stepBadge = 'w-6 h-6 rounded-full bg-[#1B4E9B] text-white text-xs font-black flex items-center justify-center shrink-0';

  return (
    <div className="flex flex-col gap-4">
      <div className={`${card} p-5 flex flex-col gap-4`}>
        <div className="flex items-center justify-between border-b border-[#D6DEEA] pb-3">
          <div className="flex items-center gap-2">
            <span className={stepBadge}>1</span>
            <h3 className="text-sm font-bold text-gray-900">Filtra los lotes a exportar</h3>
          </div>
          <div className="flex items-center gap-3">
            {hasFilters && (
              <button onClick={clearFilters} className="text-xs text-red-700 font-bold hover:underline cursor-pointer">
                Limpiar filtros
              </button>
            )}
            <button onClick={() => void load()} disabled={disabled} className="text-xs text-[#1B4E9B] font-bold hover:underline cursor-pointer disabled:opacity-50">
              Recargar datos
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-bold uppercase text-gray-500 mr-1">Periodo rápido</span>
          <button className={presetCls} onClick={() => setPreset(1)}>Hoy</button>
          <button className={presetCls} onClick={() => setPreset(7)}>Últimos 7 días</button>
          <button className={presetCls} onClick={() => setPreset(30)}>Últimos 30 días</button>
          <button className={presetCls} onClick={() => setPreset('mes')}>Este mes</button>
          <button className={presetCls} onClick={() => setPreset('todo')}>Todo</button>
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
            Producto
            <select value={productFilter} onChange={(e) => setProductFilter(e.target.value)} className={inputCls}>
              <option value="todos">Todos los productos</option>
              {productOptions.map((n) => (
                <option key={n} value={n}>
                  {n}
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
          <label className="flex flex-col gap-1 text-[10px] font-bold uppercase text-gray-500">
            Responsable
            <select value={responsableFilter} onChange={(e) => setResponsableFilter(e.target.value)} className={inputCls}>
              <option value="todos">Todos</option>
              {responsableOptions.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[10px] font-bold uppercase text-gray-500 col-span-2">
            Buscar por código de lote
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Ej: KUM-102" className={inputCls} />
          </label>
        </div>

        <div className="flex items-center gap-2 bg-[#F2F4F7] border border-[#D6DEEA] rounded-xl px-3 py-2 text-xs text-gray-700">
          <span className="material-symbols-outlined text-[18px] text-[#1B4E9B]">filter_alt</span>
          {loading ? (
            'Cargando datos desde la base de datos...'
          ) : (
            <span>
              <strong>{filteredLots.length}</strong> de {history.length} lotes cumplen los filtros
              {hasFilters ? '' : ' (sin filtros)'}. Los filtros aplican a lotes, variables, auditoría y anulados.
            </span>
          )}
        </div>
        {error && <div className="text-xs font-bold text-red-700">{error}</div>}
      </div>

      <div className={`${card} p-5 flex flex-col gap-3`}>
        <div className="flex items-center justify-between border-b border-[#D6DEEA] pb-3">
          <div className="flex items-center gap-2">
            <span className={stepBadge}>2</span>
            <h3 className="text-sm font-bold text-gray-900">Elige qué información quieres</h3>
          </div>
          <div className="flex items-center gap-3 text-xs font-bold">
            <button onClick={() => setSelected(new Set(ORDER))} className="text-[#1B4E9B] hover:underline cursor-pointer">Seleccionar todo</button>
            <button onClick={() => setSelected(new Set())} className="text-gray-500 hover:underline cursor-pointer">Ninguno</button>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {DATASETS.map((d) => (
            <label
              key={d.key}
              className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                selected.has(d.key) ? 'border-[#1B4E9B] bg-[#1B4E9B]/5' : 'border-[#D6DEEA] bg-white hover:border-[#1B4E9B]/50'
              }`}
            >
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
            </label>
          ))}
        </div>
        <p className="text-[11px] text-gray-500">Usuarios y Líneas y productos no dependen de los filtros: siempre se exporta el catálogo completo.</p>
      </div>

      <div className={`${card} p-5 flex flex-col gap-3`}>
        <div className="flex items-center gap-2 border-b border-[#D6DEEA] pb-3">
          <span className={stepBadge}>3</span>
          <h3 className="text-sm font-bold text-gray-900">Descarga</h3>
        </div>
        <p className="text-xs text-gray-600">
          {selectedList.length === 0
            ? 'Marca al menos un conjunto de información en el paso 2.'
            : `Seleccionado: ${selectedList.map((k) => DATASETS.find((d) => d.key === k)?.title).join(', ')}.`}
        </p>
        <p className="text-[11px] text-gray-500">
          <strong>Excel:</strong> hoja "Índice" con los filtros aplicados, hoja "Datos Consolidados" con una fila por lote (historial + auditoría + anulación + resumen del producto, con prefijos en los encabezados y filtros activos) y luego una hoja por cada conjunto. <strong>CSV:</strong>{' '}
          {selectedList.length > 1 ? 'un archivo ZIP con un CSV por conjunto, numerados en orden (01_Historial_Lotes.csv, 02_Resumen_Producto.csv, 03_Auditoria.csv...).' : 'un archivo CSV.'} En todos, la columna "Lote" enlaza las hojas entre sí.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            onClick={() => void runExport('csv')}
            disabled={disabled || selectedList.length === 0}
            className="h-11 rounded-xl bg-white border border-[#1B4E9B] text-[#1B4E9B] text-sm font-bold hover:bg-[#1B4E9B]/5 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-[20px]">description</span>
            Descargar CSV{selectedList.length > 1 ? ' (ZIP)' : ''}
          </button>
          <button
            onClick={() => void runExport('xlsx')}
            disabled={disabled || selectedList.length === 0}
            className="h-11 rounded-xl bg-[#5FAF32] hover:bg-[#4E9628] text-white text-sm font-bold cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-[20px]">table_view</span>
            Descargar Excel
          </button>
        </div>
        {busy && <div className="text-xs font-bold text-[#1B4E9B]">{busy}</div>}
      </div>

      <div className={`${card} p-5 flex flex-col gap-3`}>
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[#1B4E9B] text-[20px]">assignment</span>
          <h3 className="text-sm font-bold text-gray-900">Ficha completa de un solo lote</h3>
        </div>
        <p className="text-[11px] text-gray-500">Resumen, todas las variables registradas y correcciones de un lote específico.</p>
        <LotPicker rows={history} value={fichaLote} onChange={setFichaLote} disabled={disabled} />
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
  );
};
