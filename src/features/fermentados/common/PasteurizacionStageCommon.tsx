import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ManualEditToggle } from '../../../components/ui/ManualEditToggle';
import {
  Badge,
  Button,
  Card,
  InputField,
  SelectField,
  SelectOption,
  StageHeader,
  TimerBanner,
  PopoverTimePicker,
} from '../../../components/ui';
import { ProcessTimerState, SplitMilkAllocationInput } from '../../../types';
import {
  computeDurationBetweenTimes,
  formatHumanDuration,
  formatTimeFromStep1,
  getCurrentTimeString,
  timeStringToTimestampToday,
} from '../../../utils/timer';
import { useStageCountdown } from '../../../hooks/useStageCountdown';
import { insumoOptions } from '../../../data/insumoLotes';

const ensureOption = (
  options: SelectOption[],
  val?: string | null
): SelectOption[] => {
  if (!val || !val.trim()) return options;
  if (options.some((o) => (typeof o === 'string' ? o === val : o.value === val))) {
    return options;
  }
  return [{ value: val, label: val }, ...options];
};

export interface PasteurizacionStageCommonProps {
  productName: string;
  defaultCultivoLote?: string;
  state: any;
  onChange: (updater: (prev: any) => any) => void;
  processTimer: ProcessTimerState;
  onStartProcessTimer: () => void;
  onNextStage: () => void;
  onOpenReviewModal?: () => void;
  showToast: (msg: string, type?: 'success' | 'info' | 'warning') => void;
  onSplitParentBatch?: (input: SplitMilkAllocationInput) => void;
  onExtractKumisChildBatch?: (litrosKumis: number) => void;
}

export const PasteurizacionStageCommon: React.FC<
  PasteurizacionStageCommonProps
