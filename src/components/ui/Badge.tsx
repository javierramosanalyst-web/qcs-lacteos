import React from 'react';

export type BadgeVariant =
  | 'default'
  | 'primary'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'neutral'
  | 'locked';

export interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  icon?: string;
  pulse?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

const VARIANT_STYLES: Record<BadgeVariant, string> = {
  default: 'bg-[#F2F4F7] text-[#434655] border-[#D6DEEA]',
  primary: 'bg-[#1B4E9B]/10 text-[#1B4E9B] border-[#1B4E9B]/25',
  success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  warning: 'bg-amber-50 text-amber-800 border-amber-200',
  danger: 'bg-red-50 text-red-700 border-red-200',
  info: 'bg-sky-50 text-sky-800 border-sky-200',
  neutral: 'bg-slate-100 text-slate-600 border-slate-200',
  locked: 'bg-slate-200/80 text-slate-600 border-slate-300',
};

const PULSE_COLORS: Record<BadgeVariant, string> = {
  default: 'bg-[#737686]',
  primary: 'bg-[#1B4E9B]',
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  danger: 'bg-red-500',
  info: 'bg-sky-500',
  neutral: 'bg-slate-500',
  locked: 'bg-slate-500',
};

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'default',
  icon,
  pulse = false,
  size = 'md',
  className = '',
}) => {
  const sizeClasses =
    size === 'sm'
      ? 'px-2 py-0.5 text-[10px] gap-1'
      : 'px-3 py-1 text-xs gap-1.5';

  return (
    <span
      className={`inline-flex items-center font-bold uppercase tracking-wider rounded-full border transition-colors ${VARIANT_STYLES[variant]} ${sizeClasses} ${className}`}
    >
      {pulse && (
        <span className="relative flex h-2 w-2">
          <span
            className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${PULSE_COLORS[variant]}`}
          />
          <span
            className={`relative inline-flex rounded-full h-2 w-2 ${PULSE_COLORS[variant]}`}
          />
        </span>
      )}
      {icon && (
        <span className="material-symbols-outlined text-[14px] leading-none">
          {icon}
        </span>
      )}
      <span>{children}</span>
    </span>
  );
};
