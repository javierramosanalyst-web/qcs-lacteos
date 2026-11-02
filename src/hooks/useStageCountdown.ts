import { useEffect, useMemo, useRef, useState } from 'react';
import { formatHumanDuration } from '../utils/timer';

export type StageTimerAlertLevel = 'none' | 'optimal' | 'warning' | 'overtime';

export interface UseStageCountdownParams {
  startTimestamp?: number | null;
  endTimestamp?: number | null;
  startTime?: number | string | null;
  endTime?: number | string | null;
  isRunning: boolean;
  isCompleted?: boolean;
  targetSeconds?: number;
  targetMinutes?: number;
  maxSeconds?: number;
  completedDurationText?: string | null;
  onTargetReached?: () => void;
}

export interface UseStageCountdownResult {
  elapsedSeconds: number;
  remainingSeconds: number;
  formattedElapsed: string;
  formattedRemaining: string;
  humanElapsed: string;
  progressPercent: number;
  isOptimalReached: boolean;
  isOverMax: boolean;
  isOvertime: boolean;
  alertLevel: StageTimerAlertLevel;
  alertMessage: string | null;
}

function formatClock(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const hrs = Math.floor(safe / 3600);
  const mins = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  if (hrs > 0) {
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(
      2,
      '0'
    )}:${String(secs).padStart(2, '0')}`;
  }
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function useStageCountdown({
  startTimestamp: rawStartTimestamp,
  endTimestamp: rawEndTimestamp,
  startTime,
  endTime,
  isRunning,
  isCompleted = false,
  targetSeconds: rawTargetSeconds,
  targetMinutes,
  maxSeconds,
  completedDurationText,
  onTargetReached,
}: UseStageCountdownParams): UseStageCountdownResult {
  const startTimestamp =
    rawStartTimestamp ?? (typeof startTime === 'number' ? startTime : null);
  const endTimestamp =
    rawEndTimestamp ?? (typeof endTime === 'number' ? endTime : null);

  const targetSeconds =
    rawTargetSeconds !== undefined
      ? rawTargetSeconds
      : targetMinutes !== undefined
      ? targetMinutes * 60
      : undefined;

  const [elapsedSeconds, setElapsedSeconds] = useState<number>(() => {
    if (isCompleted && startTimestamp && endTimestamp) {
      return Math.max(0, Math.floor((endTimestamp - startTimestamp) / 1000));
    }
    if (isRunning && startTimestamp) {
      return Math.max(0, Math.floor((Date.now() - startTimestamp) / 1000));
    }
    return 0;
  });

  const targetFiredRef = useRef<boolean>(false);

  useEffect(() => {
    if (!isRunning) {
      targetFiredRef.current = false;
    }
  }, [isRunning, startTimestamp]);

  useEffect(() => {
    if (!isRunning || isCompleted || !startTimestamp) {
      if (isCompleted && targetSeconds && !endTimestamp) {
        setElapsedSeconds(targetSeconds);
      }
      return;
    }

    const tick = () => {
      const currentElapsed = Math.max(
        0,
        Math.floor((Date.now() - startTimestamp) / 1000)
      );
      setElapsedSeconds(currentElapsed);

      if (
        targetSeconds !== undefined &&
        currentElapsed >= targetSeconds &&
        !targetFiredRef.current
      ) {
        targetFiredRef.current = true;
        if (onTargetReached) {
          onTargetReached();
        }
      }
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [
    isRunning,
    isCompleted,
    startTimestamp,
    endTimestamp,
    targetSeconds,
    onTargetReached,
  ]);

  return useMemo(() => {
    const remainingSeconds =
      targetSeconds !== undefined
        ? Math.max(0, targetSeconds - elapsedSeconds)
        : 0;

    const progressPercent =
      targetSeconds && targetSeconds > 0
        ? Math.min(100, Math.round((elapsedSeconds / targetSeconds) * 100))
        : isCompleted
        ? 100
        : 0;

    const isOptimalReached =
      targetSeconds !== undefined && elapsedSeconds >= targetSeconds;
    const isOverMax =
      maxSeconds !== undefined && elapsedSeconds > maxSeconds;

    let alertLevel: StageTimerAlertLevel = 'none';
    let alertMessage: string | null = null;

    if (isOverMax) {
      alertLevel = 'overtime';
      alertMessage = `¡Atención! Te pasaste del tiempo máximo recomendado (${formatHumanDuration(
        maxSeconds!
      )}).`;
    } else if (isOptimalReached) {
      alertLevel = 'optimal';
      alertMessage = `¡Tiempo cumplido! Ya completaste los ${formatHumanDuration(
        targetSeconds!
      )}.`;
    }

    const formattedElapsed =
      isCompleted && completedDurationText
        ? completedDurationText
        : formatClock(elapsedSeconds);

    return {
      elapsedSeconds,
      remainingSeconds,
      formattedElapsed,
      formattedRemaining: formatClock(remainingSeconds),
      humanElapsed:
        isCompleted && completedDurationText
          ? completedDurationText
          : formatHumanDuration(elapsedSeconds),
      progressPercent,
      isOptimalReached,
      isOverMax,
      isOvertime: isOverMax,
      alertLevel,
      alertMessage,
    };
  }, [
    elapsedSeconds,
    targetSeconds,
    maxSeconds,
    isCompleted,
    completedDurationText,
  ]);
}
