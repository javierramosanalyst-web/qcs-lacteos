import React, { useEffect, useState } from 'react';
import { ManualEditToggle } from '../ui/ManualEditToggle';
import { DerivacionPastaResultante, DerivacionesBatchState } from '../../types';
import { InputField, SelectField, Button, Badge } from '../ui';
import { LOTES_ESPECIA_CATALOG, insumoLabel, getInsumoLoteDetail, useInsumoLotesVersion } from '../../data/insumoLotes';

interface DerivacionesPastaResultanteProps {
  batchId: string;
  /** Lote que se muestra como origen (letras del día). No cambia los códigos de derivación. */
  loteVisible?: string;
  derivaciones?: DerivacionesBatchState;
  onChange?: (derivaciones: DerivacionesBatchState) => void;
  showToast?: (msg: string, type?: 'success' | 'info' | 'warning') => void;
}

export const DerivacionesPastaResultante: React.FC<DerivacionesPastaResultanteProps> = ({
  batchId,
  loteVisible,
  derivaciones,
  onChange,
  showToast,
}) => {
  // Lote base origen (ej: Lote QP-01 o batchId actual)
  const loteBaseOrigen = `Lote ${loteVisible || batchId || 'QP-01'}`;

  // Mini lotes por defecto
  const defaultMexLote = `LOTE-MEX-${batchId.replace(/^QP-?/i, 'BD') || 'BD01'}`;
  const defaultFhLote = `LOTE-FH-${batchId.replace(/^QP-?/i, 'BD') || 'BD01'}`;

  // Estado local para Queso Mexicano (con ají picante y pimienta)
  // Iniciado completamente en 0 / vacío (sin datos prellenados)
  const [mexicano, setMexicano] = useState<DerivacionPastaResultante>(() => {
    if (derivaciones?.mexicano) return derivaciones.mexicano;
    return {
      habilitado: false,
      codigoLote: defaultMexLote,
      loteBaseOrigen,
      pesoInicialGramos: 0,
      pesoFinalGramos: 0,
      pesoUtilizadoGramos: 0,
      moldes100g: 0,
      moldes200g: 0,
      moldes350g: 0,
      edicionManualAvanzada: false,
      especiasMexicano: {
        ajiPicante: {
          pesoInicialGramos: 0,
          pesoFinalGramos: 0,
          pesoUtilizadoGramos: 0,
        },
        pimienta: {
          pesoInicialGramos: 0,
          pesoFinalGramos: 0,
          pesoUtilizadoGramos: 0,
        },
      },
    };
  });

  // Estado local para Queso Finas Hierbas (mezcla de hierbas, sin pimienta)
  // Iniciado completamente en 0 / vacío (sin datos prellenados)
  const [finasHierbas, setFinasHierbas] = useState<DerivacionPastaResultante>(() => {
    if (derivaciones?.finasHierbas) return derivaciones.finasHierbas;
    return {
      habilitado: false,
      codigoLote: defaultFhLote,
      loteBaseOrigen,
      pesoInicialGramos: 0,
      pesoFinalGramos: 0,
      pesoUtilizadoGramos: 0,
      moldes100g: 0,
      moldes200g: 0,
      moldes350g: 0,
      unidades: undefined,
      gramosPorUnidad: 350,
      edicionManualAvanzada: false,
      especiasFinasHierbas: {
        mezclaHierbas: {
          pesoInicialGramos: 0,
          pesoFinalGramos: 0,
          pesoUtilizadoGramos: 0,
        },
      },
    };
  });

  // Sincronizar estado local con props si cambian externamente
  useEffect(() => {
    if (derivaciones?.mexicano) {
      setMexicano(derivaciones.mexicano);
    }
  }, [derivaciones?.mexicano]);

  useEffect(() => {
    if (derivaciones?.finasHierbas) {
      setFinasHierbas(derivaciones.finasHierbas);
    }
  }, [derivaciones?.finasHierbas]);

  const notifyChange = (
    nextMex: DerivacionPastaResultante,
    nextFh: DerivacionPastaResultante
  ) => {
    if (onChange) {
      onChange({
        mexicano: nextMex,
        finasHierbas: nextFh,
      });
    }
  };

  useInsumoLotesVersion();

  const updateMexicano = (partial: Partial<DerivacionPastaResultante>) => {
    setMexicano((prev) => {
      const next = { ...prev, ...partial };
      notifyChange(next, finasHierbas);
      return next;
    });
  };

  const updateFinasHierbas = (partial: Partial<DerivacionPastaResultante>) => {
    setFinasHierbas((prev) => {
      const next = { ...prev, ...partial };
      if (partial.pesoInicialGramos !== undefined || partial.pesoFinalGramos !== undefined) {
        next.pesoUtilizadoGramos = Math.max(0, (next.pesoInicialGramos || 0) - (next.pesoFinalGramos || 0));
        next.especiasFinasHierbas = {
          mezclaHierbas: {
            pesoInicialGramos: next.pesoInicialGramos || 0,
            pesoFinalGramos: next.pesoFinalGramos || 0,
            pesoUtilizadoGramos: next.pesoUtilizadoGramos,
            lote: next.loteEspecia ?? prev.loteEspecia ?? prev.especiasFinasHierbas?.mezclaHierbas?.lote ?? '',
          },
        };
      }
      notifyChange(mexicano, next);
      return next;
    });
  };

  // Cálculos de especias para Mexicano: Ají Picante y Pimienta por separado
  const ajiInicial = mexicano.especiasMexicano?.ajiPicante?.pesoInicialGramos ?? 0;
  const ajiFinal = mexicano.especiasMexicano?.ajiPicante?.pesoFinalGramos ?? 0;
  const ajiConsumido = Math.max(0, ajiInicial - ajiFinal);
  const ajiLote = mexicano.especiasMexicano?.ajiPicante?.lote || '';

  const pimientaInicial = mexicano.especiasMexicano?.pimienta?.pesoInicialGramos ?? 0;
  const pimientaFinal = mexicano.especiasMexicano?.pimienta?.pesoFinalGramos ?? 0;
  const pimientaConsumido = Math.max(0, pimientaInicial - pimientaFinal);
  const pimientaLote = mexicano.especiasMexicano?.pimienta?.lote || '';

  const hierbasLote = finasHierbas.loteEspecia || finasHierbas.especiasFinasHierbas?.mezclaHierbas?.lote || '';

  const mexUtilizadoG = ajiConsumido + pimientaConsumido;
  const mexUtilizadoKg = (mexUtilizadoG / 1000).toFixed(2);

  const handleUpdateAji = (inicial: number, finalVal: number) => {
    const consumido = Math.max(0, inicial - finalVal);
    const nextEspecias = {
      ajiPicante: {
        pesoInicialGramos: inicial,
        pesoFinalGramos: finalVal,
        pesoUtilizadoGramos: consumido,
        lote: ajiLote,
      },
      pimienta: mexicano.especiasMexicano?.pimienta ?? {
        pesoInicialGramos: pimientaInicial,
        pesoFinalGramos: pimientaFinal,
        pesoUtilizadoGramos: pimientaConsumido,
        lote: pimientaLote,
      },
    };
    const totalIn = inicial + nextEspecias.pimienta.pesoInicialGramos;
    const totalFin = finalVal + nextEspecias.pimienta.pesoFinalGramos;
    updateMexicano({
      especiasMexicano: nextEspecias,
      pesoInicialGramos: totalIn,
      pesoFinalGramos: totalFin,
      pesoUtilizadoGramos: Math.max(0, totalIn - totalFin),
    });
  };

  const handleUpdatePimienta = (inicial: number, finalVal: number) => {
    const consumido = Math.max(0, inicial - finalVal);
    const nextEspecias = {
      ajiPicante: mexicano.especiasMexicano?.ajiPicante ?? {
        pesoInicialGramos: ajiInicial,
        pesoFinalGramos: ajiFinal,
        pesoUtilizadoGramos: ajiConsumido,
        lote: ajiLote,
      },
      pimienta: {
        pesoInicialGramos: inicial,
        pesoFinalGramos: finalVal,
        pesoUtilizadoGramos: consumido,
        lote: pimientaLote,
      },
    };
    const totalIn = (nextEspecias.ajiPicante?.pesoInicialGramos || 0) + inicial;
    const totalFin = (nextEspecias.ajiPicante?.pesoFinalGramos || 0) + finalVal;
    updateMexicano({
      especiasMexicano: nextEspecias,
      pesoInicialGramos: totalIn,
      pesoFinalGramos: totalFin,
      pesoUtilizadoGramos: Math.max(0, totalIn - totalFin),
    });
  };

  const handleUpdateAjiLote = (lote: string) => {
    const nextEspecias = {
      ajiPicante: {
        pesoInicialGramos: ajiInicial,
        pesoFinalGramos: ajiFinal,
        pesoUtilizadoGramos: ajiConsumido,
        lote,
      },
      pimienta: mexicano.especiasMexicano?.pimienta ?? {
        pesoInicialGramos: pimientaInicial,
        pesoFinalGramos: pimientaFinal,
        pesoUtilizadoGramos: pimientaConsumido,
        lote: pimientaLote,
      },
    };
    updateMexicano({ especiasMexicano: nextEspecias });
  };

  const handleUpdatePimientaLote = (lote: string) => {
    const nextEspecias = {
      ajiPicante: mexicano.especiasMexicano?.ajiPicante ?? {
        pesoInicialGramos: ajiInicial,
        pesoFinalGramos: ajiFinal,
        pesoUtilizadoGramos: ajiConsumido,
        lote: ajiLote,
      },
      pimienta: {
        pesoInicialGramos: pimientaInicial,
        pesoFinalGramos: pimientaFinal,
        pesoUtilizadoGramos: pimientaConsumido,
        lote,
      },
    };
    updateMexicano({ especiasMexicano: nextEspecias });
  };

  const handleUpdateHierbasLote = (lote: string) => {
    const nextEspecias = {
      mezclaHierbas: {
        pesoInicialGramos: finasHierbas.pesoInicialGramos || 0,
        pesoFinalGramos: finasHierbas.pesoFinalGramos || 0,
        pesoUtilizadoGramos: fhUtilizadoG,
        lote,
      },
    };
    updateFinasHierbas({
      loteEspecia: lote,
      especiasFinasHierbas: nextEspecias,
    });
  };

  const isEspeciaMatching = (code: string, target: 'aji' | 'pimienta' | 'hierba') => {
    const detail = getInsumoLoteDetail('especia', code);
    const text = ((detail?.descripcion || '') + ' ' + code).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (target === 'aji') {
      return text.includes('aji') || text.includes('picante');
    }
    if (target === 'pimienta') {
      return text.includes('pimienta');
    }
    if (target === 'hierba') {
      return text.includes('hierba') || text.includes('fh');
    }
    return false;
  };

  const getFilteredEspeciaOptions = (target: 'aji' | 'pimienta' | 'hierba', currentVal: string) => {
    const matched = LOTES_ESPECIA_CATALOG.filter((code) => isEspeciaMatching(code, target));
    return currentVal && !matched.includes(currentVal) ? [currentVal, ...matched] : matched;
  };

  const optionsAji = getFilteredEspeciaOptions('aji', ajiLote);
  const optionsPimienta = getFilteredEspeciaOptions('pimienta', pimientaLote);
  const optionsHierbas = getFilteredEspeciaOptions('hierba', hierbasLote);

  const handleSaveMexicano = () => {
    if (optionsAji.length > 0 && !ajiLote) {
      if (showToast) showToast('Selecciona el lote de ají picante desde el menú desplegable.', 'warning');
      return;
    }
    if (optionsPimienta.length > 0 && !pimientaLote) {
      if (showToast) showToast('Selecciona el lote de pimienta desde el menú desplegable.', 'warning');
      return;
    }
    updateMexicano({ registroGuardado: true });
    if (showToast) showToast('✓ Registro de Queso Mexicano guardado', 'success');
  };

  const handleSaveFinasHierbas = () => {
    if (optionsHierbas.length > 0 && !hierbasLote) {
      if (showToast) showToast('Selecciona el lote de finas hierbas desde el menú desplegable.', 'warning');
      return;
    }
    updateFinasHierbas({ registroGuardado: true });
    if (showToast) showToast('✓ Registro de Queso Finas Hierbas guardado', 'success');
  };

  // Moldes Mexicano
  const mexSubtotal100g = (mexicano.moldes100g || 0) * 100;
  const mexSubtotal100kg = (mexSubtotal100g / 1000).toFixed(2);
  const mexSubtotal200g = (mexicano.moldes200g || 0) * 200;
  const mexSubtotal200kg = (mexSubtotal200g / 1000).toFixed(2);
  const mexSubtotal350g = (mexicano.moldes350g || 0) * 350;
  const mexSubtotal350kg = (mexSubtotal350g / 1000).toFixed(2);

  // Cálculos para Finas Hierbas (mezcla hierbas, sin pimienta)
  const fhUtilizadoG = Math.max(
    0,
    (finasHierbas.pesoInicialGramos || 0) - (finasHierbas.pesoFinalGramos || 0)
  );
  const fhUtilizadoKg = (fhUtilizadoG / 1000).toFixed(2);
  const fhSubtotal100g = (finasHierbas.moldes100g || 0) * 100;
  const fhSubtotal100kg = (fhSubtotal100g / 1000).toFixed(2);
  const fhSubtotal200g = (finasHierbas.moldes200g || 0) * 200;
  const fhSubtotal200kg = (fhSubtotal200g / 1000).toFixed(2);
  const fhSubtotal350g = (finasHierbas.moldes350g || 0) * 350;
  const fhSubtotal350kg = (fhSubtotal350g / 1000).toFixed(2);

  return (
    <div className="flex flex-col gap-5 w-full">
      {/* =========================================================================
          BLOQUE 1: QUESO MEXICANO (TEMA VISUAL: NARANJA / AMARILLO)
      ========================================================================= */}
      {!mexicano.habilitado ? (
        /* ESTADO INACTIVO: QUESO MEXICANO */
        <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-xs border border-amber-200 transition-all hover:border-amber-300">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-800 border border-amber-300 flex items-center justify-center shrink-0 shadow-2xs">
                <span className="material-symbols-outlined text-[26px]">local_fire_department</span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-amber-900 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-300 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                    DERIVACIÓN DE PASTA RESULTANTE
                  </span>
                  <Badge variant="neutral" size="sm">
                    OPCIONAL · INACTIVO
                  </Badge>
                </div>
                <h3 className="text-xl font-bold text-[#191c1e] mt-1">
                  Producción de Queso Mexicano
                </h3>
                <p className="text-xs text-[#434655]">
                  Fraccionamiento opcional de masa hilada con condimentos y picante para moldear Queso Mexicano.
                </p>
              </div>
            </div>

            <Button
              variant="warning"
              size="md"
              icon="add_circle"
              onClick={() => {
                updateMexicano({ habilitado: true });
                if (showToast) {
                  showToast('✓ Sección de Producción de Queso Mexicano habilitada', 'info');
                }
              }}
            >
              [+] Habilitar Queso Mexicano
            </Button>
          </div>
        </div>
      ) : (
        /* ESTADO ACTIVO: QUESO MEXICANO (TEMA VISUAL: NARANJA / AMARILLO) */
        <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-sm border-2 border-amber-400 transition-all flex flex-col gap-5">
          {/* Cabecera con botón para desactivar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-amber-200">
            <div className="flex items-center gap-3.5">
              <div className="w-13 h-13 rounded-2xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                <span className="material-symbols-outlined text-[28px]">local_fire_department</span>
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-amber-900 bg-amber-100 px-2.5 py-0.5 rounded-full border border-amber-300 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-600 animate-pulse"></span>
                    DERIVACIÓN DE PASTA RESULTANTE
                  </span>
                  <Badge variant="warning" size="sm">
                    ACTIVO · EN PROCESO
                  </Badge>
                </div>
                <h3 className="text-xl sm:text-2xl font-black text-gray-950 mt-1">
                  Producción de Queso Mexicano
                </h3>
                <p className="text-xs text-gray-600">
                  Pesaje en gramos de la masa separada, cálculo automático de masa utilizada y distribución en moldes.
                </p>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              icon="close"
              onClick={() => {
                updateMexicano({ habilitado: false });
                if (showToast) {
                  showToast('Sección de Queso Mexicano desactivada', 'info');
                }
              }}
              className="text-amber-900 hover:text-red-700 hover:bg-red-50 border-amber-300 hover:border-red-300"
            >
              [x] Desactivar Mexicano
            </Button>
          </div>

          <fieldset disabled={Boolean(mexicano.registroGuardado)} className="contents">
          {/* Sección Lote: Mini Lote generado por el sistema y origen */}
          <div className="bg-amber-50/80 p-4 rounded-xl border border-amber-300 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-2xs">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-amber-700 text-[26px]">qr_code_2</span>
              <div>
                <div className="text-[10px] font-black uppercase text-amber-900 tracking-wider">
                  MINI LOTE GENERADO POR EL SISTEMA
                </div>
                {mexicano.edicionManualAvanzada ? (
                  <InputField
                    type="text"
                    value={mexicano.codigoLote}
                    onChange={(e) => updateMexicano({ codigoLote: e.target.value })}
                    containerClassName="mt-1"
                  />
                ) : (
                  <div className="text-lg font-black font-mono text-amber-950 mt-0.5">
                    {mexicano.codigoLote}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 bg-white px-3.5 py-2 rounded-xl border border-amber-200 self-start md:self-auto shadow-2xs">
              <span className="material-symbols-outlined text-amber-700 text-[18px]">account_tree</span>
              <span className="text-xs font-bold text-amber-950">
                Derivado del lote base: <span className="font-mono text-amber-800">{loteBaseOrigen}</span>
              </span>
            </div>
          </div>

          {/* Variables de Pesaje de Especias (Ají Picante y Pimienta por separado) */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between pb-1 border-b border-amber-200">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-amber-700 text-[18px]">grain</span>
                <span className="text-xs font-black uppercase text-amber-950 tracking-wider">
                  Insumos y Especias: Ají Picante y Pimienta (Registro Individual)
                </span>
              </div>
              <Badge variant="warning" size="sm">
                Consumo por separado
              </Badge>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Especia 1: AJÍ PICANTE */}
              <div className="p-4 rounded-xl bg-[#FFFFFF] border-2 border-orange-300 shadow-2xs flex flex-col justify-between gap-3">
                <div className="flex items-center justify-between pb-2 border-b border-orange-200">
                  <span className="text-xs font-black uppercase text-orange-950 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-orange-600 text-[18px]">local_fire_department</span>
                    Ají Picante
                  </span>
                  <span className="text-[10px] font-mono font-bold text-orange-900 bg-orange-100 px-2 py-0.5 rounded border border-orange-300">
                    Consumo: {ajiConsumido} g
                  </span>
                </div>

                <SelectField
                  label="Lote de Ají Picante"
                  icon="qr_code_2"
                  value={ajiLote}
                  placeholder={optionsAji.length === 0 ? "Sin lotes de ají picante en BD" : "Seleccionar Lote de Ají Picante"}
                  options={optionsAji.map((lt) => ({
                    value: lt,
                    label: insumoLabel('especia', lt) !== lt ? insumoLabel('especia', lt) : `Lote ${lt}`,
                  }))}
                  onChange={(e) => handleUpdateAjiLote(e.target.value)}
                />

                <div className="grid grid-cols-2 gap-3">
                  <InputField
                    label="Peso Inicial (g)"
                    type="number"
                    inputMode="numeric"
                    min="0"
                    step="5"
                    placeholder="Ej: 100"
                    unit="g"
                    value={ajiInicial > 0 ? ajiInicial : ''}
                    onChange={(e) =>
                      handleUpdateAji(
                        Math.max(0, parseInt(e.target.value, 10) || 0),
                        ajiFinal
                      )
                    }
                  />

                  <InputField
                    label="Peso Final / Sobrante (g)"
                    type="number"
                    inputMode="numeric"
                    min="0"
                    step="5"
                    placeholder="Ej: 20"
                    unit="g"
                    value={ajiFinal > 0 ? ajiFinal : ''}
                    onChange={(e) =>
                      handleUpdateAji(
                        ajiInicial,
                        Math.max(0, parseInt(e.target.value, 10) || 0)
                      )
                    }
                  />
                </div>

                <div className="pt-2 border-t border-orange-200 flex items-center justify-between text-xs">
                  <span className="text-gray-600 font-medium">Ají Picante gastado:</span>
                  <span className="font-mono font-black text-orange-900">{ajiConsumido} g</span>
                </div>
              </div>

              {/* Especia 2: PIMIENTA */}
              <div className="p-4 rounded-xl bg-[#FFFFFF] border-2 border-amber-300 shadow-2xs flex flex-col justify-between gap-3">
                <div className="flex items-center justify-between pb-2 border-b border-amber-200">
                  <span className="text-xs font-black uppercase text-amber-950 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-amber-800 text-[18px]">grain</span>
                    Pimienta
                  </span>
                  <span className="text-[10px] font-mono font-bold text-amber-900 bg-amber-100 px-2 py-0.5 rounded border border-amber-300">
                    Consumo: {pimientaConsumido} g
                  </span>
                </div>

                <SelectField
                  label="Lote de Pimienta"
                  icon="qr_code_2"
                  value={pimientaLote}
                  placeholder={optionsPimienta.length === 0 ? "Sin lotes de pimienta en BD" : "Seleccionar Lote de Pimienta"}
                  options={optionsPimienta.map((lt) => ({
                    value: lt,
                    label: insumoLabel('especia', lt) !== lt ? insumoLabel('especia', lt) : `Lote ${lt}`,
                  }))}
                  onChange={(e) => handleUpdatePimientaLote(e.target.value)}
                />

                <div className="grid grid-cols-2 gap-3">
                  <InputField
                    label="Peso Inicial (g)"
                    type="number"
                    inputMode="numeric"
                    min="0"
                    step="5"
                    placeholder="Ej: 100"
                    unit="g"
                    value={pimientaInicial > 0 ? pimientaInicial : ''}
                    onChange={(e) =>
                      handleUpdatePimienta(
                        Math.max(0, parseInt(e.target.value, 10) || 0),
                        pimientaFinal
                      )
                    }
                  />

                  <InputField
                    label="Peso Final / Sobrante (g)"
                    type="number"
                    inputMode="numeric"
                    min="0"
                    step="5"
                    placeholder="Ej: 15"
                    unit="g"
                    value={pimientaFinal > 0 ? pimientaFinal : ''}
                    onChange={(e) =>
                      handleUpdatePimienta(
                        pimientaInicial,
                        Math.max(0, parseInt(e.target.value, 10) || 0)
                      )
                    }
                  />
                </div>

                <div className="pt-2 border-t border-amber-200 flex items-center justify-between text-xs">
                  <span className="text-gray-600 font-medium">Pimienta gastada:</span>
                  <span className="font-mono font-black text-amber-900">{pimientaConsumido} g</span>
                </div>
              </div>
            </div>

            {/* Resumen de especias Mexicano por separado */}
            <div className="p-3.5 bg-amber-50/95 rounded-xl border-2 border-amber-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
              <div className="flex flex-wrap items-center gap-2">
                <span className="material-symbols-outlined text-amber-800 text-[20px]">science</span>
                <span className="text-xs font-black uppercase text-amber-950 tracking-wider">
                  Resumen de Especias Mexicano (Consumo por Separado):
                </span>
                <div className="flex flex-wrap items-center gap-2 ml-1">
                  <span className="text-xs bg-white px-2.5 py-1 rounded-lg border border-orange-300 font-bold text-orange-950">
                    Ají Picante: <strong className="font-mono text-orange-900 font-black">{ajiConsumido} g</strong>
                    {ajiLote && (
                      <span className="text-[10px] font-mono text-orange-800 ml-1 font-semibold">
                        (Lote: {ajiLote})
                      </span>
                    )}
                  </span>
                  <span className="text-xs bg-white px-2.5 py-1 rounded-lg border border-amber-300 font-bold text-amber-950">
                    Pimienta: <strong className="font-mono text-amber-900 font-black">{pimientaConsumido} g</strong>
                    {pimientaLote && (
                      <span className="text-[10px] font-mono text-amber-800 ml-1 font-semibold">
                        (Lote: {pimientaLote})
                      </span>
                    )}
                  </span>
                </div>
              </div>
              <span className="text-xs font-mono font-black text-amber-950 bg-amber-200/80 px-3 py-1 rounded-lg border border-amber-300 self-start sm:self-auto">
                Total Especias Mexicano: {mexUtilizadoG} g ({mexUtilizadoKg} kg)
              </span>
            </div>
          </div>

          {/* Moldes Obtenidos: Tres formatos (100 G, 200 G y 350 G) */}
          <div className="mt-1">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-amber-700 text-[20px]">inventory_2</span>
                <span className="text-xs font-black uppercase tracking-wider text-gray-900">
                  Unidades Obtenidas (Masa de Queso Mexicano)
                </span>
              </div>
              <span className="text-xs font-mono font-bold text-amber-900 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200">
                Total Queso: {(mexicano.moldes100g || 0) + (mexicano.moldes200g || 0) + (mexicano.moldes350g || 0)} unidades · {((mexSubtotal100g + mexSubtotal200g + mexSubtotal350g) / 1000).toFixed(2)} kg
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              {/* Formato 100 G */}
              <div className="p-4 rounded-xl bg-[#FFFFFF] border border-amber-300 flex flex-col justify-between shadow-2xs hover:border-amber-400 transition-all gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-gray-900">Formato 100 G</span>
                  <span className="text-[10px] font-mono font-bold bg-amber-100 text-amber-900 px-2 py-0.5 rounded border border-amber-200">
                    0.10 kg / molde
                  </span>
                </div>
                <InputField
                  label="Cantidad de unidades (100 g)"
                  type="number"
                  inputMode="numeric"
                  min="0"
                  step="1"
                  placeholder="Ej: 10"
                  unit="unid"
                  value={mexicano.moldes100g > 0 ? mexicano.moldes100g : ''}
                  onChange={(e) => {
                    const val = Math.max(0, parseInt(e.target.value, 10) || 0);
                    updateMexicano({ moldes100g: val });
                  }}
                />
                <div className="pt-2 border-t border-amber-100 text-xs font-bold text-amber-900">
                  Subtotal: <span className="font-mono">{mexSubtotal100g.toLocaleString('es-CO')} g ({mexSubtotal100kg} kg)</span>
                </div>
              </div>

              {/* Formato 200 G */}
              <div className="p-4 rounded-xl bg-[#FFFFFF] border border-amber-300 flex flex-col justify-between shadow-2xs hover:border-amber-400 transition-all gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-gray-900">Formato 200 G</span>
                  <span className="text-[10px] font-mono font-bold bg-amber-100 text-amber-900 px-2 py-0.5 rounded border border-amber-200">
                    0.20 kg / molde
                  </span>
                </div>
                <InputField
                  label="Cantidad de unidades (200 g)"
                  type="number"
                  inputMode="numeric"
                  min="0"
                  step="1"
                  placeholder="Ej: 10"
                  unit="unid"
                  value={mexicano.moldes200g > 0 ? mexicano.moldes200g : ''}
                  onChange={(e) => {
                    const val = Math.max(0, parseInt(e.target.value, 10) || 0);
                    updateMexicano({ moldes200g: val });
                  }}
                />
                <div className="pt-2 border-t border-amber-100 text-xs font-bold text-amber-900">
                  Subtotal: <span className="font-mono">{mexSubtotal200g.toLocaleString('es-CO')} g ({mexSubtotal200kg} kg)</span>
                </div>
              </div>

              {/* Formato 350 G */}
              <div className="p-4 rounded-xl bg-[#FFFFFF] border border-amber-300 flex flex-col justify-between shadow-2xs hover:border-amber-400 transition-all gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-gray-900">Formato 350 G</span>
                  <span className="text-[10px] font-mono font-bold bg-amber-100 text-amber-900 px-2 py-0.5 rounded border border-amber-200">
                    0.35 kg / molde
                  </span>
                </div>
                <InputField
                  label="Cantidad de unidades (350 g)"
                  type="number"
                  inputMode="numeric"
                  min="0"
                  step="1"
                  placeholder="Ej: 10"
                  unit="unid"
                  value={mexicano.moldes350g > 0 ? mexicano.moldes350g : ''}
                  onChange={(e) => {
                    const val = Math.max(0, parseInt(e.target.value, 10) || 0);
                    updateMexicano({ moldes350g: val });
                  }}
                />
                <div className="pt-2 border-t border-amber-100 text-xs font-bold text-amber-900">
                  Subtotal: <span className="font-mono">{mexSubtotal350g.toLocaleString('es-CO')} g ({mexSubtotal350kg} kg)</span>
                </div>
              </div>
            </div>
          </div>

          </fieldset>

          <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/50 flex items-center gap-2.5 text-xs text-[#434655]">
            <span className="material-symbols-outlined text-[24px] text-amber-700 shrink-0">inventory_2</span>
            <div>
              <span className="font-black text-gray-900 block">Total en moldes de Queso Mexicano:</span>
              <span className="text-xs text-gray-700">
                <strong className="text-amber-900 font-mono">{(mexicano.moldes100g || 0) + (mexicano.moldes200g || 0) + (mexicano.moldes350g || 0)} unidades</strong>{' '}
                ({mexicano.moldes100g || 0} de 100 g + {mexicano.moldes200g || 0} de 200 g + {mexicano.moldes350g || 0} de 350 g) ={' '}
                <strong className="text-emerald-800 font-mono">{((mexSubtotal100g + mexSubtotal200g + mexSubtotal350g) / 1000).toFixed(2)} kg</strong>{' '}
                de queso.
              </span>
            </div>
          </div>

          {/* Botón de acción principal inferior derecho: Guardar Registro Mexicano */}
          <div className="flex justify-end pt-2 pb-1">
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button
                variant={mexicano.registroGuardado ? 'success' : 'warning'}
                size="md"
                icon={mexicano.registroGuardado ? 'check_circle' : 'save'}
                disabled={Boolean(mexicano.registroGuardado)}
                className="disabled:opacity-100"
                onClick={handleSaveMexicano}
              >
                {mexicano.registroGuardado ? 'Registro Guardado' : 'Guardar Registro Mexicano'}
              </Button>
              {mexicano.registroGuardado && (
                <Button
                  variant="outline"
                  size="md"
                  icon="edit"
                  onClick={() => {
                  updateMexicano({ registroGuardado: false });
                  if (showToast) showToast('Registro de Queso Mexicano habilitado para modificar', 'info');
                }}
                >
                  Editar
                </Button>
              )}
            </div>
          </div>

          {/* Restricción: Checkbox para habilitar edición manual avanzada al final */}
          <div className="pt-3 border-t border-amber-200 flex items-center justify-between">
            <ManualEditToggle manual={Boolean(mexicano.edicionManualAvanzada)} onChange={(checked: boolean) => updateMexicano({ edicionManualAvanzada: checked })} />
            <span className="text-[11px] text-gray-500 italic hidden sm:inline">
              Queso Mexicano derivado
            </span>
          </div>
        </div>
      )}

      {/* =========================================================================
          BLOQUE 2: QUESO FINAS HIERBAS (TEMA VISUAL: VERDE)
      ========================================================================= */}
      {!finasHierbas.habilitado ? (
        /* ESTADO INACTIVO: QUESO FINAS HIERBAS */
        <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-xs border border-emerald-200 transition-all hover:border-emerald-300">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center justify-center shrink-0 shadow-2xs">
                <span className="material-symbols-outlined text-[26px]">spa</span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-emerald-900 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-300 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    DERIVACIÓN DE PASTA RESULTANTE
                  </span>
                  <Badge variant="neutral" size="sm">
                    OPCIONAL · INACTIVO
                  </Badge>
                </div>
                <h3 className="text-xl font-bold text-[#191c1e] mt-1">
                  Producción de Queso Finas Hierbas
                </h3>
                <p className="text-xs text-[#434655]">
                  Fraccionamiento opcional de masa hilada con mezcla de finas hierbas deshidratadas para moldeo.
                </p>
              </div>
            </div>

            <Button
              variant="primary"
              size="md"
              icon="add_circle"
              onClick={() => {
                updateFinasHierbas({ habilitado: true });
                if (showToast) {
                  showToast('✓ Sección de Producción de Queso Finas Hierbas habilitada', 'info');
                }
              }}
            >
              [+] Habilitar Finas Hierbas
            </Button>
          </div>
        </div>
      ) : (
        /* ESTADO ACTIVO: QUESO FINAS HIERBAS (TEMA VISUAL: VERDE) */
        <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-sm border-2 border-emerald-400 transition-all flex flex-col gap-5">
          {/* Cabecera con botón para desactivar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-emerald-200">
            <div className="flex items-center gap-3.5">
              <div className="w-13 h-13 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                <span className="material-symbols-outlined text-[28px]">spa</span>
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-emerald-900 bg-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-300 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse"></span>
                    DERIVACIÓN DE PASTA RESULTANTE
                  </span>
                  <Badge variant="success" size="sm">
                    ACTIVO · EN PROCESO
                  </Badge>
                </div>
                <h3 className="text-xl sm:text-2xl font-black text-gray-950 mt-1">
                  Producción de Queso Finas Hierbas
                </h3>
                <p className="text-xs text-gray-600">
                  Pesaje en gramos de la masa separada, cálculo automático de masa utilizada y distribución en moldes.
                </p>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              icon="close"
              onClick={() => {
                updateFinasHierbas({ habilitado: false });
                if (showToast) {
                  showToast('Sección de Queso Finas Hierbas desactivada', 'info');
                }
              }}
              className="text-emerald-950 hover:text-red-700 hover:bg-red-50 border-emerald-300 hover:border-red-300"
            >
              [x] Desactivar Finas Hierbas
            </Button>
          </div>

          <fieldset disabled={Boolean(finasHierbas.registroGuardado)} className="contents">
          {/* Sección Lote: Mini Lote generado por el sistema y origen */}
          <div className="bg-emerald-50/80 p-4 rounded-xl border border-emerald-300 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-2xs">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-emerald-700 text-[26px]">qr_code_2</span>
              <div>
                <div className="text-[10px] font-black uppercase text-emerald-900 tracking-wider">
                  MINI LOTE GENERADO POR EL SISTEMA
                </div>
                {finasHierbas.edicionManualAvanzada ? (
                  <InputField
                    type="text"
                    value={finasHierbas.codigoLote}
                    onChange={(e) => updateFinasHierbas({ codigoLote: e.target.value })}
                    containerClassName="mt-1"
                  />
                ) : (
                  <div className="text-lg font-black font-mono text-emerald-950 mt-0.5">
                    {finasHierbas.codigoLote}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 bg-white px-3.5 py-2 rounded-xl border border-emerald-200 self-start md:self-auto shadow-2xs">
              <span className="material-symbols-outlined text-emerald-700 text-[18px]">account_tree</span>
              <span className="text-xs font-bold text-emerald-950">
                Derivado del lote base: <span className="font-mono text-emerald-800">{loteBaseOrigen}</span>
              </span>
            </div>
          </div>

          {/* Banner de regla de ingredientes: La pimienta NO aplica a Finas Hierbas */}
          <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-300 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-emerald-700 text-[20px]">info</span>
              <span className="text-xs font-bold text-emerald-950">
                Formulación de Finas Hierbas:
              </span>
              <span className="text-xs text-emerald-900 font-medium">
                La pimienta <strong>NO aplica</strong> a Finas Hierbas. Solo se utiliza mezcla de hierbas deshidratadas.
              </span>
            </div>
            <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-200 text-emerald-950 px-2 py-0.5 rounded-full border border-emerald-300 shrink-0">
              Sin Pimienta
            </span>
          </div>

          {/* Lote Insumo Mezcla Finas Hierbas */}
          <div className="bg-emerald-50/80 p-3.5 rounded-xl border border-emerald-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
            <div className="flex-1 max-w-md">
              <SelectField
                label="Lote de Mezcla Finas Hierbas"
                icon="qr_code_2"
                value={hierbasLote}
                placeholder={optionsHierbas.length === 0 ? "Sin lotes de finas hierbas en BD" : "Seleccionar Lote de Finas Hierbas"}
                options={optionsHierbas.map((lt) => ({
                  value: lt,
                  label: insumoLabel('especia', lt) !== lt ? insumoLabel('especia', lt) : `Lote ${lt}`,
                }))}
                onChange={(e) => handleUpdateHierbasLote(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2 text-xs text-emerald-950 font-medium">
              <span className="material-symbols-outlined text-emerald-700 text-[18px]">verified</span>
              <span>Lote oficial desde BD de insumos</span>
            </div>
          </div>

          {/* Variables de Pesaje (Regla Estricta de Gramos) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Campo 1: PESO INICIAL DE FINAS HIERBAS (ESPECIAS) */}
            <div className="p-4 sm:p-5 rounded-2xl bg-[#FFFFFF] border-2 border-emerald-200 shadow-2xs flex flex-col justify-between gap-3">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[10px] sm:text-[11px] font-black uppercase text-emerald-900 tracking-wider">
                    PESO INICIAL FINAS HIERBAS
                  </label>
                  <span className="bg-emerald-100 text-emerald-900 px-2 py-0.5 rounded-md font-mono text-[10px] font-bold border border-emerald-300">
                    OBLIGATORIO (g)
                  </span>
                </div>
                <InputField
                  label="Insumo dispuesto"
                  type="number"
                  inputMode="numeric"
                  min="0"
                  step="10"
                  placeholder="Ej: 500"
                  unit="g"
                  value={finasHierbas.pesoInicialGramos > 0 ? finasHierbas.pesoInicialGramos : ''}
                  onChange={(e) => {
                    const val = Math.max(0, parseInt(e.target.value, 10) || 0);
                    updateFinasHierbas({ pesoInicialGramos: val });
                  }}
                />
              </div>
              <div className="pt-2.5 border-t border-emerald-200 flex items-center justify-between">
                <span className="text-xs font-bold text-gray-600">
                  Equivalente: <strong className="font-mono text-emerald-900">{((finasHierbas.pesoInicialGramos || 0) / 1000).toFixed(2)} kg</strong>
                </span>
                <span className="text-[10px] text-gray-400">Insumo dispuesto</span>
              </div>
            </div>

            {/* Campo 2: PESO FINAL / SOBRANTE DE FINAS HIERBAS */}
            <div className="p-4 sm:p-5 rounded-2xl bg-[#FFFFFF] border-2 border-emerald-200 shadow-2xs flex flex-col justify-between gap-3">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[10px] sm:text-[11px] font-black uppercase text-emerald-900 tracking-wider">
                    PESO FINAL / SOBRANTE
                  </label>
                  <span className="bg-emerald-100 text-emerald-900 px-2 py-0.5 rounded-md font-mono text-[10px] font-bold border border-emerald-300">
                    OBLIGATORIO (g)
                  </span>
                </div>
                <InputField
                  label="Insumo no utilizado"
                  type="number"
                  inputMode="numeric"
                  min="0"
                  step="10"
                  placeholder="Ej: 100"
                  unit="g"
                  value={finasHierbas.pesoFinalGramos > 0 ? finasHierbas.pesoFinalGramos : ''}
                  onChange={(e) => {
                    const val = Math.max(0, parseInt(e.target.value, 10) || 0);
                    updateFinasHierbas({ pesoFinalGramos: val });
                  }}
                />
              </div>
              <div className="pt-2.5 border-t border-emerald-200 flex items-center justify-between">
                <span className="text-xs font-bold text-gray-600">
                  Equivalente: <strong className="font-mono text-emerald-900">{((finasHierbas.pesoFinalGramos || 0) / 1000).toFixed(2)} kg</strong>
                </span>
                <span className="text-[10px] text-gray-400">Insumo no utilizado</span>
              </div>
            </div>

            {/* Campo 3: FINAS HIERBAS CONSUMIDAS (Calculado con fórmula matemática) */}
            <div className="p-4 sm:p-5 rounded-2xl bg-emerald-500/10 border-2 border-emerald-400 shadow-2xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[10px] sm:text-[11px] font-black uppercase text-emerald-950 tracking-wider">
                    FINAS HIERBAS CONSUMIDAS (Insumo)
                  </label>
                  <Badge variant="success" size="sm">
                    CONSUMO ESPECIAS
                  </Badge>
                </div>
                <div className="mt-2 text-2xl sm:text-3xl font-black font-mono text-emerald-950">
                  {fhUtilizadoG.toLocaleString('es-CO')} g{' '}
                  <span className="text-lg sm:text-xl font-bold text-emerald-800">
                    ({fhUtilizadoKg} kg)
                  </span>
                </div>
              </div>
              <div className="mt-3 pt-2.5 border-t border-emerald-300 flex flex-col gap-1">
                <div className="text-[11px] font-mono font-bold text-emerald-900 bg-white/70 px-2.5 py-1 rounded-lg border border-emerald-200 truncate">
                  Fórmula: {finasHierbas.pesoInicialGramos || 0} g - {finasHierbas.pesoFinalGramos || 0} g = {fhUtilizadoG} g de finas hierbas
                </div>
                {hierbasLote && (
                  <div className="text-[10px] font-mono text-emerald-800 font-bold">
                    Lote especia: {hierbasLote}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Unidades Obtenidas: Campo de unidades + formatos */}
          <div className="mt-1 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-emerald-700 text-[20px]">inventory_2</span>
                <span className="text-xs font-black uppercase tracking-wider text-gray-900">
                  Unidades Obtenidas (Masa de Queso Finas Hierbas)
                </span>
              </div>
              <span className="text-xs font-mono font-bold text-emerald-900 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                Total Queso Finas Hierbas: {finasHierbas.unidades !== undefined ? finasHierbas.unidades : ((finasHierbas.moldes100g || 0) + (finasHierbas.moldes200g || 0) + (finasHierbas.moldes350g || 0))} unidades · {((finasHierbas.unidades !== undefined ? finasHierbas.unidades * (finasHierbas.gramosPorUnidad || 350) : (fhSubtotal100g + fhSubtotal200g + fhSubtotal350g)) / 1000).toFixed(2)} kg
              </span>
            </div>

            {/* Tarjeta destacada de Unidades de Finas Hierbas */}
            <div className="p-4 sm:p-5 rounded-2xl bg-emerald-50/70 border-2 border-emerald-400 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex-1 max-w-sm">
                <InputField
                  label="Cantidad de Unidades (Finas Hierbas)"
                  type="number"
                  inputMode="numeric"
                  min="0"
                  step="1"
                  placeholder="Ej: 10"
                  unit="unid"
                  value={
                    finasHierbas.unidades !== undefined && finasHierbas.unidades > 0
                      ? finasHierbas.unidades
                      : ((finasHierbas.moldes100g || 0) + (finasHierbas.moldes200g || 0) + (finasHierbas.moldes350g || 0)) > 0
                      ? ((finasHierbas.moldes100g || 0) + (finasHierbas.moldes200g || 0) + (finasHierbas.moldes350g || 0))
                      : ''
                  }
                  readOnly
                  onChange={() => undefined}
                  hint="Se calcula automáticamente con los formatos de abajo (100 g, 200 g y 350 g)."
                />
              </div>

              <div className="bg-white p-3 rounded-xl border border-emerald-300 shadow-2xs flex flex-col items-end shrink-0">
                <span className="text-[10px] uppercase font-bold text-gray-500">Masa total Finas Hierbas</span>
                <span className="font-mono font-black text-emerald-900 text-lg sm:text-xl">
                  {((finasHierbas.unidades !== undefined ? finasHierbas.unidades * (finasHierbas.gramosPorUnidad || 350) : (fhSubtotal100g + fhSubtotal200g + fhSubtotal350g))).toLocaleString('es-CO')} g
                </span>
                <span className="text-xs font-mono font-bold text-emerald-700">
                  {(((finasHierbas.unidades !== undefined ? finasHierbas.unidades * (finasHierbas.gramosPorUnidad || 350) : (fhSubtotal100g + fhSubtotal200g + fhSubtotal350g))) / 1000).toFixed(2)} kg
                </span>
              </div>
            </div>

            {/* Desglose opcional por formatos */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              {/* Formato 100 G */}
              <div className="p-3.5 rounded-xl bg-[#FFFFFF] border border-emerald-300 flex flex-col justify-between shadow-2xs hover:border-emerald-400 transition-all gap-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-gray-900">Formato 100 G</span>
                  <span className="text-[10px] font-mono font-bold bg-emerald-100 text-emerald-900 px-2 py-0.5 rounded border border-emerald-200">
                    0.10 kg / molde
                  </span>
                </div>
                <InputField
                  label="Cantidad de unidades (100 g)"
                  type="number"
                  inputMode="numeric"
                  min="0"
                  step="1"
                  placeholder="Ej: 10"
                  unit="unid"
                  value={finasHierbas.moldes100g > 0 ? finasHierbas.moldes100g : ''}
                  onChange={(e) => {
                    const val = Math.max(0, parseInt(e.target.value, 10) || 0);
                    const nextTotal = val + (finasHierbas.moldes200g || 0) + (finasHierbas.moldes350g || 0);
                    updateFinasHierbas({ moldes100g: val, unidades: nextTotal });
                  }}
                />
                <div className="pt-2 border-t border-emerald-100 text-xs font-bold text-emerald-900">
                  Subtotal: <span className="font-mono">{fhSubtotal100g.toLocaleString('es-CO')} g ({fhSubtotal100kg} kg)</span>
                </div>
              </div>

              {/* Formato 200 G */}
              <div className="p-3.5 rounded-xl bg-[#FFFFFF] border border-emerald-300 flex flex-col justify-between shadow-2xs hover:border-emerald-400 transition-all gap-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-gray-900">Formato 200 G</span>
                  <span className="text-[10px] font-mono font-bold bg-emerald-100 text-emerald-900 px-2 py-0.5 rounded border border-emerald-200">
                    0.20 kg / molde
                  </span>
                </div>
                <InputField
                  label="Cantidad de unidades (200 g)"
                  type="number"
                  inputMode="numeric"
                  min="0"
                  step="1"
                  placeholder="Ej: 10"
                  unit="unid"
                  value={finasHierbas.moldes200g > 0 ? finasHierbas.moldes200g : ''}
                  onChange={(e) => {
                    const val = Math.max(0, parseInt(e.target.value, 10) || 0);
                    const nextTotal = (finasHierbas.moldes100g || 0) + val + (finasHierbas.moldes350g || 0);
                    updateFinasHierbas({ moldes200g: val, unidades: nextTotal });
                  }}
                />
                <div className="pt-2 border-t border-emerald-100 text-xs font-bold text-emerald-900">
                  Subtotal: <span className="font-mono">{fhSubtotal200g.toLocaleString('es-CO')} g ({fhSubtotal200kg} kg)</span>
                </div>
              </div>

              {/* Formato 350 G */}
              <div className="p-3.5 rounded-xl bg-[#FFFFFF] border border-emerald-300 flex flex-col justify-between shadow-2xs hover:border-emerald-400 transition-all gap-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-gray-900">Formato 350 G</span>
                  <span className="text-[10px] font-mono font-bold bg-emerald-100 text-emerald-900 px-2 py-0.5 rounded border border-emerald-200">
                    0.35 kg / molde
                  </span>
                </div>
                <InputField
                  label="Cantidad de unidades (350 g)"
                  type="number"
                  inputMode="numeric"
                  min="0"
                  step="1"
                  placeholder="Ej: 10"
                  unit="unid"
                  value={finasHierbas.moldes350g > 0 ? finasHierbas.moldes350g : ''}
                  onChange={(e) => {
                    const val = Math.max(0, parseInt(e.target.value, 10) || 0);
                    const nextTotal = (finasHierbas.moldes100g || 0) + (finasHierbas.moldes200g || 0) + val;
                    updateFinasHierbas({ moldes350g: val, unidades: nextTotal });
                  }}
                />
                <div className="pt-2 border-t border-emerald-100 text-xs font-bold text-emerald-900">
                  Subtotal: <span className="font-mono">{fhSubtotal350g.toLocaleString('es-CO')} g ({fhSubtotal350kg} kg)</span>
                </div>
              </div>
            </div>
          </div>

          </fieldset>

          <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/50 flex items-center gap-2.5 text-xs text-[#434655]">
            <span className="material-symbols-outlined text-[24px] text-emerald-700 shrink-0">inventory_2</span>
            <div>
              <span className="font-black text-gray-900 block">Total en moldes de Queso Finas Hierbas:</span>
              <span className="text-xs text-gray-700">
                <strong className="text-emerald-900 font-mono">{(finasHierbas.moldes100g || 0) + (finasHierbas.moldes200g || 0) + (finasHierbas.moldes350g || 0)} unidades</strong>{' '}
                ({finasHierbas.moldes100g || 0} de 100 g + {finasHierbas.moldes200g || 0} de 200 g + {finasHierbas.moldes350g || 0} de 350 g) ={' '}
                <strong className="text-emerald-800 font-mono">{((fhSubtotal100g + fhSubtotal200g + fhSubtotal350g) / 1000).toFixed(2)} kg</strong>{' '}
                de queso.
              </span>
            </div>
          </div>

          {/* Botón de acción principal inferior derecho: Guardar Registro Finas Hierbas */}
          <div className="flex justify-end pt-2 pb-1">
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button
                variant={finasHierbas.registroGuardado ? 'success' : 'primary'}
                size="md"
                icon={finasHierbas.registroGuardado ? 'check_circle' : 'save'}
                disabled={Boolean(finasHierbas.registroGuardado)}
                className="disabled:opacity-100"
                onClick={handleSaveFinasHierbas}
              >
                {finasHierbas.registroGuardado ? 'Registro Guardado' : 'Guardar Registro Finas Hierbas'}
              </Button>
              {finasHierbas.registroGuardado && (
                <Button
                  variant="outline"
                  size="md"
                  icon="edit"
                  onClick={() => {
                    updateFinasHierbas({ registroGuardado: false });
                    if (showToast) showToast('Registro de Queso Finas Hierbas habilitado para modificar', 'info');
                  }}
                >
                  Editar
                </Button>
              )}
            </div>
          </div>

          {/* Restricción: Checkbox para habilitar edición manual avanzada al final */}
          <div className="pt-3 border-t border-emerald-200 flex items-center justify-between">
            <ManualEditToggle manual={Boolean(finasHierbas.edicionManualAvanzada)} onChange={(checked: boolean) => updateFinasHierbas({ edicionManualAvanzada: checked })} />
            <span className="text-[11px] text-gray-500 italic hidden sm:inline">
              Queso Finas Hierbas derivado
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
