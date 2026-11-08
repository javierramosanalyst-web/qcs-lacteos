import React from 'react';
import { ParentMilkBatch, SubBatchTabInfo } from '../../types';

export interface SubBatchSwitcherBarProps {
  tabs: SubBatchTabInfo[];
  activeProductId: string;
  onSelectSubBatch: (productId: string) => void;
  isFermentacionLine: boolean;
  parentBatch?: ParentMilkBatch;
}

export const SubBatchSwitcherBar: React.FC<SubBatchSwitcherBarProps> = ({
  tabs,
  activeProductId,
  onSelectSubBatch,
  isFermentacionLine,
  parentBatch,
}) => {
  // Lógica estricta de pestañas: Si un sub-lote no ha sido instanciado o tiene 0 Litros, su pestaña NO se renderiza
  const visibleTabs = tabs.filter((t) => (t.allocatedLiters ?? 0) > 0);

  return (
    <div className="bg-[#F2F4F7] border-b border-[#D6DEEA] px-4 lg:px-6 py-3 flex flex-col gap-3">
      {/* Fila superior: Resumen de Lote Padre (en Fermentados) + Pestañas de Sub-Lotes con Relojes en Vivo */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
        {/* Pestañas de Sub-Lotes Activos */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 xl:pb-0">
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#737686] shrink-0 mr-1 flex items-center gap-1">
            <span className="material-symbols-outlined text-[16px] text-[#1B4E9B]">
              call_split
            </span>
            {isFermentacionLine ? 'Sub-Lotes Activos:' : 'Lotes de Queso:'}
          </span>

          {visibleTabs.map((tab) => {
            const isActive = tab.productId === activeProductId;
            const isRunning = tab.timer.isRunning && !tab.timer.isCompleted;
            const isDone =
              tab.status === 'COMPLETADO' || tab.timer.isCompleted;

            return (
              <button
                key={tab.productId}
                type="button"
                onClick={() => onSelectSubBatch(tab.productId)}
                className={`group flex items-center gap-3 px-3.5 py-2 rounded-xl border text-left transition-all shrink-0 cursor-pointer ${
                  isActive
                    ? 'bg-white border-2 border-[#1B4E9B] shadow-sm ring-2 ring-[#1B4E9B]/10'
                    : 'bg-[#FFFFFF] hover:bg-white border-[#D6DEEA] opacity-85 hover:opacity-100'
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                    isActive
                      ? 'bg-[#1B4E9B] text-white'
                      : isDone
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-[#F2F4F7] text-[#434655]'
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]">
                    {tab.icon}
                  </span>
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`text-xs font-extrabold truncate ${
                        isActive ? 'text-[#1B4E9B]' : 'text-[#191c1e]'
                      }`}
                    >
                      {tab.shortName}
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-[#F2F4F7] border border-[#D6DEEA] text-[10px] font-mono font-bold text-[#434655]">
                      {tab.allocatedLiters} L
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[10px] font-semibold text-[#737686]">
                      Etapa {tab.currentStageNumber}/
                      {tab.productId === 'prod-kumis'
                        ? 3
                        : tab.productId === 'prod-yogur'
                        ? 4
                        : 5}
                    </span>
                    <span className="text-[#C5D0E0]">•</span>
                    <span
                      className={`text-[11px] font-mono font-bold flex items-center gap-1 ${
                        isDone
                          ? 'text-emerald-700'
                          : isRunning
                          ? 'text-[#1B4E9B]'
                          : 'text-[#737686]'
                      }`}
                    >
                      {isRunning && (
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                      )}
                      {isDone ? '✓ Listo' : tab.timer.formattedTime}
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Resumen Informativo de Trazabilidad del Lote Padre (solo si hay leche repartida) */}
        {isFermentacionLine && parentBatch && parentBatch.allocatedLiters > 0 && (
          <div className="flex flex-wrap items-center justify-between xl:justify-end gap-2.5 bg-white px-3.5 py-2 rounded-xl border border-[#D6DEEA]">
            <div className="flex items-center gap-2 text-xs">
              <span className="px-2 py-0.5 rounded-md bg-blue-50 text-[#1B4E9B] font-mono font-bold border border-blue-200">
                Lote Padre: {parentBatch.codigoLotePadre}
              </span>
              <span className="text-[#434655] font-semibold">
                Total:{' '}
                <strong className="font-mono text-[#191c1e]">
                  {parentBatch.totalMilkLiters} L
                </strong>
              </span>
              <span className="text-[#C5D0E0]">|</span>
              <span className="text-emerald-800 font-semibold">
                Repartidos:{' '}
                <strong className="font-mono">
                  {parentBatch.allocatedLiters} L
                </strong>
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
