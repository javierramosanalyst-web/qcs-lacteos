import React, { useState } from 'react';
import {
  BatchData,
  Derivaciones7CuerosState,
  MoldesDesglose,
} from '../../../types';
import {
  Badge,
  Button,
  Card,
  InputField,
  StageHeader,
} from '../../../components/ui';

const DIGITO_LETRA = 'JABCDEFGHI';
const MES_LETRA = 'ABCDEFGHIJKL';

const aLetras = (n: number) =>
  String(n)
    .split('')
    .map((d) => DIGITO_LETRA[Number(d)])
    .join('');

const hoyIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const sugerirLoteMaquilado = (fechaIso?: string): string => {
  const [y, m, d] = (fechaIso || hoyIso()).split('-').map(Number);
  if (!y || !m || !d) return '';
  const codigo = `${aLetras(d)}${MES_LETRA[m - 1]}${aLetras(y % 100)}`;
  return `${codigo}-${new Date().getDate()}`;
};

interface LoteMaquiladoFieldProps {
  label: string;
  lote: string;
  fechaProveedor?: string;
  manual?: boolean;
  onChange: (partial: { lote?: string; fechaProveedor?: string; manual?: boolean }) => void;
}

const LoteMaquiladoField: React.FC<LoteMaquiladoFieldProps> = ({
  label,
  lote,
  fechaProveedor,
  manual,
  onChange,
}) => (
  <div className="flex flex-col gap-2.5 p-3 rounded-xl bg-white border border-[#D6DEEA]">
    <InputField
      label="Fecha del lote del proveedor"
      type="date"
      value={fechaProveedor || hoyIso()}
      disabled={Boolean(manual)}
      onChange={(e) => {
        const f = e.target.value;
        onChange({ fechaProveedor: f, lote: sugerirLoteMaquilado(f) });
      }}
    />
    <InputField
      label={label}
      type="text"
      placeholder="Ej: ABHBD-22"
      value={lote || (manual ? '' : sugerirLoteMaquilado(fechaProveedor))}
      readOnly={!manual}
      helperText={
        manual
          ? 'Escribe el lote tal como aparece en el empaque'
          : 'Sugerido: fecha del proveedor codificada + día de recepción'
      }
      onChange={(e) => onChange({ lote: e.target.value.toUpperCase() })}
    />
    <label className="flex items-center gap-2 text-xs font-bold text-gray-700 cursor-pointer select-none">
      <input
        type="checkbox"
        checked={Boolean(manual)}
        onChange={(e) =>
          onChange({
            manual: e.target.checked,
            lote: e.target.checked ? lote : sugerirLoteMaquilado(fechaProveedor),
          })
        }
        className="w-4 h-4 rounded cursor-pointer"
      />
      Escribir el lote manualmente
    </label>
  </div>
);

export interface MoldeoStage7CuerosProps {
  batch: BatchData;
  onUpdateBatch?:
    | React.Dispatch<React.SetStateAction<BatchData>>
    | ((updater: (prev: BatchData) => BatchData) => void);
  onFinalizeProcess?: (openModal?: boolean) => void;
  onOpenReviewModal?: () => void;
  onNavigateToProductSelect?: () => void;
  showToast?: (msg: string, type?: 'success' | 'info' | 'warning') => void;
}

const DEFAULT_DERIVACIONES_7CUEROS: Derivaciones7CuerosState = {
  arequipe: {
    habilitado: false,
    loteArequipe: '',
    pesoInicialGramos: 0,
    pesoFinalGramos: 0,
    pesoUtilizadoGramos: 0,
    moldes60g: 0,
  },
  bocadillo: {
    habilitado: false,
    loteBocadillo: '',
    pesoInicialGramos: 0,
    pesoFinalGramos: 0,
    pesoUtilizadoGramos: 0,
    moldes60g: 0,
    unidadesBocadilloGastadas: 0,
  },
};

