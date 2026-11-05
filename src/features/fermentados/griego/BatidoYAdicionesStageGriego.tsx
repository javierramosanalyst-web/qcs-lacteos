import React, { useState } from 'react';
import { BatidoYAdicionesYogurGriegoState } from '../../../types/yogur_griego';
import { ProcessTimerState } from '../../../types';
import {
  computeDurationBetweenTimes,
  formatHumanDuration,
  formatTimeFromStep1,
  getCurrentTimeString,
} from '../../../utils/timer';
import { useStageCountdown } from '../../../hooks/useStageCountdown';
import { insumoOptions, useInsumoLotesVersion } from '../../../data/insumoLotes';
import {
  StageHeader,
  Card,
  InputField,
  SelectField,
  Button,
  PopoverTimePicker,
  TimerBanner,
} from '../../../components/ui';

interface BatidoYAdicionesStageGriegoProps {
  state: BatidoYAdicionesYogurGriegoState;
  onChange: (
    updater: (
      prev: BatidoYAdicionesYogurGriegoState
    ) => BatidoYAdicionesYogurGriegoState
  ) => void;
  baseFiltradaKg?: number;
  processTimer: ProcessTimerState;
  onNextStage: () => void;
  onOpenReviewModal: () => void;
  showToast: (msg: string, type?: 'success' | 'info' | 'warning') => void;
}

// Lotes de Stevia: vienen de la base de datos (Admin > Insumos, tipo 'estevia').
// Conserva el lote ya registrado aunque hoy no esté activo en Insumos.
const conLoteActual = (opts: { value: string; label: string }[], val: string) =>
  val && !opts.some((o) => o.value === val) ? [{ value: val, label: val }, ...opts] : opts;

export const BatidoYAdicionesStageGriego: React.FC<
  BatidoYAdicionesStageGriegoProps
