import React, { useState, useEffect, useMemo } from 'react';
import { ManualEditToggle } from '../../../components/ui/ManualEditToggle';
import { HilarState, ProcessTimerState } from '../../../types';
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

interface HilarStageProps {
  state: HilarState;
  onChange: (updater: (prev: HilarState) => HilarState) => void;
  timestampDesuerado?: number | null;
  horaDesuerado?: string | null;
  horaFinEscurrido?: string | null;
  timestampFinEscurrido?: number | null;
  loteSal?: string;
  phEscurrido?: number;
  totalLecheMezcla?: number;
  processTimer: ProcessTimerState;
  onStopProcessTimer?: (endTime?: string) => void;
  onFinalizeProcess?: () => void;
  onNextStage?: () => void;
  onOpenModal?: () => void;
  showToast: (msg: string, type?: 'success' | 'info' | 'warning') => void;
}

export const HilarStage: React.FC<HilarStageProps> = ({
  state,
  onChange,
  timestampDesuerado,
  horaDesuerado,
  horaFinEscurrido,
  timestampFinEscurrido,
  loteSal,
  phEscurrido,
  totalLecheMezcla = 0,
  processTimer,
  onStopProcessTimer,
  onNextStage,
  showToast,
}) => {
  const [entryTimestamp] = useState<number>(() => Date.now());

  // =========================================================================
  // REFERENCIAS GLOBALES E INSUMOS
  // =========================================================================
  // Hora de fin de escurrido de la etapa anterior (Punto de partida de la etapa 4)
  const horaFinEscurridoRef =
    horaFinEscurrido ||
    horaDesuerado ||
    'En espera';

  const tsFinEscurridoRef =
    timestampFinEscurrido || timestampDesuerado || entryTimestamp;

  const phMedidoEnEscurrido = phEscurrido ?? state.phActual ?? 5.3;

  // Lote de sal (heredado de la etapa 1 AcidificarStage, sin pedir doble selección)
  const loteSalEfectivo =
    loteSal || state.sal?.loteSal || '';

  // Matemática inquebrantable de sal: 360 g por cada 300 L de leche (1.2 g/L)
  const salCalculadaPorFormula =
    Math.round((totalLecheMezcla / 300) * 360 * 10) / 10;

  // =========================================================================
  // ESTADOS DE EDICIÓN MANUAL
  // =========================================================================
  const [manualPaso1, setManualPaso1] = useState<boolean>(
    Boolean(state.pruebaHilado.esManual)
  );
  const [manualPaso2, setManualPaso2] = useState<boolean>(
    Boolean(state.sal?.esManual)
  );
  const [manualPaso3, setManualPaso3] = useState<boolean>(
    Boolean(state.hiladoEnPaila?.esManual)
  );

  // Estados locales Paso 1 (Prueba de Hilado)
  const [horaManualPrueba, setHoraManualPrueba] = useState<string>(
    state.pruebaHilado.horaRegistro || getCurrentTimeString()
  );

  // Estados locales Paso 2 (Adición de Sal)
  const [horaManualSal, setHoraManualSal] = useState<string>(
    state.sal?.horaRegistro || getCurrentTimeString()
  );
  const [gramosSalInput, setGramosSalInput] = useState<number>(
    state.sal?.cantidadGramos ?? salCalculadaPorFormula
  );

  // Estados locales Paso 3 (Hilado y Amasado)
  const [horaManualInicioHilado, setHoraManualInicioHilado] = useState<string>(
    state.hiladoEnPaila?.horaInicio || getCurrentTimeString()
  );
  const [horaManualFinHilado, setHoraManualFinHilado] = useState<string>(
    state.hiladoEnPaila?.horaFin || getCurrentTimeString()
  );

  // Sincronización cuando no está en modo edición manual
  useEffect(() => {
    if (!manualPaso1) {
      setHoraManualPrueba(
        state.pruebaHilado.horaRegistro || getCurrentTimeString()
      );
    }
  }, [manualPaso1, state.pruebaHilado.horaRegistro]);

  useEffect(() => {
    if (!manualPaso2) {
      setHoraManualSal(state.sal?.horaRegistro || getCurrentTimeString());
      setGramosSalInput(state.sal?.cantidadGramos ?? salCalculadaPorFormula);
    }
  }, [manualPaso2, state.sal?.horaRegistro, state.sal?.cantidadGramos, salCalculadaPorFormula]);

  useEffect(() => {
    if (!manualPaso3) {
      setHoraManualInicioHilado(
        state.hiladoEnPaila?.horaInicio || getCurrentTimeString()
      );
      setHoraManualFinHilado(
        state.hiladoEnPaila?.horaFin || getCurrentTimeString()
      );
    }
  }, [
    manualPaso3,
    state.hiladoEnPaila?.horaInicio,
    state.hiladoEnPaila?.horaFin,
  ]);

  // =========================================================================
  // CRONÓMETROS EN VIVO
  // =========================================================================
  // Cronómetro Paso 1: desde el fin de escurrido hasta confirmar la prueba
  const timerPruebaHilado = useStageCountdown({
    startTimestamp: tsFinEscurridoRef,
    isRunning: !state.pruebaHilado.exitosa,
    isCompleted: Boolean(state.pruebaHilado.exitosa),
    targetMinutes: 10,
    completedDurationText: state.pruebaHilado.tiempoDesdeDesuerado,
  });

  // Cronómetro Paso 3: Proceso de Hilado en Paila (Inicio -> Fin)
  const tsInicioHiladoEfectivo = useMemo(() => {
    if (state.hiladoEnPaila?.timestampInicio) {
      return state.hiladoEnPaila.timestampInicio;
    }
    if (state.hiladoEnPaila?.horaInicio) {
      const sec = timeStringToSecondsToday(state.hiladoEnPaila.horaInicio);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return today.getTime() + sec * 1000;
    }
    return null;
  }, [state.hiladoEnPaila?.timestampInicio, state.hiladoEnPaila?.horaInicio]);

  const isHiladoRunning = Boolean(
    state.hiladoEnPaila?.iniciado &&
      !state.hiladoEnPaila?.completado &&
      tsInicioHiladoEfectivo
  );
  const isHiladoCompleted = Boolean(state.hiladoEnPaila?.completado);

  const timerHiladoPaila = useStageCountdown({
    startTimestamp: tsInicioHiladoEfectivo,
    isRunning: isHiladoRunning,
    isCompleted: isHiladoCompleted,
    targetMinutes: 15,
    completedDurationText: state.hiladoEnPaila?.duracion,
  });

  // =========================================================================
  // RECÁLCULOS AUTOMÁTICOS DE DURACIONES (TRAZABILIDAD INDUSTRIAL)
  // =========================================================================

  // Paso 1: Duración = Hora de confirmación - Hora de fin de escurrido de la etapa anterior
  const duracionPruebaRecalculada = useMemo(() => {
    if (!horaManualPrueba) {
      return {
        human: state.pruebaHilado.tiempoDesdeDesuerado || '0 s',
        seconds: 0,
      };
    }
    if (horaFinEscurridoRef && horaFinEscurridoRef !== 'En espera') {
      return computeDurationBetweenTimes(horaFinEscurridoRef, horaManualPrueba);
    }
    return {
      human: state.pruebaHilado.tiempoDesdeDesuerado || '0 s',
      seconds: 0,
    };
  }, [
    horaFinEscurridoRef,
    horaManualPrueba,
    state.pruebaHilado.tiempoDesdeDesuerado,
  ]);

  // Paso 3: Duración = Hora de fin - Hora de inicio
  const duracionHiladoRecalculada = useMemo(() => {
    if (!horaManualFinHilado || !horaManualInicioHilado) {
      return {
        human: state.hiladoEnPaila?.duracion || '0 s',
        seconds: 0,
      };
    }
    return computeDurationBetweenTimes(
      horaManualInicioHilado,
      horaManualFinHilado
    );
  }, [
    horaManualInicioHilado,
    horaManualFinHilado,
    state.hiladoEnPaila?.duracion,
  ]);

  // Alerta visual de Sal: Rango esperado ±15% de la fórmula teórica
  const salDiferencia = Math.abs(gramosSalInput - salCalculadaPorFormula);
  const salAlerta =
    gramosSalInput > 0 &&
    salDiferencia > Math.max(10, salCalculadaPorFormula * 0.15);

  // =========================================================================
  // HANDLERS PASO 1: PRUEBA DE HILADO ("La prueba de hilado ha sido exitosa")
  // =========================================================================
  const handleRecordPruebaHiladoExitosa = () => {
    const nowTs = Date.now();
    const timeStr = getCurrentTimeString();
    const duracionStr =
      horaFinEscurridoRef && horaFinEscurridoRef !== 'En espera'
        ? computeDurationBetweenTimes(horaFinEscurridoRef, timeStr).human
        : formatHumanDuration(
            Math.max(1, Math.floor((nowTs - tsFinEscurridoRef) / 1000))
          );

    const resultadoTexto =
      'Prueba Exitosa: Hebra continua, elástica, brillante y se estiró más de 10 cm';

    onChange((prev) => ({
      ...prev,
      pruebaHilado: {
        ...prev.pruebaHilado,
        exitosa: true,
        horaRegistro: timeStr,
        timestampPruebaHilado: nowTs,
        tiempoDesdeDesuerado: duracionStr,
        resultado: resultadoTexto,
        esManual: manualPaso1,
      },
    }));

    setHoraManualPrueba(timeStr);

    showToast(
      `✓ Prueba de hilado exitosa a las ${timeStr} (se estiró >10 cm) · Tardó ${duracionStr}`,
      'success'
    );
  };

  const handleSaveManualPrueba = () => {
    const timeStr = formatTimeFromStep1(horaManualPrueba);
    let duracionStr = state.pruebaHilado.tiempoDesdeDesuerado || '0 s';

    if (horaFinEscurridoRef && horaFinEscurridoRef !== 'En espera') {
      duracionStr = computeDurationBetweenTimes(
        horaFinEscurridoRef,
        timeStr
      ).human;
    }

    const sec = timeStringToSecondsToday(timeStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const manualTs = today.getTime() + sec * 1000;

    const resultadoTexto =
      'Prueba Exitosa: Hebra continua, elástica, brillante y se estiró más de 10 cm';

    onChange((prev) => ({
      ...prev,
      pruebaHilado: {
        ...prev.pruebaHilado,
        exitosa: true,
        horaRegistro: timeStr,
        timestampPruebaHilado: manualTs,
        tiempoDesdeDesuerado: duracionStr,
        resultado: resultadoTexto,
        esManual: true,
      },
    }));

    setManualPaso1(false);
    showToast(
      `✓ Hora de prueba de hilado actualizada: ${timeStr} (${duracionStr})`,
      'success'
    );
  };

  // =========================================================================
  // HANDLERS PASO 2: ADICIÓN DE SAL ("Agregué sal")
  // =========================================================================
  const handleRecordSal = () => {
    if (!loteSalEfectivo) {
      showToast('Selecciona el lote de sal en la Etapa 1 antes de registrar la sal.', 'warning');
      return;
    }
    const timeStr = getCurrentTimeString();
    const finalGramos =
      gramosSalInput > 0 ? gramosSalInput : salCalculadaPorFormula;

    onChange((prev) => ({
      ...prev,
      sal: {
        ...(prev.sal || {}),
        registrado: true,
        horaRegistro: timeStr,
        cantidadGramos: finalGramos,
        loteSal: loteSalEfectivo,
        esManual: manualPaso2,
      },
    }));

    setHoraManualSal(timeStr);

    showToast(
      `✓ Sal agregada a las ${timeStr} · ${finalGramos} g (${loteSalEfectivo})`,
      'success'
    );
  };

  const handleSaveManualSal = () => {
    const timeStr = formatTimeFromStep1(horaManualSal);
    const finalGramos =
      gramosSalInput > 0 ? gramosSalInput : salCalculadaPorFormula;

    onChange((prev) => ({
      ...prev,
      sal: {
        ...(prev.sal || {}),
        registrado: true,
        horaRegistro: timeStr,
        cantidadGramos: finalGramos,
        loteSal: loteSalEfectivo,
        esManual: true,
      },
    }));

    setManualPaso2(false);
    showToast(
      `✓ Datos de sal guardados: ${finalGramos} g (${loteSalEfectivo}) a las ${timeStr}`,
      'success'
    );
  };

  // =========================================================================
  // HANDLERS PASO 3: PROCESO EN PAILA ("Hilar y Amasar")
  // =========================================================================
  // 1. Iniciar proceso de hilado
  const handleStartAmasadoPaila = () => {
    if (state.hiladoEnPaila?.iniciado) return;
    const nowTs = Date.now();
    const timeStr = getCurrentTimeString();

    onChange((prev) => ({
      ...prev,
      hiladoEnPaila: {
        ...(prev.hiladoEnPaila || {}),
        iniciado: true,
        completado: false,
        horaInicio: timeStr,
        timestampInicio: nowTs,
        duracion: null,
        esManual: manualPaso3,
      },
    }));

    setHoraManualInicioHilado(timeStr);

    showToast(
      `✓ Proceso de hilado iniciado en paila a las ${timeStr}`,
      'info'
    );
  };

  // 2. Finalizar hilado
  const handleFinAmasadoPaila = () => {
    if (!state.hiladoEnPaila?.iniciado || state.hiladoEnPaila?.completado) return;
    const nowTs = Date.now();
    const timeStr = getCurrentTimeString();
    const inicioStr =
      state.hiladoEnPaila?.horaInicio || horaManualInicioHilado;
    const duracionStr =
      inicioStr && inicioStr !== 'En espera'
        ? computeDurationBetweenTimes(inicioStr, timeStr).human
        : '0 s';

    // 1. Registrar la "Hora de fin" para calcular el "Tiempo total de hilado"
    onChange((prev) => ({
      ...prev,
      hiladoEnPaila: {
        ...(prev.hiladoEnPaila || {}),
        iniciado: true,
        completado: true,
        horaFin: timeStr,
        timestampFin: nowTs,
        duracion: duracionStr,
        esManual: manualPaso3,
      },
      extruirYAirear: {
        completado: true,
        horaFin: timeStr,
        timestampExtruirYAirear: nowTs,
        duracion: duracionStr,
      },
      procesoFinalizado: {
        finalizado: true,
        horaFinalizacion: timeStr,
        tiempoTotalProceso: duracionStr,
      },
    }));

    setHoraManualFinHilado(timeStr);

    // 2. DETENER EL CRONÓMETRO GENERAL DEL LOTE
    if (onStopProcessTimer) {
      onStopProcessTimer(timeStr);
    }

    showToast(
      `✓ Hilado finalizado a las ${timeStr} (${duracionStr}) · Cronómetro general detenido`,
      'success'
    );
  };

  const handleSaveManualHilado = () => {
    const timeInicioStr = formatTimeFromStep1(horaManualInicioHilado);
    const timeFinStr = formatTimeFromStep1(horaManualFinHilado);
    const duracionStr = computeDurationBetweenTimes(
      timeInicioStr,
      timeFinStr
    ).human;

    const secInicio = timeStringToSecondsToday(timeInicioStr);
    const secFin = timeStringToSecondsToday(timeFinStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const manualTsInicio = today.getTime() + secInicio * 1000;
    const manualTsFin = today.getTime() + secFin * 1000;

    onChange((prev) => ({
      ...prev,
      hiladoEnPaila: {
        ...(prev.hiladoEnPaila || {}),
        iniciado: true,
        completado: true,
        horaInicio: timeInicioStr,
        horaFin: timeFinStr,
        timestampInicio: manualTsInicio,
        timestampFin: manualTsFin,
        duracion: duracionStr,
        esManual: true,
      },
      procesoFinalizado: {
        finalizado: true,
        horaFinalizacion: timeFinStr,
        tiempoTotalProceso: duracionStr,
      },
    }));

    // Sincronizar detención del cronómetro general si ya finalizó
    if (state.hiladoEnPaila?.completado && onStopProcessTimer) {
      onStopProcessTimer(timeFinStr);
    }

    setManualPaso3(false);
    showToast(
      `✓ Hilado manual actualizado: ${timeInicioStr} a ${timeFinStr} (${duracionStr})`,
      'success'
    );
  };

  return (
    <div className="flex flex-col w-full p-4 lg:p-6 gap-6 bg-[#FFFFFF] min-h-[calc(100vh-4rem)] pb-12">
      <StageHeader
        stageNumber={4}
        totalStages={5}
        title="Prueba de Hilado, Sal e Hilado en Paila"
        productName="Queso Doble Crema"
        icon="waves"
        isCompleted={Boolean(state.hiladoEnPaila?.completado)}
      />

      {/* BANNER: CRONÓMETRO GENERAL DE PRODUCCIÓN DEL LOTE */}
      <TimerBanner
        title="Cronómetro General de Producción del Lote"
        subtitle={
          processTimer.isCompleted
            ? `Producción activa finalizada al terminar el hilado (${processTimer.formattedTime || 'Detenido'}). El tiempo se detuvo para el moldeo.`
            : `El reloj de producción está activo desde las ${processTimer.startTime || 'el inicio'}. Se detendrá automáticamente al pulsar "Proceso de hilado finalizado".`
        }
        formattedTime={processTimer.formattedTime || '00:00:00'}
        isRunning={processTimer.isRunning}
        isCompleted={processTimer.isCompleted}
        statusLabel={
          processTimer.isCompleted
            ? 'Reloj general detenido (Listo para moldeo)'
            : 'Reloj principal de producción en marcha'
        }
        variant={processTimer.isCompleted ? 'success' : 'info'}
      />

      {/* =========================================================================
          PASO 01: PRUEBA DE HILADO ("La prueba de hilado ha sido exitosa")
      ========================================================================= */}
      <Card
        title="La prueba de hilado ha sido exitosa"
        icon="verified"
        badge={
          state.pruebaHilado.exitosa
            ? '✓ Se estiró > 10 cm'
            : 'Pendiente Prueba de Hilado'
        }
        variant={state.pruebaHilado.exitosa ? 'success' : 'default'}
        headerAction={
          <ConfirmButton
            label="Confirmar: La Prueba Salió Bien"
            confirmedLabel="✓ Prueba Exitosa (Se estiró > 10 cm)"
            icon="verified"
            isConfirmed={Boolean(state.pruebaHilado.exitosa)}
            onConfirm={handleRecordPruebaHiladoExitosa}
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
            state.pruebaHilado.exitosa ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-[#D6DEEA]/70">
                <div className="p-3.5 bg-white rounded-xl border border-amber-200 flex flex-col justify-between">
                  <span className="text-[10px] uppercase font-bold text-gray-500">
                    Hora de confirmación de la prueba
                  </span>
                  <span className="text-lg font-black font-mono text-amber-900 mt-1">
                    {state.pruebaHilado.horaRegistro}
                  </span>
                  <span className="text-[11px] text-gray-500">
                    Momento en que se validó la hebra
                  </span>
                </div>

                <div className="p-3.5 bg-white rounded-xl border border-blue-200 flex flex-col justify-between">
                  <span className="text-[10px] uppercase font-bold text-gray-500">
                    Tiempo desde el desuerado
                  </span>
                  <span className="text-lg font-black font-mono text-[#1B4E9B] mt-1">
                    {state.pruebaHilado.tiempoDesdeDesuerado}
                  </span>
                  <span className="text-[11px] text-gray-500">
                    Calculado desde el fin de escurrido ({horaFinEscurridoRef})
                  </span>
                </div>

                <div className="p-3.5 bg-white rounded-xl border border-emerald-200 flex flex-col justify-between">
                  <span className="text-[10px] uppercase font-bold text-emerald-800">
                    Resultado de la Hebra
                  </span>
                  <span className="text-xs font-black text-emerald-800 mt-1 flex items-center gap-1">
                    <span className="material-symbols-outlined text-[16px] text-emerald-600">
                      verified
                    </span>
                    Se estiró más de 10 cm (continua y brillante)
                  </span>
                  <span className="text-[11px] text-gray-500 mt-0.5">
                    Masa en punto para salar e hilar
                  </span>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-[#D6DEEA]/60">
                <div className="p-3.5 bg-white rounded-xl border border-blue-200 flex flex-col justify-between">
                  <span className="text-[10px] uppercase font-bold text-gray-500">
                    Referencia Fin de Escurrido
                  </span>
                  <span className="text-lg font-black font-mono text-[#1B4E9B] mt-1">
                    {horaFinEscurridoRef}
                  </span>
                  <span className="text-[11px] text-gray-500">
                    Punto de partida de reposo
                  </span>
                </div>

                <div className="p-3.5 bg-white rounded-xl border border-amber-200 flex flex-col justify-between">
                  <span className="text-[10px] uppercase font-bold text-amber-900">
                    Tiempo Transcurrido
                  </span>
                  <span className="text-2xl font-black font-mono text-amber-800 mt-1">
                    {timerPruebaHilado.formattedElapsed}
                  </span>
                  <span className="text-[11px] text-gray-500">
                    Contando tiempo de reposo
                  </span>
                </div>

                <div className="p-3.5 bg-white rounded-xl border border-emerald-200 flex flex-col justify-between">
                  <span className="text-[10px] uppercase font-bold text-emerald-800">
                    Condición Requerida
                  </span>
                  <span className="text-xs font-bold text-emerald-900 mt-1">
                    La hebra debe estirar más de 10 cm en agua caliente (70 °C)
                  </span>
                  <span className="text-[11px] text-gray-500">
                    pH: {phMedidoEnEscurrido.toFixed(2)}
                  </span>
                </div>
              </div>
            )
          ) : (
            <div className="p-4 rounded-xl bg-amber-50/90 border-2 border-amber-300 flex flex-col gap-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
                {/* 1. Hora de confirmación de la prueba (EVENTO EDITABLE CON POPOVER) */}
                <PopoverTimePicker
                  label="Hora de confirmación de la prueba"
                  icon="schedule"
                  value={horaManualPrueba}
                  onChange={setHoraManualPrueba}
                />

                {/* 2. Tiempo desde el desuerado (DURACIÓN SOLO LECTURA BLOQUEADA) */}
                <InputField
                  label="Tiempo desde el desuerado"
                  icon="timer"
                  type="text"
                  disabled
                  readOnly
                  placeholder="Se calcula automáticamente"
                  hint={
                    horaFinEscurridoRef && horaFinEscurridoRef !== 'En espera'
                      ? `Calculado: ${horaFinEscurridoRef} → ${horaManualPrueba}`
                      : 'Calculado automáticamente desde el fin de escurrido'
                  }
                  value={duracionPruebaRecalculada.human}
                />
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  variant="primary"
                  size="md"
                  icon="save"
                  onClick={handleSaveManualPrueba}
                >
                  Guardar cambios
                </Button>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* =========================================================================
          PASO 02: ADICIÓN DE SAL ("Agregué sal")
      ========================================================================= */}
      <Card
        title="Agregué sal"
        subtitle={`Fórmula: 360 g de sal por cada 300 L de leche. Cantidad base: ${totalLecheMezcla} L de leche de la Etapa 1.`}
        icon="grain"
        badge={
          state.sal?.registrado ? '✓ Sal Agregada' : 'Pendiente Agregar Sal'
        }
        variant={state.sal?.registrado ? 'success' : 'default'}
        headerAction={
          <ConfirmButton
            label="Confirmar: Agregué Sal"
            confirmedLabel="✓ Sal Agregada"
            icon="add_circle"
            isConfirmed={Boolean(state.sal?.registrado)}
            disabled={!state.pruebaHilado.exitosa}
            onConfirm={handleRecordSal}
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-[#D6DEEA]/70">
              {/* 1. Lote de Sal (Solo Lectura, traído de AcidificarStage) */}
              <div className="p-3.5 bg-white rounded-xl border border-gray-200 flex flex-col justify-between">
                <span className="text-[10px] uppercase font-bold text-gray-500 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[16px] text-amber-600">
                    inventory_2
                  </span>
                  Lote de la Sal
                </span>
                <div className="mt-2">
                  <span className="text-lg font-black font-mono text-gray-900 block">
                    {loteSalEfectivo || 'Sin seleccionar'}
                  </span>
                  <span className="text-[11px] text-emerald-700 font-bold block mt-1 flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">
                      verified
                    </span>
                    Definido en Etapa 1 (Acidificar)
                  </span>
                </div>
              </div>

              {/* 2. Cantidad de Sal Calculada */}
              <div
                className={`p-3.5 rounded-xl border-2 transition-all flex flex-col justify-between ${
                  salAlerta
                    ? 'bg-amber-50 border-amber-400 shadow-sm'
                    : 'bg-white border-amber-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold text-amber-900 flex items-center gap-1">
                    <span className="material-symbols-outlined text-[16px] text-amber-600">
                      scale
                    </span>
                    Cantidad de Sal
                  </span>
                  <Badge variant="info" size="sm">
                    {salCalculadaPorFormula} g sug.
                  </Badge>
                </div>
                <div className="mt-2">
                  <span className="text-2xl font-black font-mono text-amber-900 block">
                    {state.sal?.cantidadGramos ?? salCalculadaPorFormula} g
                  </span>
                  <span className="text-[11px] text-gray-600 font-semibold block mt-0.5">
                    Fórmula: (360 g / 300 L) × {totalLecheMezcla} L
                  </span>
                </div>
              </div>

              {/* 3. Hora en que se agregó la sal */}
              <div className="p-3.5 bg-white rounded-xl border border-emerald-200 flex flex-col justify-between">
                <span className="text-[10px] uppercase font-bold text-emerald-800 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[16px] text-emerald-700">
                    schedule
                  </span>
                  Hora en que se Agregó la Sal
                </span>
                <div className="mt-2">
                  <span className="text-xl font-black font-mono text-emerald-800 block">
                    {state.sal?.horaRegistro || '--:--:--'}
                  </span>
                  <span className="text-[11px] text-gray-500 font-semibold block mt-1">
                    {state.sal?.registrado
                      ? 'Sal mezclada con la masa'
                      : 'Pendiente agregar sal'}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-amber-50/90 border-2 border-amber-300 flex flex-col gap-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-start">
                {/* 1. Lote de Sal (Solo Lectura) */}
                <div className="p-3.5 bg-white/80 rounded-xl border border-gray-300 flex flex-col justify-between">
                  <span className="text-[10px] uppercase font-bold text-gray-500">
                    Lote de Sal (Etapa 1)
                  </span>
                  <span className="text-base font-black font-mono text-gray-800 mt-1">
                    {loteSalEfectivo || 'Sin seleccionar'}
                  </span>
                  <span className="text-[10px] text-gray-500 mt-1">
                    No editable (seleccionado en acidificación)
                  </span>
                </div>

                {/* 2. Hora en que se agregó la sal (EVENTO EDITABLE CON POPOVER) */}
                <PopoverTimePicker
                  label="Hora en que se agregó la sal"
                  icon="schedule"
                  value={horaManualSal}
                  onChange={setHoraManualSal}
                />

                {/* 3. Cantidad de Sal (g) (INPUT NUMÉRICO SIN CEROS INICIALES) */}
                <div
                  className={`p-3 rounded-xl border-2 transition-all flex flex-col gap-1 ${
                    salAlerta
                      ? 'bg-amber-50 border-amber-400'
                      : 'bg-white border-blue-200'
                  }`}
                >
                  <label className="text-xs font-black text-[#191c1e] flex items-center justify-between">
                    <span>Cantidad de Sal (g)</span>
                    <Badge variant={salAlerta ? 'warning' : 'neutral'} size="sm">
                      Sugerido: {salCalculadaPorFormula} g
                    </Badge>
                  </label>
                  <InputField
                    type="number"
                    inputMode="decimal"
                    step="1"
                    min="0"
                    unit="g"
                    placeholder={`Ej: ${salCalculadaPorFormula}`}
                    targetHint="Fórmula: 360 g por cada 300 L"
                    status={salAlerta ? 'warning' : 'default'}
                    value={gramosSalInput > 0 ? gramosSalInput : ''}
                    onChange={(e) => {
                      const val = e.target.value
                        ? parseFloat(e.target.value)
                        : 0;
                      setGramosSalInput(val);
                    }}
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  variant="primary"
                  size="md"
                  icon="save"
                  onClick={handleSaveManualSal}
                >
                  Guardar cambios
                </Button>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* =========================================================================
          PASO 03: PROCESO EN PAILA ("Hilar y Amasar")
      ========================================================================= */}
      <Card
        title="Hilar y Amasar"
        icon="settings_motion_mode"
        badge={
          state.hiladoEnPaila?.completado
            ? '✓ Hilado Terminado'
            : state.hiladoEnPaila?.iniciado
            ? 'Hilando en Paila...'
            : 'Pendiente Iniciar Hilado'
        }
        variant={
          state.hiladoEnPaila?.completado
            ? 'success'
            : state.hiladoEnPaila?.iniciado
            ? 'warning'
            : 'default'
        }
        headerAction={
          <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
            <Button
              variant="primary"
              size="md"
              icon="play_circle"
              disabled={
                Boolean(state.hiladoEnPaila?.iniciado) ||
                !state.sal?.registrado
              }
              onClick={handleStartAmasadoPaila}
            >
              {state.hiladoEnPaila?.iniciado
                ? `Iniciado (${state.hiladoEnPaila.horaInicio})`
                : 'Iniciar proceso de hilado'}
            </Button>

            <Button
              variant="danger"
              size="md"
              icon="stop_circle"
              disabled={
                !state.hiladoEnPaila?.iniciado ||
                Boolean(state.hiladoEnPaila?.completado)
              }
              onClick={handleFinAmasadoPaila}
            >
              {state.hiladoEnPaila?.completado
                ? `Finalizado (${state.hiladoEnPaila.horaFin})`
                : 'Proceso de hilado finalizado'}
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          {/* CRONÓMETRO VISUAL EN VIVO ENTRE INICIO Y FIN DEL HILADO */}
          {state.hiladoEnPaila?.iniciado && (
            <TimerBanner
              title="Cronómetro de Hilado y Amasado en Paila"
              subtitle={
                state.hiladoEnPaila?.completado
                  ? `Hilado finalizado a las ${state.hiladoEnPaila.horaFin} (tardó ${state.hiladoEnPaila.duracion}).`
                  : `Iniciado a las ${state.hiladoEnPaila.horaInicio}. Amasando en paila...`
              }
              formattedTime={
                state.hiladoEnPaila?.completado
                  ? state.hiladoEnPaila.duracion ||
                    timerHiladoPaila.humanElapsed
                  : timerHiladoPaila.formattedElapsed
              }
              isRunning={isHiladoRunning}
              isCompleted={isHiladoCompleted}
              statusLabel={
                state.hiladoEnPaila?.completado
                  ? 'Hilado completado'
                  : 'Hilando en paila en vivo'
              }
              variant="warning"
            />
          )}

          <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-300 flex flex-wrap items-center justify-between gap-2 min-h-[48px]">
            <ManualEditToggle manual={Boolean(manualPaso3)} onChange={(checked: boolean) => setManualPaso3(checked)} />
            <Badge variant={manualPaso3 ? 'warning' : 'neutral'} size="sm">
              {manualPaso3 ? 'Modo Manual Activo' : 'Automático'}
            </Badge>
          </div>

          {!manualPaso3 ? (
            state.hiladoEnPaila?.iniciado ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-[#D6DEEA]/70">
                <div className="p-3.5 bg-white rounded-xl border border-gray-200 flex flex-col justify-between">
                  <span className="text-[10px] uppercase font-bold text-gray-500">
                    Hora de inicio
                  </span>
                  <span className="text-lg font-black font-mono text-gray-900 mt-1">
                    {state.hiladoEnPaila?.horaInicio || '--:--:--'}
                  </span>
                  <span className="text-[11px] text-gray-500">
                    Entrada de la masa a la paila
                  </span>
                </div>

                <div className="p-3.5 bg-white rounded-xl border border-amber-200 flex flex-col justify-between">
                  <span className="text-[10px] uppercase font-bold text-amber-900">
                    Hora de fin
                  </span>
                  <span className="text-lg font-black font-mono text-amber-900 mt-1">
                    {state.hiladoEnPaila?.horaFin || '--:--:--'}
                  </span>
                  <span className="text-[11px] text-gray-500">
                    Punto de brillo y textura alcanzado
                  </span>
                </div>

                <div className="p-3.5 bg-white rounded-xl border border-[#D6DEEA] flex flex-col justify-between">
                  <span className="text-[10px] uppercase font-bold text-gray-500">
                    Tiempo total de hilado
                  </span>
                  <span className="text-xl font-black font-mono text-[#1B4E9B] mt-1">
                    {state.hiladoEnPaila?.duracion ||
                      (isHiladoRunning
                        ? timerHiladoPaila.formattedElapsed
                        : '--')}
                  </span>
                  <span className="text-[11px] text-gray-500">
                    Calculado: Hora de fin - Hora de inicio
                  </span>
                </div>
              </div>
            ) : (
              <div className="pt-2 border-t border-[#D6DEEA]/60 text-xs text-[#434655] flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-[#1B4E9B]">
                  info
                </span>
                <span>
                  {state.sal?.registrado
                    ? 'Presiona "Iniciar proceso de hilado" para marcar la hora de inicio y activar el cronómetro.'
                    : 'Primero debes registrar la sal en el Paso 2 para iniciar el hilado.'}
                </span>
              </div>
            )
          ) : (
            <div className="p-4 rounded-xl bg-amber-50/90 border-2 border-amber-300 flex flex-col gap-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-start">
                {/* 1. Hora de inicio (EVENTO EDITABLE CON POPOVER) */}
                <PopoverTimePicker
                  label="Hora de inicio"
                  icon="schedule"
                  value={horaManualInicioHilado}
                  onChange={setHoraManualInicioHilado}
                />

                {/* 2. Hora de fin (EVENTO EDITABLE CON POPOVER) */}
                <PopoverTimePicker
                  label="Hora de fin"
                  icon="schedule"
                  value={horaManualFinHilado}
                  onChange={setHoraManualFinHilado}
                />

                {/* 3. Tiempo total de hilado (DURACIÓN SOLO LECTURA BLOQUEADA) */}
                <InputField
                  label="Tiempo total de hilado"
                  icon="timer"
                  type="text"
                  disabled
                  readOnly
                  placeholder="Se calcula automáticamente"
                  hint={`Calculado: ${horaManualInicioHilado} → ${horaManualFinHilado}`}
                  value={duracionHiladoRecalculada.human}
                />
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  variant="primary"
                  size="md"
                  icon="save"
                  onClick={handleSaveManualHilado}
                >
                  Guardar cambios
                </Button>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Siguiente Etapa: Rendimiento y Moldeo (Sin botón de Ver Resumen) */}
      {onNextStage && (
        <div className="p-5 rounded-2xl bg-white border border-[#D6DEEA] shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-[#1B4E9B] flex items-center justify-center shrink-0 border border-blue-200">
              <span className="material-symbols-outlined text-[26px]">scale</span>
            </div>
            <div>
              <h4 className="font-black text-sm sm:text-base text-gray-900">
                ¿Terminaste de hilar y amasar?
              </h4>
              <p className="text-xs text-gray-500">
                Pasa de inmediato a pesar la masa, llenar los moldes y cerrar el lote.
              </p>
            </div>
          </div>

          <Button
            variant="primary"
            size="lg"
            iconRight="arrow_forward"
            onClick={onNextStage}
            disabled={!state.hiladoEnPaila?.completado}
          >
            Pasar a Etapa 5: Rendimiento y Moldeo
          </Button>
        </div>
      )}
    </div>
  );
};
