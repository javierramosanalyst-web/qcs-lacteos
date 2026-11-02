import React, { useEffect, useState, useMemo } from 'react';
import {
  StageHeader,
  Card,
  InputField,
  SelectField,
  SelectOption,
  TimerBanner,
  PopoverTimePicker,
  Button,
  Badge,
} from '../../../components/ui';
import { ProcessTimerState } from '../../../types';
import { BatidoYAdicionesYogurState } from '../../../types/yogur';
import { BatidoYAdicionesKumisState } from '../../../types/kumis';
import {
  computeDurationBetweenTimes,
  getCurrentTimeString,
} from '../../../utils/timer';
import { useStageCountdown } from '../../../hooks/useStageCountdown';

export interface BatidoYSaboresStageCommonProps {
  productType: 'yogur' | 'kumis';
  state: BatidoYAdicionesYogurState | BatidoYAdicionesKumisState;
  onChange: (
    updater: (
      prev: BatidoYAdicionesYogurState | BatidoYAdicionesKumisState
    ) => BatidoYAdicionesYogurState | BatidoYAdicionesKumisState
  ) => void;
  llevaAzucar?: boolean;
  litrosLecheBase?: number;
  processTimer: ProcessTimerState;
  onNextStage?: () => void;
  onOpenReviewModal?: () => void;
  showToast: (msg: string, type?: 'success' | 'info' | 'warning') => void;
}

export const LOTES_STEVIA_OPTIONS: SelectOption[] = [
  { value: 'EST-2026-BIO', label: 'EST-2026-BIO (Stevia Rebaudiana 98% Pureza)' },
  { value: 'EST-2026-04A', label: 'EST-2026-04A (Extracto Glucósidos de Esteviol)' },
  { value: 'EST-2026-ECO', label: 'EST-2026-ECO (Stevia Orgánica Ecológica)' },
];

