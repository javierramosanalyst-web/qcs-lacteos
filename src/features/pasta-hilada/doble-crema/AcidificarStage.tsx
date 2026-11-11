import React, { useEffect, useState } from 'react';
import { ManualEditToggle } from '../../../components/ui/ManualEditToggle';
import { useStageCountdown } from '../../../hooks';
import {
  AcidificarState,
  LotesLeche,
  LOTES_CULTIVO_LACTEO_DEFAULT,
  LOTES_LECHE_PROVEEDOR_DEFAULT,
  ProcessTimerState,
} from '../../../types';
import {
  formatHumanDuration,
  getCurrentTimeString,
  toTimeInputStep1,
  formatTimeFromStep1,
  computeDurationBetweenTimes,
} from '../../../utils/timer';
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
import {
  LOTES_SAL_CATALOG,
  LOTES_CUAJO_PERA_DEFAULT as LOTES_CUAJO_CATALOG,
  LOTES_ACIDO_ACETICO_CATALOG,
  useInsumoLotesVersion,
} from '../../../data/insumoLotes';

export interface AcidificarStageProps {
  state: AcidificarState;
  onChange: (updater: (prev: AcidificarState) => AcidificarState) => void;
  processTimer: ProcessTimerState;
  onStartProcessTimer: () => void;
  lotesLeche: LotesLeche;
  onUpdateLotesLeche: (updater: (prev: LotesLeche) => LotesLeche) => void;
  loteCuajo?: string;
  onUpdateLoteCuajo?: (val: string) => void;
  loteSal?: string;
  onUpdateLoteSal?: (val: string) => void;
  responsableProceso?: string;
  variant?: 'premium' | 'industrial';
  onNextStage: () => void;
  onOpenReviewModal: () => void;
  showToast: (msg: string, type?: 'success' | 'info' | 'warning') => void;
}

