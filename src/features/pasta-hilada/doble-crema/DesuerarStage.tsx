import React, { useState, useEffect, useMemo } from 'react';
import { ManualEditToggle } from '../../../components/ui/ManualEditToggle';
import { DesuerarState, ProcessTimerState } from '../../../types';
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
  Button,
  Badge,
  PopoverTimePicker,
} from '../../../components/ui';

interface DesuerarStageProps {
  state: DesuerarState;
  onChange: (updater: (prev: DesuerarState) => DesuerarState) => void;
  timestamp40Grados?: number | null;
  hora40Grados?: string | null;
  processTimer: ProcessTimerState;
  onNextStage: () => void;
  onOpenReviewModal?: () => void;
  showToast: (msg: string, type?: 'success' | 'info' | 'warning') => void;
}

export const DesuerarStage: React.FC<DesuerarStageProps> = ({
  state,
  onChange,
  timestamp40Grados,
  hora40Grados,
  onNextStage,
  showToast,
}) => {
  // 1. Hora de inicio de la etapa (procedente de los 40 °C de la etapa anterior)
  const [entryTimestamp] = useState<number>(() => Date.now());

  const horaInicioEtapa =
    hora40Grados ||
    state.desuerado.hora40GradosReferencia ||
    state.desuerado.horaInicio ||
    'En espera';

  const tsInicioEtapa = timestamp40Grados || entryTimestamp;

  // Estados de modo manual para cada uno de los 3 pasos
  const [manualPaso1, setManualPaso1] = useState<boolean>(
    Boolean(state.desuerado.esManual)
  );
  const [manualPaso2, setManualPaso2] = useState<boolean>(
    Boolean(state.escurrido?.esManualPaso2)
  );
  const [manualPaso3, setManualPaso3] = useState<boolean>(
    Boolean(state.escurrido?.esManualPaso3 || state.escurrido?.tiempoManual)
  );

  // Estados de edición para Paso 1 (Extracción del Suero)
  const [horaManualDesuerado, setHoraManualDesuerado] = useState<string>(
    state.desuerado.horaRegistro || getCurrentTimeString()
  );

  // Estados de edición para Paso 2 (Traslado a Camilla)
  const [horaManualCamilla, setHoraManualCamilla] = useState<string>(
    state.escurrido?.horaInicio || getCurrentTimeString()
  );

  // Estados de edición para Paso 3 (Fin de Escurrido y pH)
  const [horaManualFinEscurrido, setHoraManualFinEscurrido] = useState<string>(
    state.escurrido?.horaFin || getCurrentTimeString()
  );
  const [phPastaInput, setPhPastaInput] = useState<number>(
    state.escurrido?.phEscurrido || 0
  );

  // Sincronización cuando no está en modo edición manual
  useEffect(() => {
    if (!manualPaso1) {
      setHoraManualDesuerado(
        state.desuerado.horaRegistro || getCurrentTimeString()
      );
    }
  }, [manualPaso1, state.desuerado.horaRegistro]);

  useEffect(() => {
    if (!manualPaso2) {
      setHoraManualCamilla(
        state.escurrido?.horaInicio || getCurrentTimeString()
      );
    }
  }, [manualPaso2, state.escurrido?.horaInicio]);

  useEffect(() => {
    if (!manualPaso3) {
      setHoraManualFinEscurrido(
        state.escurrido?.horaFin || getCurrentTimeString()
      );
      setPhPastaInput(state.escurrido?.phEscurrido || 0);
    }
  }, [manualPaso3, state.escurrido?.horaFin, state.escurrido?.phEscurrido]);

  // =========================================================================
  // CRONÓMETRO PASO 1: TIEMPO EN SACAR EL SUERO
  // =========================================================================
  const timerPaso1 = useStageCountdown({
    startTimestamp: tsInicioEtapa,
    isRunning: !state.desuerado.registrado,
    isCompleted: Boolean(state.desuerado.registrado),
    targetMinutes: 10,
    completedDurationText: state.desuerado.tiempoDesuerado,
  });

  // =========================================================================
  // REFERENCIAS Y CRONÓMETRO CONCURRENTE PASO 3 (ESCURRIDO EN CAMILLA)
  // Inicia su cronómetro visual automáticamente en cuanto se confirma el Paso 2
  // =========================================================================
  const horaFinDesueradoRef =
    state.desuerado.horaRegistro || horaInicioEtapa;

  const tsPasoCamillaEfectivo = useMemo(() => {
    if (state.escurrido?.timestampInicio) {
      return state.escurrido.timestampInicio;
    }
    if (state.escurrido?.horaInicio) {
      const sec = timeStringToSecondsToday(state.escurrido.horaInicio);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return today.getTime() + sec * 1000;
    }
    return null;
  }, [state.escurrido?.timestampInicio, state.escurrido?.horaInicio]);

  const isPaso3Running = Boolean(
    state.escurrido?.iniciado &&
      !state.escurrido?.completado &&
      tsPasoCamillaEfectivo
  );
  const isPaso3Completed = Boolean(state.escurrido?.completado);

  const timerEscurridoPaso3 = useStageCountdown({
    startTimestamp: tsPasoCamillaEfectivo,
    isRunning: isPaso3Running,
    isCompleted: isPaso3Completed,
    targetMinutes: 15,
    completedDurationText: state.escurrido?.tiempoEscurrido,
  });

  // =========================================================================
  // RECÁLCULOS AUTOMÁTICOS DE DURACIONES (REGLA DE TRAZABILIDAD INDUSTRIAL)
  // =========================================================================

  // Paso 1: Duración = Hora de término de desuerado - Hora de inicio de etapa
  const duracionDesueradoRecalculada = useMemo(() => {
    if (!horaManualDesuerado) {
      return {
        human: state.desuerado.tiempoDesuerado || '0 s',
        seconds: state.desuerado.segundosDesuerado || 0,
      };
    }
    if (horaInicioEtapa && horaInicioEtapa !== 'En espera') {
      return computeDurationBetweenTimes(horaInicioEtapa, horaManualDesuerado);
    }
    return {
      human: state.desuerado.tiempoDesuerado || '0 s',
      seconds: state.desuerado.segundosDesuerado || 0,
    };
  }, [
    horaInicioEtapa,
    horaManualDesuerado,
    state.desuerado.tiempoDesuerado,
    state.desuerado.segundosDesuerado,
  ]);

  // Paso 2: Duración = Hora de paso a camilla - Hora en que se terminó de desuerar
  const duracionTrasladoRecalculada = useMemo(() => {
    if (!horaManualCamilla) {
      return {
        human: state.escurrido?.tiempoTraslado || '0 s',
        seconds: state.escurrido?.segundosTraslado || 0,
      };
    }
    if (horaFinDesueradoRef && horaFinDesueradoRef !== 'En espera') {
      return computeDurationBetweenTimes(horaFinDesueradoRef, horaManualCamilla);
    }
    return {
      human: state.escurrido?.tiempoTraslado || '0 s',
      seconds: state.escurrido?.segundosTraslado || 0,
    };
  }, [
    horaFinDesueradoRef,
    horaManualCamilla,
    state.escurrido?.tiempoTraslado,
    state.escurrido?.segundosTraslado,
  ]);

  // Paso 3: Duración = Hora de fin de escurrido - Hora de paso a camilla
  const horaPasoCamillaRef =
    state.escurrido?.horaInicio || horaFinDesueradoRef;

  const duracionEscurridoRecalculada = useMemo(() => {
    if (!horaManualFinEscurrido) {
      return {
        human: state.escurrido?.tiempoEscurrido || '0 s',
        seconds: state.escurrido?.segundosEscurrido || 0,
      };
    }
    if (horaPasoCamillaRef && horaPasoCamillaRef !== 'En espera') {
      return computeDurationBetweenTimes(
        horaPasoCamillaRef,
        horaManualFinEscurrido
      );
    }
    return {
      human: state.escurrido?.tiempoEscurrido || '0 s',
      seconds: state.escurrido?.segundosEscurrido || 0,
    };
  }, [
    horaPasoCamillaRef,
    horaManualFinEscurrido,
    state.escurrido?.tiempoEscurrido,
    state.escurrido?.segundosEscurrido,
  ]);

  // =========================================================================
  // VALIDACIÓN VISUAL DEL pH DE LA PASTA (Meta: 5.20 - 5.40, Objetivo: 5.30)
  // =========================================================================
  const currentPh = manualPaso3
    ? phPastaInput
    : state.escurrido?.phEscurrido || 0;
  const hasPhValue = currentPh > 0;
  const phEnRangoOptimo = hasPhValue && currentPh >= 5.2 && currentPh <= 5.4;
  const phFueraDeRango = hasPhValue && (currentPh < 5.2 || currentPh > 5.4);

  const phInputStatus = !hasPhValue
    ? 'default'
    : phEnRangoOptimo
    ? 'valid'
    : currentPh < 5.0 || currentPh > 5.6
    ? 'error'
    : 'warning';

  // =========================================================================
  // HANDLERS PASO 1: EXTRACCIÓN DEL SUERO ("¡Ya saqué el suero!")
  // =========================================================================
  const handleRecordDesueradoTime = () => {
    const nowTs = Date.now();
    const timeStr = getCurrentTimeString();
    const duracionStr =
      horaInicioEtapa && horaInicioEtapa !== 'En espera'
        ? computeDurationBetweenTimes(horaInicioEtapa, timeStr).human
        : formatHumanDuration(
            Math.max(1, Math.floor((nowTs - tsInicioEtapa) / 1000))
          );
    const elapsedSec =
      horaInicioEtapa && horaInicioEtapa !== 'En espera'
        ? computeDurationBetweenTimes(horaInicioEtapa, timeStr).seconds
        : Math.max(1, Math.floor((nowTs - tsInicioEtapa) / 1000));

    onChange((prev) => ({
      ...prev,
      temperaturaEn40Confirmada: true,
      desuerado: {
        ...prev.desuerado,
        registrado: true,
        horaRegistro: timeStr,
        horaInicio: horaInicioEtapa,
        timestampDesuerado: nowTs,
        tiempoDesuerado: duracionStr,
        segundosDesuerado: elapsedSec,
        hora40GradosReferencia: horaInicioEtapa,
        esManual: manualPaso1,
      },
    }));

    setHoraManualDesuerado(timeStr);

    showToast(
      `✓ Suero retirado a las ${timeStr} · Tardó ${duracionStr}`,
      'success'
    );
  };

  const handleSaveManualDesuerado = () => {
    const timeStr = formatTimeFromStep1(horaManualDesuerado);
    let duracionStr = state.desuerado.tiempoDesuerado || '0 s';
    let elapsedSec = state.desuerado.segundosDesuerado || 0;

    if (horaInicioEtapa && horaInicioEtapa !== 'En espera') {
      const diff = computeDurationBetweenTimes(horaInicioEtapa, timeStr);
      duracionStr = diff.human;
      elapsedSec = diff.seconds;
    }

    const sec = timeStringToSecondsToday(timeStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const manualTs = today.getTime() + sec * 1000;

    // Cascada de sincronización: si Paso 2 ya estaba registrado, recalcular tiempo de traslado
    let nuevoTiempoTraslado = state.escurrido?.tiempoTraslado;
    if (state.escurrido?.iniciado && state.escurrido?.horaInicio) {
      nuevoTiempoTraslado = computeDurationBetweenTimes(
        timeStr,
        state.escurrido.horaInicio
      ).human;
    }

    onChange((prev) => ({
      ...prev,
      desuerado: {
        ...prev.desuerado,
        registrado: true,
        horaRegistro: timeStr,
        horaInicio: horaInicioEtapa,
        timestampDesuerado: manualTs,
        tiempoDesuerado: duracionStr,
        segundosDesuerado: elapsedSec,
        hora40GradosReferencia: horaInicioEtapa,
        esManual: true,
      },
      escurrido: {
        ...prev.escurrido,
        tiempoTraslado: nuevoTiempoTraslado,
      },
    }));

    setManualPaso1(false);
    showToast(
      `✓ Hora de término de desuerado actualizada (${timeStr} · ${duracionStr}). Sincronizado.`,
      'success'
    );
  };

  // =========================================================================
  // HANDLERS PASO 2: TRASLADO A CAMILLA ("¡Ya pasé la pasta a la camilla de desuerado!")
  // =========================================================================
  const handleRecordPasoCamilla = () => {
    const nowTs = Date.now();
    const timeStr = getCurrentTimeString();
    const refHora = state.desuerado.horaRegistro || horaInicioEtapa;
    const duracionStr =
      refHora && refHora !== 'En espera'
        ? computeDurationBetweenTimes(refHora, timeStr).human
        : '0 s';
    const elapsedSec =
      refHora && refHora !== 'En espera'
        ? computeDurationBetweenTimes(refHora, timeStr).seconds
        : 0;

    onChange((prev) => ({
      ...prev,
      escurrido: {
        ...(prev.escurrido || {
          segundosEscurrido: 0,
          tiempoEscurrido: null,
          phEscurrido: 0,
          phEscurridoManual: false,
        }),
        iniciado: true,
        completado: false,
        horaInicio: timeStr,
        timestampInicio: nowTs,
        tiempoTraslado: duracionStr,
        segundosTraslado: elapsedSec,
        esManualPaso2: manualPaso2,
      },
    }));

    setHoraManualCamilla(timeStr);

    showToast(
      `✓ Pasta en camilla a las ${timeStr} · Traslado tardó ${duracionStr} · Inicia cronómetro de escurrido`,
      'info'
    );
  };

  const handleSaveManualPaso2 = () => {
    const timeStr = formatTimeFromStep1(horaManualCamilla);
    const refHora = state.desuerado.horaRegistro || horaInicioEtapa;
    let duracionStr = state.escurrido?.tiempoTraslado || '0 s';
    let elapsedSec = state.escurrido?.segundosTraslado || 0;

    if (refHora && refHora !== 'En espera') {
      const diff = computeDurationBetweenTimes(refHora, timeStr);
      duracionStr = diff.human;
      elapsedSec = diff.seconds;
    }

    const sec = timeStringToSecondsToday(timeStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const manualTs = today.getTime() + sec * 1000;

    // Cascada de sincronización: si Paso 3 ya estaba completado, recalcular tiempo de escurrido
    let nuevoTiempoEscurrido = state.escurrido?.tiempoEscurrido;
    if (state.escurrido?.completado && state.escurrido?.horaFin) {
      nuevoTiempoEscurrido = computeDurationBetweenTimes(
        timeStr,
        state.escurrido.horaFin
      ).human;
    }

    onChange((prev) => ({
      ...prev,
      escurrido: {
        ...(prev.escurrido || {
          segundosEscurrido: 0,
          tiempoEscurrido: null,
          phEscurrido: 0,
        }),
        iniciado: true,
        horaInicio: timeStr,
        timestampInicio: manualTs,
        tiempoTraslado: duracionStr,
        segundosTraslado: elapsedSec,
        tiempoEscurrido: nuevoTiempoEscurrido,
        esManualPaso2: true,
      },
    }));

    setManualPaso2(false);
    showToast(
      `✓ Hora de paso a camilla actualizada (${timeStr} · ${duracionStr}). Sincronizado.`,
      'success'
    );
  };

  // =========================================================================
  // HANDLERS PASO 3: FIN DE ESCURRIDO Y pH ("¡He terminado de escurrir!")
  // =========================================================================
  const handleRecordFinEscurrido = () => {
    const nowTs = Date.now();
    const timeStr = getCurrentTimeString();
    const refInicio = state.escurrido?.horaInicio || horaFinDesueradoRef;
    const duracionStr =
      refInicio && refInicio !== 'En espera'
        ? computeDurationBetweenTimes(refInicio, timeStr).human
        : '0 s';
    const elapsedSec =
      refInicio && refInicio !== 'En espera'
        ? computeDurationBetweenTimes(refInicio, timeStr).seconds
        : 0;

    const finalPh =
      Number(phPastaInput) > 0
        ? Number(phPastaInput)
        : state.escurrido?.phEscurrido || 5.3;

    onChange((prev) => ({
      ...prev,
      escurrido: {
        ...(prev.escurrido || {}),
        iniciado: true,
        completado: true,
        horaFin: timeStr,
        timestampFin: nowTs,
        tiempoEscurrido: duracionStr,
        segundosEscurrido: elapsedSec,
        phEscurrido: finalPh,
        esManualPaso3: manualPaso3,
      },
    }));

    setHoraManualFinEscurrido(timeStr);

    showToast(
      `✓ Escurrido terminado a las ${timeStr} · Tardó ${duracionStr} · pH: ${finalPh.toFixed(
        2
      )}`,
      'success'
    );
  };

  const handleSaveManualPaso3 = () => {
    const timeStr = formatTimeFromStep1(horaManualFinEscurrido);
    const refInicio = state.escurrido?.horaInicio || horaFinDesueradoRef;
    let duracionStr = state.escurrido?.tiempoEscurrido || '0 s';
    let elapsedSec = state.escurrido?.segundosEscurrido || 0;

    if (refInicio && refInicio !== 'En espera') {
      const diff = computeDurationBetweenTimes(refInicio, timeStr);
      duracionStr = diff.human;
      elapsedSec = diff.seconds;
    }

    const sec = timeStringToSecondsToday(timeStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const manualTs = today.getTime() + sec * 1000;

    const finalPh =
      Number(phPastaInput) > 0
        ? Number(phPastaInput)
        : state.escurrido?.phEscurrido || 5.3;

    onChange((prev) => ({
      ...prev,
      escurrido: {
        ...(prev.escurrido || {}),
        iniciado: true,
        completado: true,
        horaFin: timeStr,
        timestampFin: manualTs,
        tiempoEscurrido: duracionStr,
        segundosEscurrido: elapsedSec,
        phEscurrido: finalPh,
        esManualPaso3: true,
      },
    }));

    setManualPaso3(false);
    showToast(
      `✓ Datos de escurrido guardados (${timeStr} · ${duracionStr} · pH ${finalPh.toFixed(
        2
      )})`,
      'success'
    );
  };

  return (
    <div className="flex flex-col w-full p-4 lg:p-6 gap-6 bg-[#FFFFFF] min-h-[calc(100vh-4rem)] pb-12">
      <StageHeader
        stageNumber={3}
        totalStages={5}
        title="Sacar el Suero y Escurrir la Cuajada"
        productName="Queso Doble Crema"
        icon="filter_alt"
        isCompleted={Boolean(
          state.desuerado.registrado && state.escurrido?.completado
        )}
      />

      {/* Nota preventiva si no se había confirmado la hora de llegada a 40 °C en la etapa 2 */}
      {!hora40Grados &&
        !timestamp40Grados &&
        !state.desuerado.registrado && (
          <div className="p-4 rounded-xl bg-amber-50 border-2 border-amber-300 flex items-start gap-3">
            <span className="material-symbols-outlined text-amber-700 text-[22px] shrink-0 mt-0.5">
              info
            </span>
            <div className="text-xs text-amber-950">
              <p className="font-black">Nota de proceso:</p>
              <p className="mt-0.5 text-amber-900">
                La hora de inicio se toma desde el ingreso a esta pantalla (
                <strong>{horaInicioEtapa}</strong>). Al presionar{' '}
                <strong>"Confirmar: Ya saqué el suero"</strong> se guardará la
                duración exacta desde ese momento.
              </p>
            </div>
          </div>
        )}

      {/* =========================================================================
          PASO 01: EXTRACCIÓN DEL SUERO ("¡Ya saqué el suero!")
      ========================================================================= */}
      <Card
        title="¡Ya saqué el suero!"
        icon="filter_alt"
        badge={
          state.desuerado.registrado
            ? '✓ Ya saqué el suero'
            : 'Sacando el suero a 40 °C'
        }
        variant={state.desuerado.registrado ? 'success' : 'default'}
        headerAction={
          <ConfirmButton
            label="Confirmar: Ya saqué el suero"
            confirmedLabel="✓ Ya saqué el suero"
            icon="check_circle"
            isConfirmed={Boolean(state.desuerado.registrado)}
            onConfirm={handleRecordDesueradoTime}
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
            state.desuerado.registrado ? (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 pt-2 border-t border-[#D6DEEA]/70">
                <div className="p-3.5 bg-white rounded-xl border border-blue-200 flex flex-col">
                  <span className="text-[10px] uppercase font-bold text-gray-500">
                    Hora de Inicio (40 °C)
                  </span>
                  <span className="text-lg font-black font-mono text-[#1B4E9B] mt-1">
                    {horaInicioEtapa}
                  </span>
                  <span className="text-[11px] text-gray-500">
                    Punto de partida de la etapa
                  </span>
                </div>

                <div className="p-3.5 bg-white rounded-xl border border-amber-200 flex flex-col">
                  <span className="text-[10px] uppercase font-bold text-gray-500">
                    Hora en que se terminó de desuerar
                  </span>
                  <span className="text-lg font-black font-mono text-amber-900 mt-1">
                    {state.desuerado.horaRegistro}
                  </span>
                  <span className="text-[11px] text-gray-500">
                    Momento en que se retiró el suero
                  </span>
                </div>

                <div className="p-3.5 bg-white rounded-xl border border-amber-200 flex flex-col">
                  <span className="text-[10px] uppercase font-bold text-gray-500">
                    Tiempo en sacar el suero
                  </span>
                  <span className="text-lg font-black font-mono text-[#1B4E9B] mt-1">
                    {state.desuerado.tiempoDesuerado}
                  </span>
                  <span className="text-[11px] text-gray-500">
                    Calculado desde el inicio de etapa
                  </span>
                </div>

                <div className="p-3.5 bg-white rounded-xl border border-emerald-200 flex flex-col">
                  <span className="text-[10px] uppercase font-bold text-emerald-800">
                    Temperatura de la Tina
                  </span>
                  <span className="text-lg font-black font-mono text-emerald-700 mt-1">
                    {state.temperaturaVerificada.toFixed(1)} °C
                  </span>
                  <span className="text-[11px] text-emerald-800 font-bold">
                    ✓ 40 °C Verificados
                  </span>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-[#D6DEEA]/60">
                <div className="p-3.5 bg-white rounded-xl border border-blue-200 flex flex-col justify-between">
                  <span className="text-[10px] uppercase font-bold text-gray-500">
                    Hora de Inicio de Etapa
                  </span>
                  <span className="text-xl font-black font-mono text-[#1B4E9B] mt-1">
                    {horaInicioEtapa}
                  </span>
                  <span className="text-[11px] text-gray-500">
                    Contando tiempo de desuerado...
                  </span>
                </div>

                <div className="p-3.5 bg-white rounded-xl border border-amber-200 flex flex-col justify-between">
                  <span className="text-[10px] uppercase font-bold text-amber-900">
                    Tiempo Transcurrido
                  </span>
                  <span className="text-2xl font-black font-mono text-amber-800 mt-1">
                    {timerPaso1.formattedElapsed}
                  </span>
                  <span className="text-[11px] text-gray-500">
                    Retirando el suero de la tina
                  </span>
                </div>

                <div className="p-3.5 bg-white rounded-xl border border-emerald-200 flex flex-col justify-between">
                  <span className="text-[10px] uppercase font-bold text-emerald-800">
                    Temperatura de Tina
                  </span>
                  <span className="text-xl font-black font-mono text-emerald-700 mt-1">
                    {state.temperaturaVerificada.toFixed(1)} °C
                  </span>
                  <span className="text-[11px] text-emerald-800 font-bold">
                    ✓ En punto para desuerar
                  </span>
                </div>
              </div>
            )
          ) : (
            <div className="p-4 rounded-xl bg-amber-50/90 border-2 border-amber-300 flex flex-col gap-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
                {/* 1. Hora en que se terminó de desuerar (EVENTO EDITABLE CON POPOVER) */}
                <PopoverTimePicker
                  label="Hora en que se terminó de desuerar"
                  icon="schedule"
                  value={horaManualDesuerado}
                  onChange={setHoraManualDesuerado}
                />

                {/* 2. Tiempo en sacar el suero (DURACIÓN SOLO LECTURA BLOQUEADA) */}
                <InputField
                  label="Tiempo en sacar el suero"
                  icon="timer"
                  type="text"
                  disabled
                  readOnly
                  placeholder="Se calcula automáticamente"
                  hint={
                    horaInicioEtapa && horaInicioEtapa !== 'En espera'
                      ? `Calculado: ${horaInicioEtapa} → ${horaManualDesuerado}`
                      : 'Calculado automáticamente desde la hora de inicio de etapa'
                  }
                  value={duracionDesueradoRecalculada.human}
                />
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  variant="primary"
                  size="md"
                  icon="save"
                  onClick={handleSaveManualDesuerado}
                >
                  Guardar cambios
                </Button>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* =========================================================================
          PASO 02: TRASLADO A CAMILLA / BANDEJA ("¡Ya pasé la pasta a la camilla de desuerado!")
      ========================================================================= */}
      <Card
        title="¡Ya pasé la pasta a la camilla de desuerado!"
        icon="move_to_inbox"
        badge={
          state.escurrido?.iniciado
            ? '✓ Pasta en camilla'
            : state.desuerado.registrado
            ? 'Listo para pasar a camilla'
            : 'Esperando suero retirado'
        }
        variant={
          state.escurrido?.iniciado
            ? 'success'
            : state.desuerado.registrado
            ? 'warning'
            : 'default'
        }
        headerAction={
          <ConfirmButton
            label="Confirmar: Ya pasé a camilla"
            confirmedLabel="✓ Pasta en camilla"
            icon="task_alt"
            isConfirmed={Boolean(state.escurrido?.iniciado)}
            disabled={!state.desuerado.registrado}
            onConfirm={handleRecordPasoCamilla}
          />
        }
      >
        <div className="flex flex-col gap-4">
          <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-300 flex flex-wrap items-center justify-between gap-2 min-h-[48px]">
            <ManualEditToggle manual={Boolean(manualPaso2)} onChange={(checked: boolean) => setManualPaso2(checked)} />
            <Badge variant={manualPaso2 ? 'warning' : 'neutral'} size="sm">
              {manualPaso2 ? 'Modo Manual Activo' : 'Automático'}
            </Badge>
          </div>

          {!manualPaso2 ? (
            state.escurrido?.iniciado ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-[#D6DEEA]/70">
                <div className="p-3.5 bg-white rounded-xl border border-gray-200 flex flex-col">
                  <span className="text-[10px] uppercase font-bold text-gray-500">
                    Hora en que se terminó de desuerar
                  </span>
                  <span className="text-lg font-black font-mono text-gray-800 mt-1">
                    {horaFinDesueradoRef}
                  </span>
                  <span className="text-[11px] text-gray-500">
                    Punto de inicio del traslado
                  </span>
                </div>

                <div className="p-3.5 bg-white rounded-xl border border-amber-200 flex flex-col">
                  <span className="text-[10px] uppercase font-bold text-gray-500">
                    Hora de paso a camilla
                  </span>
                  <span className="text-lg font-black font-mono text-amber-900 mt-1">
                    {state.escurrido?.horaInicio}
                  </span>
                  <span className="text-[11px] text-gray-500">
                    Momento de llegada a la camilla
                  </span>
                </div>

                <div className="p-3.5 bg-white rounded-xl border border-amber-200 flex flex-col">
                  <span className="text-[10px] uppercase font-bold text-gray-500">
                    Tiempo de traslado
                  </span>
                  <span className="text-lg font-black font-mono text-[#1B4E9B] mt-1">
                    {state.escurrido?.tiempoTraslado ||
                      duracionTrasladoRecalculada.human}
                  </span>
                  <span className="text-[11px] text-gray-500">
                    Calculado desde el término de desuerado
                  </span>
                </div>
              </div>
            ) : (
              <div className="pt-2 border-t border-[#D6DEEA]/60 text-xs text-[#434655] flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-[#1B4E9B]">
                  info
                </span>
                <span>
                  {state.desuerado.registrado
                    ? 'Traslada la pasta a la camilla de desuerado y presiona "Confirmar: Ya pasé a camilla" para iniciar el cronómetro del Paso 3.'
                    : 'Primero debes terminar de sacar el suero en el Paso 1 para poder registrar el paso a la camilla.'}
                </span>
              </div>
            )
          ) : (
            <div className="p-4 rounded-xl bg-amber-50/90 border-2 border-amber-300 flex flex-col gap-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
                {/* 1. Hora de paso a camilla (EVENTO EDITABLE CON POPOVER) */}
                <PopoverTimePicker
                  label="Hora de paso a camilla"
                  icon="schedule"
                  value={horaManualCamilla}
                  onChange={setHoraManualCamilla}
                />

                {/* 2. Tiempo de traslado (DURACIÓN SOLO LECTURA BLOQUEADA) */}
                <InputField
                  label="Tiempo de traslado"
                  icon="timer"
                  type="text"
                  disabled
                  readOnly
                  placeholder="Se calcula automáticamente"
                  hint={
                    horaFinDesueradoRef && horaFinDesueradoRef !== 'En espera'
                      ? `Calculado: ${horaFinDesueradoRef} → ${horaManualCamilla}`
                      : 'Calculado automáticamente desde que terminó el desuerado'
                  }
                  value={duracionTrasladoRecalculada.human}
                />
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  variant="primary"
                  size="md"
                  icon="save"
                  onClick={handleSaveManualPaso2}
                >
                  Guardar cambios
                </Button>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* =========================================================================
          PASO 03: FIN DEL ESCURRIDO Y MEDICIÓN DE pH ("¡He terminado de escurrir!")
      ========================================================================= */}
      <Card
        title="¡He terminado de escurrir!"
        icon="hourglass_bottom"
        badge={
          state.escurrido?.completado
            ? '✓ Escurrido Terminado'
            : isPaso3Running
            ? '⏳ Escurriendo en Camilla'
            : 'Esperando paso a camilla'
        }
        variant={
          state.escurrido?.completado
            ? 'success'
            : isPaso3Running
            ? 'warning'
            : 'default'
        }
      >
        <div className="flex flex-col gap-4">
          {/* CRONÓMETRO VISUAL AUTOMÁTICO EN VIVO (SE ACTIVA EN CUANTO LA PASTA LLEGA A LA CAMILLA) */}
          {state.escurrido?.iniciado ? (
            <TimerBanner
              title="Cronómetro de Escurrido en Camilla"
              subtitle={
                state.escurrido?.completado
                  ? `Escurrido finalizado a las ${state.escurrido.horaFin} (tardó ${state.escurrido.tiempoEscurrido}).`
                  : `Iniciado automáticamente a las ${state.escurrido.horaInicio}. La masa está escurriendo en la camilla.`
              }
              formattedTime={
                state.escurrido?.completado
                  ? state.escurrido.tiempoEscurrido ||
                    timerEscurridoPaso3.humanElapsed
                  : timerEscurridoPaso3.formattedElapsed
              }
              isRunning={isPaso3Running}
              isCompleted={isPaso3Completed}
              statusLabel={
                state.escurrido?.completado
                  ? 'Escurrido completado'
                  : 'Escurriendo pasta en vivo'
              }
              variant="warning"
            />
          ) : (
            <div className="p-3.5 rounded-xl bg-amber-50/60 border border-amber-200 text-xs text-amber-900 flex items-center gap-2">
              <span className="material-symbols-outlined text-[20px] text-amber-700">
                hourglass_top
              </span>
              <span>
                El cronómetro de escurrido iniciará automáticamente en cuanto
                confirmes que pasaste la pasta a la camilla en el Paso 2.
              </span>
            </div>
          )}

          <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-300 flex flex-wrap items-center justify-between gap-2 min-h-[48px]">
            <ManualEditToggle manual={Boolean(manualPaso3)} onChange={(checked: boolean) => setManualPaso3(checked)} />
            <Badge variant={manualPaso3 ? 'warning' : 'success'} size="sm">
              {manualPaso3 ? 'Modo Manual Activo' : 'Automático'}
            </Badge>
          </div>

          {!manualPaso3 ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-[#D6DEEA]/70">
              {/* Hora fin de escurrido */}
              <div className="p-3.5 bg-white rounded-xl border border-gray-200 flex flex-col justify-between">
                <span className="text-[10px] uppercase font-bold text-gray-500">
                  Hora de fin de escurrido
                </span>
                <span className="text-lg font-black font-mono text-gray-900 mt-1">
                  {state.escurrido?.horaFin || '--:--:--'}
                </span>
                <span className="text-[11px] text-gray-500">
                  {state.escurrido?.completado
                    ? 'Momento en que finalizó el escurrido'
                    : 'Pendiente finalizar'}
                </span>
              </div>

              {/* Tiempo de escurrido en camilla */}
              <div className="p-3.5 bg-white rounded-xl border border-amber-200 flex flex-col justify-between">
                <span className="text-[10px] uppercase font-bold text-gray-500">
                  Tiempo de escurrido en camilla
                </span>
                <span className="text-lg font-black font-mono text-[#1B4E9B] mt-1">
                  {state.escurrido?.tiempoEscurrido ||
                    (isPaso3Running
                      ? timerEscurridoPaso3.formattedElapsed
                      : '--')}
                </span>
                <span className="text-[11px] text-gray-500">
                  Calculado desde el paso a camilla (
                  {state.escurrido?.horaInicio || '--'})
                </span>
              </div>

              {/* pH de la pasta (Editable Numérico con alerta visual roja/ámbar y placeholder limpio) */}
              <div
                className={`p-3.5 rounded-xl border-2 transition-all flex flex-col justify-between gap-2 ${
                  !hasPhValue
                    ? 'bg-white border-blue-200/90'
                    : phEnRangoOptimo
                    ? 'bg-emerald-50/70 border-emerald-400'
                    : currentPh < 5.0 || currentPh > 5.6
                    ? 'bg-red-50 border-red-400 shadow-sm'
                    : 'bg-amber-50 border-amber-400 shadow-sm'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-black text-[#191c1e] flex items-center gap-1">
                    <span className="material-symbols-outlined text-[16px] text-[#1B4E9B]">
                      science
                    </span>
                    pH de la Pasta
                  </span>
                  <Badge
                    variant={
                      !hasPhValue
                        ? 'neutral'
                        : phEnRangoOptimo
                        ? 'success'
                        : currentPh < 5.0 || currentPh > 5.6
                        ? 'danger'
                        : 'warning'
                    }
                    size="sm"
                    pulse={phEnRangoOptimo}
                  >
                    {!hasPhValue
                      ? 'Meta: 5.2 - 5.4'
                      : phEnRangoOptimo
                      ? 'Óptimo (5.2–5.4)'
                      : currentPh < 5.2
                      ? 'Bajo (<5.2)'
                      : 'Alto (>5.4)'}
                  </Badge>
                </div>

                {state.escurrido?.completado ? (
                  <div>
                    <span className="text-2xl font-black font-mono text-emerald-800 block">
                      {state.escurrido.phEscurrido > 0
                        ? `${state.escurrido.phEscurrido.toFixed(2)} pH`
                        : '5.30 pH'}
                    </span>
                    <span className="text-[11px] text-gray-500 font-semibold block mt-1">
                      Medido antes de pasar a la hiladora
                    </span>
                  </div>
                ) : (
                  <InputField
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="4.0"
                    max="7.0"
                    unit="pH"
                    placeholder="Ej: 5.30"
                    targetHint="Meta: 5.2 - 5.4 (Obj. 5.30)"
                    status={phInputStatus}
                    value={phPastaInput > 0 ? phPastaInput : ''}
                    onChange={(e) => {
                      const val = e.target.value
                        ? parseFloat(e.target.value)
                        : 0;
                      setPhPastaInput(val);
                      onChange((prev) => ({
                        ...prev,
                        escurrido: {
                          ...(prev.escurrido || {}),
                          phEscurrido: val,
                        },
                      }));
                    }}
                  />
                )}
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-emerald-50/90 border-2 border-emerald-300 flex flex-col gap-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-start">
                {/* 1. Hora de fin de escurrido (EVENTO EDITABLE CON POPOVER) */}
                <PopoverTimePicker
                  label="Hora de fin de escurrido"
                  icon="schedule"
                  value={horaManualFinEscurrido}
                  onChange={setHoraManualFinEscurrido}
                />

                {/* 2. Tiempo de escurrido en camilla (DURACIÓN SOLO LECTURA BLOQUEADA) */}
                <InputField
                  label="Tiempo de escurrido en camilla"
                  icon="timer"
                  type="text"
                  disabled
                  readOnly
                  placeholder="Se calcula automáticamente"
                  hint={
                    horaPasoCamillaRef && horaPasoCamillaRef !== 'En espera'
                      ? `Calculado: ${horaPasoCamillaRef} → ${horaManualFinEscurrido}`
                      : 'Calculado automáticamente desde el paso a camilla'
                  }
                  value={duracionEscurridoRecalculada.human}
                />

                {/* 3. pH de la pasta (Editable Numérico con alerta visual y placeholder limpio) */}
                <div
                  className={`p-3 rounded-xl border-2 transition-all flex flex-col gap-1.5 ${
                    !hasPhValue
                      ? 'bg-white border-blue-200/90'
                      : phEnRangoOptimo
                      ? 'bg-emerald-50/70 border-emerald-400'
                      : currentPh < 5.0 || currentPh > 5.6
                      ? 'bg-red-50 border-red-400 shadow-sm'
                      : 'bg-amber-50 border-amber-400 shadow-sm'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-xs font-black text-[#191c1e] flex items-center gap-1">
                      <span className="material-symbols-outlined text-[16px] text-[#1B4E9B]">
                        science
                      </span>
                      pH de la pasta
                    </label>
                    <Badge
                      variant={
                        !hasPhValue
                          ? 'neutral'
                          : phEnRangoOptimo
                          ? 'success'
                          : currentPh < 5.0 || currentPh > 5.6
                          ? 'danger'
                          : 'warning'
                      }
                      size="sm"
                    >
                      Meta: 5.2 - 5.4
                    </Badge>
                  </div>

                  <InputField
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="4.0"
                    max="7.0"
                    unit="pH"
                    placeholder="Ej: 5.30"
                    targetHint="Meta: 5.2 - 5.4"
                    status={phInputStatus}
                    value={phPastaInput > 0 ? phPastaInput : ''}
                    onChange={(e) => {
                      const val = e.target.value
                        ? parseFloat(e.target.value)
                        : 0;
                      setPhPastaInput(val);
                    }}
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  variant="primary"
                  size="md"
                  icon="save"
                  onClick={handleSaveManualPaso3}
                >
                  Guardar cambios
                </Button>
              </div>
            </div>
          )}

          {/* Confirmación al final: primero se registran los datos de la tarjeta */}
          <ConfirmButton
            label="Confirmar: He terminado de escurrir"
            confirmedLabel="✓ Escurrido Terminado"
            icon="verified"
            isConfirmed={Boolean(state.escurrido?.completado)}
            disabled={!state.escurrido?.iniciado}
            onConfirm={handleRecordFinEscurrido}
            fullWidth
          />
        </div>
      </Card>

      {/* Siguiente Etapa: Hilar (Sin botón de Ver Resumen, exclusivo para etapas finales) */}
      <div className="p-5 rounded-2xl bg-white border border-[#D6DEEA] shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-[#1B4E9B] flex items-center justify-center shrink-0 border border-blue-200">
            <span className="material-symbols-outlined text-[26px]">waves</span>
          </div>
          <div>
            <h4 className="font-black text-sm sm:text-base text-gray-900">
              ¿Listo el desuerado y el escurrido?
            </h4>
            <p className="text-xs text-gray-500">
              Pasa a hacer la prueba de hilado, agregar la sal e hilar la masa.
            </p>
          </div>
        </div>

        <Button
          variant="primary"
          size="lg"
          iconRight="arrow_forward"
          onClick={onNextStage}
          disabled={!state.escurrido?.completado}
        >
          Pasar a Etapa 4: Hilar
        </Button>
      </div>
    </div>
  );
};