export const BatidoYSaboresStageCommon: React.FC<BatidoYSaboresStageCommonProps> = ({
  productType,
  state,
  onChange,
  llevaAzucar = true,
  litrosLecheBase = 100,
  onNextStage,
  showToast,
}) => {
  const isYogur = productType === 'yogur';

  // =========================================================================
  // ESTADOS DEL PASO 01: PREPARACIÓN DE LA RECETA (COLOR Y SABOR)
  // =========================================================================
  const variedadAzucarState = (state.adiciones as any)?.variedadAzucar || {};

  const [saborSeleccionado, setSaborSeleccionado] = useState<string>(
    variedadAzucarState.sabor || (state.adiciones as any)?.sabor || (isYogur ? 'Mora' : 'Tradicional')
  );

  // Insumos limpios: inician sin ceros si no han sido registrados
  const [cantidadSaborizante, setCantidadSaborizante] = useState<number | ''>(
    (state.adiciones as any)?.saborizanteMl !== undefined && (state.adiciones as any)?.saborizanteMl !== null
      ? (state.adiciones as any)?.saborizanteMl
      : variedadAzucarState.saborizanteMl !== undefined && variedadAzucarState.saborizanteMl !== null
      ? variedadAzucarState.saborizanteMl
      : ''
  );

  const [loteSaborizante, setLoteSaborizante] = useState<string>(
    (state.adiciones as any)?.loteSaborizante ||
      variedadAzucarState.loteSaborizante ||
      (isYogur ? 'SAB-2026-10A' : 'SAB-KUM-2026')
  );

  const [cantidadColorante, setCantidadColorante] = useState<number | ''>(
    (state.adiciones as any)?.coloranteMl !== undefined && (state.adiciones as any)?.coloranteMl !== null
      ? (state.adiciones as any)?.coloranteMl
      : variedadAzucarState.coloranteMl !== undefined && variedadAzucarState.coloranteMl !== null
      ? variedadAzucarState.coloranteMl
      : ''
  );

  const [loteColorante, setLoteColorante] = useState<string>(
    (state.adiciones as any)?.loteColorante ||
      variedadAzucarState.loteColorante ||
      (isYogur ? 'COL-2026-10A' : 'COL-KUM-2026')
  );

  // Banderas de confirmación de receta
  const isRecetaConfirmada = Boolean(
    (state.adiciones as any)?.recetaConfirmada || state.adiciones?.registrado
  );

  const [manualPaso1, setManualPaso1] = useState<boolean>(
    Boolean((state.adiciones as any)?.esManualReceta || state.adiciones?.habilitarModificacionManual)
  );

  const [horaManualReceta, setHoraManualReceta] = useState<string>(
    (state.adiciones as any)?.horaPreparacionReceta ||
      state.adiciones?.horaRegistro ||
      getCurrentTimeString()
  );

  // =========================================================================
  // ESTADOS DEL PASO 01 (ALTERNATIVO): ADICIÓN DE STEVIA (SI NO LLEVA AZÚCAR)
  // =========================================================================
  const variedadEsteviaState = (state.adiciones as any)?.variedadEstevia || {};

  const isSteviaConfirmada = Boolean(
    (state.adiciones as any)?.steviaConfirmada ||
      Boolean((state.adiciones as any)?.horaAdicionStevia)
  );

  // Insumo limpio: inicia vacío sin ceros si no ha sido confirmada la adición
  const [cantidadStevia, setCantidadStevia] = useState<number | ''>(() => {
    if (
      (state.adiciones as any)?.steviaConfirmada ||
      (state.adiciones as any)?.horaAdicionStevia
    ) {
      return (
        (state.adiciones as any)?.gramosStevia ||
        variedadEsteviaState.gramosEstevia ||
        ''
      );
    }
    return '';
  });

  const [loteStevia, setLoteStevia] = useState<string>(
    (state.adiciones as any)?.loteStevia ||
      variedadEsteviaState.loteEstevia ||
      'EST-2026-BIO'
  );

  const [manualPaso1Stevia, setManualPaso1Stevia] = useState<boolean>(
    Boolean((state.adiciones as any)?.esManualStevia)
  );

  const [horaManualStevia, setHoraManualStevia] = useState<string>(
    (state.adiciones as any)?.horaAdicionStevia ||
      variedadEsteviaState.horaAdicion ||
      getCurrentTimeString()
  );

  const horaSteviaDisplay =
    (state.adiciones as any)?.horaAdicionStevia ||
    variedadEsteviaState.horaAdicion ||
    (state.adiciones as any)?.horaPreparacionReceta ||
    state.adiciones?.horaRegistro;

  useEffect(() => {
    if (!manualPaso1Stevia) {
      if ((state.adiciones as any)?.horaAdicionStevia) {
        setHoraManualStevia((state.adiciones as any).horaAdicionStevia);
      }
    }
  }, [manualPaso1Stevia, state.adiciones]);

  // Indicador unificado: ¿El paso 1 (Receta o Stevia) está confirmado?
  const isPaso1Listo = llevaAzucar ? isRecetaConfirmada : isSteviaConfirmada;

  // =========================================================================
  // ESTADOS DEL PASO 02: PROCESO DE BATIDO (ESTILO HILADO)
  // =========================================================================
  const [batidoStartTimestamp, setBatidoStartTimestamp] = useState<number | null>(() => {
    return state.batidora.iniciado && !state.batidora.completado ? Date.now() : null;
  });

  const isBatidoRunning = Boolean(state.batidora.iniciado && !state.batidora.completado);
  const isBatidoCompleted = Boolean(state.batidora.completado);

  const timerBatido = useStageCountdown({
    isRunning: isBatidoRunning,
    isCompleted: isBatidoCompleted,
    startTimestamp: batidoStartTimestamp,
    targetMinutes: 12,
    completedDurationText: state.batidora.tiempoBatido || undefined,
  });

  const [manualPaso2, setManualPaso2] = useState<boolean>(
    Boolean(state.batidora.esManual)
  );

  const [horaManualInicioBatido, setHoraManualInicioBatido] = useState<string>(
    state.batidora.horaInicio || getCurrentTimeString()
  );

  const [horaManualFinBatido, setHoraManualFinBatido] = useState<string>(
    state.batidora.horaFin || getCurrentTimeString()
  );

  // Recálculo automático de duración matemática de batido (Solo Lectura)
  const duracionBatidoRecalculada = useMemo(() => {
    return computeDurationBetweenTimes(horaManualInicioBatido, horaManualFinBatido);
  }, [horaManualInicioBatido, horaManualFinBatido]);

  // Sincronización cuando no está en edición manual
  useEffect(() => {
    if (!manualPaso1) {
      setHoraManualReceta(
        (state.adiciones as any)?.horaPreparacionReceta ||
          state.adiciones?.horaRegistro ||
          getCurrentTimeString()
      );
    }
  }, [manualPaso1, state.adiciones]);

  useEffect(() => {
    if (!manualPaso2) {
      if (state.batidora.horaInicio) {
        setHoraManualInicioBatido(state.batidora.horaInicio);
      }
      if (state.batidora.horaFin) {
        setHoraManualFinBatido(state.batidora.horaFin);
      }
    }
  }, [manualPaso2, state.batidora.horaInicio, state.batidora.horaFin]);

  // =========================================================================
  // MANEJADORES PASO 01: PREPARACIÓN DE LA RECETA
  // =========================================================================
  const handleConfirmReceta = () => {
    const timeStr = getCurrentTimeString();
    const numSabor = cantidadSaborizante === '' ? 0 : Number(cantidadSaborizante);
    const numColor = cantidadColorante === '' ? 0 : Number(cantidadColorante);

    onChange((prev: any) => ({
      ...prev,
      adiciones: {
        ...prev.adiciones,
        recetaConfirmada: true,
        registrado: true,
        horaRegistro: timeStr,
        horaPreparacionReceta: timeStr,
        sabor: saborSeleccionado,
        saborizanteMl: numSabor,
        loteSaborizante,
        coloranteMl: numColor,
        loteColorante,
        variedadAzucar: {
          ...(prev.adiciones?.variedadAzucar || {}),
          sabor: saborSeleccionado,
          saborizanteMl: numSabor,
          loteSaborizante,
          coloranteMl: numColor,
          loteColorante,
        },
      },
    }));

    showToast(
      `✓ ¡La receta está lista! Registrada a las ${timeStr} (Sabor: ${saborSeleccionado}).`,
      'success'
    );
  };

  const handleSaveManualReceta = () => {
    onChange((prev: any) => ({
      ...prev,
      adiciones: {
        ...prev.adiciones,
        recetaConfirmada: true,
        registrado: true,
        horaRegistro: horaManualReceta,
        horaPreparacionReceta: horaManualReceta,
        esManualReceta: true,
        habilitarModificacionManual: true,
      },
    }));

    showToast(
      `✓ Hora de preparación de receta actualizada a ${horaManualReceta}.`,
      'success'
    );
  };

  // =========================================================================
  // MANEJADORES PASO 01 (ALTERNATIVO): ADICIÓN DE STEVIA
  // =========================================================================
  const handleConfirmStevia = () => {
    const timeStr = getCurrentTimeString();
    const numStevia = cantidadStevia === '' ? 0 : Number(cantidadStevia);

    onChange((prev: any) => ({
      ...prev,
      adiciones: {
        ...prev.adiciones,
        tipoYogur: 'con_estevia',
        steviaConfirmada: true,
        registrado: true,
        horaRegistro: timeStr,
        horaAdicionStevia: timeStr,
        horaPreparacionReceta: timeStr,
        gramosStevia: numStevia,
        loteStevia: loteStevia,
        variedadEstevia: {
          ...(prev.adiciones?.variedadEstevia || {}),
          litrosBase: litrosLecheBase,
          gramosEstevia: numStevia,
          loteEstevia: loteStevia,
          registrado: true,
          horaAdicion: timeStr,
        },
      },
    }));

    showToast(
      `✓ ¡Ya agregué la stevia! Registrada a las ${timeStr} (${numStevia} g, Lote: ${loteStevia}). Paso de batido habilitado.`,
      'success'
    );
  };

  const handleSaveManualStevia = () => {
    onChange((prev: any) => ({
      ...prev,
      adiciones: {
        ...prev.adiciones,
        steviaConfirmada: true,
        registrado: true,
        horaRegistro: horaManualStevia,
        horaAdicionStevia: horaManualStevia,
        horaPreparacionReceta: horaManualStevia,
        esManualStevia: true,
        habilitarModificacionManual: true,
        variedadEstevia: {
          ...(prev.adiciones?.variedadEstevia || {}),
          loteEstevia: loteStevia,
          horaAdicion: horaManualStevia,
        },
      },
    }));

    showToast(
      `✓ Hora de adición de stevia actualizada a ${horaManualStevia}.`,
      'success'
    );
  };

  // =========================================================================
  // MANEJADORES PASO 02: BATIDO INDUSTRIAL (ESTILO HILADO)
  // =========================================================================
  const handleStartBatido = () => {
    const timeStr = getCurrentTimeString();
    const now = Date.now();
    setBatidoStartTimestamp(now);

    onChange((prev: any) => ({
      ...prev,
      batidora: {
        ...prev.batidora,
        iniciado: true,
        completado: false,
        horaInicio: timeStr,
      },
    }));

    showToast(
      `✓ Batido iniciado a las ${timeStr}. Cronómetro en marcha.`,
      'info'
    );
  };

  const handleFinBatido = () => {
    const timeStr = getCurrentTimeString();
    const startStr = state.batidora.horaInicio || timeStr;
    const durStr = computeDurationBetweenTimes(startStr, timeStr).human;

    onChange((prev: any) => ({
      ...prev,
      batidora: {
        ...prev.batidora,
        completado: true,
        horaFin: timeStr,
        tiempoBatido: durStr,
      },
      preparacionTolva: {
        ...(prev.preparacionTolva || {}),
        completado: true,
        horaPreparacion: timeStr,
      },
    }));

    showToast(
      `✓ Batido finalizado a las ${timeStr} (Tiempo total de batido: ${durStr}). Listo para envasado.`,
      'success'
    );
  };

  const handleSaveManualBatido = () => {
    const durStr = duracionBatidoRecalculada.human;

    onChange((prev: any) => ({
      ...prev,
      batidora: {
        ...prev.batidora,
        iniciado: true,
        completado: true,
        horaInicio: horaManualInicioBatido,
        horaFin: horaManualFinBatido,
        tiempoBatido: durStr,
        esManual: true,
      },
      preparacionTolva: {
        ...(prev.preparacionTolva || {}),
        completado: true,
        horaPreparacion: horaManualFinBatido,
      },
    }));

    showToast(
      `✓ Horas de batido actualizadas manualmente. Duración recalculada: ${durStr}.`,
      'success'
    );
  };

  const horaRecetaDisplay =
    (state.adiciones as any)?.horaPreparacionReceta || state.adiciones?.horaRegistro;

  return (
    <div className="flex flex-col w-full p-4 lg:p-6 gap-5 bg-[#FFFFFF] min-h-[calc(100vh-4rem)] pb-14">
      {/* CABECERA ESTÁNDAR MAESTRA */}
      <StageHeader
        stageNumber={3}
        totalStages={4}
        lineName={isYogur ? 'Línea de Fermentados · Yogur' : 'Línea de Fermentados · Kumis'}
        title="3. Batido y Sabores"
        subtitle={
          llevaAzucar
            ? 'Formulación de la receta (color y sabor) y batido suave controlado para lograr la textura homogénea y cremosa.'
            : 'Adición de stevia edulcorante y batido suave controlado para lograr la textura homogénea y cremosa.'
        }
        standardBadge="NTC-805"
        metrics={[
          {
            icon: 'water_drop',
            label: 'Volumen del Lote',
            value: `${litrosLecheBase} L`,
            tone: 'emerald',
          },
          {
            icon: llevaAzucar ? 'menu_book' : 'eco',
            label: llevaAzucar ? 'Receta' : 'Stevia',
            value: isPaso1Listo
              ? llevaAzucar
                ? 'Receta Lista ✓'
                : 'Stevia Lista ✓'
              : llevaAzucar
              ? 'Por Definir'
              : 'Por Agregar',
            tone: isPaso1Listo ? 'emerald' : 'amber',
          },
          {
            icon: 'cyclone',
            label: 'Batido Industrial',
            value: isBatidoCompleted
              ? 'Completado ✓'
              : isBatidoRunning
              ? 'Batiendo...'
              : 'Por Iniciar',
            tone: isBatidoCompleted ? 'emerald' : isBatidoRunning ? 'amber' : 'default',
          },
        ]}
      />

      {/* ========================================================================= */}
      {/* PASO 01 CONDICIONAL: CON AZÚCAR (RECETA) vs SIN AZÚCAR (STEVIA)           */}
      {/* ========================================================================= */}
      {llevaAzucar ? (
        /* PASO 01 (CON AZÚCAR): PREPARACIÓN DE LA RECETA (COLOR Y SABOR) */
        <Card
          stepBadge="Paso 01"
          title="Preparación de la Receta (Color y Sabor)"
          subtitle="Define las cantidades de saborizante y colorante con sus respectivos lotes para preparar la mezcla antes de encender la batidora."
          icon="menu_book"
          tone={isRecetaConfirmada ? 'completed' : 'active'}
          statusBadge={
            isRecetaConfirmada
              ? {
                  label: `Receta Lista (${horaRecetaDisplay || 'Confirmada'}) ✓`,
                  variant: 'success',
                }
              : { label: 'Definir Mezcla', variant: 'warning' }
          }
          headerAction={
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-semibold text-[#4A5263] bg-[#F2F4F7] px-3 py-1.5 rounded-lg border border-[#D6DEEA] hover:bg-[#E6ECF5] transition-colors">
                <input
                  type="checkbox"
                  checked={manualPaso1}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setManualPaso1(checked);
                    onChange((p: any) => ({
                      ...p,
                      adiciones: { ...p.adiciones, esManualReceta: checked },
                    }));
                  }}
                  className="rounded border-[#C5D0E0] text-[#191C1E] focus:ring-amber-500 w-4 h-4 cursor-pointer"
                />
                <span>Habilitar edición manual</span>
              </label>

              {/* Botón de confirmación tipo "¡La receta está lista!" */}
              <Button
                variant={isRecetaConfirmada ? 'secondary' : 'primary'}
                size="md"
                icon="check_circle"
                onClick={handleConfirmReceta}
                className={
                  isRecetaConfirmada
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300 font-bold'
                    : 'font-bold shadow-sm'
                }
              >
                {isRecetaConfirmada
                  ? `✓ ¡La receta está lista! (${horaRecetaDisplay || 'OK'})`
                  : '¡La receta está lista!'}
              </Button>
            </div>
          }
        >
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              {/* Sabor del Producto */}
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-[#4A5263] block mb-1">
                  Sabor del Lote
                </label>
                <select
                  value={saborSeleccionado}
                  onChange={(e) => setSaborSeleccionado(e.target.value)}
                  className="w-full bg-white px-3 py-2.5 rounded-xl border border-[#d6ccb8] font-bold text-sm text-[#191C1E] outline-none shadow-2xs"
                >
                  {isYogur ? (
                    <>
                      <option value="Mora">Mora</option>
                      <option value="Fresa">Fresa</option>
                      <option value="Melocotón">Melocotón / Durazno</option>
                      <option value="Frutos Rojos">Frutos Rojos</option>
                      <option value="Vainilla">Vainilla</option>
                      <option value="Arequipe">Arequipe</option>
                      <option value="Natural">Natural (Sin Saborizante)</option>
                    </>
                  ) : (
                    <>
                      <option value="Tradicional">Kumis Tradicional</option>
                      <option value="Vainilla">Kumis Vainilla</option>
                      <option value="Canela">Kumis con Canela</option>
                    </>
                  )}
                </select>
              </div>

              {/* Insumo 1: Cantidad de Saborizante (ml) */}
              <InputField
                label="Cantidad de Saborizante (ml)"
                type="number"
                unit="ml"
                placeholder="Ej: 800"
                value={cantidadSaborizante === '' ? '' : cantidadSaborizante}
                onChange={(e) => {
                  const val = e.target.value === '' ? '' : Number(e.target.value);
                  setCantidadSaborizante(val);
                }}
                hint="Dosificación exacta en ml"
              />

              {/* Insumo 2: Lote de Saborizante */}
              <InputField
                label="Lote de Saborizante"
                type="text"
                placeholder={isYogur ? 'Ej: SAB-2026-10A' : 'Ej: SAB-KUM-2026'}
                value={loteSaborizante}
                onChange={(e) => setLoteSaborizante(e.target.value)}
                hint="Código del frasco de sabor"
              />

              {/* Insumo 3: Cantidad de Colorante (ml) */}
              <InputField
                label="Cantidad de Colorante (ml)"
                type="number"
                unit="ml"
                placeholder="Ej: 50"
                value={cantidadColorante === '' ? '' : cantidadColorante}
                onChange={(e) => {
                  const val = e.target.value === '' ? '' : Number(e.target.value);
                  setCantidadColorante(val);
                }}
                hint="Dosificación exacta en ml"
              />

              {/* Insumo 4: Lote de Colorante */}
              <InputField
                label="Lote de Colorante"
                type="text"
                placeholder={isYogur ? 'Ej: COL-2026-10A' : 'Ej: COL-KUM-2026'}
                value={loteColorante}
                onChange={(e) => setLoteColorante(e.target.value)}
                hint="Código del frasco de colorante"
              />
            </div>

            {/* Edición manual de hora de preparación de la receta con PopoverTimePicker */}
            {manualPaso1 && (
              <div className="p-4 rounded-xl bg-amber-50/90 border-2 border-amber-300 flex flex-col sm:flex-row items-end gap-3 justify-between">
                <div className="w-full sm:max-w-xs">
                  <PopoverTimePicker
                    label="Hora en que se confirmó la receta"
                    icon="schedule"
                    hint="Toca para desplegar selector flotante (hh:mm:ss a)"
                    value={horaManualReceta}
                    onChange={setHoraManualReceta}
                  />
                </div>
                <Button
                  variant="secondary"
                  size="md"
                  icon="save"
                  onClick={handleSaveManualReceta}
                  className="w-full sm:w-auto font-bold"
                >
                  Guardar Hora de Receta
                </Button>
              </div>
            )}
          </div>
        </Card>
      ) : (
        /* PASO 01 ALTERNATIVO (SIN AZÚCAR): ¡ADICIÓN DE STEVIA! */
        <Card
          stepBadge="Paso 01"
          title="¡Adición de Stevia!"
          subtitle="Dosifica la cantidad exacta de stevia según la formulación del lote para endulzar el producto sin azúcar."
          icon="eco"
          tone={isSteviaConfirmada ? 'completed' : 'active'}
          statusBadge={
            isSteviaConfirmada
              ? {
                  label: `Stevia Agregada (${horaSteviaDisplay || 'Confirmada'}) ✓`,
                  variant: 'success',
                }
              : { label: 'Por Agregar', variant: 'warning' }
          }
          headerAction={
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-semibold text-[#4A5263] bg-[#F2F4F7] px-3 py-1.5 rounded-lg border border-[#D6DEEA] hover:bg-[#E6ECF5] transition-colors">
                <input
                  type="checkbox"
                  checked={manualPaso1Stevia}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setManualPaso1Stevia(checked);
                    onChange((p: any) => ({
                      ...p,
                      adiciones: { ...p.adiciones, esManualStevia: checked },
                    }));
                  }}
                  className="rounded border-[#C5D0E0] text-[#191C1E] focus:ring-amber-500 w-4 h-4 cursor-pointer"
                />
                <span>Habilitar edición manual</span>
              </label>

              {/* Botón de confirmación tipo "¡Ya agregué la stevia!" */}
              <Button
                variant={isSteviaConfirmada ? 'secondary' : 'primary'}
                size="md"
                icon="check_circle"
                onClick={handleConfirmStevia}
                className={
                  isSteviaConfirmada
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300 font-bold'
                    : 'font-bold shadow-sm'
                }
              >
                {isSteviaConfirmada
                  ? `✓ ¡Ya agregué la stevia! (${horaSteviaDisplay || 'OK'})`
                  : '¡Ya agregué la stevia!'}
              </Button>
            </div>
          }
        >
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Insumo 1: Cantidad de Stevia (g) */}
              <InputField
                label="Cantidad de Stevia (g)"
                type="number"
                unit="g"
                placeholder="Ej: 80"
                value={cantidadStevia === '' ? '' : cantidadStevia}
                onChange={(e) => {
                  const val = e.target.value === '' ? '' : Number(e.target.value);
                  setCantidadStevia(val);
                }}
                hint={`Dosificación sugerida: ${(litrosLecheBase * 0.8).toFixed(0)} g para ${litrosLecheBase} L`}
              />

              {/* Insumo 2: Lote de Stevia (Selector desplegable) */}
              <SelectField
                label="Lote de Stevia"
                icon="eco"
                options={LOTES_STEVIA_OPTIONS}
                value={loteStevia}
                onChange={(e) => setLoteStevia(e.target.value)}
                hint="Selecciona el lote del insumo edulcorante"
              />

              {/* Resumen / Estado de Adición */}
              <div className="p-3.5 bg-[#FFFFFF] rounded-xl border border-[#D6DEEA] flex flex-col justify-between">
                <span className="text-[11px] uppercase font-bold text-[#4A5263]">
                  Hora de Adición
                </span>
                <div className="text-xl font-black font-mono text-[#191C1E] mt-1">
                  {horaSteviaDisplay || '--:--:--'}
                </div>
                <span className="text-[11px] text-[#6B7280] mt-1 block">
                  {isSteviaConfirmada
                    ? 'Registrada al pulsar confirmación'
                    : 'Pendiente de registrar'}
                </span>
              </div>
            </div>

            {/* Edición manual de hora de adición con PopoverTimePicker */}
            {manualPaso1Stevia && (
              <div className="p-4 rounded-xl bg-amber-50/90 border-2 border-amber-300 flex flex-col sm:flex-row items-end gap-3 justify-between">
                <div className="w-full sm:max-w-xs">
                  <PopoverTimePicker
                    label="Hora en que se agregó la stevia"
                    icon="schedule"
                    hint="Toca para desplegar selector flotante (hh:mm:ss a)"
                    value={horaManualStevia}
                    onChange={setHoraManualStevia}
                  />
                </div>
                <Button
                  variant="secondary"
                  size="md"
                  icon="save"
                  onClick={handleSaveManualStevia}
                  className="w-full sm:w-auto font-bold"
                >
                  Guardar Hora de Stevia
                </Button>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* ========================================================================= */}
      {/* PASO 02: PROCESO DE BATIDO (ESTRUCTURA IDÉNTICA A HILAR Y AMASAR)         */}
      {/* ========================================================================= */}
      <Card
        stepBadge="Paso 02"
        title="Proceso de Batido (Tolva / Batidora)"
        subtitle="Registra el inicio y fin del proceso de batido para romper el coágulo y lograr textura homogénea y cremosa."
        icon="cyclone"
        tone={
          isBatidoCompleted
            ? 'completed'
            : isBatidoRunning
            ? 'active'
            : isPaso1Listo
            ? 'default'
            : 'default'
        }
        statusBadge={
          isBatidoCompleted
            ? {
                label: `Batido Finalizado (${state.batidora.horaFin || 'Listo'}) ✓`,
                variant: 'success',
              }
            : isBatidoRunning
            ? { label: 'Batiendo en Tolva...', variant: 'warning', pulse: true }
            : isPaso1Listo
            ? { label: 'Listo para Iniciar', variant: 'info' }
            : {
                label: llevaAzucar
                  ? 'Bloqueado (Define Receta)'
                  : 'Bloqueado (Agrega Stevia)',
                variant: 'neutral',
              }
        }
        headerAction={
          <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
            {/* Botón 1: Iniciar batido (se deshabilita al pulsar) */}
            <Button
              variant={state.batidora.iniciado ? 'secondary' : 'primary'}
              size="md"
              icon="play_circle"
              disabled={Boolean(state.batidora.iniciado) || !isPaso1Listo}
              onClick={handleStartBatido}
              className="font-bold shadow-2xs"
            >
              {state.batidora.iniciado
                ? `Iniciado (${state.batidora.horaInicio})`
                : 'Iniciar batido'}
            </Button>

            {/* Botón 2: Aparece / se habilita para Finalizar batido */}
            {state.batidora.iniciado && (
              <Button
                variant={state.batidora.completado ? 'success' : 'warning'}
                size="md"
                icon="stop_circle"
                disabled={Boolean(state.batidora.completado)}
                onClick={handleFinBatido}
                className="font-bold shadow-2xs"
              >
                {state.batidora.completado
                  ? `✓ Batido Finalizado (${state.batidora.horaFin})`
                  : 'Finalizar batido'}
              </Button>
            )}
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          {/* Cronómetro visual en vivo entre inicio y fin de batido */}
          {state.batidora.iniciado && (
            <TimerBanner
              label="Cronómetro de Batido en Tolva"
              sublabel={
                isBatidoCompleted
                  ? `Batido completado a las ${state.batidora.horaFin} (Tiempo total: ${state.batidora.tiempoBatido}).`
                  : `Iniciado a las ${state.batidora.horaInicio}. Batiendo suavemente en tolva...`
              }
              formattedTime={
                isBatidoCompleted
                  ? state.batidora.tiempoBatido || timerBatido.humanElapsed
                  : timerBatido.formattedElapsed
              }
              targetLabel="12 min"
              progressPercent={timerBatido.progressPercent}
              isRunning={isBatidoRunning}
              isCompleted={isBatidoCompleted}
              isOvertime={timerBatido.isOvertime}
              className="mb-2"
            />
          )}

          {/* Barra de activación de Edición Manual */}
          <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-300 flex flex-wrap items-center justify-between gap-2 min-h-[48px]">
            <label className="flex items-center gap-2.5 text-xs font-bold text-amber-950 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={manualPaso2}
                onChange={(e) => setManualPaso2(e.target.checked)}
                className="w-5 h-5 rounded text-[#1B4E9B] border-amber-300 cursor-pointer"
              />
              <span>Habilitar edición manual (Paso 2)</span>
            </label>
            <Badge variant={manualPaso2 ? 'warning' : 'neutral'} size="sm">
              {manualPaso2 ? 'Modo Manual Activo' : 'Automático'}
            </Badge>
          </div>

          {/* VISTA SEGÚN MODO MANUAL O AUTOMÁTICO */}
          {!manualPaso2 ? (
            state.batidora.iniciado ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-[#D6DEEA]/70">
                <div className="p-3.5 bg-white rounded-xl border border-gray-200 flex flex-col justify-between">
                  <span className="text-[10px] uppercase font-bold text-gray-500">
                    Hora de inicio
                  </span>
                  <span className="text-lg font-black font-mono text-gray-900 mt-1">
                    {state.batidora.horaInicio || '--:--:--'}
                  </span>
                  <span className="text-[11px] text-gray-500">
                    Encendido de la batidora industrial
                  </span>
                </div>

                <div className="p-3.5 bg-white rounded-xl border border-amber-200 flex flex-col justify-between">
                  <span className="text-[10px] uppercase font-bold text-amber-900">
                    Hora de fin
                  </span>
                  <span className="text-lg font-black font-mono text-amber-900 mt-1">
                    {state.batidora.horaFin || '--:--:--'}
                  </span>
                  <span className="text-[11px] text-gray-500">
                    Punto de textura homogénea y cremosa
                  </span>
                </div>

                {/* Tiempo total de batido (Cálculo matemático estricto de solo lectura) */}
                <div className="p-3.5 bg-amber-50/70 rounded-xl border border-amber-300 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-bold text-amber-900">
                      Tiempo total de batido
                    </span>
                    <span className="material-symbols-outlined text-[16px] text-amber-700">
                      lock
                    </span>
                  </div>
                  <span className="text-xl font-black font-mono text-amber-950 mt-1">
                    {state.batidora.tiempoBatido ||
                      (isBatidoRunning ? timerBatido.formattedElapsed : '--')}
                  </span>
                  <span className="text-[11px] text-amber-800 font-semibold">
                    Cálculo estricto: Hora fin - Hora inicio
                  </span>
                </div>
              </div>
            ) : (
              <div className="pt-2 border-t border-[#D6DEEA]/60 text-xs text-[#434655] flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-[#1B4E9B]">
                  info
                </span>
                <span>
                  {isPaso1Listo
                    ? 'Presiona "Iniciar batido" para marcar la hora de inicio y activar el cronómetro.'
                    : llevaAzucar
                    ? 'Primero debes confirmar que la receta está lista en el Paso 1 para poder iniciar el batido.'
                    : 'Primero debes confirmar la adición de stevia en el Paso 1 para poder iniciar el batido.'}
                </span>
              </div>
            )
          ) : (
            /* MODO EDICIÓN MANUAL DEL PASO 2 */
            <div className="p-4 rounded-xl bg-amber-50/90 border-2 border-amber-300 flex flex-col gap-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-start">
                {/* 1. Hora de inicio (EVENTO EDITABLE CON POPOVER) */}
                <PopoverTimePicker
                  label="Hora de inicio"
                  icon="schedule"
                  hint="Toca para desplegar selector flotante (hh:mm:ss a)"
                  value={horaManualInicioBatido}
                  onChange={setHoraManualInicioBatido}
                />

                {/* 2. Hora de fin (EVENTO EDITABLE CON POPOVER) */}
                <PopoverTimePicker
                  label="Hora de fin"
                  icon="schedule"
                  hint="Toca para desplegar selector flotante (hh:mm:ss a)"
                  value={horaManualFinBatido}
                  onChange={setHoraManualFinBatido}
                />

                {/* 3. Tiempo total de batido (DURACIÓN SOLO LECTURA BLOQUEADA) */}
                <InputField
                  label="Tiempo total de batido"
                  icon="timer"
                  type="text"
                  disabled
                  readOnly
                  placeholder="Se calcula automáticamente"
                  hint={`Calculado: ${horaManualInicioBatido} → ${horaManualFinBatido}`}
                  value={duracionBatidoRecalculada.human}
                />
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  variant="primary"
                  size="md"
                  icon="save"
                  onClick={handleSaveManualBatido}
                  className="font-bold shadow-sm"
                >
                  Guardar cambios de batido
                </Button>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* ========================================================================= */}
      {/* TARJETA INFERIOR: AVANZAR A ETAPA FINAL (ENVASADO Y RENDIMIENTO)          */}
      {/* ========================================================================= */}
      <div className="p-4 sm:p-5 rounded-2xl bg-white border border-[#D6DEEA] shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="text-xs sm:text-sm text-[#434655]">
          Cuando el batido esté terminado y la mezcla quede suave y homogénea en tolva, avanza a{' '}
          <strong className="text-[#191C1E]">4. Envasado y Rendimiento</strong>.
        </div>
        {onNextStage && (
          <Button
            variant="primary"
            size="lg"
            iconRight="arrow_forward"
            disabled={!isBatidoCompleted}
            onClick={onNextStage}
            className="w-full sm:w-auto font-bold shadow-md"
          >
            Pasar a Etapa Final: Envasado
          </Button>
        )}
      </div>
    </div>
  );
};
