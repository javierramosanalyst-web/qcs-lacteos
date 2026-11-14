import React, { useState } from 'react';
import { BatchData, MoldesDesglose } from '../../../types';
import { DerivacionesPastaResultante } from '../../../components/shared/DerivacionesPastaResultante';
import {
  StageHeader,
  Card,
  InputField,
  Button,
  Badge,
} from '../../../components/ui';
import { loteVisible } from '../../../utils/lote';

interface MoldeoStagePeraProps {
  batch: BatchData;
  onUpdateBatch?: (updater: (prev: BatchData) => BatchData) => void;
  onFinalizeProcess?: () => void;
  onOpenReviewModal?: () => void;
  onNextStage?: () => void;
  showToast?: (msg: string, type?: 'success' | 'info' | 'warning') => void;
}

export const MoldeoStagePera: React.FC<MoldeoStagePeraProps> = ({
  batch,
  onUpdateBatch,
  onOpenReviewModal,
  showToast,
}) => {
  const { acidificar } = batch;
  // Litros iniciales de mezcla
  const totalMilk =
    (acidificar?.insumos?.lecheFresca || 0) +
      (acidificar?.insumos?.lecheAcida || 0) ||
    batch.lotesLeche?.litrosConfirmados ||
    batch.lotesLeche?.litrosLote1 ||
    0;

  const moldes: MoldesDesglose = batch.moldesDesglose || {
    moldes100g: 0,
    moldes200g: 0,
    moldes400g: 0,
    moldes800g: 0,
    moldes1600g: 0,
    moldesPeraGrande350g: 0,
    moldesPeraPequeno60g: 0,
    pesadoTotalHiladoKg: 0,
    pesoTotalCalculadoKg: 0,
    esPesoManual: false,
  };

  // PRESENTACIONES EXCLUSIVAS DE QUESO PERA: 350 g (Grande) y 60 g (Pequeño)
  const m350 = moldes.moldesPeraGrande350g || 0;
  const m60 = moldes.moldesPeraPequeno60g || 0;

  // Subtotales en gramos de Queso Pera Tradicional
  const gramos350 = m350 * 350;
  const gramos60 = m60 * 60;
  const kilos350 = Math.round((gramos350 / 1000) * 100) / 100;
  const kilos60 = Math.round((gramos60 / 1000) * 100) / 100;

  const unidadesMoldesPera = m350 + m60;
  const gramosMoldesPera = gramos350 + gramos60;
  const kilosMoldesPera = Math.round((gramosMoldesPera / 1000) * 100) / 100;

  // Variables dinámicas de Derivación: Queso Mexicano
  const isMexHabilitado = Boolean(batch.derivaciones?.mexicano?.habilitado);
  const mex100 = isMexHabilitado ? batch.derivaciones?.mexicano?.moldes100g ?? 0 : 0;
  const mex200 = isMexHabilitado ? batch.derivaciones?.mexicano?.moldes200g ?? 0 : 0;
  const mex350 = isMexHabilitado ? batch.derivaciones?.mexicano?.moldes350g ?? 0 : 0;
  const unidadesMoldesMex = mex100 + mex200 + mex350;
  const gramosMoldesMex = mex100 * 100 + mex200 * 200 + mex350 * 350;
  const kilosMoldesMex = Math.round((gramosMoldesMex / 1000) * 100) / 100;

  const mexInicialG = isMexHabilitado ? batch.derivaciones?.mexicano?.pesoInicialGramos ?? 0 : 0;
  const mexFinalG = isMexHabilitado ? batch.derivaciones?.mexicano?.pesoFinalGramos ?? 0 : 0;
  const mexUtilizadoG = isMexHabilitado ? Math.max(0, mexInicialG - mexFinalG) : 0;

  const mexAjiG = isMexHabilitado
    ? batch.derivaciones?.mexicano?.especiasMexicano?.ajiPicante?.pesoUtilizadoGramos ?? 0
    : 0;
  const mexPimientaG = isMexHabilitado
    ? batch.derivaciones?.mexicano?.especiasMexicano?.pimienta?.pesoUtilizadoGramos ?? 0
    : 0;

  // Variables dinámicas de Derivación: Queso Finas Hierbas
  const isFhHabilitado = Boolean(batch.derivaciones?.finasHierbas?.habilitado);
  const fh100 = isFhHabilitado ? batch.derivaciones?.finasHierbas?.moldes100g ?? 0 : 0;
  const fh200 = isFhHabilitado ? batch.derivaciones?.finasHierbas?.moldes200g ?? 0 : 0;
  const fh350 = isFhHabilitado ? batch.derivaciones?.finasHierbas?.moldes350g ?? 0 : 0;
  const fhDirectUnidades = isFhHabilitado ? batch.derivaciones?.finasHierbas?.unidades : undefined;
  const unidadesMoldesFh = isFhHabilitado
    ? fhDirectUnidades !== undefined
      ? fhDirectUnidades
      : fh100 + fh200 + fh350
    : 0;
  const gramosMoldesFh = isFhHabilitado
    ? fhDirectUnidades !== undefined
      ? fhDirectUnidades * (batch.derivaciones?.finasHierbas?.gramosPorUnidad || 350)
      : fh100 * 100 + fh200 * 200 + fh350 * 350
    : 0;
  const kilosMoldesFh = Math.round((gramosMoldesFh / 1000) * 100) / 100;

  const fhInicialG = isFhHabilitado ? batch.derivaciones?.finasHierbas?.pesoInicialGramos ?? 0 : 0;
  const fhFinalG = isFhHabilitado ? batch.derivaciones?.finasHierbas?.pesoFinalGramos ?? 0 : 0;
  const fhUtilizadoG = isFhHabilitado ? Math.max(0, fhInicialG - fhFinalG) : 0;

  // Desglose de Producción
  const quesoPeraPrincipalKg = kilosMoldesPera;
  const quesoPeraPrincipalGramos = gramosMoldesPera;

  const derivadoMexicanoKg = isMexHabilitado ? kilosMoldesMex : 0;
  const derivadoMexicanoGramos = isMexHabilitado ? gramosMoldesMex : 0;

  const derivadoFinasHierbasKg = isFhHabilitado ? kilosMoldesFh : 0;
  const derivadoFinasHierbasGramos = isFhHabilitado ? gramosMoldesFh : 0;

  // GRAN TOTALIZADOR (Suma matemática de todos los moldes registrados: Tradicional + Mexicano + Finas Hierbas)
  const totalMoldeadoGramos =
    quesoPeraPrincipalGramos +
    derivadoMexicanoGramos +
    derivadoFinasHierbasGramos;
  const totalMoldeadoKg = Math.round((totalMoldeadoGramos / 1000) * 100) / 100;

  const totalGeneralUnidadesMoldes =
    unidadesMoldesPera +
    (isMexHabilitado ? unidadesMoldesMex : 0) +
    (isFhHabilitado ? unidadesMoldesFh : 0);

  // Rendimiento del Lote (%) = (Masa Total Moldeada / Litros de Mezcla Iniciales) * 100
  const yieldPercentage = totalMilk > 0 ? (totalMoldeadoKg / totalMilk) * 100 : 0;
  const litersPerKg = totalMoldeadoKg > 0 ? totalMilk / totalMoldeadoKg : 0;

  // Estado de confirmación y bloqueo de moldes de Queso Pera
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
        moldesPeraGrande350g: 0,
        moldesPeraPequeno60g: 0,
        pesadoTotalHiladoKg: 0,
        pesoTotalCalculadoKg: 0,
        esPesoManual: false,
      };
      const updated = { ...current, ...partial };
      const c350 = updated.moldesPeraGrande350g || 0;
      const c60 = updated.moldesPeraPequeno60g || 0;

      const totalGramos = c350 * 350 + c60 * 60;
      const calcKg = Math.round((totalGramos / 1000) * 100) / 100;
      const totalCount = c350 + c60;

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
          moldesPeraGrande350g: m350,
          moldesPeraPequeno60g: m60,
          pesoTotalCalculadoKg: kilosMoldesPera,
          confirmado: true,
        },
        hilar: {
          ...prev.hilar,
          pesoTotalQueso: kilosMoldesPera,
          numeroMoldes: unidadesMoldesPera,
        },
      }));
    }
    if (showToast) {
      showToast(
        `✓ Moldes Queso Pera confirmados: ${unidadesMoldesPera} moldes (${kilosMoldesPera.toFixed(
          2
        )} kg).`,
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

  const isCompleted =
    batch.processTimer.isCompleted || batch.status === 'COMPLETADO';

  return (
    <div className="flex flex-col w-full p-4 lg:p-6 gap-6 bg-[#FFFFFF] min-h-[calc(100vh-4rem)] pb-12">
      <StageHeader
        stageNumber={5}
        totalStages={5}
        title="Moldeo y Rendimiento (Queso Pera)"
        productName="Queso Pera"
        icon="scale"
        isCompleted={isCompleted}
      />

      {/* =========================================================================
          PASO 01 · CONTEO DE MOLDES QUESO PERA (TRADICIONAL: 350 g y 60 g)
      ========================================================================= */}
      <Card
        title="Paso 1 · Contar Moldes de Queso Pera: Pequeño (60 g) y Grande (350 g)"
        icon="inventory_2"
        badge={
          moldesConfirmados
            ? `✓ ${unidadesMoldesPera} moldes Pera · ${kilosMoldesPera.toFixed(2)} kg`
            : 'Conteo en progreso'
        }
        variant={moldesConfirmados ? 'success' : 'default'}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Formato 1: Queso Pera Pequeño (60 g) */}
          <div className="p-5 rounded-2xl bg-[#FFFFFF] border-2 border-blue-300 shadow-2xs flex flex-col justify-between gap-4">
            <div>
              <div className="flex items-start justify-between gap-2 mb-3">
                <div>
                  <h3 className="text-base font-extrabold text-gray-900">
                    Queso Pera Pequeño
                  </h3>
                  <span className="text-xs font-bold text-blue-900">
                    Formato 60 g (0.06 kg / molde)
                  </span>
                </div>
                <Badge variant="info" size="md">
                  60 g / molde
                </Badge>
              </div>

              <InputField
                label="Cantidad de Moldes (60 g)"
                type="number"
                inputMode="numeric"
                min="0"
                step="1"
                placeholder="Ej: 50"
                unit="unidades"
                disabled={moldesConfirmados}
                value={m60 > 0 ? m60 : ''}
                onChange={(e) => {
                  const val = Math.max(0, parseInt(e.target.value, 10) || 0);
                  updateMoldes({ moldesPeraPequeno60g: val });
                }}
              />
            </div>

            <div className="pt-3.5 border-t border-[#D6DEEA] flex items-center justify-between gap-2">
              <div className="flex flex-col">
                <span className="text-[10px] uppercase font-bold text-gray-500">
                  SUBTOTAL GRAMOS
                </span>
                <span className="font-mono font-black text-blue-900 text-xl">
                  {gramos60.toLocaleString('es-CO')} g
                </span>
              </div>
              <div className="flex items-center gap-1.5 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-300">
                <span className="text-emerald-800 font-bold text-xs uppercase">
                  EQUIV. KILOS:
                </span>
                <span className="font-mono font-black text-emerald-800 text-base">
                  {kilos60.toFixed(2)} kg
                </span>
              </div>
            </div>
          </div>

          {/* Formato 2: Queso Pera Grande (350 g) */}
          <div className="p-5 rounded-2xl bg-[#FFFFFF] border-2 border-amber-300 shadow-2xs flex flex-col justify-between gap-4">
            <div>
              <div className="flex items-start justify-between gap-2 mb-3">
                <div>
                  <h3 className="text-base font-extrabold text-gray-900">
                    Queso Pera Grande
                  </h3>
                  <span className="text-xs font-bold text-amber-900">
                    Formato 350 g (0.35 kg / molde)
                  </span>
                </div>
                <Badge variant="warning" size="md">
                  350 g / molde
                </Badge>
              </div>

              <InputField
                label="Cantidad de Moldes (350 g)"
                type="number"
                inputMode="numeric"
                min="0"
                step="1"
                placeholder="Ej: 30"
                unit="unidades"
                disabled={moldesConfirmados}
                value={m350 > 0 ? m350 : ''}
                onChange={(e) => {
                  const val = Math.max(0, parseInt(e.target.value, 10) || 0);
                  updateMoldes({ moldesPeraGrande350g: val });
                }}
              />
            </div>

            <div className="pt-3.5 border-t border-[#D6DEEA] flex items-center justify-between gap-2">
              <div className="flex flex-col">
                <span className="text-[10px] uppercase font-bold text-gray-500">
                  SUBTOTAL GRAMOS
                </span>
                <span className="font-mono font-black text-amber-900 text-xl">
                  {gramos350.toLocaleString('es-CO')} g
                </span>
              </div>
              <div className="flex items-center gap-1.5 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-300">
                <span className="text-emerald-800 font-bold text-xs uppercase">
                  EQUIV. KILOS:
                </span>
                <span className="font-mono font-black text-emerald-800 text-base">
                  {kilos350.toFixed(2)} kg
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Barra de Confirmación y Bloqueo de Moldes Tradicionales */}
        <div className="mt-5 pt-4 border-t border-[#D6DEEA] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-amber-50/50 p-4 rounded-xl border border-amber-200/80">
          <div className="flex items-center gap-2.5 text-xs text-[#434655]">
            <span className="material-symbols-outlined text-[24px] text-amber-700 shrink-0">
              inventory_2
            </span>
            <div>
              <span className="font-black text-gray-900 block">
                Total en moldes tradicionales de Queso Pera:
              </span>
              <span className="text-xs text-gray-700">
                <strong className="text-amber-900 font-mono">
                  {unidadesMoldesPera} unidades
                </strong>{' '}
                ({m60} de 60 g + {m350} de 350 g) ={' '}
                <strong className="text-emerald-800 font-mono">
                  {kilosMoldesPera.toFixed(2)} kg
                </strong>{' '}
                de queso.
              </span>
            </div>
          </div>

          {!moldesConfirmados ? (
            <Button
              variant="warning"
              size="lg"
              icon="verified"
              onClick={handleConfirmarMoldes}
              disabled={unidadesMoldesPera === 0}
            >
              Confirmar Moldes Queso Pera
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <Badge variant="success" size="md">
                ✓ Moldes Confirmados ({kilosMoldesPera.toFixed(2)} kg)
              </Badge>
              <Button
                variant="outline"
                size="sm"
                icon="edit"
                onClick={handleReactivarEdicion}
                className="bg-white border-amber-300 text-amber-900 hover:bg-amber-100"
              >
                Modificar
              </Button>
            </div>
          )}
        </div>
      </Card>

      {/* =========================================================================
          SECCIONES MODULARES OPCIONALES: DERIVACIÓN DE PASTA RESULTANTE
          (QUESO MEXICANO Y FINAS HIERBAS)
      ========================================================================= */}
      <DerivacionesPastaResultante
        batchId={batch.id}
        loteVisible={loteVisible(batch)}
        derivaciones={batch.derivaciones}
        onChange={(derivs) => {
          if (onUpdateBatch) {
            onUpdateBatch((prev) => ({
              ...prev,
              derivaciones: derivs,
            }));
          }
        }}
        showToast={showToast}
      />

      {/* =========================================================================
          RESUMEN CONSOLIDADO DE MASA MOLDEADA Y RENDIMIENTO DEL LOTE (REDISEÑADO)
      ========================================================================= */}
      <Card
        title="Resumen de Masa Moldeada y Rendimiento del Lote"
        icon="analytics"
        badge={`Rendimiento: ${yieldPercentage.toFixed(2)} %`}
        variant="success"
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* COLUMNA 1: DESGLOSE LIMPIO Y GRAN TOTALIZADOR */}
          <div className="bg-[#FFFFFF] rounded-2xl p-5 border border-[#D6DEEA] flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 pb-3 border-b border-[#D6DEEA]">
                <span className="material-symbols-outlined text-amber-700 text-[22px]">
                  donut_large
                </span>
                <h3 className="text-base font-black text-gray-900">
                  Desglose de Producción por Variante
                </h3>
              </div>

              <div className="space-y-3 mt-4">
                {/* 1. Total Tradicional */}
                <div className="flex items-center justify-between p-3.5 rounded-xl bg-white border border-amber-200 shadow-2xs">
                  <div className="flex items-center gap-3">
                    <span className="w-3 h-3 rounded-full bg-amber-500 shrink-0" />
                    <div>
                      <span className="text-xs sm:text-sm font-black text-gray-900 block">
                        Total Tradicional (Queso Pera)
                      </span>
                      <span className="text-[11px] text-gray-500 font-semibold">
                        {m60} de 60 g + {m350} de 350 g ({unidadesMoldesPera} moldes)
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-mono font-black text-amber-950 text-base sm:text-lg block">
                      {quesoPeraPrincipalKg.toFixed(2)} kg
                    </span>
                    <span className="text-[11px] text-gray-500 font-mono">
                      {quesoPeraPrincipalGramos.toLocaleString('es-CO')} g
                    </span>
                  </div>
                </div>

                {/* 2. Total Mexicano */}
                <div className="flex items-center justify-between p-3.5 rounded-xl bg-white border border-orange-200 shadow-2xs">
                  <div className="flex items-center gap-3">
                    <span className="w-3 h-3 rounded-full bg-orange-500 shrink-0" />
                    <div>
                      <span className="text-xs sm:text-sm font-black text-gray-900 block">
                        Total Mexicano
                      </span>
                      <span className="text-[11px] text-gray-500 font-semibold">
                        {isMexHabilitado
                          ? `${mex100} de 100g + ${mex200} de 200g + ${mex350} de 350g (${unidadesMoldesMex} moldes)`
                          : 'No se sacó en este lote'}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-mono font-black text-orange-900 text-base sm:text-lg block">
                      {derivadoMexicanoKg.toFixed(2)} kg
                    </span>
                    <span className="text-[11px] text-orange-700 font-mono">
                      {derivadoMexicanoGramos.toLocaleString('es-CO')} g
                    </span>
                  </div>
                </div>

                {/* 3. Total Finas Hierbas */}
                <div className="flex items-center justify-between p-3.5 rounded-xl bg-white border border-emerald-200 shadow-2xs">
                  <div className="flex items-center gap-3">
                    <span className="w-3 h-3 rounded-full bg-emerald-500 shrink-0" />
                    <div>
                      <span className="text-xs sm:text-sm font-black text-gray-900 block">
                        Total Finas Hierbas
                      </span>
                      <span className="text-[11px] text-gray-500 font-semibold">
                        {isFhHabilitado
                          ? `${unidadesMoldesFh} moldes producidos`
                          : 'No se sacó en este lote'}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-mono font-black text-emerald-900 text-base sm:text-lg block">
                      {derivadoFinasHierbasKg.toFixed(2)} kg
                    </span>
                    <span className="text-[11px] text-emerald-700 font-mono">
                      {derivadoFinasHierbasGramos.toLocaleString('es-CO')} g
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* GRAN TOTALIZADOR: MASA TOTAL MOLDEADA */}
            <div className="mt-5 pt-4 border-t-2 border-[#D6DEEA]">
              <div className="p-4 rounded-2xl bg-amber-500/15 border-2 border-amber-400 flex items-center justify-between shadow-xs">
                <div>
                  <span className="text-xs font-black uppercase tracking-wider text-amber-950 block">
                    MASA TOTAL MOLDEADA
                  </span>
                  <span className="text-[11px] font-bold text-amber-900 mt-0.5 block">
                    Suma total de {totalGeneralUnidadesMoldes} moldes registrados
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-2xl sm:text-3xl font-black font-mono text-gray-950 block">
                    {totalMoldeadoKg.toFixed(2)} kg
                  </span>
                  <span className="text-xs font-mono font-bold text-amber-900">
                    {totalMoldeadoGramos.toLocaleString('es-CO')} g
                  </span>
                </div>
              </div>

              {/* Detalle de especias si hubo Mexicano o Finas Hierbas */}
              {(isMexHabilitado || isFhHabilitado) && (
                <div className="mt-3 p-3 rounded-xl bg-white border border-[#D6DEEA] text-xs">
                  <div className="flex items-center gap-1.5 text-[10px] font-black uppercase text-gray-700 tracking-wider mb-1.5">
                    <span className="material-symbols-outlined text-[15px] text-amber-700">
                      grain
                    </span>
                    <span>Consumo de Especias (Separado de la masa láctea):</span>
                  </div>
                  <div className="flex flex-wrap gap-2 text-[11px] font-mono">
                    {isMexHabilitado && (
                      <span className="px-2 py-1 rounded bg-orange-50 border border-orange-200 text-orange-900 font-bold">
                        Mexicano: Ají {mexAjiG}g · Pimienta {mexPimientaG}g (Total: {mexUtilizadoG}g)
                      </span>
                    )}
                    {isFhHabilitado && (
                      <span className="px-2 py-1 rounded bg-emerald-50 border border-emerald-200 text-emerald-900 font-bold">
                        Finas Hierbas: Hierbas {fhUtilizadoG}g
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* COLUMNA 2: INDICADORES DE RENDIMIENTO DEL LOTE (SOLO LECTURA, BLOQUEADO) */}
          <div className="bg-[#FFFFFF] rounded-2xl p-5 border border-[#D6DEEA] flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-[#D6DEEA]">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-emerald-700 text-[22px]">
                    percent
                  </span>
                  <h3 className="text-base font-black text-gray-900">
                    Rendimiento del Lote ({totalMilk} L de mezcla inicial)
                  </h3>
                </div>
                <Badge variant="success" size="sm">
                  Cálculo Matemático
                </Badge>
              </div>

              <div className="flex flex-col gap-4 mt-4">
                {/* 1. Masa Total Producida */}
                <div className="p-4 rounded-xl bg-white border border-emerald-200 flex flex-col justify-between shadow-2xs">
                  <span className="text-[10px] font-bold uppercase text-emerald-800">
                    Masa Total Real de Quesos Moldeados
                  </span>
                  <div className="my-2">
                    <span className="text-3xl font-black font-mono text-emerald-900 block">
                      {totalMoldeadoKg.toFixed(2)} kg
                    </span>
                    <span className="text-xs font-mono font-bold text-emerald-700 mt-0.5 block">
                      Equivalente a {totalMoldeadoGramos.toLocaleString('es-CO')} gramos en {totalGeneralUnidadesMoldes} moldes
                    </span>
                  </div>
                  <span className="text-[10px] text-gray-500 font-medium">
                    Calculado sumando Tradicional + Mexicano + Finas Hierbas
                  </span>
                </div>

                {/* 2. Rendimiento del Lote (%) */}
                <div className="p-4 rounded-xl bg-white border border-amber-200 flex flex-col justify-between shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase text-amber-900">
                      Rendimiento del Lote (%)
                    </span>
                    <Badge variant={yieldPercentage >= 10 && yieldPercentage <= 12 ? 'success' : 'warning'} size="sm">
                      {yieldPercentage >= 10 && yieldPercentage <= 12 ? 'Óptimo' : 'Fuera de meta'}
                    </Badge>
                  </div>
                  <div className="my-2">
                    <span className="text-3xl font-black font-mono text-amber-950 block">
                      {yieldPercentage.toFixed(2)} %
                    </span>
                    <span className="text-[11px] font-mono font-bold text-gray-600 mt-0.5 block">
                      Fórmula: ({totalMoldeadoKg.toFixed(2)} kg / {totalMilk} L) × 100
                    </span>
                  </div>
                  <span className="text-[10px] text-gray-500 font-medium">
                    Meta esperada: 10.2 % – 11.0 %
                  </span>
                </div>

                {/* 3. Litros de Leche por 1 Kilo */}
                <div className="p-4 rounded-xl bg-white border border-[#D6DEEA] flex flex-col justify-between shadow-2xs">
                  <span className="text-[10px] font-bold uppercase text-gray-600">
                    Litros de Leche por 1 Kilo de Queso
                  </span>
                  <div className="my-1.5">
                    <span className="text-2xl font-black font-mono text-gray-900 block">
                      {litersPerKg.toFixed(2)} L / kg
                    </span>
                    <span className="text-[11px] font-mono font-semibold text-gray-600 mt-0.5 block">
                      {totalMilk} L / {totalMoldeadoKg.toFixed(2)} kg
                    </span>
                  </div>
                  <span className="text-[10px] text-gray-500 font-medium">
                    Litros de leche necesarios para producir 1 kg de queso
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* =========================================================================
          BARRA INFERIOR ESTANDARIZADA (FOOTER UNIFICADO: 2 BOTONES)
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
              Total moldeado: <strong>{totalMoldeadoKg.toFixed(2)} kg</strong> en{' '}
              <strong>{totalGeneralUnidadesMoldes} moldes</strong> · Rendimiento:{' '}
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
            disabled={totalGeneralUnidadesMoldes === 0}
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
