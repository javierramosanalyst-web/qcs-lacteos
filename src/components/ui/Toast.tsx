import React from 'react';
import { ToastMessage } from '../../types';

export interface ToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

const TOAST_STYLES: Record<
  ToastMessage['type'],
  { container: string; icon: string; badge: string }
> = {
  success: {
    container:
      'bg-white border-2 border-emerald-500 text-[#191c1e] shadow-xl shadow-emerald-900/10',
    icon: 'check_circle',
    badge: 'bg-emerald-600 text-white',
  },
  info: {
    container:
      'bg-white border-2 border-[#1B4E9B] text-[#191c1e] shadow-xl shadow-blue-900/10',
    icon: 'info',
    badge: 'bg-[#1B4E9B] text-white',
  },
  warning: {
    container:
      'bg-white border-2 border-amber-500 text-[#191c1e] shadow-xl shadow-amber-900/10',
    icon: 'warning',
    badge: 'bg-amber-500 text-white',
  },
};

export const Toast: React.FC<ToastProps> = ({ toasts, onDismiss }) => {
  if (!toasts.length) return null;

  return (
    <div className="fixed top-5 right-5 z-[9999] pointer-events-none flex flex-col gap-2.5 max-w-md w-full px-4 sm:px-0">
      {toasts.map((toast) => {
        const style = TOAST_STYLES[toast.type] || TOAST_STYLES.info;
        return (
          <div
            key={toast.id}
            role="status"
            onClick={() => onDismiss(toast.id)}
            className={`flex items-center gap-3.5 px-4 py-3.5 rounded-2xl font-semibold text-sm pointer-events-auto cursor-pointer transition-all duration-200 ${style.container}`}
          >
            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${style.badge}`}
            >
              <span className="material-symbols-outlined text-[18px]">
                {style.icon}
              </span>
            </div>
            <span className="flex-1 leading-snug text-[#191c1e]">
              {toast.message}
            </span>
            <span className="material-symbols-outlined text-[16px] text-[#737686] hover:text-[#191c1e]">
              close
            </span>
          </div>
        );
      })}
    </div>
  );
};