export const MoldeoStage7Cueros: React.FC<MoldeoStage7CuerosProps> = ({
  batch,
  onUpdateBatch,
  onOpenReviewModal,
  showToast,
}) => {
  const deriv: Derivaciones7CuerosState =
    batch.derivaciones7Cueros || DEFAULT_DERIVACIONES_7CUEROS;
  const desglose = batch.moldesDesglose;

  // Litros iniciales de leche fresca
  const totalMilk =
    batch.acidificar.insumos.litrosConfirmados ||
    (batch.acidificar.insumos.saved
      ? batch.acidificar.insumos.lecheFresca
      : undefined) ||
    batch.lotesLeche.litrosConfirmados ||
    batch.lotesLeche.litrosLote1 ||
    0;

  // Formato 1: Siete Cueros (350 g)
  const m7Cueros = Math.max(0, Number(desglose?.moldes7Cueros350g) || 0);
  const gramos7Cueros = m7Cueros * 350;
  const kilos7Cueros = Math.round((gramos7Cueros / 1000) * 100) / 100;

  // Formato 2: Queso Trenza (350 g)
  const mTrenza = Math.max(0, Number(desglose?.moldesTrenza350g) || 0);
  const gramosTrenza = mTrenza * 350;
  const kilosTrenza = Math.round((gramosTrenza / 1000) * 100) / 100;

  // Subtotales Tradicionales (7 Cueros + Trenza)
  const unidadesMoldesTradicionales = m7Cueros + mTrenza;
  const gramosMoldesTradicionales = gramos7Cueros + gramosTrenza;
  const kilosMoldesTradicionales =
    Math.round((gramosMoldesTradicionales / 1000) * 100) / 100;

  // Derivación Opcional: Quesadilla con Bocadillo (60 g)
  const bocadilloState =
    deriv.bocadillo || DEFAULT_DERIVACIONES_7CUEROS.bocadillo;
  const isBocadilloHabilitado = Boolean(bocadilloState.habilitado);
  const mQuesadillaBocadillo = isBocadilloHabilitado
    ? Math.max(0, Number(bocadilloState.moldes60g) || 0)
    : 0;
  const gramosQuesadillaBocadillo = mQuesadillaBocadillo * 60;
  const kilosQuesadillaBocadillo =
    Math.round((gramosQuesadillaBocadillo / 1000) * 100) / 100;
  const bocadillosGastadosU = isBocadilloHabilitado ? mQuesadillaBocadillo : 0;

  // Derivación Opcional: Quesadilla con Arequipe (60 g)
  const arequipeState =
    deriv.arequipe || DEFAULT_DERIVACIONES_7CUEROS.arequipe;
  const isArequipeHabilitado = Boolean(arequipeState.habilitado);
  const mQuesadillaArequipe = isArequipeHabilitado
    ? Math.max(0, Number(arequipeState.moldes60g) || 0)
    : 0;
  const gramosQuesadillaArequipe = mQuesadillaArequipe * 60;
  const kilosQuesadillaArequipe =
    Math.round((gramosQuesadillaArequipe / 1000) * 100) / 100;
  const arequipePesoInicial = Math.max(
    0,
    Number(arequipeState.pesoInicialGramos) || 0
  );
  const arequipePesoFinal = Math.max(
    0,
    Number(arequipeState.pesoFinalGramos) || 0
  );
  const arequipeGastadoGramos = isArequipeHabilitado
    ? Math.max(0, arequipePesoInicial - arequipePesoFinal)
    : 0;

  // GRAN TOTALIZADOR (Suma matemática de todos los moldes registrados: 7 Cueros + Trenza + Quesadillas)
  const totalGeneralUnidadesMoldes =
    unidadesMoldesTradicionales +
    mQuesadillaBocadillo +
    mQuesadillaArequipe;

  const totalMoldeadoGramos =
    gramosMoldesTradicionales +
    gramosQuesadillaBocadillo +
    gramosQuesadillaArequipe;

  const totalMoldeadoKg =
    Math.round((totalMoldeadoGramos / 1000) * 100) / 100;

  // Rendimiento del Lote (%) = (Masa Total Moldeada / Litros de Leche) * 100 (Estrictamente bloqueado en solo lectura)
  const yieldPercentage =
    totalMilk > 0 ? (totalMoldeadoKg / totalMilk) * 100 : 0;
  const litersPerKg = totalMoldeadoKg > 0 ? totalMilk / totalMoldeadoKg : 0;

  // Estado de confirmación y bloqueo de moldes tradicionales
  const [moldesConfirmados, setMoldesConfirmados] = useState<boolean>(() =>
    Boolean(batch.moldesDesglose?.confirmado)
  );

  const syncWithBatch = (
    next7Cueros: number,
    nextTrenza: number,
    nextDeriv: Derivaciones7CuerosState,
    confirmedOverride?: boolean
  ) => {
    if (!onUpdateBatch) return;

    const u7 = Math.max(0, Number(next7Cueros) || 0);
    const uTr = Math.max(0, Number(nextTrenza) || 0);
    const uBoc = nextDeriv.bocadillo.habilitado
      ? Math.max(0, Number(nextDeriv.bocadillo.moldes60g) || 0)
      : 0;
    const uArq = nextDeriv.arequipe.habilitado
      ? Math.max(0, Number(nextDeriv.arequipe.moldes60g) || 0)
      : 0;

    const totalU = u7 + uTr + uBoc + uArq;
    const calcGramos = u7 * 350 + uTr * 350 + uBoc * 60 + uArq * 60;
    const finalKilos = Math.round((calcGramos / 1000) * 100) / 100;

    const isConfirmed =
      confirmedOverride !== undefined ? confirmedOverride : moldesConfirmados;

    const nextDesglose: MoldesDesglose = {
      moldes100g: uArq,
      moldes200g: uBoc,
      moldes400g: u7,
      moldes800g: 0,
      moldes1600g: uTr,
      moldes7Cueros350g: u7,
      moldesTrenza350g: uTr,
      moldesQuesadillaBocadillo60g: uBoc,
      moldesQuesadillaArequipe60g: uArq,
      pesoTotalCalculadoKg: finalKilos,
      confirmado: isConfirmed,
      esPesoManual: false,
    };

    onUpdateBatch((prev) => ({
      ...prev,
      moldesDesglose: nextDesglose,
      derivaciones7Cueros: nextDeriv,
      hilar: {
        ...prev.hilar,
        pesoTotalQueso: finalKilos,
        numeroMoldes: totalU,
      },
    }));
  };

  const update7Cueros = (unidades: number) => {
    if (moldesConfirmados) return;
    syncWithBatch(Math.max(0, unidades), mTrenza, deriv);
  };

  const updateTrenza = (unidades: number) => {
    if (moldesConfirmados) return;
    syncWithBatch(m7Cueros, Math.max(0, unidades), deriv);
  };

  const handleConfirmarMoldes = () => {
    setMoldesConfirmados(true);
    syncWithBatch(m7Cueros, mTrenza, deriv, true);
    if (showToast) {
      showToast(
        `✓ Moldes Queso 7 Cueros confirmados: ${unidadesMoldesTradicionales} moldes (${kilosMoldesTradicionales.toFixed(
          2
        )} kg).`,
        'success'
      );
    }
  };

  const handleReactivarEdicion = () => {
    setMoldesConfirmados(false);
    syncWithBatch(m7Cueros, mTrenza, deriv, false);
    if (showToast) {
      showToast('Edición de moldes tradicionales reactivada', 'info');
    }
  };

  const updateBocadillo = (
    partial: Partial<Derivaciones7CuerosState['bocadillo']>
  ) => {
    const current =
      deriv.bocadillo || DEFAULT_DERIVACIONES_7CUEROS.bocadillo;
    const merged = { ...current, ...partial };
    const m60 = Math.max(0, Number(merged.moldes60g) || 0);
    merged.pesoUtilizadoGramos = 0;
    merged.unidadesBocadilloGastadas = merged.habilitado ? m60 : 0;
    const next: Derivaciones7CuerosState = {
      ...deriv,
      bocadillo: merged,
    };
    syncWithBatch(m7Cueros, mTrenza, next);
  };

  const updateArequipe = (
    partial: Partial<Derivaciones7CuerosState['arequipe']>
  ) => {
    const current =
      deriv.arequipe || DEFAULT_DERIVACIONES_7CUEROS.arequipe;
    const merged = { ...current, ...partial };
    const pInicial = Math.max(0, Number(merged.pesoInicialGramos) || 0);
    const pFinal = Math.max(0, Number(merged.pesoFinalGramos) || 0);
    merged.pesoUtilizadoGramos = merged.habilitado
      ? Math.max(0, pInicial - pFinal)
      : 0;
    const next: Derivaciones7CuerosState = {
      ...deriv,
      arequipe: merged,
    };
    syncWithBatch(m7Cueros, mTrenza, next);
  };

  const isCompleted =
    batch.processTimer.isCompleted || batch.status === 'COMPLETADO';

  return (
    <div className="flex flex-col w-full p-4 lg:p-6 gap-6 bg-[#FFFFFF] min-h-[calc(100vh-4rem)] pb-12">
      <StageHeader
        stageNumber={5}
        totalStages={5}
        title="Moldeo y Rendimiento (Queso 7 Cueros)"
        subtitle="Cuenta los moldes de Queso Siete Cueros (350 g) y Trenza (350 g), registra las quesadillas de bocadillo o arequipe (60 g) si se elaboraron hoy y revisa el rendimiento final."
        productName="Queso 7 Cueros"
        icon="scale"
        isCompleted={isCompleted}
        rightContent={
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="px-3.5 py-2 rounded-xl bg-amber-50 border border-amber-200 flex items-center gap-2.5 min-h-[48px]">
              <span className="material-symbols-outlined text-amber-700 text-[22px]">
                scale
              </span>
              <div>
                <div className="text-[10px] font-bold uppercase text-amber-800">
                  MASA TOTAL MOLDEADA
                </div>
                <div className="text-xs font-black font-mono text-amber-900">
                  {totalMoldeadoGramos.toLocaleString('es-CO')} g (
                  {totalMoldeadoKg.toFixed(2)} kg)
                </div>
              </div>
            </div>

            <div className="px-3.5 py-2 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-2.5 min-h-[48px]">
              <span className="material-symbols-outlined text-emerald-700 text-[22px]">
                inventory_2
              </span>
              <div>
                <div className="text-[10px] font-bold uppercase text-emerald-800">
                  TOTAL MOLDES
                </div>
                <div className="text-xs font-black font-mono text-emerald-900">
                  {totalGeneralUnidadesMoldes} unidades
                </div>
              </div>
            </div>
          </div>
        }
      />

      {/* =========================================================================
          PASO 01 · CONTEO DE MOLDES TRADICIONALES: 7 CUEROS (350 g) Y TRENZA (350 g)
      ========================================================================= */}
      <Card
        title="Paso 1 · Contar Moldes de Queso Tradicional: Siete Cueros (350 g) y Trenza (350 g)"
        subtitle="Digita cuántos moldes armaste de Queso Siete Cueros (350 g) y de Queso Trenza (350 g). El peso total se calcula automáticamente."
        icon="inventory_2"
        badge={
          moldesConfirmados
            ? `✓ ${unidadesMoldesTradicionales} moldes · ${kilosMoldesTradicionales.toFixed(
                2
              )} kg`
            : 'Conteo en progreso'
        }
        variant={moldesConfirmados ? 'success' : 'default'}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Formato 1: Queso Siete Cueros (350 g) */}
          <div className="p-5 rounded-2xl bg-[#FFFFFF] border-2 border-amber-300 shadow-2xs flex flex-col justify-between gap-4">
            <div>
              <div className="flex items-start justify-between gap-2 mb-3">
                <div>
                  <h3 className="text-base font-extrabold text-gray-900">
                    Queso Siete Cueros
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
                placeholder="Ej: 95"
                unit="unidades"
                disabled={moldesConfirmados}
                value={m7Cueros > 0 ? m7Cueros : ''}
                onChange={(e) => {
                  const val = Math.max(0, parseInt(e.target.value, 10) || 0);
                  update7Cueros(val);
                }}
              />
            </div>

            <div className="pt-3.5 border-t border-[#D6DEEA] flex items-center justify-between gap-2">
              <div className="flex flex-col">
                <span className="text-[10px] uppercase font-bold text-gray-500">
                  SUBTOTAL GRAMOS
                </span>
                <span className="font-mono font-black text-amber-900 text-xl">
                  {gramos7Cueros.toLocaleString('es-CO')} g
                </span>
              </div>
              <div className="flex items-center gap-1.5 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-300">
                <span className="text-emerald-800 font-bold text-xs uppercase">
                  EQUIV. KILOS:
                </span>
                <span className="font-mono font-black text-emerald-800 text-base">
                  {kilos7Cueros.toFixed(2)} kg
                </span>
              </div>
            </div>
          </div>

          {/* Formato 2: Queso Trenza (350 g) */}
          <div className="p-5 rounded-2xl bg-[#FFFFFF] border-2 border-blue-300 shadow-2xs flex flex-col justify-between gap-4">
            <div>
              <div className="flex items-start justify-between gap-2 mb-3">
                <div>
                  <h3 className="text-base font-extrabold text-gray-900">
                    Queso Trenza
                  </h3>
                  <span className="text-xs font-bold text-blue-900">
                    Formato 350 g (0.35 kg / molde)
                  </span>
                </div>
                <Badge variant="info" size="md">
                  350 g / molde
                </Badge>
              </div>

              <InputField
                label="Cantidad de Moldes (350 g)"
                type="number"
                inputMode="numeric"
                min="0"
                step="1"
                placeholder="Ej: 40"
                unit="unidades"
                disabled={moldesConfirmados}
                value={mTrenza > 0 ? mTrenza : ''}
                onChange={(e) => {
                  const val = Math.max(0, parseInt(e.target.value, 10) || 0);
                  updateTrenza(val);
                }}
              />
            </div>

            <div className="pt-3.5 border-t border-[#D6DEEA] flex items-center justify-between gap-2">
              <div className="flex flex-col">
                <span className="text-[10px] uppercase font-bold text-gray-500">
                  SUBTOTAL GRAMOS
                </span>
                <span className="font-mono font-black text-blue-900 text-xl">
                  {gramosTrenza.toLocaleString('es-CO')} g
                </span>
              </div>
              <div className="flex items-center gap-1.5 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-300">
                <span className="text-emerald-800 font-bold text-xs uppercase">
                  EQUIV. KILOS:
                </span>
                <span className="font-mono font-black text-emerald-800 text-base">
                  {kilosTrenza.toFixed(2)} kg
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
                Total en moldes tradicionales de Queso 7 Cueros:
              </span>
              <span className="text-xs text-gray-700">
                <strong className="text-amber-900 font-mono">
                  {unidadesMoldesTradicionales} unidades
                </strong>{' '}
                ({m7Cueros} de 7 Cueros + {mTrenza} de Trenza) ={' '}
                <strong className="text-emerald-800 font-mono">
                  {kilosMoldesTradicionales.toFixed(2)} kg
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
              disabled={unidadesMoldesTradicionales === 0}
            >
              Confirmar Moldes Queso 7 Cueros
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <Badge variant="success" size="md">
                ✓ Moldes Confirmados ({kilosMoldesTradicionales.toFixed(2)} kg)
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
          SECCIÓN MODULAR OPCIONAL: DERIVACIONES DE PASTA RESULTANTE
          (QUESADILLAS CON BOCADILLO Y AREQUIPE · 60 g)
      ========================================================================= */}
      <Card
        title="Sección Opcional · Derivaciones de Pasta Resultante (Quesadillas 60 g)"
        subtitle="Habilita únicamente si separaste una porción de la masa hilada para elaborar quesadillas de 60 g con dulce de bocadillo o arequipe."
        icon="cake"
        badge={
          isBocadilloHabilitado || isArequipeHabilitado
            ? `${
                mQuesadillaBocadillo + mQuesadillaArequipe
              } quesadillas · ${(
                kilosQuesadillaBocadillo + kilosQuesadillaArequipe
              ).toFixed(2)} kg`
            : 'Sin derivaciones en este lote'
        }
        variant="default"
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* VARIANTE 1: QUESADILLA CON BOCADILLO (60 g) */}
          <div
            className={`p-5 rounded-2xl border-2 flex flex-col justify-between gap-4 transition-all ${
              isBocadilloHabilitado
                ? 'bg-white border-rose-300 shadow-2xs'
                : 'bg-stone-50/70 border-stone-200 opacity-90'
            }`}
          >
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between pb-2 border-b border-[#D6DEEA]">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-rose-500 shrink-0" />
                  <h4 className="text-base font-extrabold text-gray-900">
                    Quesadilla con Bocadillo
                  </h4>
                </div>
                <label className="flex items-center gap-2 text-xs font-bold text-gray-700 cursor-pointer select-none">
                  <span>Habilitar</span>
                  <input
                    type="checkbox"
                    checked={isBocadilloHabilitado}
                    disabled={Boolean(bocadilloState.registroGuardado)}
                    onChange={(e) =>
                      updateBocadillo({
                        habilitado: e.target.checked,
                        ...(e.target.checked && !bocadilloState.loteBocadillo
                          ? {
                              loteBocadillo: sugerirLoteMaquilado(
                                bocadilloState.fechaLoteProveedor
                              ),
                            }
                          : {}),
                      })
                    }
                    className="w-5 h-5 rounded accent-amber-600 cursor-pointer"
                  />
                </label>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs text-rose-900 font-bold">
                  Formato 60 g (0.06 kg / molde) + Bocadillo Veleño
                </span>
                <Badge variant={isBocadilloHabilitado ? 'warning' : 'neutral'} size="sm">
                  60 g / molde
                </Badge>
              </div>

              {!isBocadilloHabilitado ? (
                <div className="my-6 p-4 rounded-xl bg-stone-100 text-center text-xs text-stone-500 font-medium border border-stone-200">
                  No se elaboraron quesadillas de bocadillo en este lote (No suma a la masa).
                </div>
              ) : (
                <>
                <fieldset
                  disabled={Boolean(bocadilloState.registroGuardado)}
                  className="min-w-0 border-0 p-0 m-0 flex flex-col gap-3.5 mt-1"
                >
                  <InputField
                    label="Cantidad de Quesadillas (60 g)"
                    type="number"
                    inputMode="numeric"
                    min="0"
                    step="1"
                    placeholder="Ej: 25"
                    unit="unidades"
                    value={mQuesadillaBocadillo > 0 ? mQuesadillaBocadillo : ''}
                    onChange={(e) => {
                      const val = Math.max(0, parseInt(e.target.value, 10) || 0);
                      updateBocadillo({ moldes60g: val });
                    }}
                  />

                  <LoteMaquiladoField
                    label="Lote de Bocadillo Veleño"
                    lote={bocadilloState.loteBocadillo || ''}
                    fechaProveedor={bocadilloState.fechaLoteProveedor}
                    manual={bocadilloState.loteManual}
                    onChange={(p) =>
                      updateBocadillo({
                        ...(p.lote !== undefined ? { loteBocadillo: p.lote } : {}),
                        ...(p.fechaProveedor !== undefined ? { fechaLoteProveedor: p.fechaProveedor } : {}),
                        ...(p.manual !== undefined ? { loteManual: p.manual } : {}),
                      })
                    }
                  />

                  <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-rose-900 block">
                        Bocadillo Veleño consumido:
                      </span>
                      <span className="text-[11px] text-rose-700">
                        1 unidad por cada quesadilla
                      </span>
                    </div>
                    <span className="font-mono font-black text-rose-950 text-base">
                      {mQuesadillaBocadillo} {mQuesadillaBocadillo === 1 ? 'unidad' : 'unidades'} de bocadillo
                    </span>
                  </div>
                </fieldset>
                  <div className="flex justify-end pt-1">
                    {bocadilloState.registroGuardado ? (
                      <Button
                        variant="outline"
                        size="md"
                        icon="edit"
                        onClick={() => {
                          updateBocadillo({ registroGuardado: false });
                          if (showToast) showToast('Registro de Quesadilla con Bocadillo habilitado para modificar', 'info');
                        }}
                      >
                        Modificar Registro
                      </Button>
                    ) : (
                      <Button
                        variant="warning"
                        size="md"
                        icon="save"
                        onClick={() => {
                          if (mQuesadillaBocadillo <= 0) {
                            if (showToast) showToast('Ingresa la cantidad de quesadillas de bocadillo.', 'warning');
                            return;
                          }
                          const loteBoc = (bocadilloState.loteBocadillo || '').trim() || (bocadilloState.loteManual ? '' : sugerirLoteMaquilado(bocadilloState.fechaLoteProveedor));
                          if (!loteBoc) {
                            if (showToast) showToast('Falta el lote de bocadillo.', 'warning');
                            return;
                          }
                          updateBocadillo({ registroGuardado: true, loteBocadillo: loteBoc });
                          if (showToast) showToast('✓ Registro de Quesadilla con Bocadillo guardado', 'success');
                        }}
                      >
                        Guardar Registro
                      </Button>
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="pt-3.5 border-t border-[#D6DEEA] flex items-center justify-between gap-2">
              <div className="flex flex-col">
                <span className="text-[10px] uppercase font-bold text-gray-500">
                  MASA LÁCTEA SUB-TOTAL
                </span>
                <span className="font-mono font-black text-rose-900 text-lg">
                  {gramosQuesadillaBocadillo.toLocaleString('es-CO')} g
                </span>
              </div>
              <div className="flex items-center gap-1.5 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-300">
                <span className="text-emerald-800 font-bold text-xs uppercase">
                  EQUIV. KILOS:
                </span>
                <span className="font-mono font-black text-emerald-800 text-sm">
                  {kilosQuesadillaBocadillo.toFixed(2)} kg
                </span>
              </div>
            </div>
          </div>

          {/* VARIANTE 2: QUESADILLA CON AREQUIPE (60 g) */}
          <div
            className={`p-5 rounded-2xl border-2 flex flex-col justify-between gap-4 transition-all ${
              isArequipeHabilitado
                ? 'bg-white border-amber-300 shadow-2xs'
                : 'bg-stone-50/70 border-stone-200 opacity-90'
            }`}
          >
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between pb-2 border-b border-[#D6DEEA]">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-amber-500 shrink-0" />
                  <h4 className="text-base font-extrabold text-gray-900">
                    Quesadilla con Arequipe
                  </h4>
                </div>
                <label className="flex items-center gap-2 text-xs font-bold text-gray-700 cursor-pointer select-none">
                  <span>Habilitar</span>
                  <input
                    type="checkbox"
                    checked={isArequipeHabilitado}
                    disabled={Boolean(arequipeState.registroGuardado)}
                    onChange={(e) =>
                      updateArequipe({
                        habilitado: e.target.checked,
                        ...(e.target.checked && !arequipeState.loteArequipe
                          ? {
                              loteArequipe: sugerirLoteMaquilado(
                                arequipeState.fechaLoteProveedor
                              ),
                            }
                          : {}),
                      })
                    }
                    className="w-5 h-5 rounded accent-amber-600 cursor-pointer"
                  />
                </label>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs text-amber-900 font-bold">
                  Formato 60 g (0.06 kg / molde) + Arequipe Tradicional
                </span>
                <Badge variant={isArequipeHabilitado ? 'warning' : 'neutral'} size="sm">
                  60 g / molde
                </Badge>
              </div>

              {!isArequipeHabilitado ? (
                <div className="my-6 p-4 rounded-xl bg-stone-100 text-center text-xs text-stone-500 font-medium border border-stone-200">
                  No se elaboraron quesadillas de arequipe en este lote (No suma a la masa).
                </div>
              ) : (
                <>
                <fieldset
                  disabled={Boolean(arequipeState.registroGuardado)}
                  className="min-w-0 border-0 p-0 m-0 flex flex-col gap-3.5 mt-1"
                >
                  <InputField
                    label="Cantidad de Quesadillas (60 g)"
                    type="number"
                    inputMode="numeric"
                    min="0"
                    step="1"
                    placeholder="Ej: 20"
                    unit="unidades"
                    value={mQuesadillaArequipe > 0 ? mQuesadillaArequipe : ''}
                    onChange={(e) => {
                      const val = Math.max(0, parseInt(e.target.value, 10) || 0);
                      updateArequipe({ moldes60g: val });
                    }}
                  />

                  <LoteMaquiladoField
                    label="Lote de Arequipe Tradicional"
                    lote={arequipeState.loteArequipe || ''}
                    fechaProveedor={arequipeState.fechaLoteProveedor}
                    manual={arequipeState.loteManual}
                    onChange={(p) =>
                      updateArequipe({
                        ...(p.lote !== undefined ? { loteArequipe: p.lote } : {}),
                        ...(p.fechaProveedor !== undefined ? { fechaLoteProveedor: p.fechaProveedor } : {}),
                        ...(p.manual !== undefined ? { loteManual: p.manual } : {}),
                      })
                    }
                  />

                  <div className="grid grid-cols-2 gap-3">
                    <InputField
                      label="Peso Inicial Arequipe (g)"
                      type="number"
                      inputMode="numeric"
                      min="0"
                      step="10"
                      placeholder="Ej: 1000"
                      unit="g"
                      value={arequipePesoInicial > 0 ? arequipePesoInicial : ''}
                      onChange={(e) => {
                        const val = Math.max(0, parseFloat(e.target.value) || 0);
                        updateArequipe({ pesoInicialGramos: val });
                      }}
                    />
                    <InputField
                      label="Sobrante Arequipe (g)"
                      type="number"
                      inputMode="numeric"
                      min="0"
                      step="10"
                      placeholder="Ej: 200"
                      unit="g"
                      value={arequipePesoFinal > 0 ? arequipePesoFinal : ''}
                      onChange={(e) => {
                        const val = Math.max(0, parseFloat(e.target.value) || 0);
                        updateArequipe({ pesoFinalGramos: val });
                      }}
                    />
                  </div>

                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-between text-xs">
                    <span className="font-bold text-amber-900">
                      Arequipe utilizado:
                    </span>
                    <span className="font-mono font-black text-amber-950 text-sm">
                      {arequipeGastadoGramos.toLocaleString('es-CO')} g
                    </span>
                  </div>
                </fieldset>
                  <div className="flex justify-end pt-1">
                    {arequipeState.registroGuardado ? (
                      <Button
                        variant="outline"
                        size="md"
                        icon="edit"
                        onClick={() => {
                          updateArequipe({ registroGuardado: false });
                          if (showToast) showToast('Registro de Quesadilla con Arequipe habilitado para modificar', 'info');
                        }}
                      >
                        Modificar Registro
                      </Button>
                    ) : (
                      <Button
                        variant="warning"
                        size="md"
                        icon="save"
                        onClick={() => {
                          if (mQuesadillaArequipe <= 0) {
                            if (showToast) showToast('Ingresa la cantidad de quesadillas de arequipe.', 'warning');
                            return;
                          }
                          const loteArq = (arequipeState.loteArequipe || '').trim() || (arequipeState.loteManual ? '' : sugerirLoteMaquilado(arequipeState.fechaLoteProveedor));
                          if (!loteArq) {
                            if (showToast) showToast('Falta el lote de arequipe.', 'warning');
                            return;
                          }
                          updateArequipe({ registroGuardado: true, loteArequipe: loteArq });
                          if (showToast) showToast('✓ Registro de Quesadilla con Arequipe guardado', 'success');
                        }}
                      >
                        Guardar Registro
                      </Button>
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="pt-3.5 border-t border-[#D6DEEA] flex items-center justify-between gap-2">
              <div className="flex flex-col">
                <span className="text-[10px] uppercase font-bold text-gray-500">
                  MASA LÁCTEA SUB-TOTAL
                </span>
                <span className="font-mono font-black text-amber-900 text-lg">
                  {gramosQuesadillaArequipe.toLocaleString('es-CO')} g
                </span>
              </div>
              <div className="flex items-center gap-1.5 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-300">
                <span className="text-emerald-800 font-bold text-xs uppercase">
                  EQUIV. KILOS:
                </span>
                <span className="font-mono font-black text-emerald-800 text-sm">
                  {kilosQuesadillaArequipe.toFixed(2)} kg
                </span>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* =========================================================================
          RESUMEN CONSOLIDADO DE MASA MOLDEADA Y RENDIMIENTO DEL LOTE (REDISEÑADO)
      ========================================================================= */}
      <Card
        title="Resumen de Masa Moldeada y Rendimiento del Lote"
        subtitle="Desglose consolidado de la masa distribuida por variante y cálculo automático de rendimiento del lote sobre la leche inicial."
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
                {/* 1. Siete Cueros */}
                <div className="flex items-center justify-between p-3.5 rounded-xl bg-white border border-amber-200 shadow-2xs">
                  <div className="flex items-center gap-3">
                    <span className="w-3 h-3 rounded-full bg-amber-500 shrink-0" />
                    <div>
                      <span className="text-xs sm:text-sm font-black text-gray-900 block">
                        Queso Siete Cueros (350 g)
                      </span>
                      <span className="text-[11px] text-gray-500 font-semibold">
                        {m7Cueros} moldes producidos
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-mono font-black text-amber-950 text-base sm:text-lg block">
                      {kilos7Cueros.toFixed(2)} kg
                    </span>
                    <span className="text-[11px] text-gray-500 font-mono">
                      {gramos7Cueros.toLocaleString('es-CO')} g
                    </span>
                  </div>
                </div>

                {/* 2. Queso Trenza */}
                <div className="flex items-center justify-between p-3.5 rounded-xl bg-white border border-blue-200 shadow-2xs">
                  <div className="flex items-center gap-3">
                    <span className="w-3 h-3 rounded-full bg-blue-500 shrink-0" />
                    <div>
                      <span className="text-xs sm:text-sm font-black text-gray-900 block">
                        Queso Trenza (350 g)
                      </span>
                      <span className="text-[11px] text-gray-500 font-semibold">
                        {mTrenza} moldes producidos
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-mono font-black text-blue-900 text-base sm:text-lg block">
                      {kilosTrenza.toFixed(2)} kg
                    </span>
                    <span className="text-[11px] text-blue-700 font-mono">
                      {gramosTrenza.toLocaleString('es-CO')} g
                    </span>
                  </div>
                </div>

                {/* 3. Quesadilla con Bocadillo */}
                <div className="flex items-center justify-between p-3.5 rounded-xl bg-white border border-rose-200 shadow-2xs">
                  <div className="flex items-center gap-3">
                    <span className="w-3 h-3 rounded-full bg-rose-500 shrink-0" />
                    <div>
                      <span className="text-xs sm:text-sm font-black text-gray-900 block">
                        Quesadilla con Bocadillo (60 g)
                      </span>
                      <span className="text-[11px] text-gray-500 font-semibold">
                        {isBocadilloHabilitado
                          ? `${mQuesadillaBocadillo} quesadillas producidas`
                          : 'No se sacó en este lote'}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-mono font-black text-rose-900 text-base sm:text-lg block">
                      {kilosQuesadillaBocadillo.toFixed(2)} kg
                    </span>
                    <span className="text-[11px] text-rose-700 font-mono">
                      {gramosQuesadillaBocadillo.toLocaleString('es-CO')} g
                    </span>
                  </div>
                </div>

                {/* 4. Quesadilla con Arequipe */}
                <div className="flex items-center justify-between p-3.5 rounded-xl bg-white border border-amber-300 shadow-2xs">
                  <div className="flex items-center gap-3">
                    <span className="w-3 h-3 rounded-full bg-amber-600 shrink-0" />
                    <div>
                      <span className="text-xs sm:text-sm font-black text-gray-900 block">
                        Quesadilla con Arequipe (60 g)
                      </span>
                      <span className="text-[11px] text-gray-500 font-semibold">
                        {isArequipeHabilitado
                          ? `${mQuesadillaArequipe} quesadillas producidas`
                          : 'No se sacó en este lote'}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-mono font-black text-amber-950 text-base sm:text-lg block">
                      {kilosQuesadillaArequipe.toFixed(2)} kg
                    </span>
                    <span className="text-[11px] text-amber-800 font-mono">
                      {gramosQuesadillaArequipe.toLocaleString('es-CO')} g
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

              {/* Detalle de consumo de dulces si hubo quesadillas */}
              {(isBocadilloHabilitado || isArequipeHabilitado) && (
                <div className="mt-3 p-3 rounded-xl bg-white border border-[#D6DEEA] text-xs">
                  <div className="flex items-center gap-1.5 text-[10px] font-black uppercase text-gray-700 tracking-wider mb-1.5">
                    <span className="material-symbols-outlined text-[15px] text-amber-700">
                      cake
                    </span>
                    <span>Consumo de Dulces (Separado de la masa láctea):</span>
                  </div>
                  <div className="flex flex-wrap gap-2 text-[11px] font-mono">
                    {isBocadilloHabilitado && (
                      <span className="px-2 py-1 rounded bg-rose-50 border border-rose-200 text-rose-900 font-bold">
                        Bocadillo gastado: {mQuesadillaBocadillo} {mQuesadillaBocadillo === 1 ? 'unidad' : 'unidades'} de bocadillo
                      </span>
                    )}
                    {isArequipeHabilitado && (
                      <span className="px-2 py-1 rounded bg-amber-50 border border-amber-200 text-amber-900 font-bold">
                        Arequipe gastado: {arequipeGastadoGramos.toLocaleString('es-CO')} g ({mQuesadillaArequipe} quesadillas)
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
                    Rendimiento del Lote ({totalMilk} L de leche fresca)
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
                    Calculado sumando Siete Cueros + Trenza + Quesadillas
                  </span>
                </div>

                {/* 2. Rendimiento del Lote (%) */}
                <div className="p-4 rounded-xl bg-white border border-amber-200 flex flex-col justify-between shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase text-amber-900">
                      Rendimiento del Lote (%)
                    </span>
                    <Badge
                      variant={
                        yieldPercentage >= 10 && yieldPercentage <= 11.5
                          ? 'success'
                          : 'warning'
                      }
                      size="sm"
                    >
                      {yieldPercentage >= 10 && yieldPercentage <= 11.5
                        ? 'Óptimo'
                        : 'Fuera de meta'}
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
                    Meta esperada: 10.0 % – 11.5 % (Solo lectura, bloqueado)
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
