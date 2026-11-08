import React, { useState, useEffect, useMemo } from 'react';
import { ManualEditToggle } from '../../../components/ui/ManualEditToggle';
import { CalentarYCuajarState, LotesLeche, ProcessTimerState } from '../../../types';
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

interface CalentarYCuajarStageProps {
  state: CalentarYCuajarState;
  onChange: (updater: (prev: CalentarYCuajarState) => CalentarYCuajarState) => void;
  processTimer: ProcessTimerState;
  horaAdicionCuajoDesdeAcidificar: string | null;
  timestampAdicionCuajoDesdeAcidificar?: number | null;
  lotesLeche: LotesLeche;
  loteCuajo?: string;
  tipoCuajo?: string;
  cantidadCuajoSugerida?: string | number;
  totalLecheMezcla?: number;
  onUpdateCuajoLote?: (newLote: string) => void;
  onNextStage: () => void;
  onOpenReviewModal?: () => void;
  showToast: (msg: string, type?: 'success' | 'info' | 'warning') => void;
}

export const CalentarYCuajarStage: React.FC<CalentarYCuajarStageProps> = ({
  state,
  onChange,
  processTimer,
  horaAdicionCuajoDesdeAcidificar,
  timestampAdicionCuajoDesdeAcidificar,
  onNextStage,
  showToast,
}) => {
  // Hora de inicio para el Paso 1: momento en que se adicionó el cuajo
  const horaCultivo =
    horaAdicionCuajoDesdeAcidificar ||
    state.adicionCuajo?.horaRegistro ||
    state.horaAdicionCuajo ||
    processTimer.startTime ||
    'En espera';

  const cultivoTs =
    timestampAdicionCuajoDesdeAcidificar || processTimer.startTimestamp;

  // Estados locales para edición manual de cada paso
  const [manualFase1, setManualFase1] = useState<boolean>(
    Boolean(state.cuajado?.esManual)
  );
  const [manualFase2, setManualFase2] = useState<boolean>(
    Boolean(state.corte?.esManual)
  );
  const [manualFase3, setManualFase3] = useState<boolean>(
    Boolean(state.temperatura40?.esManual)
  );

  // Variables editables para Paso 1 (Cuajado)
  const [horaManualCuajado, setHoraManualCuajado] = useState<string>(
    state.cuajado?.horaRegistro || getCurrentTimeString()
  );
  const [consistenciaManual, setConsistenciaManual] = useState<string>(
    state.cuajado?.consistencia || 'Cuajada firme / Corte limpio'
  );

  // Variables editables para Paso 2 (Corte)
  const [horaManualCorte, setHoraManualCorte] = useState<string>(
    state.corte?.horaRegistro || getCurrentTimeString()
  );

  // Variables editables para Paso 3 (Llegada a 40 °C)
  const [tempManual40, setTempManual40] = useState<number>(
    state.temperatura40?.temperaturaAlcanzada || 40.0
  );
  const [horaManual40, setHoraManual40] = useState<string>(
    state.temperatura40?.horaRegistro || getCurrentTimeString()
  );

  // Sincronización cuando no está en modo edición
  useEffect(() => {
    if (!manualFase1) {
      setHoraManualCuajado(state.cuajado?.horaRegistro || getCurrentTimeString());
      setConsistenciaManual(
        state.cuajado?.consistencia || 'Cuajada firme / Corte limpio'
      );
    }
  }, [manualFase1, state.cuajado?.horaRegistro, state.cuajado?.consistencia]);

  useEffect(() => {
    if (!manualFase2) {
      setHoraManualCorte(state.corte?.horaRegistro || getCurrentTimeString());
    }
  }, [manualFase2, state.corte?.horaRegistro]);

  useEffect(() => {
    if (!manualFase3) {
      setTempManual40(state.temperatura40?.temperaturaAlcanzada || 40.0);
      setHoraManual40(state.temperatura40?.horaRegistro || getCurrentTimeString());
    }
  }, [
    manualFase3,
    state.temperatura40?.temperaturaAlcanzada,
    state.temperatura40?.horaRegistro,
  ]);

  // =========================================================================
  // PUNTO DE PARTIDA CONCURRENTE (HORA DE CUAJADO) PARA PASO 2 Y PASO 3
  // =========================================================================
  const horaCuajadoComun = state.cuajado?.horaRegistro || horaCultivo;

  // Timestamp efectivo de cuajado para alimentar los cronómetros en vivo
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
  }, [state.cuajado?.timestampCuajado, state.cuajado?.horaRegistro, state.cuajado?.esManual]);

  // =========================================================================
  // CRONÓMETROS EN VIVO Y CONCURRENTES (PASO 2 Y PASO 3)
  // Tan pronto como la leche cuaja (Paso 1 confirmado), inician al mismo tiempo.
  // =========================================================================
  const isPaso2Running = Boolean(
    state.cuajado.registrado && !state.corte.registrado && tsCuajadoEfectivo
  );
  const isPaso2Completed = Boolean(state.corte.registrado);

  const timerPaso2 = useStageCountdown({
    startTimestamp: tsCuajadoEfectivo,
    isRunning: isPaso2Running,
    isCompleted: isPaso2Completed,
    targetMinutes: 10,
    completedDurationText: state.corte.tiempoTranscurridoDesdeCuajado,
  });

  const isPaso3Running = Boolean(
    state.cuajado.registrado &&
      !state.temperatura40.alcanzado &&
      tsCuajadoEfectivo
  );
  const isPaso3Completed = Boolean(state.temperatura40.alcanzado);

  const timerPaso3 = useStageCountdown({
    startTimestamp: tsCuajadoEfectivo,
    isRunning: isPaso3Running,
    isCompleted: isPaso3Completed,
    targetMinutes: 18,
    completedDurationText: state.temperatura40.tiempoCalentamiento40,
  });

  // =========================================================================
  // RECÁLCULOS AUTOMÁTICOS DE DURACIONES (REGLA ESTRICTA DE NEGOCIO)
  // =========================================================================

  // Paso 1: Duración = Hora de cuajado - Hora de adición del cuajo
  const duracionCuajadoRecalculada = useMemo(() => {
    if (!horaManualCuajado) {
      return {
        human: state.cuajado.tiempoTranscurridoDesdeCuajo || '0 s',
        seconds: state.cuajado.segundosCuajado || 0,
      };
    }
    if (horaCultivo && horaCultivo !== 'En espera') {
      return computeDurationBetweenTimes(horaCultivo, horaManualCuajado);
    }
    return {
      human: state.cuajado.tiempoTranscurridoDesdeCuajo || '0 s',
      seconds: state.cuajado.segundosCuajado || 0,
    };
  }, [
    horaCultivo,
    horaManualCuajado,
    state.cuajado.tiempoTranscurridoDesdeCuajo,
    state.cuajado.segundosCuajado,
  ]);

  // Paso 2: Duración = Hora de corte terminado - Hora de cuajado (Punto de partida común)
  const duracionCorteRecalculada = useMemo(() => {
    if (!horaManualCorte) {
      return {
        human: state.corte.tiempoTranscurridoDesdeCuajado || '0 s',
        seconds: 0,
      };
    }
    if (horaCuajadoComun && horaCuajadoComun !== 'En espera') {
      return computeDurationBetweenTimes(horaCuajadoComun, horaManualCorte);
    }
    return {
      human: state.corte.tiempoTranscurridoDesdeCuajado || '0 s',
      seconds: 0,
    };
  }, [horaCuajadoComun, horaManualCorte, state.corte.tiempoTranscurridoDesdeCuajado]);

  // Paso 3: Duración = Hora a la que llegó a 40 °C - Hora de cuajado (Punto de partida común)
  const duracion40Recalculada = useMemo(() => {
    if (!horaManual40) {
      return {
        human: state.temperatura40.tiempoCalentamiento40 || '0 s',
        seconds: 0,
      };
    }
    if (horaCuajadoComun && horaCuajadoComun !== 'En espera') {
      return computeDurationBetweenTimes(horaCuajadoComun, horaManual40);
    }
    return {
      human: state.temperatura40.tiempoCalentamiento40 || '0 s',
      seconds: 0,
    };
  }, [
    horaCuajadoComun,
    horaManual40,
    state.temperatura40.tiempoCalentamiento40,
  ]);

  // =========================================================================
  // HANDLERS PASO 1: TIEMPO DE CUAJADO
  // =========================================================================
  const handleRecordCuajado = () => {
    const nowTs = Date.now();
    const timeStr = getCurrentTimeString();
    const baseCuajoTs =
      timestampAdicionCuajoDesdeAcidificar ||
      state.adicionCuajo?.timestampCuajo ||
      state.timestampAdicionCuajo ||
      cultivoTs ||
      nowTs - 1000;
    const elapsedSec = Math.max(1, Math.floor((nowTs - baseCuajoTs) / 1000));
    const duracionStr = formatHumanDuration(elapsedSec);

    onChange((prev) => ({
      ...prev,
      cuajado: {
        ...prev.cuajado,
        registrado: true,
        horaRegistro: timeStr,
        timestampCuajado: nowTs,
        tiempoTranscurridoDesdeCuajo: duracionStr,
        segundosCuajado: elapsedSec,
        esManual: manualFase1,
      },
    }));

    setHoraManualCuajado(timeStr);

    showToast(
      `✓ Cuajada lista a las ${timeStr} · Inician simultáneamente corte y calentamiento a 40 °C`,
      'success'
    );
  };

  const handleSaveManualCuajado = () => {
    const timeStr = formatTimeFromStep1(horaManualCuajado);

    let duracionStr = state.cuajado.tiempoTranscurridoDesdeCuajo || '0 s';
    let elapsedSec = state.cuajado.segundosCuajado || 0;

    if (horaCultivo && horaCultivo !== 'En espera') {
      const diff = computeDurationBetweenTimes(horaCultivo, timeStr);
      duracionStr = diff.human;
      elapsedSec = diff.seconds;
    }

    const sec = timeStringToSecondsToday(timeStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const manualCuajadoTs = today.getTime() + sec * 1000;

    // Cascada de sincronización: si Paso 2 o Paso 3 ya estaban registrados, recalcular sus duraciones concurrentes
    let nuevoTiempoCorte = state.corte.tiempoTranscurridoDesdeCuajado;
    if (state.corte.registrado && state.corte.horaRegistro) {
      nuevoTiempoCorte = computeDurationBetweenTimes(
        timeStr,
        state.corte.horaRegistro
      ).human;
    }

    let nuevoTiempo40 = state.temperatura40.tiempoCalentamiento40;
    if (state.temperatura40.alcanzado && state.temperatura40.horaRegistro) {
      nuevoTiempo40 = computeDurationBetweenTimes(
        timeStr,
        state.temperatura40.horaRegistro
      ).human;
    }

    onChange((prev) => ({
      ...prev,
      cuajado: {
        ...prev.cuajado,
        registrado: true,
        horaRegistro: timeStr,
        timestampCuajado: manualCuajadoTs,
        tiempoTranscurridoDesdeCuajo: duracionStr,
        segundosCuajado: elapsedSec,
        consistencia: consistenciaManual,
        esManual: true,
      },
      corte: {
        ...prev.corte,
        tiempoTranscurridoDesdeCuajado: nuevoTiempoCorte,
      },
      temperatura40: {
        ...prev.temperatura40,
        tiempoCalentamiento40: nuevoTiempo40,
      },
    }));

    setManualFase1(false);
    showToast(
      `✓ Hora de cuajado actualizada (${timeStr}). Tiempos sincronizados.`,
      'success'
    );
  };

  // =========================================================================
  // HANDLERS PASO 2: TIEMPO DE CORTE DE CUAJADO
  // =========================================================================
  const handleRecordCorte = () => {
    const nowTs = Date.now();
    const timeStr = getCurrentTimeString();
    // Punto de partida común: hora de cuajado
    const duracionStr =
      horaCuajadoComun && horaCuajadoComun !== 'En espera'
        ? computeDurationBetweenTimes(horaCuajadoComun, timeStr).human
        : formatHumanDuration(
            Math.max(
              1,
              Math.floor(
                (nowTs - (tsCuajadoEfectivo || cultivoTs || nowTs - 1000)) /
                  1000
              )
            )
          );

    onChange((prev) => ({
      ...prev,
      corte: {
        ...prev.corte,
        registrado: true,
        horaRegistro: timeStr,
        timestampCorte: nowTs,
        tiempoTranscurridoDesdeCuajado: duracionStr,
        esManual: manualFase2,
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

    let duracionStr = state.corte.tiempoTranscurridoDesdeCuajado || '0 s';
    if (horaCuajadoComun && horaCuajadoComun !== 'En espera') {
      duracionStr = computeDurationBetweenTimes(horaCuajadoComun, timeStr).human;
    }

    onChange((prev) => ({
      ...prev,
      corte: {
        ...prev.corte,
        registrado: true,
        horaRegistro: timeStr,
        tiempoTranscurridoDesdeCuajado: duracionStr,
        esManual: true,
      },
    }));

    setManualFase2(false);
    showToast(
      `✓ Datos manuales de corte guardados (${timeStr} · ${duracionStr})`,
      'success'
    );
  };

  // =========================================================================
  // HANDLERS PASO 3: 40 °C ALCANZADOS PARA DESUERADO
  // =========================================================================
  const handleRecordReach40 = () => {
    const nowTs = Date.now();
    const timeStr = getCurrentTimeString();
    // Punto de partida común con el corte: hora de cuajado
    const duracionStr =
      horaCuajadoComun && horaCuajadoComun !== 'En espera'
        ? computeDurationBetweenTimes(horaCuajadoComun, timeStr).human
        : formatHumanDuration(
            Math.max(
              1,
              Math.floor(
                (nowTs - (tsCuajadoEfectivo || cultivoTs || nowTs - 1000)) /
                  1000
              )
            )
          );

    onChange((prev) => ({
      ...prev,
      temperatura40: {
        ...prev.temperatura40,
        alcanzado: true,
        horaRegistro: timeStr,
        timestamp40Grados: nowTs,
        temperaturaAlcanzada: manualFase3 ? tempManual40 : 40.0,
        tiempoCalentamiento40: duracionStr,
        esManual: manualFase3,
      },
      telemetria: {
        ...prev.telemetria,
        temperatura: manualFase3 ? tempManual40 : 40.0,
      },
    }));

    setHoraManual40(timeStr);

    showToast(
      `✓ ¡Ya llegó a 40.0 °C a las ${timeStr}! Tardó ${duracionStr} desde el cuajado. Listo para sacar el suero.`,
      'success'
    );
  };

  const handleSaveManual40 = () => {
    const timeStr = formatTimeFromStep1(horaManual40);
    const tempFinal = Number(tempManual40) || 40.0;

    let duracionStr = state.temperatura40.tiempoCalentamiento40 || '0 s';
    // Fórmula estricta: Hora a la que llegó a 40 °C - Hora de cuajado
    if (horaCuajadoComun && horaCuajadoComun !== 'En espera') {
      duracionStr = computeDurationBetweenTimes(
        horaCuajadoComun,
        timeStr
      ).human;
    }

    onChange((prev) => ({
      ...prev,
      temperatura40: {
        ...prev.temperatura40,
        alcanzado: true,
        horaRegistro: timeStr,
        temperaturaAlcanzada: tempFinal,
        tiempoCalentamiento40: duracionStr,
        esManual: true,
      },
      telemetria: {
        ...prev.telemetria,
        temperatura: tempFinal,
      },
    }));

    setManualFase3(false);
    showToast(
      `✓ Datos manuales de 40 °C guardados: ${tempFinal} °C a las ${timeStr} (${duracionStr})`,
      'success'
    );
  };

  return (
    <div className="flex flex-col w-full p-4 lg:p-6 gap-6 bg-[#FFFFFF] min-h-[calc(100vh-4rem)] pb-12">
      <StageHeader
        stageNumber={2}
        totalStages={5}
        title="Cuajar, Cortar y Calentar a 40 °C"
        subtitle="Espera a que la leche cuaje firme, córtala en cubos parejos y caliéntala suavemente hasta llegar a 40 °C."
        productName="Queso Doble Crema"
        icon="thermostat"
        isCompleted={Boolean(state.temperatura40.alcanzado)}
        rightContent={
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="px-3.5 py-2 rounded-xl bg-amber-50 border border-amber-300 flex items-center gap-2.5 min-h-[48px]">
              <span className="material-symbols-outlined text-amber-700 text-[22px]">
                water_drop
              </span>
              <div>
                <div className="text-[10px] text-amber-900 uppercase font-bold">
                  CUAJO AGREGADO
                </div>
                <div className="text-xs font-black text-amber-950 font-mono">
                  {horaCultivo}
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

      {/* BANNER: TIEMPO TRANSCURRIDO DESDE LA ADICIÓN DEL CUAJO */}
      <TimerBanner
        title="Tiempo en Reposo desde que agregaste el Cuajo"
        subtitle={`El cuajo se agregó en la etapa anterior a las ${horaCultivo}. Revisa que la cuajada esté firme antes de cortarla.`}
        formattedTime={processTimer.formattedTime || '00:00:00'}
        isRunning={processTimer.isRunning}
        isCompleted={Boolean(state.temperatura40.alcanzado)}
        statusLabel="Cronómetro General del Lote"
        variant="info"
      />

      {/* =========================================================================
          PASO 01: LA LECHE YA CUAJÓ!!
      ========================================================================= */}
      <Card
        title="La leche ya cuajó!!"
        subtitle="Cuando la cuajada esté firme y haga un corte limpio al probarla, confirma el momento exacto para activar los cronómetros de corte y calentamiento."
        icon="egg"
        badge={state.cuajado.registrado ? '✓ Cuajada Lista' : 'Esperando que cuaje'}
        variant={state.cuajado.registrado ? 'success' : 'default'}
        headerAction={
          <ConfirmButton
            label="Registrar: Ya Cuajó"
            confirmedLabel="✓ Tiempo de Cuajado Registrado"
            icon="schedule"
            isConfirmed={state.cuajado.registrado}
            onConfirm={handleRecordCuajado}
          />
        }
      >
        <div className="flex flex-col gap-4">
          <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-300 flex flex-wrap items-center justify-between gap-2 min-h-[48px]">
            <ManualEditToggle manual={Boolean(manualFase1)} onChange={(checked: boolean) => setManualFase1(checked)} />
            <Badge variant={manualFase1 ? 'warning' : 'neutral'} size="sm">
              {manualFase1 ? 'Modo Manual Activo' : 'Automático'}
            </Badge>
          </div>

          {!manualFase1 ? (
            state.cuajado.registrado ? (
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
                    Calculado desde que agregaste el cuajo ({horaCultivo})
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
                    {state.cuajado.consistencia || 'Cuajada firme / Corte limpio'}
                  </span>
                  <span className="text-[11px] text-gray-500">
                    Lista para cortar con la lira
                  </span>
                </div>
              </div>
            ) : (
              <div className="pt-2 border-t border-[#D6DEEA]/60 text-xs text-[#434655] flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-[#1B4E9B]">
                  info
                </span>
                <span>
                  Cuando veas que la cuajada parte limpio, presiona{' '}
                  <strong>"Registrar: Ya Cuajó"</strong> para activar los cronómetros de corte y calentamiento.
                </span>
              </div>
            )
          ) : (
            <div className="p-4 rounded-xl bg-amber-50/90 border-2 border-amber-300 flex flex-col gap-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-start">
                {/* 1. Hora de Cuajado (EVENTO EDITABLE CON POPOVER) */}
                <PopoverTimePicker
                  label="Hora de Cuajado"
                  icon="schedule"
                  hint="Toca para desplegar el selector flotante (hh:mm:ss)"
                  value={horaManualCuajado}
                  onChange={setHoraManualCuajado}
                />

                {/* 2. Tiempo que Tardó en Cuajar (DURACIÓN SOLO LECTURA BLOQUEADA) */}
                <InputField
                  label="Tiempo que Tardó en Cuajar"
                  icon="timer"
                  type="text"
                  disabled
                  readOnly
                  placeholder="Se calcula automáticamente"
                  hint={
                    horaCultivo && horaCultivo !== 'En espera'
                      ? `Calculado: ${horaCultivo} → ${horaManualCuajado}`
                      : 'Calculado automáticamente desde la adición del cuajo'
                  }
                  value={duracionCuajadoRecalculada.human}
                />

                {/* 3. Firmeza / Observación */}
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
          PASO 02: YA TERMINÉ DE CORTAR LA CUAJADA!! (CRONÓMETRO VIVO Y CONCURRENTE)
      ========================================================================= */}
      <Card
        title="Ya terminé de cortar la cuajada!!"
        subtitle="Corta la cuajada en cubos parejos y confirma al terminar de cortar mientras la tina sigue calentando hacia 40 °C."
        icon="grid_4x4"
        badge={
          state.corte.registrado
            ? '✓ Corte Terminado'
            : isPaso2Running
            ? '⏳ Cortando en curso'
            : 'Esperando cuajado'
        }
        variant={state.corte.registrado ? 'success' : isPaso2Running ? 'warning' : 'default'}
        headerAction={
          <ConfirmButton
            label="Confirmar: Ya Terminé de Cortar"
            confirmedLabel="✓ Corte Terminado"
            icon="content_cut"
            isConfirmed={state.corte.registrado}
            disabled={!state.cuajado.registrado}
            onConfirm={handleRecordCorte}
          />
        }
      >
        <div className="flex flex-col gap-4">
          {/* CRONÓMETRO VISUAL VIVO EN TIEMPO REAL (INICIA CON EL CUAJADO) */}
          {state.cuajado.registrado ? (
            <TimerBanner
              title="Cronómetro de Corte de la Cuajada"
              subtitle={
                state.corte.registrado
                  ? `Corte finalizado a las ${state.corte.horaRegistro} (tardó ${state.corte.tiempoTranscurridoDesdeCuajado}).`
                  : `Iniciado concurrentemente con el cuajado a las ${horaCuajadoComun}. Pasa la lira despacio para lograr cubos uniformes.`
              }
              formattedTime={
                state.corte.registrado
                  ? state.corte.tiempoTranscurridoDesdeCuajado || timerPaso2.humanElapsed
                  : timerPaso2.formattedElapsed
              }
              isRunning={isPaso2Running}
              isCompleted={isPaso2Completed}
              statusLabel={
                state.corte.registrado
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
                El cronómetro de corte iniciará automáticamente en cuanto confirmes que la leche ya cuajó en el Paso 1.
              </span>
            </div>
          )}

          <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-300 flex flex-wrap items-center justify-between gap-2 min-h-[48px]">
            <ManualEditToggle manual={Boolean(manualFase2)} onChange={(checked: boolean) => setManualFase2(checked)} />
            <Badge variant={manualFase2 ? 'warning' : 'neutral'} size="sm">
              {manualFase2 ? 'Modo Manual Activo' : 'Automático'}
            </Badge>
          </div>

          {!manualFase2 ? (
            state.corte.registrado ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-[#D6DEEA]/70">
                <div className="p-3.5 bg-white rounded-xl border border-amber-200 flex flex-col">
                  <span className="text-[10px] uppercase font-bold text-gray-500">
                    Hora en que Terminó el Corte
                  </span>
                  <span className="text-lg font-black font-mono text-amber-900 mt-1">
                    {state.corte.horaRegistro}
                  </span>
                  <span className="text-[11px] text-gray-500">
                    Corte listo (el calentamiento a 40 °C continúa)
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
                  Apenas termines de pasar la lira, presiona{' '}
                  <strong>"Confirmar: Ya Terminé de Cortar"</strong>.
                </span>
              </div>
            )
          ) : (
            <div className="p-4 rounded-xl bg-amber-50/90 border-2 border-amber-300 flex flex-col gap-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
                {/* 1. Hora de Corte Terminado (EVENTO EDITABLE CON POPOVER) */}
                <PopoverTimePicker
                  label="Hora de Corte Terminado"
                  icon="schedule"
                  hint="Toca para desplegar el selector flotante (hh:mm:ss)"
                  value={horaManualCorte}
                  onChange={setHoraManualCorte}
                />

                {/* 2. Tiempo que Tardó el Corte (DURACIÓN SOLO LECTURA BLOQUEADA) */}
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
          PASO 03: YA CALENTÉ LA MEZCLA HASTA LLEGAR A 40 GRADOS (CONCURRENTE)
      ========================================================================= */}
      <Card
        title="Ya calenté la mezcla hasta llegar a 40 grados"
        subtitle="Sube la temperatura agitando despacio y confirma apenas el termómetro marque los 40 °C para pasar a sacar el suero."
        icon="thermostat"
        badge={
          state.temperatura40.alcanzado
            ? '✓ Ya llegó a 40 °C'
            : isPaso3Running
            ? '🔥 Calentando a 40 °C en vivo'
            : 'Esperando cuajado'
        }
        variant={
          state.temperatura40.alcanzado
            ? 'success'
            : isPaso3Running
            ? 'warning'
            : 'default'
        }
        headerAction={
          <ConfirmButton
            label="Confirmar: Ya llegó a 40 °C"
            confirmedLabel="✓ Ya llegó a 40 °C (Listo para Desuerar)"
            icon="thermostat"
            isConfirmed={state.temperatura40.alcanzado}
            disabled={!state.cuajado.registrado}
            onConfirm={handleRecordReach40}
          />
        }
      >
        <div className="flex flex-col gap-4">
          {/* CRONÓMETRO VISUAL VIVO EN TIEMPO REAL (INICIA CON EL CUAJADO, CONCURRENTE AL CORTE) */}
          {state.cuajado.registrado ? (
            <TimerBanner
              title="Cronómetro de Calentamiento a 40 °C (Concurrente)"
              subtitle={
                state.temperatura40.alcanzado
                  ? `Llegó a 40.0 °C a las ${state.temperatura40.horaRegistro} (tardó ${state.temperatura40.tiempoCalentamiento40} desde el cuajado).`
                  : `Iniciado concurrentemente con el cuajado a las ${horaCuajadoComun}. Calienta suavemente mientras agitas la tina.`
              }
              formattedTime={
                state.temperatura40.alcanzado
                  ? state.temperatura40.tiempoCalentamiento40 || timerPaso3.humanElapsed
                  : timerPaso3.formattedElapsed
              }
              isRunning={isPaso3Running}
              isCompleted={isPaso3Completed}
              statusLabel={
                state.temperatura40.alcanzado
                  ? '40 °C alcanzados'
                  : 'Calentando a 40 °C en vivo'
              }
              variant="info"
            />
          ) : (
            <div className="p-3.5 rounded-xl bg-blue-50/60 border border-blue-200 text-xs text-blue-900 flex items-center gap-2">
              <span className="material-symbols-outlined text-[20px] text-[#1B4E9B]">
                hourglass_top
              </span>
              <span>
                El cronómetro de calentamiento iniciará automáticamente junto con el corte en cuanto confirmes el Paso 1.
              </span>
            </div>
          )}

          <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-300 flex flex-wrap items-center justify-between gap-2 min-h-[48px]">
            <ManualEditToggle manual={Boolean(manualFase3)} onChange={(checked: boolean) => setManualFase3(checked)} />
            <Badge variant={manualFase3 ? 'warning' : 'success'} size="sm">
              {manualFase3 ? 'Modo Manual Activo' : 'Automático'}
            </Badge>
          </div>

          {!manualFase3 ? (
            state.temperatura40.alcanzado ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-[#D6DEEA]/70">
                <div className="p-3.5 bg-white rounded-xl border border-emerald-200 flex flex-col">
                  <span className="text-[10px] uppercase font-bold text-emerald-800">
                    Temperatura Medida
                  </span>
                  <span className="text-xl font-black font-mono text-emerald-700 mt-1">
                    {state.temperatura40.temperaturaAlcanzada || 40.0} °C
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
                    Calienta despacio la cuajada hasta 40 °C y presiona{' '}
                    <strong>"Confirmar: Ya llegó a 40 °C"</strong>.
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
                {/* 1. Temperatura Alcanzada (Editable numérico) */}
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
                    !tempManual40 || tempManual40 === 0
                      ? 'default'
                      : tempManual40 >= 39.0 && tempManual40 <= 41.0
                      ? 'valid'
                      : 'error'
                  }
                  value={tempManual40}
                  onChange={(e) => setTempManual40(Number(e.target.value))}
                />

                {/* 2. Hora a la que llegó (EVENTO EDITABLE CON POPOVER) */}
                <PopoverTimePicker
                  label="Hora a la que llegó"
                  icon="schedule"
                  hint="Toca para desplegar el selector flotante (hh:mm:ss)"
                  value={horaManual40}
                  onChange={setHoraManual40}
                />

                {/* 3. Tiempo de Calentamiento (DURACIÓN SOLO LECTURA BLOQUEADA) */}
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

      {/* Siguiente Etapa: Desuerar (Sin botón de Ver Resumen, exclusivo para etapas finales) */}
      <div className="p-5 rounded-2xl bg-white border border-[#D6DEEA] shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-[#1B4E9B] text-[26px]">
            filter_alt
          </span>
          <span className="text-xs sm:text-sm font-bold text-gray-800">
            Cuando la tina llegue a 40 °C, pasa de inmediato a la etapa de{' '}
            <strong>Desuerar y Escurrir</strong>.
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <Button
            variant="primary"
            size="lg"
            iconRight="arrow_forward"
            onClick={onNextStage}
          >
            Pasar a Etapa 3: Desuerar
          </Button>
        </div>
      </div>
    </div>
  );
};
