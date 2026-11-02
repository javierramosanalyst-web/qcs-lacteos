import React from 'react';
import { Badge, BadgeVariant } from './Badge';

export type CardVariant =
  | 'default'
  | 'active'
  | 'completed'
  | 'warning'
  | 'danger'
  | 'locked'
  | 'success'
  | 'info';

export interface CardStatusBadge {
  label: string;
  variant?: BadgeVariant;
  pulse?: boolean;
}

export interface CardProps {
  children?: React.ReactNode;
  title?: string;
  subtitle?: string;
  stepBadge?: string;
  badge?: string;
  icon?: string;
  statusBadge?: CardStatusBadge;
  headerRight?: React.ReactNode;
  headerAction?: React.ReactNode;
  footer?: React.ReactNode;
  variant?: CardVariant;
  tone?: CardVariant;
  noPadding?: boolean;
  className?: string;
}

type CanonicalCardVariant =
  | 'default'
  | 'active'
  | 'completed'
  | 'warning'
  | 'danger'
  | 'locked';

function normalizeVariant(v?: CardVariant): CanonicalCardVariant {
  if (!v) return 'default';
  if (v === 'success') return 'completed';
  if (v === 'info') return 'active';
  return v;
}

const CARD_VARIANTS: Record<CanonicalCardVariant, string> = {
  default: 'bg-white border-[#D6DEEA] shadow-sm',
  active:
    'bg-white border-[#1B4E9B]/40 ring-2 ring-[#1B4E9B]/10 shadow-md',
  completed: 'bg-white border-emerald-200 shadow-sm',
  warning: 'bg-amber-50/30 border-amber-300 shadow-sm',
  danger: 'bg-red-50/30 border-red-300 shadow-sm',
  locked: 'bg-[#F2F4F7]/60 border-[#D6DEEA] opacity-75',
};

const ICON_VARIANTS: Record<CanonicalCardVariant, string> = {
  default: 'bg-[#1B4E9B]/10 text-[#1B4E9B]',
  active: 'bg-[#1B4E9B] text-white shadow-sm shadow-[#1B4E9B]/25',
  completed: 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/20',
  warning: 'bg-amber-500 text-white',
  danger: 'bg-red-600 text-white',
  locked: 'bg-slate-200 text-slate-500',
};

export const Card: React.FC<CardProps> = ({
  children,
  title,
  subtitle,
  stepBadge,
  badge,
  icon,
  statusBadge,
  headerRight,
  headerAction,
  footer,
  variant,
  tone,
  noPadding = false,
  className = '',
}) => {
  const resolvedVariant = normalizeVariant(variant || tone);
  const resolvedStepBadge = stepBadge || badge;
  const rightSlot = headerRight || headerAction;
  const hasHeader = Boolean(
    title || subtitle || resolvedStepBadge || icon || statusBadge || rightSlot
  );

  return (
    <section
      className={`rounded-2xl border transition-all duration-200 overflow-hidden ${CARD_VARIANTS[resolvedVariant]} ${className}`}
    >
      {hasHeader && (
        <header
          className={`px-5 sm:px-6 py-4 bg-[#FFFFFF] ${
            children ? 'border-b border-[#D6DEEA]' : ''
          } flex flex-wrap items-center justify-between gap-3`}
        >
          <div className="flex items-center gap-3.5 min-w-0">
            {icon && (
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors ${ICON_VARIANTS[resolvedVariant]}`}
              >
                <span className="material-symbols-outlined text-[22px]">
                  {icon}
                </span>
              </div>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                {resolvedStepBadge && (
                  <span className="px-2 py-0.5 rounded-md bg-[#F2F4F7] border border-[#D6DEEA] text-[10px] font-mono font-bold uppercase tracking-wider text-[#737686]">
                    {resolvedStepBadge}
                  </span>
                )}
                {statusBadge && (
                  <Badge
                    variant={statusBadge.variant || 'default'}
                    size="sm"
                    pulse={statusBadge.pulse}
                  >
                    {statusBadge.label}
                  </Badge>
                )}
                {title && (
                  <h3 className="text-base font-extrabold text-[#191c1e] tracking-tight">
                    {title}
                  </h3>
                )}
              </div>
              {subtitle && (
                <p className="text-xs text-[#5f6374] mt-0.5 leading-relaxed">
                  {subtitle}
                </p>
              )}
            </div>
          </div>

          {rightSlot && (
            <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end">
              {rightSlot}
            </div>
          )}
        </header>
      )}

      {children && (
        <div className={noPadding ? '' : 'p-5 sm:p-6'}>{children}</div>
      )}

      {footer && (
        <footer className="px-6 py-4 bg-[#F2F4F7]/60 border-t border-[#D6DEEA]">
          {footer}
        </footer>
      )}
    </section>
  );
};
