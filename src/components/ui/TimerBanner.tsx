import React from 'react';

export interface TimerBannerProps {
  title?: string;
  label?: string;
  subtitle?: string;
  sublabel?: string;
  elapsedSeconds?: number;
  formattedTime?: string;
  targetSeconds?: number;
  targetLabel?: string;
  maxRecommendedSeconds?: number;
  progressPercent?: number;
  isRunning?: boolean;
  isCompleted?: boolean;
  isOvertime?: boolean;
  isOverdue?: boolean;
  status?: 'idle' | 'running' | 'completed' | 'overtime' | string;
  statusLabel?: string;
  variant?: string;
  actionButton?: React.ReactNode;
  className?: string;
}

function formatTimerClock(totalSeconds: number): string {
  const safeSec = Math.max(0, Math.floor(totalSeconds));
  const hrs = Math.floor(safeSec / 3600);
  const mins = Math.floor((safeSec % 3600) / 60);
  const secs = safeSec % 60;
  if (hrs > 0) {
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(
      2,
      '0'
    )}:${String(secs).padStart(2, '0')}`;
  }
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export const TimerBanner: React.FC<TimerBannerProps> = ({
  title,
  label,
  subtitle,
  sublabel,
  elapsedSeconds = 0,
  formattedTime,
  targetSeconds,
  targetLabel,
  maxRecommendedSeconds,
  progressPercent,
  isRunning: rawIsRunning,
  isCompleted: rawIsCompleted,
  isOvertime: rawIsOvertime,
  isOverdue = false,
  status,
  statusLabel,
  actionButton,
  className = '',
}) => {
  const isCompleted = Boolean(rawIsCompleted || status === 'completed');
  const isRunning = Boolean(rawIsRunning || status === 'running');
  const isOvertime = Boolean(
    rawIsOvertime || isOverdue || status === 'overtime'
  );

  const resolvedTitle = title || label || 'Tiempo del Paso';
  const resolvedSubtitle = subtitle || sublabel;
  const isOverMax =
    isOvertime ||
    (maxRecommendedSeconds !== undefined &&
      elapsedSeconds > maxRecommendedSeconds);
  const isTargetReached =
    (targetSeconds !== undefined && elapsedSeconds >= targetSeconds) ||
    (progressPercent !== undefined && progressPercent >= 100);

  const progressPct =
    progressPercent !== undefined
      ? progressPercent
      : targetSeconds && targetSeconds > 0
      ? Math.min(100, Math.round((elapsedSeconds / targetSeconds) * 100))
      : null;

  let containerStyle = 'bg-[#FFFFFF] border-[#D6DEEA] text-[#191c1e]';
  let timerTextColor = 'text-[#1B4E9B]';

  if (isCompleted) {
    containerStyle = 'bg-emerald-50/70 border-emerald-200 text-emerald-950';
    timerTextColor = 'text-emerald-700';
  } else if (isOverMax) {
    containerStyle = 'bg-red-50 border-red-300 text-red-950';
    timerTextColor = 'text-red-700';
  } else if (isTargetReached) {
    containerStyle = 'bg-emerald-50 border-emerald-300 text-emerald-950';
    timerTextColor = 'text-emerald-700';
  } else if (isRunning) {
    containerStyle = 'bg-blue-50/50 border-[#1B4E9B]/30 text-[#191c1e]';
    timerTextColor = 'text-[#1B4E9B]';
  }

  const displayTime = formattedTime || formatTimerClock(elapsedSeconds);
  const displayTarget =
    targetLabel ||
    (targetSeconds !== undefined ? formatTimerClock(targetSeconds) : null);

  return (
    <div
      className={`rounded-2xl border p-4 sm:p-5 transition-all ${containerStyle} ${className}`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5 min-w-0">
          <div
            className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
              isCompleted || isTargetReached
                ? 'bg-emerald-600 text-white'
                : isOverMax
                ? 'bg-red-600 text-white animate-pulse'
                : isRunning
                ? 'bg-[#1B4E9B] text-white'
                : 'bg-[#F2F4F7] text-[#737686] border border-[#D6DEEA]'
            }`}
          >
            <span className="material-symbols-outlined text-[24px]">
              {isCompleted
                ? 'task_alt'
                : isOverMax
                ? 'warning'
                : isRunning
                ? 'timer'
                : 'schedule'}
            </span>
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-sm font-extrabold tracking-tight">
                {resolvedTitle}
              </h4>
              {statusLabel ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-[#1B4E9B]/10 text-[#1B4E9B]">
                  {statusLabel}
                </span>
              ) : (
                <>
                  {isRunning && !isCompleted && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-[#1B4E9B]/10 text-[#1B4E9B]">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#1B4E9B] animate-ping" />
                      Corriendo
                    </span>
                  )}
                  {isTargetReached && !isCompleted && !isOverMax && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800">
                      ¡Tiempo cumplido!
                    </span>
                  )}
                  {isOverMax && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-red-100 text-red-800">
                      Tiempo excedido
                    </span>
                  )}
                </>
              )}
            </div>
            {resolvedSubtitle && (
              <p className="text-xs opacity-80 mt-0.5 leading-relaxed">
                {resolvedSubtitle}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between sm:justify-end gap-3 sm:gap-4 w-full sm:w-auto sm:shrink-0">
          <div className="text-right shrink-0">
            <div
              className={`text-2xl sm:text-3xl font-mono font-black tracking-tight leading-none ${timerTextColor}`}
            >
              {displayTime}
            </div>
            {displayTarget && (
              <span className="block text-[11px] font-mono text-[#737686] mt-1">
                {displayTarget?.startsWith('Meta')
                  ? displayTarget
                  : displayTarget
                  ? `Meta: ${displayTarget}`
                  : ''}
              </span>
            )}
          </div>

          {actionButton && (
            <div className="w-full sm:w-auto min-w-0 [&>button]:w-full sm:[&>button]:w-auto">
              {actionButton}
            </div>
          )}
        </div>
      </div>

      {progressPct !== null && (
        <div className="mt-3.5 w-full h-2 rounded-full bg-black/5 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              isOverMax
                ? 'bg-red-500'
                : isTargetReached || isCompleted
                ? 'bg-emerald-500'
                : 'bg-[#1B4E9B]'
            }`}
            style={{ width: `${progressPct}%` }}
          />
        </div>
      )}
    </div>
  );
};