export const AcidificarStage: React.FC<AcidificarStageProps> = ({
  state,
  onChange,
  processTimer,
  onStartProcessTimer,
  lotesLeche,
  onUpdateLotesLeche,
  loteCuajo = '',
  onUpdateLoteCuajo,
  loteSal = '',
  onUpdateLoteSal,
  responsableProceso = '',
  variant = 'premium',
  onNextStage,
  showToast,
}) => {
  // Suscripción reactiva para sincronizar al instante lotes cargados de la BD
  useInsumoLotesVersion();

  const isIndustrial = variant === 'industrial';

  const cultivoLacteoGramos =
    state.insumos.cultivoLacteoGramos ?? lotesLeche.cultivoLacteoGramos ?? 0;
  const loteCultivoLacteo =
    lotesLeche.loteCultivoLacteo ||
    state.insumos.loteCultivoLacteo ||
    '';

  const totalLeche = isIndustrial
    ? state.insumos.lecheFresca || 0
    : (state.insumos.lecheFresca || 0) + (state.insumos.lecheAcida || 0);

  // Fórmula de cuajo: 1.2 g de cuajo por cada 100 L de mezcla
  const cuajoSugeridoGramos = Number(((totalLeche * 1.2) / 100).toFixed(2));

  // Lotes normalizados con preservación estricta de valores cargados de BD
  const selectedLoteSal = loteSal || '';
  const optionsSal =
    selectedLoteSal && !LOTES_SAL_CATALOG.includes(selectedLoteSal)
      ? [selectedLoteSal, ...LOTES_SAL_CATALOG]
      : LOTES_SAL_CATALOG;

  const initialLoteCuajo = state.phase2?.loteCuajo || loteCuajo || '';
  const [loteCuajoSelect, setLoteCuajoSelect] = useState<string>(initialLoteCuajo);

  useEffect(() => {
    const current = state.phase2?.loteCuajo || loteCuajo || '';
    if (current && current !== loteCuajoSelect) {
      setLoteCuajoSelect(current);
    }
  }, [state.phase2?.loteCuajo, loteCuajo]);

  const optionsCuajo =
    loteCuajoSelect && !LOTES_CUAJO_CATALOG.includes(loteCuajoSelect)
      ? [loteCuajoSelect, ...LOTES_CUAJO_CATALOG]
      : LOTES_CUAJO_CATALOG;

  // Lotes de leche y ácido acético con preservación de valores de BD
  const loteLecheAcidaSel = lotesLeche.loteLecheBase || lotesLeche.loteLeche1 || '';
  const optionsLecheAcida =
    loteLecheAcidaSel && !LOTES_LECHE_PROVEEDOR_DEFAULT.includes(loteLecheAcidaSel)
      ? [loteLecheAcidaSel, ...LOTES_LECHE_PROVEEDOR_DEFAULT]
      : LOTES_LECHE_PROVEEDOR_DEFAULT;

  const loteLecheFrescaSel = lotesLeche.loteLecheFresca || lotesLeche.loteLeche2 || '';
  const optionsLecheFresca =
    loteLecheFrescaSel && !LOTES_LECHE_PROVEEDOR_DEFAULT.includes(loteLecheFrescaSel)
      ? [loteLecheFrescaSel, ...LOTES_LECHE_PROVEEDOR_DEFAULT]
      : LOTES_LECHE_PROVEEDOR_DEFAULT;

  const optionsAcidoAcetico =
    loteCultivoLacteo && !LOTES_ACIDO_ACETICO_CATALOG.includes(loteCultivoLacteo)
      ? [loteCultivoLacteo, ...LOTES_ACIDO_ACETICO_CATALOG]
      : LOTES_ACIDO_ACETICO_CATALOG;

  // Cantidad de cuajo editable (sin 0 predefinido)
  const [cantidadCuajoInput, setCantidadCuajoInput] = useState<number>(
    state.phase2?.cuajoAdicionado ? state.phase2?.cantidadCuajoGramos || 0 : 0
  );

  useEffect(() => {
    if (state.phase2?.cuajoAdicionado && state.phase2?.cantidadCuajoGramos) {
      setCantidadCuajoInput(state.phase2.cantidadCuajoGramos);
    }
  }, [state.phase2?.cuajoAdicionado, state.phase2?.cantidadCuajoGramos]);

  // =========================================================================
  // MODO DE EDICIÓN SEGURA · PREPARACIÓN DE TINA (Bloqueo tras iniciar calentamiento)
  // =========================================================================
  const isHeatingStarted = Boolean(state.inicioCalentamiento?.iniciado);
  const [editModeInsumos, setEditModeInsumos] = useState<boolean>(false);

  // =========================================================================
  // MODO DE EDICIÓN SEGURA · PASO 1 (Bloqueo de variables críticas)
  // =========================================================================
  const [editModePaso1, setEditModePaso1] = useState<boolean>(false);
  const [draftTempPaso1, setDraftTempPaso1] = useState<number>(
    state.phase1.temperaturaAlcanzada || 35.0
  );
  const [draftHoraPaso1, setDraftHoraPaso1] = useState<string>(
    state.phase1.horaAlcanzo35 || getCurrentTimeString()
  );

  const horaInicioCalentamiento =
    state.inicioCalentamiento?.horaInicio || processTimer.startTime || '';

  // Duración recalculada físicamente restando Hora alcanzada de Hora de inicio
  const duracionCalentamientoRecalculada = React.useMemo(() => {
    if (!draftHoraPaso1) {
      return {
        human: state.phase1.tiempoCalentamiento || '0 s',
        seconds: state.phase1.segundosCalentamiento || 0,
      };
    }

    if (horaInicioCalentamiento) {
      return computeDurationBetweenTimes(
        horaInicioCalentamiento,
        draftHoraPaso1
      );
    }

    return {
      human: state.phase1.tiempoCalentamiento || '0 s',
      seconds: state.phase1.segundosCalentamiento || 0,
    };
  }, [
    horaInicioCalentamiento,
    draftHoraPaso1,
    state.phase1.tiempoCalentamiento,
    state.phase1.segundosCalentamiento,
  ]);

  useEffect(() => {
    if (!editModePaso1) {
      setDraftTempPaso1(state.phase1.temperaturaAlcanzada || 35.0);
      setDraftHoraPaso1(state.phase1.horaAlcanzo35 || getCurrentTimeString());
    }
  }, [
    editModePaso1,
    state.phase1.temperaturaAlcanzada,
    state.phase1.horaAlcanzo35,
  ]);

  // =========================================================================
  // MODO DE EDICIÓN SEGURA · PASO 2 (Bloqueo de hora de cuajo)
  // =========================================================================
  const [editModePaso2, setEditModePaso2] = useState<boolean>(false);
  const [draftHoraCuajo, setDraftHoraCuajo] = useState<string>(
    state.phase2?.horaAdicionCuajo || getCurrentTimeString()
  );

  useEffect(() => {
    if (!editModePaso2) {
      setDraftHoraCuajo(
        state.phase2?.horaAdicionCuajo || getCurrentTimeString()
      );
    }
  }, [editModePaso2, state.phase2?.horaAdicionCuajo]);

  // Cronómetro de calentamiento hasta 35 °C
  const isCalentandoRunning = Boolean(
    state.inicioCalentamiento?.iniciado && !state.phase1.alcanzo35
  );
  const isCalentandoCompleted = Boolean(state.phase1.alcanzo35);

  const timerCalentamiento = useStageCountdown({
    startTimestamp: state.inicioCalentamiento?.timestampInicio,
    startTime: state.inicioCalentamiento?.horaInicio,
    endTime: state.phase1.horaAlcanzo35,
    isRunning: isCalentandoRunning,
    isCompleted: isCalentandoCompleted,
    completedDurationText: state.phase1.tiempoCalentamiento,
    targetMinutes: 20,
    maxSeconds: 40 * 60,
  });

  const handleStartHeating = (): boolean => {
    const faltantes: string[] = [];
    if (isIndustrial) {
      if (!loteLecheFrescaSel) faltantes.push('lote de leche en tina');
      if (!state.insumos.lecheFresca || state.insumos.lecheFresca <= 0) {
        faltantes.push('litros de leche en tina');
      }
      if (!loteCultivoLacteo) faltantes.push('lote del ácido acético');
      if (!cultivoLacteoGramos || cultivoLacteoGramos <= 0) {
        faltantes.push('cantidad agregada de ácido acético (ml)');
      }
    } else {
      if (!loteLecheAcidaSel) faltantes.push('lote de leche ácida');
      if (!state.insumos.lecheAcida || state.insumos.lecheAcida <= 0) {
        faltantes.push('litros de leche ácida');
      }
      if (!loteLecheFrescaSel) faltantes.push('lote de leche fresca');
      if (!state.insumos.lecheFresca || state.insumos.lecheFresca <= 0) {
        faltantes.push('litros de leche fresca');
      }
    }
    if (!state.insumos.phMezcla || state.insumos.phMezcla <= 0) {
      faltantes.push(isIndustrial ? 'pH medido en tina (Objetivo 5.7)' : 'pH medido de la mezcla (Objetivo 5.7)');
    }
    if (!selectedLoteSal) faltantes.push('lote de sal');
    if (faltantes.length > 0) {
      showToast(`Ingresa o selecciona primero: ${faltantes.join(', ')}.`, 'warning');
      return false;
    }
    const now = Date.now();
    const timeStr = getCurrentTimeString();
    onChange((prev) => ({
      ...prev,
      inicioCalentamiento: {
        iniciado: true,
        horaInicio: timeStr,
        timestampInicio: now,
      },
    }));
    onStartProcessTimer();
    return true;
  };

  const handleSaveInsumos = () => {
    const faltantes: string[] = [];
    if (isIndustrial) {
      if (!loteLecheFrescaSel) faltantes.push('lote de leche en tina');
      if (!state.insumos.lecheFresca || state.insumos.lecheFresca <= 0) {
        faltantes.push('litros de leche en tina');
      }
      if (!loteCultivoLacteo) faltantes.push('lote del ácido acético');
      if (!cultivoLacteoGramos || cultivoLacteoGramos <= 0) {
        faltantes.push('cantidad agregada de ácido acético (ml)');
      }
    } else {
      if (!loteLecheAcidaSel) faltantes.push('lote de leche ácida');
      if (!state.insumos.lecheAcida || state.insumos.lecheAcida <= 0) {
        faltantes.push('litros de leche ácida');
      }
      if (!loteLecheFrescaSel) faltantes.push('lote de leche fresca');
      if (!state.insumos.lecheFresca || state.insumos.lecheFresca <= 0) {
        faltantes.push('litros de leche fresca');
      }
    }
    if (!state.insumos.phMezcla || state.insumos.phMezcla <= 0) {
      faltantes.push(isIndustrial ? 'pH medido en tina' : 'pH medido de la mezcla');
    }
    if (!selectedLoteSal) faltantes.push('lote de sal');

    if (faltantes.length > 0) {
      showToast(`Debes completar los datos requeridos: ${faltantes.join(', ')}.`, 'warning');
      return;
    }

    setEditModeInsumos(false);
    showToast('✓ Cambios en la preparación de la tina guardados correctamente.', 'success');
  };

  const handleReach35 = () => {
    if (!state.inicioCalentamiento?.iniciado) {
      showToast('Debes presionar "Empezar a Calentar la Mezcla" antes de confirmar que llegó a 35 °C.', 'warning');
      return;
    }

    const nowTs = Date.now();
    const nowTimeStr = getCurrentTimeString();

    const startTs = state.inicioCalentamiento.timestampInicio || nowTs;
    const elapsedSec = Math.max(1, Math.floor((nowTs - startTs) / 1000));
    const humanDuration = formatHumanDuration(elapsedSec);

    onChange((prev) => ({
      ...prev,
      phase1: {
        ...prev.phase1,
        alcanzo35: true,
        horaAlcanzo35: nowTimeStr,
        timestampAlcanzo35: nowTs,
        tiempoCalentamiento: humanDuration,
        segundosCalentamiento: elapsedSec,
        temperaturaAlcanzada: prev.phase1.temperaturaAlcanzada || 35.0,
        duration: Math.round(elapsedSec / 60) || 1,
        saved: true,
      },
    }));

    setEditModePaso1(false);
    showToast(
      `✓ La mezcla alcanzó los 35 °C a las ${nowTimeStr} (${humanDuration}).`,
      'success'
    );
  };

  const handleSaveManualPaso1 = () => {
    if (!state.inicioCalentamiento?.iniciado) {
      showToast('Debes iniciar el calentamiento antes de guardar cambios manuales en el Paso 1.', 'warning');
      return;
    }
    const formattedHora = formatTimeFromStep1(draftHoraPaso1);
    const finalTemp = draftTempPaso1 > 0 ? draftTempPaso1 : 35.0;

    // Recálculo automático estricto: Duración = Momento alcanzado - Hora de inicio
    let recalculoHuman = state.phase1.tiempoCalentamiento || '0 s';
    let recalculoSec = state.phase1.segundosCalentamiento || 0;

    if (horaInicioCalentamiento) {
      const diff = computeDurationBetweenTimes(
        horaInicioCalentamiento,
        formattedHora
      );
      recalculoHuman = diff.human;
      recalculoSec = diff.seconds;
    }

    onChange((prev) => ({
      ...prev,
      phase1: {
        ...prev.phase1,
        alcanzo35: true,
        temperaturaAlcanzada: finalTemp,
        tiempoCalentamiento: recalculoHuman,
        segundosCalentamiento: recalculoSec,
        duration: Math.round(recalculoSec / 60) || 1,
        horaAlcanzo35: formattedHora,
        temperaturaManual: true,
        saved: true,
      },
    }));

    setEditModePaso1(false);
    showToast(
      `✓ Cambios guardados en Paso 1 (${finalTemp} °C · ${recalculoHuman} · ${formattedHora}).`,
      'success'
    );
  };

  const handleRecordAdicionCuajo = () => {
    if (!state.phase1.alcanzo35) {
      showToast('La mezcla debe alcanzar los 35 °C antes de agregar el cuajo.', 'warning');
      return;
    }

    const nowTs = Date.now();
    const nowTimeStr = getCurrentTimeString();

    const ts35 =
      state.phase1.timestampAlcanzo35 ||
      state.inicioCalentamiento?.timestampInicio ||
      nowTs;
    const elapsedFrom35Sec = Math.max(0, Math.floor((nowTs - ts35) / 1000));
    const humanDurationFrom35 = formatHumanDuration(elapsedFrom35Sec);

    const startTs = state.inicioCalentamiento?.timestampInicio || ts35;
    const totalElapsedSec = Math.max(1, Math.floor((nowTs - startTs) / 1000));
    const humanTotalDuration = formatHumanDuration(totalElapsedSec);

    if (!isIndustrial) {
      if (!state.insumos.lecheAcida || state.insumos.lecheAcida <= 0 || !state.insumos.lecheFresca || state.insumos.lecheFresca <= 0) {
        showToast('Ingresa primero los litros de leche ácida y leche fresca de la mezcla.', 'warning');
        return;
      }
    } else {
      if (!state.insumos.lecheFresca || state.insumos.lecheFresca <= 0) {
        showToast('Ingresa primero los litros de leche en tina.', 'warning');
        return;
      }
      if (!cultivoLacteoGramos || cultivoLacteoGramos <= 0) {
        showToast('Ingresa primero la cantidad de ácido acético agregada a la tina.', 'warning');
        return;
      }
    }

    const finalCantidad =
      Number(cantidadCuajoInput) > 0
        ? Number(cantidadCuajoInput)
        : cuajoSugeridoGramos;
    const finalLote = loteCuajoSelect;
    if (!finalLote) {
      showToast('Selecciona el lote de cuajo antes de registrar la adición.', 'warning');
      return;
    }

    setCantidadCuajoInput(finalCantidad);

    onChange((prev) => ({
      ...prev,
      phase2: {
        ...prev.phase2,
        cuajoAdicionado: true,
        horaAdicionCuajo: nowTimeStr,
        timestampAdicionCuajo: nowTs,
        tiempoDesde35: humanDurationFrom35,
        tiempoTotalHastaCuajo: humanTotalDuration,
        cantidadCuajo: `${finalCantidad} g`,
        cantidadCuajoGramos: finalCantidad,
        tipoCuajo:
          prev.phase2?.tipoCuajo || 'Coagulante microbiano / Cuajo líquido',
        loteCuajo: finalLote,
        esCuajoManual: false,
        saved: true,
      },
    }));

    if (onUpdateLoteCuajo) {
      onUpdateLoteCuajo(finalLote);
    }

    setEditModePaso2(false);
    showToast(
      `✓ Ya agregaste el cuajo (${finalCantidad} g · ${finalLote}) a las ${nowTimeStr}.`,
      'success'
    );
  };

  const handleSaveManualPaso2 = () => {
    if (!state.phase1.alcanzo35) {
      showToast('La mezcla debe alcanzar los 35 °C antes de agregar el cuajo.', 'warning');
      return;
    }

    if (!isIndustrial) {
      if (!state.insumos.lecheAcida || state.insumos.lecheAcida <= 0 || !state.insumos.lecheFresca || state.insumos.lecheFresca <= 0) {
        showToast('Ingresa primero los litros de leche ácida y leche fresca de la mezcla.', 'warning');
        return;
      }
    } else {
      if (!state.insumos.lecheFresca || state.insumos.lecheFresca <= 0) {
        showToast('Ingresa primero los litros de leche en tina.', 'warning');
        return;
      }
      if (!cultivoLacteoGramos || cultivoLacteoGramos <= 0) {
        showToast('Ingresa primero la cantidad de ácido acético agregada a la tina.', 'warning');
        return;
      }
    }

    const formattedHora = formatTimeFromStep1(draftHoraCuajo);
    const finalCantidad =
      Number(cantidadCuajoInput) > 0
        ? Number(cantidadCuajoInput)
        : cuajoSugeridoGramos;
    const finalLote = loteCuajoSelect;
    if (!finalLote) {
      showToast('Selecciona el lote de cuajo antes de guardar.', 'warning');
      return;
    }

    // Recálculo automático de duraciones para trazabilidad
    const hora35 = state.phase1.horaAlcanzo35;
    let tiempoDesde35 = state.phase2?.tiempoDesde35 || '0 s';
    let tiempoTotal = state.phase2?.tiempoTotalHastaCuajo || '0 s';

    if (hora35) {
      tiempoDesde35 = computeDurationBetweenTimes(hora35, formattedHora).human;
    }
    if (horaInicioCalentamiento) {
      tiempoTotal = computeDurationBetweenTimes(
        horaInicioCalentamiento,
        formattedHora
      ).human;
    }

    setCantidadCuajoInput(finalCantidad);

    onChange((prev) => ({
      ...prev,
      phase2: {
        ...prev.phase2,
        cuajoAdicionado: true,
        horaAdicionCuajo: formattedHora,
        tiempoDesde35,
        tiempoTotalHastaCuajo: tiempoTotal,
        cantidadCuajo: `${finalCantidad} g`,
        cantidadCuajoGramos: finalCantidad,
        loteCuajo: finalLote,
        esCuajoManual: true,
        saved: true,
      },
    }));

    if (onUpdateLoteCuajo) {
      onUpdateLoteCuajo(finalLote);
    }

    setEditModePaso2(false);
    showToast(
      `✓ Cambios guardados en Paso 2 (${finalCantidad} g · ${finalLote} · ${formattedHora}).`,
      'success'
    );
  };

  // Validación visual del pH de la tina (Rango óptimo: 5.7 a 5.8, Objetivo: 5.7)
  const phMezclaActual = state.insumos.phMezcla || 0;
  const hasPhValue = phMezclaActual > 0;
  const phEnRangoOptimo =
    hasPhValue && phMezclaActual >= 5.6 && phMezclaActual <= 5.8;
  const phFueraDeRango =
    hasPhValue && (phMezclaActual < 5.6 || phMezclaActual > 5.8);

  const phInputStatus = !hasPhValue
    ? 'default'
    : phEnRangoOptimo
    ? 'valid'
    : phMezclaActual < 5.6 || phMezclaActual > 5.9
    ? 'error'
    : 'warning';


  return (
    <div className="flex flex-col w-full p-4 lg:p-6 gap-6 bg-[#FFFFFF] min-h-[calc(100vh-4rem)] pb-12">
      <StageHeader
        stageNumber={1}
        totalStages={5}
        title="Preparar y Acidificar la Leche"
        productName={
          isIndustrial
            ? 'Queso Doble Crema Industrial'
            : 'Queso Doble Crema Premium'
        }
        icon="science"
        isCompleted={Boolean(state.phase2?.cuajoAdicionado)}
      />

      {/* 1. PREPARACIÓN DE LA LECHE EN TINA Y TRAZABILIDAD */}
      <Card
        title={
          isIndustrial
            ? 'Leche en Tina, Ácido Acético y Lotes del Día'
            : 'Mezcla de Leches en la Tina y Lotes del Día'
        }
        icon="inventory_2"
        badge={`Total en Tina: ${totalLeche} L`}
        variant={isHeatingStarted && !editModeInsumos ? 'success' : 'default'}
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {isIndustrial ? (
            <div className="flex flex-col gap-3 p-4 rounded-xl bg-emerald-50/70 border border-emerald-300 shadow-2xs">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black text-emerald-950 flex items-center gap-1.5 uppercase tracking-wide">
                  <span className="material-symbols-outlined text-[18px] text-emerald-700">
                    science
                  </span>
                  Ácido Acético
                </label>
                <Badge variant="success" size="sm">
                  Medido en ml
                </Badge>
              </div>

              <SelectField
                label="Lote del Ácido Acético"
                icon="qr_code_2"
                value={loteCultivoLacteo}
                options={optionsAcidoAcetico.map((lote) => ({
                  value: lote,
                  label: `Lote ${lote}`,
                }))}
                disabled={isHeatingStarted && !editModeInsumos}
                onChange={(e) => {
                  const val = e.target.value;
                  onChange((p) => ({
                    ...p,
                    insumos: { ...p.insumos, loteCultivoLacteo: val },
                  }));
                  onUpdateLotesLeche((p) => ({
                    ...p,
                    loteCultivoLacteo: val,
                  }));
                  showToast(`Lote de Ácido Acético seleccionado: ${val}`);
                }}
              />

              <InputField
                label="Cantidad agregada"
                icon="colorize"
                type="number"
                inputMode="decimal"
                step="0.5"
                min="0"
                unit="ml"
                placeholder="Ej: 15"
                disabled={isHeatingStarted && !editModeInsumos}
                readOnly={isHeatingStarted && !editModeInsumos}
                value={cultivoLacteoGramos > 0 ? cultivoLacteoGramos : ''}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  onChange((p) => ({
                    ...p,
                    insumos: { ...p.insumos, cultivoLacteoGramos: val },
                  }));
                  onUpdateLotesLeche((p) => ({
                    ...p,
                    cultivoLacteoGramos: val,
                  }));
                }}
              />
            </div>
          ) : (
            <div className="flex flex-col gap-3 p-4 rounded-xl bg-amber-50/60 border border-amber-200">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black text-amber-950 flex items-center gap-1.5 uppercase tracking-wide">
                  <span className="material-symbols-outlined text-[18px] text-amber-700">
                    water
                  </span>
                  Lote Leche 1 (Leche Ácida)
                </label>
                <Badge variant="warning" size="sm">
                  Base Ácida
                </Badge>
              </div>

              <SelectField
                label="Lote del Proveedor"
                icon="local_shipping"
                value={
                  lotesLeche.loteLecheBase ||
                  lotesLeche.loteLeche1 ||
                  ''
                }
                options={optionsLecheAcida.map((lote) => ({
                  value: lote,
                  label: `Lote ${lote}`,
                }))}
                disabled={isHeatingStarted && !editModeInsumos}
                onChange={(e) => {
                  const val = e.target.value;
                  onUpdateLotesLeche((p) => ({
                    ...p,
                    loteLecheBase: val,
                    loteLeche1: val,
                  }));
                  showToast(`Lote de leche ácida seleccionado: ${val}`);
                }}
              />

              <InputField
                label="Litros de leche ácida"
                icon="water_drop"
                type="number"
                inputMode="decimal"
                min="0"
                unit="Litros"
                placeholder="Ej: 50"
                disabled={isHeatingStarted && !editModeInsumos}
                readOnly={isHeatingStarted && !editModeInsumos}
                value={state.insumos.lecheAcida > 0 ? state.insumos.lecheAcida : ''}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  onChange((p) => ({
                    ...p,
                    insumos: { ...p.insumos, lecheAcida: val },
                  }));
                  onUpdateLotesLeche((p) => ({ ...p, litrosLote1: val }));
                }}
              />
            </div>
          )}

          {/* Leche Fresca */}
          <div className="flex flex-col gap-3 p-4 rounded-xl bg-blue-50/60 border border-blue-200">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black text-blue-950 flex items-center gap-1.5 uppercase tracking-wide">
                <span className="material-symbols-outlined text-[18px] text-[#1B4E9B]">
                  biotech
                </span>
                {isIndustrial
                  ? 'Lote de Leche en Tina'
                  : 'Lote Leche 2 (Leche Fresca)'}
              </label>
              <Badge variant="info" size="sm">
                Recepción Planta
              </Badge>
            </div>

            <SelectField
              label="Lote del Proveedor"
              icon="local_shipping"
              value={loteLecheFrescaSel}
              options={optionsLecheFresca.map((lote) => ({
                value: lote,
                label: `Lote ${lote}`,
              }))}
              disabled={isHeatingStarted && !editModeInsumos}
              onChange={(e) => {
                const val = e.target.value;
                onUpdateLotesLeche((p) => ({
                  ...p,
                  loteLecheFresca: val,
                  loteLeche2: val,
                }));
                showToast(`Lote de leche fresca seleccionado: ${val}`);
              }}
            />

            <InputField
              label="Litros de leche fresca"
              icon="water_drop"
              type="number"
              inputMode="decimal"
              min="0"
              unit="Litros"
              placeholder="Ej: 150"
              disabled={isHeatingStarted && !editModeInsumos}
              readOnly={isHeatingStarted && !editModeInsumos}
              value={state.insumos.lecheFresca > 0 ? state.insumos.lecheFresca : ''}
              onChange={(e) => {
                const val = Number(e.target.value);
                onChange((p) => ({
                  ...p,
                  insumos: {
                    ...p.insumos,
                    lecheFresca: val,
                    ...(isIndustrial ? { lecheAcida: 0 } : {}),
                  },
                }));
                onUpdateLotesLeche((p) => ({
                  ...p,
                  litrosLote2: val,
                  ...(isIndustrial ? { litrosLote1: 0 } : {}),
                }));
              }}
            />
          </div>

          {/* Resumen Total y Medición de pH de la Tina */}
          <div className="flex flex-col justify-between p-4 rounded-xl bg-[#FFFFFF] border border-[#D6DEEA] shadow-2xs gap-3">
            <div>
              <span className="text-[10px] uppercase font-bold text-gray-500 tracking-wider block">
                TOTAL MEZCLA EN TINA
              </span>
              <div className="text-3xl font-black font-mono text-[#1B4E9B] mt-1">
                {totalLeche}{' '}
                <span className="text-sm font-bold text-gray-600">Litros</span>
              </div>
            </div>

            <div
              className={`p-3.5 rounded-xl border-2 transition-all flex flex-col gap-2 ${
                !hasPhValue
                  ? 'bg-white border-blue-200/90'
                  : phEnRangoOptimo
                  ? 'bg-emerald-50/70 border-emerald-400'
                  : phMezclaActual < 5.6 || phMezclaActual > 5.9
                  ? 'bg-red-50 border-red-400 shadow-sm'
                  : 'bg-amber-50 border-amber-400 shadow-sm'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-black text-[#191c1e] flex items-center gap-1">
                  <span className="material-symbols-outlined text-[16px] text-[#1B4E9B]">
                    science
                  </span>
                  pH de la Tina
                </span>
                <Badge
                  variant={
                    !hasPhValue
                      ? 'neutral'
                      : phEnRangoOptimo
                      ? 'success'
                      : phMezclaActual < 5.6 || phMezclaActual > 5.9
                      ? 'danger'
                      : 'warning'
                  }
                  size="sm"
                  pulse={phEnRangoOptimo}
                >
                  {!hasPhValue
                    ? 'Objetivo: 5.7'
                    : phEnRangoOptimo
                    ? 'Óptimo (5.7–5.8)'
                    : phMezclaActual < 5.7
                    ? 'Fuera de rango (<5.7)'
                    : 'Fuera de rango (>5.8)'}
                </Badge>
              </div>

              <InputField
                type="number"
                inputMode="decimal"
                step="0.05"
                min="4.0"
                max="7.0"
                unit="pH"
                placeholder="Ej: 5.7"
                targetHint="Obj: 5.7 (5.6 – 5.8)"
                status={phInputStatus}
                hint={
                  !hasPhValue
                    ? 'Rango óptimo: 5.6 a 5.8 (Objetivo 5.7)'
                    : phEnRangoOptimo
                    ? '✓ pH en el punto ideal para calentar y cuajar.'
                    : phFueraDeRango && phMezclaActual < 5.6
                    ? '⚠ Alerta: pH por debajo de 5.6 (mezcla muy ácida). Ajusta con leche fresca.'
                    : '⚠ Alerta: pH por encima de 5.8 (falta acidez). Ajusta antes de continuar.'
                }
                disabled={isHeatingStarted && !editModeInsumos}
                readOnly={isHeatingStarted && !editModeInsumos}
                value={hasPhValue ? phMezclaActual : ''}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  onChange((p) => ({
                    ...p,
                    insumos: { ...p.insumos, phMezcla: val },
                  }));
                }}
              />
            </div>
          </div>
        </div>

        {/* Apartado de Sal */}
        <div className="mt-4 p-4 rounded-xl bg-[#FFFFFF] border border-[#D6DEEA] grid grid-cols-1 md:grid-cols-2 items-center gap-4">
          <div>
            <span className="text-sm font-black text-[#191c1e] flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[18px] text-amber-700">
                grain
              </span>
              Sal para el Lote
            </span>
            <p className="text-xs font-bold text-amber-900 mt-1">
              Fórmula: 360 g de sal por cada 300 L de mezcla.
            </p>
          </div>

          <SelectField
            label="Lote de Sal"
            icon="inventory_2"
            value={selectedLoteSal}
            options={optionsSal}
            disabled={isHeatingStarted && !editModeInsumos}
            onChange={(e) => {
              const val = e.target.value;
              if (onUpdateLoteSal) onUpdateLoteSal(val);
              showToast(`Lote de sal seleccionado: ${val}`);
            }}
          />
        </div>

        {/* Casilla de verificación y botón de Guardar cambios */}
        {isHeatingStarted && (
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 mt-4 border-t border-[#D6DEEA]">
            <ManualEditToggle
              manual={Boolean(editModeInsumos)}
              onChange={(checked: boolean) => setEditModeInsumos(checked)}
            />

            {editModeInsumos && (
              <Button
                variant="primary"
                size="md"
                icon="save"
                onClick={handleSaveInsumos}
              >
                Guardar cambios
              </Button>
            )}
          </div>
        )}
      </Card>

      {/* PANEL DE ARRANQUE DE CALENTAMIENTO Y CRONÓMETRO */}
      <TimerBanner
        title="Calentamiento de la Mezcla en Tina"
        subtitle={
          state.phase1.alcanzo35
            ? `Calentamiento finalizado a las ${state.phase1.horaAlcanzo35} (tardó ${state.phase1.tiempoCalentamiento || timerCalentamiento.humanElapsed}).`
            : state.inicioCalentamiento?.iniciado
            ? `Calentamiento iniciado a las ${state.inicioCalentamiento.horaInicio}. Calentando hacia 35.0 °C.`
            : 'Presiona el botón al abrir el vapor o prender el fuego de la tina para iniciar el reloj del lote.'
        }
        formattedTime={
          state.phase1.alcanzo35
            ? state.phase1.tiempoCalentamiento || timerCalentamiento.humanElapsed
            : state.inicioCalentamiento?.iniciado
            ? timerCalentamiento.formattedElapsed
            : '00:00:00'
        }
        isRunning={isCalentandoRunning}
        isCompleted={isCalentandoCompleted}
        statusLabel={
          state.phase1.alcanzo35
            ? `Calentamiento completado (${state.phase1.tiempoCalentamiento || timerCalentamiento.humanElapsed})`
            : state.inicioCalentamiento?.iniciado
            ? 'Calentando en curso hacia 35 °C'
            : 'Listo para empezar'
        }
        variant="info"
        actionButton={
          !state.inicioCalentamiento?.iniciado ? (
            <Button
              variant="warning"
              size="lg"
              icon="play_circle"
              onClick={handleStartHeating}
            >
              Empezar a Calentar la Mezcla
            </Button>
          ) : undefined
        }
      />

      {/* PASO 1: La mezcla ya alcanzó los 35 grados!! */}
      <Card
        title="La mezcla ya alcanzó los 35 grados!!"
        icon="thermostat"
        badge={
          state.phase1.alcanzo35
            ? '✓ Paso 1 Completado (35 °C)'
            : 'Paso 1 · Meta: 35.0 °C'
        }
        variant={state.phase1.alcanzo35 ? 'success' : 'default'}
        headerAction={
          <ConfirmButton
            label="Confirmar: Ya alcanzó los 35 °C"
            confirmedLabel={`✓ Alcanzó 35 °C (${state.phase1.horaAlcanzo35 || ''})`}
            icon="thermostat"
            isConfirmed={state.phase1.alcanzo35}
            disabled={!state.inicioCalentamiento?.iniciado}
            onConfirm={handleReach35}
          />
        }
      >
        <div className="p-4 rounded-xl bg-white border border-[#D6DEEA] flex flex-col gap-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
            {/* 1. Temperatura alcanzada */}
            <div className="p-3.5 rounded-xl bg-[#FFFFFF] border border-[#D6DEEA]">
              <InputField
                label="Temperatura alcanzada"
                icon="thermostat"
                type="number"
                inputMode="decimal"
                step="0.1"
                unit="°C"
                placeholder="Ej: 35.0"
                disabled={!editModePaso1}
                readOnly={!editModePaso1}
                value={
                  editModePaso1
                    ? draftTempPaso1
                    : state.phase1.alcanzo35
                    ? state.phase1.temperaturaAlcanzada || 35.0
                    : ''
                }
                onChange={(e) => setDraftTempPaso1(Number(e.target.value))}
              />
            </div>

            {/* 2. Tiempo para calentarse (SOLO LECTURA - DERIVADO AUTOMÁTICO) */}
            <div className="p-3.5 rounded-xl bg-[#FFFFFF] border border-[#D6DEEA]">
              <InputField
                label="Tiempo para calentarse"
                icon="timer"
                type="text"
                placeholder="Se calcula automáticamente"
                disabled
                readOnly
                hint={
                  horaInicioCalentamiento
                    ? `Calculado: ${horaInicioCalentamiento} → ${
                        editModePaso1
                          ? draftHoraPaso1
                          : state.phase1.horaAlcanzo35 || '--'
                      }`
                    : 'Calculado automáticamente al iniciar y alcanzar 35 °C'
                }
                value={
                  editModePaso1
                    ? duracionCalentamientoRecalculada.human
                    : state.phase1.tiempoCalentamiento || ''
                }
              />
            </div>

            {/* 3. Momento alcanzado (EVENTO EDITABLE CON POPOVER) */}
            <div className="p-3.5 rounded-xl bg-[#FFFFFF] border border-[#D6DEEA]">
              {editModePaso1 ? (
                <PopoverTimePicker
                  label="Momento alcanzado"
                  icon="schedule"
                  value={draftHoraPaso1}
                  onChange={setDraftHoraPaso1}
                />
              ) : (
                <InputField
                  label="Momento alcanzado"
                  icon="schedule"
                  type="text"
                  placeholder="--:--:--"
                  disabled
                  readOnly
                  value={state.phase1.horaAlcanzo35 || ''}
                />
              )}
            </div>
          </div>

          {/* Casilla de verificación y botón de Guardar cambios */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#D6DEEA]">
            <ManualEditToggle manual={Boolean(editModePaso1)} onChange={(checked: boolean) => setEditModePaso1(checked)} />

            {editModePaso1 && (
              <Button
                variant="primary"
                size="md"
                icon="save"
                onClick={handleSaveManualPaso1}
              >
                Guardar cambios
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* PASO 2: Ya agregué el cuajo a la mezcla */}
      <Card
        title="Ya agregué el cuajo a la mezcla"
        icon="water_drop"
        badge={
          state.phase2?.cuajoAdicionado
            ? '✓ Paso 2 Completado (Cuajo Agregado)'
            : `Sugerido para ${totalLeche} L: ${cuajoSugeridoGramos} g`
        }
        variant={state.phase2?.cuajoAdicionado ? 'success' : 'default'}
      >
        <div className="p-4 rounded-xl bg-white border border-[#D6DEEA] flex flex-col gap-4">
          {/* Banner de cálculo sugerido en tiempo real */}
          <div className="px-3.5 py-2.5 rounded-xl bg-blue-50/80 border border-blue-200 flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="font-bold text-blue-950 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[18px] text-[#1B4E9B]">
                calculate
              </span>
              <span>
                Fórmula: <strong>1.2 g de cuajo por cada 100 L de mezcla</strong>
              </span>
            </span>
            <span className="font-mono font-black text-[#1B4E9B] bg-white px-2.5 py-1 rounded-lg border border-blue-200">
              Cálculo sugerido ({totalLeche} L): {cuajoSugeridoGramos} g
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
            {/* 1. Cantidad de cuajo (Editable, con cálculo sugerido en tiempo real) */}
            <div className="p-3.5 bg-[#FFFFFF] rounded-xl border border-[#D6DEEA]">
              <InputField
                label="Cantidad de cuajo"
                icon="science"
                type="number"
                inputMode="decimal"
                step="0.05"
                min="0"
                unit="g"
                targetHint={`Sugerido: ${cuajoSugeridoGramos} g`}
                placeholder={
                  cuajoSugeridoGramos > 0
                    ? `Ej: ${cuajoSugeridoGramos}`
                    : 'Ej: 2.4'
                }
                value={cantidadCuajoInput > 0 ? cantidadCuajoInput : ''}
                disabled={Boolean(state.phase2?.cuajoAdicionado) && !editModePaso2}
                readOnly={Boolean(state.phase2?.cuajoAdicionado) && !editModePaso2}
                onChange={(e) => setCantidadCuajoInput(Number(e.target.value))}
              />
            </div>

            {/* 2. Lote (Select estético con opciones preparadas para BD) */}
            <div className="p-3.5 bg-[#FFFFFF] rounded-xl border border-[#D6DEEA]">
              <SelectField
                label="Lote"
                icon="inventory_2"
                value={loteCuajoSelect}
                options={optionsCuajo}
                disabled={Boolean(state.phase2?.cuajoAdicionado) && !editModePaso2}
                onChange={(e) => {
                  const val = e.target.value;
                  setLoteCuajoSelect(val);
                  if (onUpdateLoteCuajo) onUpdateLoteCuajo(val);
                }}
              />
            </div>

            {/* 3. Hora de cuajo (EVENTO EDITABLE CON POPOVER) */}
            <div className="p-3.5 bg-[#FFFFFF] rounded-xl border border-[#D6DEEA]">
              {editModePaso2 ? (
                <PopoverTimePicker
                  label="Hora de cuajo"
                  icon="schedule"
                  value={draftHoraCuajo}
                  onChange={setDraftHoraCuajo}
                />
              ) : (
                <InputField
                  label="Hora de cuajo"
                  icon="schedule"
                  type="text"
                  placeholder="--:--:--"
                  disabled
                  readOnly
                  hint={
                    state.phase2?.cuajoAdicionado
                      ? '✓ Hora registrada automáticamente'
                      : 'Se registra al confirmar el cuajo'
                  }
                  value={state.phase2?.horaAdicionCuajo || ''}
                />
              )}
            </div>
          </div>

          {/* Confirmación al final: primero se llena cantidad y lote, luego se confirma */}
          <ConfirmButton
            label="Ya agregué el cuajo"
            confirmedLabel={`✓ Cuajo agregado (${state.phase2?.horaAdicionCuajo || ''})`}
            icon="add_circle"
            isConfirmed={Boolean(state.phase2?.cuajoAdicionado)}
            disabled={!state.phase1.alcanzo35}
            onConfirm={handleRecordAdicionCuajo}
            fullWidth
          />

          {/* Casilla de verificación y botón de Guardar cambios */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#D6DEEA]">
            <ManualEditToggle manual={Boolean(editModePaso2)} onChange={(checked: boolean) => setEditModePaso2(checked)} />

            {editModePaso2 && (
              <Button
                variant="primary"
                size="md"
                icon="save"
                onClick={handleSaveManualPaso2}
              >
                Guardar cambios
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Botón único y claro para avanzar a la siguiente etapa */}
      <div className="flex justify-end pt-2">
        <Button
          variant="primary"
          size="xl"
          iconRight="arrow_forward"
          disabled={!state.phase2?.cuajoAdicionado}
          onClick={() => {
            if (!state.inicioCalentamiento?.iniciado) {
              showToast('Debes iniciar el calentamiento antes de pasar a la siguiente etapa.', 'warning');
              return;
            }
            if (!state.phase1.alcanzo35) {
              showToast('Debes confirmar que la mezcla alcanzó 35 °C antes de continuar.', 'warning');
              return;
            }
            if (!isIndustrial) {
              if (!state.insumos.lecheAcida || state.insumos.lecheAcida <= 0 || !state.insumos.lecheFresca || state.insumos.lecheFresca <= 0) {
                showToast('Debes registrar los litros de leche ácida y leche fresca antes de continuar.', 'warning');
                return;
              }
            } else {
              if (!state.insumos.lecheFresca || state.insumos.lecheFresca <= 0) {
                showToast('Debes registrar los litros de leche en tina antes de continuar.', 'warning');
                return;
              }
              if (!cultivoLacteoGramos || cultivoLacteoGramos <= 0) {
                showToast('Debes registrar la cantidad de ácido acético agregada antes de continuar.', 'warning');
                return;
              }
            }
            if (!state.phase2?.cuajoAdicionado) {
              showToast('Debes registrar la adición del cuajo antes de pasar a la etapa de cuajado.', 'warning');
              return;
            }
            onNextStage();
          }}
        >
          Pasar a Etapa 2: Calentar y Cuajar
        </Button>
      </div>
    </div>
  );
};

export const AcidificarStageIndustrial: React.FC<AcidificarStageProps> = (
  props
) => <AcidificarStage {...props} variant="industrial" />;
