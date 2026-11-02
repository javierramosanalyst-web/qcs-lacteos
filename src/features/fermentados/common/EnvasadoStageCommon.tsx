import React, { useState, useMemo, useEffect } from 'react';
import {
  StageHeader,
  Card,
  InputField,
  PopoverTimePicker,
  Button,
  Badge,
} from '../../../components/ui';
import { YogurBatchData, EnvasadoYAlmacenamientoYogurState } from '../../../types/yogur';
import { KumisBatchData, EnvasadoYAlmacenamientoKumisState } from '../../../types/kumis';
import { getCurrentTimeString } from '../../../utils/timer';

export interface FormatConfig {
  key: string;
  label: string;
  volumenTexto: string;
  litrosPorUnidad: number;
  placeholder: string;
}

// Presentaciones Con Azúcar (Línea Tradicional)
export const FORMAT_CONFIGS_YOGUR_CON_AZUCAR: FormatConfig[] = [
  {
    key: 'botella200ml',
    label: 'Botella de 200 ml',
    volumenTexto: '200 ml (0.2 L)',
    litrosPorUnidad: 0.2,
    placeholder: 'Ej: 100',
  },
  {
    key: 'botella1L',
    label: 'Botella de 1 L',
    volumenTexto: '1 Litro',
    litrosPorUnidad: 1.0,
    placeholder: 'Ej: 40',
  },
  {
    key: 'botella2L',
    label: 'Botella de 2 L',
    volumenTexto: '2 Litros',
    litrosPorUnidad: 2.0,
    placeholder: 'Ej: 15',
  },
  {
    key: 'bolsa4L',
    label: 'Bolsa de 4 L',
    volumenTexto: '4 Litros',
    litrosPorUnidad: 4.0,
    placeholder: 'Ej: 5',
  },
];

export const FORMAT_CONFIGS_KUMIS_CON_AZUCAR: FormatConfig[] = [
  {
    key: 'botella1L',
    label: 'Botella de 1 L',
    volumenTexto: '1 Litro',
    litrosPorUnidad: 1.0,
    placeholder: 'Ej: 60',
  },
  {
    key: 'botella2L',
    label: 'Botella de 2 L',
    volumenTexto: '2 Litros',
    litrosPorUnidad: 2.0,
    placeholder: 'Ej: 20',
  },
];

// Categoría 1: Envases "Sin Azúcar" (Natural) - 4 campos estrictos
export const FORMAT_CONFIGS_SIN_AZUCAR_NATURAL: FormatConfig[] = [
  {
    key: 'sinAzucar_botella200ml',
    label: 'Botella de 200 ml (Sin Azúcar)',
    volumenTexto: '200 ml (0.2 L)',
    litrosPorUnidad: 0.2,
    placeholder: 'Ej: 50',
  },
  {
    key: 'sinAzucar_botella1L',
    label: 'Botella de 1 L (Sin Azúcar)',
    volumenTexto: '1 Litro',
    litrosPorUnidad: 1.0,
    placeholder: 'Ej: 30',
  },
  {
    key: 'sinAzucar_botella2L',
    label: 'Botella de 2 L (Sin Azúcar)',
    volumenTexto: '2 Litros',
    litrosPorUnidad: 2.0,
    placeholder: 'Ej: 15',
  },
  {
    key: 'sinAzucar_bolsa4L',
    label: 'Bolsa de 4 L (Sin Azúcar)',
    volumenTexto: '4 Litros',
    litrosPorUnidad: 4.0,
    placeholder: 'Ej: 5',
  },
];

