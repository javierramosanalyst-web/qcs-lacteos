import React, { useEffect, useState, useMemo } from 'react';
import { ManualEditToggle } from '../../../components/ui/ManualEditToggle';
import {
  AcidificarState,
  LotesLeche,
  ProcessTimerState,
} from '../../../types';
import {
  computeDurationBetweenTimes,
  formatDurationBetweenTimestamps,
  getCurrentTimeString,
  toTimeInputStep1,
  formatTimeFromStep1,
} from '../../../utils/timer';
import {
  Badge,
  Button,
  Card,
  ConfirmButton,
  InputField,
  SelectField,
  StageHeader,
  TimerBanner,
  PopoverTimePicker,
} from '../../../components/ui';
import {
  LOTES_LECHE_PROVEEDOR_DEFAULT,
  LOTES_CUAJO_PERA_DEFAULT,
  LOTES_SAL_CATALOG,
  LOTES_ACIDO_ACETICO_CATALOG,
  useInsumoLotesVersion,
} from '../../../data/insumoLotes';

export interface AcidificarStage7CuerosProps {
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
  onNextStage: () => void;
  onOpenReviewModal: () => void;
  showToast: (msg: string, type?: 'success' | 'info' | 'warning') => void;
}

const SOLUCION_L_POR_L_LECHE = 12 / 400;
const CONC_OBJETIVO = 5;
const CONC_ACIDO_BASE = 98;

