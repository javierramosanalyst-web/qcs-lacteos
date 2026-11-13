import React, { useEffect, useState } from 'react';
import { AppView, BatchData, UserProfile } from '../types';
import { SyncStatus } from '../hooks/useBatchPersistence';

interface HeaderProps {
  batch: BatchData;
  currentUser: UserProfile;
  currentView: AppView;
  syncStatus?: SyncStatus;
  onNavigateView: (view: AppView) => void;
  onOpenMobileMenu: () => void;
  onOpenReviewModal: () => void;
  onOpenCorrectionModal?: () => void;
  onLogout: () => void;
}

const SYNC_INFO: Record<SyncStatus, { label: string; icon: string; cls: string }> = {
  idle: { label: 'Conectando', icon: 'cloud', cls: 'text-gray-500 bg-white border-[#D6DEEA]' },
  saving: { label: 'Guardando...', icon: 'cloud_sync', cls: 'text-[#1B4E9B] bg-[#1B4E9B]/5 border-[#1B4E9B]/30' },
  saved: { label: 'Guardado', icon: 'cloud_done', cls: 'text-[#3F7F1E] bg-[#5FAF32]/10 border-[#5FAF32]/40' },
  error: { label: 'Error al guardar', icon: 'cloud_off', cls: 'text-red-700 bg-red-50 border-red-300' },
  offline: { label: 'Sin conexión', icon: 'wifi_off', cls: 'text-amber-800 bg-amber-50 border-amber-300' },
};

export const Header: React.FC<HeaderProps> = ({
  batch,
  currentUser,
  currentView,
  syncStatus = 'idle',
  onNavigateView,
  onOpenMobileMenu,
  onOpenCorrectionModal,
  onLogout,
}) => {
  const [timeStr, setTimeStr] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      setTimeStr(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const isAdmin = currentUser.role === 'administrador';
  const sync = SYNC_INFO[syncStatus];

  return (
    <header
      className={`fixed top-0 left-0 ${currentView === 'batch_process' ? 'lg:left-72' : ''} right-0 h-16 bg-white/95 backdrop-blur-xl border-b-4 border-[#5FAF32] shadow-xs z-40 flex items-center justify-between px-3 lg:px-6 transition-all duration-300`}
    >
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        {currentView === 'batch_process' && (
          <button
            onClick={onOpenMobileMenu}
            className="lg:hidden p-2 text-[#143A73] rounded-lg hover:bg-[#F2F4F7]"
            aria-label="Abrir menú de navegación"
          >
            <span className="material-symbols-outlined text-[24px]">menu</span>
          </button>
        )}

        {currentView !== 'batch_process' && (
          <img src="/brand/logo-texto.jpg" alt="Lácteos Colombia" className="h-8 sm:h-10 rounded-lg object-contain shrink-0" />
        )}

        {currentView === 'batch_process' ? (
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-xl bg-[#F2F4F7] border border-[#D6DEEA] min-w-0">
            <div className="w-2 h-2 rounded-full bg-[#5FAF32] animate-pulse shrink-0"></div>
            <span className="text-xs font-bold text-[#1B4E9B] truncate">{batch.loteDia || batch.id}</span>
            <span className="text-[#D6DEEA] hidden sm:inline">|</span>
            <span className="text-xs font-semibold text-[#143A73] hidden sm:inline truncate">{batch.productName}</span>
          </div>
        ) : (
          <span className="text-[10px] sm:text-xs font-bold text-[#143A73] truncate min-w-0">
            {currentView === 'admin_dashboard'
              ? 'Panel de Supervisor'
              : currentView === 'operator_line_select'
              ? 'Elige tu Línea de Trabajo'
              : 'Elige el Producto a Elaborar'}
          </span>
        )}

        {isAdmin && (
          <div className="hidden md:flex items-center gap-1.5 ml-1">
            <button
              onClick={() => onNavigateView('admin_dashboard')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                currentView === 'admin_dashboard'
                  ? 'bg-[#1B4E9B] text-white shadow-xs'
                  : 'bg-white hover:bg-[#F2F4F7] text-gray-700 border border-[#D6DEEA]'
              }`}
            >
              Dashboard
            </button>
            <button
              onClick={() => onNavigateView('operator_line_select')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                currentView !== 'admin_dashboard'
                  ? 'bg-[#1B4E9B] text-white shadow-xs'
                  : 'bg-white hover:bg-[#F2F4F7] text-gray-700 border border-[#D6DEEA]'
              }`}
            >
              Líneas y Lotes
            </button>
          </div>
        )}
      </div>

      <div className="flex items-center">
        {batch.processTimer.isRunning && currentView === 'batch_process' ? (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#1B4E9B] text-white shadow-xs">
            <span className="material-symbols-outlined text-[18px] animate-pulse">timer</span>
            <div className="flex flex-col">
              <div className="text-[9px] font-bold uppercase tracking-wider text-[#8CC63F] leading-tight">Tiempo lote</div>
              <div className="text-xs sm:text-sm font-mono font-extrabold leading-tight">{batch.processTimer.formattedTime}</div>
            </div>
          </div>
        ) : (
          <div className="hidden lg:flex items-center gap-2 text-xs text-gray-500 font-mono">
            <span className="material-symbols-outlined text-[16px] text-gray-400">schedule</span>
            <span>{timeStr}</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <span
          className={`hidden sm:flex items-center gap-1 px-2 py-1 rounded-lg border text-[10px] font-bold ${sync.cls}`}
          title="Estado de guardado en la base de datos"
        >
          <span className="material-symbols-outlined text-[15px]">{sync.icon}</span>
          <span>{sync.label}</span>
        </span>

        {isAdmin && onOpenCorrectionModal && (
          <button
            onClick={onOpenCorrectionModal}
            className="hidden sm:flex px-2.5 py-1.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 border border-red-300 text-xs font-bold items-center gap-1 shadow-xs transition-all cursor-pointer active:scale-95"
            title="Corrección justificada de un dato del lote"
          >
            <span className="material-symbols-outlined text-[16px]">edit_note</span>
            <span className="hidden sm:inline">Corregir</span>
          </button>
        )}

        <div className="flex items-center gap-2 pl-2 border-l border-[#D6DEEA]">
          <div className="hidden xl:flex flex-col text-right">
            <span className="text-xs font-bold text-[#143A73] leading-tight">{currentUser.name}</span>
            <span className="text-[10px] text-gray-500 font-medium leading-tight">
              {currentUser.code} · Turno {currentUser.shift}
            </span>
          </div>
          <button
            onClick={onLogout}
            className="p-2 rounded-xl text-gray-600 hover:text-red-700 hover:bg-red-50 border border-transparent hover:border-red-200 transition-all cursor-pointer flex items-center gap-1"
            title="Cerrar sesión"
          >
            <span className="material-symbols-outlined text-[20px]">logout</span>
            <span className="text-xs font-bold hidden md:inline">Salir</span>
          </button>
        </div>
      </div>
    </header>
  );
};
