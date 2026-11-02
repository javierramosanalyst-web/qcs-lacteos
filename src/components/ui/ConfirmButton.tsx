import React from 'react';

export interface ConfirmButtonProps {
  confirmed?: boolean;
  isConfirmed?: boolean;
  onConfirm: () => void;
  label?: string;
  labelPending?: string;
  labelConfirmed?: string;
  unconfirmedLabel?: string;
  confirmedLabel?: string;
  timestamp?: string;
  subtitlePending?: string;
  subtitleConfirmed?: string;
  iconPending?: string;
  iconConfirmed?: string;
  icon?: string;
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  disabledReason?: string;
  variantPending?: 'primary' | 'amber' | 'emerald';
  fullWidth?: boolean;
  className?: string;
}

const PENDING_VARIANTS = {
  primary:
    'bg-[#1B4E9B] hover:bg-[#143A73] text-white border-[#1B4E9B] shadow-md shadow-[#1B4E9B]/20',
  amber:
    'bg-amber-500 hover:bg-amber-600 text-white border-amber-500 shadow-md shadow-amber-500/20',
  emerald:
    'bg-[#16a34a] hover:bg-[#15803d] text-white border-[#16a34a] shadow-md shadow-[#16a34a]/20',
};

export const ConfirmButton: React.FC<ConfirmButtonProps> = ({
  confirmed,
  isConfirmed,
  onConfirm,
  label,
  labelPending,
  labelConfirmed,
  unconfirmedLabel,
  confirmedLabel,
  timestamp,
  subtitlePending,
  subtitleConfirmed,
  iconPending,
  iconConfirmed = 'check_circle',
  icon,
  disabled = false,
  disabledReason,
  variantPending = 'primary',
  fullWidth = false,
  className = '',
}) => {
  const resolvedConfirmed = Boolean(confirmed ?? isConfirmed);
  const finalLabelPending =
    labelPending || unconfirmedLabel || label || 'Confirmar Paso';
  const finalLabelConfirmed =
    labelConfirmed || confirmedLabel || label || '✓ Paso Confirmado';
  const finalIconPending = iconPending || icon || 'touch_app';

  if (resolvedConfirmed) {
    return (
      <div
        className={`min-h-[48px] flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-emerald-50 border-2 border-emerald-200 text-emerald-800 transition-all ${
          fullWidth ? 'w-full' : ''
        } ${className}`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm">
            <span className="material-symbols-outlined text-[18px]">
              {iconConfirmed}
            </span>
          </div>
          <div className="min-w-0">
            <p className="text-xs sm:text-sm font-extrabold text-emerald-900 leading-tight">
              {finalLabelConfirmed}
            </p>
            {subtitleConfirmed && (
              <p className="text-xs font-semibold text-emerald-700 mt-0.5">
                {subtitleConfirmed}
              </p>
            )}
          </div>
        </div>
        {timestamp && (
          <span className="shrink-0 px-2.5 py-1 rounded-lg bg-white border border-emerald-200 text-xs font-mono font-bold text-emerald-800">
            {timestamp}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className={fullWidth ? 'w-full' : ''}>
      <button
        type="button"
        onClick={onConfirm}
        disabled={disabled}
        className={`min-h-[48px] flex items-center justify-center gap-2.5 px-5 py-3 rounded-xl border font-extrabold text-xs sm:text-sm tracking-wide transition-all duration-150 active:scale-[0.99] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 ${
          PENDING_VARIANTS[variantPending]
        } ${fullWidth ? 'w-full' : ''} ${className}`}
      >
        <span className="material-symbols-outlined text-[20px]">
          {finalIconPending}
        </span>
        <div className="text-left">
          <span className="block leading-tight">{finalLabelPending}</span>
          {subtitlePending && (
            <span className="block text-[11px] font-semibold opacity-90 mt-0.5">
              {subtitlePending}
            </span>
          )}
        </div>
      </button>
      {disabled && disabledReason && (
        <p className="text-[11px] text-amber-700 font-bold mt-1.5 flex items-center gap-1">
          <span className="material-symbols-outlined text-[14px]">info</span>
          <span>{disabledReason}</span>
        </p>
      )}
    </div>
  );
};
