import React, { useState } from 'react';
import { MaduracionYFiltradoYogurGriegoState } from '../../../types/yogur_griego';
import { ProcessTimerState } from '../../../types';
import {
  computeDurationBetweenTimes,
  formatHumanDuration,
  formatTimeFromStep1,
  getCurrentTimeString,
  timeStringToTimestampToday,
} from '../../../utils/timer';
import { useStageCountdown } from '../../../hooks/useStageCountdown';
import {
  StageHeader,
  Card,
  InputField,
  TimerBanner,
  Button,
  PopoverTimePicker,
  Badge,
} from '../../../components/ui';

interface MaduracionYFiltradoStageGriegoProps {
  state: MaduracionYFiltradoYogurGriegoState;
  onChange: (
    updater: (
      prev: MaduracionYFiltradoYogurGriegoState
    ) => MaduracionYFiltradoYogurGriegoState
  ) => void;
  litrosLecheBase?: number;
  processTimer: ProcessTimerState;
  onNextStage: () => void;
  onOpenReviewModal: () => void;
  showToast: (msg: string, type?: 'success' | 'info' | 'warning') => void;
}

function formatDaysHours(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const days = Math.floor(safe / 86400);
  const hours = Math.floor((safe % 86400) / 3600);
  const mins = Math.floor((safe % 3600) / 60);
  if (days > 0) {
    return `${days} d ${hours} h ${mins} min`;
  }
  return `${hours} h ${mins} min`;
}

export const MaduracionYFiltradoStageGriego: React.FC<
  MaduracionYFiltradoStageGriegoProps
