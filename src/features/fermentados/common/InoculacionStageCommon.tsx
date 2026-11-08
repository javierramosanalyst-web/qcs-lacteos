import React, { useEffect, useState, useMemo } from 'react';
import { ManualEditToggle } from '../../../components/ui/ManualEditToggle';
import {
  StageHeader,
  Card,
  InputField,
  ConfirmButton,
  TimerBanner,
  PopoverTimePicker,
  Button,
  Badge,
} from '../../../components/ui';
import { ProcessTimerState } from '../../../types';
import { InoculacionYogurState } from '../../../types/yogur';
import { InoculacionKumisState } from '../../../types/kumis';
import {
  computeDurationBetweenTimes,
  formatHumanDuration,
  formatTimeFromStep1,
  getCurrentTimeString,
  timeStringToTimestampToday,
} from '../../../utils/timer';
import { useStageCountdown } from '../../../hooks/useStageCountdown';
import { PERMITIR_DESVIO_TOTAL, maxLitrosDesviables } from '../../../config/fermentados';

export interface InoculacionStageCommonProps {
  productType: 'yogur' | 'kumis';
  state: InoculacionYogurState | InoculacionKumisState;
  onChange: (
    updater: (
      prev: InoculacionYogurState | InoculacionKumisState
    ) => InoculacionYogurState | InoculacionKumisState
  ) => void;
  horaLlegadaTemp?: string | null;
  litrosLecheBase?: number;
  loteCultivoBase?: string;
  llevaAzucar?: boolean;
  processTimer: ProcessTimerState;
  onGoToBatidoYSabores: () => void;
  onNextStage?: () => void;
  onOpenReviewModal?: () => void;
  showToast: (msg: string, type?: 'success' | 'info' | 'warning') => void;
  onExtractKumis?: (litros: number) => void;
  onExtractGriego?: (litros: number) => void;
  extraccionKumisRealizada?: boolean;
  extraccionGriegoRealizada?: boolean;
  litrosExtraidosPrevios?: number;
}

