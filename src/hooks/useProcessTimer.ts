import { useEffect, useMemo, useState } from 'react';
import { ProcessTimerState } from '../types';
import { formatHumanDuration, formatSecondsToHMS } from '../utils/timer';

export type TimerAlertStatus = 'idle' | 'normal' | 'optimal_reached' | 'overtime';

export interface UseProcessTimerParams {
  startTimestamp?: number | null;
  endTimestamp?: number | null;
  startTime?: string | null;
  endTime?: string | null;
  isRunning: boolean;
  isCompleted?: boolean;
  initialElapsedSeconds?: number;
  optimalSeconds?: number;
  maxSeconds?: number;
}

export interface UseProcessTimerResult {
  elapsedSeconds: number;
  formattedTime: string;
  humanDuration: string;
  isOverOptimal: boolean;
  isOverMax: boolean;
  alertStatus: TimerAlertStatus;
  alertMessage: string | null;
}

/**
 * Hook independiente para el cronómetro global de un Lote (Padre o Hijo).
 * Calcula el tiempo transcurrido desde startTimestamp sin interferir con otros lotes
 * y emite alertas amigables si supera el tiempo óptimo o máximo recomendado.
 */
export function useProcessTimer({
  startTimestamp,
  endTimestamp,
  isRunning,
  isCompleted = false,
  initialElapsedSeconds = 0,
  optimalSeconds,
  maxSeconds,
}: UseProcessTimerParams): UseProcessTimerResult {
  const [liveElapsed, setLiveElapsed] = useState<number>(() => {
    if (isCompleted && startTimestamp && endTimestamp) {
      return Math.max(0, Math.floor((endTimestamp - startTimestamp) / 1000));
    }
    if (isRunning && startTimestamp) {
      return Math.max(
        initialElapsedSeconds,
        Math.floor((Date.now() - startTimestamp) / 1000)
      );
    }
    return initialElapsedSeconds;
  });

  useEffect(() => {
    if (!isRunning || isCompleted || !startTimestamp) {
      if (initialElapsedSeconds > 0) {
        setLiveElapsed(initialElapsedSeconds);
      }
      return;
    }

    const updateTick = () => {
      const elapsed = Math.max(
        0,
        Math.floor((Date.now() - startTimestamp) / 1000)
      );
      setLiveElapsed(elapsed);
    };

    updateTick();
    const interval = setInterval(updateTick, 1000);
    return () => clearInterval(interval);
  }, [isRunning, isCompleted, startTimestamp, initialElapsedSeconds]);

  return useMemo(() => {
    const formattedTime = formatSecondsToHMS(liveElapsed);
    const humanDuration = formatHumanDuration(liveElapsed);

    const isOverOptimal =
      optimalSeconds !== undefined && liveElapsed >= optimalSeconds;
    const isOverMax = maxSeconds !== undefined && liveElapsed > maxSeconds;

    let alertStatus: TimerAlertStatus = 'idle';
    let alertMessage: string | null = null;

    if (isRunning || isCompleted) {
      if (isOverMax) {
        alertStatus = 'overtime';
        alertMessage = `⚠ Se pasó del tiempo máximo recomendado (${formatHumanDuration(
          maxSeconds!
        )}). Revisa el lote.`;
      } else if (isOverOptimal) {
        alertStatus = 'optimal_reached';
        alertMessage = `✓ Ya se cumplió el tiempo óptimo (${formatHumanDuration(
          optimalSeconds!
        )}).`;
      } else {
        alertStatus = 'normal';
      }
    }

    return {
      elapsedSeconds: liveElapsed,
      formattedTime,
      humanDuration,
      isOverOptimal,
      isOverMax,
      alertStatus,
      alertMessage,
    };
  }, [liveElapsed, isRunning, isCompleted, optimalSeconds, maxSeconds]);
}

/**
 * Sincroniza de forma independiente un ProcessTimerState dentro del estado de un lote,
 * permitiendo que múltiples Lotes Hijos (Yogur, Kumis, Griego, Quesos) corran en paralelo
 * aunque el operario cambie de pestaña.
 */
export function useIndependentBatchTimer<
  T extends { processTimer: ProcessTimerState }
>(
  batch: T,
  setBatch: React.Dispatch<React.SetStateAction<T>>,
  optimalSeconds?: number,
  maxSeconds?: number
): UseProcessTimerResult {
  const { isRunning, isCompleted, startTimestamp, elapsedSeconds } =
    batch.processTimer;

  const timerResult = useProcessTimer({
    startTimestamp,
    isRunning,
    isCompleted,
    initialElapsedSeconds: elapsedSeconds,
    optimalSeconds,
    maxSeconds,
  });

  useEffect(() => {
    if (!isRunning || isCompleted || !startTimestamp) return;

    setBatch((prev) => {
      if (prev.processTimer.elapsedSeconds === timerResult.elapsedSeconds) {
        return prev;
      }
      return {
        ...prev,
        processTimer: {
          ...prev.processTimer,
          elapsedSeconds: timerResult.elapsedSeconds,
          formattedTime: timerResult.formattedTime,
        },
      };
    });
  }, [
    isRunning,
    isCompleted,
    startTimestamp,
    timerResult.elapsedSeconds,
    timerResult.formattedTime,
    setBatch,
  ]);

  return timerResult;
}
