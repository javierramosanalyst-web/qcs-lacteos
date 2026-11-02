import React from 'react';
import { ProductionLine, UserProfile } from '../../types';

interface OperatorLineSelectorProps {
  lines: ProductionLine[];
  currentUser: UserProfile;
  activeBatchId?: string | null;
  activeBatchStatus?: string;
  onSelectLine: (lineId: string) => void;
  onContinueCurrentBatch: () => void;
  onViewBatchSummary?: () => void;
}

export const OperatorLineSelector: React.FC<OperatorLineSelectorProps> = ({
  lines,
  currentUser,
  activeBatchId,
  activeBatchStatus,
  onSelectLine,
  onContinueCurrentBatch,
  onViewBatchSummary,
}) => {
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

  return (
    <div className="flex flex-col w-full p-4 lg:p-8 gap-6 bg-[#FFFFFF] min-h-[calc(100vh-4rem)] pb-16 max-w-6xl mx-auto">
      {/* Header Banner */}
      <div className="bg-white p-6 rounded-3xl shadow-xs border border-[#D6DEEA] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="text-xs font-semibold text-[#1B4E9B] uppercase tracking-wider flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Terminal Operativa // Piso de Producción
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#191c1e] mt-1">
            Selección de Líneas de Producción
          </h1>
          <p className="text-xs sm:text-sm text-[#434655] mt-1">
            Operario conectado: <strong className="text-gray-900">{currentUser.name}</strong> ({currentUser.code}) · Turno: <strong>{currentUser.shift}</strong>
          </p>
        </div>

        {activeBatchId && (
          activeBatchStatus === 'COMPLETADO' ? (
            <button
              onClick={onViewBatchSummary || onContinueCurrentBatch}
              className="px-5 py-3 rounded-2xl bg-slate-700 hover:bg-slate-800 text-white font-bold text-xs sm:text-sm flex items-center gap-2 shadow-sm transition-all cursor-pointer shrink-0 active:scale-95"
            >
              <span className="material-symbols-outlined text-[20px]">visibility</span>
              <span>Ver Resumen ({activeBatchId} · Cerrado)</span>
            </button>
          ) : (
            <button
              onClick={onContinueCurrentBatch}
              className="px-5 py-3 rounded-2xl bg-[#1B4E9B] hover:bg-[#143A73] text-white font-bold text-xs sm:text-sm flex items-center gap-2 shadow-sm transition-all cursor-pointer shrink-0 active:scale-95"
            >
              <span className="material-symbols-outlined text-[20px]">play_circle</span>
              <span>Continuar Lote Activo ({activeBatchId})</span>
            </button>
          )
        )}
      </div>

      {/* Grid of the 3 Line Types */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {lines.map((line) => {
          const isOperational = line.status === 'disponible' || line.status === 'en_produccion';
          const isCurrentBatch = line.activeBatchId === activeBatchId;
          const badge = getLineTypeBadge(line.lineType);
          const icon = getLineTypeIcon(line.lineType);

          return (
            <div
              key={line.id}
              className={`p-6 rounded-3xl border transition-all flex flex-col justify-between gap-5 shadow-xs ${
                isCurrentBatch
                  ? 'bg-amber-50/40 border-amber-400 ring-2 ring-amber-200'
                  : line.status === 'en_produccion'
                  ? 'bg-blue-50/40 border-[#1B4E9B]'
                  : 'bg-white border-[#D6DEEA] hover:border-[#1B4E9B] hover:shadow-md'
              }`}
            >
              <div>
                {/* Line Type Tag & Icon */}
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span
                    className={`text-[9px] font-black px-2.5 py-0.5 rounded-full uppercase border ${badge.color}`}
                  >
                    {badge.label}
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase border ${
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
                    className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border ${
                      line.lineType === 'pasta_hilada'
                        ? 'bg-amber-100 text-amber-900 border-amber-300'
                        : line.lineType === 'fermentacion'
                        ? 'bg-purple-100 text-purple-900 border-purple-300'
                        : 'bg-rose-100 text-rose-900 border-rose-300'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[26px]">{icon}</span>
                  </div>
                  <div>
                    <h3 className="text-base font-black text-[#191c1e] leading-snug">
                      {line.name}
                    </h3>
                    <span className="text-[10px] font-mono text-gray-500 font-bold block mt-0.5">
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
                      <div className="flex items-center gap-1 font-bold text-amber-950">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-600"></span>
                        <span>Queso Doble Crema Premium (Tradicional) — Principal</span>
                      </div>
                      <div className="flex items-center gap-1 text-gray-700">
                        <span className="w-1.5 h-1.5 rounded-full bg-gray-400"></span>
                        <span>Queso Doble Crema Industrial</span>
                      </div>
                      <div className="flex items-center gap-1 text-gray-700">
                        <span className="w-1.5 h-1.5 rounded-full bg-gray-400"></span>
                        <span>Queso Pera</span>
                      </div>
                      <div className="flex items-center gap-1 text-gray-700">
                        <span className="w-1.5 h-1.5 rounded-full bg-teal-600"></span>
                        <span>Queso 7 Cueros</span>
                      </div>
                    </div>
                  )}

                  {line.lineType === 'fermentacion' && (
                    <div className="flex flex-col gap-1 text-[11px] text-gray-700">
                      <div className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
                        <span>Yogur Entero Probiótico</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
                        <span>Kumis Tradicional Fermentado</span>
                      </div>
                      <div className="flex items-center gap-1 font-bold text-cyan-950">
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-600"></span>
                        <span>Yogur Griego</span>
                      </div>
                    </div>
                  )}

                  {line.lineType === 'dulces' && (
                    <div className="flex flex-col gap-1 text-[11px] text-gray-700">
                      <div className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                        <span>Manjar Blanco / Arequipe de Olla</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                        <span>Panelitas de Leche y Azúcar</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                        <span>Dulce de Leche Cortada</span>
                      </div>
                    </div>
                  )}
                </div>

                {isCurrentBatch && (
                  <div
                    className={`mt-3 p-2.5 rounded-xl border text-xs flex items-center justify-between font-bold ${
                      activeBatchStatus === 'COMPLETADO'
                        ? 'bg-slate-100 text-slate-700 border-slate-300'
                        : 'bg-blue-100/60 border-blue-200 text-[#1B4E9B]'
                    }`}
                  >
                    <span>Lote: {activeBatchId}</span>
                    <span className="text-[10px] uppercase font-mono">
                      {activeBatchStatus === 'COMPLETADO' ? '✓ Cerrado' : 'En curso'}
                    </span>
                  </div>
                )}
              </div>

              {/* Action Button: Opens the list of products for this line */}
              <div className="pt-2">
                <button
                  onClick={() => onSelectLine(line.id)}
                  className="w-full py-3.5 rounded-2xl bg-[#1B4E9B] hover:bg-[#143A73] text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer active:scale-95"
                >
                  <span className="material-symbols-outlined text-[18px]">format_list_bulleted</span>
                  <span>Ver Productos de {line.name}</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