export const InoculacionStageCommon: React.FC<InoculacionStageCommonProps> = ({
  productType,
  state,
  onChange,
  horaLlegadaTemp,
  litrosLecheBase = 100,
  loteCultivoBase,
  llevaAzucar = true,
  processTimer,
  onGoToBatidoYSabores,
  onNextStage,
  showToast,
  onExtractKumis,
  onExtractGriego,
  extraccionKumisRealizada = false,
  extraccionGriegoRealizada = false,
  litrosExtraidosPrevios = 0,
}) => {
  const isYogur = productType === 'yogur';
  const isKumis = productType === 'kumis';
  const targetHoras = isYogur ? 8 : 12;
  const defaultCultureLote = isYogur ? 'CULT-PROB-2026-04' : 'CULT-KUM-2026-02';

  const volumenTotalDisponible = litrosLecheBase + (litrosExtraidosPrevios || 0);

  // Lote de cultivo heredado de la etapa anterior (Pasteurización)
  const loteCultivoEfectivo =
    loteCultivoBase ||
    (state as any).loteCultivoLactico ||
    state.loteCultivo ||
    defaultCultureLote;

  // Dosis de cultivo sugerida: estrictamente (litros / 40)
  const dosisCalculada = useMemo(() => {
    const litros = Number(litrosLecheBase) || 0;
    return litros > 0 ? Number((litros / 40).toFixed(2)) : 0;
  }, [litrosLecheBase]);

  // Sincronizar dosis calculada y lote heredado de cultivo
  useEffect(() => {
    if (!state.inoculacionConfirmada) {
      const current = state.cantidadCultivoCucharadas;
      const shouldUpdateDosis =
        !current || current === 0;
      const shouldUpdateLote =
        Boolean(loteCultivoEfectivo) && state.loteCultivo !== loteCultivoEfectivo;

      if ((shouldUpdateDosis && dosisCalculada > 0) || shouldUpdateLote) {
        onChange((prev: any) => ({
          ...prev,
          ...(shouldUpdateDosis && dosisCalculada > 0
            ? {
                cantidadCultivoCucharadas: dosisCalculada,
                cantidadCultivoGramos: dosisCalculada,
              }
            : {}),
          loteCultivo: loteCultivoEfectivo,
        }));
      }
    }
  }, [
    dosisCalculada,
    litrosLecheBase,
    state.inoculacionConfirmada,
    state.cantidadCultivoCucharadas,
    loteCultivoEfectivo,
    state.loteCultivo,
    onChange,
  ]);

  // Si no hay hora de inicio de mezclado pero llegó a la temperatura
  useEffect(() => {
    if (!state.horaInicioMezclado) {
      const initialStart = horaLlegadaTemp || getCurrentTimeString();
      onChange((prev: any) => ({
        ...prev,
        horaInicioMezclado: prev.horaInicioMezclado || initialStart,
      }));
    }
  }, [horaLlegadaTemp, state.horaInicioMezclado, onChange]);

  // Auto-iniciar la incubación si ya se inoculó
  useEffect(() => {
    if (
      state.inoculacionConfirmada &&
      !state.incubacion.iniciada &&
      !state.incubacion.completada
    ) {
      const now = Date.now();
      const startTime = state.horaInoculacion || getCurrentTimeString();
      onChange((prev: any) => ({
        ...prev,
        incubacion: {
          ...prev.incubacion,
          iniciada: true,
          horaInicio: prev.incubacion.horaInicio || startTime,
          timestampInicio: prev.incubacion.timestampInicio || now,
          duracionObjetivoHoras: targetHoras,
        },
      }));
    }
  }, [
    state.inoculacionConfirmada,
    state.incubacion.iniciada,
    state.incubacion.completada,
    state.horaInoculacion,
    targetHoras,
    onChange,
  ]);

  // Estados locales para la edición manual de tiempos con PopoverTimePicker
  const [esManualMezclado, setEsManualMezclado] = useState<boolean>(
    Boolean(state.esManualMezclado)
  );
  const [horaManualMezclado, setHoraManualMezclado] = useState<string>(
    state.horaInoculacion || getCurrentTimeString()
  );

  const [esManualIncubacion, setEsManualIncubacion] = useState<boolean>(
    Boolean(state.esManualIncubacion || state.incubacion.esManual)
  );
  const [horaManualIncubacionInicio, setHoraManualIncubacionInicio] = useState<string>(
    state.incubacion.horaInicio || getCurrentTimeString()
  );
  const [horaManualIncubacionFin, setHoraManualIncubacionFin] = useState<string>(
    state.incubacion.horaFin || getCurrentTimeString()
  );

  // Estado local para Paso 4 (Cuarto Frío)
  const [esManualCuartoFrio, setEsManualCuartoFrio] = useState<boolean>(false);
  const [horaManualCuartoFrio, setHoraManualCuartoFrio] = useState<string>(
    state.incubacion.horaEntradaCuartoFrio || getCurrentTimeString()
  );

  // Estado local para Modal de Partición de Leche (Paso 4)
  const [showModalParticion, setShowModalParticion] = useState<boolean>(false);
  const [tipoParticion, setTipoParticion] = useState<'griego' | 'kumis'>(
    llevaAzucar ? 'kumis' : 'griego'
  );
  const [litrosParticionInput, setLitrosParticionInput] = useState<string>('');
  const [errorParticion, setErrorParticion] = useState<string | null>(null);

  useEffect(() => {
    if (!llevaAzucar) {
      setTipoParticion('griego');
    }
  }, [llevaAzucar]);

  // Hook de cuenta regresiva para la incubación (8h yogur / 12h kumis)
  const incubacionTimer = useStageCountdown({
    isRunning: Boolean(state.incubacion.iniciada && !state.incubacion.completada),
    isCompleted: Boolean(state.incubacion.completada),
    startTimestamp:
      state.incubacion.timestampInicio ||
      (state.incubacion.horaInicio
        ? timeStringToTimestampToday(state.incubacion.horaInicio)
        : null),
    targetMinutes: (state.incubacion.duracionObjetivoHoras || targetHoras) * 60,
    completedDurationText: state.incubacion.tiempoTranscurrido,
  });

  // Cálculo automático inquebrantable de la duración de adición y mezclado
  const tiempoMezcladoDisplay = useMemo(() => {
    if (state.tiempoMezcladoCalculado) {
      return state.tiempoMezcladoCalculado;
    }
    if (state.horaInoculacion) {
      const start = state.horaInicioMezclado || horaLlegadaTemp || state.horaInoculacion;
      return computeDurationBetweenTimes(start, state.horaInoculacion).human;
    }
    return formatHumanDuration(state.tiempoMezcladoMinutos * 60);
  }, [
    state.tiempoMezcladoCalculado,
    state.horaInoculacion,
    state.horaInicioMezclado,
    horaLlegadaTemp,
    state.tiempoMezcladoMinutos,
  ]);

  // PASO 1: Confirmación de Leche en Cantinas
  const handleConfirmLecheLista = () => {
    const nowTime = getCurrentTimeString();
    onChange((prev: any) => ({
      ...prev,
      temperaturaConfirmada: true,
      horaInicioMezclado: prev.horaInicioMezclado || nowTime,
    }));
    showToast('✓ Cantinas de leche verificadas y listas para la siembra.', 'success');
  };

  // PASO 2: Confirmación de Adición de Cultivo y Mezclado ("¡Agregué el cultivo y ya revolví!")
  const handleConfirmInoculacionYMezclado = () => {
    const timeStr = getCurrentTimeString();
    const now = Date.now();
    const start = state.horaInicioMezclado || horaLlegadaTemp || timeStr;
    const durCalculada = computeDurationBetweenTimes(start, timeStr).human;

    onChange((prev: any) => ({
      ...prev,
      temperaturaConfirmada: true,
      mezcladoConfirmado: true,
      inoculacionConfirmada: true,
      horaInoculacion: timeStr,
      horaInicioMezclado: start,
      tiempoMezcladoCalculado: durCalculada,
      incubacion: {
        ...prev.incubacion,
        iniciada: true,
        completada: false,
        horaInicio: prev.incubacion.horaInicio || timeStr,
        timestampInicio: prev.incubacion.timestampInicio || now,
        duracionObjetivoHoras: targetHoras,
      },
    }));

    showToast(
      `✓ Cultivo agregado y mezclado (${state.cantidadCultivoCucharadas ?? dosisCalculada} cucharadas · Lote ${state.loteCultivo || defaultCultureLote}) a las ${timeStr} (${durCalculada}). Incubación de ${targetHoras}h en marcha.`,
      'success'
    );
  };

  // PASO 2: Guardar Hora Manual con PopoverTimePicker
  const handleSaveManualMezclado = () => {
    const start = state.horaInicioMezclado || horaLlegadaTemp || horaManualMezclado;
    const durCalculada = computeDurationBetweenTimes(start, horaManualMezclado).human;

    onChange((prev: any) => ({
      ...prev,
      temperaturaConfirmada: true,
      mezcladoConfirmado: true,
      inoculacionConfirmada: true,
      horaInoculacion: horaManualMezclado,
      horaInicioMezclado: start,
      tiempoMezcladoCalculado: durCalculada,
      esManualMezclado: true,
      incubacion: {
        ...prev.incubacion,
        iniciada: true,
        horaInicio: prev.incubacion.horaInicio || horaManualMezclado,
      },
    }));

    showToast(
      `✓ Hora de adición y mezclado actualizada a ${horaManualMezclado}. Duración recalculada: ${durCalculada}.`,
      'success'
    );
  };

  // PASO 3: Guardar Horarios Manuales de Incubación
  const handleSaveManualIncubacionTimes = () => {
    const durStr = computeDurationBetweenTimes(
      horaManualIncubacionInicio,
      horaManualIncubacionFin
    ).human;
    const newTimestamp = timeStringToTimestampToday(horaManualIncubacionInicio);

    onChange((prev: any) => ({
      ...prev,
      esManualIncubacion: true,
      incubacion: {
        ...prev.incubacion,
        esManual: true,
        horaInicio: horaManualIncubacionInicio,
        timestampInicio: newTimestamp,
        horaFin: horaManualIncubacionFin,
        tiempoTranscurrido: durStr,
      },
    }));

    showToast(
      `✓ Horarios de incubación actualizados. Duración calculada: ${durStr}.`,
      'success'
    );
  };

  // PASO 4: Confirmación Maestra "¡Producto ingresado al cuarto frío!"
  const handleConfirmIngresoCuartoFrio = () => {
    const timeStr = esManualCuartoFrio
      ? formatTimeFromStep1(horaManualCuartoFrio)
      : getCurrentTimeString();
    const now = Date.now();
    const start = state.incubacion.timestampInicio || now;
    const elapsedSec = Math.max(1, Math.floor((now - start) / 1000));
    const durStr = formatHumanDuration(elapsedSec);

    onChange((prev: any) => ({
      ...prev,
      incubacion: {
        ...prev.incubacion,
        completada: true,
        productoEntroCuartoFrio: true,
        horaEntradaCuartoFrio: timeStr,
        horaFin: prev.incubacion.horaFin || timeStr,
        tiempoTranscurrido: prev.incubacion.tiempoTranscurrido || durStr,
      },
    }));

    setHoraManualCuartoFrio(timeStr);
    showToast(
      `✓ ¡Producto ingresado al cuarto frío a las ${timeStr}! Etapa completada, listo para avanzar a Batido y Sabores.`,
      'success'
    );
  };

  // PASO 4: Guardar Hora Manual de Ingreso a Cuarto Frío
  const handleSaveManualCuartoFrio = () => {
    const timeFmt = formatTimeFromStep1(horaManualCuartoFrio);
    onChange((prev: any) => ({
      ...prev,
      incubacion: {
        ...prev.incubacion,
        completada: true,
        productoEntroCuartoFrio: true,
        horaEntradaCuartoFrio: timeFmt,
        horaFin: prev.incubacion.horaFin || timeFmt,
      },
    }));
    setEsManualCuartoFrio(false);
    showToast(`✓ Hora de ingreso al cuarto frío actualizada a ${timeFmt}.`, 'success');
  };

  // Manejo de Partición (Lote Hijo Kumis o Griego)
  const parsedLitrosParticion = Number(litrosParticionInput);
  const maxLitrosParticion = maxLitrosDesviables(volumenTotalDisponible);
  const esParticionValida =
    litrosParticionInput !== '' &&
    parsedLitrosParticion > 0 &&
    parsedLitrosParticion <= maxLitrosParticion;

  const handleConfirmarParticion = () => {
    if (!esParticionValida) {
      setErrorParticion(
        `Ingresa una cantidad mayor a 0 y menor o igual a ${maxLitrosParticion} L.`
      );
      return;
    }

    if (!llevaAzucar || tipoParticion === 'griego') {
      if (onExtractGriego) {
        onExtractGriego(parsedLitrosParticion);
      }
    } else {
      if (onExtractKumis) {
        onExtractKumis(parsedLitrosParticion);
      }
    }

    setShowModalParticion(false);
    setLitrosParticionInput('');
    setErrorParticion(null);

    const restante = Math.max(0, volumenTotalDisponible - parsedLitrosParticion);
    showToast(
      restante === 0
        ? `✓ Partición del 100%: ${parsedLitrosParticion} L desviados para ${
            !llevaAzucar || tipoParticion === 'griego' ? 'Yogur Griego' : 'Kumis'
          }. El lote padre fue auto-completado (0 L remanentes).`
        : `✓ Partición confirmada: ${parsedLitrosParticion} L desviados para ${
            !llevaAzucar || tipoParticion === 'griego' ? 'Yogur Griego' : 'Kumis'
          }. El Yogur continuará con ${restante} L hacia Batido.`,
      'success'
    );
  };

  const isInoculado = Boolean(state.inoculacionConfirmada || state.mezcladoConfirmado);
  const isIncubando = Boolean(state.incubacion.iniciada && !state.incubacion.completada);
  const isIncubacionCompletada = Boolean(state.incubacion.completada);
  const isCuartoFrioConfirmado = Boolean(state.incubacion.productoEntroCuartoFrio);

  return (
    <div className="flex flex-col w-full p-4 lg:p-6 gap-5 bg-[#FFFFFF] min-h-[calc(100vh-4rem)] pb-14">
      {/* CABECERA ESTÁNDAR MAESTRA */}
      <StageHeader
        stageNumber={2}
        totalStages={isKumis ? 3 : 4}
        lineName={isYogur ? 'Línea de Fermentados · Yogur' : 'Línea de Fermentados · Kumis'}
        title={isYogur ? '2. Inoculación e Incubación (Yogur)' : '2. Inoculación e Incubación (Kumis)'}
        subtitle={
          isYogur
            ? 'Adición de cultivo láctico probiótico, mezclado uniforme, reposo en incubación por 8 horas y traslado final a cuarto frío.'
            : 'Adición de cultivo de Kumis, mezclado suave, reposo a temperatura ambiente por 12 horas y traslado a refrigeración.'
        }
        standardBadge="NTC-805"
        metrics={[
          {
            icon: 'water_drop',
            label: 'Leche del Lote',
            value: `${litrosLecheBase} L`,
            tone: 'default',
          },
          {
            icon: 'timer',
            label: `Incubación (${targetHoras} h)`,
            value: state.incubacion.iniciada
              ? incubacionTimer.formattedElapsed
              : `${targetHoras} Horas`,
            tone: isIncubacionCompletada ? 'emerald' : isIncubando ? 'amber' : 'default',
          },
          {
            icon: 'kitchen',
            label: 'Cuarto Frío',
            value: isCuartoFrioConfirmado ? 'Ingresado ✓' : 'Pendiente',
            tone: isCuartoFrioConfirmado ? 'emerald' : 'default',
          },
        ]}
      />

      {/* ========================================================================= */}
      {/* PASO 01: VERIFICACIÓN DE LA LECHE EN CANTINAS                             */}
      {/* ========================================================================= */}
      <Card
        stepBadge="Paso 01"
        title="Verificación de la Leche en Cantinas"
        subtitle={
          horaLlegadaTemp
            ? `La leche se transfirió y enfrió a las ${horaLlegadaTemp}. Verifica que las cantinas se encuentren listas en el área de siembra antes de inocular.`
            : 'Verifica que las cantinas con leche pasteurizada se encuentren listas y desinfectadas en el área de siembra para iniciar la inoculación.'
        }
        icon="inventory_2"
        tone={state.temperaturaConfirmada ? 'completed' : 'active'}
        statusBadge={
          state.temperaturaConfirmada
            ? { label: 'Leche Verificada ✓', variant: 'success' }
            : { label: 'Por verificar', variant: 'warning' }
        }
        headerAction={
          <ConfirmButton
            confirmed={state.temperaturaConfirmada}
            confirmedLabel="✓ Leche Lista en Cantinas"
            unconfirmedLabel="Confirmar Leche Lista para Siembra"
            onConfirm={handleConfirmLecheLista}
          />
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-3.5 bg-[#FFFFFF] rounded-xl border border-[#D6DEEA] flex flex-col justify-between">
            <span className="text-[11px] uppercase font-bold text-[#4A5263]">
              Estado de la Leche
            </span>
            <div className="text-base font-black text-emerald-800 mt-1 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[20px] text-emerald-600">
                check_circle
              </span>
              <span>Lista en cantinas para siembra</span>
            </div>
            <span className="text-[11px] text-[#6B7280] mt-1 block">
              {horaLlegadaTemp
                ? `Enfriada y lista desde las ${horaLlegadaTemp}`
                : 'Cantinas limpias y desinfectadas'}
            </span>
          </div>

          <div className="p-3.5 bg-[#FFFFFF] rounded-xl border border-[#D6DEEA] flex flex-col justify-between">
            <span className="text-[11px] uppercase font-bold text-[#4A5263]">
              Hora de Disponibilidad
            </span>
            <div className="text-xl font-black font-mono text-[#191C1E] mt-1">
              {horaLlegadaTemp || state.horaInicioMezclado || '--:--:--'}
            </div>
            <span className="text-[11px] text-[#6B7280] mt-1 block">
              Registrada al finalizar enfriamiento en Pasteurización
            </span>
          </div>

          <div className="p-3.5 bg-[#FFFFFF] rounded-xl border border-[#D6DEEA] flex flex-col justify-between">
            <span className="text-[11px] uppercase font-bold text-[#4A5263]">
              Leche del Lote / Dosis Sugerida
            </span>
            <div className="text-xl font-black font-mono text-[#191C1E] mt-1">
              {litrosLecheBase} L
            </div>
            <span className="text-[11px] text-amber-800 font-semibold mt-1 block">
              Dosis: {dosisCalculada} cucharadas (1 cda por cada 40 L)
            </span>
          </div>
        </div>
      </Card>

      {/* ========================================================================= */}
      {/* PASO 02: ADICIÓN DE CULTIVO Y MEZCLADO                                   */}
      {/* ========================================================================= */}
      <Card
        stepBadge="Paso 02"
        title="¡Agregué el cultivo y ya revolví!"
        subtitle={
          isYogur
            ? 'Adiciona el cultivo láctico probiótico y revuelve suavemente para repartirlo uniformemente. Al confirmar arranca la incubación de 8 horas.'
            : 'Adiciona el cultivo láctico de Kumis y revuelve suavemente para repartirlo parejo. Al confirmar arranca la incubación de 12 horas.'
        }
        icon="biotech"
        tone={isInoculado ? 'completed' : 'active'}
        statusBadge={
          isInoculado
            ? {
                label: `Sembrado (${state.horaInoculacion || '--:--'}) ✓`,
                variant: 'success',
              }
            : { label: 'Por sembrar', variant: 'info' }
        }
        headerAction={
          <div className="flex items-center gap-3">
            <ManualEditToggle manual={Boolean(esManualMezclado)} onChange={(checked: boolean) => {
                  setEsManualMezclado(checked);
                  onChange((p: any) => ({ ...p, esManualMezclado: checked }));
                }} />

            <ConfirmButton
              confirmed={isInoculado}
              confirmedLabel={`✓ ¡Agregué el cultivo y ya revolví! (${state.horaInoculacion || 'Listo'})`}
              unconfirmedLabel="¡Agregué el cultivo y ya revolví!"
              icon="biotech"
              onConfirm={handleConfirmInoculacionYMezclado}
            />
          </div>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Lote del Cultivo Láctico (Solo Lectura - Heredado de Pasteurización) */}
          <div className="p-3.5 bg-[#FFFFFF] rounded-xl border border-[#D6DEEA] flex flex-col justify-between">
            <span className="text-[11px] uppercase font-bold text-[#4A5263]">
              Lote del Cultivo Láctico
            </span>
            <div className="text-base font-black font-mono text-[#191C1E] mt-1 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[18px] text-amber-700">
                biotech
              </span>
              <span>{loteCultivoEfectivo}</span>
            </div>
            <span className="text-[11px] text-[#6B7280] mt-1 block">
              Solo lectura · Heredado de Pasteurización
            </span>
          </div>

          {/* Cucharadas de Cultivo */}
          <InputField
            label="Cucharadas de Cultivo"
            type="number"
            step="0.1"
            min="0.1"
            unit="cucharadas"
            placeholder={dosisCalculada > 0 ? `Ej: ${dosisCalculada}` : 'Ej: 2.5'}
            value={
              state.cantidadCultivoCucharadas !== undefined &&
              state.cantidadCultivoCucharadas !== 0
                ? state.cantidadCultivoCucharadas
                : dosisCalculada > 0
                ? dosisCalculada
                : ''
            }
            onChange={(e) => {
              const val = parseFloat(e.target.value) || 0;
              onChange((p: any) => ({
                ...p,
                cantidadCultivoCucharadas: val,
                cantidadCultivoGramos: val,
              }));
            }}
            hint={`Sugerencia exacta: 1 cda por cada 40 L (${litrosLecheBase} L → ${dosisCalculada} cucharadas)`}
          />

          {/* Hora de Adición / Mezclado */}
          {esManualMezclado ? (
            <div className="flex flex-col gap-1.5">
              <PopoverTimePicker
                label="Hora de Adición / Mezclado"
                icon="schedule"
                hint="Toca para desplegar selector flotante (hh:mm:ss a)"
                value={horaManualMezclado}
                onChange={setHoraManualMezclado}
              />
              <div className="flex justify-end">
                <Button
                  variant="secondary"
                  size="sm"
                  icon="save"
                  onClick={handleSaveManualMezclado}
                  className="w-full text-xs"
                >
                  Guardar Hora
                </Button>
              </div>
            </div>
          ) : (
            <div className="p-3.5 bg-[#FFFFFF] rounded-xl border border-[#D6DEEA] flex flex-col justify-between">
              <span className="text-[11px] uppercase font-bold text-[#4A5263]">
                Hora de Adición / Mezclado
              </span>
              <div className="text-xl font-black font-mono text-[#191C1E] mt-1">
                {state.horaInoculacion || '--:--'}
              </div>
              <span className="text-[11px] text-[#6B7280] mt-1 block">
                {state.horaInoculacion
                  ? 'Registrada al pulsar confirmación'
                  : 'Pendiente de registrar'}
              </span>
            </div>
          )}

          {/* Tiempo en Adicionar y Revolver (Cálculo Automático - SOLO LECTURA) */}
          <div className="p-3.5 bg-amber-50/50 rounded-xl border border-amber-200/70 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase font-bold text-amber-900">
                Tiempo en Adicionar y Revolver
              </span>
              <span className="material-symbols-outlined text-[16px] text-amber-700">
                lock
              </span>
            </div>
            <div className="text-xl font-black font-mono text-amber-950 mt-1">
              {tiempoMezcladoDisplay}
            </div>
            <span className="text-[11px] text-amber-800 font-semibold mt-1 block">
              Cálculo automático (Solo lectura)
            </span>
          </div>
        </div>
      </Card>

      {/* ========================================================================= */}
      {/* PASO 03: INCUBACIÓN (8 HORAS / 12 HORAS) - 100% REGISTRO DE TIEMPO        */}
      {/* ========================================================================= */}
      <Card
        stepBadge="Paso 03"
        title={
          isYogur
            ? 'Incubación (8 Horas)'
            : 'Incubación (12 Horas)'
        }
        subtitle={
          isYogur
            ? 'Reposo e incubación de la cuajada durante 8 horas continuas. Registro exclusivo de tiempo transcurrido (sin pH ni temperatura).'
            : 'Reposo e incubación de la cuajada durante 12 horas continuas a temperatura ambiente. Registro exclusivo de tiempo transcurrido.'
        }
        icon="hourglass_top"
        tone={isIncubacionCompletada ? 'completed' : isIncubando ? 'active' : 'default'}
        statusBadge={
          isIncubacionCompletada
            ? {
                label: `Incubación Lista (${state.incubacion.horaFin || '8h'}) ✓`,
                variant: 'success',
              }
            : isIncubando
            ? { label: `Incubando (${targetHoras} h)...`, variant: 'warning', pulse: true }
            : { label: 'Inicia al sembrar', variant: 'neutral' }
        }
        headerAction={
          <div className="flex items-center gap-3">
            <ManualEditToggle manual={Boolean(esManualIncubacion)} onChange={(checked: boolean) => {
                  setEsManualIncubacion(checked);
                  onChange((p: any) => ({
                    ...p,
                    esManualIncubacion: checked,
                    incubacion: { ...p.incubacion, esManual: checked },
                  }));
                }} />
          </div>
        }
      >
        {/* Banner del cronómetro de incubación */}
        <TimerBanner
          label={`Cronómetro de Incubación (${isYogur ? 'Yogur' : 'Kumis'})`}
          sublabel={`Meta estándar: ${targetHoras} horas continuas de incubación`}
          formattedTime={
            state.incubacion.iniciada
              ? incubacionTimer.formattedElapsed
              : `${targetHoras} Horas`
          }
          targetLabel={`${targetHoras} Horas`}
          progressPercent={incubacionTimer.progressPercent}
          isRunning={isIncubando}
          isCompleted={isIncubacionCompletada}
          isOvertime={incubacionTimer.isOvertime}
          className="mb-4"
        />

        {!esManualIncubacion ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* 1. Inicio de Incubación */}
            <div className="p-4 rounded-xl bg-white border border-[#D6DEEA] flex flex-col justify-between">
              <span className="text-[10px] uppercase font-bold text-gray-500 block">
                INICIO DE INCUBACIÓN
              </span>
              <span className="text-xl font-mono font-black text-gray-900 mt-1 block">
                {state.incubacion.horaInicio || '--:--:--'}
              </span>
              <span className="text-[11px] text-gray-500 mt-1 block">
                {state.incubacion.horaInicio
                  ? 'Registrado al sembrar el cultivo'
                  : 'Inicia al confirmar la siembra'}
              </span>
            </div>

            {/* 2. Tiempo Transcurrido (Solo Lectura - Cálculo Matemático / En Vivo) */}
            <div className="p-4 rounded-xl bg-amber-50/60 border border-amber-200/80 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold text-amber-900 block">
                  TIEMPO TRANSCURRIDO
                </span>
                <span className="material-symbols-outlined text-amber-700 text-base">timer</span>
              </div>
              <span className="text-xl font-mono font-black text-amber-950 mt-1 block">
                {state.incubacion.iniciada
                  ? state.incubacion.tiempoTranscurrido || incubacionTimer.formattedElapsed
                  : '00:00:00'}
              </span>
              <span className="text-[11px] text-amber-800 font-medium mt-1 block">
                {isIncubacionCompletada
                  ? 'Incubación completada'
                  : isIncubando
                  ? `Cronómetro en vivo (${targetHoras}h meta)`
                  : 'Pendiente de inicio'}
              </span>
            </div>

            {/* 3. Fin de Incubación */}
            <div className="p-4 rounded-xl bg-white border border-[#D6DEEA] flex flex-col justify-between">
              <span className="text-[10px] uppercase font-bold text-gray-500 block">
                FIN DE INCUBACIÓN
              </span>
              <span
                className={`text-xl font-mono font-black mt-1 block ${
                  isIncubacionCompletada ? 'text-emerald-800' : 'text-gray-400'
                }`}
              >
                {state.incubacion.horaFin || (isIncubando ? 'En proceso...' : '--:--:--')}
              </span>
              <span className="text-[11px] text-gray-500 mt-1 block">
                {isIncubacionCompletada
                  ? 'Completado ✓'
                  : `Meta reglamentaria: ${targetHoras} horas continuas`}
              </span>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* 1. Inicio Manual */}
            <div className="flex flex-col gap-1.5">
              <PopoverTimePicker
                label="Hora Inicio de Incubación"
                icon="schedule"
                hint="Toca para desplegar selector flotante (hh:mm:ss a)"
                value={horaManualIncubacionInicio}
                onChange={setHoraManualIncubacionInicio}
              />
            </div>

            {/* 2. Duración Matemática Calculada (Solo Lectura) */}
            <div className="p-4 rounded-xl bg-amber-50/60 border border-amber-200/80 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold text-amber-900 block">
                  DURACIÓN DE INCUBACIÓN
                </span>
                <span className="material-symbols-outlined text-amber-700 text-base">functions</span>
              </div>
              <span className="text-xl font-mono font-black text-amber-950 mt-1 block">
                {computeDurationBetweenTimes(horaManualIncubacionInicio, horaManualIncubacionFin).human}
              </span>
              <span className="text-[11px] text-amber-800 font-medium mt-1 block">
                Cálculo matemático automático (Solo lectura)
              </span>
            </div>

            {/* 3. Fin de Incubación Manual con Botón de Guardado */}
            <div className="flex flex-col gap-1.5 justify-between">
              <PopoverTimePicker
                label="Hora Fin de Incubación"
                icon="schedule"
                hint="Toca para desplegar selector flotante (hh:mm:ss a)"
                value={horaManualIncubacionFin}
                onChange={setHoraManualIncubacionFin}
              />
              <Button
                variant="secondary"
                size="sm"
                icon="save"
                onClick={handleSaveManualIncubacionTimes}
                className="w-full text-xs font-semibold mt-1"
              >
                Guardar Horarios de Incubación
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* ========================================================================= */}
      {/* PASO 04: METER PRODUCTO A CUARTO FRÍO (NUEVO PASO Y PUNTO DE PARTICIÓN)   */}
      {/* ========================================================================= */}
      <Card
        stepBadge="Paso 04"
        title="Meter producto a cuarto frío"
        subtitle="Traslada las cantinas con cuajada al cuarto frío para detener la fermentación, estabilizar la consistencia y enfriar el producto antes del batido."
        icon="kitchen"
        tone={isCuartoFrioConfirmado ? 'completed' : 'active'}
        statusBadge={
          isCuartoFrioConfirmado
            ? {
                label: `En Cuarto Frío (${state.incubacion.horaEntradaCuartoFrio || '--:--'}) ✓`,
                variant: 'success',
              }
            : { label: 'Pendiente de Ingreso', variant: 'warning' }
        }
        headerAction={
          <div className="flex items-center gap-3">
            <ManualEditToggle manual={Boolean(esManualCuartoFrio)} onChange={(checked: boolean) => setEsManualCuartoFrio(checked)} />

            {/* BOTÓN MAESTRO: ¡Producto ingresado al cuarto frío! */}
            <Button
              variant={isCuartoFrioConfirmado ? 'secondary' : 'primary'}
              size="md"
              icon={isCuartoFrioConfirmado ? 'check_circle' : 'kitchen'}
              onClick={handleConfirmIngresoCuartoFrio}
              className={
                isCuartoFrioConfirmado
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100 font-bold'
                  : 'font-bold shadow-sm'
              }
            >
              {isCuartoFrioConfirmado
                ? `✓ ¡Producto ingresado al cuarto frío! (${state.incubacion.horaEntradaCuartoFrio || 'Listo'})`
                : '¡Producto ingresado al cuarto frío!'}
            </Button>
          </div>
        }
      >
        {/* Contenido principal del Paso 04 */}
        {!esManualCuartoFrio ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <div className="p-4 rounded-xl bg-white border border-[#D6DEEA] flex flex-col justify-between">
              <span className="text-[10px] uppercase font-bold text-gray-500 block">
                HORA ENTRADA A CUARTO FRÍO
              </span>
              <span
                className={`text-xl font-mono font-black mt-1 block ${
                  isCuartoFrioConfirmado ? 'text-emerald-800' : 'text-gray-400'
                }`}
              >
                {state.incubacion.horaEntradaCuartoFrio || '--:--:--'}
              </span>
              <span className="text-[11px] text-gray-500 mt-1 block">
                {isCuartoFrioConfirmado
                  ? 'Hora confirmada de ingreso a frío'
                  : 'Pulsa el botón superior al meter las cantinas'}
              </span>
            </div>

            <div className="p-4 rounded-xl bg-white border border-[#D6DEEA] flex flex-col justify-between">
              <span className="text-[10px] uppercase font-bold text-gray-500 block">
                VOLUMEN EN REFRIGERACIÓN
              </span>
              <span className="text-xl font-mono font-black text-blue-950 mt-1 block">
                {litrosLecheBase} Litros
              </span>
              <span className="text-[11px] text-gray-500 mt-1 block">
                Volumen actual de cuajada disponible
              </span>
            </div>

            <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200 flex flex-col justify-between">
              <span className="text-[10px] uppercase font-bold text-emerald-900 block">
                ESTADO DE LA CUAJADA
              </span>
              <span className="text-base font-bold text-emerald-950 mt-1 block">
                {isCuartoFrioConfirmado
                  ? 'Enfriamiento activo en cuarto frío'
                  : 'Pendiente de ingresar a refrigeración'}
              </span>
              <span className="text-[11px] text-emerald-700 mt-1 block">
                {isCuartoFrioConfirmado
                  ? 'Gel listo para batido o partición'
                  : 'Esperando confirmación'}
              </span>
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-amber-50/90 border-2 border-amber-300 flex flex-col gap-3 mb-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
              <PopoverTimePicker
                label="Hora Entrada a Cuarto Frío"
                icon="schedule"
                hint="Toca para desplegar selector flotante (hh:mm:ss a)"
                value={horaManualCuartoFrio}
                onChange={setHoraManualCuartoFrio}
              />
              <div className="flex flex-col justify-end h-full">
                <Button
                  variant="primary"
                  size="md"
                  icon="save"
                  onClick={handleSaveManualCuartoFrio}
                  className="font-bold"
                >
                  Guardar Hora de Ingreso a Cuarto Frío
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* PUNTO DE PARTICIÓN (solo Yogur SIN azúcar, tras confirmar cuarto frío):   */}
        {/* se desvía una parte de esta misma leche para Yogur Griego. Una sola vez.  */}
        {/* ========================================================================= */}
        {isYogur && !llevaAzucar && isCuartoFrioConfirmado && (
          <div className="p-4 sm:p-5 rounded-2xl bg-[#F7F9FC] border-2 border-[#D6DEEA] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mt-2">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[#1B4E9B] text-white flex items-center justify-center shrink-0 shadow-sm">
                <span className="material-symbols-outlined text-[24px]">call_split</span>
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="text-sm font-black text-gray-900">
                    Punto de Partición: ¿Sacar Yogur Griego de este lote?
                  </h4>
                  {extraccionGriegoRealizada && (
                    <Badge variant="success">Partición realizada</Badge>
                  )}
                </div>
                <p className="text-xs text-gray-600 mt-0.5">
                  {extraccionGriegoRealizada
                    ? `Se desviaron ${litrosExtraidosPrevios || 0} L a Yogur Griego. El Griego hereda todo lo registrado hasta aquí; el Yogur continúa con ${litrosLecheBase} L hacia Batido.`
                    : 'Puedes desviar una parte de esta cuajada sin azúcar para Yogur Griego (escurrido en telas). El Griego hereda pasteurización e incubación de este lote; el Yogur restante sigue hacia Batido. Solo se puede hacer una vez.'}
                </p>
              </div>
            </div>

            {!extraccionGriegoRealizada && onExtractGriego && (
              <Button
                variant="secondary"
                size="md"
                icon="call_split"
                onClick={() => {
                  setTipoParticion('griego');
                  setLitrosParticionInput('');
                  setErrorParticion(null);
                  setShowModalParticion(true);
                }}
                className="bg-white hover:bg-[#EEF3FA] text-[#1B4E9B] border-[#1B4E9B] font-bold shadow-2xs shrink-0 cursor-pointer"
              >
                Sacar Yogur Griego
              </Button>
            )}
          </div>
        )}
      </Card>

      {/* ========================================================================= */}
      {/* TARJETA INFERIOR: ACCIÓN DE CIERRE Y TRANSICIÓN A BATIDO Y SABORES         */}
      {/* ========================================================================= */}
      <div className="p-4 sm:p-5 rounded-2xl bg-white border border-[#D6DEEA] shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              isCuartoFrioConfirmado
                ? 'bg-emerald-100 text-emerald-900'
                : 'bg-amber-100 text-amber-900'
            }`}
          >
            <span className="material-symbols-outlined text-[24px]">
              {isKumis ? 'inventory_2' : 'blender'}
            </span>
          </div>
          <div className="text-xs sm:text-sm text-[#434655]">
            <p className="font-bold text-[#191C1E]">
              {isCuartoFrioConfirmado
                ? '✓ Cuarto Frío Confirmado: Listo para la siguiente etapa'
                : 'Paso pendiente: Confirmar ingreso a cuarto frío'}
            </p>
            <p>
              {isCuartoFrioConfirmado
                ? `El producto está refrigerado. Pulsa a la derecha para avanzar inmediatamente a `
                : `Confirma el Paso 04 ("¡Producto ingresado al cuarto frío!") para habilitar `}
              <strong className="text-emerald-900 font-semibold">
                {isKumis ? '3. Envasar y Guardar' : '3. Batido'}
              </strong>
              .
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          {isCuartoFrioConfirmado ? (
            <Button
              variant="primary"
              size="lg"
              icon={isKumis ? 'inventory_2' : 'blender'}
              iconRight="arrow_forward"
              onClick={onGoToBatidoYSabores}
              className="w-full sm:w-auto font-bold shadow-md bg-[#5FAF32] hover:bg-[#4E9628] text-white"
            >
              {isKumis ? 'Avanzar a 3. Envasar y Guardar' : 'Avanzar a 3. Batido'}
            </Button>
          ) : (
            <Button
              variant="primary"
              size="lg"
              icon="kitchen"
              onClick={handleConfirmIngresoCuartoFrio}
              className="w-full sm:w-auto font-bold shadow-md"
            >
              Confirmar Ingreso a Cuarto Frío
            </Button>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL DE PARTICIÓN: DESVIAR BASE A KUMIS O YOGUR GRIEGO                   */}
      {/* ========================================================================= */}
      {showModalParticion && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-[#D6DEEA] flex flex-col gap-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-[#D6DEEA]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#1B4E9B] text-white flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[24px]">call_split</span>
                </div>
                <div>
                  <h3 className="text-base font-black text-gray-900">
                    {llevaAzucar
                      ? 'Partición de Lote: Base para Kumis'
                      : 'Partición de Lote: Base para Yogur Griego'}
                  </h3>
                  <p className="text-xs text-gray-500">
                    {llevaAzucar
                      ? 'Desvío de cuajada con azúcar para proceso y envasado de Kumis'
                      : 'Desvío de cuajada sin azúcar para filtrado y escurrido en telas'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowModalParticion(false)}
                className="text-gray-400 hover:text-gray-700 text-xl font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Selector de Producto Destino Condicional */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-700 block">
                Línea de Destino de la Partición
              </label>
              {llevaAzucar ? (
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setTipoParticion('kumis')}
                    className={`p-3 rounded-2xl border-2 text-left transition-all cursor-pointer ${
                      tipoParticion === 'kumis'
                        ? 'border-[#1B4E9B] bg-blue-50/70 shadow-sm'
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-black text-gray-900">
                        Kumis Tradicional
                      </span>
                      <span className="material-symbols-outlined text-amber-700 text-[18px]">
                        local_drink
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-600">
                      Lote dulce con adición de azúcar tradicional.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTipoParticion('griego')}
                    className={`p-3 rounded-2xl border-2 text-left transition-all cursor-pointer ${
                      tipoParticion === 'griego'
                        ? 'border-[#1B4E9B] bg-blue-50/70 shadow-sm'
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-black text-gray-900">
                        Yogur Griego
                      </span>
                      <span className="material-symbols-outlined text-blue-700 text-[18px]">
                        filter_alt
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-600">
                      Pasa a escurrido en telas (~48h) en frío.
                    </p>
                  </button>
                </div>
              ) : (
                <div className="p-3.5 rounded-2xl bg-blue-50/70 border-2 border-[#1B4E9B] flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-[#1B4E9B] text-white flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-[20px]">filter_alt</span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-blue-950">
                          Yogur Griego Concentrado
                        </span>
                        <Badge variant="success">Línea Sin Azúcar</Badge>
                      </div>
                      <p className="text-[11px] text-blue-900/80">
                        Derivación exclusiva a filtrado en telas. Opción de Kumis deshabilitada por tratarse de un lote sin azúcar tradicional.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Input de Litros a Desviar */}
            <div className="space-y-3">
              <div className="p-3.5 rounded-2xl bg-blue-50/70 border border-blue-200 text-xs text-blue-900 flex items-center justify-between">
                <span>Volumen disponible en este punto:</span>
                <span className="font-mono font-black text-sm text-blue-950">
                  {volumenTotalDisponible} Litros
                </span>
              </div>

              <InputField
                label={
                  !llevaAzucar || tipoParticion === 'griego'
                    ? '¿CUÁNTOS LITROS SE VAN A DESVIAR PARA YOGUR GRIEGO?'
                    : '¿CUÁNTOS LITROS SE VAN A DESVIAR PARA KUMIS?'
                }
                type="number"
                min="1"
                max={maxLitrosParticion}
                unit="Litros"
                icon="water_drop"
                placeholder="Ej: 100"
                showZero={false}
                value={litrosParticionInput}
                onChange={(e) => {
                  const rawVal = e.target.value;
                  setLitrosParticionInput(rawVal);
                  const num = Number(rawVal);
                  if (rawVal !== '' && num <= 0) {
                    setErrorParticion('La cantidad debe ser mayor a 0 litros.');
                  } else if (num > maxLitrosParticion) {
                    setErrorParticion(
                      PERMITIR_DESVIO_TOTAL
                        ? `Los litros desviados no pueden superar el volumen disponible (${volumenTotalDisponible} L).`
                        : `El Yogur debe conservar leche: máximo ${maxLitrosParticion} L para desviar.`
                    );
                  } else {
                    setErrorParticion(null);
                  }
                }}
              />

              {errorParticion && (
                <p className="text-xs font-bold text-red-600 mt-1 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[16px]">error</span>
                  {errorParticion}
                </p>
              )}
            </div>

            {/* Vista Previa del Balance */}
            {parsedLitrosParticion > 0 && parsedLitrosParticion <= maxLitrosParticion && (
              <div className="p-4 rounded-2xl bg-[#F7F9FC] border border-[#D6DEEA] flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-gray-500">
                    Balance Matemático del Lote
                  </span>
                  {parsedLitrosParticion === volumenTotalDisponible && (
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
                      {volumenTotalDisponible - parsedLitrosParticion} L
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white border border-[#D6DEEA]">
                    <span className="text-[10px] font-bold text-gray-500 block uppercase">
                      {!llevaAzucar || tipoParticion === 'griego'
                        ? 'Lote Hijo Griego'
                        : 'Lote Hijo Kumis'}
                    </span>
                    <span className="text-base font-black font-mono text-indigo-950">
                      {parsedLitrosParticion} L
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Botones de Acción */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                variant="secondary"
                size="md"
                onClick={() => setShowModalParticion(false)}
              >
                Cancelar
              </Button>
              <Button
                variant="primary"
                size="md"
                icon="check_circle"
                onClick={handleConfirmarParticion}
                disabled={!esParticionValida}
                className="bg-[#1B4E9B] text-white hover:bg-[#003da6] font-bold shadow-md cursor-pointer disabled:opacity-50"
              >
                Confirmar Partición
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
