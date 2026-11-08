import React, { useState, useEffect, useMemo } from 'react';
import { ManualEditToggle } from '../../../components/ui/ManualEditToggle';
import {
  CalentarYCuajarState,
  LotesLeche,
  ProcessTimerState,
} from '../../../types';
import {
  formatHumanDuration,
  getCurrentTimeString,
  formatTimeFromStep1,
  computeDurationBetweenTimes,
  timeStringToSecondsToday,
} from '../../../utils/timer';
import { useStageCountdown } from '../../../hooks';
import {
  StageHeader,
  Card,
  TimerBanner,
  ConfirmButton,
  InputField,
  SelectField,
  Button,
  Badge,
  PopoverTimePicker,
} from '../../../components/ui';
import { LOTES_CUAJO_PERA_DEFAULT as LOTES_CUAJO_DEFAULT } from '../../../data/insumoLotes';

export interface CalentarYCuajarStage7CuerosProps {
  state: CalentarYCuajarState;
  onChange: (
    updater: (prev: CalentarYCuajarState) => CalentarYCuajarState
  ) => void;
  processTimer: ProcessTimerState;
  horaAdicionCuajoDesdeAcidificar?: string | null;
  timestampAdicionCuajoDesdeAcidificar?: number | null;
  cantidadCuajoSugerida?: number;
  loteCuajo?: string;
  tipoCuajo?: string;
  totalLecheMezcla?: number;
  onUpdateCuajoLote?: (newLote: string) => void;
  lotesLeche?: LotesLeche;
  onNextStage: () => void;
  onOpenReviewModal?: () => void;
  showToast: (msg: string, type?: 'success' | 'info' | 'warning') => void;
}

export const CalentarYCuajarStage7Cueros: React.FC<
  CalentarYCuajarStage7CuerosProps