> = ({ state, onChange, litrosLecheBase = 0, onNextStage, showToast }) => {
  // Estado manual Paso 1 (Cuarto Frío)
  const [manualPaso1, setManualPaso1] = useState<boolean>(false);
  const [horaManualInicioFrio, setHoraManualInicioFrio] = useState<string>(
    state.cuartoFrio.horaInicio || '08:00:00 am'
  );
  const [horaManualFinFrio, setHoraManualFinFrio] = useState<string>(
    state.cuartoFrio.horaFin || getCurrentTimeString()
  );

  // Estado manual Paso 2 (Filtrado en Telas)
  const [manualPaso2, setManualPaso2] = useState<boolean>(false);
  const [horaManualInicioFiltrado, setHoraManualInicioFiltrado] =
    useState<string>(state.filtradoTelas.horaInicio || '08:00:00 am');
  const [horaManualFinFiltrado, setHoraManualFinFiltrado] = useState<string>(
    state.filtradoTelas.horaFin || getCurrentTimeString()
  );

  // 1. Reloj de Cuarto Frío (1 a 2 Días = 24 h a 48 h)
  const startTsCuartoFrio = React.useMemo(() => {
    if (state.cuartoFrio.timestampInicio) {
      return state.cuartoFrio.timestampInicio;
    }
    if (state.cuartoFrio.horaInicio) {
      return timeStringToTimestampToday(state.cuartoFrio.horaInicio);
    }
    return null;
  }, [state.cuartoFrio.timestampInicio, state.cuartoFrio.horaInicio]);

  const cuartoFrioTimer = useStageCountdown({
    isRunning: Boolean(
      state.cuartoFrio.iniciado && !state.cuartoFrio.completado
    ),
    isCompleted: Boolean(state.cuartoFrio.completado),
    startTimestamp: startTsCuartoFrio,
    targetMinutes: 24 * 60,
    completedDurationText: state.cuartoFrio.tiempoTranscurrido,
  });

  // 2. Reloj de Filtrado en Telas (~2 Días = 48 h)
  const startTsFiltrado = React.useMemo(() => {
    if (state.filtradoTelas.timestampInicio) {
      return state.filtradoTelas.timestampInicio;
    }
    if (state.filtradoTelas.horaInicio) {
      return timeStringToTimestampToday(state.filtradoTelas.horaInicio);
    }
    return null;
  }, [state.filtradoTelas.timestampInicio, state.filtradoTelas.horaInicio]);

  const filtradoTimer = useStageCountdown({
    isRunning: Boolean(
      state.filtradoTelas.iniciado && !state.filtradoTelas.completado
    ),
    isCompleted: Boolean(state.filtradoTelas.completado),
    startTimestamp: startTsFiltrado,
    targetMinutes: 48 * 60,
    completedDurationText: state.filtradoTelas.tiempoTranscurrido,
  });

  // --- Handlers Paso 1: Cuarto Frío ---
  const handleStartCuartoFrio = () => {
    const timeStr = getCurrentTimeString();
    const now = Date.now();
    onChange((prev) => ({
      ...prev,
      cuartoFrio: {
        ...prev.cuartoFrio,
        iniciado: true,
        completado: false,
        horaInicio: timeStr,
        timestampInicio: now,
      },
    }));
    showToast(
      `⏱ Entrada a cuarto frío registrada a las ${timeStr}. Permanencia requerida: 1 a 2 días.`,
      'info'
    );
  };

  const handleConfirmFinCuartoFrio = () => {
    const timeStr = getCurrentTimeString();
    const now = Date.now();
    const start = state.cuartoFrio.timestampInicio || now;
    const elapsedSec = Math.max(1, Math.floor((now - start) / 1000));
    const durStr = formatDaysHours(elapsedSec);

    onChange((prev) => ({
      ...prev,
      cuartoFrio: {
        ...prev.cuartoFrio,
        completado: true,
        cumplio24h: true,
        horaFin: timeStr,
        tiempoTranscurrido: durStr,
      },
    }));

    setHoraManualFinFrio(timeStr);
    showToast(
      `✓ Maduración en cuarto frío completada (${durStr}). Ya puedes iniciar el escurrido en telas.`,
      'success'
    );
  };

  const handleSaveManualPaso1 = () => {
    const startFmt = formatTimeFromStep1(horaManualInicioFrio);
    const finFmt = formatTimeFromStep1(horaManualFinFrio);
    const durStr = computeDurationBetweenTimes(startFmt, finFmt).human;

    onChange((prev) => ({
      ...prev,
      cuartoFrio: {
        ...prev.cuartoFrio,
        iniciado: true,
        completado: true,
        cumplio24h: true,
        horaInicio: startFmt,
        horaFin: finFmt,
        tiempoTranscurrido: durStr,
        esManual: true,
      },
    }));

    setManualPaso1(false);
    showToast(
      `✓ Horarios de permanencia en frío actualizados (${durStr}).`,
      'success'
    );
  };

  // --- Handlers Paso 2: Filtrado y Escurrido en Telas ---
  const handleStartFiltradoTelas = () => {
    const timeStr = getCurrentTimeString();
    const now = Date.now();

    onChange((prev) => ({
      ...prev,
      filtradoTelas: {
        ...prev.filtradoTelas,
        iniciado: true,
        completado: false,
        horaInicio: timeStr,
        timestampInicio: now,
      },
    }));

    showToast(
      `⏱ Escurrido en lienzos iniciado a las ${timeStr}. Control de ~2 días (48 h) activo.`,
      'info'
    );
  };

  const handleConfirmDrenadoFinalizado = () => {
    const timeStr = getCurrentTimeString();
    const now = Date.now();
    const start = state.filtradoTelas.timestampInicio || now;
    const elapsedSec = Math.max(1, Math.floor((now - start) / 1000));
    const durStr = formatDaysHours(elapsedSec);

    onChange((prev) => ({
      ...prev,
      filtradoTelas: {
        ...prev.filtradoTelas,
        completado: true,
        horaFin: timeStr,
        tiempoTranscurrido: durStr,
      },
    }));

    setHoraManualFinFiltrado(timeStr);
    showToast(
      `✓ Drenado y escurrido en telas finalizado (${durStr}). Masa espesa lista para batido.`,
      'success'
    );
  };

  const handleSaveManualPaso2 = () => {
    const startFmt = formatTimeFromStep1(horaManualInicioFiltrado);
    const finFmt = formatTimeFromStep1(horaManualFinFiltrado);
    const durStr = computeDurationBetweenTimes(startFmt, finFmt).human;

    onChange((prev) => ({
      ...prev,
      filtradoTelas: {
        ...prev.filtradoTelas,
        iniciado: true,
        completado: true,
        horaInicio: startFmt,
        horaFin: finFmt,
        tiempoTranscurrido: durStr,
        esManual: true,
      },
    }));

    setManualPaso2(false);
    showToast(
      `✓ Horarios de escurrido en telas actualizados (${durStr}).`,
      'success'
    );
  };

  const duracionManualPaso1Calculada = React.useMemo(() => {
    if (!horaManualInicioFrio || !horaManualFinFrio) return '0 h';
    return computeDurationBetweenTimes(
      formatTimeFromStep1(horaManualInicioFrio),
      formatTimeFromStep1(horaManualFinFrio)
    ).human;
  }, [horaManualInicioFrio, horaManualFinFrio]);

  const duracionManualPaso2Calculada = React.useMemo(() => {
    if (!horaManualInicioFiltrado || !horaManualFinFiltrado) return '0 h';
    return computeDurationBetweenTimes(
      formatTimeFromStep1(horaManualInicioFiltrado),
      formatTimeFromStep1(horaManualFinFiltrado)
    ).human;
  }, [horaManualInicioFiltrado, horaManualFinFiltrado]);

  return (
    <div className="flex flex-col w-full p-4 lg:p-6 gap-5 bg-[#FFFFFF] min-h-[calc(100vh-4rem)] pb-14">
      {/* CABECERA ESTÁNDAR MAESTRA */}
      <StageHeader
        stageNumber={3}
        totalStages={5}
        lineName="Línea de Fermentados · Yogur Griego"
        title="3. Cuarto Frío y Escurrido en Telas"
        subtitle="Reposo en frío entre 1 y 2 días y escurrido natural con lienzos por ~2 días (48 horas) para concentrar el yogur sin adición de espesantes ni crema."
        standardBadge="NTC-805"
        metrics={[
          {
            icon: 'water_drop',
            label: 'Leche Base Griego',
            value: `${litrosLecheBase} L`,
            tone: 'default',
          },
          {
            icon: 'ac_unit',
            label: 'Maduración Frío (1-2 Días)',
            value: state.cuartoFrio.completado
              ? state.cuartoFrio.tiempoTranscurrido || 'Completado'
              : state.cuartoFrio.iniciado
              ? formatDaysHours(cuartoFrioTimer.elapsedSeconds)
              : '1 a 2 Días',
            tone: state.cuartoFrio.completado
              ? 'emerald'
              : state.cuartoFrio.iniciado
              ? 'amber'
              : 'default',
          },
          {
            icon: 'filter_alt',
            label: 'Escurrido en Telas (2 Días)',
            value: state.filtradoTelas.completado
              ? state.filtradoTelas.tiempoTranscurrido || 'Finalizado'
              : state.filtradoTelas.iniciado
              ? formatDaysHours(filtradoTimer.elapsedSeconds)
              : '~48 Horas',
            tone: state.filtradoTelas.completado
              ? 'emerald'
              : state.filtradoTelas.iniciado
              ? 'amber'
              : 'default',
          },
        ]}
      />

      {/* ========================================================================= */}
      {/* PASO 01: MADURACIÓN EN CUARTO FRÍO (1 A 2 DÍAS)                           */}
      {/* ========================================================================= */}
      <Card
        stepBadge="Paso 01"
        title="Maduración en Cuarto Frío (1 a 2 Días)"
        subtitle="Control exclusivo de tiempo transcurrido para la estabilización y firmeza de la cuajada antes de su drenado."
        icon="ac_unit"
        tone={state.cuartoFrio.completado ? 'completed' : state.cuartoFrio.iniciado ? 'active' : 'default'}
        statusBadge={
          state.cuartoFrio.completado
            ? { label: `Listo (${state.cuartoFrio.horaFin})`, variant: 'success' }
            : state.cuartoFrio.iniciado
            ? { label: 'En Cuarto Frío', variant: 'info', pulse: true }
            : { label: 'Por Iniciar', variant: 'neutral' }
        }
        headerRight={
          <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-bold text-gray-700 bg-white px-3 py-1.5 rounded-xl border border-gray-300 shadow-2xs hover:border-amber-400 transition-all">
            <input
              type="checkbox"
              checked={manualPaso1}
              onChange={(e) => setManualPaso1(e.target.checked)}
              className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 cursor-pointer"
            />
            <span>Habilitar edición manual</span>
          </label>
        }
      >
        {(state.cuartoFrio.iniciado || state.cuartoFrio.completado) && (
          <TimerBanner
            label="Tiempo de Maduración en Cuarto Frío"
            sublabel="Rango objetivo: 1 a 2 días (24 h a 48 h)"
            formattedTime={
              state.cuartoFrio.completado
                ? state.cuartoFrio.tiempoTranscurrido || 'Listo'
                : formatDaysHours(cuartoFrioTimer.elapsedSeconds)
            }
            targetLabel="1 - 2 Días"
            progressPercent={cuartoFrioTimer.progressPercent}
            isRunning={state.cuartoFrio.iniciado && !state.cuartoFrio.completado}
            isCompleted={state.cuartoFrio.completado}
            isOvertime={cuartoFrioTimer.isOvertime}
            className="mb-4"
          />
        )}

        {!manualPaso1 ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-white border border-[#D6DEEA]">
                <span className="text-[10px] uppercase font-bold text-gray-500 block">
                  HORA DE ENTRADA A FRÍO
                </span>
                <span className="text-xl font-mono font-black text-gray-900 mt-1 block">
                  {state.cuartoFrio.horaInicio || '--:--'}
                </span>
              </div>

              <div className="p-4 rounded-xl bg-white border border-[#D6DEEA]">
                <span className="text-[10px] uppercase font-bold text-gray-500 block">
                  HORA DE SALIDA DE FRÍO
                </span>
                <span className="text-xl font-mono font-black text-emerald-900 mt-1 block">
                  {state.cuartoFrio.horaFin ||
                    (state.cuartoFrio.iniciado ? 'Madurando...' : 'Pendiente')}
                </span>
              </div>

              <div className="p-4 rounded-xl bg-blue-50 border border-blue-200">
                <span className="text-[10px] uppercase font-bold text-blue-800 block">
                  DURACIÓN TRANSCURRIDA (SOLO LECTURA)
                </span>
                <span className="text-xl font-mono font-black text-blue-950 mt-1 block">
                  {state.cuartoFrio.completado
                    ? state.cuartoFrio.tiempoTranscurrido
                    : state.cuartoFrio.iniciado
                    ? formatDaysHours(cuartoFrioTimer.elapsedSeconds)
                    : '1 a 2 días'}
                </span>
              </div>
            </div>

            <div className="pt-2">
              {!state.cuartoFrio.iniciado ? (
                <Button
                  variant="primary"
                  size="xl"
                  icon="kitchen"
                  onClick={handleStartCuartoFrio}
                  className="font-bold shadow-md"
                >
                  Confirmar Entrada a Cuarto Frío
                </Button>
              ) : !state.cuartoFrio.completado ? (
                <Button
                  variant="primary"
                  size="xl"
                  icon="check_circle"
                  onClick={handleConfirmFinCuartoFrio}
                  className="bg-[#5FAF32] hover:bg-[#4E9628] text-white font-bold shadow-md"
                >
                  Confirmar: Fin de Maduración en Cuarto Frío
                </Button>
              ) : (
                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-emerald-900 text-xs flex items-center gap-2">
                  <span className="material-symbols-outlined text-[20px] text-emerald-700">
                    verified
                  </span>
                  <span>
                    Maduración en frío finalizada a las <strong>{state.cuartoFrio.horaFin}</strong> ({state.cuartoFrio.tiempoTranscurrido}). Pasa al Paso 2 para escurrir en telas.
                  </span>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-amber-50/90 border-2 border-amber-300 flex flex-col gap-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-start">
              <PopoverTimePicker
                label="Hora de Entrada a Cuarto Frío"
                icon="schedule"
                value={horaManualInicioFrio}
                onChange={setHoraManualInicioFrio}
              />

              <PopoverTimePicker
                label="Hora de Salida de Cuarto Frío"
                icon="schedule"
                value={horaManualFinFrio}
                onChange={setHoraManualFinFrio}
              />

              <InputField
                label="Duración Transcurrida (Solo Lectura)"
                icon="timer"
                type="text"
                disabled
                readOnly
                placeholder="Se calcula automáticamente"
                value={duracionManualPaso1Calculada}
              />
            </div>

            <div className="flex justify-end pt-2">
              <Button
                variant="primary"
                size="md"
                icon="save"
                onClick={handleSaveManualPaso1}
              >
                Guardar Horarios de Frío
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* ========================================================================= */}
      {/* PASO 02: FILTRADO Y ESCURRIDO EN TELAS (2 DÍAS)                           */}
      {/* ========================================================================= */}
      <Card
        stepBadge="Paso 02"
        title="Filtrado y Escurrido en Telas (2 Días / ~48 Horas)"
        subtitle="Drenado natural por gravedad mediante lienzos o telas de filtración. Control exclusivo de tiempo transcurrido."
        icon="filter_alt"
        tone={
          state.filtradoTelas.completado
            ? 'completed'
            : state.filtradoTelas.iniciado
            ? 'active'
            : 'default'
        }
        statusBadge={
          state.filtradoTelas.completado
            ? { label: 'Drenado Finalizado ✓', variant: 'success' }
            : state.filtradoTelas.iniciado
            ? { label: 'Escurriendo en Telas (~48 h)', variant: 'warning', pulse: true }
            : { label: 'En espera del Paso 01', variant: 'neutral' }
        }
        headerRight={
          <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-bold text-gray-700 bg-white px-3 py-1.5 rounded-xl border border-gray-300 shadow-2xs hover:border-amber-400 transition-all">
            <input
              type="checkbox"
              checked={manualPaso2}
              onChange={(e) => setManualPaso2(e.target.checked)}
              className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 cursor-pointer"
            />
            <span>Habilitar edición manual</span>
          </label>
        }
      >
        {(state.filtradoTelas.iniciado || state.filtradoTelas.completado) && (
          <TimerBanner
            label="Tiempo de Escurrido en Telas"
            sublabel="Tiempo de drenado objetivo: ~2 días (48 horas)"
            formattedTime={
              state.filtradoTelas.completado
                ? state.filtradoTelas.tiempoTranscurrido || 'Finalizado'
                : formatDaysHours(filtradoTimer.elapsedSeconds)
            }
            targetLabel="~48 Horas"
            progressPercent={filtradoTimer.progressPercent}
            isRunning={
              state.filtradoTelas.iniciado && !state.filtradoTelas.completado
            }
            isCompleted={state.filtradoTelas.completado}
            isOvertime={filtradoTimer.isOvertime}
            className="mb-4"
          />
        )}

        {!manualPaso2 ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-white border border-[#D6DEEA]">
                <span className="text-[10px] uppercase font-bold text-gray-500 block">
                  INICIO DE ESCURRIDO
                </span>
                <span className="text-xl font-mono font-black text-gray-900 mt-1 block">
                  {state.filtradoTelas.horaInicio || '--:--'}
                </span>
              </div>

              <div className="p-4 rounded-xl bg-white border border-[#D6DEEA]">
                <span className="text-[10px] uppercase font-bold text-gray-500 block">
                  FIN DE ESCURRIDO
                </span>
                <span className="text-xl font-mono font-black text-emerald-900 mt-1 block">
                  {state.filtradoTelas.horaFin ||
                    (state.filtradoTelas.iniciado ? 'Drenando...' : 'Pendiente')}
                </span>
              </div>

              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-300">
                <span className="text-[10px] uppercase font-bold text-emerald-800 block">
                  DURACIÓN DE DRENADO (SOLO LECTURA)
                </span>
                <span className="text-xl font-mono font-black text-emerald-950 mt-1 block">
                  {state.filtradoTelas.completado
                    ? state.filtradoTelas.tiempoTranscurrido
                    : state.filtradoTelas.iniciado
                    ? formatDaysHours(filtradoTimer.elapsedSeconds)
                    : '~48 horas'}
                </span>
              </div>
            </div>

            <div className="pt-2">
              {!state.filtradoTelas.iniciado ? (
                <Button
                  variant="primary"
                  size="xl"
                  icon="play_circle"
                  disabled={!state.cuartoFrio.completado}
                  onClick={handleStartFiltradoTelas}
                  className="bg-amber-600 hover:bg-amber-700 text-white font-bold shadow-md shadow-amber-600/20"
                >
                  Iniciar Escurrido en Telas (~48 h)
                </Button>
              ) : !state.filtradoTelas.completado ? (
                <Button
                  variant="primary"
                  size="xl"
                  icon="check_circle"
                  onClick={handleConfirmDrenadoFinalizado}
                  className="bg-[#5FAF32] hover:bg-[#4E9628] text-white font-bold shadow-md shadow-emerald-700/20"
                >
                  Drenado / Escurrido finalizado
                </Button>
              ) : (
                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-emerald-900 text-xs flex items-center gap-2">
                  <span className="material-symbols-outlined text-[20px] text-emerald-700">
                    verified
                  </span>
                  <span>
                    Drenado completado a las <strong>{state.filtradoTelas.horaFin}</strong> ({state.filtradoTelas.tiempoTranscurrido}). La masa espesa está lista para batir.
                  </span>
                </div>
              )}
              {state.filtradoTelas.completado && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                  <InputField
                    label="Masa filtrada pesada (kg)"
                    icon="scale"
                    type="number"
                    step="0.1"
                    min="0"
                    placeholder="Peso real de la masa"
                    value={state.filtradoTelas.masaFiltradaKg || ''}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                      const masa = e.target.value === '' ? 0 : Math.max(0, Number(e.target.value) || 0);
                      onChange((prev) => ({
                        ...prev,
                        filtradoTelas: {
                          ...prev.filtradoTelas,
                          masaFiltradaKg: masa,
                          sueroEliminadoEstimadoLitros: Number(Math.max(0, litrosLecheBase * 1.03 - masa).toFixed(1)),
                          esManual: true,
                        },
                      }));
                    }}
                  />
                  <InputField
                    label="Suero eliminado estimado (L)"
                    icon="water_drop"
                    type="text"
                    disabled
                    readOnly
                    value={`${state.filtradoTelas.sueroEliminadoEstimadoLitros || 0} L`}
                  />
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-amber-50/90 border-2 border-amber-300 flex flex-col gap-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-start">
              <PopoverTimePicker
                label="Hora de Inicio de Escurrido"
                icon="schedule"
                value={horaManualInicioFiltrado}
                onChange={setHoraManualInicioFiltrado}
              />

              <PopoverTimePicker
                label="Hora de Fin de Escurrido"
                icon="schedule"
                value={horaManualFinFiltrado}
                onChange={setHoraManualFinFiltrado}
              />

              <InputField
                label="Duración de Drenado (Solo Lectura)"
                icon="timer"
                type="text"
                disabled
                readOnly
                placeholder="Se calcula automáticamente"
                value={duracionManualPaso2Calculada}
              />
            </div>

            <div className="flex justify-end pt-2">
              <Button
                variant="primary"
                size="md"
                icon="save"
                onClick={handleSaveManualPaso2}
              >
                Guardar Horarios de Escurrido
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* ========================================================================= */}
      {/* CIERRE DE ETAPA Y NAVEGACIÓN A BATIDO                                     */}
      {/* ========================================================================= */}
      <div className="p-4 sm:p-5 rounded-2xl bg-white border border-[#D6DEEA] shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-amber-900 shrink-0">
            <span className="material-symbols-outlined text-[24px]">blender</span>
          </div>
          <div className="text-xs sm:text-sm text-[#434655]">
            <p className="font-bold text-[#191C1E]">
              Cierre de Escurrido y Paso a Batido
            </p>
            <p>
              Una vez finalizado el drenado en telas, avanza a la etapa de{' '}
              <strong className="text-amber-900 font-semibold">
                4. Batido (Opción con Stevia o Natural)
              </strong>.
            </p>
          </div>
        </div>

        <Button
          variant="primary"
          size="lg"
          icon="blender"
          iconRight="arrow_forward"
          disabled={!state.filtradoTelas.completado}
          onClick={onNextStage}
          className="w-full sm:w-auto font-bold shadow-md"
        >
          Ir a 4. Batido
        </Button>
      </div>
    </div>
  );
};