> = ({ state, onChange, onNextStage, showToast }) => {
  const { batido, formulacion } = state;
  useInsumoLotesVersion();

  // Estado Paso 1: Insumo Stevia
  const [cantidadSteviaInput, setCantidadSteviaInput] = useState<string>(
    formulacion.variedadConEstevia?.gramosEstevia
      ? String(formulacion.variedadConEstevia.gramosEstevia)
      : ''
  );
  const [loteSteviaSelected, setLoteSteviaSelected] = useState<string>(
    formulacion.variedadConEstevia?.loteEstevia || ''
  );
  const [manualStevia, setManualStevia] = useState<boolean>(false);
  const [horaManualStevia, setHoraManualStevia] = useState<string>(
    formulacion.variedadConEstevia?.horaAdicion || getCurrentTimeString()
  );

  // Estado Paso 2: Batido
  const [manualBatido, setManualBatido] = useState<boolean>(false);
  const [horaManualInicioBatido, setHoraManualInicioBatido] = useState<string>(
    batido.horaInicio || getCurrentTimeString()
  );
  const [horaManualFinBatido, setHoraManualFinBatido] = useState<string>(
    batido.horaFin || getCurrentTimeString()
  );

  // Reloj de batido (5 min sugerido)
  const batidoTimer = useStageCountdown({
    isRunning: Boolean(batido.iniciado && !batido.completado),
    isCompleted: Boolean(batido.completado),
    targetMinutes: 5,
    completedDurationText: batido.tiempoBatido,
  });

  const isSteviaConfirmada = Boolean(
    formulacion.variedadConEstevia?.confirmado ||
      (formulacion.registrado && formulacion.variedadConEstevia?.gramosEstevia > 0)
  );

  // --- Handlers Paso 1: Stevia ---
  const handleConfirmarStevia = () => {
    const numGramos = Number(cantidadSteviaInput);
    if (!cantidadSteviaInput || numGramos <= 0) {
      showToast('⚠️ Ingresa la cantidad de Stevia en gramos.', 'warning');
      return;
    }
    if (!loteSteviaSelected.trim()) {
      showToast('⚠️ Selecciona el lote de Stevia.', 'warning');
      return;
    }

    const timeStr = manualStevia
      ? formatTimeFromStep1(horaManualStevia)
      : getCurrentTimeString();

    onChange((prev) => ({
      ...prev,
      formulacion: {
        ...prev.formulacion,
        tipo: 'con_stevia',
        llevaStevia: true,
        registrado: true,
        horaRegistro: timeStr,
        variedadConEstevia: {
          ...prev.formulacion.variedadConEstevia,
          gramosEstevia: numGramos,
          loteEstevia: loteSteviaSelected,
          horaAdicion: timeStr,
          confirmado: true,
        },
      },
    }));

    setHoraManualStevia(timeStr);
    showToast(
      `✓ Adición de Stevia confirmada (${numGramos} g · Lote ${loteSteviaSelected}) a las ${timeStr}.`,
      'success'
    );
  };

  const handleSaveManualSteviaTime = () => {
    const timeFmt = formatTimeFromStep1(horaManualStevia);
    onChange((prev) => ({
      ...prev,
      formulacion: {
        ...prev.formulacion,
        variedadConEstevia: {
          ...prev.formulacion.variedadConEstevia,
          horaAdicion: timeFmt,
        },
      },
    }));
    setManualStevia(false);
    showToast(`✓ Hora de adición de Stevia actualizada a ${timeFmt}.`, 'success');
  };

  // --- Handlers Paso 2: Batido ---
  const handleStartBatido = () => {
    const timeStr = getCurrentTimeString();
    onChange((prev) => ({
      ...prev,
      batido: {
        ...prev.batido,
        iniciado: true,
        completado: false,
        horaInicio: timeStr,
      },
    }));
    setHoraManualInicioBatido(timeStr);
    showToast(
      `⏱ Batido suave de Griego iniciado a las ${timeStr} (35 RPM).`,
      'info'
    );
  };

  const handleEndBatido = () => {
    const timeStr = getCurrentTimeString();
    const durStr = formatHumanDuration(Math.max(1, batidoTimer.elapsedSeconds || 300));
    onChange((prev) => ({
      ...prev,
      batido: {
        ...prev.batido,
        completado: true,
        horaFin: timeStr,
        tiempoBatido: durStr,
      },
    }));
    setHoraManualFinBatido(timeStr);
    showToast(
      `✓ Batido de Griego terminado (${durStr}). Masa homogénea y sedosa lista.`,
      'success'
    );
  };

  const handleSaveManualBatido = () => {
    const startFmt = formatTimeFromStep1(horaManualInicioBatido);
    const finFmt = formatTimeFromStep1(horaManualFinBatido);
    const durStr = computeDurationBetweenTimes(startFmt, finFmt).human;

    onChange((prev) => ({
      ...prev,
      batido: {
        ...prev.batido,
        iniciado: true,
        completado: true,
        horaInicio: startFmt,
        horaFin: finFmt,
        tiempoBatido: durStr,
        esManual: true,
      },
    }));

    setManualBatido(false);
    showToast(`✓ Horarios de batido actualizados (${durStr}).`, 'success');
  };

  const isReadyForNext = Boolean(batido.completado && isSteviaConfirmada);

  return (
    <div className="flex flex-col w-full p-4 lg:p-6 gap-5 bg-[#FFFFFF] min-h-[calc(100vh-4rem)] pb-14">
      {/* CABECERA ESTÁNDAR MAESTRA */}
      <StageHeader
        stageNumber={4}
        totalStages={5}
        lineName="Línea de Fermentados · Yogur Griego"
        title="4. Batido e Insumo Stevia (Yogur Griego)"
        subtitle="Registro de insumo Stevia y batido a 35 RPM para homogeneizar la masa concentrada de forma unificada."
        standardBadge="NTC-805"
        metrics={[
          {
            icon: 'cookie',
            label: 'Insumo Stevia',
            value: isSteviaConfirmada
              ? `${formulacion.variedadConEstevia.gramosEstevia} g (${formulacion.variedadConEstevia.loteEstevia})`
              : 'Por Registrar',
            tone: isSteviaConfirmada ? 'emerald' : 'default',
          },
          {
            icon: 'rotate_right',
            label: 'Batido Suave (35 RPM)',
            value: batido.completado
              ? 'Completado ✓'
              : batido.iniciado
              ? batidoTimer.formattedElapsed
              : 'Por Iniciar',
            tone: batido.completado
              ? 'emerald'
              : batido.iniciado
              ? 'amber'
              : 'default',
          },
        ]}
      />

      {/* ========================================================================= */}
      {/* PASO 01: REGISTRO DE INSUMO STEVIA                                        */}
      {/* ========================================================================= */}
      <Card
        stepBadge="Paso 01"
        title="Registro de Insumo Stevia"
        subtitle="Registra el lote y la cantidad exacta de Stevia en polvo a incorporar en la masa concentrada de Yogur Griego."
        icon="tune"
        tone={isSteviaConfirmada ? 'completed' : 'active'}
        statusBadge={
          isSteviaConfirmada
            ? {
                label: `Stevia Confirmada (${formulacion.variedadConEstevia.gramosEstevia} g) ✓`,
                variant: 'success',
              }
            : { label: 'Pendiente de Registro', variant: 'warning' }
        }
        headerAction={
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-semibold text-[#4A5263] bg-[#F2F4F7] px-3 py-1.5 rounded-lg border border-[#D6DEEA] hover:bg-[#E6ECF5] transition-colors">
              <input
                type="checkbox"
                checked={manualStevia}
                onChange={(e) => setManualStevia(e.target.checked)}
                className="rounded border-[#C5D0E0] text-[#191C1E] focus:ring-amber-500 w-4 h-4 cursor-pointer"
              />
              <span>Habilitar edición manual</span>
            </label>

            <Button
              variant={isSteviaConfirmada ? 'secondary' : 'primary'}
              size="md"
              icon={isSteviaConfirmada ? 'check_circle' : 'add'}
              onClick={handleConfirmarStevia}
              className={
                isSteviaConfirmada
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100 font-bold'
                  : 'font-bold shadow-sm'
              }
            >
              {isSteviaConfirmada
                ? `✓ ¡Ya agregué la stevia! (${formulacion.variedadConEstevia.gramosEstevia} g)`
                : '¡Ya agregué la stevia!'}
            </Button>
          </div>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Selector de Lote de Stevia */}
          <SelectField
            label="Lote de Stevia"
            icon="label"
            options={conLoteActual(insumoOptions('estevia'), loteSteviaSelected)}
            value={loteSteviaSelected}
            onChange={(e) => setLoteSteviaSelected(e.target.value)}
            disabled={isSteviaConfirmada && !manualStevia}
            hint="Selecciona el lote de stevia recibido de bodega"
          />

          {/* Campo Limpio de Cantidad en Gramos */}
          <InputField
            label="Cantidad de Stevia"
            type="number"
            min="0.1"
            step="0.1"
            unit="gramos"
            icon="scale"
            placeholder="Ej: 15"
            showZero={false}
            value={cantidadSteviaInput}
            onChange={(e) => setCantidadSteviaInput(e.target.value)}
            disabled={isSteviaConfirmada && !manualStevia}
            hint="Dosis estándar recomendada: 12 a 18 g"
          />

          {/* Hora de Adición / Selector Manual */}
          {!manualStevia ? (
            <div className="p-3.5 bg-[#FFFFFF] rounded-xl border border-[#D6DEEA] flex flex-col justify-between">
              <span className="text-[11px] uppercase font-bold text-[#4A5263]">
                Hora de Adición
              </span>
              <div className="text-xl font-black font-mono text-[#191C1E] mt-1">
                {formulacion.variedadConEstevia?.horaAdicion || '--:--:--'}
              </div>
              <span className="text-[11px] text-[#6B7280] mt-1 block">
                {isSteviaConfirmada
                  ? 'Registrada al confirmar adición'
                  : 'Pendiente de registrar'}
              </span>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5 justify-between">
              <PopoverTimePicker
                label="Hora de Adición Manual"
                icon="schedule"
                value={horaManualStevia}
                onChange={setHoraManualStevia}
              />
              <Button
                variant="secondary"
                size="sm"
                icon="save"
                onClick={handleSaveManualSteviaTime}
                className="w-full text-xs font-semibold"
              >
                Guardar Hora
              </Button>
            </div>
          )}
        </div>
      </Card>

      {/* ========================================================================= */}
      {/* PASO 02: PROCESO DE BATIDO SUAVE                                          */}
      {/* ========================================================================= */}
      <Card
        stepBadge="Paso 02"
        title="Proceso de Batido Suave (35 RPM)"
        subtitle="Homogeniza la masa concentrada con la stevia a 35 RPM durante 5 minutos para lograr una textura sedosa sin romper el coágulo."
        icon="rotate_right"
        tone={batido.completado ? 'completed' : batido.iniciado ? 'active' : 'default'}
        statusBadge={
          batido.completado
            ? { label: `Listo (${batido.horaFin}) ✓`, variant: 'success' }
            : batido.iniciado
            ? { label: 'Batiendo a 35 RPM...', variant: 'warning', pulse: true }
            : { label: 'Pendiente', variant: 'neutral' }
        }
        headerAction={
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-semibold text-[#4A5263] bg-[#F2F4F7] px-3 py-1.5 rounded-lg border border-[#D6DEEA] hover:bg-[#E6ECF5] transition-colors">
              <input
                type="checkbox"
                checked={manualBatido}
                onChange={(e) => setManualBatido(e.target.checked)}
                className="rounded border-[#C5D0E0] text-[#191C1E] focus:ring-amber-500 w-4 h-4 cursor-pointer"
              />
              <span>Habilitar edición manual</span>
            </label>

            {!batido.iniciado ? (
              <Button
                variant="primary"
                size="md"
                icon="play_arrow"
                onClick={handleStartBatido}
                className="font-bold shadow-sm"
              >
                Iniciar Batido Suave (5 min)
              </Button>
            ) : !batido.completado ? (
              <Button
                variant="primary"
                size="md"
                icon="check_circle"
                onClick={handleEndBatido}
                className="bg-[#5FAF32] hover:bg-[#4E9628] text-white font-bold shadow-sm"
              >
                Terminó Batido
              </Button>
            ) : (
              <Button
                variant="secondary"
                size="md"
                icon="refresh"
                onClick={handleStartBatido}
                className="font-bold"
              >
                Reiniciar Batido
              </Button>
            )}
          </div>
        }
      >
        {/* Banner del cronómetro de batido */}
        {(batido.iniciado || batido.completado) && (
          <TimerBanner
            label="Cronómetro de Batido de Yogur Griego"
            sublabel="Tiempo sugerido: 5 minutos a 35 RPM sin adición de crema"
            formattedTime={
              batido.completado
                ? batido.tiempoBatido || '5 min'
                : batidoTimer.formattedElapsed
            }
            targetLabel="5 min"
            progressPercent={batidoTimer.progressPercent}
            isRunning={Boolean(batido.iniciado && !batido.completado)}
            isCompleted={Boolean(batido.completado)}
            isOvertime={batidoTimer.isOvertime}
            className="mb-4"
          />
        )}

        {!manualBatido ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-white border border-[#D6DEEA] flex flex-col justify-between">
              <span className="text-[10px] uppercase font-bold text-gray-500 block">
                VELOCIDAD PROGRAMADA
              </span>
              <span className="text-xl font-mono font-black text-gray-900 mt-1 block">
                35 RPM
              </span>
              <span className="text-[11px] text-gray-500 mt-1 block">
                Batido lento para no liberar suero
              </span>
            </div>

            <div className="p-4 rounded-xl bg-white border border-[#D6DEEA] flex flex-col justify-between">
              <span className="text-[10px] uppercase font-bold text-gray-500 block">
                INICIO / FIN DE BATIDO
              </span>
              <span className="text-base font-mono font-bold text-gray-900 mt-1 block">
                {batido.horaInicio || '--:--'} → {batido.horaFin || '--:--'}
              </span>
              <span className="text-[11px] text-gray-500 mt-1 block">
                Duración: {batido.tiempoBatido || '--'}
              </span>
            </div>

            <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200 flex flex-col justify-between">
              <span className="text-[10px] uppercase font-bold text-emerald-900 block">
                CONSISTENCIA DE MASA
              </span>
              <span className="text-base font-bold text-emerald-950 mt-1 block">
                Cremosa, densa y sedosa
              </span>
              <span className="text-[11px] text-emerald-700 mt-1 block">
                100% masa de filtrado sin espesantes
              </span>
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-amber-50/90 border-2 border-amber-300 flex flex-col gap-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
              <PopoverTimePicker
                label="Hora de Inicio de Batido"
                icon="schedule"
                value={horaManualInicioBatido}
                onChange={setHoraManualInicioBatido}
              />
              <PopoverTimePicker
                label="Hora de Fin de Batido"
                icon="schedule"
                value={horaManualFinBatido}
                onChange={setHoraManualFinBatido}
              />
            </div>
            <div className="flex justify-end pt-1">
              <Button
                variant="primary"
                size="md"
                icon="save"
                onClick={handleSaveManualBatido}
              >
                Guardar Horarios de Batido
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* ========================================================================= */}
      {/* TARJETA INFERIOR: ACCIÓN DE CIERRE Y AVANCE A ENVASADO                     */}
      {/* ========================================================================= */}
      <div className="p-4 sm:p-5 rounded-2xl bg-white border border-[#D6DEEA] shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              isReadyForNext
                ? 'bg-emerald-100 text-emerald-900'
                : 'bg-amber-100 text-amber-900'
            }`}
          >
            <span className="material-symbols-outlined text-[24px]">inventory_2</span>
          </div>
          <div className="text-xs sm:text-sm text-[#434655]">
            <p className="font-bold text-[#191C1E]">
              {isReadyForNext
                ? '✓ Batido e Insumo completados: Listo para Envasado'
                : 'Paso previo pendiente'}
            </p>
            <p>
              {isReadyForNext
                ? 'La masa concentrada está homogenizada con la stevia. Pulsa a la derecha para avanzar a '
                : 'Registra la adición de Stevia y completa el batido suave para habilitar '}
              <strong className="text-emerald-900 font-semibold">
                5. Envasar y Guardar
              </strong>
              .
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          {isReadyForNext ? (
            <Button
              variant="primary"
              size="lg"
              icon="inventory_2"
              iconRight="arrow_forward"
              onClick={onNextStage}
              className="w-full sm:w-auto font-bold shadow-md bg-[#5FAF32] hover:bg-[#4E9628] text-white cursor-pointer"
            >
              Avanzar a 5. Envasar y Guardar
            </Button>
          ) : (
            <Button
              variant="secondary"
              size="lg"
              disabled
              className="w-full sm:w-auto font-bold opacity-60 cursor-not-allowed"
            >
              Completa el Insumo y Batido
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