// Categoría 2: Envases "Con Stevia" - 5 campos estrictos
export const FORMAT_CONFIGS_CON_STEVIA: FormatConfig[] = [
  {
    key: 'stevia_botella120ml',
    label: 'Botella de 120 ml (Stevia)',
    volumenTexto: '120 ml (0.12 L)',
    litrosPorUnidad: 0.12,
    placeholder: 'Ej: 50',
  },
  {
    key: 'stevia_botella200ml',
    label: 'Botella de 200 ml (Stevia)',
    volumenTexto: '200 ml (0.2 L)',
    litrosPorUnidad: 0.2,
    placeholder: 'Ej: 50',
  },
  {
    key: 'stevia_botella1L',
    label: 'Botella de 1 L (Stevia)',
    volumenTexto: '1 Litro',
    litrosPorUnidad: 1.0,
    placeholder: 'Ej: 30',
  },
  {
    key: 'stevia_botella2L',
    label: 'Botella de 2 L (Stevia)',
    volumenTexto: '2 Litros',
    litrosPorUnidad: 2.0,
    placeholder: 'Ej: 15',
  },
  {
    key: 'stevia_bolsa4L',
    label: 'Bolsa de 4 L (Stevia)',
    volumenTexto: '4 Litros',
    litrosPorUnidad: 4.0,
    placeholder: 'Ej: 5',
  },
];

export const ALL_FORMAT_CONFIGS_SIN_AZUCAR: FormatConfig[] = [
  ...FORMAT_CONFIGS_SIN_AZUCAR_NATURAL,
  ...FORMAT_CONFIGS_CON_STEVIA,
];

export const FORMAT_CONFIGS_YOGUR = FORMAT_CONFIGS_YOGUR_CON_AZUCAR;
export const FORMAT_CONFIGS_KUMIS = FORMAT_CONFIGS_KUMIS_CON_AZUCAR;
export const FORMAT_CONFIGS_YOGUR_SIN_AZUCAR = ALL_FORMAT_CONFIGS_SIN_AZUCAR;
export const FORMAT_CONFIGS_KUMIS_SIN_AZUCAR = ALL_FORMAT_CONFIGS_SIN_AZUCAR;

export interface EnvasadoStageCommonProps {
  productType: 'yogur' | 'kumis';
  batch: YogurBatchData | KumisBatchData;
  llevaAzucar?: boolean;
  onChange: (
    updater: (
      prev: EnvasadoYAlmacenamientoYogurState | EnvasadoYAlmacenamientoKumisState
    ) => EnvasadoYAlmacenamientoYogurState | EnvasadoYAlmacenamientoKumisState
  ) => void;
  onFinalizeProcess: () => void;
  onOpenReviewModal: () => void;
  showToast: (msg: string, type?: 'success' | 'info' | 'warning') => void;
}