> = ({
  state,
  onChange,
  processTimer,
  horaAdicionCuajoDesdeAcidificar,
  timestampAdicionCuajoDesdeAcidificar,
  cantidadCuajoSugerida,
  loteCuajo = '',
  totalLecheMezcla = 0,
  onUpdateCuajoLote,
  lotesLeche,
  onNextStage,
  showToast,
}) => {
  // Volumen de leche efectivo en tina
  const effectiveMilkLiters =
    lotesLeche?.litrosConfirmados && lotesLeche.litrosConfirmados > 0
      ? lotesLeche.litrosConfirmados
      : totalLecheMezcla && totalLecheMezcla > 0
      ? totalLecheMezcla
      : 0;

  // Regla matemática inquebrantable para 7 Cueros: 1.2 g de cuajo por cada 100 L de leche fresca
  const cuajoCalculadoAutomatico =
    Math.round(((effectiveMilkLiters * 1.2) / 100) * 10) / 10;

  const pos = (v: number | undefined | null) =>
    v !== undefined && v !== null && v > 0 ? v : undefined;
  const cuajoMostrado =
    pos(state.adicionCuajo?.cantidadGramos) ??
    pos(cantidadCuajoSugerida) ??
    cuajoCalculadoAutomatico;

  // Estado del paso 1: Cuajo agregado
  const cuajoStepRegistrado = Boolean(
    state.adicionCuajo?.registrado ||
      state.horaAdicionCuajo ||
      horaAdicionCuajoDesdeAcidificar
  );

  const horaAdicionCuajoComun =
    state.adicionCuajo?.horaRegistro ||
    state.horaAdicionCuajo ||
    horaAdicionCuajoDesdeAcidificar ||
    '';

  const cuajoTimestampAnchor =
    state.adicionCuajo?.timestampCuajo ||
    state.timestampAdicionCuajo ||
    timestampAdicionCuajoDesdeAcidificar ||
    processTimer.startTimestamp;

  // Modos manuales independientes por paso
  const [manualPaso1, setManualPaso1] = useState<boolean>(
    Boolean(state.adicionCuajo?.esManual)
  );
  const [manualPaso2, setManualPaso2] = useState<boolean>(
    Boolean(state.cuajado?.esManual)
  );
  const [manualPaso3, setManualPaso3] = useState<boolean>(
    Boolean(state.corte?.esManual)
  );
  const [manualPaso4, setManualPaso4] = useState<boolean>(
    Boolean(state.temperatura40?.esManual)
  );

  // Variables editables para Paso 1 (Agregar Cuajo)
  const [loteCuajoInput, setLoteCuajoInput] = useState<string>(
    state.adicionCuajo?.loteCuajo || loteCuajo || ''
  );
  const [cantidadCuajoInput, setCantidadCuajoInput] = useState<
    number | undefined
  >(
    cuajoMostrado
  );
  const [horaCuajoManual, setHoraCuajoManual] = useState<string>(
    state.adicionCuajo?.horaRegistro ||
      state.horaAdicionCuajo ||
      horaAdicionCuajoDesdeAcidificar ||
      getCurrentTimeString()
  );

  // Variables editables para Paso 2 (Cuajado)
  const [horaManualCuajado, setHoraManualCuajado] = useState<string>(
    state.cuajado?.horaRegistro || getCurrentTimeString()
  );
  const [consistenciaManual, setConsistenciaManual] = useState<string>(
    state.cuajado?.consistencia || 'Cuajada firme / Corte limpio'
  );

  // Variables editables para Paso 3 (Corte)
  const [horaManualCorte, setHoraManualCorte] = useState<string>(
    state.corte?.horaRegistro || getCurrentTimeString()
  );

  // Variables editables para Paso 4 (Llegada a 40 °C)
  const [tempManual40, setTempManual40] = useState<number | undefined>(
    state.temperatura40?.temperaturaAlcanzada ?? 40.0
  );
  const [horaManual40, setHoraManual40] = useState<string>(
    state.temperatura40?.horaRegistro || getCurrentTimeString()
  );

  // Sincronización cuando no está en modo edición
  useEffect(() => {
    if (!manualPaso1) {
      if (state.adicionCuajo?.registrado) {
        setCantidadCuajoInput(
          pos(state.adicionCuajo.cantidadGramos) ?? cuajoCalculadoAutomatico
        );
        setHoraCuajoManual(
          state.adicionCuajo.horaRegistro ||
            state.horaAdicionCuajo ||
            horaAdicionCuajoDesdeAcidificar ||
            getCurrentTimeString()
        );
      } else {
        setCantidadCuajoInput(
          pos(cantidadCuajoSugerida) ?? cuajoCalculadoAutomatico
        );
      }
      if (state.adicionCuajo?.loteCuajo) {
        setLoteCuajoInput(state.adicionCuajo.loteCuajo);
      }
    }
  }, [
    manualPaso1,
    state.adicionCuajo,
    state.horaAdicionCuajo,
    horaAdicionCuajoDesdeAcidificar,
    cuajoCalculadoAutomatico,
    cantidadCuajoSugerida,
  ]);

  useEffect(() => {
    if (!manualPaso2) {
      setHoraManualCuajado(state.cuajado?.horaRegistro || getCurrentTimeString());
      setConsistenciaManual(
        state.cuajado?.consistencia || 'Cuajada firme / Corte limpio'
      );
    }
  }, [manualPaso2, state.cuajado?.horaRegistro, state.cuajado?.consistencia]);

  useEffect(() => {
    if (!manualPaso3) {
      setHoraManualCorte(state.corte?.horaRegistro || getCurrentTimeString());
    }
  }, [manualPaso3, state.corte?.horaRegistro]);

  useEffect(() => {
    if (!manualPaso4) {
      setTempManual40(state.temperatura40?.temperaturaAlcanzada ?? 40.0);
      setHoraManual40(state.temperatura40?.horaRegistro || getCurrentTimeString());
    }
  }, [
    manualPaso4,
    state.temperatura40?.temperaturaAlcanzada,
    state.temperatura40?.horaRegistro,
  ]);

  // =========================================================================
  // PUNTO DE PARTIDA CONCURRENTE (HORA DE CUAJADO) PARA PASO 3 Y PASO 4
  // =========================================================================
  const horaCuajadoComun =
    state.cuajado?.horaRegistro || horaAdicionCuajoComun || '';

  const tsCuajadoEfectivo = useMemo(() => {
    if (state.cuajado?.esManual && state.cuajado?.horaRegistro) {
      const sec = timeStringToSecondsToday(state.cuajado.horaRegistro);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return today.getTime() + sec * 1000;
    }
    if (state.cuajado?.timestampCuajado) {
      return state.cuajado.timestampCuajado;
    }
    if (state.cuajado?.horaRegistro) {
      const sec = timeStringToSecondsToday(state.cuajado.horaRegistro);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return today.getTime() + sec * 1000;
    }
    return null;
  }, [
    state.cuajado?.timestampCuajado,
    state.cuajado?.horaRegistro,
    state.cuajado?.esManual,
  ]);

  // =========================================================================
  // CRONÓMETROS EN VIVO
  // =========================================================================

  // Cronómetro de Cuajado en Tina (Paso 1 -> Paso 2, objetivo 15 min)
  const isCuajadoRunning = Boolean(
    cuajoStepRegistrado && !state.cuajado?.registrado
  );
  const isCuajadoCompleted = Boolean(state.cuajado?.registrado);

  const timerCuajado = useStageCountdown({
    startTimestamp: cuajoTimestampAnchor,
    isRunning: isCuajadoRunning,
    isCompleted: isCuajadoCompleted,
    targetMinutes: 15,
    completedDurationText: state.cuajado?.tiempoTranscurridoDesdeCuajo,
  });

  // Cronómetro de Corte de la Cuajada (Concurrente desde tsCuajadoEfectivo)
  const isPaso3Running = Boolean(
    state.cuajado?.registrado && !state.corte?.registrado && tsCuajadoEfectivo
  );
  const isPaso3Completed = Boolean(state.corte?.registrado);

  const timerPaso3 = useStageCountdown({
    startTimestamp: tsCuajadoEfectivo,
    isRunning: isPaso3Running,
    isCompleted: isPaso3Completed,
    targetMinutes: 10,
    completedDurationText: state.corte?.tiempoTranscurridoDesdeCuajado,
  });

  // Cronómetro de Calentamiento a 40 °C (Concurrente desde tsCuajadoEfectivo)
  const isPaso4Running = Boolean(
    state.cuajado?.registrado &&
      !state.temperatura40?.alcanzado &&
      tsCuajadoEfectivo
  );
  const isPaso4Completed = Boolean(state.temperatura40?.alcanzado);

  const timerPaso4 = useStageCountdown({
    startTimestamp: tsCuajadoEfectivo,
    isRunning: isPaso4Running,
    isCompleted: isPaso4Completed,
    targetMinutes: 15,
    completedDurationText: state.temperatura40?.tiempoCalentamiento40,
  });

  // =========================================================================
  // RECÁLCULOS AUTOMÁTICOS DE DURACIONES (SOLO LECTURA)
  // =========================================================================

  // Paso 2: Duración = Hora en que cuajó - Hora de adición del cuajo
  const duracionCuajadoRecalculada = useMemo(() => {
    if (!horaManualCuajado) {
      return {
        human: state.cuajado?.tiempoTranscurridoDesdeCuajo || '0 s',
        seconds: state.cuajado?.segundosCuajado || 0,
      };
    }
    const origin =
      state.adicionCuajo?.horaRegistro ||
      horaAdicionCuajoComun ||
      horaCuajoManual;
    if (origin && origin !== 'En espera') {
      return computeDurationBetweenTimes(origin, horaManualCuajado);
    }
    return {
      human: state.cuajado?.tiempoTranscurridoDesdeCuajo || '0 s',
      seconds: state.cuajado?.segundosCuajado || 0,
    };
  }, [
    state.adicionCuajo?.horaRegistro,
    horaAdicionCuajoComun,
    horaCuajoManual,
    horaManualCuajado,
    state.cuajado?.tiempoTranscurridoDesdeCuajo,
    state.cuajado?.segundosCuajado,
  ]);

  // Paso 3: Duración = Hora de fin del corte - Hora de cuajado
  const duracionCorteRecalculada = useMemo(() => {
    if (!horaManualCorte) {
      return {
        human: state.corte?.tiempoTranscurridoDesdeCuajado || '0 s',
        seconds: 0,
      };
    }
    if (horaCuajadoComun && horaCuajadoComun !== 'En espera') {
      return computeDurationBetweenTimes(horaCuajadoComun, horaManualCorte);
    }
    return {
      human: state.corte?.tiempoTranscurridoDesdeCuajado || '0 s',
      seconds: 0,
    };
  }, [
    horaCuajadoComun,
    horaManualCorte,
    state.corte?.tiempoTranscurridoDesdeCuajado,
  ]);

  // Paso 4: Duración = Hora de llegada a 40 °C - Hora de cuajado
  const duracion40Recalculada = useMemo(() => {
    if (!horaManual40) {
      return {
        human: state.temperatura40?.tiempoCalentamiento40 || '0 s',
        seconds: 0,
      };
    }
    if (horaCuajadoComun && horaCuajadoComun !== 'En espera') {
      return computeDurationBetweenTimes(horaCuajadoComun, horaManual40);
    }
    return {
      human: state.temperatura40?.tiempoCalentamiento40 || '0 s',
      seconds: 0,
    };
  }, [
    horaCuajadoComun,
    horaManual40,
    state.temperatura40?.tiempoCalentamiento40,
  ]);

  // =========================================================================
  // HANDLERS PASO 1: ADICIÓN DE CUAJO (A 35 °C)
  // =========================================================================
  const handleYaAdicioneCuajo = () => {
    if (!loteCuajoInput.trim() && !loteCuajo) {
      showToast('Selecciona el lote de cuajo antes de registrar la adición.', 'warning');
      return;
    }
    const nowTs = Date.now();
    const timeStr = getCurrentTimeString();
    const finalCuajoGramos =
      cantidadCuajoInput !== undefined && cantidadCuajoInput > 0
        ? cantidadCuajoInput
        : cuajoCalculadoAutomatico;

    setHoraCuajoManual(timeStr);
    setCantidadCuajoInput(finalCuajoGramos);
    setManualPaso1(false);

    if (onUpdateCuajoLote && loteCuajoInput.trim()) {
      onUpdateCuajoLote(loteCuajoInput.trim());
    }

    onChange((p) => ({
      ...p,
      horaAdicionCuajo: timeStr,
      timestampAdicionCuajo: p.timestampAdicionCuajo || nowTs,
      adicionCuajo: {
        registrado: true,
        horaRegistro: timeStr,
        timestampCuajo: p.adicionCuajo?.timestampCuajo || nowTs,
        tiempoTranscurridoDesdeCultivo: 'Directo a 35 °C',
        cantidadGramos: finalCuajoGramos,
        loteCuajo: loteCuajoInput.trim() || loteCuajo,
        esManual: manualPaso1,
      },
    }));

    showToast(
      `✓ Cuajo agregado (${finalCuajoGramos} g a las ${timeStr}). Reloj de cuajado en marcha.`,
      'info'
    );
  };

  const handleSaveManualCuajo = () => {
    if (!loteCuajoInput.trim() && !loteCuajo) {
      showToast('Selecciona el lote de cuajo antes de guardar.', 'warning');
      return;
    }
    const timeStr = formatTimeFromStep1(horaCuajoManual);
    const finalCuajoGramos =
      cantidadCuajoInput !== undefined && cantidadCuajoInput > 0
        ? cantidadCuajoInput
        : cuajoCalculadoAutomatico;

    const sec = timeStringToSecondsToday(timeStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const manualCuajoTs = today.getTime() + sec * 1000;

    // Si el cuajado ya estaba registrado, recalcular su duración
    let nuevoTiempoCuajado = state.cuajado?.tiempoTranscurridoDesdeCuajo;
    let nuevosSegundosCuajado = state.cuajado?.segundosCuajado || 0;
    if (state.cuajado?.registrado && state.cuajado?.horaRegistro) {
      const diff = computeDurationBetweenTimes(
        timeStr,
        state.cuajado.horaRegistro
      );
      nuevoTiempoCuajado = diff.human;
      nuevosSegundosCuajado = diff.seconds;
    }

    if (onUpdateCuajoLote && loteCuajoInput.trim()) {
      onUpdateCuajoLote(loteCuajoInput.trim());
    }

    onChange((p) => ({
      ...p,
      horaAdicionCuajo: timeStr,
      timestampAdicionCuajo: manualCuajoTs,
      adicionCuajo: {
        registrado: true,
        horaRegistro: timeStr,
        timestampCuajo: manualCuajoTs,
        tiempoTranscurridoDesdeCultivo: 'Directo a 35 °C',
        cantidadGramos: finalCuajoGramos,
        loteCuajo: loteCuajoInput.trim() || loteCuajo,
        esManual: true,
      },
      cuajado: {
        ...p.cuajado,
        tiempoTranscurridoDesdeCuajo: nuevoTiempoCuajado,
        segundosCuajado: nuevosSegundosCuajado,
      },
    }));

    setManualPaso1(false);
    showToast(
      `✓ Datos de cuajo guardados (${timeStr} · ${finalCuajoGramos} g).`,
      'success'
    );
  };

  // =========================================================================
  // HANDLERS PASO 2: CONFIRMACIÓN DE CUAJADO
  // =========================================================================
  const handleYaCuajo = () => {
    const nowTs = Date.now();
    const timeStr = getCurrentTimeString();
    const baseCuajoTs =
      state.adicionCuajo?.timestampCuajo ||
      state.timestampAdicionCuajo ||
      cuajoTimestampAnchor ||
      nowTs - 900000;
    const elapsedSec = Math.max(1, Math.floor((nowTs - baseCuajoTs) / 1000));
    const duracionStr = formatHumanDuration(elapsedSec);

    onChange((p) => ({
      ...p,
      cuajado: {
        ...p.cuajado,
        registrado: true,
        horaRegistro: timeStr,
        timestampCuajado: nowTs,
        tiempoTranscurridoDesdeCuajo: duracionStr,
        segundosCuajado: elapsedSec,
        consistencia: consistenciaManual || 'Cuajada firme / Corte limpio',
        esManual: manualPaso2,
      },
    }));

    setHoraManualCuajado(timeStr);

    showToast(
      `✓ ¡La leche ya cuajó! (${duracionStr}). Inician simultáneamente corte y calentamiento a 40 °C.`,
      'success'
    );
  };

  const handleSaveManualCuajado = () => {
    const timeStr = formatTimeFromStep1(horaManualCuajado);
    const originCuajo =
      state.adicionCuajo?.horaRegistro ||
      horaAdicionCuajoComun ||
      horaCuajoManual;

    let duracionStr = state.cuajado?.tiempoTranscurridoDesdeCuajo || '0 s';
    let elapsedSec = state.cuajado?.segundosCuajado || 0;

    if (originCuajo && originCuajo !== 'En espera') {
      const diff = computeDurationBetweenTimes(originCuajo, timeStr);
      duracionStr = diff.human;
      elapsedSec = diff.seconds;
    }

    const sec = timeStringToSecondsToday(timeStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const manualCuajadoTs = today.getTime() + sec * 1000;

    // Cascada de sincronización concurrentes: si Paso 3 o 4 ya estaban registrados, recalcular
    let nuevoTiempoCorte = state.corte?.tiempoTranscurridoDesdeCuajado;
    if (state.corte?.registrado && state.corte?.horaRegistro) {
      nuevoTiempoCorte = computeDurationBetweenTimes(
        timeStr,
        state.corte.horaRegistro
      ).human;
    }

    let nuevoTiempo40 = state.temperatura40?.tiempoCalentamiento40;
    if (state.temperatura40?.alcanzado && state.temperatura40?.horaRegistro) {
      nuevoTiempo40 = computeDurationBetweenTimes(
        timeStr,
        state.temperatura40.horaRegistro
      ).human;
    }

    onChange((p) => ({
      ...p,
      cuajado: {
        ...p.cuajado,
        registrado: true,
        horaRegistro: timeStr,
        timestampCuajado: manualCuajadoTs,
        tiempoTranscurridoDesdeCuajo: duracionStr,
        segundosCuajado: elapsedSec,
        consistencia: consistenciaManual,
        esManual: true,
      },
      corte: {
        ...p.corte,
        tiempoTranscurridoDesdeCuajado: nuevoTiempoCorte,
      },
      temperatura40: {
        ...p.temperatura40,
        tiempoCalentamiento40: nuevoTiempo40,
      },
    }));

    setManualPaso2(false);
    showToast(
      `✓ Hora de cuajado actualizada (${timeStr}). Tiempos sincronizados.`,
      'success'
    );
  };

  // =========================================================================
  // HANDLERS PASO 3: CORTE DE LA CUAJADA
  // =========================================================================
  const handleYaTermineCorte = () => {
    const nowTs = Date.now();
    const timeStr = getCurrentTimeString();
    const duracionStr =
      horaCuajadoComun && horaCuajadoComun !== 'En espera'
        ? computeDurationBetweenTimes(horaCuajadoComun, timeStr).human
        : formatHumanDuration(
            Math.max(
              1,
              Math.floor((nowTs - (tsCuajadoEfectivo || nowTs - 600000)) / 1000)
            )
          );

    onChange((p) => ({
      ...p,
      corte: {
        ...p.corte,
        registrado: true,
        horaRegistro: timeStr,
        timestampCorte: nowTs,
        tiempoTranscurridoDesdeCuajado: duracionStr,
        esManual: manualPaso3,
      },
    }));

    setHoraManualCorte(timeStr);
    showToast(
      `✓ Corte de la cuajada terminado a las ${timeStr} · Tardó ${duracionStr}`,
      'success'
    );
  };

  const handleSaveManualCorte = () => {
    const timeStr = formatTimeFromStep1(horaManualCorte);
    let duracionStr = state.corte?.tiempoTranscurridoDesdeCuajado || '0 s';
    if (horaCuajadoComun && horaCuajadoComun !== 'En espera') {
      duracionStr = computeDurationBetweenTimes(
        horaCuajadoComun,
        timeStr
      ).human;
    }

    onChange((p) => ({
      ...p,
      corte: {
        ...p.corte,
        registrado: true,
        horaRegistro: timeStr,
        tiempoTranscurridoDesdeCuajado: duracionStr,
        esManual: true,
      },
    }));

    setManualPaso3(false);
    showToast(
      `✓ Corte manual guardado (${timeStr} · ${duracionStr})`,
      'success'
    );
  };

  // =========================================================================
  // HANDLERS PASO 4: CALENTAMIENTO A 40 °C
  // =========================================================================
  const handleYaCaliente40 = () => {
    const nowTs = Date.now();
    const timeStr = getCurrentTimeString();
    const duracionStr =
      horaCuajadoComun && horaCuajadoComun !== 'En espera'
        ? computeDurationBetweenTimes(horaCuajadoComun, timeStr).human
        : formatHumanDuration(
            Math.max(
              1,
              Math.floor((nowTs - (tsCuajadoEfectivo || nowTs - 900000)) / 1000)
            )
          );
    const tempFinal = tempManual40 ?? 40.0;

    onChange((p) => ({
      ...p,
      temperatura40: {
        ...p.temperatura40,
        alcanzado: true,
        horaRegistro: timeStr,
        timestamp40Grados: nowTs,
        temperaturaAlcanzada: tempFinal,
        tiempoCalentamiento40: duracionStr,
        esManual: manualPaso4,
      },
      telemetria: {
        ...p.telemetria,
        temperatura: tempFinal,
      },
    }));

    setHoraManual40(timeStr);
    showToast(
      `✓ ¡Ya llegó a ${tempFinal.toFixed(
        1
      )} °C a las ${timeStr}! Tardó ${duracionStr} desde el cuajado. Listo para desuerar.`,
      'success'
    );
  };

  const handleSaveManual40 = () => {
    const timeStr = formatTimeFromStep1(horaManual40);
    let duracionStr = state.temperatura40?.tiempoCalentamiento40 || '0 s';
    if (horaCuajadoComun && horaCuajadoComun !== 'En espera') {
      duracionStr = computeDurationBetweenTimes(
        horaCuajadoComun,
        timeStr
      ).human;
    }
    const tempFinal = tempManual40 ?? 40.0;

    onChange((p) => ({
      ...p,
      temperatura40: {
        ...p.temperatura40,
        alcanzado: true,
        temperaturaAlcanzada: tempFinal,
        horaRegistro: timeStr,
        tiempoCalentamiento40: duracionStr,
        esManual: true,
      },
      telemetria: {
        ...p.telemetria,
        temperatura: tempFinal,
      },
    }));

    setManualPaso4(false);
    showToast(
      `✓ Datos manuales de 40 °C guardados: ${tempFinal.toFixed(
        1
      )} °C a las ${timeStr} (${duracionStr})`,
      'success'
    );
  };

  return (
    <div className="flex flex-col w-full p-4 lg:p-6 gap-6 bg-[#FFFFFF] min-h-[calc(100vh-4rem)] pb-12">
      <StageHeader
        stageNumber={2}
        totalStages={5}
        title="Agregar Cuajo, Cortar y Calentar a 40 °C"
        subtitle="Agrega el cuajo a 35 °C, espera el cuajado firme (~15 min), corta la cuajada y calienta suavemente hasta 40 °C."
        productName="Queso 7 Cueros"
        icon="thermostat"
        isCompleted={Boolean(state.temperatura40?.alcanzado)}
        rightContent={
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="px-3.5 py-2 rounded-xl bg-amber-50 border border-amber-300 flex items-center gap-2.5 min-h-[48px]">
              <span className="material-symbols-outlined text-amber-700 text-[22px]">
                water_drop
              </span>
              <div>
                <div className="text-[10px] text-amber-900 uppercase font-bold">
                  LECHE EN TINA
                </div>
                <div className="text-xs font-black text-amber-950 font-mono">
                  {effectiveMilkLiters} L
                </div>
              </div>
            </div>

            <div className="px-3.5 py-2 rounded-xl bg-blue-50 border border-blue-200 flex items-center gap-2.5 min-h-[48px]">
              <span className="material-symbols-outlined text-[#1B4E9B] text-[22px]">
                thermostat
              </span>
              <div>
                <div className="text-[10px] text-[#434655] uppercase font-bold">
                  META PARA DESUERAR
                </div>
                <div className="text-xs font-black text-[#1B4E9B]">40.0 °C</div>
              </div>
            </div>
          </div>
        }
      />

      {/* BANNER: TIEMPO TRANSCURRIDO GENERAL */}
      <TimerBanner
        title="Tiempo de Proceso en Tina"
        subtitle={
          cuajoStepRegistrado
            ? `Cuajo agregado a las ${
                horaAdicionCuajoComun || horaCuajoManual
              }. Revisa la cuajada antes de cortar.`
            : 'Adiciona el cuajo a 35 °C para dar inicio al reloj de cuajado en tina.'
        }
        formattedTime={processTimer.formattedTime || '00:00:00'}
        isRunning={processTimer.isRunning}
        isCompleted={Boolean(state.temperatura40?.alcanzado)}
        statusLabel="Cronómetro General del Lote"
        variant="info"
      />

      {/* =========================================================================
          PASO 01: AGREGAR EL CUAJO (A 35 °C)
      ========================================================================= */}
      <Card
        title="Agregar el Cuajo (a 35 °C)"
        subtitle="Fórmula 7 Cueros: 1.2 g de cuajo por cada 100 litros de leche fresca."
        icon="vaccines"
        badge={cuajoStepRegistrado ? '✓ Cuajo Agregado' : 'Pendiente'}
        variant={cuajoStepRegistrado ? 'success' : 'default'}
        headerAction={
          <ConfirmButton
            label="¡Ya agregué el cuajo!"
            confirmedLabel="✓ Cuajo Agregado"
            icon="vaccines"
            isConfirmed={cuajoStepRegistrado && !manualPaso1}
            disabled={cuajoStepRegistrado && !manualPaso1}
            onConfirm={handleYaAdicioneCuajo}
          />
        }
      >
        <div className="flex flex-col gap-4">
          <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-300 flex flex-wrap items-center justify-between gap-2 min-h-[48px]">
            <ManualEditToggle manual={Boolean(manualPaso1)} onChange={(checked: boolean) => setManualPaso1(checked)} />
            <Badge variant={manualPaso1 ? 'warning' : 'neutral'} size="sm">
              {manualPaso1 ? 'Modo Manual Activo' : 'Automático'}
            </Badge>
          </div>

          {!manualPaso1 ? (
            cuajoStepRegistrado ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-[#D6DEEA]/70">
                <div className="p-3.5 bg-white rounded-xl border border-amber-200 flex flex-col">
                  <span className="text-[10px] uppercase font-bold text-gray-500">
                    Cantidad de Cuajo
                  </span>
                  <span className="text-lg font-black font-mono text-amber-900 mt-1">
                    {cuajoMostrado}{' '}
                    g
                  </span>
                  <span className="text-[11px] text-gray-500">
                    Para {effectiveMilkLiters} L (1.2 g / 100 L)
                  </span>
                </div>

                <div className="p-3.5 bg-white rounded-xl border border-amber-200 flex flex-col">
                  <span className="text-[10px] uppercase font-bold text-gray-500">
                    Hora de Adición
                  </span>
                  <span className="text-lg font-black font-mono text-[#1B4E9B] mt-1">
                    {state.adicionCuajo?.horaRegistro || horaCuajoManual}
                  </span>
                  <span className="text-[11px] text-gray-500">
                    Momento en que se diluyó y agregó
                  </span>
                </div>

                <div className="p-3.5 bg-white rounded-xl border border-amber-200 flex flex-col">
                  <span className="text-[10px] uppercase font-bold text-gray-500">
                    Lote de Cuajo
                  </span>
                  <span className="text-sm font-black text-gray-800 mt-1 font-mono">
                    {state.adicionCuajo?.loteCuajo || loteCuajoInput}
                  </span>
                  <span className="text-[11px] text-gray-500">
                    Trazabilidad del insumo
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-3 pt-2 border-t border-[#D6DEEA]/60">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <InputField
                    label="Cantidad de cuajo a usar"
                    type="number"
                    inputMode="decimal"
                    step="0.1"
                    min="0"
                    unit="g"
                    showZero={false}
                    value={
                      cantidadCuajoInput && cantidadCuajoInput > 0
                        ? cantidadCuajoInput
                        : ''
                    }
                    onChange={(e) =>
                      setCantidadCuajoInput(
                        e.target.value === ''
                          ? undefined
                          : Number(e.target.value)
                      )
                    }
                    placeholder={String(cuajoCalculadoAutomatico)}
                    helperText={`Sugerido: ${cuajoCalculadoAutomatico} g para ${effectiveMilkLiters} L de leche (1.2 g / 100 L)`}
                  />

                  <SelectField
                    label="Lote de Cuajo"
                    disabled={Boolean(loteCuajo)}
                    hint={loteCuajo ? "Definido en Etapa 1 (Acidificar)" : undefined}
                    value={loteCuajoInput}
                    onChange={(e) => {
                      setLoteCuajoInput(e.target.value);
                      if (onUpdateCuajoLote)
                        onUpdateCuajoLote(e.target.value);
                    }}
                    options={LOTES_CUAJO_DEFAULT.map((l) => ({
                      value: l,
                      label: l,
                    }))}
                  />
                </div>

                <div className="text-xs text-[#434655] flex items-center gap-2 mt-1">
                  <span className="material-symbols-outlined text-[18px] text-[#1B4E9B]">
                    info
                  </span>
                  <span>
                    Al pulsar <strong>"¡Ya agregué el cuajo!"</strong>, inicia el
                    cronómetro principal de cuajado en tina (objetivo: ~15
                    minutos).
                  </span>
                </div>
              </div>
            )
          ) : (
            <div className="p-4 rounded-xl bg-amber-50/90 border-2 border-amber-300 flex flex-col gap-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-start">
                <InputField
                  label="Cantidad de Cuajo (g)"
                  icon="scale"
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  min="0"
                  unit="g"
                  showZero={false}
                  value={
                    cantidadCuajoInput && cantidadCuajoInput > 0
                      ? cantidadCuajoInput
                      : ''
                  }
                  onChange={(e) =>
                    setCantidadCuajoInput(
                      e.target.value === ''
                        ? undefined
                        : Number(e.target.value)
                    )
                  }
                  placeholder={String(cuajoCalculadoAutomatico)}
                  hint={`Fórmula: 1.2 g / 100 L (${cuajoCalculadoAutomatico} g)`}
                />

                <PopoverTimePicker
                  label="Hora de Adición de Cuajo"
                  icon="schedule"
                  hint="Toca para desplegar el selector flotante (hh:mm:ss)"
                  value={horaCuajoManual}
                  onChange={setHoraCuajoManual}
                />

                <SelectField
                  label="Lote de Cuajo"
                    disabled={Boolean(loteCuajo)}
                    hint={loteCuajo ? "Definido en Etapa 1 (Acidificar)" : undefined}
                  value={loteCuajoInput}
                  onChange={(e) => {
                    setLoteCuajoInput(e.target.value);
                    if (onUpdateCuajoLote)
                      onUpdateCuajoLote(e.target.value);
                  }}
                  options={LOTES_CUAJO_DEFAULT.map((l) => ({
                    value: l,
                    label: l,
                  }))}
                />
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  variant="primary"
                  size="md"
                  icon="save"
                  onClick={handleSaveManualCuajo}
                >
                  Guardar cambios
                </Button>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* =========================================================================
          PASO 02: ¡LA LECHE YA CUAJÓ!
      ========================================================================= */}
      <Card
        title="¡La leche ya cuajó!"
        subtitle="Aprox. a los 15 minutos revisa la firmeza en la tina. Al confirmar, se detiene este reloj e inician simultáneamente el corte y el calentamiento a 40 °C."
        icon="egg"
        badge={
          state.cuajado?.registrado
            ? '✓ Cuajada Lista'
            : cuajoStepRegistrado
            ? '⏳ Cuajando en tina'
            : 'Esperando cuajo'
        }
        variant={
          state.cuajado?.registrado
            ? 'success'
            : cuajoStepRegistrado
            ? 'active'
            : 'default'
        }
        headerAction={
          <ConfirmButton
            label="¡La leche ya cuajó!"
            confirmedLabel="✓ Tiempo de Cuajado Registrado"
            icon="schedule"
            isConfirmed={Boolean(state.cuajado?.registrado)}
            disabled={!cuajoStepRegistrado}
            onConfirm={handleYaCuajo}
          />
        }
      >
        <div className="flex flex-col gap-4">
          {/* CRONÓMETRO DE CUAJADO EN TINA (15 min objetivo) */}
          <TimerBanner
            title="Reloj de Cuajado en Tina"
            subtitle={
              state.cuajado?.registrado
                ? `Cuajado completado a las ${state.cuajado.horaRegistro} (tardó ${state.cuajado.tiempoTranscurridoDesdeCuajo}).`
                : cuajoStepRegistrado
                ? `Iniciado a las ${
                    horaCuajoManual || state.adicionCuajo?.horaRegistro
                  }. Revisa con un cuchillo si da corte limpio a los ~15 min.`
                : 'Iniciará al pulsar "¡Ya agregué el cuajo!".'
            }
            formattedTime={
              state.cuajado?.registrado
                ? state.cuajado.tiempoTranscurridoDesdeCuajo ||
                  timerCuajado.humanElapsed
                : cuajoStepRegistrado
                ? timerCuajado.formattedElapsed
                : '00:00'
            }
            isRunning={isCuajadoRunning}
            isCompleted={isCuajadoCompleted}
            statusLabel={
              state.cuajado?.registrado
                ? 'Cuajado completado'
                : cuajoStepRegistrado
                ? 'Cuajando en vivo'
                : 'En espera'
            }
            targetLabel="Objetivo: ~15:00 min"
            variant="warning"
          />

          <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-300 flex flex-wrap items-center justify-between gap-2 min-h-[48px]">
            <ManualEditToggle manual={Boolean(manualPaso2)} onChange={(checked: boolean) => setManualPaso2(checked)} />
            <Badge variant={manualPaso2 ? 'warning' : 'neutral'} size="sm">
              {manualPaso2 ? 'Modo Manual Activo' : 'Automático'}
            </Badge>
          </div>

          {!manualPaso2 ? (
            state.cuajado?.registrado ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-[#D6DEEA]/70">
                <div className="p-3.5 bg-white rounded-xl border border-amber-200 flex flex-col">
                  <span className="text-[10px] uppercase font-bold text-gray-500">
                    Hora en que Cuajó
                  </span>
                  <span className="text-lg font-black font-mono text-amber-900 mt-1">
                    {state.cuajado.horaRegistro}
                  </span>
                  <span className="text-[11px] text-gray-500">
                    Momento exacto en que revisaste la tina
                  </span>
                </div>

                <div className="p-3.5 bg-white rounded-xl border border-amber-200 flex flex-col">
                  <span className="text-[10px] uppercase font-bold text-gray-500">
                    Tiempo que Tardó en Cuajar
                  </span>
                  <span className="text-lg font-black font-mono text-[#1B4E9B] mt-1">
                    {state.cuajado.tiempoTranscurridoDesdeCuajo}
                  </span>
                  <span className="text-[11px] text-gray-500">
                    Calculado desde la adición del cuajo (
                    {horaAdicionCuajoComun || horaCuajoManual})
                  </span>
                </div>

                <div className="p-3.5 bg-white rounded-xl border border-amber-200 flex flex-col">
                  <span className="text-[10px] uppercase font-bold text-gray-500">
                    Firmeza de la Cuajada
                  </span>
                  <span className="text-sm font-black text-emerald-700 mt-1 flex items-center gap-1">
                    <span className="material-symbols-outlined text-[16px]">
                      verified
                    </span>
                    {state.cuajado.consistencia ||
                      'Cuajada firme / Corte limpio'}
                  </span>
                  <span className="text-[11px] text-gray-500">
                    Punto óptimo para pasar la lira
                  </span>
                </div>
              </div>
            ) : (
              <div className="pt-2 border-t border-[#D6DEEA]/60 text-xs text-[#434655] flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-[#1B4E9B]">
                  info
                </span>
                <span>
                  Cuando la cuajada presente rotura limpia y firme, pulsa{' '}
                  <strong>"¡La leche ya cuajó!"</strong> para detener este
                  reloj y comenzar simultáneamente el corte y el calentamiento
                  hacia 40 °C.
                </span>
              </div>
            )
          ) : (
            <div className="p-4 rounded-xl bg-amber-50/90 border-2 border-amber-300 flex flex-col gap-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-start">
                <PopoverTimePicker
                  label="Hora en que Cuajó"
                  icon="schedule"
                  hint="Toca para desplegar el selector flotante (hh:mm:ss)"
                  value={horaManualCuajado}
                  onChange={setHoraManualCuajado}
                />

                <InputField
                  label="Tiempo que Tardó en Cuajar"
                  icon="timer"
                  type="text"
                  disabled
                  readOnly
                  placeholder="Se calcula automáticamente"
                  hint={
                    horaAdicionCuajoComun
                      ? `Calculado: ${horaAdicionCuajoComun} → ${horaManualCuajado}`
                      : 'Calculado automáticamente desde la adición del cuajo'
                  }
                  value={duracionCuajadoRecalculada.human}
                />

                <InputField
                  label="Firmeza / Observación"
                  icon="verified"
                  type="text"
                  value={consistenciaManual}
                  onChange={(e) => setConsistenciaManual(e.target.value)}
                />
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  variant="primary"
                  size="md"
                  icon="save"
                  onClick={handleSaveManualCuajado}
                >
                  Guardar cambios
                </Button>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* =========================================================================
          PASO 03: YA TERMINÉ DE CORTAR LA CUAJADA!! (CONCURRENTE)
      ========================================================================= */}
      <Card
        title="Ya terminé de cortar la cuajada!!"
        subtitle="Corta la cuajada en cubos uniformes con la lira y confirma apenas termines, mientras la mezcla sigue calentando a 40 °C."
        icon="grid_4x4"
        badge={
          state.corte?.registrado
            ? '✓ Corte Terminado'
            : isPaso3Running
            ? '⏳ Cortando en curso'
            : 'Esperando cuajado'
        }
        variant={
          state.corte?.registrado
            ? 'success'
            : isPaso3Running
            ? 'warning'
            : 'default'
        }
        headerAction={
          <ConfirmButton
            label="Ya terminé de cortar la cuajada!!"
            confirmedLabel="✓ Corte Terminado"
            icon="content_cut"
            isConfirmed={Boolean(state.corte?.registrado)}
            disabled={!state.cuajado?.registrado}
            onConfirm={handleYaTermineCorte}
          />
        }
      >
        <div className="flex flex-col gap-4">
          {state.cuajado?.registrado ? (
            <TimerBanner
              title="Cronómetro de Corte de la Cuajada"
              subtitle={
                state.corte?.registrado
                  ? `Corte finalizado a las ${state.corte.horaRegistro} (tardó ${state.corte.tiempoTranscurridoDesdeCuajado}).`
                  : `Iniciado concurrentemente con el cuajado a las ${horaCuajadoComun}. Pasa las liras despacio y parejo.`
              }
              formattedTime={
                state.corte?.registrado
                  ? state.corte.tiempoTranscurridoDesdeCuajado ||
                    timerPaso3.humanElapsed
                  : timerPaso3.formattedElapsed
              }
              isRunning={isPaso3Running}
              isCompleted={isPaso3Completed}
              statusLabel={
                state.corte?.registrado
                  ? 'Corte completado'
                  : 'Cortando cuajada en vivo'
              }
              variant="warning"
            />
          ) : (
            <div className="p-3.5 rounded-xl bg-amber-50/60 border border-amber-200 text-xs text-amber-900 flex items-center gap-2">
              <span className="material-symbols-outlined text-[20px] text-amber-700">
                hourglass_top
              </span>
              <span>
                El cronómetro de corte iniciará automáticamente en cuanto
                confirmes que la leche ya cuajó en el Paso 2.
              </span>
            </div>
          )}

          <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-300 flex flex-wrap items-center justify-between gap-2 min-h-[48px]">
            <ManualEditToggle manual={Boolean(manualPaso3)} onChange={(checked: boolean) => setManualPaso3(checked)} />
            <Badge variant={manualPaso3 ? 'warning' : 'neutral'} size="sm">
              {manualPaso3 ? 'Modo Manual Activo' : 'Automático'}
            </Badge>
          </div>

          {!manualPaso3 ? (
            state.corte?.registrado ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-[#D6DEEA]/70">
                <div className="p-3.5 bg-white rounded-xl border border-amber-200 flex flex-col">
                  <span className="text-[10px] uppercase font-bold text-gray-500">
                    Hora en que Terminó el Corte
                  </span>
                  <span className="text-lg font-black font-mono text-amber-900 mt-1">
                    {state.corte.horaRegistro}
                  </span>
                  <span className="text-[11px] text-gray-500">
                    Corte terminado (el calentamiento a 40 °C continúa)
                  </span>
                </div>

                <div className="p-3.5 bg-white rounded-xl border border-amber-200 flex flex-col">
                  <span className="text-[10px] uppercase font-bold text-gray-500">
                    Tiempo que Tardó el Corte
                  </span>
                  <span className="text-lg font-black font-mono text-[#1B4E9B] mt-1">
                    {state.corte.tiempoTranscurridoDesdeCuajado}
                  </span>
                  <span className="text-[11px] text-gray-500">
                    Calculado desde el momento en que cuajó ({horaCuajadoComun})
                  </span>
                </div>
              </div>
            ) : (
              <div className="pt-2 border-t border-[#D6DEEA]/60 text-xs text-[#434655] flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-[#1B4E9B]">
                  info
                </span>
                <span>
                  Apenas termines de pasar la lira por toda la tina, presiona{' '}
                  <strong>"Ya terminé de cortar la cuajada!!"</strong>.
                </span>
              </div>
            )
          ) : (
            <div className="p-4 rounded-xl bg-amber-50/90 border-2 border-amber-300 flex flex-col gap-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
                <PopoverTimePicker
                  label="Hora de Corte Terminado"
                  icon="schedule"
                  hint="Toca para desplegar el selector flotante (hh:mm:ss)"
                  value={horaManualCorte}
                  onChange={setHoraManualCorte}
                />

                <InputField
                  label="Tiempo que Tardó el Corte"
                  icon="timer"
                  type="text"
                  disabled
                  readOnly
                  placeholder="Se calcula automáticamente"
                  hint={
                    horaCuajadoComun && horaCuajadoComun !== 'En espera'
                      ? `Calculado: ${horaCuajadoComun} → ${horaManualCorte}`
                      : 'Calculado automáticamente desde que cuajó la leche'
                  }
                  value={duracionCorteRecalculada.human}
                />
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  variant="primary"
                  size="md"
                  icon="save"
                  onClick={handleSaveManualCorte}
                >
                  Guardar cambios
                </Button>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* =========================================================================
          PASO 04: YA CALENTÉ LA MEZCLA HASTA LLEGAR A 40 GRADOS (CONCURRENTE)
      ========================================================================= */}
      <Card
        title="Ya calenté la mezcla hasta llegar a 40 grados"
        subtitle="Sube suavemente la temperatura agitando despacio, y confirma apenas el termómetro marque los 40.0 °C."
        icon="thermostat"
        badge={
          state.temperatura40?.alcanzado
            ? '✓ Ya llegó a 40 °C'
            : isPaso4Running
            ? '🔥 Calentando a 40 °C en vivo'
            : 'Esperando cuajado'
        }
        variant={
          state.temperatura40?.alcanzado
            ? 'success'
            : isPaso4Running
            ? 'warning'
            : 'default'
        }
        headerAction={
          <ConfirmButton
            label="Ya calenté la mezcla hasta llegar a 40 grados"
            confirmedLabel="✓ Ya llegó a 40 °C (Listo para Desuerar)"
            icon="thermostat"
            isConfirmed={Boolean(state.temperatura40?.alcanzado)}
            disabled={!state.cuajado?.registrado}
            onConfirm={handleYaCaliente40}
          />
        }
      >
        <div className="flex flex-col gap-4">
          {state.cuajado?.registrado ? (
            <TimerBanner
              title="Cronómetro de Calentamiento a 40 °C (Concurrente)"
              subtitle={
                state.temperatura40?.alcanzado
                  ? `Llegó a ${
                      state.temperatura40.temperaturaAlcanzada?.toFixed(1) ||
                      '40.0'
                    } °C a las ${state.temperatura40.horaRegistro} (tardó ${
                      state.temperatura40.tiempoCalentamiento40
                    } desde el cuajado).`
                  : `Iniciado concurrentemente con el cuajado a las ${horaCuajadoComun}. Agita suavemente mientras sube la temperatura.`
              }
              formattedTime={
                state.temperatura40?.alcanzado
                  ? state.temperatura40.tiempoCalentamiento40 ||
                    timerPaso4.humanElapsed
                  : timerPaso4.formattedElapsed
              }
              isRunning={isPaso4Running}
              isCompleted={isPaso4Completed}
              statusLabel={
                state.temperatura40?.alcanzado
                  ? '40 °C alcanzados'
                  : 'Calentando a 40 °C en vivo'
              }
              targetLabel="Meta: 40.0 °C"
              variant="info"
            />
          ) : (
            <div className="p-3.5 rounded-xl bg-blue-50/60 border border-blue-200 text-xs text-blue-900 flex items-center gap-2">
              <span className="material-symbols-outlined text-[20px] text-[#1B4E9B]">
                hourglass_top
              </span>
              <span>
                El cronómetro de calentamiento iniciará automáticamente junto con
                el corte en cuanto confirmes el cuajado en el Paso 2.
              </span>
            </div>
          )}

          <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-300 flex flex-wrap items-center justify-between gap-2 min-h-[48px]">
            <ManualEditToggle manual={Boolean(manualPaso4)} onChange={(checked: boolean) => setManualPaso4(checked)} />
            <Badge variant={manualPaso4 ? 'warning' : 'success'} size="sm">
              {manualPaso4 ? 'Modo Manual Activo' : 'Automático'}
            </Badge>
          </div>

          {!manualPaso4 ? (
            state.temperatura40?.alcanzado ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-[#D6DEEA]/70">
                <div className="p-3.5 bg-white rounded-xl border border-emerald-200 flex flex-col">
                  <span className="text-[10px] uppercase font-bold text-emerald-800">
                    Temperatura Medida
                  </span>
                  <span className="text-xl font-black font-mono text-emerald-700 mt-1">
                    {state.temperatura40.temperaturaAlcanzada?.toFixed(1) ||
                      '40.0'}{' '}
                    °C
                  </span>
                  <span className="text-[11px] text-gray-500">
                    En punto para sacar el suero
                  </span>
                </div>

                <div className="p-3.5 bg-white rounded-xl border border-emerald-200 flex flex-col">
                  <span className="text-[10px] uppercase font-bold text-emerald-800">
                    Hora a la que llegó a 40 °C
                  </span>
                  <span className="text-xl font-black font-mono text-gray-900 mt-1">
                    {state.temperatura40.horaRegistro}
                  </span>
                  <span className="text-[11px] text-gray-500">
                    Momento exacto en que se alcanzaron 40.0 °C
                  </span>
                </div>

                <div className="p-3.5 bg-white rounded-xl border border-emerald-200 flex flex-col">
                  <span className="text-[10px] uppercase font-bold text-emerald-800">
                    Tiempo de Calentamiento
                  </span>
                  <span className="text-xl font-black font-mono text-[#1B4E9B] mt-1">
                    {state.temperatura40.tiempoCalentamiento40 || 'Calculado'}
                  </span>
                  <span className="text-[11px] text-gray-500">
                    Calculado desde el cuajado ({horaCuajadoComun})
                  </span>
                </div>
              </div>
            ) : (
              <div className="pt-2 border-t border-[#D6DEEA]/60 text-xs text-[#434655] flex flex-wrap items-center justify-between gap-2">
                <span className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px] text-amber-600">
                    info
                  </span>
                  <span>
                    Calienta despacio la cuajada hasta 40.0 °C y presiona{' '}
                    <strong>
                      "Ya calenté la mezcla hasta llegar a 40 grados"
                    </strong>
                    .
                  </span>
                </span>
                <Badge variant="warning" size="sm">
                  Meta: 40.0 °C
                </Badge>
              </div>
            )
          ) : (
            <div className="p-4 rounded-xl bg-emerald-50/90 border-2 border-emerald-300 flex flex-col gap-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-start">
                <InputField
                  label="Temperatura Alcanzada"
                  icon="thermostat"
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  unit="°C"
                  placeholder="40.0"
                  targetHint="Meta: 40.0 °C (39.0 - 41.0)"
                  status={
                    tempManual40 === undefined
                      ? 'default'
                      : tempManual40 >= 39.0 && tempManual40 <= 41.0
                      ? 'valid'
                      : 'error'
                  }
                  value={tempManual40 ?? ''}
                  onChange={(e) =>
                    setTempManual40(
                      e.target.value === ''
                        ? undefined
                        : Number(e.target.value)
                    )
                  }
                />

                <PopoverTimePicker
                  label="Hora a la que llegó"
                  icon="schedule"
                  hint="Toca para desplegar el selector flotante (hh:mm:ss)"
                  value={horaManual40}
                  onChange={setHoraManual40}
                />

                <InputField
                  label="Tiempo de Calentamiento"
                  icon="timer"
                  type="text"
                  disabled
                  readOnly
                  placeholder="Se calcula automáticamente"
                  hint={
                    horaCuajadoComun && horaCuajadoComun !== 'En espera'
                      ? `Calculado: ${horaCuajadoComun} → ${horaManual40}`
                      : 'Calculado automáticamente desde que cuajó la leche'
                  }
                  value={duracion40Recalculada.human}
                />
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  variant="primary"
                  size="md"
                  icon="save"
                  onClick={handleSaveManual40}
                >
                  Guardar cambios
                </Button>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* =========================================================================
          PIE DE PÁGINA (FOOTER): TARJETA BLANCA LIMPIA CON ALTO CONTRASTE
      ========================================================================= */}
      <div className="p-5 rounded-2xl bg-white border border-[#D6DEEA] shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-[#1B4E9B] text-[28px]">
            filter_alt
          </span>
          <div>
            <h4 className="text-sm font-bold text-gray-900">
              Etapa 3: Desuerar y Escurrir (7 Cueros)
            </h4>
            <p className="text-xs text-gray-600 mt-0.5">
              Cuando la tina llegue a 40 °C, pasa de inmediato a extraer el
              suero.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <Button
            variant="primary"
            size="lg"
            iconRight="arrow_forward"
            disabled={!state.temperatura40?.alcanzado}
            onClick={onNextStage}
          >
            Ir a Etapa 3: Desuerar y Escurrir
          </Button>
        </div>
      </div>
    </div>
  );
};
