import React, { useState } from 'react';
import { ProductDefinition, ProductionLine, UserProfile } from '../../types';
import { BatchHistoryRow, lineUiId, productUiIdFromCode } from '../../api/client';

interface AdminGlobalDashboardProps {
  lines: ProductionLine[];
  products: ProductDefinition[];
  users: UserProfile[];
  currentUser: UserProfile;
  auditLogsCount: number;
  history: BatchHistoryRow[];
  loading: boolean;
  onRefresh: () => void;
  onCreateLine: () => void;
  onEditLine: (line: ProductionLine) => void;
  onDeactivateLine: (line: ProductionLine) => void;
  onCreateUser: () => void;
  onEditUser: (user: UserProfile) => void;
  onDeactivateUser: (user: UserProfile) => void;
  onOpenAuditTrail: () => void;
  onOpenLine: (lineId: string) => void;
  onOpenBatch: (productUiId: string) => void;
  onCorrectBatch: (productUiId: string) => void;
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

export const AdminGlobalDashboard: React.FC<AdminGlobalDashboardProps> = ({
  lines,
  products,
  users,
  currentUser,
  auditLogsCount,
  history,
  loading,
  onRefresh,
  onCreateLine,
  onEditLine,
  onDeactivateLine,
  onCreateUser,
  onEditUser,
  onDeactivateUser,
  onOpenAuditTrail,
  onOpenLine,
  onOpenBatch,
  onCorrectBatch,
}) => {
  const [historyFilter, setHistoryFilter] = useState<'todos' | 'EN_PROCESO' | 'COMPLETADO'>('todos');
  const inProcess = history.filter((h) => h.estado === 'EN_PROCESO');
  const completedToday = history.filter((h) => h.estado === 'COMPLETADO' && isToday(h.finalizado_at));
  const litersToday = completedToday.reduce((acc, h) => acc + (Number(h.volumen_leche_base_litros) || 0), 0);
  const operators = users.filter((u) => u.role === 'operador');
  const filteredHistory = historyFilter === 'todos' ? history : history.filter((h) => h.estado === historyFilter);
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
            onClick={onCreateLine}
            className="px-4 py-2.5 rounded-xl bg-white text-[#1B4E9B] hover:bg-[#F2F4F7] font-bold text-xs flex items-center gap-1.5 shadow-xs transition-all cursor-pointer active:scale-95"
          >
            <span className="material-symbols-outlined text-[18px]">add_box</span>
            <span>Nueva Línea</span>
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
                <div className="flex items-start justify-between gap-2 border-b border-[#D6DEEA] pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-[#1B4E9B] bg-[#1B4E9B]/5 px-2 py-0.5 rounded border border-[#1B4E9B]/20">
                        {line.code}
                      </span>
                      <h3 className="text-base font-bold text-gray-900">{line.name}</h3>
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
                        <span className="font-mono font-bold text-[#1B4E9B]">{h.codigo_lote}</span>
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
            <h3 className="text-sm font-bold text-gray-900">Historial de Lotes ({filteredHistory.length})</h3>
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
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-[10px] uppercase text-gray-500 border-b border-[#D6DEEA]">
                <th className="py-2 pr-3">Lote</th>
                <th className="py-2 pr-3">Producto</th>
                <th className="py-2 pr-3">Responsable</th>
                <th className="py-2 pr-3 text-right">Leche (L)</th>
                <th className="py-2 pr-3">Inicio</th>
                <th className="py-2 pr-3">Fin</th>
                <th className="py-2 pr-3">Duración</th>
                <th className="py-2 pr-3">Estado</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {filteredHistory.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-6 text-center text-gray-400">
                    {loading ? 'Cargando...' : 'Aún no hay lotes registrados.'}
                  </td>
                </tr>
              )}
              {filteredHistory.map((h) => {
                const productUiId = productUiIdFromCode(h.producto_codigo);
                const isCheese = products.find((p) => p.id === productUiId)?.lineType === 'pasta_hilada';
                return (
                  <tr key={h.id} className="border-b border-[#F2F4F7] hover:bg-[#F2F4F7]/60">
                    <td className="py-2 pr-3 font-mono font-bold text-[#1B4E9B] whitespace-nowrap">{h.codigo_lote}</td>
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
                            <button onClick={() => onCorrectBatch(productUiId)} className="text-red-700 font-bold hover:underline cursor-pointer">
                              Corregir
                            </button>
                          )}
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
    </div>
  );
};
