import React from 'react';
import { ProductionLine, ProductDefinition, UserProfile } from '../../types';
import { OpenDraftRow } from '../../api/client';

interface OperatorLineSelectorProps {
  lines: ProductionLine[];
  products?: ProductDefinition[];
  currentUser: UserProfile;
  activeBatchId?: string | null;
  activeBatchStatus?: string;
  openDrafts?: OpenDraftRow[];
  onSelectLine: (lineId: string) => void;
  onContinueProduct?: (productId: string) => void;
  onContinueCurrentBatch: () => void;
  onViewBatchSummary?: () => void;
}

export const OperatorLineSelector: React.FC<OperatorLineSelectorProps> = ({
  lines,
  products = [],
  currentUser,
  activeBatchId,
  activeBatchStatus,
  openDrafts = [],
  onSelectLine,
  onContinueProduct,
  onContinueCurrentBatch,
  onViewBatchSummary,
}) => {
  const nombreProducto = (productId: string) =>
    products.find((p) => p.id === productId)?.name || productId;

  const formatearMomento = (iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '--';
    return d.toLocaleString('es-CO', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getLineTypeIcon = (type: ProductionLine['lineType']) => {
    switch (type) {
      case 'pasta_hilada':
        return 'lunch_dining';
      case 'fermentacion':
        return 'biotech';
      case 'dulces':
        return 'cookie';
      default:
        return 'factory';
    }
  };

  const getLineTypeBadge = (type: ProductionLine['lineType']) => {
    switch (type) {
      case 'pasta_hilada':
        return {
          label: 'LÍNEA DE PASTA HILADA',
          color: 'bg-amber-100 text-amber-900 border-amber-300',
        };
      case 'fermentacion':
        return {
          label: 'LÍNEA DE FERMENTACIÓN',
          color: 'bg-purple-100 text-purple-900 border-purple-300',
        };
      case 'dulces':
        return {
          label: 'LÍNEA DE DULCES',
          color: 'bg-rose-100 text-rose-900 border-rose-300',
        };
      default:
        return {
          label: 'PROCESO INDUSTRIAL',
          color: 'bg-blue-100 text-blue-900 border-blue-300',
        };
    }
  };

  const totalLineas = lines.length;
  const anchoContenedor = totalLineas >= 3 ? 'max-w-6xl' : 'max-w-4xl';
  const columnasGrilla =
    totalLineas >= 3 ? 'sm:grid-cols-2 xl:grid-cols-3' : 'sm:grid-cols-2';

  return (
    <div
      className={`flex flex-col w-full ${anchoContenedor} mx-auto px-3 sm:px-4 lg:px-8 py-4 lg:py-8 gap-5 sm:gap-6 bg-[#FFFFFF] min-h-[calc(100vh-4rem)] pb-16`}
    >
      {/* Header Banner */}
      <div className="bg-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl shadow-xs border border-[#D6DEEA] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="text-[10px] sm:text-xs font-semibold text-[#1B4E9B] uppercase tracking-wider flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
            <span className="truncate">Terminal Operativa // Piso de Producción</span>
          </div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-black text-[#191c1e] mt-1 leading-tight">
            Selección de Líneas de Producción
          </h1>
          <p className="text-[11px] sm:text-sm text-[#434655] mt-1 leading-snug">
            Operario conectado: <strong className="text-gray-900">{currentUser.name}</strong> ({currentUser.code}) · Turno: <strong>{currentUser.shift}</strong>
          </p>
        </div>

        {activeBatchId && activeBatchStatus === 'COMPLETADO' && (
          <button
            onClick={onViewBatchSummary || onContinueCurrentBatch}
            className="w-full md:w-auto px-4 sm:px-5 py-3 rounded-2xl bg-slate-700 hover:bg-slate-800 text-white font-bold text-[11px] sm:text-sm flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer shrink-0 active:scale-95"
          >
            <span className="material-symbols-outlined text-[20px]">visibility</span>
            <span className="truncate">Ver Resumen ({activeBatchId} · Cerrado)</span>
          </button>
        )}
      </div>

      {/* Grid de líneas: se centra y ajusta según cuántas líneas haya */}
      <div className={`grid grid-cols-1 ${columnasGrilla} gap-4 sm:gap-5 justify-center items-stretch`}>
        {lines.map((line) => {
          const isOperational = line.status === 'disponible' || line.status === 'en_produccion';
          const isCurrentBatch = line.activeBatchId === activeBatchId;
          const draftsDeLinea = openDrafts.filter(
            (d) => d.vigente && line.allowedProductIds.includes(d.producto_ui_id)
          );
          const badge = getLineTypeBadge(line.lineType);
          const icon = getLineTypeIcon(line.lineType);

          return (
            <div
              key={line.id}
              className={`w-full max-w-md mx-auto sm:max-w-none p-4 sm:p-6 rounded-2xl sm:rounded-3xl border transition-all flex flex-col justify-between gap-4 sm:gap-5 shadow-xs ${
                isCurrentBatch
                  ? 'bg-amber-50/40 border-amber-400 ring-2 ring-amber-200'
                  : line.status === 'en_produccion'
                  ? 'bg-blue-50/40 border-[#1B4E9B]'
                  : 'bg-white border-[#D6DEEA] hover:border-[#1B4E9B] hover:shadow-md'
              }`}
            >
              <div>
                {/* Line Type Tag & Icon */}
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <span
                    className={`text-[9px] font-black px-2.5 py-0.5 rounded-full uppercase border ${badge.color}`}
                  >
                    {badge.label}
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase border whitespace-nowrap ${
                      line.status === 'en_produccion'
                        ? 'bg-blue-100 text-[#1B4E9B] border-blue-300'
                        : line.status === 'disponible'
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                        : 'bg-gray-100 text-gray-700 border-gray-300'
                    }`}
                  >
                    {line.status === 'en_produccion' ? '● En Producción' : '✓ Disponible'}
                  </span>
                </div>

                <div className="flex items-start gap-3">
                  <div
                    className={`w-11 h-11 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center shrink-0 border ${
                      line.lineType === 'pasta_hilada'
                        ? 'bg-amber-100 text-amber-900 border-amber-300'
                        : line.lineType === 'fermentacion'
                        ? 'bg-purple-100 text-purple-900 border-purple-300'
                        : 'bg-rose-100 text-rose-900 border-rose-300'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[24px] sm:text-[26px]">{icon}</span>
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm sm:text-base font-black text-[#191c1e] leading-snug">
                      {line.name}
                    </h3>
                    <span className="text-[10px] font-mono text-gray-500 font-bold block mt-0.5 break-words">
                      Código: {line.code} · Capacidad: {line.capacityLiters} L
                    </span>
                  </div>
                </div>

                {/* Sub-description of products inside */}
                <div className="mt-4 p-3 rounded-2xl bg-[#FFFFFF] border border-[#D6DEEA] text-xs flex flex-col gap-1.5">
                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                    Productos de esta línea:
                  </span>
                  {line.lineType === 'pasta_hilada' && (
                    <div className="flex flex-col gap-1 text-[11px]">
                      <div className="flex items-start gap-1 font-bold text-amber-950">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-600 mt-1.5 shrink-0"></span>
                        <span className="min-w-0">Queso Doble Crema Premium (Tradicional) — Principal</span>
                      </div>
                      <div className="flex items-start gap-1 text-gray-700">
                        <span className="w-1.5 h-1.5 rounded-full bg-gray-400 mt-1.5 shrink-0"></span>
                        <span className="min-w-0">Queso Doble Crema Industrial</span>
                      </div>
                      <div className="flex items-start gap-1 text-gray-700">
                        <span className="w-1.5 h-1.5 rounded-full bg-gray-400 mt-1.5 shrink-0"></span>
                        <span className="min-w-0">Queso Pera</span>
                      </div>
                      <div className="flex items-start gap-1 text-gray-700">
                        <span className="w-1.5 h-1.5 rounded-full bg-teal-600 mt-1.5 shrink-0"></span>
                        <span className="min-w-0">Queso 7 Cueros</span>
                      </div>
                    </div>
                  )}

                  {line.lineType === 'fermentacion' && (
                    <div className="flex flex-col gap-1 text-[11px] text-gray-700">
                      <div className="flex items-start gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-purple-500 mt-1.5 shrink-0"></span>
                        <span className="min-w-0">Yogur Entero Probiótico</span>
                      </div>
                      <div className="flex items-start gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-purple-500 mt-1.5 shrink-0"></span>
                        <span className="min-w-0">Kumis Tradicional Fermentado</span>
                      </div>
                      <div className="flex items-start gap-1 font-bold text-cyan-950">
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-600 mt-1.5 shrink-0"></span>
                        <span className="min-w-0">Yogur Griego</span>
                      </div>
                    </div>
                  )}

                  {line.lineType === 'dulces' && (
                    <div className="flex flex-col gap-1 text-[11px] text-gray-700">
                      <div className="flex items-start gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mt-1.5 shrink-0"></span>
                        <span className="min-w-0">Manjar Blanco / Arequipe de Olla</span>
                      </div>
                      <div className="flex items-start gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mt-1.5 shrink-0"></span>
                        <span className="min-w-0">Panelitas de Leche y Azúcar</span>
                      </div>
                      <div className="flex items-start gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mt-1.5 shrink-0"></span>
                        <span className="min-w-0">Dulce de Leche Cortada</span>
                      </div>
                    </div>
                  )}
                </div>

                {draftsDeLinea.length > 0 && (
                  <div className="mt-3 flex flex-col gap-2">
                    {draftsDeLinea.map((d) => (
                      <div
                        key={d.producto_ui_id}
                        className="p-2.5 rounded-xl border border-[#1B4E9B]/30 bg-blue-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <span className="text-[9px] font-black uppercase tracking-wider text-[#1B4E9B] block">
                            Lote en proceso
                          </span>
                          <span className="text-[11px] font-bold text-[#191c1e] block truncate">
                            {nombreProducto(d.producto_ui_id)}
                          </span>
                          <span className="text-[10px] font-mono text-gray-600 block truncate">
                            {d.codigo_lote || 'Sin código'} · {d.etapa_actual}
                            {d.operador ? ` · ${d.operador}` : ''}
                          </span>
                          <span className="text-[9px] text-gray-500 block truncate">
                            Último guardado: {formatearMomento(d.updated_at)}
                          </span>
                        </div>
                        <button
                          onClick={() => onContinueProduct?.(d.producto_ui_id)}
                          className="w-full sm:w-auto px-3 py-2 rounded-xl bg-[#1B4E9B] hover:bg-[#143A73] text-white text-[11px] font-bold flex items-center justify-center gap-1 shrink-0 cursor-pointer active:scale-95 transition-all"
                        >
                          <span className="material-symbols-outlined text-[15px]">play_circle</span>
                          <span>Continuar</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {isCurrentBatch && (
                  <div
                    className={`mt-3 p-2.5 rounded-xl border text-xs flex flex-wrap items-center justify-between gap-1 font-bold ${
                      activeBatchStatus === 'COMPLETADO'
                        ? 'bg-slate-100 text-slate-700 border-slate-300'
                        : 'bg-blue-100/60 border-blue-200 text-[#1B4E9B]'
                    }`}
                  >
                    <span className="min-w-0 break-all">Lote: {activeBatchId}</span>
                    <span className="text-[10px] uppercase font-mono whitespace-nowrap">
                      {activeBatchStatus === 'COMPLETADO' ? '✓ Cerrado' : 'En curso'}
                    </span>
                  </div>
                )}
              </div>

              {/* Action Button: Opens the list of products for this line */}
              <div className="pt-2">
                <button
                  onClick={() => onSelectLine(line.id)}
                  className="w-full px-3 py-3 sm:py-3.5 rounded-2xl bg-[#1B4E9B] hover:bg-[#143A73] text-white font-bold text-[11px] sm:text-sm flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer active:scale-95 text-center leading-tight"
                >
                  <span className="material-symbols-outlined text-[18px] shrink-0">format_list_bulleted</span>
                  <span className="min-w-0">Ver Productos de {line.name}</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
