import React from 'react';
import { ProcessTimerState } from '../../types';
import { Badge } from './Badge';

export interface StageHeaderMetric {
  icon: string;
  label: string;
  value: string;
  tone?: 'emerald' | 'amber' | 'blue' | 'purple' | 'default';
}

export interface StageHeaderProps {
  stageNumber: number | string;
  totalStages?: number;
  title?: string;
  stageTitle?: string;
  subtitle?: string;
  productName?: string;
  lineName?: string;
  standardBadge?: string;
  metrics?: StageHeaderMetric[];
  badges?: React.ReactNode;
  processTimer?: ProcessTimerState;
  onOpenSummary?: () => void;
  icon?: string;
  isCompleted?: boolean;
  isReadOnly?: boolean;
  startTime?: string;
  endTime?: string;
  rightContent?: React.ReactNode;
  className?: string;
}

const METRIC_TONES: Record<NonNullable<StageHeaderMetric['tone']>, string> = {
  emerald: 'bg-emerald-50 border-emerald-200 text-emerald-950',
  amber: 'bg-amber-50 border-amber-200 text-amber-950',
  blue: 'bg-sky-50 border-sky-200 text-sky-950',
  purple: 'bg-[#F2F4F7] border-[#C5D0E0] text-[#191c1e]',
  default: 'bg-[#FFFFFF] border-[#D6DEEA] text-[#191c1e]',
};

export const StageHeader: React.FC<StageHeaderProps> = ({
  stageNumber,
  totalStages = 5,
  title,
  stageTitle,
  subtitle,
  productName,
  lineName,
  standardBadge,
  metrics,
  badges,
  processTimer,
  onOpenSummary,
  icon = 'precision_manufacturing',
  isCompleted = false,
  isReadOnly = false,
  startTime,
  endTime,
  rightContent,
  className = '',
}) => {
  const formattedStageNum =
    typeof stageNumber === 'number'
      ? String(stageNumber).padStart(2, '0')
      : stageNumber;

  const displayLineOrProduct = productName || lineName;
  const resolvedTitle = title || stageTitle || '';

  return (
    <header
      className={`bg-white border border-[#D6DEEA] rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 ${className}`}
    >
      <div className="flex items-start gap-4 min-w-0">
        <div
          className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-sm ${
            isCompleted
              ? 'bg-emerald-600 text-white'
              : 'bg-[#1B4E9B] text-white'
          }`}
        >
          <span className="material-symbols-outlined text-[26px]">{icon}</span>
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <span className="px-2.5 py-0.5 rounded-md bg-[#F2F4F7] border border-[#D6DEEA] text-[11px] font-mono font-bold uppercase tracking-wider text-[#434655]">
              Etapa {formattedStageNum} de {String(totalStages).padStart(2, '0')}
            </span>

            {displayLineOrProduct && (
              <Badge variant="primary" size="sm" icon="inventory_2">
                {displayLineOrProduct}
              </Badge>
            )}

            {standardBadge && (
              <Badge variant="default" size="sm">
                {standardBadge}
              </Badge>
            )}

            {isCompleted ? (
              <Badge variant="success" size="sm" icon="check_circle">
                Etapa Lista
              </Badge>
            ) : isReadOnly ? (
              <Badge variant="locked" size="sm" icon="lock">
                Solo Lectura
              </Badge>
            ) : (
              <Badge variant="warning" size="sm" pulse>
                En Curso
              </Badge>
            )}

            {badges}
          </div>

          <h2 className="text-xl sm:text-2xl font-extrabold text-[#191c1e] tracking-tight">
            {resolvedTitle}
          </h2>

          {subtitle && (
            <p className="text-sm text-[#5f6374] mt-1 leading-relaxed max-w-2xl">
              {subtitle}
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 shrink-0">
        {metrics &&
          metrics.map((metric, idx) => {
            const toneStyle = METRIC_TONES[metric.tone || 'default'];
            return (
              <div
                key={idx}
                className={`px-3.5 py-2 rounded-xl border flex items-center gap-2.5 shadow-2xs ${toneStyle}`}
              >
                <span className="material-symbols-outlined text-[22px] opacity-80">
                  {metric.icon}
                </span>
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider opacity-75">
                    {metric.label}
                  </div>
                  <div className="text-sm font-black font-mono leading-tight">
                    {metric.value}
                  </div>
                </div>
              </div>
            );
          })}

        {processTimer && (
          <div className="px-3.5 py-2 rounded-xl border bg-[#FFFFFF] border-[#D6DEEA] text-[#191c1e] flex items-center gap-2.5 shadow-2xs">
            <span className="material-symbols-outlined text-[22px] text-[#1B4E9B]">
              timer
            </span>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-[#737686]">
                Reloj Lote
              </div>
              <div className="text-sm font-black font-mono leading-tight">
                {processTimer.formattedTime}
              </div>
            </div>
          </div>
        )}

        {(startTime || endTime) && (
          <div className="flex items-center gap-2 bg-[#FFFFFF] border border-[#D6DEEA] rounded-xl px-3.5 py-2">
            {startTime && (
              <div className="text-left pr-2 border-r border-[#D6DEEA] last:border-r-0 last:pr-0">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-[#737686]">
                  Hora Inicio
                </span>
                <span className="text-xs font-mono font-bold text-[#191c1e]">
                  {startTime}
                </span>
              </div>
            )}
            {endTime && (
              <div className="text-left pl-1">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                  Hora Fin
                </span>
                <span className="text-xs font-mono font-bold text-emerald-800">
                  {endTime}
                </span>
              </div>
            )}
          </div>
        )}

        {onOpenSummary && (
          <button
            type="button"
            onClick={onOpenSummary}
            className="min-h-[44px] px-3.5 py-2 rounded-xl border border-[#C5D0E0] bg-[#FFFFFF] hover:bg-[#F2F4F7] text-[#191c1e] text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">
              assignment
            </span>
            <span>Ver Resumen</span>
          </button>
        )}

        {rightContent}
      </div>
    </header>
  );
};
