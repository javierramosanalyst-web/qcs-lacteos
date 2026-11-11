import React, { useState } from 'react';
import { BatchData, MoldesDesglose } from '../../../types';
import {
  StageHeader,
  Card,
  InputField,
  Button,
  Badge,
} from '../../../components/ui';

interface MoldeoStageProps {
  batch: BatchData;
  onUpdateBatch?: (updater: (prev: BatchData) => BatchData) => void;
  onFinalizeProcess?: () => void;
  onOpenReviewModal?: () => void;
  onNextStage?: () => void;
  showToast?: (msg: string, type?: 'success' | 'info' | 'warning') => void;
}

export const MoldeoStage: React.FC<MoldeoStageProps> = ({
  batch,
  onUpdateBatch,
  onOpenReviewModal,
  showToast,
}) => {
  const { acidificar } = batch;
  const totalMilk =
    (Number(acidificar.insumos.lecheFresca) || 0) + (Number(acidificar.insumos.lecheAcida) || 0);

  const moldes: MoldesDesglose = batch.moldesDesglose || {
    moldes100g: 0,
    moldes200g: 0,
    moldes400g: 0,
    moldes800g: 0,
    moldes1600g: 0,
    pesoTotalCalculadoKg: 0,
    esPesoManual: false,
  };

  const m100 = moldes.moldes100g || 0;
  const m200 = moldes.moldes200g || 0;
  const m400 = moldes.moldes400g || 0;
  const m800 = moldes.moldes800g || 0;
  const m1600 = moldes.moldes1600g || 0;

  // Subtotales en gramos
  const gramos100 = m100 * 100;
  const gramos200 = m200 * 200;
  const gramos400 = m400 * 400;
  const gramos800 = m800 * 800;
  const gramos1600 = m1600 * 1600;

  // Subtotales en kilos
  const kilos100 = gramos100 / 1000;
  const kilos200 = gramos200 / 1000;
  const kilos400 = gramos400 / 1000;
  const kilos800 = gramos800 / 1000;
  const kilos1600 = gramos1600 / 1000;

  // Totales calculados matemáticamente sumando todos los moldes
  const totalUnidadesMoldes = m100 + m200 + m400 + m800 + m1600;
  const pesoTotalMoldesGramos =
    gramos100 + gramos200 + gramos400 + gramos800 + gramos1600;
  const pesoTotalMoldesKilos =
    Math.round((pesoTotalMoldesGramos / 1000) * 100) / 100;

  // Peso final oficial para rendimiento (estrictamente la suma de moldes)
  const finalCheeseWeightKg = pesoTotalMoldesKilos;
  const finalCheeseWeightGramos = pesoTotalMoldesGramos;

  // Rendimiento (%) = (Peso Total Real de los Quesos / Litros Totales de Mezcla Inicial) * 100
  const yieldPercentage =
    totalMilk > 0 ? (finalCheeseWeightKg / totalMilk) * 100 : 0;
  const litersPerKg =
    finalCheeseWeightKg > 0 ? totalMilk / finalCheeseWeightKg : 0;

  // Estado de confirmación y bloqueo de moldes
  const [moldesConfirmados, setMoldesConfirmados] = useState<boolean>(() =>
    Boolean(
      batch.moldesDesglose?.confirmado ||
        (batch.hilar.numeroMoldes && batch.hilar.numeroMoldes > 0)
    )
  );

  const updateMoldes = (partial: Partial<MoldesDesglose>) => {
    if (!onUpdateBatch || moldesConfirmados) return;
    onUpdateBatch((prev) => {
      const current: MoldesDesglose = prev.moldesDesglose || {
        moldes100g: 0,
        moldes200g: 0,
        moldes400g: 0,
        moldes800g: 0,
        moldes1600g: 0,
        pesoTotalCalculadoKg: 0,
        esPesoManual: false,
      };
      const updated = { ...current, ...partial };
      const c100 = updated.moldes100g || 0;
      const c200 = updated.moldes200g || 0;
      const c400 = updated.moldes400g || 0;
      const c800 = updated.moldes800g || 0;
      const c1600 = updated.moldes1600g || 0;

      const totalGramos =
        c100 * 100 + c200 * 200 + c400 * 400 + c800 * 800 + c1600 * 1600;
      const calcKg = Math.round((totalGramos / 1000) * 100) / 100;
      const totalCount = c100 + c200 + c400 + c800 + c1600;

      return {
        ...prev,
        moldesDesglose: {
          ...updated,
          pesoTotalCalculadoKg: calcKg,
        },
        hilar: {
          ...prev.hilar,
          pesoTotalQueso: calcKg,
          numeroMoldes: totalCount,
        },
      };
    });
  };

  const handleConfirmarMoldes = () => {
    setMoldesConfirmados(true);
    if (onUpdateBatch) {
      onUpdateBatch((prev) => ({
        ...prev,
        moldesDesglose: {
          ...(prev.moldesDesglose || {
            moldes100g: 0,
            moldes200g: 0,
            moldes400g: 0,
            moldes800g: 0,
            moldes1600g: 0,
            esPesoManual: false,
          }),
          pesoTotalCalculadoKg: pesoTotalMoldesKilos,
          confirmado: true,
        },
        hilar: {
          ...prev.hilar,
          pesoTotalQueso: pesoTotalMoldesKilos,
          numeroMoldes: totalUnidadesMoldes,
        },
      }));
    }
    if (showToast) {
      showToast(
        `✓ Moldes confirmados: ${totalUnidadesMoldes} moldes (${pesoTotalMoldesKilos.toFixed(
          2
        )} kg totalizados)`,
        'success'
      );
    }
  };

  const handleReactivarEdicion = () => {
    setMoldesConfirmados(false);
    if (onUpdateBatch) {
      onUpdateBatch((prev) => ({
        ...prev,
        moldesDesglose: {
          ...(prev.moldesDesglose || {
            moldes100g: 0,
            moldes200g: 0,
            moldes400g: 0,
            moldes800g: 0,
            moldes1600g: 0,
            esPesoManual: false,
          }),
          confirmado: false,
        },
      }));
    }
    if (showToast) {
      showToast('Edición de moldes reactivada', 'info');
    }
  };

  const moldConfigs = [
    {
      key: 'moldes400g' as const,
      label: 'Moldes de 400 g',
      gramsPerUnit: 400,
      kgPerUnit: 0.4,
      count: m400,
      totalGrams: gramos400,
      totalKg: kilos400,
    },
    {
      key: 'moldes1600g' as const,
      label: 'Moldes de 1600 g',
      gramsPerUnit: 1600,
      kgPerUnit: 1.6,
      count: m1600,
      totalGrams: gramos1600,
      totalKg: kilos1600,
    },
    {
      key: 'moldes200g' as const,
      label: 'Moldes de 200 g',
      gramsPerUnit: 200,
      kgPerUnit: 0.2,
      count: m200,
      totalGrams: gramos200,
      totalKg: kilos200,
    },
    {
      key: 'moldes100g' as const,
      label: 'Moldes de 100 g',
      gramsPerUnit: 100,
      kgPerUnit: 0.1,
      count: m100,
      totalGrams: gramos100,
      totalKg: kilos100,
    },
    {
      key: 'moldes800g' as const,
      label: 'Moldes de 800 g',
      gramsPerUnit: 800,
      kgPerUnit: 0.8,
      count: m800,
      totalGrams: gramos800,
      totalKg: kilos800,
    },
  ].sort((a, b) => a.gramsPerUnit - b.gramsPerUnit); // de menor a mayor: 100 → 1600 g

  const isCompleted =
    batch.processTimer.isCompleted || batch.status === 'COMPLETADO';

  return (
    <div className="flex flex-col w-full p-4 lg:p-6 gap-6 bg-[#FFFFFF] min-h-[calc(100vh-4rem)] pb-12">
      <StageHeader
        stageNumber={5}
        totalStages={5}
        title="Pesado, Moldeo y Rendimiento del Queso"
        productName="Queso Doble Crema"
        icon="scale"
        isCompleted={isCompleted}
      />

      {/* =========================================================================
          PASO 01: CONTEO DE MOLDES Y CONFIRMACIÓN
      ========================================================================= */}
      <Card
        title="Paso 1 · Conteo de Moldes Armados por Tamaño"
        icon="grid_view"
        badge={
          moldesConfirmados
            ? `✓ ${totalUnidadesMoldes} Moldes Confirmados`
            : `${totalUnidadesMoldes} Moldes Registrados`
        }
        variant={moldesConfirmados ? 'success' : 'default'}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {moldConfigs.map((item) => (
            <div
              key={item.key}
              className={`p-4 rounded-2xl border transition-all flex flex-col justify-between gap-3 ${
                moldesConfirmados
                  ? 'bg-gray-50/80 border-gray-200'
                  : 'bg-[#FFFFFF] border-[#D6DEEA] shadow-2xs'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-black text-gray-900">
                  {item.label}
                </span>
                <Badge variant={moldesConfirmados ? 'neutral' : 'warning'} size="sm">
                  {item.gramsPerUnit} g ({item.kgPerUnit.toFixed(2)} kg)
                </Badge>
              </div>

              {moldesConfirmados ? (
                <div className="p-3 bg-white rounded-xl border border-gray-200 flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-500">Cantidad:</span>
                  <span className="text-xl font-mono font-black text-gray-900">
                    {item.count} <span className="text-xs font-normal text-gray-500">unidades</span>
                  </span>
                </div>
              ) : (
                <InputField
                  label="Cantidad de Moldes"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="1"
                  unit="unid."
                  placeholder="0"
                  value={item.count > 0 ? item.count : ''}
                  onChange={(e) => {
                    const val = Math.max(0, parseInt(e.target.value, 10) || 0);
                    updateMoldes({ [item.key]: val });
                  }}
                />
              )}

              <div className="pt-3 border-t border-[#D6DEEA] flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500 font-bold">
                    Subtotal en Gramos:
                  </span>
                  <span className="font-mono font-black text-amber-900">
                    {item.totalGrams.toLocaleString('es-CO')} g
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs bg-emerald-50/80 px-3 py-1.5 rounded-lg border border-emerald-200">
                  <span className="text-emerald-800 font-bold">
                    Equivalente en Kilos:
                  </span>
                  <span className="font-mono font-black text-emerald-800 text-sm">
                    {item.totalKg.toFixed(2)} kg
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Tabla Resumen de Conversión Gramos <-> Kilos */}
        <div className="mt-6 rounded-2xl border border-[#D6DEEA] overflow-hidden">
          <div className="bg-[#f5f3ef] px-4 py-3 border-b border-[#D6DEEA] flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-black uppercase tracking-wider text-gray-800">
              Resumen de Moldes Armados
            </span>
            <span className="text-xs font-mono font-black text-amber-900">
              Total: {totalUnidadesMoldes} moldes
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#FFFFFF] border-b border-[#D6DEEA] text-[10px] uppercase text-gray-500 font-bold">
                  <th className="py-2.5 px-4">Tamaño de Molde</th>
                  <th className="py-2.5 px-4">Peso por Molde</th>
                  <th className="py-2.5 px-4 text-center">Unidades</th>
                  <th className="py-2.5 px-4 text-right">Subtotal (Gramos)</th>
                  <th className="py-2.5 px-4 text-right">Subtotal (Kilos)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D6DEEA]/60 bg-white font-medium">
                {moldConfigs.map((m) => (
                  <tr key={m.key} className="hover:bg-amber-50/30">
                    <td className="py-2.5 px-4 font-bold text-gray-900">
                      {m.gramsPerUnit} gramos
                    </td>
                    <td className="py-2.5 px-4 font-mono text-gray-600">
                      {m.kgPerUnit.toFixed(2)} kg / molde
                    </td>
                    <td className="py-2.5 px-4 text-center font-mono font-black text-gray-900">
                      {m.count}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono font-bold text-amber-900">
                      {m.totalGrams.toLocaleString('es-CO')} g
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono font-black text-emerald-700">
                      {m.totalKg.toFixed(2)} kg
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-amber-50/70 border-t-2 border-amber-200 font-black text-sm">
                  <td className="py-3 px-4 text-amber-950" colSpan={2}>
                    TOTAL EN MOLDES
                  </td>
                  <td className="py-3 px-4 text-center font-mono text-amber-950">
                    {totalUnidadesMoldes} moldes
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-amber-900">
                    {pesoTotalMoldesGramos.toLocaleString('es-CO')} g
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-emerald-800">
                    {pesoTotalMoldesKilos.toFixed(2)} kg
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Botón de Confirmación y Bloqueo de Moldes */}
        {!moldesConfirmados ? (
          <div className="mt-5 flex justify-end">
            <Button
              variant="primary"
              size="xl"
              icon="check_circle"
              disabled={totalUnidadesMoldes === 0}
              onClick={handleConfirmarMoldes}
            >
              Confirmar Moldes ({totalUnidadesMoldes} unidades ·{' '}
              {pesoTotalMoldesKilos.toFixed(2)} kg)
            </Button>
          </div>
        ) : (
          <div className="mt-5 p-4 rounded-2xl bg-emerald-50 border-2 border-emerald-400 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-emerald-700 text-[26px]">
                verified
              </span>
              <div>
                <div className="text-xs font-black text-emerald-950">
                  ✓ Moldes Confirmados ({totalUnidadesMoldes} unidades ·{' '}
                  {pesoTotalMoldesKilos.toFixed(2)} kg)
                </div>
                <div className="text-[11px] text-emerald-800">
                  Los kilos producidos han sido totalizados y transferidos al rendimiento del lote.
                </div>
              </div>
            </div>
            <Button
              variant="outline"
              size="md"
              icon="edit"
              onClick={handleReactivarEdicion}
              className="bg-white border-emerald-400 text-emerald-900 hover:bg-emerald-100"
            >
              Modificar Moldes
            </Button>
          </div>
        )}
      </Card>

      {/* =========================================================================
          PASO 02: CÁLCULO DE RENDIMIENTO INQUEBRANTABLE (SOLO LECTURA)
      ========================================================================= */}
      <Card
        title={`Paso 2 · Rendimiento del Lote (${totalMilk} L de mezcla inicial)`}
        subtitle="Cálculo matemático automático: Rendimiento (%) = (Peso Total Real de los Quesos / Litros Totales de Mezcla Inicial) * 100."
        icon="analytics"
        badge={`Rendimiento: ${yieldPercentage.toFixed(2)} %`}
        variant="success"
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* 1. Peso Total Real de los Quesos */}
          <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200 flex flex-col justify-between">
            <span className="text-[10px] font-bold uppercase text-emerald-800">
              Peso Total Real de los Quesos
            </span>
            <div className="mt-2">
              <div className="text-2xl font-black font-mono text-emerald-900">
                {finalCheeseWeightKg.toFixed(2)} kg
              </div>
              <div className="text-xs font-mono font-bold text-emerald-700 mt-0.5">
                Equivalente a {finalCheeseWeightGramos.toLocaleString('es-CO')}{' '}
                gramos en {totalUnidadesMoldes} moldes
              </div>
            </div>
            <span className="text-[10px] text-gray-500 font-medium mt-2">
              Calculado estrictamente sumando los moldes
            </span>
          </div>

          {/* 2. Rendimiento del Lote (%) */}
          <div className="p-4 rounded-xl bg-[#FFFFFF] border border-[#D6DEEA] flex flex-col justify-between">
            <span className="text-[10px] font-bold uppercase text-gray-500">
              Rendimiento del Lote (%)
            </span>
            <div className="mt-2">
              <div className="text-2xl font-black font-mono text-amber-900">
                {yieldPercentage.toFixed(2)} %
              </div>
              <div className="text-[11px] font-semibold text-gray-600 mt-0.5 font-mono">
                ({finalCheeseWeightKg.toFixed(2)} kg / {totalMilk} L) × 100
              </div>
            </div>
            <span className="text-[10px] text-gray-500 font-medium mt-2">
              Meta óptima esperada: 10.2 % – 11.0 %
            </span>
          </div>

          {/* 3. Litros de Leche por 1 Kilo de Queso */}
          <div className="p-4 rounded-xl bg-[#FFFFFF] border border-[#D6DEEA] flex flex-col justify-between">
            <span className="text-[10px] font-bold uppercase text-gray-500">
              Litros de Leche por 1 Kilo de Queso
            </span>
            <div className="mt-2">
              <div className="text-2xl font-black font-mono text-gray-900">
                {litersPerKg.toFixed(2)} L / kg
              </div>
              <div className="text-[11px] font-semibold text-gray-600 mt-0.5 font-mono">
                {totalMilk} L / {finalCheeseWeightKg.toFixed(2)} kg
              </div>
            </div>
            <span className="text-[10px] text-gray-500 font-medium mt-2">
              Litros de leche necesarios para 1 kg de queso
            </span>
          </div>
        </div>
      </Card>

      {/* =========================================================================
          BARRA INFERIOR ESTANDARIZADA (FOOTER UNIFICADO)
      ========================================================================= */}
      <div className="p-6 rounded-3xl bg-white border border-[#D6DEEA] shadow-md flex flex-col sm:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-[#1B4E9B]/10 text-[#1B4E9B] border border-[#1B4E9B]/20 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[32px]">task_alt</span>
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={isCompleted ? 'success' : 'warning'} size="sm">
                {isCompleted ? '✓ Lote Terminado' : 'Etapa Final: Moldeo'}
              </Badge>
              <span className="text-xs font-mono font-bold text-gray-600 bg-gray-100 px-2.5 py-0.5 rounded-lg border border-gray-200">
                Tiempo de Producción:{' '}
                {batch.hilar.procesoFinalizado?.tiempoTotalProceso ||
                  batch.processTimer.formattedTime ||
                  '00:00:00'}
              </span>
            </div>
            <h3 className="text-lg sm:text-xl font-black text-gray-900 mt-1">
              Cierre y Entrega del Lote
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Total producido: <strong>{pesoTotalMoldesKilos.toFixed(2)} kg</strong>{' '}
              en <strong>{totalUnidadesMoldes} moldes</strong> · Rendimiento:{' '}
              <strong>{yieldPercentage.toFixed(2)} %</strong>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto shrink-0 justify-end">
          <Button
            variant="outline"
            size="lg"
            icon="description"
            onClick={() => {
              if (onOpenReviewModal) onOpenReviewModal();
            }}
          >
            Ver Resumen
          </Button>

          <Button
            variant="primary"
            size="xl"
            icon="verified"
            disabled={!moldesConfirmados || totalUnidadesMoldes === 0}
            onClick={() => {
              if (onOpenReviewModal) onOpenReviewModal();
            }}
          >
            Terminar Lote
          </Button>
        </div>
      </div>
    </div>
  );
};
