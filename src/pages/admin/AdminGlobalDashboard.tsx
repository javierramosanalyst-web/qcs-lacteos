import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ProductDefinition, ProductionLine, UserProfile } from '../../types';
import {
  BatchHistoryRow,
  InactiveLine,
  fetchInactiveLines,
  fetchInactiveUsers,
  lineUiId,
  productUiIdFromCode,
  reactivateLineRequest,
  reactivateUserRequest,
} from '../../api/client';
import { InsumosManager } from './InsumosManager';
import { ExportCenter } from './ExportCenter';
import { loteDeFila } from '../../utils/lote';

interface AdminGlobalDashboardProps {
  lines: ProductionLine[];
  products: ProductDefinition[];
  users: UserProfile[];
  currentUser: UserProfile;
  auditLogsCount: number;
  history: BatchHistoryRow[];
  loading: boolean;
  onRefresh: () => void;
  onManageLineActivation: () => void;
  onEditLine: (line: ProductionLine) => void;
  onDeactivateLine: (line: ProductionLine) => void;
  onCreateUser: () => void;
  onEditUser: (user: UserProfile) => void;
  onDeactivateUser: (user: UserProfile) => void;
  onOpenAuditTrail: () => void;
  onOpenLine: (lineId: string) => void;
  onOpenBatch: (productUiId: string) => void;
  onCorrectBatch: (productUiId: string) => void;
  onViewBatchDetail: (row: BatchHistoryRow) => void;
  onCorrectBatchDetail: (row: BatchHistoryRow) => void;
  onAnnulBatch: (row: BatchHistoryRow, justification: string) => Promise<string | null>;
}

const STATUS_LABEL: Record<ProductionLine['status'], string> = {
  disponible: 'Disponible',
  en_produccion: 'En Producción',
  mantenimiento: 'Mantenimiento',
  limpieza_cip: 'Limpieza CIP',
};

const STATUS_CLASS: Record<ProductionLine['status'], string> = {
  disponible: 'bg-[#5FAF32]/10 text-[#3F7F1E] border-[#5FAF32]/40',
  en_produccion: 'bg-[#1B4E9B]/10 text-[#1B4E9B] border-[#1B4E9B]/40',
  mantenimiento: 'bg-amber-100 text-amber-800 border-amber-300',
  limpieza_cip: 'bg-sky-100 text-sky-800 border-sky-300',
};

const formatDuration = (sec: number | null): string => {
  if (sec === null || sec === undefined) return '—';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return `${h}h ${String(m).padStart(2, '0')}m`;
};

const formatDate = (iso: string | null): string =>
  iso ? new Date(iso).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' }) : '—';

const isToday = (iso: string | null) => {
  if (!iso) return false;
  const d = new Date(iso);
  const n = new Date();
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
};

const card = 'bg-white rounded-2xl border border-[#D6DEEA] shadow-xs';

type AdminTab = 'produccion' | 'usuarios' | 'insumos' | 'anulados' | 'exportar';

type HistorySortKey =
  | 'codigo_lote'
  | 'producto_nombre'
  | 'responsable_nombre'
  | 'volumen'
  | 'iniciado_at'
  | 'finalizado_at'
  | 'duracion'
  | 'estado';

