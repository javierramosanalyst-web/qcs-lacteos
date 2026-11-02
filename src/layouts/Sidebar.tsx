import React from 'react';
import { AppView, LotesLeche, StageId, UserRole } from '../types';

interface SidebarProps {
  currentStage: StageId;
  onSelectStage: (stage: StageId) => void;
  currentView: AppView;
  onNavigateView: (view: AppView) => void;
  userRole: UserRole;
  batchId: string;
  productName?: string;
  productId?: string;
  lotesLeche?: LotesLeche;
  llevaAzucar?: boolean;
  stageStatuses: Record<StageId, 'pendiente' | 'en_proceso' | 'completada'>;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  onOpenAuditTrailModal?: () => void;
  onOpenCorrectionModal?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentStage,
  onSelectStage,
  currentView,
  onNavigateView,
  userRole,
  batchId,
  productName = 'Queso Doble Crema Industrial',
  productId,
  lotesLeche,
  llevaAzucar,
  stageStatuses,
  mobileOpen,
  onCloseMobile,
  onOpenAuditTrailModal,
  onOpenCorrectionModal,
}) => {
  const isYogurGriego =
    productId === 'prod-yogur-griego' ||
    (productId !== 'prod-yogur' &&
      productId !== 'prod-kumis' &&
      productName.toLowerCase().includes('griego') &&
      !productName.toLowerCase().includes('kumis'));
  const isKumis =
    productId === 'prod-kumis' ||
    (productId !== 'prod-yogur' &&
      productId !== 'prod-yogur-griego' &&
      productName.toLowerCase().includes('kumis') &&
      !productName.toLowerCase().includes('griego'));
  const isYogur =
    productId === 'prod-yogur' ||
    ((productName.toLowerCase().includes('yogur') || productName.toLowerCase().includes('yogurt')) &&
      !isYogurGriego &&
      !isKumis);
  const isQuesoPera = productId === 'prod-queso-pera' || productName.toLowerCase().includes('pera');
  const isQueso7Cueros =
    productId === 'prod-queso-7-cueros' ||
    productName.toLowerCase().includes('7 cueros') ||
    productName.toLowerCase().includes('siete cueros');

  const navItems: { id: StageId; label: string; icon: string }[] = isYogurGriego
    ? [
        { id: 'acidificar', label: '1. Pasteurizar Leche', icon: 'local_fire_department' },
        { id: 'calentar-y-cuajar', label: '2. Inocular e Incubar', icon: 'biotech' },
        { id: 'desuerar', label: '3. Cuarto Frío y Escurrido', icon: 'filter_alt' },
        { id: 'hilar', label: '4. Batido', icon: 'blender' },
        { id: 'moldeo', label: '5. Envasar y Guardar', icon: 'inventory_2' },
      ]
    : isKumis
    ? [
        { id: 'acidificar', label: '1. Pasteurizar Leche', icon: 'local_fire_department' },
        { id: 'calentar-y-cuajar', label: '2. Inocular e Incubar', icon: 'biotech' },
        { id: 'moldeo', label: '3. Envasar y Guardar', icon: 'inventory_2' },
      ]
    : isYogur
    ? [
        { id: 'acidificar', label: '1. Pasteurizar Leche', icon: 'local_fire_department' },
        { id: 'calentar-y-cuajar', label: '2. Inocular e Incubar', icon: 'biotech' },
        { id: 'hilar', label: '3. Batido', icon: 'blender' },
        { id: 'moldeo', label: '4. Envasar y Guardar', icon: 'inventory_2' },
      ]
    : isQueso7Cueros
    ? [
        { id: 'acidificar', label: '1. Acidificar Leche', icon: 'science' },
        { id: 'calentar-y-cuajar', label: '2. Cuajar y Calentar', icon: 'thermostat' },
        { id: 'desuerar', label: '3. Desuerar y Escurrir', icon: 'filter_alt' },
        { id: 'hilar', label: '4. Hilar y Salar', icon: 'waves' },
        { id: 'moldeo', label: '5. Moldear y Pesar', icon: 'scale' },
      ]
    : isQuesoPera
    ? [
        { id: 'acidificar', label: '1. Leche e Insumos', icon: 'water_drop' },
        { id: 'calentar-y-cuajar', label: '2. Premadurar y Cuajar', icon: 'biotech' },
        { id: 'desuerar', label: '3. Desuerar y Escurrir', icon: 'filter_alt' },
        { id: 'hilar', label: '4. Hilar y Salmueras', icon: 'waves' },
        { id: 'moldeo', label: '5. Moldear y Pesar', icon: 'scale' },
      ]
    : [
        { id: 'acidificar', label: '1. Acidificar Leche', icon: 'science' },
        { id: 'calentar-y-cuajar', label: '2. Calentar y Cuajar', icon: 'thermostat' },
        { id: 'desuerar', label: '3. Desuerar y Escurrir', icon: 'filter_alt' },
        { id: 'hilar', label: '4. Hilar y Salar', icon: 'waves' },
        { id: 'moldeo', label: '5. Moldear y Pesar', icon: 'scale' },
      ];
  // El menú izquierdo de etapas (acidificar, calentar y cuajar, desuerar, hilar, etc.)
  // SOLO debe aparecer cuando se está dentro de un proceso o producto
  if (currentView !== 'batch_process') {
    return null;
  }

  const isAdmin = userRole === 'administrador';

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 lg:hidden backdrop-blur-xs"
          onClick={onCloseMobile}
        />
      )}

      <aside
        className={`fixed left-0 top-0 h-full w-72 bg-[#F2F4F7] border-r border-[#D6DEEA] z-50 flex flex-col pt-4 pb-6 transition-transform duration-300 lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Plant / Brand Header */}
        <div className="px-5 mb-4 flex items-start justify-between">
          <div className="flex flex-col">
            <img src="/brand/logo-texto.jpg" alt="Lácteos Colombia" className="h-12 w-full max-w-[200px] rounded-xl object-cover" />
            <div className="text-[11px] font-bold text-gray-600 mt-1.5 flex items-center gap-1">
              <span className={`w-2 h-2 rounded-full ${isAdmin ? 'bg-[#1B4E9B]' : 'bg-[#5FAF32] animate-pulse'} shrink-0`}></span>
              <span>Control de Producción</span>
            </div>

            {/* Role Indicator Banner */}
            <div className={`mt-2 px-2.5 py-1 rounded-xl text-[11px] font-bold flex items-center justify-between border ${
              isAdmin
                ? 'bg-red-50 text-red-800 border-red-200'
                : 'bg-blue-50 text-[#1B4E9B] border-blue-200'
            }`}>
              <span className="flex items-center gap-1">
                <span className="material-symbols-outlined text-[15px]">
                  {isAdmin ? 'admin_panel_settings' : 'badge'}
                </span>
                <span>{isAdmin ? 'Modo: Administrador' : 'Modo: Operador de Piso'}</span>
              </span>
            </div>
          </div>
          <button
            onClick={onCloseMobile}
            className="lg:hidden text-gray-500 hover:text-gray-800 p-1"
            aria-label="Cerrar menú"
          >
            <span className="material-symbols-outlined text-[22px]">close</span>
          </button>
        </div>

        {/* Section 1: Back Navigation */}
        <div className="px-3 mb-3 flex flex-col gap-1">
          {isAdmin ? (
            <button
              onClick={() => {
                onNavigateView('admin_dashboard');
                onCloseMobile();
              }}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-gray-700 hover:bg-[#E6ECF5] transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">arrow_back</span>
              <span>Dashboard Global</span>
            </button>
          ) : (
            <button
              onClick={() => {
                onNavigateView('operator_product_select');
                onCloseMobile();
              }}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-gray-700 hover:bg-[#E6ECF5] transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">arrow_back</span>
              <span>Cambiar Producto</span>
            </button>
          )}
        </div>

        {/* Section 2: Doble Crema Process Stages (Available during batch process) */}
        <div className="px-3 flex-1 flex flex-col overflow-y-auto pt-2 border-t border-[#C5D0E0]/80">
          <div className="px-2 mb-2 flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
              {isYogurGriego
                ? 'PROCESO YOGUR GRIEGO (LOTE YGR-01)'
                : isKumis
                ? 'PROCESO KUMIS (LOTE KUM-01)'
                : isYogur
                ? 'PROCESO YOGUR (LOTE YOG-01)'
                : isQueso7Cueros
                ? `PROCESO QUESO 7 CUEROS (${batchId})`
                : isQuesoPera
                ? `Proceso Queso Pera (${batchId})`
                : `Proceso Doble Crema (${batchId})`}
            </span>
            <span
              className={`text-[9px] font-mono px-1 rounded border ${
                isYogurGriego
                  ? 'text-cyan-800 bg-cyan-50 border-cyan-300 font-bold'
                  : isKumis
                  ? 'text-indigo-800 bg-indigo-50 border-indigo-300 font-bold'
                  : isYogur
                  ? 'text-purple-700 bg-purple-50 border-purple-300 font-bold'
                  : 'text-[#1B4E9B] bg-blue-50 border-blue-200'
              }`}
            >
              {isYogurGriego || isKumis || isYogur ? 'NTC-805' : 'NTC-589'}
            </span>
          </div>

          <nav className="flex flex-col gap-1">
            {navItems.map((item) => {
              const isActive = currentView === 'batch_process' && currentStage === item.id;
              const status = stageStatuses[item.id];

              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onNavigateView('batch_process');
                    onSelectStage(item.id);
                    onCloseMobile();
                  }}
                  className={`flex items-center justify-between px-3 py-2 rounded-xl transition-all text-left text-xs ${
                    isActive
                      ? 'bg-[#1B4E9B] text-white font-bold shadow-xs'
                      : 'text-[#434655] hover:bg-[#E6ECF5] hover:text-[#191c1e]'
                  }`}
                >
                  <div className="flex items-center">
                    <span className={`material-symbols-outlined mr-2.5 text-[18px] ${isActive ? 'text-white' : 'text-[#434655]'}`}>
                      {item.icon}
                    </span>
                    <span>{item.label}</span>
                  </div>

                  {status === 'completada' && (
                    <span className={`material-symbols-outlined text-[15px] ${isActive ? 'text-amber-300' : 'text-emerald-700'}`}>
                      check_circle
                    </span>
                  )}
                  {status === 'en_proceso' && !isActive && (
                    <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping"></span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Lotes Leche Card (Sólo Pasta Hilada) */}
          {!isYogur && !isKumis && !isYogurGriego && lotesLeche && (
            <div className="mt-3 bg-white/80 p-2.5 rounded-xl border border-[#D6DEEA] text-[10px] flex flex-col gap-1">
              <span className="font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1">
                <span className="material-symbols-outlined text-[13px] text-[#1B4E9B]">water_drop</span>
                Trazabilidad Materia Prima
              </span>
              <div className="flex justify-between">
                <span className="text-gray-500">L. Base:</span>
                <span className="font-bold text-amber-900 font-mono">{lotesLeche.loteLecheBase}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">L. Fresca:</span>
                <span className="font-bold text-[#1B4E9B] font-mono">{lotesLeche.loteLecheFresca}</span>
              </div>
            </div>
          )}
        </div>

        {/* Footer info & Admin Tools */}
        <div className="px-3 pt-3 flex flex-col gap-2 border-t border-[#C5D0E0]/80">
          {isAdmin && onOpenCorrectionModal && (
            <button
              onClick={() => {
                onOpenCorrectionModal();
                onCloseMobile();
              }}
              className="w-full py-2 px-3 rounded-xl bg-red-100 hover:bg-red-200 text-red-800 text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">edit_note</span>
              <span>Corregir Parámetro (Auditado)</span>
            </button>
          )}

          {isAdmin && onOpenAuditTrailModal && (
            <button
              onClick={() => {
                onOpenAuditTrailModal();
                onCloseMobile();
              }}
              className="w-full py-2 px-3 rounded-xl bg-gray-900 hover:bg-black text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px] text-amber-300">history_edu</span>
              <span>Audit Trail Completo</span>
            </button>
          )}

          <div className="p-2.5 bg-[#E6ECF5]/70 rounded-xl border border-[#C5D0E0] text-[10px] text-gray-500 flex items-center justify-between">
            <span>SCADA v3.4 · Planta Láctea</span>
            <span className="font-bold text-emerald-800">● Conectado</span>
          </div>
        </div>
      </aside>
    </>
  );
};