> = ({
  productName,
  state,
  onChange,
  processTimer,
  onStartProcessTimer,
  onNextStage,
  showToast,
  onSplitParentBatch,
  onExtractKumisChildBatch,
}) => {
  const isKumis = productName.toLowerCase().includes('kumis');
  const isYogur =
    productName.toLowerCase().includes('yogur') &&
    !productName.toLowerCase().includes('griego');
  const azucarFijado = Boolean(state.azucarGuardado ?? state.azucarElegido);
  const isYogurConAzucar = isYogur && azucarFijado && state.llevaAzucar !== false;
  const targetCoolingTemp = isKumis ? 35.0 : 45.0;
  const targetCoolingTempStr = isKumis ? '35 °C' : '45 °C';
  const coolingStepTitle = isKumis
    ? '¡La base se enfrió a 35 °C!'
    : '¡La leche se enfrió a 45 °C!';

  // Estados para modal de extracción de base para Kumis (Punto de Quiebre)
  const [showModalExtraccion, setShowModalExtraccion] = useState<boolean>(false);
  const [litrosKumisInput, setLitrosKumisInput] = useState<string>('');
  const [errorExtraccion, setErrorExtraccion] = useState<string | null>(null);

  const prevExtraidosKumis = state.extraccionKumis?.litrosExtraidos || 0;
  const volumenTotalDisponible = state.litrosLeche + prevExtraidosKumis;

  const parsedLitrosKumis =
    litrosKumisInput === '' ? 0 : Number(litrosKumisInput);
  const esExtraccionValida =
    parsedLitrosKumis > 0 && parsedLitrosKumis <= volumenTotalDisponible;

  const handleOpenModalExtraccion = () => {
    setLitrosKumisInput(prevExtraidosKumis > 0 ? String(prevExtraidosKumis) : '');
    setErrorExtraccion(null);
    setShowModalExtraccion(true);
  };

  const handleConfirmarExtraccion = () => {
    if (!parsedLitrosKumis || parsedLitrosKumis <= 0) {
      setErrorExtraccion('La cantidad debe ser mayor a 0 litros.');
      return;
    }
    if (parsedLitrosKumis > volumenTotalDisponible) {
      setErrorExtraccion(
        `Los litros extraídos no pueden superar el volumen total disponible (${volumenTotalDisponible} L).`
      );
      return;
    }

    const litrosDesviados = parsedLitrosKumis;
    const nuevoVolumenYogur = Math.max(0, volumenTotalDisponible - litrosDesviados);
    const nuevoAzucarKg = Number(((nuevoVolumenYogur / 40) * 3.2).toFixed(2));
    const timeStr = getCurrentTimeString();

    if (onExtractKumisChildBatch) {
      onExtractKumisChildBatch(litrosDesviados);
    } else {
      onChange((prev: any) => ({
        ...prev,
        litrosLeche: nuevoVolumenYogur,
        extraccionKumis: {
          realizado: true,
          litrosExtraidos: litrosDesviados,
          hora: timeStr,
        },
        azucar: {
          ...prev.azucar,
          cantidadKg: prev.azucar?.esManual
            ? prev.azucar.cantidadKg
            : nuevoAzucarKg,
        },
      }));
      showToast(
        nuevoVolumenYogur === 0
          ? `✓ Desvío total de ${litrosDesviados} L para Kumis. El lote de Yogur queda en 0 L (Completado).`
          : `✓ Se extrajeron ${litrosDesviados} L para Kumis. El Yogur continúa con ${nuevoVolumenYogur} L.`,
        'success'
      );
    }

    setShowModalExtraccion(false);
    setLitrosKumisInput('');
    setErrorExtraccion(null);
  };

  // Fórmula de planta: 3.2 kg por cada 40 L de leche fresca (80 g / L)
  const azucarSugeridoKg =
    state.litrosLeche > 0
      ? Number(((state.litrosLeche / 40) * 3.2).toFixed(2))
      : 0;

  // Estados de edición manual para cada paso
  const [manualAzucar, setManualAzucar] = useState<boolean>(false);
  const [manualPaso2, setManualPaso2] = useState<boolean>(false);
  const [manualPaso3, setManualPaso3] = useState<boolean>(false);
  const [manualPaso4, setManualPaso4] = useState<boolean>(false);
  const [manualPaso5, setManualPaso5] = useState<boolean>(false);

  // Estados temporales de hora para PopoverTimePicker
  const [horaManualAzucar, setHoraManualAzucar] = useState<string>(
    state.azucar?.horaAdicion || getCurrentTimeString()
  );
  const [horaManualPaso2, setHoraManualPaso2] = useState<string>(
    state.calentamiento?.horaFin ||
      state.calentamiento?.horaLlegada85a90 ||
      getCurrentTimeString()
  );
  const [horaManualPaso3, setHoraManualPaso3] = useState<string>(
    state.sostenimiento?.horaFin || getCurrentTimeString()
  );
  const [horaManualPaso4, setHoraManualPaso4] = useState<string>(
    state.enfriamiento?.horaFinEnfriamiento || getCurrentTimeString()
  );
  const [horaManualPaso5, setHoraManualPaso5] = useState<string>(
    state.trasiego?.horaFin || getCurrentTimeString()
  );

  // Sincronizaciones automáticas cuando no se está en modo manual
  useEffect(() => {
    if (!manualAzucar) {
      setHoraManualAzucar(state.azucar?.horaAdicion || getCurrentTimeString());
    }
  }, [manualAzucar, state.azucar?.horaAdicion]);

  useEffect(() => {
    if (!manualPaso2) {
      setHoraManualPaso2(
        state.calentamiento?.horaFin ||
          state.calentamiento?.horaLlegada85a90 ||
          getCurrentTimeString()
      );
    }
  }, [
    manualPaso2,
    state.calentamiento?.horaFin,
    state.calentamiento?.horaLlegada85a90,
  ]);

  useEffect(() => {
    if (!manualPaso3) {
      setHoraManualPaso3(state.sostenimiento?.horaFin || getCurrentTimeString());
    }
  }, [manualPaso3, state.sostenimiento?.horaFin]);

  useEffect(() => {
    if (!manualPaso4) {
      setHoraManualPaso4(
        state.enfriamiento?.horaFinEnfriamiento || getCurrentTimeString()
      );
    }
  }, [manualPaso4, state.enfriamiento?.horaFinEnfriamiento]);

  useEffect(() => {
    if (!manualPaso5) {
      setHoraManualPaso5(state.trasiego?.horaFin || getCurrentTimeString());
    }
  }, [manualPaso5, state.trasiego?.horaFin]);

  // Cronómetros en vivo
  const calentamientoTimer = useStageCountdown({
    startTimestamp:
      state.calentamiento?.timestampInicio ||
      (state.calentamiento?.horaInicio
        ? timeStringToTimestampToday(state.calentamiento.horaInicio)
        : null),
    isRunning: Boolean(
      state.calentamiento?.iniciado && !state.calentamiento?.completado
    ),
    isCompleted: Boolean(state.calentamiento?.completado),
    completedDurationText: state.calentamiento?.tiempoCalentamiento,
  });

  const sostenimientoTimer = useStageCountdown({
    startTimestamp:
      state.sostenimiento?.timestampInicio ||
      (state.sostenimiento?.horaInicio
        ? timeStringToTimestampToday(state.sostenimiento.horaInicio)
        : null),
    isRunning: Boolean(
      state.sostenimiento?.iniciado && !state.sostenimiento?.completado
    ),
    isCompleted: Boolean(state.sostenimiento?.completado),
    targetSeconds: (state.sostenimiento?.duracionMinutos || 15) * 60,
    completedDurationText: state.sostenimiento?.duracionReal,
  });

  const timestampEnfriamientoEfectivo = useMemo(() => {
    if (state.enfriamiento?.timestampInicioEnfriamiento) {
      return state.enfriamiento.timestampInicioEnfriamiento;
    }
    const hora =
      state.enfriamiento?.horaInicio ||
      (state.enfriamiento as any)?.horaInicioEnfriamiento;
    if (hora) {
      return timeStringToTimestampToday(hora);
    }
    return null;
  }, [
    state.enfriamiento?.timestampInicioEnfriamiento,
    state.enfriamiento?.horaInicio,
    (state.enfriamiento as any)?.horaInicioEnfriamiento,
  ]);

  const enfriamientoTimer = useStageCountdown({
    startTimestamp: timestampEnfriamientoEfectivo,
    isRunning: Boolean(
      state.enfriamiento?.enfriamientoIniciado &&
        !state.enfriamiento?.enfriamientoCompletado
    ),
    isCompleted: Boolean(state.enfriamiento?.enfriamientoCompletado),
    completedDurationText: state.enfriamiento?.tiempoEnfriamiento,
  });

  const trasiegoTimer = useStageCountdown({
    startTimestamp:
      state.trasiego?.timestampInicio ||
      (state.trasiego?.horaInicio
        ? timeStringToTimestampToday(state.trasiego.horaInicio)
        : null),
    isRunning: Boolean(state.trasiego?.iniciado && !state.trasiego?.completado),
    isCompleted: Boolean(state.trasiego?.completado),
    completedDurationText: state.trasiego?.tiempoTrasiego,
  });

  // Referencia y auto-scroll a Paso 4 (Enfriamiento a 35 °C) para Kumis
  const paso4Ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (
      isKumis &&
      state.sostenimiento?.completado &&
      !state.enfriamiento?.enfriamientoCompletado
    ) {
      const timer = setTimeout(() => {
        paso4Ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [
    isKumis,
    state.sostenimiento?.completado,
    state.enfriamiento?.enfriamientoCompletado,
  ]);

  // Duraciones recalculadas en tiempo real para modo manual
  const duracionCalentamientoRecalculada = useMemo(() => {
    if (!state.calentamiento?.horaInicio || !horaManualPaso2) {
      return state.calentamiento?.tiempoCalentamiento || '0 s';
    }
    return computeDurationBetweenTimes(
      state.calentamiento.horaInicio,
      horaManualPaso2
    ).human;
  }, [
    state.calentamiento?.horaInicio,
    horaManualPaso2,
    state.calentamiento?.tiempoCalentamiento,
  ]);

  const duracionRetencionRecalculada = useMemo(() => {
    const inicio =
      state.sostenimiento?.horaInicio || state.calentamiento?.horaFin;
    if (!inicio || !horaManualPaso3) {
      return state.sostenimiento?.duracionReal || '0 s';
    }
    return computeDurationBetweenTimes(inicio, horaManualPaso3).human;
  }, [
    state.sostenimiento?.horaInicio,
    state.calentamiento?.horaFin,
    horaManualPaso3,
    state.sostenimiento?.duracionReal,
  ]);

  const duracionEnfriamientoRecalculada = useMemo(() => {
    const inicio =
      state.enfriamiento?.horaInicio || state.sostenimiento?.horaFin;
    if (!inicio || !horaManualPaso4) {
      return state.enfriamiento?.tiempoEnfriamiento || '0 s';
    }
    return computeDurationBetweenTimes(inicio, horaManualPaso4).human;
  }, [
    state.enfriamiento?.horaInicio,
    state.sostenimiento?.horaFin,
    horaManualPaso4,
    state.enfriamiento?.tiempoEnfriamiento,
  ]);

  const duracionTrasiegoRecalculada = useMemo(() => {
    const inicio =
      state.trasiego?.horaInicio || state.enfriamiento?.horaFinEnfriamiento;
    if (!inicio || !horaManualPaso5) {
      return state.trasiego?.tiempoTrasiego || '0 s';
    }
    return computeDurationBetweenTimes(inicio, horaManualPaso5).human;
  }, [
    state.trasiego?.horaInicio,
    state.enfriamiento?.horaFinEnfriamiento,
    horaManualPaso5,
    state.trasiego?.tiempoTrasiego,
  ]);

  // =========================================================================
  // HANDLERS
  // =========================================================================

  // Paso 1: Iniciar calentamiento
  const handleStartCalentamiento = () => {
    const faltantes: string[] = [];
    if (!state.loteLeche) faltantes.push('lote de leche fresca');
    if (!state.loteCultivoLacticoPastur) faltantes.push('lote de cultivo láctico');
    if (isYogur && !azucarFijado) faltantes.push('si lleva azúcar (Sí o No)');
    if (faltantes.length > 0) {
      showToast(`Antes de iniciar selecciona: ${faltantes.join(', ')}.`, 'warning');
      return;
    }
    const timeStr = getCurrentTimeString();
    const now = Date.now();

    if (!processTimer.isRunning) {
      onStartProcessTimer();
    }

    onChange((prev: any) => ({
      ...prev,
      calentamiento: {
        ...prev.calentamiento,
        iniciado: true,
        completado: false,
        horaInicio: timeStr,
        timestampInicio: now,
      },
    }));

    showToast(
      `⏱ Calentamiento iniciado a las ${timeStr}. Cronómetro general del lote en marcha.`,
      'info'
    );
  };

  // Paso Condicional: Azúcar a 60 °C
  const handleConfirmAzucar = () => {
    const timeStr = getCurrentTimeString();
    const cantidadFinal = state.azucar?.esManual
      ? state.azucar.cantidadKg
      : azucarSugeridoKg;

    onChange((prev: any) => ({
      ...prev,
      loteAzucarPastur: prev.azucar?.loteAzucar || prev.loteAzucarPastur,
      azucar: {
        ...prev.azucar,
        adicionado: true,
        horaAdicion: timeStr,
        cantidadKg: cantidadFinal,
      },
    }));

    showToast(
      `✓ Azúcar agregada (${cantidadFinal} kg) a las ${timeStr}.`,
      'success'
    );
  };

  const handleSaveManualAzucar = () => {
    const timeStr = formatTimeFromStep1(horaManualAzucar);
    onChange((prev: any) => ({
      ...prev,
      azucar: {
        ...prev.azucar,
        adicionado: true,
        horaAdicion: timeStr,
      },
    }));
    setManualAzucar(false);
    showToast(
      `✓ Hora de adición de azúcar actualizada a las ${timeStr}.`,
      'success'
    );
  };

  // Paso 2: Llegó a 85 - 90 °C
  const handleLlego85a90 = () => {
    const timeStr = getCurrentTimeString();
    const now = Date.now();
    const durCalStr = state.calentamiento?.horaInicio
      ? computeDurationBetweenTimes(state.calentamiento.horaInicio, timeStr).human
      : formatHumanDuration(
          Math.max(
            1,
            Math.floor((now - (state.calentamiento?.timestampInicio || now)) / 1000)
          )
        );

    onChange((prev: any) => ({
      ...prev,
      calentamiento: {
        ...prev.calentamiento,
        completado: true,
        horaFin: timeStr,
        horaLlegada85a90: timeStr,
        tiempoCalentamiento: durCalStr,
        llego85a90: true,
      },
      sostenimiento: {
        ...prev.sostenimiento,
        iniciado: true,
        completado: false,
        horaInicio: timeStr,
        timestampInicio: now,
        duracionMinutos: 15,
      },
    }));

    setHoraManualPaso2(timeStr);
    showToast(
      `✓ La leche llegó a 85–90 °C a las ${timeStr} (${durCalStr}). Inicia retención de 15 min.`,
      'success'
    );
  };

  const handleSaveManualPaso2 = () => {
    const timeStr = formatTimeFromStep1(horaManualPaso2);
    const durCalStr = state.calentamiento?.horaInicio
      ? computeDurationBetweenTimes(state.calentamiento.horaInicio, timeStr).human
      : state.calentamiento?.tiempoCalentamiento || '0 s';
    const newTimestampSostenimiento = timeStringToTimestampToday(timeStr);

    onChange((prev: any) => {
      const nuevoSostenimiento = {
        ...prev.sostenimiento,
        horaInicio: timeStr,
        timestampInicio: newTimestampSostenimiento,
      };
      if (prev.sostenimiento?.completado && prev.sostenimiento?.horaFin) {
        nuevoSostenimiento.duracionReal = computeDurationBetweenTimes(
          timeStr,
          prev.sostenimiento.horaFin
        ).human;
      }
      return {
        ...prev,
        calentamiento: {
          ...prev.calentamiento,
          completado: true,
          horaFin: timeStr,
          horaLlegada85a90: timeStr,
          tiempoCalentamiento: durCalStr,
          llego85a90: true,
          esManual: true,
        },
        sostenimiento: nuevoSostenimiento,
      };
    });

    setManualPaso2(false);
    showToast(
      `✓ Hora de llegada a 85–90 °C actualizada a las ${timeStr} (${durCalStr}). Sincronizado.`,
      'success'
    );
  };

  // Paso 3: Fin de Retención (Min. 15 min) -> Arranca Enfriamiento inmediatamente (choque térmico sin pausas)
  const handleTerminarRetencion = () => {
    const timeStr = getCurrentTimeString();
    const now = Date.now();
    const startSost =
      state.sostenimiento?.horaInicio || state.calentamiento?.horaFin;
    const durSostStr = startSost
      ? computeDurationBetweenTimes(startSost, timeStr).human
      : formatHumanDuration(
          Math.max(
            1,
            Math.floor((now - (state.sostenimiento?.timestampInicio || now)) / 1000)
          )
        );

    onChange((prev: any) => ({
      ...prev,
      sostenimiento: {
        ...prev.sostenimiento,
        completado: true,
        horaFin: timeStr,
        duracionReal: durSostStr,
      },
      enfriamiento: {
        ...prev.enfriamiento,
        enfriamientoIniciado: true,
        enfriamientoCompletado: false,
        horaInicio: timeStr,
        timestampInicioEnfriamiento: now,
      },
    }));

    setHoraManualPaso3(timeStr);
    showToast(
      `✓ Retención completada a las ${timeStr} (${durSostStr}). Choque térmico iniciado: enfriando a ${targetCoolingTempStr}.`,
      'success'
    );
  };

  const handleSaveManualPaso3 = () => {
    const timeStr = formatTimeFromStep1(horaManualPaso3);
    const startSost =
      state.sostenimiento?.horaInicio || state.calentamiento?.horaFin;
    const durSostStr = startSost
      ? computeDurationBetweenTimes(startSost, timeStr).human
      : state.sostenimiento?.duracionReal || '0 s';
    const newTimestampEnfriamiento = timeStringToTimestampToday(timeStr);

    onChange((prev: any) => {
      const nuevoEnfriamiento = {
        ...prev.enfriamiento,
        horaInicio: timeStr,
        timestampInicioEnfriamiento: newTimestampEnfriamiento,
      };
      if (
        prev.enfriamiento?.enfriamientoCompletado &&
        prev.enfriamiento?.horaFinEnfriamiento
      ) {
        nuevoEnfriamiento.tiempoEnfriamiento = computeDurationBetweenTimes(
          timeStr,
          prev.enfriamiento.horaFinEnfriamiento
        ).human;
      }
      return {
        ...prev,
        sostenimiento: {
          ...prev.sostenimiento,
          completado: true,
          horaFin: timeStr,
          duracionReal: durSostStr,
        },
        enfriamiento: nuevoEnfriamiento,
      };
    });

    setManualPaso3(false);
    showToast(
      `✓ Fin de retención actualizado a las ${timeStr} (${durSostStr}). Sincronizado.`,
      'success'
    );
  };

  // Paso 4: Enfriamiento (45 °C para Yogur, 35 °C para Kumis)
  const handleLlego45 = () => {
    const timeStr = getCurrentTimeString();
    const now = Date.now();
    const startEnf =
      state.enfriamiento?.horaInicio || state.sostenimiento?.horaFin;
    const durEnfStr = startEnf
      ? computeDurationBetweenTimes(startEnf, timeStr).human
      : formatHumanDuration(
          Math.max(
            1,
            Math.floor(
              (now -
                (state.enfriamiento?.timestampInicioEnfriamiento || now)) /
                1000
            )
          )
        );

    onChange((prev: any) => ({
      ...prev,
      enfriamiento: {
        ...prev.enfriamiento,
        enfriamientoCompletado: true,
        horaFinEnfriamiento: timeStr,
        tiempoEnfriamiento: durEnfStr,
        temperaturaFinal: targetCoolingTemp,
      },
      trasiego: {
        ...prev.trasiego,
        iniciado: true,
        completado: false,
        horaInicio: timeStr,
        timestampInicio: now,
      },
    }));

    setHoraManualPaso4(timeStr);
    showToast(
      isKumis
        ? `✓ Base enfriada a 35 °C a las ${timeStr} (${durEnfStr}). Inicia traslado a cantinas.`
        : `✓ Leche enfriada a 45 °C a las ${timeStr} (${durEnfStr}). Inicia traslado a cantinas.`,
      'success'
    );
  };

  const handleSaveManualPaso4 = () => {
    const timeStr = formatTimeFromStep1(horaManualPaso4);
    const startEnf =
      state.enfriamiento?.horaInicio || state.sostenimiento?.horaFin;
    const durEnfStr = startEnf
      ? computeDurationBetweenTimes(startEnf, timeStr).human
      : state.enfriamiento?.tiempoEnfriamiento || '0 s';
    const newTimestampTrasiego = timeStringToTimestampToday(timeStr);

    onChange((prev: any) => {
      const nuevoTrasiego = {
        ...prev.trasiego,
        horaInicio: timeStr,
        timestampInicio: newTimestampTrasiego,
      };
      if (prev.trasiego?.completado && prev.trasiego?.horaFin) {
        nuevoTrasiego.tiempoTrasiego = computeDurationBetweenTimes(
          timeStr,
          prev.trasiego.horaFin
        ).human;
      }
      return {
        ...prev,
        enfriamiento: {
          ...prev.enfriamiento,
          enfriamientoCompletado: true,
          horaFinEnfriamiento: timeStr,
          tiempoEnfriamiento: durEnfStr,
          temperaturaFinal: targetCoolingTemp,
          esManual: true,
        },
        trasiego: nuevoTrasiego,
      };
    });

    setManualPaso4(false);
    showToast(
      `✓ Hora de enfriamiento a ${targetCoolingTempStr} actualizada a las ${timeStr} (${durEnfStr}). Sincronizado.`,
      'success'
    );
  };

  // Paso 5: Traslado a cantinas
  const handleYaTrasegue = () => {
    const timeStr = getCurrentTimeString();
    const now = Date.now();
    const startTras =
      state.trasiego?.horaInicio || state.enfriamiento?.horaFinEnfriamiento;
    const durTrasStr = startTras
      ? computeDurationBetweenTimes(startTras, timeStr).human
      : formatHumanDuration(
          Math.max(
            1,
            Math.floor((now - (state.trasiego?.timestampInicio || now)) / 1000)
          )
        );

    onChange((prev: any) => ({
      ...prev,
      trasiego: {
        ...prev.trasiego,
        completado: true,
        horaFin: timeStr,
        tiempoTrasiego: durTrasStr,
      },
    }));

    setHoraManualPaso5(timeStr);
    showToast(
      `✓ Leche trasladada a cantinas a las ${timeStr} (${durTrasStr}). Pasteurización finalizada.`,
      'success'
    );
  };

  const handleSaveManualPaso5 = () => {
    const timeStr = formatTimeFromStep1(horaManualPaso5);
    const startTras =
      state.trasiego?.horaInicio || state.enfriamiento?.horaFinEnfriamiento;
    const durTrasStr = startTras
      ? computeDurationBetweenTimes(startTras, timeStr).human
      : state.trasiego?.tiempoTrasiego || '0 s';

    onChange((prev: any) => ({
      ...prev,
      trasiego: {
        ...prev.trasiego,
        completado: true,
        horaFin: timeStr,
        tiempoTrasiego: durTrasStr,
      },
    }));

    setManualPaso5(false);
    showToast(
      `✓ Hora de traslado actualizada a las ${timeStr} (${durTrasStr}).`,
      'success'
    );
  };

  const isCompletedStage = Boolean(state.trasiego?.completado);

  return (
    <div className="flex flex-col w-full p-4 lg:p-6 gap-6 bg-[#FFFFFF] min-h-[calc(100vh-4rem)] pb-12">
      <StageHeader
        stageNumber={1}
        totalStages={isKumis ? 3 : 4}
        title={`Pasteurización (${productName})`}
        subtitle={
          isKumis
            ? 'Control térmico inquebrantable: Calentamiento a 85–90 °C, retención de 15 min, enfriamiento a 35 °C y traslado a cantinas.'
            : 'Control térmico inquebrantable: Calentamiento a 85–90 °C, retención de 15 min, enfriamiento a 45 °C y traslado a cantinas.'
        }
        productName={productName}
        icon="local_fire_department"
        isCompleted={isCompletedStage}
        startTime={state.calentamiento?.horaInicio || undefined}
        endTime={state.trasiego?.horaFin || undefined}
        rightContent={
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="px-3.5 py-2 rounded-xl bg-blue-50 border border-blue-200 flex items-center gap-2.5 min-h-[48px]">
              <span className="material-symbols-outlined text-blue-700 text-[22px]">
                water_drop
              </span>
              <div>
                <div className="text-[10px] font-bold uppercase text-blue-800">
                  LECHE EN TANQUE
                </div>
                <div className="text-xs font-black font-mono text-blue-950">
                  {state.litrosLeche || 0} L
                </div>
              </div>
            </div>

            <div className="px-3.5 py-2 rounded-xl bg-amber-50 border border-amber-200 flex items-center gap-2.5 min-h-[48px]">
              <span className="material-symbols-outlined text-amber-700 text-[22px]">
                cookie
              </span>
              <div>
                <div className="text-[10px] font-bold uppercase text-amber-800">
                  FORMULACIÓN
                </div>
                <div className="text-xs font-black font-mono text-amber-950">
                  {state.llevaAzucar ? 'Con Azúcar' : 'Sin Azúcar'}
                </div>
              </div>
            </div>
          </div>
        }
      />

      {/* =========================================================================
          1. INSUMOS INICIALES
      ========================================================================= */}
      <Card
        title="Insumos Iniciales de Pasteurización"
        subtitle="Registra los litros de leche fresca, los lotes de materia prima y selecciona si este lote lleva azúcar."
        icon="inventory_2"
        badge={
          isKumis
            ? `✓ Base Kumis: ${state.litrosLeche} L (Azúcar: ${state.azucar?.cantidadKg || 0} kg)`
            : state.llevaAzucar
            ? 'Formulación: Con Azúcar (3.2 kg / 40 L)'
            : 'Formulación: Sin Azúcar (Natural)'
        }
        variant={isKumis ? 'success' : 'default'}
      >
        <div className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Litros de leche fresca */}
            <InputField
              label="Litros de Leche Fresca"
              type="number"
              inputMode="numeric"
              min="0"
              step="1"
              unit="L"
              icon="water_drop"
              placeholder="Ej: 100"
              showZero={false}
              value={state.litrosLeche > 0 ? state.litrosLeche : ''}
              onChange={(e) => {
                const val = Math.max(0, parseInt(e.target.value, 10) || 0);
                const nuevoAzucarKg = Number(((val / 40) * 3.2).toFixed(2));
                onChange((prev: any) => ({
                  ...prev,
                  litrosLeche: val,
                  azucar: {
                    ...prev.azucar,
                    cantidadKg: prev.azucar?.esManual
                      ? prev.azucar.cantidadKg
                      : nuevoAzucarKg,
                  },
                }));
              }}
            />

            {/* Lote de leche fresca */}
            <SelectField
              label="Lote de Leche Fresca"
              icon="local_shipping"
              options={ensureOption(insumoOptions('leche_fresca'), state.loteLeche)}
              value={state.loteLeche || ''}
              onChange={(e) => {
                const val = e.target.value;
                onChange((prev: any) => ({ ...prev, loteLeche: val }));
              }}
            />

            {/* Lote de Cultivo Láctico */}
            <SelectField
              label="Lote de Cultivo Láctico"
              icon="biotech"
              options={ensureOption(
                insumoOptions('cultivo'),
                state.loteCultivoLacticoPastur
              )}
              value={state.loteCultivoLacticoPastur || ''}
              onChange={(e) => {
                const val = e.target.value;
                onChange((prev: any) => ({
                  ...prev,
                  loteCultivoLacticoPastur: val,
                  loteCultivoLactico: val,
                }));
              }}
            />
          </div>

          {/* Selector condicional: ¿Lleva azúcar? */}
          <div className="p-4 rounded-2xl bg-[#FFFFFF] border border-[#D6DEEA] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h4 className="text-sm font-extrabold text-gray-900">
                ¿Este lote de leche se pasteuriza con azúcar?
              </h4>
              <p className="text-xs text-gray-600 mt-0.5">
                Fórmula de planta:{' '}
                <strong>3.2 kg de azúcar por cada 40 L de leche fresca</strong>{' '}
                (Para {state.litrosLeche || 0} L corresponden{' '}
                <strong className="text-amber-900 font-mono">
                  {azucarSugeridoKg} kg
                </strong>
                ).
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              <Button
                variant={azucarFijado && state.llevaAzucar ? 'success' : 'outline'}
                size="md"
                icon="check"
                disabled={Boolean(azucarFijado)}
                onClick={() =>
                  onChange((prev: any) => ({ ...prev, llevaAzucar: true, azucarElegido: true, azucarGuardado: true }))
                }
              >
                Sí, con azúcar
              </Button>
              <Button
                variant={azucarFijado && !state.llevaAzucar ? 'success' : 'outline'}
                size="md"
                icon="close"
                disabled={Boolean(azucarFijado)}
                onClick={() =>
                  onChange((prev: any) => ({ ...prev, llevaAzucar: false, azucarElegido: true, azucarGuardado: true }))
                }
              >
                No (Sin azúcar)
              </Button>
              {azucarFijado && (
                <Button
                  variant="outline"
                  size="md"
                  icon="edit"
                  onClick={() => {
                    if (state.extraccionKumis?.realizado || state.extraccionGriego?.realizado) {
                      showToast('Ya se derivó leche a otro producto; no se puede cambiar la opción de azúcar.', 'warning');
                      return;
                    }
                    onChange((prev: any) => ({ ...prev, azucarGuardado: false }));
                  }}
                >
                  Editar
                </Button>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* =========================================================================
          2. PASO 1: CALENTAMIENTO DE LA LECHE (CRONÓMETRO GENERAL DEL LOTE)
      ========================================================================= */}
      <Card
        title="Calentando la leche (Objetivo: 85 - 90 °C)"
        subtitle="Prende la caldera o tina. Este paso marca el arranque del cronómetro general del lote."
        icon="local_fire_department"
        badge={
          state.calentamiento?.completado
            ? `✓ Calentamiento: ${
                state.calentamiento?.tiempoCalentamiento ||
                (isKumis ? '45 min (Heredado)' : 'Finalizado')
              }`
            : state.calentamiento?.iniciado
            ? 'En calentamiento...'
            : 'Pendiente inicio'
        }
        variant={
          state.calentamiento?.completado
            ? 'success'
            : state.calentamiento?.iniciado
            ? 'warning'
            : 'default'
        }
      >
        <div className="space-y-4">
          {!state.calentamiento?.iniciado ? (
            <div className="p-6 rounded-2xl bg-amber-50/60 border border-amber-200 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <h4 className="text-base font-extrabold text-gray-900">
                  Listo para iniciar el calentamiento
                </h4>
                <p className="text-xs text-gray-600 mt-0.5">
                  Al pulsar el botón se inicia el cronómetro general del lote y
                  el reloj de calentamiento hacia 85–90 °C.
                </p>
              </div>
              <Button
                variant="primary"
                size="xl"
                icon="local_fire_department"
                onClick={handleStartCalentamiento}
              >
                Iniciar Calentamiento de la Leche
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-white border border-[#D6DEEA] flex flex-col justify-between">
                <span className="text-[10px] uppercase font-bold text-gray-500">
                  TEMPERATURA OBJETIVO
                </span>
                <span className="text-2xl font-black font-mono text-gray-900 mt-1">
                  85.0 – 90.0 °C
                </span>
                <span className="text-[11px] text-gray-500">
                  Rango de pasteurización reglamentario
                </span>
              </div>

              <div className="p-4 rounded-xl bg-white border border-[#D6DEEA] flex flex-col justify-between">
                <span className="text-[10px] uppercase font-bold text-gray-500">
                  HORA DE INICIO
                </span>
                <span className="text-2xl font-black font-mono text-amber-900 mt-1">
                  {state.calentamiento?.horaInicio || '--:--:--'}
                </span>
                <span className="text-[11px] text-gray-500">
                  Arranque del cronómetro general
                </span>
              </div>

              <div className="p-4 rounded-xl bg-amber-50 border border-amber-300 flex flex-col justify-between">
                <span className="text-[10px] uppercase font-bold text-amber-800">
                  CRONÓMETRO DE CALENTAMIENTO
                </span>
                <span className="text-2xl font-black font-mono text-amber-950 mt-1">
                  {state.calentamiento?.completado
                    ? state.calentamiento?.tiempoCalentamiento || 'Completado'
                    : calentamientoTimer.humanElapsed}
                </span>
                <span className="text-[11px] text-amber-800 font-medium">
                  {state.calentamiento?.completado
                    ? 'Duración registrada en Paso 2'
                    : 'Corriendo en vivo hacia 85–90 °C...'}
                </span>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* =========================================================================
          3. PASO CONDICIONAL: ADICIÓN DE AZÚCAR A LOS 60 °C (SOLO SI LLEVA AZÚCAR)
      ========================================================================= */}
      {state.llevaAzucar && (
        <Card
          title="¡Agregué el azúcar a los 60 °C!"
          subtitle="Cuando la leche alcance los 60 °C durante el calentamiento, agrega el azúcar pesada y disuélvela."
          icon="cookie"
          badge={
            state.azucar?.adicionado
              ? `✓ Agregada a las ${state.azucar?.horaAdicion}${
                  isKumis ? ' (Heredado)' : ''
                }`
              : 'Pendiente a los 60 °C'
          }
          variant={state.azucar?.adicionado ? 'success' : 'default'}
          headerRight={
            state.azucar?.adicionado ? (
              <ManualEditToggle manual={Boolean(manualAzucar)} onChange={(checked: boolean) => setManualAzucar(checked)} />
            ) : undefined
          }
        >
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Cantidad de azúcar */}
              <InputField
                label="Cantidad de Azúcar (kg)"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.1"
                unit="kg"
                placeholder={`Sugerido: ${azucarSugeridoKg} kg`}
                showZero={false}
                value={
                  state.azucar?.cantidadKg > 0 ? state.azucar.cantidadKg : ''
                }
                onChange={(e) => {
                  const val = Math.max(0, parseFloat(e.target.value) || 0);
                  onChange((prev: any) => ({
                    ...prev,
                    azucar: {
                      ...prev.azucar,
                      cantidadKg: val,
                      esManual: true,
                    },
                  }));
                }}
              />

              {/* Lote del azúcar */}
              <SelectField
                label="Lote de Azúcar"
                icon="qr_code"
                options={ensureOption(
                  insumoOptions('azucar'),
                  state.azucar?.loteAzucar || state.loteAzucarPastur
                )}
                value={state.azucar?.loteAzucar || state.loteAzucarPastur || ''}
                onChange={(e) => {
                  const val = e.target.value;
                  onChange((prev: any) => ({
                    ...prev,
                    loteAzucarPastur: val,
                    azucar: { ...prev.azucar, loteAzucar: val },
                  }));
                }}
              />
            </div>

            {/* Acciones / Edición manual */}
            {!manualAzucar ? (
              !state.azucar?.adicionado ? (
                <div className="pt-2">
                  <Button
                    variant="warning"
                    size="lg"
                    icon="verified"
                    onClick={handleConfirmAzucar}
                    disabled={!state.calentamiento?.iniciado}
                  >
                    ¡Agregué el azúcar a los 60 °C!
                  </Button>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-300 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-emerald-700 text-[20px]">
                      check_circle
                    </span>
                    <span className="font-bold text-emerald-950">
                      Azúcar agregada: {state.azucar?.cantidadKg} kg a las{' '}
                      {state.azucar?.horaAdicion} (Lote: {state.azucar?.loteAzucar})
                    </span>
                  </div>
                  <Badge variant="success" size="sm">
                    Registrado
                  </Badge>
                </div>
              )
            ) : (
              <div className="p-4 rounded-xl bg-amber-50/90 border-2 border-amber-300 flex flex-col gap-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
                  <PopoverTimePicker
                    label="Hora de Adición de Azúcar"
                    icon="schedule"
                    hint="Toca para desplegar el selector flotante (hh:mm:ss)"
                    value={horaManualAzucar}
                    onChange={setHoraManualAzucar}
                  />

                  <div className="p-3 rounded-xl bg-white border border-[#D6DEEA] flex flex-col justify-between">
                    <span className="text-[10px] font-bold uppercase text-gray-500">
                      CANTIDAD REGISTRADA
                    </span>
                    <span className="text-xl font-mono font-black text-amber-900 mt-1">
                      {state.azucar?.cantidadKg || azucarSugeridoKg} kg
                    </span>
                    <span className="text-[10px] text-gray-500">
                      Lote: {state.azucar?.loteAzucar || 'Sin registrar'}
                    </span>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <Button
                    variant="primary"
                    size="md"
                    icon="save"
                    onClick={handleSaveManualAzucar}
                  >
                    Guardar Hora de Azúcar
                  </Button>
                </div>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* =========================================================================
          4. PASO 2: LLEGADA A TEMPERATURA OBJETIVO (85 - 90 °C)
      ========================================================================= */}
      <Card
        title="¡La leche llegó a 85 - 90 °C!"
        subtitle="Al confirmar, detiene el calentamiento, calcula la duración (solo lectura) e inicia la retención."
        icon="thermostat"
        badge={
          state.calentamiento?.completado
            ? `✓ Llegó a las ${
                state.calentamiento?.horaFin ||
                state.calentamiento?.horaLlegada85a90 ||
                '--'
              }${isKumis ? ' (Heredado)' : ''}`
            : 'En espera de 85–90 °C'
        }
        variant={state.calentamiento?.completado ? 'success' : 'default'}
        headerRight={
          state.calentamiento?.completado ? (
            <ManualEditToggle manual={Boolean(manualPaso2)} onChange={(checked: boolean) => setManualPaso2(checked)} />
          ) : undefined
        }
      >
        <div className="space-y-4">
          {!manualPaso2 ? (
            !state.calentamiento?.completado ? (
              <div className="p-6 rounded-2xl bg-[#FFFFFF] border border-[#D6DEEA] flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <h4 className="text-base font-extrabold text-gray-900">
                    Confirmación de Temperatura de Pasteurización
                  </h4>
                  <p className="text-xs text-gray-600 mt-0.5">
                    Al confirmar se detendrá el cronómetro del Paso 1 e iniciará
                    inmediatamente la retención de 15 minutos.
                  </p>
                </div>
                <Button
                  variant="success"
                  size="xl"
                  icon="thermostat"
                  onClick={handleLlego85a90}
                  disabled={!state.calentamiento?.iniciado}
                >
                  ¡La leche llegó a 85 - 90 °C!
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-white border border-[#D6DEEA]">
                  <span className="text-[10px] uppercase font-bold text-gray-500 block">
                    HORA DE INICIO
                  </span>
                  <span className="text-xl font-mono font-black text-gray-900 mt-1 block">
                    {state.calentamiento?.horaInicio}
                  </span>
                </div>

                <div className="p-4 rounded-xl bg-white border border-[#D6DEEA]">
                  <span className="text-[10px] uppercase font-bold text-gray-500 block">
                    HORA DE LLEGADA (85–90 °C)
                  </span>
                  <span className="text-xl font-mono font-black text-emerald-900 mt-1 block">
                    {state.calentamiento?.horaFin ||
                      state.calentamiento?.horaLlegada85a90}
                  </span>
                </div>

                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-300">
                  <span className="text-[10px] uppercase font-bold text-emerald-800 block">
                    TIEMPO DE CALENTAMIENTO (SOLO LECTURA)
                  </span>
                  <span className="text-xl font-mono font-black text-emerald-950 mt-1 block">
                    {state.calentamiento?.tiempoCalentamiento}
                  </span>
                </div>
              </div>
            )
          ) : (
            <div className="p-4 rounded-xl bg-amber-50/90 border-2 border-amber-300 flex flex-col gap-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
                <PopoverTimePicker
                  label="Hora de Llegada a 85–90 °C"
                  icon="schedule"
                  hint="Toca para desplegar el selector flotante (hh:mm:ss)"
                  value={horaManualPaso2}
                  onChange={setHoraManualPaso2}
                />

                <InputField
                  label="Tiempo de Calentamiento (Solo Lectura)"
                  icon="timer"
                  type="text"
                  disabled
                  readOnly
                  placeholder="Se calcula automáticamente"
                  hint={`Calculado: ${state.calentamiento?.horaInicio} → ${horaManualPaso2}`}
                  value={duracionCalentamientoRecalculada}
                />
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  variant="primary"
                  size="md"
                  icon="save"
                  onClick={handleSaveManualPaso2}
                >
                  Guardar Hora de Llegada
                </Button>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* =========================================================================
          5. PASO 3: RETENCIÓN DE TEMPERATURA (MIN. 15 MIN)
      ========================================================================= */}
      <Card
        title="Terminó el tiempo de retención (Min. 15 min)"
        subtitle="El cronómetro de retención arranca tras el Paso 2. Al confirmar, bloquea la duración e inicia enfriamiento."
        icon="timer"
        badge={
          state.sostenimiento?.completado
            ? `✓ Retención: ${
                state.sostenimiento?.duracionReal || '15 min'
              }${isKumis ? ' (Heredado)' : ''}`
            : state.sostenimiento?.iniciado
            ? 'Retención en curso (Min. 15 min)'
            : 'En espera del Paso 2'
        }
        variant={
          state.sostenimiento?.completado
            ? 'success'
            : state.sostenimiento?.iniciado
            ? 'warning'
            : 'locked'
        }
        headerRight={
          state.sostenimiento?.completado ? (
            <ManualEditToggle manual={Boolean(manualPaso3)} onChange={(checked: boolean) => setManualPaso3(checked)} />
          ) : undefined
        }
      >
        <div className="space-y-4">
          <TimerBanner
            title="Retención Térmica a 85–90 °C"
            subtitle={
              isKumis
                ? 'Garantiza la pasteurización completa de la base antes de enfriar a 35 °C.'
                : 'Garantiza la pasteurización completa de la leche antes de enfriar a 45 °C.'
            }
            elapsedSeconds={
              state.sostenimiento?.completado
                ? 900
                : sostenimientoTimer.elapsedSeconds
            }
            targetSeconds={900}
            isRunning={Boolean(
              state.sostenimiento?.iniciado && !state.sostenimiento?.completado
            )}
            isCompleted={Boolean(state.sostenimiento?.completado)}
          />

          {!manualPaso3 ? (
            !state.sostenimiento?.completado ? (
              <div className="space-y-3 pt-2">
                <Button
                  variant="primary"
                  size="xl"
                  icon="timer"
                  onClick={handleTerminarRetencion}
                  disabled={!state.sostenimiento?.iniciado}
                >
                  Terminó el tiempo de retención (Min. 15 min)
                </Button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 rounded-xl bg-white border border-[#D6DEEA]">
                    <span className="text-[10px] uppercase font-bold text-gray-500 block">
                      INICIO DE RETENCIÓN
                    </span>
                    <span className="text-xl font-mono font-black text-gray-900 mt-1 block">
                      {state.sostenimiento?.horaInicio}
                    </span>
                  </div>

                  <div className="p-4 rounded-xl bg-white border border-[#D6DEEA]">
                    <span className="text-[10px] uppercase font-bold text-gray-500 block">
                      FIN DE RETENCIÓN
                    </span>
                    <span className="text-xl font-mono font-black text-emerald-900 mt-1 block">
                      {state.sostenimiento?.horaFin}
                    </span>
                  </div>

                  <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-300">
                    <span className="text-[10px] uppercase font-bold text-emerald-800 block">
                      DURACIÓN REAL DE RETENCIÓN (SOLO LECTURA)
                    </span>
                    <span className="text-xl font-mono font-black text-emerald-950 mt-1 block">
                      {state.sostenimiento?.duracionReal}
                    </span>
                  </div>
                </div>

                {/* PUNTO DE INTERCEPCIÓN (EL QUIEBRE): ¿EXTRAER BASE PARA KUMIS? */}
                {isYogurConAzucar && state.sostenimiento?.completado && (
                  <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-purple-50 via-indigo-50/50 to-amber-50/60 border-2 border-purple-200/90 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 mt-3">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-purple-700 text-white flex items-center justify-center shrink-0 shadow-md shadow-purple-700/20">
                        <span className="material-symbols-outlined text-[24px]">
                          call_split
                        </span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-black text-purple-950">
                            Punto de Quiebre: ¿Deseas extraer base para Kumis?
                          </h4>
                          <Badge variant="default" className="bg-purple-100 text-purple-800 border-purple-200" size="sm">
                            {state.extraccionKumis?.realizado
                              ? 'Extraído'
                              : 'Opcional'}
                          </Badge>
                        </div>
                        <p className="text-xs text-purple-900/80 mt-0.5">
                          {state.extraccionKumis?.realizado
                            ? `✓ Base para Kumis extraída: ${state.extraccionKumis.litrosExtraidos} L a las ${state.extraccionKumis.hora}. Lote de Yogur actual: ${state.litrosLeche} L.`
                            : 'La leche está pasteurizada a 85–90 °C con azúcar. Puedes desviar una porción para el Lote Hijo de Kumis antes de iniciar el enfriamiento.'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2.5 shrink-0">
                      <Button
                        variant="primary"
                        size="md"
                        icon="call_split"
                        onClick={handleOpenModalExtraccion}
                        className="font-bold bg-purple-700 text-white hover:bg-purple-800 shadow-md shadow-purple-700/20 cursor-pointer"
                      >
                        {state.extraccionKumis?.realizado
                          ? 'Modificar / Extraer Más'
                          : '¿Extraer base para Kumis?'}
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )
          ) : (
            <div className="p-4 rounded-xl bg-amber-50/90 border-2 border-amber-300 flex flex-col gap-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
                <PopoverTimePicker
                  label="Hora de Fin de Retención"
                  icon="schedule"
                  hint="Toca para desplegar el selector flotante (hh:mm:ss)"
                  value={horaManualPaso3}
                  onChange={setHoraManualPaso3}
                />

                <InputField
                  label="Duración de Retención (Solo Lectura)"
                  icon="timer"
                  type="text"
                  disabled
                  readOnly
                  placeholder="Se calcula automáticamente"
                  hint={`Calculado: ${state.sostenimiento?.horaInicio} → ${horaManualPaso3}`}
                  value={duracionRetencionRecalculada}
                />
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  variant="primary"
                  size="md"
                  icon="save"
                  onClick={handleSaveManualPaso3}
                >
                  Guardar Fin de Retención
                </Button>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* =========================================================================
          6. PASO 4: ENFRIAMIENTO (A 45 °C PARA YOGUR / 35 °C PARA KUMIS)
      ========================================================================= */}
      <div ref={paso4Ref} id="paso-enfriamiento-35" className="scroll-mt-6">
        <Card
          title={coolingStepTitle}
          subtitle={
            isKumis
              ? 'Mide el tiempo desde el fin de la retención. Al confirmar, calcula la duración hacia 35 °C e inicia el traslado a cantinas.'
              : 'Mide el tiempo desde el fin de la retención. Al confirmar, calcula la duración e inicia el reloj de traslado.'
          }
          icon="ac_unit"
          badge={
            state.enfriamiento?.enfriamientoCompletado
              ? `✓ Enfriada: ${
                  state.enfriamiento?.tiempoEnfriamiento || 'Listo'
                }`
              : state.enfriamiento?.enfriamientoIniciado
              ? `Enfriando a ${targetCoolingTempStr}...`
              : state.sostenimiento?.completado
              ? 'Listo para iniciar enfriamiento'
              : 'En espera del Paso 3'
          }
          variant={
            state.enfriamiento?.enfriamientoCompletado
              ? 'success'
              : state.enfriamiento?.enfriamientoIniciado
              ? 'info'
              : state.sostenimiento?.completado
              ? 'default'
              : 'locked'
          }
          headerRight={
            state.enfriamiento?.enfriamientoCompletado ? (
              <ManualEditToggle manual={Boolean(manualPaso4)} onChange={(checked: boolean) => setManualPaso4(checked)} />
            ) : undefined
          }
        >
          <div className="space-y-4">
            {!state.enfriamiento?.enfriamientoIniciado ? (
              <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 text-xs text-gray-500 flex items-center gap-2.5">
                <span className="material-symbols-outlined text-gray-400 text-[20px]">
                  lock_clock
                </span>
                <span>
                  El cronómetro de enfriamiento a {targetCoolingTempStr} arrancará automáticamente en el momento exacto en que se confirme la retención del Paso 3.
                </span>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-white border border-[#D6DEEA]">
                    <span className="text-[10px] uppercase font-bold text-gray-500 block">
                      TEMPERATURA OBJETIVO DE ENFRIAMIENTO
                    </span>
                    <span className="text-2xl font-black font-mono text-blue-900 mt-1 block">
                      {targetCoolingTemp.toFixed(1)} °C
                    </span>
                    <span className="text-[11px] text-gray-500">
                      {isKumis
                        ? 'Temperatura óptima para la siembra del cultivo de kumis (30–35 °C)'
                        : 'Temperatura óptima para la siembra del cultivo (42–45 °C)'}
                    </span>
                  </div>

                  <div className="p-4 rounded-xl bg-blue-50 border border-blue-200">
                    <span className="text-[10px] uppercase font-bold text-blue-800 block">
                      CRONÓMETRO DE ENFRIAMIENTO
                    </span>
                    <span className="text-2xl font-black font-mono text-blue-950 mt-1 block">
                      {state.enfriamiento?.enfriamientoCompletado
                        ? state.enfriamiento?.tiempoEnfriamiento || 'Listo'
                        : enfriamientoTimer.humanElapsed}
                    </span>
                    <span className="text-[11px] text-blue-800 font-medium">
                      {state.enfriamiento?.enfriamientoCompletado
                        ? 'Enfriamiento finalizado'
                        : 'Circulando agua fría por la chaqueta...'}
                    </span>
                  </div>
                </div>

                {!manualPaso4 ? (
                  !state.enfriamiento?.enfriamientoCompletado ? (
                    <div className="pt-2">
                      <Button
                        variant="primary"
                        size="xl"
                        icon="ac_unit"
                        onClick={handleLlego45}
                        disabled={!state.enfriamiento?.enfriamientoIniciado}
                        className="bg-blue-600 text-white hover:bg-[#143A73] transition-colors font-bold shadow-md shadow-blue-600/20"
                      >
                        {coolingStepTitle}
                      </Button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="p-4 rounded-xl bg-white border border-[#D6DEEA]">
                        <span className="text-[10px] uppercase font-bold text-gray-500 block">
                          INICIO ENFRIAMIENTO
                        </span>
                        <span className="text-xl font-mono font-black text-gray-900 mt-1 block">
                          {state.enfriamiento?.horaInicio}
                        </span>
                      </div>

                      <div className="p-4 rounded-xl bg-white border border-[#D6DEEA]">
                        <span className="text-[10px] uppercase font-bold text-gray-500 block">
                          LLEGADA A {targetCoolingTempStr}
                        </span>
                        <span className="text-xl font-mono font-black text-blue-900 mt-1 block">
                          {state.enfriamiento?.horaFinEnfriamiento}
                        </span>
                      </div>

                      <div className="p-4 rounded-xl bg-blue-50 border border-blue-300">
                        <span className="text-[10px] uppercase font-bold text-blue-800 block">
                          TIEMPO DE ENFRIAMIENTO (SOLO LECTURA)
                        </span>
                        <span className="text-xl font-mono font-black text-blue-950 mt-1 block">
                          {state.enfriamiento?.tiempoEnfriamiento}
                        </span>
                      </div>
                    </div>
                  )
                ) : (
                  <div className="p-4 rounded-xl bg-amber-50/90 border-2 border-amber-300 flex flex-col gap-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
                      <PopoverTimePicker
                        label={`Hora de Llegada a ${targetCoolingTempStr}`}
                        icon="schedule"
                        hint="Toca para desplegar el selector flotante (hh:mm:ss)"
                        value={horaManualPaso4}
                        onChange={setHoraManualPaso4}
                      />

                      <InputField
                        label="Tiempo de Enfriamiento (Solo Lectura)"
                        icon="timer"
                        type="text"
                        disabled
                        readOnly
                        placeholder="Se calcula automáticamente"
                        hint={`Calculado: ${state.enfriamiento?.horaInicio} → ${horaManualPaso4}`}
                        value={duracionEnfriamientoRecalculada}
                      />
                    </div>

                    <div className="flex justify-end pt-2">
                      <Button
                        variant="primary"
                        size="md"
                        icon="save"
                        onClick={handleSaveManualPaso4}
                      >
                        Guardar Hora de Enfriamiento
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </Card>
      </div>

      {/* =========================================================================
          7. PASO 5: TRASLADO A CANTINAS
      ========================================================================= */}
      <Card
        title="¡Leche trasladada a cantinas!"
        subtitle={`Calcula el tiempo desde que la leche llegó a ${targetCoolingTempStr} hasta que se pasó a las cantinas limpias.`}
        icon="inventory_2"
        badge={
          state.trasiego?.completado
            ? `✓ Traslado: ${state.trasiego?.tiempoTrasiego || 'Listo'}`
            : state.trasiego?.iniciado
            ? 'Trasladando a cantinas...'
            : 'En espera del Paso 4'
        }
        variant={
          state.trasiego?.completado
            ? 'success'
            : state.trasiego?.iniciado
            ? 'warning'
            : 'locked'
        }
        headerRight={
          state.trasiego?.completado ? (
            <ManualEditToggle manual={Boolean(manualPaso5)} onChange={(checked: boolean) => setManualPaso5(checked)} />
          ) : undefined
        }
      >
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-white border border-[#D6DEEA] flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <span className="text-[10px] uppercase font-bold text-gray-500 block">
                DESTINO DEL TRASIEGO
              </span>
              <span className="text-base font-extrabold text-gray-900 mt-0.5 block">
                Cantinas de acero inoxidable limpias y desinfectadas
              </span>
              <span className="text-xs text-gray-500">
                La leche está a {targetCoolingTempStr}, lista para recibir el cultivo e incubar.
              </span>
            </div>

            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 shrink-0">
              <span className="text-[10px] uppercase font-bold text-amber-800 block">
                TIEMPO EN TRASLADO
              </span>
              <span className="text-xl font-mono font-black text-amber-950 block">
                {state.trasiego?.completado
                  ? state.trasiego?.tiempoTrasiego || 'Listo'
                  : trasiegoTimer.humanElapsed}
              </span>
            </div>
          </div>

          {!manualPaso5 ? (
            !state.trasiego?.completado ? (
              <div className="pt-2">
                <Button
                  variant="primary"
                  size="xl"
                  icon="check_circle"
                  onClick={handleYaTrasegue}
                  disabled={!state.trasiego?.iniciado}
                >
                  ¡Leche trasladada a cantinas!
                </Button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 rounded-xl bg-white border border-[#D6DEEA]">
                    <span className="text-[10px] uppercase font-bold text-gray-500 block">
                      INICIO DE TRASLADO
                    </span>
                    <span className="text-xl font-mono font-black text-gray-900 mt-1 block">
                      {state.trasiego?.horaInicio}
                    </span>
                  </div>

                  <div className="p-4 rounded-xl bg-white border border-[#D6DEEA]">
                    <span className="text-[10px] uppercase font-bold text-gray-500 block">
                      FIN DE TRASLADO
                    </span>
                    <span className="text-xl font-mono font-black text-emerald-900 mt-1 block">
                      {state.trasiego?.horaFin}
                    </span>
                  </div>

                  <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-300">
                    <span className="text-[10px] uppercase font-bold text-emerald-800 block">
                      TIEMPO DE TRASLADO (SOLO LECTURA)
                    </span>
                    <span className="text-xl font-mono font-black text-emerald-950 mt-1 block">
                      {state.trasiego?.tiempoTrasiego}
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
                  <Button
                    variant="outline"
                    size="md"
                    icon="edit"
                    onClick={() => setManualPaso5(true)}
                  >
                    Editar
                  </Button>
                  <Button variant="success" size="xl" icon="check_circle" disabled>
                    ¡Leche trasladada a cantinas!
                  </Button>
                </div>
              </>
            )
          ) : (
            <div className="p-4 rounded-xl bg-amber-50/90 border-2 border-amber-300 flex flex-col gap-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
                <PopoverTimePicker
                  label="Hora de Fin de Traslado"
                  icon="schedule"
                  hint="Toca para desplegar el selector flotante (hh:mm:ss)"
                  value={horaManualPaso5}
                  onChange={setHoraManualPaso5}
                />

                <InputField
                  label="Tiempo de Traslado (Solo Lectura)"
                  icon="timer"
                  type="text"
                  disabled
                  readOnly
                  placeholder="Se calcula automáticamente"
                  hint={`Calculado: ${state.trasiego?.horaInicio} → ${horaManualPaso5}`}
                  value={duracionTrasiegoRecalculada}
                />
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  variant="primary"
                  size="md"
                  icon="save"
                  onClick={handleSaveManualPaso5}
                >
                  Guardar Hora de Traslado
                </Button>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* =========================================================================
          PIE DE PÁGINA (FOOTER ESTANDARIZADO: AVANCE A ETAPA 2)
      ========================================================================= */}
      <div className="p-6 rounded-3xl bg-white border border-[#D6DEEA] shadow-md flex flex-col sm:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-[#1B4E9B]/10 text-[#1B4E9B] border border-[#1B4E9B]/20 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[32px]">
              task_alt
            </span>
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant={isCompletedStage ? 'success' : 'warning'}
                size="sm"
              >
                {isCompletedStage
                  ? '✓ Pasteurización Finalizada'
                  : 'Etapa 1: Pasteurización'}
              </Badge>
              <span className="text-xs font-mono font-bold text-gray-600 bg-gray-100 px-2.5 py-0.5 rounded-lg border border-gray-200">
                Tiempo de Pasteurización:{' '}
                {state.trasiego?.horaFin && state.calentamiento?.horaInicio
                  ? computeDurationBetweenTimes(
                      state.calentamiento.horaInicio,
                      state.trasiego.horaFin
                    ).human
                  : calentamientoTimer.humanElapsed || '00:00:00'}
              </span>
            </div>
            <h3 className="text-lg sm:text-xl font-black text-gray-900 mt-1">
              {productName} · Cierre de Pasteurización
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Leche lista a {targetCoolingTempStr} en cantinas · Pasa a la siembra del cultivo
              láctico.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto shrink-0 justify-end">
          <Button
            variant="primary"
            size="xl"
            iconRight="arrow_forward"
            disabled={!state.trasiego?.completado}
            onClick={onNextStage}
          >
            Pasar a Etapa 2: Inoculación e Incubación
          </Button>
        </div>
      </div>

      {/* =========================================================================
          MODAL DE EXTRACCIÓN DE BASE PARA KUMIS (PUNTO DE QUIEBRE)
      ========================================================================= */}
      {showModalExtraccion && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-[#D6DEEA] flex flex-col gap-5 animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[#D6DEEA]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-purple-100 text-purple-800 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[24px]">call_split</span>
                </div>
                <div>
                  <h3 className="text-base font-black text-gray-900">
                    Extracción de Base para Kumis
                  </h3>
                  <p className="text-xs text-gray-500">
                    Desvío de leche pasteurizada dulce caliente (85–90 °C)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowModalExtraccion(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Pregunta Principal */}
            <div className="p-4 rounded-2xl bg-purple-50/70 border border-purple-200">
              <label className="text-sm font-extrabold text-purple-950 block mb-1">
                ¿Cuántos litros se van a desviar para Kumis?
              </label>
              <p className="text-xs text-purple-900/80">
                Volumen total disponible en este punto:{' '}
                <strong className="font-mono text-purple-950 font-black">
                  {volumenTotalDisponible} L
                </strong>
                {prevExtraidosKumis > 0 && (
                  <span className="text-purple-700 ml-1">
                    (Yogur actual: {state.litrosLeche} L + {prevExtraidosKumis} L previamente extraídos)
                  </span>
                )}
              </p>
            </div>

            {/* Input de Litros a Extraer */}
            <div>
              <InputField
                label="Litros a desviar para Kumis"
                type="number"
                inputMode="numeric"
                min="1"
                max={volumenTotalDisponible}
                step="1"
                unit="L"
                icon="water_drop"
                placeholder="Ej: 200"
                showZero={false}
                value={litrosKumisInput}
                onChange={(e) => {
                  const rawVal = e.target.value;
                  setLitrosKumisInput(rawVal);
                  const num = Number(rawVal);
                  if (rawVal !== '' && num <= 0) {
                    setErrorExtraccion('La cantidad debe ser mayor a 0 litros.');
                  } else if (num > volumenTotalDisponible) {
                    setErrorExtraccion(
                      `Los litros extraídos no pueden superar el volumen total disponible (${volumenTotalDisponible} L).`
                    );
                  } else {
                    setErrorExtraccion(null);
                  }
                }}
              />
              {errorExtraccion && (
                <p className="text-xs font-bold text-red-600 mt-1.5 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[16px]">error</span>
                  {errorExtraccion}
                </p>
              )}
            </div>

            {/* Tarjeta de Datos Heredados y Balance Resultante */}
            {parsedLitrosKumis > 0 && parsedLitrosKumis <= volumenTotalDisponible && (
              <div className="p-4 rounded-2xl bg-[#F7F9FC] border border-[#D6DEEA] flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-gray-500">
                    Resumen de Balance y Herencia de Trazabilidad
                  </span>
                  {parsedLitrosKumis === volumenTotalDisponible && (
                    <Badge variant="warning" size="sm">
                      ¡Desvío 100%! Auto-cierre de Lote Padre
                    </Badge>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-2.5 rounded-xl bg-white border border-[#D6DEEA]">
                    <span className="text-[10px] font-bold text-gray-500 block uppercase">
                      Yogur Restante
                    </span>
                    <span className="text-base font-black font-mono text-blue-950">
                      {volumenTotalDisponible - parsedLitrosKumis} L
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-purple-50 border border-purple-200">
                    <span className="text-[10px] font-bold text-purple-800 block uppercase">
                      Kumis Lote Hijo
                    </span>
                    <span className="text-base font-black font-mono text-purple-950">
                      {parsedLitrosKumis} L
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-white border border-[#D6DEEA]">
                    <span className="text-[10px] font-bold text-gray-500 block uppercase">
                      Lote Leche Heredado
                    </span>
                    <span className="font-mono font-bold text-gray-900">
                      {state.loteLeche || 'Sin lote'}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-white border border-[#D6DEEA]">
                    <span className="text-[10px] font-bold text-gray-500 block uppercase">
                      Lote Azúcar Heredado
                    </span>
                    <span className="font-mono font-bold text-amber-900">
                      {state.azucar?.loteAzucar || state.loteAzucarPastur || 'Heredado'}
                    </span>
                  </div>
                </div>

                <div className="text-[11px] text-gray-600 bg-white/70 p-2 rounded-lg border border-[#D6DEEA]/60 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-amber-600 text-[18px]">
                    cookie
                  </span>
                  <span>
                    Azúcar proporcional asignada a Kumis:{' '}
                    <strong>{((parsedLitrosKumis / 40) * 3.2).toFixed(2)} kg</strong> (3,2 kg / 40 L)
                  </span>
                </div>
              </div>
            )}

            {/* Botones de acción */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                variant="secondary"
                size="md"
                onClick={() => setShowModalExtraccion(false)}
              >
                Cancelar
              </Button>
              <Button
                variant="primary"
                size="md"
                icon="check_circle"
                onClick={handleConfirmarExtraccion}
                disabled={!esExtraccionValida}
                className="bg-purple-700 text-white hover:bg-purple-800 font-bold shadow-md shadow-purple-700/20 cursor-pointer"
              >
                Confirmar Extracción y Desviar Litros
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