const normText = (v: unknown): string =>
  String(v ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const dayKey = (iso: string | null): string => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const ADMIN_TABS: { key: AdminTab; label: string; icon: string }[] = [
  { key: 'produccion', label: 'Producción y Lotes', icon: 'factory' },
  { key: 'insumos', label: 'Insumos y Lotes', icon: 'inventory_2' },
  { key: 'usuarios', label: 'Usuarios', icon: 'group' },
  { key: 'anulados', label: 'Lotes Anulados', icon: 'block' },
  { key: 'exportar', label: 'Exportar Datos', icon: 'download' },
];

export const AdminGlobalDashboard: React.FC<AdminGlobalDashboardProps> = ({
  lines,
  products,
  users,
  currentUser,
  auditLogsCount,
  history,
  loading,
  onRefresh,
  onManageLineActivation,
  onEditLine,
  onDeactivateLine,
  onCreateUser,
  onEditUser,
  onDeactivateUser,
  onOpenAuditTrail,
  onOpenLine,
  onOpenBatch,
  onCorrectBatch,
  onViewBatchDetail,
  onCorrectBatchDetail,
  onAnnulBatch,
}) => {
  const [tab, setTab] = useState<AdminTab>('produccion');
  const [annulTarget, setAnnulTarget] = useState<BatchHistoryRow | null>(null);
  const [annulText, setAnnulText] = useState('');
  const [annulError, setAnnulError] = useState('');
  const [annulSaving, setAnnulSaving] = useState(false);

  const submitAnnul = async () => {
    if (!annulTarget) return;
    if (annulText.trim().length < 15) {
      setAnnulError('La justificación debe tener al menos 15 caracteres.');
      return;
    }
    setAnnulSaving(true);
    const err = await onAnnulBatch(annulTarget, annulText);
    setAnnulSaving(false);
    if (err) {
      setAnnulError(err);
      return;
    }
    setAnnulTarget(null);
    setAnnulText('');
    setAnnulError('');
  };

  const [inactiveUsers, setInactiveUsers] = useState<UserProfile[]>([]);
  const [inactiveLines, setInactiveLines] = useState<InactiveLine[]>([]);
  const [inactiveError, setInactiveError] = useState('');

  const loadInactive = useCallback(async () => {
    try {
      const [u, l] = await Promise.all([fetchInactiveUsers(), fetchInactiveLines()]);
      setInactiveUsers(u);
      setInactiveLines(l);
      setInactiveError('');
    } catch (err) {
      setInactiveError(err instanceof Error ? err.message : 'No se pudo consultar los inactivos.');
    }
  }, []);

  useEffect(() => {
    void loadInactive();
  }, [loadInactive, users.length, lines.length]);

  const reactivate = async (kind: 'user' | 'line', key: string) => {
    try {
      if (kind === 'user') {
        const pin = window.prompt('Defina un PIN nuevo (4 a 8 digitos) para el usuario reactivado:');
        if (pin === null) return;
        await reactivateUserRequest(key, pin.trim());
      } else await reactivateLineRequest(key);
      await loadInactive();
      onRefresh();
    } catch (err) {
      setInactiveError(err instanceof Error ? err.message : 'No se pudo reactivar.');
    }
  };

  const [historyFilter, setHistoryFilter] = useState<'todos' | 'EN_PROCESO' | 'COMPLETADO'>('todos');
  const inProcess = history.filter((h) => h.estado === 'EN_PROCESO');
  const completedToday = history.filter((h) => h.estado === 'COMPLETADO' && isToday(h.finalizado_at));
  const litersToday = completedToday.reduce((acc, h) => acc + (Number(h.volumen_leche_base_litros) || 0), 0);
  const operators = users.filter((u) => u.role === 'operador');
  const annulled = history.filter((h) => h.estado === 'ANULADO');
  const activeHistory = history.filter((h) => h.estado !== 'ANULADO');
  const filteredHistory = historyFilter === 'todos' ? activeHistory : activeHistory.filter((h) => h.estado === historyFilter);

  // Orden y filtros por columna del historial de lotes
  const [sortKey, setSortKey] = useState<HistorySortKey>('iniciado_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [colFilters, setColFilters] = useState<Record<string, string>>({});

  const setColFilter = (key: string, value: string) => setColFilters((f) => ({ ...f, [key]: value }));
  const hasColFilters = Object.values(colFilters).some((v) => v.trim() !== '');
  const clearColFilters = () => setColFilters({});

  // Opciones de los desplegables de Lote, Producto y Responsable
  // Lote visible por día: al elegir uno salen todos los productos que arrancaron ese día.
  // Se ordenan del día más reciente al más antiguo.
  const loteOptions = useMemo(() => {
    const fechaPorLote = new Map<string, number>();
    activeHistory.forEach((h) => {
      const lote = loteDeFila(h);
      if (!lote) return;
      const t = h.iniciado_at ? new Date(h.iniciado_at).getTime() : 0;
      fechaPorLote.set(lote, Math.max(fechaPorLote.get(lote) ?? 0, t));
    });
    return [...fechaPorLote.entries()].sort((a, b) => b[1] - a[1]).map(([lote]) => lote);
  }, [activeHistory]);
  const productoOptions = useMemo(
    () =>
      [...new Set(activeHistory.map((h) => h.producto_nombre).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b, 'es'),
      ),
    [activeHistory],
  );
  const responsableOptions = useMemo(
    () =>
      [...new Set(activeHistory.map((h) => h.responsable_nombre).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b, 'es'),
      ),
    [activeHistory],
  );

  const toggleSort = (key: HistorySortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortKey(key);
    setSortDir(key === 'volumen' || key === 'iniciado_at' || key === 'finalizado_at' || key === 'duracion' ? 'desc' : 'asc');
  };

  const visibleHistory = useMemo(() => {
    const rows = filteredHistory.filter((h) => {
      if (colFilters.lote && loteDeFila(h) !== colFilters.lote) return false;
      if (colFilters.producto && h.producto_nombre !== colFilters.producto) return false;
      if (colFilters.responsable && h.responsable_nombre !== colFilters.responsable) return false;
      if (colFilters.leche) {
        const litros = normText(Number(h.volumen_leche_base_litros || 0).toLocaleString('es-CO'));
        if (!litros.includes(normText(colFilters.leche))) return false;
      }
      if (colFilters.inicio && dayKey(h.iniciado_at) !== colFilters.inicio) return false;
      if (colFilters.fin && dayKey(h.finalizado_at) !== colFilters.fin) return false;
      if (colFilters.duracion && !normText(formatDuration(h.duracion_total_segundos)).includes(normText(colFilters.duracion))) return false;
      if (colFilters.estado && h.estado !== colFilters.estado) return false;
      return true;
    });

    const valueOf = (h: BatchHistoryRow): number | string => {
      switch (sortKey) {
        case 'volumen':
          return Number(h.volumen_leche_base_litros || 0);
        case 'iniciado_at':
          return h.iniciado_at ? new Date(h.iniciado_at).getTime() : 0;
        case 'finalizado_at':
          return h.finalizado_at ? new Date(h.finalizado_at).getTime() : 0;
        case 'duracion':
          return h.duracion_total_segundos ?? -1;
        case 'estado':
          return h.estado;
        case 'codigo_lote':
          return normText(loteDeFila(h));
        default:
          return normText(h[sortKey]);
      }
    };

    return [...rows].sort((a, b) => {
      const va = valueOf(a);
      const vb = valueOf(b);
      const cmp =
        typeof va === 'number' && typeof vb === 'number'
          ? va - vb
          : String(va).localeCompare(String(vb), 'es', { numeric: true });
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [filteredHistory, colFilters, sortKey, sortDir]);

  const sortIcon = (key: HistorySortKey) =>
    sortKey === key ? (sortDir === 'asc' ? 'arrow_upward' : 'arrow_downward') : 'unfold_more';

  const sortHeader = (label: string, key: HistorySortKey, align: 'left' | 'right' = 'left') => (
    <button
      type="button"
      onClick={() => toggleSort(key)}
      aria-sort={sortKey === key ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
      className={`flex items-center gap-1 text-[10px] font-bold uppercase cursor-pointer hover:text-[#1B4E9B] ${
        sortKey === key ? 'text-[#1B4E9B]' : 'text-gray-500'
      } ${align === 'right' ? 'justify-end w-full' : ''}`}
    >
      <span>{label}</span>
      <span className={`material-symbols-outlined text-[13px] ${sortKey === key ? 'text-[#1B4E9B]' : 'text-gray-300'}`}>
        {sortIcon(key)}
      </span>
    </button>
  );

  const filterInput = 'w-full min-w-[64px] rounded-md border border-[#D6DEEA] bg-white px-1.5 py-1 text-[10px] font-normal normal-case text-gray-700 outline-none focus:border-[#1B4E9B]';
  const lineName = (id?: string) => lines.find((l) => l.id === id)?.name ?? 'Flotante';

  return (
    <div className="flex flex-col w-full p-4 lg:p-6 gap-6 bg-[#F2F4F7] min-h-[calc(100vh-4rem)] pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 lg:p-6 rounded-2xl shadow-sm bg-gradient-to-r from-[#1B4E9B] to-[#143A73] text-white">
        <div className="flex items-center gap-4">
          <img src="/brand/logo-lc.jpg" alt="Lácteos Colombia" className="hidden sm:block w-16 h-16 rounded-2xl object-cover ring-2 ring-white/30" />
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 text-[#8CC63F]">
              <span className="w-2 h-2 rounded-full bg-[#8CC63F] animate-pulse"></span>
              Panel de Supervisión · {currentUser.name}
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold mt-0.5">Dashboard Global de Planta</h1>
            <p className="text-xs text-white/80 mt-1">
              Líneas de producción, lotes en curso, historial, usuarios y rectificaciones auditadas.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={onRefresh}
            className="px-3 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/30 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <span className={`material-symbols-outlined text-[18px] ${loading ? 'animate-spin' : ''}`}>refresh</span>
            <span>Actualizar</span>
          </button>
          <button
            onClick={onManageLineActivation}
            className="px-4 py-2.5 rounded-xl bg-white text-[#1B4E9B] hover:bg-[#F2F4F7] font-bold text-xs flex items-center gap-1.5 shadow-xs transition-all cursor-pointer active:scale-95"
          >
            <span className="material-symbols-outlined text-[18px]">toggle_on</span>
            <span>Activar o Desactivar Línea</span>
          </button>
          <button
            onClick={onCreateUser}
            className="px-4 py-2.5 rounded-xl bg-[#5FAF32] hover:bg-[#4E9628] font-bold text-xs flex items-center gap-1.5 shadow-xs transition-all cursor-pointer active:scale-95"
          >
            <span className="material-symbols-outlined text-[18px]">person_add</span>
            <span>Registrar Operador</span>
          </button>
          <button
            onClick={onOpenAuditTrail}
            className="px-4 py-2.5 rounded-xl bg-[#143A73] hover:bg-[#0F2D5A] border border-white/20 font-bold text-xs flex items-center gap-1.5 shadow-xs transition-all cursor-pointer active:scale-95"
          >
            <span className="material-symbols-outlined text-[18px] text-[#8CC63F]">history_edu</span>
            <span>Auditoría ({auditLogsCount})</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        {[
          { label: 'Lotes en Proceso', value: inProcess.length, sub: `${lines.length} líneas activas`, icon: 'precision_manufacturing', color: 'text-[#1B4E9B]' },
          { label: 'Cerrados Hoy', value: completedToday.length, sub: `${litersToday.toLocaleString('es-CO')} L procesados`, icon: 'task_alt', color: 'text-[#5FAF32]' },
          { label: 'Operadores', value: operators.length, sub: `${users.length} usuarios en total`, icon: 'badge', color: 'text-[#143A73]' },
          { label: 'Rectificaciones', value: auditLogsCount, sub: 'Correcciones auditadas', icon: 'verified', color: 'text-amber-600' },
        ].map((k) => (
          <div key={k.label} className={`${card} p-4 flex flex-col justify-between`}>
            <div className="flex items-center justify-between text-gray-500">
              <span className="text-[10px] uppercase font-bold tracking-wider">{k.label}</span>
              <span className={`material-symbols-outlined text-[20px] ${k.color}`}>{k.icon}</span>
            </div>
            <div className="mt-2">
              <span className={`text-2xl sm:text-3xl font-black font-mono ${k.color}`}>{k.value}</span>
              <span className="text-[10px] text-gray-500 block mt-0.5">{k.sub}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 bg-white rounded-2xl border border-[#D6DEEA] shadow-xs p-1.5 sticky top-16 z-20">
        {ADMIN_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 h-9 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              tab === t.key ? 'bg-[#1B4E9B] text-white shadow-sm' : 'text-gray-600 hover:bg-[#F2F4F7]'
            }`}
          >
            <span className="material-symbols-outlined text-[17px]">{t.icon}</span>
            <span>{t.label}</span>
            {t.key === 'anulados' && annulled.length > 0 && (
              <span className={`text-[10px] px-1.5 rounded-full ${tab === t.key ? 'bg-white/20' : 'bg-red-100 text-red-700'}`}>{annulled.length}</span>
            )}
          </button>
        ))}
      </div>

      {tab === 'produccion' && (
        <>
        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-extrabold text-[#143A73] flex items-center gap-2">
            <span className="material-symbols-outlined text-[#1B4E9B]">factory</span>
            <span>Líneas de Producción</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {lines.map((line) => {
              const lotes = inProcess.filter((h) => lineUiId(h.linea_codigo) === line.id);
              return (
                <div key={line.id} className={`${card} p-5 flex flex-col gap-4`}>
                  <div className="flex flex-wrap items-start justify-between gap-2 border-b border-[#D6DEEA] pb-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-mono font-bold text-[#1B4E9B] bg-[#1B4E9B]/5 px-2 py-0.5 rounded border border-[#1B4E9B]/20 whitespace-nowrap">
                          {line.code}
                        </span>
                        <h3 className="text-base font-bold text-gray-900 min-w-0">{line.name}</h3>
                      </div>
                      <span className="text-[11px] text-gray-500 mt-1 block">
                        Capacidad: {line.capacityLiters.toLocaleString('es-CO')} L · {line.allowedProductIds.length} producto(s)
                      </span>
                    </div>
                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase border shrink-0 ${STATUS_CLASS[line.status]}`}>
                      {STATUS_LABEL[line.status]}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1">
                    {line.allowedProductIds.map((pId) => (
                      <span key={pId} className="px-2 py-0.5 bg-[#F2F4F7] border border-[#D6DEEA] rounded text-[10px] text-gray-700 font-medium">
                        {products.find((p) => p.id === pId)?.name || pId}
                      </span>
                    ))}
                  </div>

                  <div className="flex flex-col gap-2">
                    <span className="text-[10px] uppercase font-bold text-gray-500">Lotes en curso ({lotes.length})</span>
                    {lotes.length === 0 && <span className="text-xs text-gray-400">Sin lotes en proceso.</span>}
                    {lotes.map((h) => (
                      <button
                        key={h.id}
                        onClick={() => onOpenBatch(productUiIdFromCode(h.producto_codigo))}
                        className="text-left p-2.5 rounded-xl bg-[#1B4E9B]/5 border border-[#1B4E9B]/20 hover:bg-[#1B4E9B]/10 text-xs flex items-center justify-between gap-2 cursor-pointer"
                      >
                        <span>
                          <span className="font-mono font-bold text-[#1B4E9B]">{loteDeFila(h)}</span>
                          <span className="text-gray-600"> · {h.producto_nombre}</span>
                        </span>
                        <span className="text-[10px] text-gray-500">{h.responsable_nombre}</span>
                      </button>
                    ))}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#D6DEEA]">
                    <button
                      onClick={() => onOpenLine(line.id)}
                      className="flex-1 py-2 px-3 rounded-xl bg-[#1B4E9B] hover:bg-[#143A73] text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[16px]">play_arrow</span>
                      <span>Abrir Línea</span>
                    </button>
                    <button
                      onClick={() => onEditLine(line)}
                      className="py-2 px-3 rounded-xl bg-white border border-[#D6DEEA] hover:bg-[#F2F4F7] text-gray-700 text-xs font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[16px]">edit</span>
                      <span>Editar</span>
                    </button>
                    <button
                      onClick={() => onDeactivateLine(line)}
                      className="py-2 px-3 rounded-xl bg-white border border-red-200 hover:bg-red-50 text-red-700 text-xs font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[16px]">block</span>
                      <span>Desactivar</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className={`${card} p-5 flex flex-col gap-3`}>
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#D6DEEA] pb-3">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[#1B4E9B] text-[20px]">inventory_2</span>
              <h3 className="text-sm font-bold text-gray-900">
                Historial de Lotes ({visibleHistory.length}
                {hasColFilters ? ` de ${filteredHistory.length}` : ''})
              </h3>
            </div>
            <div className="flex gap-1">
              {(['todos', 'EN_PROCESO', 'COMPLETADO'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setHistoryFilter(f)}
                  className={`px-3 py-1 rounded-full text-[10px] font-bold border cursor-pointer ${
                    historyFilter === f ? 'bg-[#1B4E9B] text-white border-[#1B4E9B]' : 'bg-white text-gray-600 border-[#D6DEEA]'
                  }`}
                >
                  {f === 'todos' ? 'Todos' : f === 'EN_PROCESO' ? 'En proceso' : 'Completados'}
                </button>
              ))}
            </div>
          </div>
          <div className="lg:hidden flex flex-col gap-2">
            <div className="grid grid-cols-1 gap-2">
              <select
                className="w-full rounded-xl border border-[#D6DEEA] bg-white px-2 py-2 text-[11px] text-gray-700 outline-none focus:border-[#1B4E9B]"
                value={colFilters.lote ?? ''}
                onChange={(e) => setColFilter('lote', e.target.value)}
                aria-label="Filtrar por lote"
              >
                <option value="">Todos los lotes</option>
                {loteOptions.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
              <select
                className="w-full rounded-xl border border-[#D6DEEA] bg-white px-2 py-2 text-[11px] text-gray-700 outline-none focus:border-[#1B4E9B]"
                value={colFilters.producto ?? ''}
                onChange={(e) => setColFilter('producto', e.target.value)}
                aria-label="Filtrar por producto"
              >
                <option value="">Todos los productos</option>
                {productoOptions.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
              <select
                className="w-full rounded-xl border border-[#D6DEEA] bg-white px-2 py-2 text-[11px] text-gray-700 outline-none focus:border-[#1B4E9B]"
                value={colFilters.responsable ?? ''}
                onChange={(e) => setColFilter('responsable', e.target.value)}
                aria-label="Filtrar por responsable"
              >
                <option value="">Todos los responsables</option>
                {responsableOptions.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <select
                className="w-full rounded-xl border border-[#D6DEEA] bg-white px-2 py-2 text-[11px] text-gray-700 outline-none focus:border-[#1B4E9B]"
                value={colFilters.estado ?? ''}
                onChange={(e) => setColFilter('estado', e.target.value)}
                aria-label="Filtrar por estado"
              >
                <option value="">Todos</option>
                <option value="EN_PROCESO">En proceso</option>
                <option value="COMPLETADO">Completado</option>
              </select>
              <select
                className="w-full rounded-xl border border-[#D6DEEA] bg-white px-2 py-2 text-[11px] text-gray-700 outline-none focus:border-[#1B4E9B]"
                value={`${sortKey}:${sortDir}`}
                onChange={(e) => {
                  const [k, d] = e.target.value.split(':') as [HistorySortKey, 'asc' | 'desc'];
                  setSortKey(k);
                  setSortDir(d);
                }}
                aria-label="Ordenar historial"
              >
                <option value="iniciado_at:desc">Más recientes</option>
                <option value="iniciado_at:asc">Más antiguos</option>
                <option value="codigo_lote:asc">Lote (A-Z)</option>
                <option value="codigo_lote:desc">Lote (Z-A)</option>
                <option value="producto_nombre:asc">Producto (A-Z)</option>
                <option value="responsable_nombre:asc">Responsable (A-Z)</option>
                <option value="volumen:desc">Leche (mayor)</option>
                <option value="volumen:asc">Leche (menor)</option>
                <option value="duracion:desc">Duración (mayor)</option>
                <option value="duracion:asc">Duración (menor)</option>
                <option value="estado:asc">Estado</option>
              </select>
              <input
                className="w-full rounded-xl border border-[#D6DEEA] bg-white px-2 py-2 text-[11px] text-gray-700 outline-none focus:border-[#1B4E9B]"
                value={colFilters.leche ?? ''}
                onChange={(e) => setColFilter('leche', e.target.value)}
                placeholder="Leche (L)"
                inputMode="numeric"
                aria-label="Filtrar por litros de leche"
              />
              <input
                className="w-full rounded-xl border border-[#D6DEEA] bg-white px-2 py-2 text-[11px] text-gray-700 outline-none focus:border-[#1B4E9B]"
                value={colFilters.duracion ?? ''}
                onChange={(e) => setColFilter('duracion', e.target.value)}
                placeholder="Duración (ej. 1h)"
                aria-label="Filtrar por duración"
              />
              <label className="flex flex-col gap-0.5 text-[9px] font-bold uppercase text-gray-500">
                Inicio
                <input
                  type="date"
                  className="w-full rounded-xl border border-[#D6DEEA] bg-white px-2 py-1.5 text-[11px] font-normal normal-case text-gray-700 outline-none focus:border-[#1B4E9B]"
                  value={colFilters.inicio ?? ''}
                  onChange={(e) => setColFilter('inicio', e.target.value)}
                />
              </label>
              <label className="flex flex-col gap-0.5 text-[9px] font-bold uppercase text-gray-500">
                Fin
                <input
                  type="date"
                  className="w-full rounded-xl border border-[#D6DEEA] bg-white px-2 py-1.5 text-[11px] font-normal normal-case text-gray-700 outline-none focus:border-[#1B4E9B]"
                  value={colFilters.fin ?? ''}
                  onChange={(e) => setColFilter('fin', e.target.value)}
                />
              </label>
            </div>
            {hasColFilters && (
              <button
                type="button"
                onClick={clearColFilters}
                className="self-start text-[11px] font-bold text-[#1B4E9B] hover:underline cursor-pointer"
              >
                Limpiar filtros
              </button>
            )}
          </div>

          <div className="lg:hidden flex flex-col gap-2">
            {visibleHistory.length === 0 && (
              <p className="py-6 text-center text-xs text-gray-400">
                {loading
                  ? 'Cargando...'
                  : hasColFilters
                    ? 'Ningún lote coincide con los filtros aplicados.'
                    : 'Aún no hay lotes registrados.'}
              </p>
            )}
            {visibleHistory.map((h) => {
              const productUiId = productUiIdFromCode(h.producto_codigo);
              const isCheese = products.find((p) => p.id === productUiId)?.lineType === 'pasta_hilada';
              return (
                <div key={h.id} className="rounded-xl border border-[#D6DEEA] bg-white p-3 flex flex-col gap-2">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-mono font-bold text-[11px] text-[#1B4E9B] break-all">{loteDeFila(h)}</span>
                    <span
                      className={`shrink-0 px-2 py-0.5 rounded-full text-[9px] font-bold border ${
                        h.estado === 'COMPLETADO'
                          ? 'bg-[#5FAF32]/10 text-[#3F7F1E] border-[#5FAF32]/40'
                          : 'bg-[#1B4E9B]/10 text-[#1B4E9B] border-[#1B4E9B]/30'
                      }`}
                    >
                      {h.estado === 'COMPLETADO' ? 'Completado' : h.estado === 'EN_PROCESO' ? 'En proceso' : h.estado}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-gray-900 break-words">{h.producto_nombre}</p>
                    <p className="text-[10px] text-gray-500 break-words">{h.responsable_nombre}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px]">
                    <span className="text-gray-500">Leche</span>
                    <span className="text-right font-mono text-gray-800">
                      {Number(h.volumen_leche_base_litros || 0).toLocaleString('es-CO')} L
                    </span>
                    <span className="text-gray-500">Inicio</span>
                    <span className="text-right text-gray-800">{formatDate(h.iniciado_at)}</span>
                    <span className="text-gray-500">Fin</span>
                    <span className="text-right text-gray-800">{formatDate(h.finalizado_at)}</span>
                    <span className="text-gray-500">Duración</span>
                    <span className="text-right font-mono text-gray-800">{formatDuration(h.duracion_total_segundos)}</span>
                  </div>
                  {h.rectificaciones > 0 && (
                    <span className="text-[10px] text-amber-700 font-bold">{h.rectificaciones} rectificación(es)</span>
                  )}
                  <div className="flex flex-wrap gap-2 pt-1 border-t border-[#F2F4F7]">
                    {h.estado === 'EN_PROCESO' && (
                      <>
                        <button
                          onClick={() => onOpenBatch(productUiId)}
                          className="flex-1 min-w-[72px] py-1.5 rounded-lg bg-[#1B4E9B] text-white text-[11px] font-bold cursor-pointer"
                        >
                          Ver
                        </button>
                        {isCheese && (
                          <button
                            onClick={() => onCorrectBatch(productUiId)}
                            className="flex-1 min-w-[72px] py-1.5 rounded-lg bg-red-600 text-white text-[11px] font-bold cursor-pointer"
                          >
                            Corregir
                          </button>
                        )}
                        <button
                          onClick={() => { setAnnulTarget(h); setAnnulText(''); setAnnulError(''); }}
                          className="flex-1 min-w-[72px] py-1.5 rounded-lg bg-white border border-[#D6DEEA] text-gray-700 text-[11px] font-bold cursor-pointer"
                        >
                          Anular
                        </button>
                      </>
                    )}
                    {h.estado === 'COMPLETADO' && (
                      <>
                        <button
                          onClick={() => onViewBatchDetail(h)}
                          className="flex-1 min-w-[72px] py-1.5 rounded-lg bg-[#1B4E9B] text-white text-[11px] font-bold cursor-pointer"
                        >
                          Ver
                        </button>
                        <button
                          onClick={() => onCorrectBatchDetail(h)}
                          className="flex-1 min-w-[72px] py-1.5 rounded-lg bg-red-600 text-white text-[11px] font-bold cursor-pointer"
                        >
                          Corregir
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full min-w-[860px] text-xs">
              <thead>
                <tr className="text-left text-[10px] uppercase text-gray-500 border-b border-[#D6DEEA]">
                  <th className="py-2 pr-3">{sortHeader('Lote', 'codigo_lote')}</th>
                  <th className="py-2 pr-3">{sortHeader('Producto', 'producto_nombre')}</th>
                  <th className="py-2 pr-3">{sortHeader('Responsable', 'responsable_nombre')}</th>
                  <th className="py-2 pr-3">{sortHeader('Leche (L)', 'volumen', 'right')}</th>
                  <th className="py-2 pr-3">{sortHeader('Inicio', 'iniciado_at')}</th>
                  <th className="py-2 pr-3">{sortHeader('Fin', 'finalizado_at')}</th>
                  <th className="py-2 pr-3">{sortHeader('Duración', 'duracion')}</th>
                  <th className="py-2 pr-3">{sortHeader('Estado', 'estado')}</th>
                  <th className="py-2"></th>
                </tr>
                <tr className="align-top border-b border-[#D6DEEA]">
                  <th className="pb-2 pr-3 font-normal">
                    <select
                      className={filterInput}
                      value={colFilters.lote ?? ''}
                      onChange={(e) => setColFilter('lote', e.target.value)}
                      aria-label="Filtrar por lote"
                    >
                      <option value="">Todos</option>
                      {loteOptions.map((v) => (
                        <option key={v} value={v}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </th>
                  <th className="pb-2 pr-3 font-normal">
                    <select
                      className={filterInput}
                      value={colFilters.producto ?? ''}
                      onChange={(e) => setColFilter('producto', e.target.value)}
                      aria-label="Filtrar por producto"
                    >
                      <option value="">Todos</option>
                      {productoOptions.map((v) => (
                        <option key={v} value={v}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </th>
                  <th className="pb-2 pr-3 font-normal">
                    <select
                      className={filterInput}
                      value={colFilters.responsable ?? ''}
                      onChange={(e) => setColFilter('responsable', e.target.value)}
                      aria-label="Filtrar por responsable"
                    >
                      <option value="">Todos</option>
                      {responsableOptions.map((v) => (
                        <option key={v} value={v}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </th>
                  <th className="pb-2 pr-3 font-normal">
                    <input
                      className={`${filterInput} text-right`}
                      value={colFilters.leche ?? ''}
                      onChange={(e) => setColFilter('leche', e.target.value)}
                      placeholder="L"
                      inputMode="numeric"
                      aria-label="Filtrar por litros de leche"
                    />
                  </th>
                  <th className="pb-2 pr-3 font-normal">
                    <input
                      type="date"
                      className={filterInput}
                      value={colFilters.inicio ?? ''}
                      onChange={(e) => setColFilter('inicio', e.target.value)}
                      aria-label="Filtrar por fecha de inicio"
                    />
                  </th>
                  <th className="pb-2 pr-3 font-normal">
                    <input
                      type="date"
                      className={filterInput}
                      value={colFilters.fin ?? ''}
                      onChange={(e) => setColFilter('fin', e.target.value)}
                      aria-label="Filtrar por fecha de fin"
                    />
                  </th>
                  <th className="pb-2 pr-3 font-normal">
                    <input
                      className={filterInput}
                      value={colFilters.duracion ?? ''}
                      onChange={(e) => setColFilter('duracion', e.target.value)}
                      placeholder="Ej. 1h"
                      aria-label="Filtrar por duración"
                    />
                  </th>
                  <th className="pb-2 pr-3 font-normal">
                    <select
                      className={filterInput}
                      value={colFilters.estado ?? ''}
                      onChange={(e) => setColFilter('estado', e.target.value)}
                      aria-label="Filtrar por estado"
                    >
                      <option value="">Todos</option>
                      <option value="EN_PROCESO">En proceso</option>
                      <option value="COMPLETADO">Completado</option>
                    </select>
                  </th>
                  <th className="pb-2 text-right font-normal">
                    {hasColFilters && (
                      <button
                        type="button"
                        onClick={clearColFilters}
                        className="text-[10px] font-bold text-[#1B4E9B] hover:underline cursor-pointer whitespace-nowrap"
                      >
                        Limpiar
                      </button>
                    )}
                  </th>
                </tr>
              </thead>
              <tbody>
                {visibleHistory.length === 0 && (
                  <tr>
                    <td colSpan={9} className="py-6 text-center text-gray-400">
                      {loading
                        ? 'Cargando...'
                        : hasColFilters
                          ? 'Ningún lote coincide con los filtros aplicados.'
                          : 'Aún no hay lotes registrados.'}
                    </td>
                  </tr>
                )}
                {visibleHistory.map((h) => {
                  const productUiId = productUiIdFromCode(h.producto_codigo);
                  const isCheese = products.find((p) => p.id === productUiId)?.lineType === 'pasta_hilada';
                  return (
                    <tr key={h.id} className="border-b border-[#F2F4F7] hover:bg-[#F2F4F7]/60">
                      <td className="py-2 pr-3 font-mono font-bold text-[#1B4E9B] whitespace-nowrap">{loteDeFila(h)}</td>
                      <td className="py-2 pr-3">{h.producto_nombre}</td>
                      <td className="py-2 pr-3">{h.responsable_nombre}</td>
                      <td className="py-2 pr-3 text-right font-mono">{Number(h.volumen_leche_base_litros || 0).toLocaleString('es-CO')}</td>
                      <td className="py-2 pr-3 whitespace-nowrap">{formatDate(h.iniciado_at)}</td>
                      <td className="py-2 pr-3 whitespace-nowrap">{formatDate(h.finalizado_at)}</td>
                      <td className="py-2 pr-3 font-mono">{formatDuration(h.duracion_total_segundos)}</td>
                      <td className="py-2 pr-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            h.estado === 'COMPLETADO'
                              ? 'bg-[#5FAF32]/10 text-[#3F7F1E] border-[#5FAF32]/40'
                              : 'bg-[#1B4E9B]/10 text-[#1B4E9B] border-[#1B4E9B]/30'
                          }`}
                        >
                          {h.estado === 'COMPLETADO' ? 'Completado' : h.estado === 'EN_PROCESO' ? 'En proceso' : h.estado}
                        </span>
                        {h.rectificaciones > 0 && (
                          <span className="ml-1 text-[10px] text-amber-700 font-bold">({h.rectificaciones} rect.)</span>
                        )}
                      </td>
                      <td className="py-2 text-right whitespace-nowrap">
                        {h.estado === 'EN_PROCESO' && (
                          <>
                            <button onClick={() => onOpenBatch(productUiId)} className="text-[#1B4E9B] font-bold hover:underline cursor-pointer mr-2">
                              Ver
                            </button>
                            {isCheese && (
                              <button onClick={() => onCorrectBatch(productUiId)} className="text-red-700 font-bold hover:underline cursor-pointer mr-2">
                                Corregir
                              </button>
                            )}
                            <button onClick={() => { setAnnulTarget(h); setAnnulText(''); setAnnulError(''); }} className="text-gray-600 font-bold hover:underline cursor-pointer">
                              Anular
                            </button>
                          </>
                        )}
                        {h.estado === 'COMPLETADO' && (
                          <>
                            <button onClick={() => onViewBatchDetail(h)} className="text-[#1B4E9B] font-bold hover:underline cursor-pointer mr-2">
                              Ver
                            </button>
                            <button onClick={() => onCorrectBatchDetail(h)} className="text-red-700 font-bold hover:underline cursor-pointer">
                              Corregir
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        </>
      )}

      {tab === 'usuarios' && (
        <>
        <div className={`${card} p-5 flex flex-col gap-3`}>
          <div className="flex items-center justify-between border-b border-[#D6DEEA] pb-3">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[#5FAF32] text-[20px]">group</span>
              <h3 className="text-sm font-bold text-gray-900">Usuarios del Sistema ({users.length})</h3>
            </div>
            <button onClick={onCreateUser} className="text-xs text-[#1B4E9B] font-bold hover:underline cursor-pointer">
              + Agregar operador
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {users.map((u) => {
              const isSelf = u.id === currentUser.id;
              const canManage = !isSelf && u.role === 'operador';
              return (
                <div key={u.id} className="p-3 rounded-xl bg-[#F2F4F7] border border-[#D6DEEA] flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                        u.role === 'administrador' ? 'bg-[#1B4E9B] text-white' : 'bg-[#5FAF32]/15 text-[#3F7F1E]'
                      }`}
                    >
                      {u.name.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-gray-900 truncate">
                        {u.name} {isSelf && <span className="text-[10px] text-gray-500">(tú)</span>}
                      </div>
                      <div className="text-[10px] text-gray-500 truncate">
                        {u.code} · {u.role === 'administrador' ? 'Administrador' : 'Operador'} · {u.shift} · {lineName(u.assignedLineId)}
                      </div>
                    </div>
                  </div>
                  {canManage && (
                    <div className="flex gap-1 shrink-0">
                      <button
                        onClick={() => onEditUser(u)}
                        title="Editar / restablecer PIN"
                        className="w-8 h-8 rounded-lg bg-white border border-[#D6DEEA] hover:bg-[#1B4E9B]/5 text-[#1B4E9B] flex items-center justify-center cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[16px]">edit</span>
                      </button>
                      <button
                        onClick={() => onDeactivateUser(u)}
                        title="Dar de baja"
                        className="w-8 h-8 rounded-lg bg-white border border-red-200 hover:bg-red-50 text-red-700 flex items-center justify-center cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[16px]">person_remove</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {(inactiveUsers.length > 0 || inactiveLines.length > 0 || inactiveError) && (
          <div className={`${card} p-5 flex flex-col gap-3`}>
            <div className="flex items-center gap-2 border-b border-[#D6DEEA] pb-3">
              <span className="material-symbols-outlined text-gray-500 text-[20px]">restore</span>
              <h3 className="text-sm font-bold text-gray-900">Dados de baja</h3>
            </div>
            {inactiveError && <div className="text-xs font-bold text-red-700">{inactiveError}</div>}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {inactiveUsers.map((u) => (
                <div key={u.id} className="p-3 rounded-xl bg-[#F2F4F7] border border-[#D6DEEA] flex items-center justify-between gap-2 text-xs">
                  <div className="min-w-0">
                    <div className="font-bold text-gray-700 truncate">{u.name}</div>
                    <div className="text-[10px] text-gray-500 truncate">
                      {u.code} · {u.role === 'administrador' ? 'Administrador' : 'Operador'}
                    </div>
                  </div>
                  <button
                    onClick={() => reactivate('user', u.id)}
                    className="px-3 h-8 rounded-lg bg-white border border-[#5FAF32]/60 text-[#3F7F1E] font-bold hover:bg-[#5FAF32]/10 cursor-pointer shrink-0"
                  >
                    Reactivar
                  </button>
                </div>
              ))}
              {inactiveLines.map((l) => (
                <div key={l.id} className="p-3 rounded-xl bg-[#F2F4F7] border border-[#D6DEEA] flex items-center justify-between gap-2 text-xs">
                  <div className="min-w-0">
                    <div className="font-bold text-gray-700 truncate">{l.nombre}</div>
                    <div className="text-[10px] text-gray-500 truncate">Línea · {l.codigo}</div>
                  </div>
                  <button
                    onClick={() => reactivate('line', l.codigo)}
                    className="px-3 h-8 rounded-lg bg-white border border-[#5FAF32]/60 text-[#3F7F1E] font-bold hover:bg-[#5FAF32]/10 cursor-pointer shrink-0"
                  >
                    Reactivar
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
        </>
      )}

      {tab === 'anulados' && annulled.length > 0 && (
        <div className={`${card} p-5 flex flex-col gap-3`}>
          <div className="flex items-center gap-2 border-b border-[#D6DEEA] pb-3">
            <span className="material-symbols-outlined text-red-700 text-[20px]">block</span>
            <h3 className="text-sm font-bold text-gray-900">Lotes Anulados ({annulled.length})</h3>
            <span className="text-[10px] text-gray-500">Registro permanente, no se puede eliminar</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-xs">
              <thead>
                <tr className="text-left text-[10px] uppercase text-gray-500 border-b border-[#D6DEEA]">
                  <th className="py-2 pr-3">Lote</th>
                  <th className="py-2 pr-3">Producto</th>
                  <th className="py-2 pr-3">Responsable</th>
                  <th className="py-2 pr-3">Anulado por</th>
                  <th className="py-2 pr-3">Fecha</th>
                  <th className="py-2">Motivo</th>
                </tr>
              </thead>
              <tbody>
                {annulled.map((h) => (
                  <tr key={h.id} className="border-b border-[#F2F4F7] align-top">
                    <td className="py-2 pr-3 font-mono font-bold text-gray-700 whitespace-nowrap">{loteDeFila(h)}</td>
                    <td className="py-2 pr-3">{h.producto_nombre}</td>
                    <td className="py-2 pr-3">{h.responsable_nombre}</td>
                    <td className="py-2 pr-3">{h.anulado_por ?? '—'}</td>
                    <td className="py-2 pr-3 whitespace-nowrap">{formatDate(h.anulado_at ?? null)}</td>
                    <td className="py-2 text-gray-700">{h.anulacion_justificacion ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {tab === 'anulados' && annulled.length === 0 && (
        <div className={`${card} p-8 text-center text-xs text-gray-500`}>No hay lotes anulados.</div>
      )}

      {tab === 'insumos' && <InsumosManager />}

      {tab === 'exportar' && <ExportCenter lines={lines} products={products} users={users} />}

      {annulTarget && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-5 flex flex-col gap-3">
            <h3 className="text-base font-bold text-gray-900">Anular lote {loteDeFila(annulTarget)}</h3>
            <p className="text-xs text-gray-600">
              El proceso se cancela, sale del historial activo y queda registrado de forma permanente con su motivo.
            </p>
            <textarea
              rows={4}
              value={annulText}
              onChange={(e) => { setAnnulText(e.target.value); setAnnulError(''); }}
              placeholder="Motivo de la anulación (mínimo 15 caracteres)"
              className="w-full p-3 rounded-xl border border-[#D6DEEA] text-xs outline-none focus:border-red-600"
            />
            {annulError && <div className="text-xs font-bold text-red-700">{annulError}</div>}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setAnnulTarget(null)}
                className="px-4 py-2 rounded-xl border border-gray-300 text-xs font-bold text-gray-700 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={submitAnnul}
                disabled={annulSaving}
                className="px-4 py-2 rounded-xl bg-red-700 hover:bg-red-800 text-white text-xs font-bold cursor-pointer disabled:opacity-60"
              >
                {annulSaving ? 'Anulando...' : 'Confirmar anulación'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