export const AcidificarStage7Cueros: React.FC<AcidificarStage7CuerosProps> = ({
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
  onNextStage,
  showToast,
}) => {
  // Lote de leche fresca unificado
  const [loteLecheFrescaId, setLoteLecheFrescaId] = useState<string>(
    lotesLeche.loteLeche1 ||
      lotesLeche.loteLecheFresca ||
      ''
  );

  // Litros de leche fresca (sin ceros predefinidos)
  const [litrosLecheFresca, setLitrosLecheFresca] = useState<number | undefined>(
    state.insumos.saved && state.insumos.lecheFresca > 0
      ? state.insumos.lecheFresca
      : lotesLeche.litrosLote1 && lotesLeche.litrosLote1 > 0
      ? lotesLeche.litrosLote1
      : state.insumos.lecheFresca > 0
      ? state.insumos.lecheFresca
      : undefined
  );

  // Lote de Ácido Acético
  const [loteAcidoAceticoVal, setLoteAcidoAceticoVal] = useState<string>(
    lotesLeche.loteAcidoAcetico ||
      state.insumos.loteAcidoAcetico ||
      ''
  );

  // Total de ácido acético reducido al 5% usado en la mezcla (sin ceros predefinidos)
  const [acidoMl, setAcidoMl] = useState<number | undefined>(
    state.insumos.acidoBase98Ml && state.insumos.acidoBase98Ml > 0
      ? state.insumos.acidoBase98Ml
      : lotesLeche.acidoBase98Ml && lotesLeche.acidoBase98Ml > 0
      ? lotesLeche.acidoBase98Ml
      : undefined
  );
  const [aguaMl, setAguaMl] = useState<number | undefined>(
    state.insumos.aguaDiluyenteMl && state.insumos.aguaDiluyenteMl > 0
      ? state.insumos.aguaDiluyenteMl
      : undefined
  );
  const [unidadAcido, setUnidadAcido] = useState<'ml' | 'L'>(
    state.insumos.unidadAcido || 'ml'
  );
  const [ajusteLibre, setAjusteLibre] = useState<boolean>(false);

  // Lotes complementarios para trazabilidad
  const [loteCuajoVal, setLoteCuajoVal] = useState<string>(
    loteCuajo || ''
  );
  const [loteSalVal, setLoteSalVal] = useState<string>(
    loteSal || ''
  );

  // Medición de pH (rango exigido para 7 Cueros: 5,30 - 5,35)
  const [phMedido, setPhMedido] = useState<number | undefined>(
    state.insumos.phMezcla && state.insumos.phMezcla > 0
      ? state.insumos.phMezcla
      : undefined
  );
  const [manualPh, setManualPh] = useState<boolean>(
    Boolean(state.insumos.saved) && !state.insumos.phRangoConfirmado
  );
  const [confirmacionPhRango, setConfirmacionPhRango] = useState<boolean>(
    Boolean(state.insumos.phRangoConfirmado || state.insumos.saved)
  );
  const [validationAttempted, setValidationAttempted] = useState<boolean>(false);

  const isSaved = Boolean(state.insumos.saved);

  useInsumoLotesVersion();

  const optionsLeche =
    loteLecheFrescaId && !LOTES_LECHE_PROVEEDOR_DEFAULT.includes(loteLecheFrescaId)
      ? [loteLecheFrescaId, ...LOTES_LECHE_PROVEEDOR_DEFAULT]
      : LOTES_LECHE_PROVEEDOR_DEFAULT;

  const optionsAcido =
    loteAcidoAceticoVal && !LOTES_ACIDO_ACETICO_CATALOG.includes(loteAcidoAceticoVal)
      ? [loteAcidoAceticoVal, ...LOTES_ACIDO_ACETICO_CATALOG]
      : LOTES_ACIDO_ACETICO_CATALOG;

  const optionsCuajo =
    loteCuajoVal && !LOTES_CUAJO_PERA_DEFAULT.includes(loteCuajoVal)
      ? [loteCuajoVal, ...LOTES_CUAJO_PERA_DEFAULT]
      : LOTES_CUAJO_PERA_DEFAULT;

  const optionsSal =
    loteSalVal && !LOTES_SAL_CATALOG.includes(loteSalVal)
      ? [loteSalVal, ...LOTES_SAL_CATALOG]
      : LOTES_SAL_CATALOG;

  // Edición manual de 35 °C con PopoverTimePicker
  const [manual35, setManual35] = useState<boolean>(false);
  const [hora35Manual, setHora35Manual] = useState<string>(
    state.phase1.horaAlcanzo35 || getCurrentTimeString()
  );

  const horaInicioCalentamiento =
    state.inicioCalentamiento?.horaInicio ||
    processTimer.startTime ||
    (state.insumos as any)?.horaRegistro ||
    '';

  // Duración recalculada automáticamente de forma estricta
  const duracionCalentamientoRecalculada = useMemo(() => {
    if (!hora35Manual) {
      return {
        human: state.phase1.tiempoCalentamiento || '0 s',
        seconds: state.phase1.segundosCalentamiento || 0,
      };
    }
    if (horaInicioCalentamiento) {
      return computeDurationBetweenTimes(horaInicioCalentamiento, hora35Manual);
    }
    return {
      human: state.phase1.tiempoCalentamiento || '0 s',
      seconds: state.phase1.segundosCalentamiento || 0,
    };
  }, [
    horaInicioCalentamiento,
    hora35Manual,
    state.phase1.tiempoCalentamiento,
    state.phase1.segundosCalentamiento,
  ]);

  const handleSaveManual35 = () => {
    const formattedHora = formatTimeFromStep1(hora35Manual);
    let duracionStr = state.phase1.tiempoCalentamiento || '0 s';
    let elapsedSec = state.phase1.segundosCalentamiento || 0;

    if (horaInicioCalentamiento) {
      const diff = computeDurationBetweenTimes(
        horaInicioCalentamiento,
        formattedHora
      );
      duracionStr = diff.human;
      elapsedSec = diff.seconds;
    }

    onChange((p) => ({
      ...p,
      phase1: {
        ...p.phase1,
        alcanzo35: true,
        horaAlcanzo35: formattedHora,
        tiempoCalentamiento: duracionStr,
        segundosCalentamiento: elapsedSec,
        saved: true,
      },
    }));
    setManual35(false);
    showToast(
      `✓ Hora de 35 °C actualizada (${formattedHora} · ${duracionStr})`,
      'success'
    );
  };

  useEffect(() => {
    setLoteLecheFrescaId(
      lotesLeche.loteLeche1 ||
        lotesLeche.loteLecheFresca ||
        ''
    );
    if (state.insumos.lecheFresca > 0) {
      setLitrosLecheFresca(state.insumos.lecheFresca);
    }
    setLoteAcidoAceticoVal(
      lotesLeche.loteAcidoAcetico ||
        state.insumos.loteAcidoAcetico ||
        ''
    );
    if (state.insumos.acidoBase98Ml && state.insumos.acidoBase98Ml > 0) {
      setAcidoMl(state.insumos.acidoBase98Ml);
    }
    if (state.insumos.aguaDiluyenteMl && state.insumos.aguaDiluyenteMl > 0) {
      setAguaMl(state.insumos.aguaDiluyenteMl);
    }
    if (state.insumos.phMezcla && state.insumos.phMezcla > 0) {
      setPhMedido(state.insumos.phMezcla);
    }
    if (state.phase1.horaAlcanzo35) {
      setHora35Manual(state.phase1.horaAlcanzo35);
    }
    setConfirmacionPhRango(
      Boolean(state.insumos.phRangoConfirmado || state.insumos.saved)
    );
  }, [lotesLeche, state.insumos, state.phase1.horaAlcanzo35]);

  const totalLeche = Math.max(0, Number(litrosLecheFresca) || 0);
  const cuajoCalculadoGramos = Math.round(totalLeche * 0.012 * 10) / 10;

  const isPhDentroDeRango =
    phMedido !== undefined && phMedido >= 5.3 && phMedido <= 5.35;

  const isMissingLitros =
    validationAttempted && (!litrosLecheFresca || litrosLecheFresca <= 0);
  const solucionSugeridaMl = totalLeche * SOLUCION_L_POR_L_LECHE * 1000;
  const acidoSugeridoMl = Math.round((solucionSugeridaMl * CONC_OBJETIVO) / CONC_ACIDO_BASE);
  const aguaSugeridaMl = Math.max(0, Math.round(solucionSugeridaMl) - acidoSugeridoMl);
  const acidoEfectivoMl = acidoMl ?? (totalLeche > 0 ? acidoSugeridoMl : undefined);
  const aguaEfectivaMl = aguaMl ?? (totalLeche > 0 ? aguaSugeridaMl : undefined);
  const solucionEfectivaMl = (acidoEfectivoMl || 0) + (aguaEfectivaMl || 0);
  const concentracionResultante =
    solucionEfectivaMl > 0 && acidoEfectivoMl
      ? (acidoEfectivoMl * CONC_ACIDO_BASE) / solucionEfectivaMl
      : undefined;
  const concentracionOk =
    concentracionResultante !== undefined &&
    concentracionResultante >= 4.5 &&
    concentracionResultante <= 5.5;

  const toUnidad = (ml: number) =>
    Math.round((unidadAcido === 'L' ? ml / 1000 : ml) * 1000) / 1000;
  const fmtUnidad = (ml: number) =>
    toUnidad(ml).toLocaleString('es-CO', { maximumFractionDigits: 3 });
  const fromUnidad = (v: number) => Math.round(unidadAcido === 'L' ? v * 1000 : v);

  const handleAguaChange = (raw: string) => {
    if (raw === '') {
      setAguaMl(undefined);
      if (!ajusteLibre) setAcidoMl(undefined);
      return;
    }
    const ml = Math.max(0, fromUnidad(Number(raw)));
    setAguaMl(ml);
    if (!ajusteLibre) setAcidoMl(Math.round((ml * CONC_OBJETIVO) / (CONC_ACIDO_BASE - CONC_OBJETIVO)));
  };

  const handleAcidoChange = (raw: string) => {
    if (raw === '') {
      setAcidoMl(undefined);
      if (!ajusteLibre) setAguaMl(undefined);
      return;
    }
    const ml = Math.max(0, fromUnidad(Number(raw)));
    setAcidoMl(ml);
    if (!ajusteLibre) setAguaMl(Math.round((ml * (CONC_ACIDO_BASE - CONC_OBJETIVO)) / CONC_OBJETIVO));
  };

  const handleRestablecerSugerido = () => {
    setAcidoMl(undefined);
    setAguaMl(undefined);
  };

  const isMissingAcido =
    validationAttempted && (acidoEfectivoMl === undefined || acidoEfectivoMl <= 0);
  const isMissingAgua =
    validationAttempted && (aguaEfectivaMl === undefined || aguaEfectivaMl <= 0);

  const phNota =
    phMedido === undefined || phMedido <= 0 || isPhDentroDeRango
      ? ''
      : phMedido < 5.3
      ? 'pH menor al rango sugerido (5,30 – 5,35). Se puede guardar igual.'
      : 'pH mayor al rango sugerido (5,30 – 5,35). Se puede guardar igual.';

  const handleConfirmPhRango = () => {
    if (phMedido === undefined || Number.isNaN(phMedido)) {
      showToast('Escribe el pH medido antes de confirmar el rango.', 'warning');
      return;
    }
    setConfirmacionPhRango(true);
    setManualPh(false);
    onChange((p) => ({
      ...p,
      insumos: {
        ...p.insumos,
        phMezcla: phMedido,
        phRangoConfirmado: true,
        confirmacionPh535: phMedido >= 5.3 && phMedido <= 5.35,
      },
    }));
    showToast(
      phMedido < 5.3 || phMedido > 5.35
        ? `pH ${phMedido.toFixed(2)} guardado, ${phMedido < 5.3 ? 'menor' : 'mayor'} al rango sugerido (5,30 – 5,35).`
        : `✓ pH (${phMedido.toFixed(2)}) confirmado dentro del rango (5,30 – 5,35).`,
      phMedido < 5.3 || phMedido > 5.35 ? 'warning' : 'success'
    );
  };

  const handleRegistrarAcidificacion = () => {
    setValidationAttempted(true);

    if (!loteLecheFrescaId) {
      showToast('Selecciona el lote de leche fresca del proveedor.', 'warning');
      return;
    }
    if (!litrosLecheFresca || litrosLecheFresca <= 0) {
      showToast(
        'Ingresa los litros de leche fresca (debe ser mayor a 0 L).',
        'warning'
      );
      return;
    }
    if (!loteAcidoAceticoVal || !loteAcidoAceticoVal.trim()) {
      showToast('Selecciona el lote de ácido acético.', 'warning');
      return;
    }
    if (!loteCuajoVal) {
      showToast('Selecciona el lote de cuajo (se usará en la Etapa 2).', 'warning');
      return;
    }
    if (!loteSalVal) {
      showToast('Selecciona el lote de sal (se usará en la Etapa 4).', 'warning');
      return;
    }
    if (!aguaEfectivaMl || aguaEfectivaMl <= 0 || !acidoEfectivoMl || acidoEfectivoMl <= 0) {
      showToast(
        'Ingresa el agua y el ácido acético al 98% de la preparación al 5%.',
        'warning'
      );
      return;
    }
    if (!confirmacionPhRango) {
      showToast(
        'Confirma el pH medido antes de guardar.',
        'warning'
      );
      return;
    }

    const nowTs = Date.now();
    const currentTime = getCurrentTimeString();

    if (!processTimer.isRunning && !processTimer.isCompleted) {
      onStartProcessTimer();
    }

    if (onUpdateLoteCuajo) onUpdateLoteCuajo(loteCuajoVal);
    if (onUpdateLoteSal) onUpdateLoteSal(loteSalVal);

    onUpdateLotesLeche((prev) => ({
      ...prev,
      loteLeche1: loteLecheFrescaId,
      loteLecheFresca: loteLecheFrescaId,
      litrosLote1: litrosLecheFresca,
      loteLeche2: '',
      litrosLote2: 0,
      loteAcidoAcetico: loteAcidoAceticoVal,
      acidoBase98Ml: acidoEfectivoMl,
      solucionPreparada5Litros: solucionEfectivaMl / 1000,
      confirmacionAcidoDiluido5: true,
      confirmacionPh535: isPhDentroDeRango,
      phRangoConfirmado: true,
      litrosConfirmados: totalLeche,
    }));

    onChange((prev) => ({
      ...prev,
      inicioCalentamiento: prev.inicioCalentamiento?.iniciado
        ? prev.inicioCalentamiento
        : {
            iniciado: true,
            horaInicio: currentTime,
            timestampInicio: nowTs,
          },
      insumos: {
        ...prev.insumos,
        lecheFresca: litrosLecheFresca,
        lecheAcida: 0,
        loteAcidoAcetico: loteAcidoAceticoVal,
        acidoBase98Ml: acidoEfectivoMl,
        aguaDiluyenteMl: aguaEfectivaMl,
        unidadAcido,
        solucionPreparada5Litros: solucionEfectivaMl / 1000,
        phMezcla: phMedido ?? 5.35,
        confirmacionAcidoDiluido5: true,
        confirmacionPh535: isPhDentroDeRango,
        phRangoConfirmado: true,
        litrosConfirmados: totalLeche,
        saved: true,
      },
      phase2: {
        ...prev.phase2,
        tipoCuajo: 'Cuajo Líquido (1,2 g / 100 L)',
        cantidadCuajo: `${cuajoCalculadoGramos} g`,
        cantidadCuajoGramos: cuajoCalculadoGramos,
        loteCuajo: loteCuajoVal,
      },
    }));

    setValidationAttempted(false);
    showToast(
      `✓ Acidificación 7 Cueros guardada: ${totalLeche} L leche · ${fmtUnidad(solucionEfectivaMl)} ${unidadAcido} ácido 5% · pH ${(
        phMedido ?? 5.35
      ).toFixed(2)}.`,
      'success'
    );
  };

  const handleReach35 = () => {
    if (!state.insumos?.saved) {
      showToast(
        'Primero guarda la acidificación (leche, ácido y pH) para iniciar el calentamiento.',
        'warning'
      );
      return;
    }
    const nowTs = Date.now();
    const currentTime = getCurrentTimeString();
    const startTs =
      state.inicioCalentamiento?.timestampInicio ||
      processTimer.startTimestamp ||
      nowTs;

    const duracionStr = horaInicioCalentamiento
      ? computeDurationBetweenTimes(horaInicioCalentamiento, currentTime).human
      : formatDurationBetweenTimestamps(startTs, nowTs);

    const elapsedSec = horaInicioCalentamiento
      ? computeDurationBetweenTimes(horaInicioCalentamiento, currentTime).seconds
      : Math.max(0, Math.floor((nowTs - startTs) / 1000));

    if (!processTimer.isRunning && !processTimer.isCompleted) {
      onStartProcessTimer();
    }

    onChange((p) => ({
      ...p,
      inicioCalentamiento: p.inicioCalentamiento?.iniciado
        ? p.inicioCalentamiento
        : {
            iniciado: true,
            horaInicio: currentTime,
            timestampInicio: startTs,
          },
      phase1: {
        ...p.phase1,
        alcanzo35: true,
        horaAlcanzo35: currentTime,
        timestampAlcanzo35: nowTs,
        tiempoCalentamiento: duracionStr,
        segundosCalentamiento: elapsedSec,
        saved: true,
      },
    }));

    setHora35Manual(currentTime);
    showToast(
      `✓ La leche llegó a 35 °C (${currentTime}). Calentamiento: ${duracionStr}`,
      'success'
    );
  };

  return (
    <div className="flex flex-col gap-6 pb-12">
      <StageHeader
        stageNumber={1}
        stageTitle="Acidificar la Leche (Queso 7 Cueros)"
        subtitle="Acidifica la leche fresca con ácido acético reducido al 5% hasta dejar el pH entre 5,30 y 5,35, y calienta la tina a 35 °C."
        icon="science"
        processTimer={processTimer}
        badges={
          <>
            <Badge variant="info" icon="water_drop">
              Leche Fresca: {totalLeche} L
            </Badge>
            <Badge variant="warning" icon="science">
              pH Meta: 5,30 – 5,35
            </Badge>
            <Badge variant="neutral" icon="person">
              Operario: {responsableProceso}
            </Badge>
          </>
        }
      />

      {/* =========================================================================
          TARJETA 1: INSUMOS, LECHE FRESCA UNIFICADA Y ÁCIDO ACÉTICO AL 5%
      ========================================================================= */}
      <Card
        title="1. Insumos y Leche Fresca (Queso 7 Cueros)"
        subtitle="Registra los litros de leche unificados con su lote, anota el ácido acético al 5% y verifica el pH antes de calentar."
        icon="water_drop"
        variant={isSaved ? 'completed' : 'default'}
        headerRight={
          <Badge variant={isSaved ? 'success' : 'warning'}>
            {isSaved ? '✓ Datos Guardados' : 'Pendiente Guardar'}
          </Badge>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* 1. Tarjeta Unificada: Leche Fresca con Lote Integrado (Estándar Doble Crema) */}
          <div className="flex flex-col gap-3 p-4 rounded-2xl bg-blue-50/60 border-2 border-blue-200 shadow-2xs">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black text-blue-950 flex items-center gap-1.5 uppercase tracking-wide">
                <span className="material-symbols-outlined text-[18px] text-[#1B4E9B]">
                  water_drop
                </span>
                Litros de Leche Fresca
              </label>
              <Badge variant="info" size="sm">
                100% Tina
              </Badge>
            </div>

            <SelectField
              label="Lote del Proveedor (Leche Fresca)"
              icon="local_shipping"
              value={loteLecheFrescaId}
              options={optionsLeche.map((lote) => ({
                value: lote,
                label: `Lote ${lote}`,
              }))}
              disabled={isSaved}
              onChange={(e) => {
                const val = e.target.value;
                setLoteLecheFrescaId(val);
                onUpdateLotesLeche((p) => ({
                  ...p,
                  loteLecheFresca: val,
                  loteLeche1: val,
                }));
                showToast(`Lote de leche fresca seleccionado: ${val}`);
              }}
            />

            <InputField
              label="Cantidad de leche en tina"
              icon="water_drop"
              type="number"
              inputMode="decimal"
              min="0"
              step="10"
              unit="L"
              placeholder="Ej: 600"
              value={litrosLecheFresca !== undefined && litrosLecheFresca > 0 ? litrosLecheFresca : ''}
              disabled={isSaved}
              onChange={(e) =>
                setLitrosLecheFresca(
                  e.target.value === ''
                    ? undefined
                    : Math.max(0, Number(e.target.value))
                )
              }
              error={
                isMissingLitros ? 'Ingresa los litros de leche fresca' : undefined
              }
              helperText={`Cuajo sugerido: ${cuajoCalculadoGramos} g (se adicionará en la Etapa 2)`}
            />
          </div>

          {/* 2. Ácido Acético Reducido al 5% (Input Limpio sin sección ni cálculo diluido) */}
          <div className="flex flex-col gap-3 p-4 rounded-2xl bg-amber-50/60 border-2 border-amber-300 shadow-2xs">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black text-amber-950 flex items-center gap-1.5 uppercase tracking-wide">
                <span className="material-symbols-outlined text-[18px] text-amber-700">
                  science
                </span>
                Preparación de Ácido Acético al 5%
              </label>
              <Badge variant="warning" size="sm">
                Agua + Ácido 98%
              </Badge>
            </div>

            <SelectField
              label="Lote Ácido Acético al 98%"
              icon="qr_code_2"
              value={loteAcidoAceticoVal}
              options={optionsAcido.map((cod) => ({
                value: cod,
                label: `Lote ${cod}`,
              }))}
              disabled={isSaved}
              onChange={(e) => {
                const val = e.target.value;
                setLoteAcidoAceticoVal(val);
                onUpdateLotesLeche((p) => ({
                  ...p,
                  loteAcidoAcetico: val,
                }));
              }}
            />

            <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-white border border-amber-300">
              <span className="text-[11px] font-bold text-amber-950 uppercase">Unidad de medida</span>
              <div className="flex rounded-lg overflow-hidden border border-amber-400">
                {(['ml', 'L'] as const).map((u) => (
                  <button
                    key={u}
                    type="button"
                    disabled={isSaved}
                    onClick={() => setUnidadAcido(u)}
                    className={`px-4 h-9 text-xs font-black cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${
                      unidadAcido === u ? 'bg-[#1B4E9B] text-white' : 'bg-white text-amber-950'
                    }`}
                  >
                    {u === 'ml' ? 'Mililitros (ml)' : 'Litros (L)'}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-amber-100/70 border border-amber-300 text-[11px] text-amber-950 font-semibold leading-snug">
              Para {totalLeche > 0 ? `${totalLeche} L` : 'la leche'} se requieren{' '}
              <strong className="font-mono">
                {totalLeche > 0 ? `${fmtUnidad(solucionSugeridaMl)} ${unidadAcido}` : '—'}
              </strong>{' '}
              de ácido acético al 5% (3 L por cada 100 L de leche).
            </div>

            <InputField
              label="Agua para la preparación"
              icon="water_drop"
              type="number"
              inputMode="decimal"
              min="0"
              step={unidadAcido === 'L' ? '0.1' : '10'}
              unit={unidadAcido}
              placeholder={unidadAcido === 'L' ? 'Ej: 11.4' : 'Ej: 11400'}
              value={aguaEfectivaMl !== undefined && aguaEfectivaMl > 0 ? toUnidad(aguaEfectivaMl) : ''}
              disabled={isSaved}
              onChange={(e) => handleAguaChange(e.target.value)}
              error={isMissingAgua ? 'Ingresa el agua de la preparación' : undefined}
              helperText="El agua es un insumo aparte (sin lote)"
            />

            <InputField
              label="Ácido acético al 98% a disolver"
              icon="colorize"
              type="number"
              inputMode="decimal"
              min="0"
              step={unidadAcido === 'L' ? '0.01' : '10'}
              unit={unidadAcido}
              placeholder={unidadAcido === 'L' ? 'Ej: 0.6' : 'Ej: 600'}
              value={acidoEfectivoMl !== undefined && acidoEfectivoMl > 0 ? toUnidad(acidoEfectivoMl) : ''}
              disabled={isSaved}
              onChange={(e) => handleAcidoChange(e.target.value)}
              error={isMissingAcido ? 'Ingresa el ácido acético al 98%' : undefined}
              helperText="Al cambiar uno de los dos, el otro se recalcula (regla de 3)"
            />

            <div
              className={`p-2.5 rounded-xl border text-[11px] font-semibold flex items-center justify-between gap-2 ${
                concentracionResultante === undefined
                  ? 'bg-white border-amber-200 text-amber-900'
                  : concentracionOk
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                  : 'bg-red-50 border-red-300 text-red-900'
              }`}
            >
              <span>
                Solución resultante:{' '}
                <strong className="font-mono">
                  {solucionEfectivaMl > 0 ? `${fmtUnidad(solucionEfectivaMl)} ${unidadAcido}` : '—'}
                </strong>
              </span>
              <span>
                Concentración:{' '}
                <strong className="font-mono">
                  {concentracionResultante !== undefined ? `${concentracionResultante.toFixed(2)} %` : '—'}
                </strong>
                {concentracionResultante !== undefined && !concentracionOk && ' · lejos del 5%'}
              </span>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="flex items-center gap-2 text-[11px] font-bold text-amber-950 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={ajusteLibre}
                  disabled={isSaved}
                  onChange={(e) => setAjusteLibre(e.target.checked)}
                  className="w-4 h-4 rounded cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                />
                Ajustar sin recalcular el otro valor
              </label>
              <button
                type="button"
                disabled={isSaved}
                onClick={handleRestablecerSugerido}
                className="text-[11px] font-black text-[#1B4E9B] underline cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
              >
                Usar sugerido
              </button>
            </div>
          </div>

          {/* 3. Lotes Complementarios (Cuajo y Sal para trazabilidad) */}
          <div className="flex flex-col gap-3 p-4 rounded-2xl bg-stone-50 border-2 border-stone-200 shadow-2xs justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-black text-stone-900 flex items-center gap-1.5 uppercase tracking-wide">
                  <span className="material-symbols-outlined text-[18px] text-stone-700">
                    inventory_2
                  </span>
                  Lotes Complementarios
                </label>
                <Badge variant="neutral" size="sm">
                  Trazabilidad
                </Badge>
              </div>

              <div className="flex flex-col gap-3">
                <SelectField
                  label="Lote de Cuajo (Para Etapa 2)"
                  icon="science"
                  value={loteCuajoVal}
                  options={optionsCuajo.map((cod) => ({
                    value: cod,
                    label: `Lote ${cod}`,
                  }))}
                  disabled={isSaved}
                  onChange={(e) => {
                    const val = e.target.value;
                    setLoteCuajoVal(val);
                    if (onUpdateLoteCuajo) onUpdateLoteCuajo(val);
                  }}
                />

                <SelectField
                  label="Lote de Sal (Para Etapa 4)"
                  icon="grain"
                  value={loteSalVal}
                  options={optionsSal.map((cod) => ({
                    value: cod,
                    label: `Lote ${cod}`,
                  }))}
                  disabled={isSaved}
                  onChange={(e) => {
                    const val = e.target.value;
                    setLoteSalVal(val);
                    if (onUpdateLoteSal) onUpdateLoteSal(val);
                  }}
                />
              </div>
            </div>

            <div className="pt-2 border-t border-stone-200 text-xs text-stone-500 font-medium">
              Estos lotes quedarán asociados automáticamente a las etapas posteriores.
            </div>
          </div>
        </div>

        {/* =========================================================================
            MEDICIÓN DE pH (DISEÑO SIMPLIFICADO QUE FLUYE EN COLUMNA CON CHECKBOX)
        ========================================================================= */}
        <div className="mt-5 pt-4 border-t border-stone-200 flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h4 className="text-base font-black text-stone-900 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[#1B4E9B] text-[20px]">
                  science
                </span>
                Medición de pH de la Leche Acidificada
              </h4>
              <p className="text-xs text-stone-600 mt-0.5">
                Mide el pH después de agregar el ácido reducido al 5%. Rango requerido para 7 Cueros: <strong>5,30 a 5,35</strong>.
              </p>
            </div>

            <Badge
              variant={
                phMedido === undefined || phMedido <= 0
                  ? 'neutral'
                  : isPhDentroDeRango
                  ? 'success'
                  : phMedido < 5.25 || phMedido > 5.45
                  ? 'danger'
                  : 'warning'
              }
              size="md"
            >
              {phMedido === undefined || phMedido <= 0
                ? 'Meta: 5,30 – 5,35'
                : isPhDentroDeRango
                ? '✓ Óptimo (5,30–5,35)'
                : phMedido < 5.30
                ? 'Bajo (<5,30)'
                : 'Alto (>5,35)'}
            </Badge>
          </div>

          {/* Checkbox Estándar Global: Habilitar edición manual */}
          <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-300 flex flex-wrap items-center justify-between gap-2 min-h-[48px]">
            <ManualEditToggle manual={Boolean(manualPh)} onChange={(checked: boolean) => !isSaved && setManualPh(checked)} />
            <Badge variant={manualPh ? 'warning' : confirmacionPhRango ? 'neutral' : 'info'} size="sm">
              {manualPh ? 'Modo Manual Activo' : confirmacionPhRango ? 'Confirmado' : 'Pendiente'}
            </Badge>
          </div>

          {/* Flujo vertical de medición de pH */}
          <div
            className={`p-4 rounded-2xl border-2 transition-all flex flex-col gap-3 ${
              phMedido === undefined || phMedido <= 0
                ? 'bg-white border-blue-200/90'
                : isPhDentroDeRango
                ? 'bg-emerald-50/70 border-emerald-400'
                : phMedido < 5.25 || phMedido > 5.45
                ? 'bg-red-50 border-red-400 shadow-sm'
                : 'bg-amber-50 border-amber-400 shadow-sm'
            }`}
          >
            {confirmacionPhRango && !manualPh ? (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-1">
                <div>
                  <span className="text-[10px] font-bold uppercase text-stone-500 block">
                    pH Medido y Confirmado en Tina
                  </span>
                  <span className="text-3xl font-black font-mono text-stone-900 block mt-0.5">
                    {phMedido !== undefined ? `${phMedido.toFixed(2)} pH` : '—'}
                  </span>
                  <span className="text-xs text-stone-600 font-semibold mt-1 block">
                    {isPhDentroDeRango
                      ? '✓ Verificado dentro del rango óptimo para Queso 7 Cueros (5,30 – 5,35).'
                      : `Nota: ${phNota}`}
                  </span>
                </div>

                <Badge variant={isPhDentroDeRango ? 'success' : 'warning'} size="md">
                  {isPhDentroDeRango
                    ? '✓ pH Aprobado'
                    : phMedido !== undefined && phMedido < 5.3
                    ? 'Menor al rango'
                    : 'Mayor al rango'}
                </Badge>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <InputField
                  label="Lectura de pH de la mezcla acidificada"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="4.50"
                  max="6.50"
                  unit="pH"
                  placeholder="Ej: 5.35"
                  value={phMedido !== undefined && phMedido > 0 ? phMedido : ''}
                  disabled={isSaved}
                  onChange={(e) => {
                    const val =
                      e.target.value === '' ? undefined : parseFloat(e.target.value);
                    setPhMedido(val);
                  }}
                  status={
                    phMedido === undefined
                      ? 'default'
                      : isPhDentroDeRango
                      ? 'valid'
                      : phMedido < 5.25 || phMedido > 5.45
                      ? 'error'
                      : 'warning'
                  }
                  targetHint="Rango exigido: 5,30 – 5,35"
                />

                {phNota && (
                  <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-300 text-xs font-bold text-amber-900">
                    {phNota}
                  </div>
                )}

                <div className="flex justify-end pt-1">
                  <ConfirmButton
                    confirmed={confirmacionPhRango && !manualPh}
                    onConfirm={handleConfirmPhRango}
                    label="Confirmar pH medido"
                    confirmedLabel="✓ pH confirmado"
                    icon="verified"
                    size="md"
                    disabled={isSaved}
                    fullWidth={false}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Botón Guardar Acidificación */}
        <div className="mt-5 pt-4 border-t border-stone-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <div className="text-xs sm:text-sm font-bold text-stone-600">
            {isSaved ? (
              <span className="text-emerald-800 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[18px] text-emerald-600">
                  verified
                </span>
                Acidificación guardada ({totalLeche} L leche · Ácido 5%:{' '}
                {fmtUnidad(solucionEfectivaMl)} {unidadAcido} · pH{' '}
                {phMedido !== undefined ? phMedido.toFixed(2) : '—'})
              </span>
            ) : (
              <span>
                Guarda los datos de acidificación para arrancar el calentamiento de la tina.
              </span>
            )}
          </div>

          <div className="flex flex-col sm:flex-row items-stretch gap-2">
            <ConfirmButton
              confirmed={isSaved}
              onConfirm={handleRegistrarAcidificacion}
              label="Guardar Acidificación 7 Cueros"
              confirmedLabel="✓ Acidificación Guardada"
              icon="save"
              fullWidth={false}
            />
            {isSaved && (
              <Button
                variant="outline"
                size="md"
                icon="edit"
                className="min-h-[48px]"
                onClick={() =>
                  onChange((prev) => ({
                    ...prev,
                    insumos: { ...prev.insumos, saved: false },
                  }))
                }
              >
                Editar
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* =========================================================================
          PASO 2: CALENTAMIENTO ("¡La leche está calentando!! Objetivo 35 °C")
      ========================================================================= */}
      <Card
        title="¡La leche está calentando!! Objetivo 35 °C"
        subtitle="Calienta la leche ya acidificada hasta llegar a 35 °C antes de pasar a la etapa de cuajado."
        icon="thermostat"
        variant={state.phase1.alcanzo35 ? 'completed' : 'active'}
        headerRight={
          <Badge variant={state.phase1.alcanzo35 ? 'success' : 'info'}>
            {state.phase1.alcanzo35 ? '35 °C Alcanzados' : 'Meta: 35,0 °C'}
          </Badge>
        }
      >
        <div className="flex flex-col gap-4">
          <TimerBanner
            label="Tiempo Calentando el Lote"
            formattedTime={processTimer.formattedTime}
            status={
              state.phase1.alcanzo35
                ? 'completed'
                : processTimer.isRunning
                ? 'running'
                : 'idle'
            }
            sublabel={
              state.inicioCalentamiento?.horaInicio
                ? `Inició a las ${state.inicioCalentamiento.horaInicio}`
                : 'Arranca al guardar acidificación o al marcar 35 °C'
            }
            targetLabel="Meta: 35,0 °C"
          />

          {/* Checkbox de Edición Manual de Tiempos (Estándar Inquebrantable) */}
          <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-300 flex flex-wrap items-center justify-between gap-2 min-h-[48px]">
            <ManualEditToggle manual={Boolean(manual35)} onChange={(checked: boolean) => setManual35(checked)} />
            <Badge variant={manual35 ? 'warning' : 'neutral'} size="sm">
              {manual35 ? 'Modo Manual Activo' : 'Automático'}
            </Badge>
          </div>

          {!manual35 ? (
            state.phase1.alcanzo35 ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-stone-200">
                <div className="p-3.5 bg-white rounded-xl border border-blue-200 flex flex-col justify-between">
                  <span className="text-[10px] uppercase font-bold text-gray-500">
                    Hora de Inicio Calentamiento
                  </span>
                  <span className="text-xl font-black font-mono text-[#1B4E9B] mt-1">
                    {horaInicioCalentamiento || '--:--:--'}
                  </span>
                  <span className="text-[11px] text-gray-500">
                    Punto de partida del calentamiento
                  </span>
                </div>

                <div className="p-3.5 bg-white rounded-xl border border-emerald-200 flex flex-col justify-between">
                  <span className="text-[10px] uppercase font-bold text-emerald-800">
                    Hora en que llegó a 35 °C
                  </span>
                  <span className="text-xl font-black font-mono text-emerald-950 mt-1">
                    {state.phase1.horaAlcanzo35 || '--:--:--'}
                  </span>
                  <span className="text-[11px] text-emerald-700 font-semibold">
                    ✓ Meta alcanzada
                  </span>
                </div>

                <div className="p-3.5 bg-white rounded-xl border border-amber-200 flex flex-col justify-between">
                  <span className="text-[10px] uppercase font-bold text-gray-500">
                    Tiempo que tardó en calentar
                  </span>
                  <span className="text-xl font-black font-mono text-amber-900 mt-1">
                    {state.phase1.tiempoCalentamiento || '0 s'}
                  </span>
                  <span className="text-[11px] text-gray-500">
                    Duración calculada automáticamente
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
                <p className="text-xs sm:text-sm font-medium text-stone-600">
                  Cuando el termómetro de la tina marque <strong>35 °C</strong>, pulsa el botón para registrar la hora exacta.
                </p>

                <ConfirmButton
                  confirmed={state.phase1.alcanzo35}
                  onConfirm={handleReach35}
                  label="¡Ya llegó a 35 °C!"
                  confirmedLabel="✓ Llegó a 35 °C"
                  icon="thermostat"
                  fullWidth={false}
                />
              </div>
            )
          ) : (
            /* Modo Manual con PopoverTimePicker y Duración de Solo Lectura */
            <div className="p-4 rounded-xl bg-amber-50/90 border-2 border-amber-300 flex flex-col gap-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
                {/* 1. Hora en que llegó a 35 °C (Editable con PopoverTimePicker) */}
                <PopoverTimePicker
                  label="Hora en que llegó a 35 °C"
                  icon="schedule"
                  hint="Toca para desplegar el selector flotante (hh:mm:ss)"
                  value={hora35Manual}
                  onChange={setHora35Manual}
                />

                {/* 2. Tiempo transcurrido (Duración Bloqueada de Solo Lectura) */}
                <InputField
                  label="Tiempo que tardó en calentar"
                  icon="timer"
                  type="text"
                  disabled
                  readOnly
                  placeholder="Se calcula automáticamente"
                  hint={
                    horaInicioCalentamiento
                      ? `Calculado: ${horaInicioCalentamiento} → ${hora35Manual}`
                      : 'Calculado automáticamente desde el inicio del calentamiento'
                  }
                  value={duracionCalentamientoRecalculada.human}
                />
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  variant="primary"
                  size="md"
                  icon="save"
                  onClick={handleSaveManual35}
                >
                  Guardar cambios
                </Button>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* =========================================================================
          FOOTER / AVANCE A ETAPA 2 (CORREGIDO CONTRASTE Y BOTÓN PRIMARIO AZUL)
      ========================================================================= */}
      <div className="p-5 rounded-2xl bg-white border border-[#D6DEEA] shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-[#1B4E9B] flex items-center justify-center shrink-0 border border-blue-200">
            <span className="material-symbols-outlined text-[26px]">heat</span>
          </div>
          <div>
            <h4 className="font-black text-sm sm:text-base text-gray-900">
              ¿Listo el proceso de acidificación y calentamiento a 35 °C?
            </h4>
            <p className="text-xs sm:text-sm text-gray-700 font-medium mt-0.5">
              Adiciona el cuajo (1,2 g por cada 100 L), espera el cuajado, haz el corte y sube a 40 °C.
            </p>
          </div>
        </div>

        <Button
          variant="primary"
          size="lg"
          iconRight="arrow_forward"
          onClick={onNextStage}
          disabled={!state.phase1.alcanzo35}
        >
          Ir a Etapa 2: Calentar y Cuajar
        </Button>
      </div>
    </div>
  );
};