export const EnvasadoStageCommon: React.FC<EnvasadoStageCommonProps> = ({
  productType,
  batch,
  llevaAzucar,
  onChange,
  onOpenReviewModal,
  showToast,
}) => {
  const isYogur = productType === 'yogur';
  const isKumis = productType === 'kumis';
  const state = batch.envasado;
  const pasteurizacion = (batch as any).pasteurizacion || {};

  // Desviaciones a sub-lotes
  const extraccionKumisLitros = pasteurizacion.extraccionKumis?.realizado
    ? Number(pasteurizacion.extraccionKumis.litrosExtraidos) || 0
    : 0;
  const extraccionGriegoLitros = pasteurizacion.extraccionGriego?.realizado
    ? Number(pasteurizacion.extraccionGriego.litrosExtraidos) || 0
    : 0;
  const totalDesviadoSublotes = extraccionKumisLitros + extraccionGriegoLitros;

  // Volumen Base Neto para este sub-lote específico:
  // - Para Kumis: volumen desviado para Kumis (pasteurizacion.litrosLeche)
  // - Para Yogur: volumen remanente (pasteurizacion.litrosLeche ya recalculado)
  const lecheBaseLitros = Number(pasteurizacion.litrosLeche ?? 0);

  // Lógica condicional: Con Azúcar vs Sin Azúcar (Stevia)
  // Regla estricta Kumis: Kumis maneja exclusivamente Botella de 1 L y Botella de 2 L
  const isConAzucar = isKumis
    ? true
    : llevaAzucar !== undefined
    ? llevaAzucar
    : pasteurizacion.llevaAzucar !== undefined
    ? pasteurizacion.llevaAzucar
    : true;

  const allActiveConfigs = useMemo(() => {
    if (isKumis) {
      return FORMAT_CONFIGS_KUMIS_CON_AZUCAR;
    }
    if (isConAzucar) {
      return FORMAT_CONFIGS_YOGUR_CON_AZUCAR;
    }
    return ALL_FORMAT_CONFIGS_SIN_AZUCAR;
  }, [isConAzucar, isKumis]);

  // =========================================================================
  // PASO 01: CONTEO DE ENVASES Y EDICIÓN MANUAL
  // =========================================================================
  const [cantidades, setCantidades] = useState<{ [key: string]: number | '' }>(() => {
    const initial: { [key: string]: number | '' } = {};
    const configs = isConAzucar
      ? isYogur
        ? FORMAT_CONFIGS_YOGUR_CON_AZUCAR
        : FORMAT_CONFIGS_KUMIS_CON_AZUCAR
      : ALL_FORMAT_CONFIGS_SIN_AZUCAR;

    configs.forEach((fmt) => {
      const existingVal = (state.formatos as any)?.[fmt.key];
      initial[fmt.key] = existingVal && existingVal > 0 ? existingVal : '';
    });
    return initial;
  });

  // Mantener sincronizado si cambian configs o state.formatos
  useEffect(() => {
    setCantidades((prev) => {
      let hasChanges = false;
      const next = { ...prev };
      allActiveConfigs.forEach((fmt) => {
        if (next[fmt.key] === undefined) {
          const existingVal = (state.formatos as any)?.[fmt.key];
          next[fmt.key] = existingVal && existingVal > 0 ? existingVal : '';
          hasChanges = true;
        }
      });
      return hasChanges ? next : prev;
    });
  }, [allActiveConfigs, state.formatos]);

  const hasInitialSaved = useMemo(() => {
    return Object.values(cantidades).some((v) => typeof v === 'number' && v > 0);
  }, [cantidades]);

  const [isManualFormatos, setIsManualFormatos] = useState<boolean>(false);
  const [isFormatosBloqueados, setIsFormatosBloqueados] = useState<boolean>(() => {
    return hasInitialSaved;
  });

  const handleFormatChange = (key: string, valStr: string) => {
    const val = valStr === '' ? '' : Math.max(0, parseInt(valStr, 10) || 0);
    setCantidades((prev) => ({
      ...prev,
      [key]: val,
    }));
  };

  const handleGuardarFormatos = () => {
    const updatedFormatos: { [key: string]: number } = {};
    allActiveConfigs.forEach((fmt) => {
      const v = cantidades[fmt.key];
      updatedFormatos[fmt.key] = typeof v === 'number' ? v : 0;
    });

    onChange((prev: any) => ({
      ...prev,
      formatos: {
        ...(prev.formatos || {}),
        ...updatedFormatos,
      },
    }));

    setIsFormatosBloqueados(true);
    setIsManualFormatos(false);
    showToast('✓ Conteo de envases guardado exitosamente. Todos los inputs bloqueados.', 'success');
  };

  // Subtotales Categoría 1: Sin Azúcar (Natural)
  const subtotalUnidadesSinAzucar = useMemo(() => {
    return FORMAT_CONFIGS_SIN_AZUCAR_NATURAL.reduce((acc, fmt) => {
      const count = typeof cantidades[fmt.key] === 'number' ? (cantidades[fmt.key] as number) : 0;
      return acc + count;
    }, 0);
  }, [cantidades]);

  const subtotalLitrosSinAzucar = useMemo(() => {
    const sum = FORMAT_CONFIGS_SIN_AZUCAR_NATURAL.reduce((acc, fmt) => {
      const count = typeof cantidades[fmt.key] === 'number' ? (cantidades[fmt.key] as number) : 0;
      return acc + count * fmt.litrosPorUnidad;
    }, 0);
    return Number(sum.toFixed(2));
  }, [cantidades]);

  // Subtotales Categoría 2: Con Stevia
  const subtotalUnidadesStevia = useMemo(() => {
    return FORMAT_CONFIGS_CON_STEVIA.reduce((acc, fmt) => {
      const count = typeof cantidades[fmt.key] === 'number' ? (cantidades[fmt.key] as number) : 0;
      return acc + count;
    }, 0);
  }, [cantidades]);

  const subtotalLitrosStevia = useMemo(() => {
    const sum = FORMAT_CONFIGS_CON_STEVIA.reduce((acc, fmt) => {
      const count = typeof cantidades[fmt.key] === 'number' ? (cantidades[fmt.key] as number) : 0;
      return acc + count * fmt.litrosPorUnidad;
    }, 0);
    return Number(sum.toFixed(2));
  }, [cantidades]);

  // Totales y cálculos matemáticos (sumando absolutamente TODOS los envases de ambas categorías)
  const totalUnidades = useMemo(() => {
    return allActiveConfigs.reduce((acc, fmt) => {
      const count = typeof cantidades[fmt.key] === 'number' ? (cantidades[fmt.key] as number) : 0;
      return acc + count;
    }, 0);
  }, [allActiveConfigs, cantidades]);

  const totalLitrosEnvasados = useMemo(() => {
    const sum = allActiveConfigs.reduce((acc, fmt) => {
      const count = typeof cantidades[fmt.key] === 'number' ? (cantidades[fmt.key] as number) : 0;
      return acc + count * fmt.litrosPorUnidad;
    }, 0);
    return Number(sum.toFixed(2));
  }, [allActiveConfigs, cantidades]);

  const rendimientoPct = useMemo(() => {
    return lecheBaseLitros > 0 ? (totalLitrosEnvasados / lecheBaseLitros) * 100 : 0;
  }, [totalLitrosEnvasados, lecheBaseLitros]);

  const mermaLitros = useMemo(() => {
    return Math.max(0, Number((lecheBaseLitros - totalLitrosEnvasados).toFixed(2)));
  }, [lecheBaseLitros, totalLitrosEnvasados]);

  // =========================================================================
  // PASO 03: ENTRADA A CUARTO FRÍO (SIMPLIFICACIÓN EXTREMA: SOLO TIEMPO)
  // =========================================================================
  const isIngresadoCuartoFrio = Boolean(state.almacenamientoCuartoFrio?.ingresado);
  const [manualPaso3, setManualPaso3] = useState<boolean>(false);
  const [horaManualIngreso, setHoraManualIngreso] = useState<string>(
    state.almacenamientoCuartoFrio?.horaIngreso || getCurrentTimeString()
  );

  useEffect(() => {
    if (!manualPaso3 && state.almacenamientoCuartoFrio?.horaIngreso) {
      setHoraManualIngreso(state.almacenamientoCuartoFrio.horaIngreso);
    }
  }, [manualPaso3, state.almacenamientoCuartoFrio?.horaIngreso]);

  const handleIngresoCuartoFrioFinal = () => {
    const timeStr = getCurrentTimeString();
    onChange((prev: any) => ({
      ...prev,
      almacenamientoCuartoFrio: {
        ...prev.almacenamientoCuartoFrio,
        ingresado: true,
        horaIngreso: timeStr,
      },
    }));
    showToast(
      `✓ ¡Producto ingresado al cuarto frío! Hora registrada: ${timeStr}.`,
      'success'
    );
  };

  const handleSaveManualIngreso = () => {
    onChange((prev: any) => ({
      ...prev,
      almacenamientoCuartoFrio: {
        ...prev.almacenamientoCuartoFrio,
        ingresado: true,
        horaIngreso: horaManualIngreso,
      },
    }));
    showToast(
      `✓ Hora de ingreso a cuarto frío actualizada a ${horaManualIngreso}.`,
      'success'
    );
  };

  const areInputsLocked = isFormatosBloqueados && !isManualFormatos;

  const renderFormatCard = (fmt: FormatConfig) => {
    const countVal = cantidades[fmt.key];
    const subtotalLitros =
      (typeof countVal === 'number' ? countVal : 0) * fmt.litrosPorUnidad;

    return (
      <div
        key={fmt.key}
        className={`p-3.5 sm:p-4 rounded-2xl border flex flex-col justify-between gap-3 transition-colors ${
          areInputsLocked
            ? 'bg-[#f8f5ee] border-[#D6DEEA]'
            : 'bg-white border-[#d6ccb8] shadow-2xs'
        }`}
      >
        <div>
          <div className="flex items-center justify-between mb-2 gap-1.5">
            <span className="text-xs font-black text-[#191C1E] leading-tight">
              {fmt.label}
            </span>
            <Badge variant="neutral" className="shrink-0">{fmt.volumenTexto}</Badge>
          </div>

          <InputField
            label="Unidades Llenadas"
            type="number"
            min="0"
            step="1"
            unit="unid."
            disabled={areInputsLocked}
            readOnly={areInputsLocked}
            placeholder={fmt.placeholder}
            value={countVal === '' ? '' : countVal}
            onChange={(e) => handleFormatChange(fmt.key, e.target.value)}
          />
        </div>

        <div className="pt-2.5 border-t border-[#efe9dc] flex items-center justify-between text-xs">
          <span className="text-[#4A5263] font-bold">Subtotal Litros:</span>
          <span className="font-mono font-black text-amber-900 text-sm">
            {subtotalLitros.toFixed(2)} L
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col w-full p-4 lg:p-6 gap-5 bg-[#FFFFFF] min-h-[calc(100vh-4rem)] pb-16">
      {/* CABECERA ESTÁNDAR MAESTRA */}
      <StageHeader
        stageNumber={isKumis ? 3 : 4}
        totalStages={isKumis ? 3 : 4}
        lineName={
          isYogur
            ? `Línea de Fermentados · Yogur (${isConAzucar ? 'Con Azúcar' : 'Sin Azúcar - Stevia'})`
            : 'Línea de Fermentados · Kumis Tradicional'
        }
        title={isKumis ? '3. Envasar y Guardar' : '4. Envasar y Guardar'}
        subtitle={
          isConAzucar
            ? 'Conteo de envases por presentación comercial, balance y rendimiento del lote, y traslado final a cuarto frío.'
            : 'Conteo de envases de la línea Sin Azúcar (Stevia), balance, rendimiento del lote y traslado final a cuarto frío.'
        }
        standardBadge="NTC-805"
        metrics={[
          {
            icon: 'inventory_2',
            label: 'Total Envasado',
            value: `${totalLitrosEnvasados.toFixed(1)} L (${totalUnidades} u.)`,
            tone: 'amber',
          },
          {
            icon: 'verified',
            label: 'Rendimiento',
            value: `${rendimientoPct.toFixed(1)} %`,
            tone: 'emerald',
          },
        ]}
      />

      {/* ========================================================================= */}
      {/* PASO 01: CONTEO DE ENVASES Y RENDIMIENTO CON EDICIÓN MANUAL Y GUARDAR     */}
      {/* ========================================================================= */}
      <Card
        stepBadge="Paso 01"
        title={
          isConAzucar
            ? 'Conteo de Envases y Presentaciones'
            : 'Conteo de Envases y Presentaciones (Sin Azúcar / Stevia)'
        }
        subtitle={
          isConAzucar
            ? 'Ingresa la cantidad de unidades obtenidas en cada presentación comercial producida.'
            : 'Ingresa la cantidad de unidades obtenidas en cada categoría de empaque (Natural y Stevia).'
        }
        icon="format_list_numbered"
        tone={hasInitialSaved ? 'completed' : 'default'}
        statusBadge={{
          label: `${totalUnidades} unidades · ${totalLitrosEnvasados.toFixed(2)} L totales`,
          variant: totalUnidades > 0 ? 'success' : 'info',
        }}
        headerAction={
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-semibold text-[#4A5263] bg-[#F2F4F7] px-3 py-1.5 rounded-lg border border-[#D6DEEA] hover:bg-[#E6ECF5] transition-colors">
              <input
                type="checkbox"
                checked={isManualFormatos}
                onChange={(e) => setIsManualFormatos(e.target.checked)}
                className="rounded border-[#C5D0E0] text-[#191C1E] focus:ring-amber-500 w-4 h-4 cursor-pointer"
              />
              <span>Habilitar edición manual</span>
            </label>

            {/* Botón de Guardar para bloquear inputs tras edición manual */}
            <Button
              variant={areInputsLocked ? 'secondary' : 'primary'}
              size="md"
              icon={areInputsLocked ? 'lock' : 'save'}
              onClick={handleGuardarFormatos}
              disabled={areInputsLocked}
              className="font-bold shadow-2xs"
            >
              {areInputsLocked ? '✓ Guardado y Bloqueado' : 'Guardar'}
            </Button>
          </div>
        }
      >
        {!isConAzucar ? (
          <div className="flex flex-col gap-6">
            {/* ========================================================================= */}
            {/* CATEGORÍA 1: ENVASES "SIN AZÚCAR" (NATURAL) - 4 CAMPOS                    */}
            {/* ========================================================================= */}
            <div className="p-4 sm:p-5 rounded-2xl bg-[#F7F9FC] border-2 border-[#D6DEEA] shadow-2xs flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[#D6DEEA] gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center text-amber-900 shrink-0">
                    <span className="material-symbols-outlined text-[20px]">water_drop</span>
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-[#191C1E] flex items-center gap-2">
                      Categoría 1: Envases "Sin Azúcar" (Natural)
                      <Badge variant="neutral">4 medidas</Badge>
                    </h4>
                    <p className="text-[11px] text-[#6B7280]">
                      Base de yogur natural envasada sin ningún endulzante ni edulcorante.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant={subtotalUnidadesSinAzucar > 0 ? 'success' : 'neutral'}>
                    Subtotal: {subtotalUnidadesSinAzucar} u. · {subtotalLitrosSinAzucar.toFixed(2)} L
                  </Badge>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                {FORMAT_CONFIGS_SIN_AZUCAR_NATURAL.map((fmt) => renderFormatCard(fmt))}
              </div>
            </div>

            {/* ========================================================================= */}
            {/* CATEGORÍA 2: ENVASES "CON STEVIA" - 5 CAMPOS                              */}
            {/* ========================================================================= */}
            <div className="p-4 sm:p-5 rounded-2xl bg-emerald-50/40 border-2 border-emerald-200/90 shadow-2xs flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-emerald-200 gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-900 shrink-0">
                    <span className="material-symbols-outlined text-[20px]">eco</span>
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-emerald-950 flex items-center gap-2">
                      Categoría 2: Envases "Con Stevia"
                      <Badge variant="success">5 medidas</Badge>
                    </h4>
                    <p className="text-[11px] text-emerald-800">
                      Base endulzada con estevia. Incluye el envase exclusivo de 120 ml.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant={subtotalUnidadesStevia > 0 ? 'success' : 'neutral'}>
                    Subtotal: {subtotalUnidadesStevia} u. · {subtotalLitrosStevia.toFixed(2)} L
                  </Badge>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3.5">
                {FORMAT_CONFIGS_CON_STEVIA.map((fmt) => renderFormatCard(fmt))}
              </div>
            </div>
          </div>
        ) : (
          <div
            className={`grid gap-4 ${
              allActiveConfigs.length === 4
                ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
                : 'grid-cols-1 sm:grid-cols-2'
            }`}
          >
            {allActiveConfigs.map((fmt) => renderFormatCard(fmt))}
          </div>
        )}
      </Card>

      {/* ========================================================================= */}
      {/* PASO 02: BALANCE DEL LOTE (RESUMEN Y RENDIMIENTO)                         */}
      {/* ========================================================================= */}
      <Card
        stepBadge="Paso 02"
        title="Balance del Lote y Rendimiento"
        subtitle={
          isKumis
            ? 'Cálculo de rendimiento y balance calculado estrictamente sobre el volumen desviado para Kumis.'
            : totalDesviadoSublotes > 0
            ? `Cálculo de rendimiento sobre el volumen neto remanente (${lecheBaseLitros} L) tras desviar ${totalDesviadoSublotes} L a sub-lotes.`
            : 'Comparación entre la leche base inicial y el volumen envasado para determinar la merma del proceso.'
        }
        icon="scale"
        tone="default"
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-[#FFFFFF] border border-[#D6DEEA]">
            <span className="text-[11px] font-bold uppercase text-[#4A5263]">
              {isKumis
                ? 'Volumen Base Extraído (Kumis)'
                : totalDesviadoSublotes > 0
                ? 'Volumen Neto Remanente (Yogur)'
                : 'Leche Base del Lote'}
            </span>
            <div className="text-2xl font-black font-mono text-[#191C1E] mt-1">
              {lecheBaseLitros} L
            </div>
            <span className="text-[11px] text-[#6B7280] mt-1 block">
              {isKumis
                ? 'Volumen desviado exclusivamente para Kumis'
                : totalDesviadoSublotes > 0
                ? `Remanente tras desviar ${totalDesviadoSublotes} L a sub-lotes`
                : 'Litros procesados desde Etapa 1'}
            </span>
          </div>

          <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200">
            <span className="text-[11px] font-bold uppercase text-amber-900">
              Total Litros Envasados
            </span>
            <div className="text-2xl font-black font-mono text-amber-950 mt-1">
              {totalLitrosEnvasados.toFixed(2)} L
            </div>
            <span className="text-[11px] text-amber-800 mt-1 block">
              {!isConAzucar
                ? `Sin Azúcar (${subtotalLitrosSinAzucar.toFixed(1)} L) + Stevia (${subtotalLitrosStevia.toFixed(1)} L)`
                : `Suma de todas las presentaciones (${totalUnidades} u.)`}
            </span>
          </div>

          <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200">
            <span className="text-[11px] font-bold uppercase text-emerald-900">
              Rendimiento del Lote
            </span>
            <div className="text-2xl font-black font-mono text-emerald-800 mt-1">
              {rendimientoPct.toFixed(1)} %
            </div>
            <span className="text-[11px] text-emerald-700 mt-1 block">
              Merma normal de proceso: {mermaLitros.toFixed(2)} L
            </span>
          </div>
        </div>
      </Card>

      {/* ========================================================================= */}
      {/* PASO 03: ENTRADA A CUARTO FRÍO (SIN NINGÚN CAMPO NI LABEL DE TEMPERATURA) */}
      {/* ========================================================================= */}
      <Card
        stepBadge="Paso 03"
        title="Entrada a Cuarto Frío"
        subtitle="Registra el traslado de los envases terminados y sellados al cuarto frío para su estabilización."
        icon="kitchen"
        tone={isIngresadoCuartoFrio ? 'completed' : 'default'}
        statusBadge={
          isIngresadoCuartoFrio
            ? {
                label: `En Cuarto Frío (${state.almacenamientoCuartoFrio?.horaIngreso || 'Listo'}) ✓`,
                variant: 'success',
              }
            : { label: 'Por ingresar', variant: 'info' }
        }
        headerAction={
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-semibold text-[#4A5263] bg-[#F2F4F7] px-3 py-1.5 rounded-lg border border-[#D6DEEA] hover:bg-[#E6ECF5] transition-colors">
              <input
                type="checkbox"
                checked={manualPaso3}
                onChange={(e) => setManualPaso3(e.target.checked)}
                className="rounded border-[#C5D0E0] text-[#191C1E] focus:ring-amber-500 w-4 h-4 cursor-pointer"
              />
              <span>Habilitar edición manual</span>
            </label>

            {/* Botón único de confirmación tipo "¡Producto ingresado al cuarto frío!" */}
            <Button
              variant={isIngresadoCuartoFrio ? 'secondary' : 'primary'}
              size="md"
              icon="kitchen"
              onClick={handleIngresoCuartoFrioFinal}
              className={
                isIngresadoCuartoFrio
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300 font-bold'
                  : 'font-bold shadow-sm'
              }
            >
              {isIngresadoCuartoFrio
                ? `✓ ¡Producto ingresado al cuarto frío! (${state.almacenamientoCuartoFrio?.horaIngreso || 'OK'})`
                : '¡Producto ingresado al cuarto frío!'}
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          {manualPaso3 ? (
            <div className="p-4 rounded-xl bg-amber-50/90 border-2 border-amber-300 flex flex-col sm:flex-row items-end gap-3 justify-between">
              <div className="w-full sm:max-w-xs">
                <PopoverTimePicker
                  label="Hora de ingreso al cuarto frío"
                  icon="schedule"
                  hint="Toca para desplegar selector flotante (hh:mm:ss a)"
                  value={horaManualIngreso}
                  onChange={setHoraManualIngreso}
                />
              </div>
              <Button
                variant="secondary"
                size="md"
                icon="save"
                onClick={handleSaveManualIngreso}
                className="w-full sm:w-auto font-bold"
              >
                Guardar Hora de Ingreso
              </Button>
            </div>
          ) : (
            <div className="p-3.5 bg-[#FFFFFF] rounded-xl border border-[#D6DEEA] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-[24px] text-emerald-600">
                  {isIngresadoCuartoFrio ? 'check_circle' : 'info'}
                </span>
                <span className="text-xs text-[#4A5263]">
                  {isIngresadoCuartoFrio
                    ? `Los envases terminados se encuentran en cuarto frío desde las ${state.almacenamientoCuartoFrio?.horaIngreso}.`
                    : 'Pulsa el botón de confirmación cuando todos los envases sellados hayan sido trasladados al cuarto frío.'}
                </span>
              </div>
              {isIngresadoCuartoFrio && (
                <span className="font-mono font-black text-emerald-800 text-sm">
                  {state.almacenamientoCuartoFrio?.horaIngreso}
                </span>
              )}
            </div>
          )}
        </div>
      </Card>

      {/* ========================================================================= */}
      {/* BARRA INFERIOR (FOOTER): VER RESUMEN + TERMINAR LOTE                     */}
      {/* ========================================================================= */}
      <div className="p-4 sm:p-5 rounded-2xl bg-white border border-[#D6DEEA] shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-800 shrink-0">
            <span className="material-symbols-outlined text-[24px]">verified</span>
          </div>
          <div className="text-xs sm:text-sm text-[#434655]">
            <p className="font-bold text-[#191C1E]">
              Cierre de Lote y Rendimiento Final
            </p>
            <p>
              Total envasado: <strong>{totalLitrosEnvasados.toFixed(2)} L</strong> ({totalUnidades} unidades) · Rendimiento: <strong>{rendimientoPct.toFixed(1)} %</strong>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto shrink-0 justify-end">
          {/* Botón Secundario: Ver resumen */}
          <Button
            variant="outline"
            size="lg"
            icon="description"
            onClick={onOpenReviewModal}
            className="font-bold"
          >
            Ver resumen
          </Button>

          {/* Botón Principal: Terminar lote */}
          <Button
            variant="primary"
            size="xl"
            icon="verified"
            disabled={totalUnidades === 0}
            onClick={onOpenReviewModal}
            className="font-bold shadow-md"
          >
            Terminar lote
          </Button>
        </div>
      </div>
    </div>
  );
};
