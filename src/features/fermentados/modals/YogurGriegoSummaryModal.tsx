import React, { useEffect, useState } from 'react';
import { Modal } from '../../../components/ui';
import { UserProfile } from '../../../types';
import { YogurGriegoBatchData } from '../../../types/yogur_griego';

interface YogurGriegoSummaryModalProps {
  batch: YogurGriegoBatchData;
  isOpen: boolean;
  onClose: () => void;
  users?: UserProfile[];
  onFinalizeBatch?: () => void;
  onChangeObservaciones?: (observaciones: string) => void;
  onChangeOperariosIntervinientes?: (operarios: string[]) => void;
}

const DEFAULT_OPERATOR_CATALOG: string[] = [];

export const YogurGriegoSummaryModal: React.FC<YogurGriegoSummaryModalProps> = ({
  batch,
  isOpen,
  onClose,
  users = [],
  onFinalizeBatch,
  onChangeObservaciones,
  onChangeOperariosIntervinientes,
}) => {
  const [activeTab, setActiveTab] = useState<'resumen' | 'detalle' | 'certificado'>('resumen');
  const [localObservaciones, setLocalObservaciones] = useState<string>(batch.observaciones || '');

  const responsable = batch.operator || '';

  // Operarios que intervinieron en el proceso
  const [operariosList, setOperariosList] = useState<string[]>(() =>
    batch.operariosIntervinientes && batch.operariosIntervinientes.length > 0
      ? batch.operariosIntervinientes
      : [responsable].filter(Boolean)
  );
  const [selectedDropdownOp, setSelectedDropdownOp] = useState<string>('');
  const [customOperatorName, setCustomOperatorName] = useState<string>('');
  const [showCustomInput, setShowCustomInput] = useState<boolean>(false);
  const [showConfirmAlert, setShowConfirmAlert] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      setShowConfirmAlert(false);
      setLocalObservaciones(batch.observaciones || '');
      setOperariosList(
        batch.operariosIntervinientes && batch.operariosIntervinientes.length > 0
          ? batch.operariosIntervinientes
          : [batch.operator || ''].filter(Boolean)
      );
    }
  }, [isOpen, batch.id, batch.observaciones, batch.operariosIntervinientes, batch.operator]);

  if (!isOpen) return null;

  const {
    pasteurizacion,
    inoculacion,
    maduracionYFiltrado,
    batidoYAdiciones,
    envasado,
    processTimer,
  } = batch;

  // 1. Leche inicial
  const lecheInicialL = pasteurizacion.litrosLeche ?? 0;

  // 2. Suero eliminado (estimado)
  const sueroEliminadoL =
    maduracionYFiltrado.filtradoTelas.sueroEliminadoEstimadoLitros || 0;

  // 3. Masa filtrada
  const masaFiltradaKg =
    maduracionYFiltrado.filtradoTelas.masaFiltradaKg || 0;

  // 4. Masa envasada por variedad
  // Griego sin estevia: Tarro 1000g + Tarro 500g + Vasito 120g
  const sinEst1L =
    envasado.formatosSinEstevia?.tarro1L ||
    envasado.formatosSinEstevia?.tarrina1000g ||
    0;
  const sinEst500ml =
    envasado.formatosSinEstevia?.tarro500ml ||
    envasado.formatosSinEstevia?.tarrina500g ||
    0;
  const sinEst120ml =
    envasado.formatosSinEstevia?.vasito120ml ||
    envasado.formatosSinEstevia?.tarrina120g ||
    0;
  const masaEnvasadaSinEstevia = Number(
    (sinEst1L * 1.0 + sinEst500ml * 0.5 + sinEst120ml * 0.12).toFixed(2)
  );
  const undsSinEstevia = sinEst1L + sinEst500ml + sinEst120ml;

  // Griego con estevia: Tarro 1000g + Tarro 500g + Vasito 120g
  const conEst1L =
    envasado.formatosConEstevia?.tarro1L ||
    envasado.formatosConEstevia?.tarrina1000g ||
    0;
  const conEst500ml =
    envasado.formatosConEstevia?.tarro500ml ||
    envasado.formatosConEstevia?.tarrina500g ||
    0;
  const conEst120ml =
    envasado.formatosConEstevia?.vasito120ml ||
    envasado.formatosConEstevia?.tarrina120g ||
    0;
  const masaEnvasadaConEstevia = Number(
    (conEst1L * 1.0 + conEst500ml * 0.5 + conEst120ml * 0.12).toFixed(2)
  );
  const undsConEstevia = conEst1L + conEst500ml + conEst120ml;

  const masaTotalEnvasadaKg = Number((masaEnvasadaSinEstevia + masaEnvasadaConEstevia).toFixed(2));
  const totalUnidades = undsSinEstevia + undsConEstevia;

  // 5. Rendimiento lácteo sobre volumen de leche desviada
  const rendimientoLacteoPct =
    lecheInicialL > 0 ? Number(((masaTotalEnvasadaKg / lecheInicialL) * 100).toFixed(1)) : 0;
  const rendimientoMasaPct =
    masaFiltradaKg > 0 ? Number(((masaTotalEnvasadaKg / masaFiltradaKg) * 100).toFixed(1)) : 0;

  // Stevia en Griego (si aplica)
  const loteEsteviaGriego = batidoYAdiciones.formulacion?.variedadConEstevia?.loteEstevia || '';
  const gramosEsteviaGriego = batidoYAdiciones.formulacion?.variedadConEstevia?.gramosEstevia || 0;
  const hasEsteviaGriego = Boolean(loteEsteviaGriego || gramosEsteviaGriego > 0 || undsConEstevia > 0);

  // Operarios handlers
  const handleAddOperator = (nameToAdd: string) => {
    if (!nameToAdd || !nameToAdd.trim()) return;
    const trimmed = nameToAdd.trim();
    if (!operariosList.includes(trimmed)) {
      const updated = [...operariosList, trimmed];
      setOperariosList(updated);
      onChangeOperariosIntervinientes?.(updated);
    }
    setSelectedDropdownOp('');
    setCustomOperatorName('');
    setShowCustomInput(false);
  };

  const handleRemoveOperator = (indexToRemove: number) => {
    if (operariosList.length <= 1) return;
    const updated = operariosList.filter((_, idx) => idx !== indexToRemove);
    setOperariosList(updated);
    onChangeOperariosIntervinientes?.(updated);
  };

  const handleSaveObservaciones = () => {
    onChangeObservaciones?.(localObservaciones);
  };

  const handleConfirmFinalize = () => {
    handleSaveObservaciones();
    if (onChangeOperariosIntervinientes) {
      onChangeOperariosIntervinientes(operariosList);
    }
    setShowConfirmAlert(false);
    if (onFinalizeBatch) {
      onFinalizeBatch();
    }
    onClose();
  };

  return (
    <>
      <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="5xl"
      icon="filter_alt"
      title="Resumen Final de Producción · Yogur Griego"
      subtitle="Trazabilidad del lote, balance de masa filtrada en telas y rendimiento final."
      badge={
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="px-2.5 py-0.5 bg-cyan-100 text-cyan-900 border border-cyan-300 rounded-full text-[11px] font-black uppercase">
            {batch.id}
          </span>
          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-full text-[10px] font-bold">
            NTC-805
          </span>
          <span className="px-2 py-0.5 bg-amber-100 text-amber-900 border border-amber-300 rounded-full text-[10px] font-bold">
            Yogur Griego Concentrado
          </span>
        </div>
      }
      tabs={
        <div className="flex px-6 gap-6">
          <button
            onClick={() => setActiveTab('resumen')}
            className={`py-3 text-xs font-black uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
              activeTab === 'resumen'
                ? 'border-[#1B4E9B] text-[#1B4E9B]'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            Balance y Métricas Clave
          </button>
          <button
            onClick={() => setActiveTab('detalle')}
            className={`py-3 text-xs font-black uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
              activeTab === 'detalle'
                ? 'border-[#1B4E9B] text-[#1B4E9B]'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            Trazabilidad de Etapas (5)
          </button>
          <button
            onClick={() => setActiveTab('certificado')}
            className={`py-3 text-xs font-black uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
              activeTab === 'certificado'
                ? 'border-[#1B4E9B] text-[#1B4E9B]'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            Equipo y Constancia del Lote
          </button>
        </div>
      }
      footer={
        <div className="w-full flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-gray-500">
            Lote: <strong className="text-gray-800">{batch.id}</strong> · Responsable:{' '}
            <strong className="text-gray-800">{responsable}</strong>
          </div>

          <div className="flex items-center gap-2.5 ml-auto">
            <button
              onClick={onClose}
              className="h-10 px-4 bg-white border border-gray-300 hover:bg-gray-100 text-gray-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">close</span>
              <span>Cerrar Resumen</span>
            </button>

            {onFinalizeBatch && batch.status !== 'COMPLETADO' && (
              <button
                onClick={() => setShowConfirmAlert(true)}
                className="h-10 px-5 bg-[#5FAF32] hover:bg-[#4E9628] text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer active:scale-95 flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[17px]">task_alt</span>
                <span>Confirmar Proceso Terminado</span>
              </button>
            )}
          </div>
        </div>
      }
    >
      <div className="space-y-6">
          {activeTab === 'resumen' && (
            <div className="space-y-6">
              {/* Lote compartido con Yogur sin Azúcar */}
              <div className="p-3.5 bg-amber-50 rounded-2xl border border-amber-300 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-amber-700 text-[20px]">share</span>
                  <div>
                    <span className="text-[10px] font-bold text-amber-800 uppercase block">
                      Lote compartido (Yogur sin Azúcar del día)
                    </span>
                    <span className="text-base font-black font-mono text-amber-950">
                      {pasteurizacion.loteYogurSinAzucar || 'Sin registrar'}
                    </span>
                  </div>
                </div>
                <span className="text-xs text-amber-800 bg-amber-100 px-2.5 py-1 rounded-lg font-medium">
                  Producido el mismo día
                </span>
              </div>

              {/* REGLA 6: Las 5 Métricas Obligatorias */}
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
                {/* 1. Leche Inicial Desviada */}
                <div className="p-4 bg-white rounded-2xl border border-blue-200 shadow-xs">
                  <span className="text-[10px] uppercase font-bold text-blue-700 block">
                    1. Leche Base Desviada
                  </span>
                  <span className="text-2xl font-black text-blue-950 mt-1 block">
                    {lecheInicialL} L
                  </span>
                  <span className="text-[10px] text-gray-500 block mt-0.5">
                    Lote: {pasteurizacion.loteLeche || 'L-2026'}
                  </span>
                </div>

                {/* 2. Suero Eliminado (Estimado) */}
                <div className="p-4 bg-white rounded-2xl border border-amber-200 shadow-xs">
                  <span className="text-[10px] uppercase font-bold text-amber-700 block">
                    2. Suero Eliminado
                  </span>
                  <span className="text-2xl font-black text-amber-950 mt-1 block">
                    ~{sueroEliminadoL} L
                  </span>
                  <span className="text-[10px] text-gray-500 block mt-0.5">
                    Escurrido en lienzos
                  </span>
                </div>

                {/* 3. Masa Concentrada Escurrida */}
                <div className="p-4 bg-white rounded-2xl border border-purple-200 shadow-xs">
                  <span className="text-[10px] uppercase font-bold text-purple-700 block">
                    3. Masa Filtrada
                  </span>
                  <span className="text-2xl font-black text-purple-950 mt-1 block">
                    {masaFiltradaKg} kg
                  </span>
                  <span className="text-[10px] text-purple-800 font-bold block mt-0.5">
                    Base tras escurrido en telas
                  </span>
                </div>

                {/* 4. Masa Envasada Total */}
                <div className="p-4 bg-white rounded-2xl border border-cyan-200 shadow-xs">
                  <span className="text-[10px] uppercase font-bold text-cyan-700 block">
                    4. Total Envasado
                  </span>
                  <span className="text-2xl font-black text-cyan-950 mt-1 block">
                    {masaTotalEnvasadaKg} kg
                  </span>
                  <span className="text-[10px] text-gray-500 block mt-0.5">
                    {totalUnidades} recipientes
                  </span>
                </div>

                {/* 5. Rendimiento Lácteo */}
                <div className="p-4 bg-white rounded-2xl border border-emerald-200 shadow-xs col-span-2 lg:col-span-1">
                  <span className="text-[10px] uppercase font-bold text-emerald-700 block">
                    5. Rendimiento
                  </span>
                  <span className="text-2xl font-black text-emerald-950 mt-1 block">
                    {rendimientoLacteoPct}%
                  </span>
                  <span className="text-[10px] text-emerald-700 block mt-0.5">
                    s/ Leche ({rendimientoMasaPct}% s/ Masa)
                  </span>
                </div>
              </div>

              {/* SECCIÓN: TRAZABILIDAD DE MATERIAS PRIMAS E INSUMOS (GRIEGO) */}
              <div className="p-5 rounded-2xl bg-[#FFFFFF] border border-[#D6DEEA] flex flex-col gap-3">
                <div className="flex items-center justify-between pb-2 border-b border-[#D6DEEA]">
                  <span className="text-xs font-black uppercase tracking-wider text-gray-700 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-cyan-600"></span>
                    Trazabilidad de Materias Primas e Insumos (Yogur Griego)
                  </span>
                  <span className="text-[10px] font-mono text-gray-500">Kardex Exclusivo Griego</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Tarjeta 1: Lote Leche Entera */}
                  <div className="p-3.5 rounded-xl bg-white border-2 border-blue-300 flex flex-col justify-between shadow-2xs">
                    <div>
                      <span className="text-[9px] font-bold text-blue-700 uppercase block">
                        Lote Leche Entera (Base)
                      </span>
                      <strong className="text-sm font-mono font-black text-blue-950 block mt-0.5">
                        {pasteurizacion.loteLeche || 'LE-2026-YOG-01'}
                      </strong>
                    </div>
                    <div className="mt-2 pt-2 border-t border-blue-100 flex items-center justify-between text-[10px]">
                      <span className="text-gray-500">Volumen Desviado:</span>
                      <span className="font-bold text-blue-900">{lecheInicialL} L</span>
                    </div>
                    <span className="text-[9px] text-emerald-700 font-semibold mt-1">
                      ✓ Base extraída para Griego
                    </span>
                  </div>

                  {/* Tarjeta 2: Lote Cultivo Láctico */}
                  <div className="p-3.5 rounded-xl bg-white border-2 border-emerald-300 flex flex-col justify-between shadow-2xs">
                    <div>
                      <span className="text-[9px] font-bold text-emerald-700 uppercase block">
                        Lote Cultivo Láctico
                      </span>
                      <strong className="text-sm font-mono font-black text-emerald-950 block mt-0.5 truncate">
                        {inoculacion.loteCultivo || 'CULT-PROB-2026-04'}
                      </strong>
                    </div>
                    <div className="mt-2 pt-2 border-t border-emerald-100 flex items-center justify-between text-[10px]">
                      <span className="text-gray-500">Dosis DVI:</span>
                      <span className="font-bold text-emerald-900">{inoculacion.cantidadCultivoGramos || 2.5} g</span>
                    </div>
                    <span className="text-[9px] text-emerald-700 font-semibold mt-1">
                      ✓ Inoculado e incubado a 45 °C
                    </span>
                  </div>

                  {/* Tarjeta 3: Lote Stevia (si aplica) */}
                  <div
                    className={`p-3.5 rounded-xl border-2 flex flex-col justify-between shadow-2xs ${
                      hasEsteviaGriego
                        ? 'bg-white border-amber-300'
                        : 'bg-gray-50/80 border-gray-200 opacity-60'
                    }`}
                  >
                    <div>
                      <span
                        className={`text-[9px] font-bold uppercase block ${
                          hasEsteviaGriego ? 'text-amber-700' : 'text-gray-400'
                        }`}
                      >
                        Lote Stevia (Si Aplica)
                      </span>
                      <strong
                        className={`text-sm font-mono font-black block mt-0.5 truncate ${
                          hasEsteviaGriego ? 'text-amber-950' : 'text-gray-400'
                        }`}
                      >
                        {hasEsteviaGriego ? (loteEsteviaGriego || 'LOTE-STV-GRIEGO') : 'N/A - 100% Natural Sin Endulzar'}
                      </strong>
                    </div>
                    <div
                      className={`mt-2 pt-2 border-t flex items-center justify-between text-[10px] ${
                        hasEsteviaGriego ? 'border-amber-100' : 'border-gray-200'
                      }`}
                    >
                      <span className="text-gray-500">Adición:</span>
                      <span className={`font-bold ${hasEsteviaGriego ? 'text-amber-900' : 'text-gray-400'}`}>
                        {hasEsteviaGriego ? `${gramosEsteviaGriego} g` : '0 g'}
                      </span>
                    </div>
                    <span
                      className={`text-[9px] font-semibold mt-1 ${
                        hasEsteviaGriego ? 'text-amber-700' : 'text-gray-400'
                      }`}
                    >
                      {hasEsteviaGriego ? '✓ Endulzado en variedad con Stevia' : 'Exento de azúcar y endulzantes'}
                    </span>
                  </div>
                </div>

                <div className="mt-1 p-2.5 rounded-xl bg-cyan-50/50 border border-cyan-200 text-[11px] text-cyan-950 flex items-center gap-2">
                  <span className="material-symbols-outlined text-cyan-700 text-[16px]">verified</span>
                  <span>
                    <strong>Identidad Yogur Griego (NTC-805):</strong> Proceso puro mediante filtración en lienzos. Exento de azúcar industrial y saborizantes artificiales.
                  </span>
                </div>
              </div>

              {/* REGLA 6: Masa Envasada Por Variedad (Desglose Detallado) */}
              <div className="bg-white p-5 rounded-2xl border border-[#D6DEEA] shadow-xs">
                <h3 className="text-sm font-black text-gray-900 uppercase tracking-wide mb-3 flex items-center gap-2">
                  <span className="material-symbols-outlined text-purple-700 text-[20px]">inventory_2</span>
                  <span>Masa Envasada por Variedad</span>
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Tarjeta Griego Sin Estevia */}
                  <div className="p-4 bg-blue-50/50 rounded-2xl border border-blue-200">
                    <div className="flex items-center justify-between mb-2">
                      <span className="px-2.5 py-0.5 bg-blue-600 text-white rounded-full text-[10px] font-black uppercase">
                        Griego sin estevia (Natural)
                      </span>
                      <span className="text-lg font-black text-blue-950">
                        {masaEnvasadaSinEstevia} kg
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 mb-3">
                      Total unidades: <strong className="text-gray-900">{undsSinEstevia}</strong>
                    </p>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div className="p-2 bg-white rounded-xl border border-blue-100">
                        <span className="text-gray-500 block text-[10px]">Tarrina 1000 g:</span>
                        <span className="font-bold text-blue-900">{sinEst1L} und</span>
                      </div>
                      <div className="p-2 bg-white rounded-xl border border-blue-100">
                        <span className="text-gray-500 block text-[10px]">Tarrina 500 g:</span>
                        <span className="font-bold text-blue-900">{sinEst500ml} und</span>
                      </div>
                      <div className="p-2 bg-white rounded-xl border border-blue-100">
                        <span className="text-gray-500 block text-[10px]">Tarrina 120 g:</span>
                        <span className="font-bold text-blue-900">{sinEst120ml} und</span>
                      </div>
                    </div>
                  </div>

                  {/* Tarjeta Griego Con Estevia */}
                  <div className="p-4 bg-emerald-50/50 rounded-2xl border border-emerald-200">
                    <div className="flex items-center justify-between mb-2">
                      <span className="px-2.5 py-0.5 bg-emerald-600 text-white rounded-full text-[10px] font-black uppercase">
                        Griego con estevia
                      </span>
                      <span className="text-lg font-black text-emerald-950">
                        {masaEnvasadaConEstevia} kg
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 mb-3">
                      Total unidades: <strong className="text-gray-900">{undsConEstevia}</strong> · Estevia:{' '}
                      <strong className="text-emerald-800">
                        {batidoYAdiciones.formulacion.variedadConEstevia.gramosEstevia} g (Lote:{' '}
                        {batidoYAdiciones.formulacion.variedadConEstevia.loteEstevia || 'Sin registrar'})
                      </strong>
                    </p>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div className="p-2 bg-white rounded-xl border border-emerald-100">
                        <span className="text-gray-500 block text-[10px]">Tarro 1000 g:</span>
                        <span className="font-bold text-emerald-900">{conEst1L} und</span>
                      </div>
                      <div className="p-2 bg-white rounded-xl border border-emerald-100">
                        <span className="text-gray-500 block text-[10px]">Tarro 500 g:</span>
                        <span className="font-bold text-emerald-900">{conEst500ml} und</span>
                      </div>
                      <div className="p-2 bg-white rounded-xl border border-emerald-100">
                        <span className="text-gray-500 block text-[10px]">Vasito 120 g:</span>
                        <span className="font-bold text-purple-900">{conEst120ml} und</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Tiempos de las Etapas Críticas */}
              <div className="bg-white p-5 rounded-2xl border border-[#D6DEEA] shadow-xs">
                <h3 className="text-sm font-black text-gray-900 uppercase tracking-wide mb-3">
                  Tiempos de Proceso Acumulados
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                  <div className="p-3 bg-gray-50 rounded-xl">
                    <span className="text-gray-500 block">Sostenimiento térmico:</span>
                    <span className="font-bold text-gray-900">15 min (85–90 °C)</span>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-xl">
                    <span className="text-gray-500 block">Incubación (43 °C):</span>
                    <span className="font-bold text-gray-900">
                      {inoculacion.incubacion.tiempoTranscurrido || '8 h'} (Mín. 8 h)
                    </span>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-xl">
                    <span className="text-gray-500 block">Cuarto Frío (0–4 °C):</span>
                    <span className="font-bold text-gray-900">
                      {maduracionYFiltrado.cuartoFrio.tiempoTranscurrido || '24 h'} (1–2 días)
                    </span>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-xl">
                    <span className="text-gray-500 block">Filtrado en Lienzos:</span>
                    <span className="font-bold text-gray-900">
                      {maduracionYFiltrado.filtradoTelas.tiempoTranscurrido || '48 h'} (2 días)
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'detalle' && (
            <div className="space-y-4">
              {/* Etapa 1: Pasteurización */}
              <div className="p-4 bg-white rounded-2xl border border-[#D6DEEA]">
                <h4 className="font-black text-gray-900 text-sm mb-2 flex items-center justify-between">
                  <span>1. Pasteurización Térmica Pura (Sin Azúcar Ni Crema)</span>
                  <span className="text-xs text-emerald-700 font-bold">✓ Completada</span>
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs text-gray-600">
                  <div>Leche: <strong>{lecheInicialL} L</strong></div>
                  <div>Lote compartido: <strong className="text-amber-800 font-mono">{pasteurizacion.loteYogurSinAzucar || 'Sin registrar'}</strong></div>
                  <div>Temp. alcanzada: <strong>{pasteurizacion.calentamiento.temperaturaAlcanzada} °C</strong></div>
                  <div>Sostenimiento: <strong>{pasteurizacion.sostenimiento.duracionReal || '15 min'}</strong></div>
                  <div>Enfriamiento: <strong>{pasteurizacion.enfriamiento.temperaturaFinal} °C</strong></div>
                </div>
              </div>

              {/* Etapa 2: Inoculación e Incubación */}
              <div className="p-4 bg-white rounded-2xl border border-[#D6DEEA]">
                <h4 className="font-black text-gray-900 text-sm mb-2 flex items-center justify-between">
                  <span>2. Inoculación e Incubación Termófila</span>
                  <span className="text-xs text-emerald-700 font-bold">✓ Completada</span>
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-gray-600">
                  <div>Temp. siembra: <strong>{inoculacion.temperaturaVerificada45} °C</strong></div>
                  <div>Lote cultivo: <strong>{inoculacion.loteCultivo}</strong></div>
                  <div>Dosificación: <strong>{inoculacion.cantidadCultivoCucharadas} cd ({inoculacion.cantidadCultivoGramos} g)</strong></div>
                  <div>Incubación: <strong>{inoculacion.incubacion.tiempoTranscurrido || '8 h'} (pH {inoculacion.incubacion.phFinalIncubacion})</strong></div>
                </div>
              </div>

              {/* Etapa 3: Cuarto Frío y Filtrado en Telas */}
              <div className="p-4 bg-white rounded-2xl border border-[#D6DEEA]">
                <h4 className="font-black text-gray-900 text-sm mb-2 flex items-center justify-between">
                  <span>3. Cuarto Frío y Filtrado en Telas (Desuerado)</span>
                  <span className="text-xs text-emerald-700 font-bold">✓ Completada</span>
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-gray-600">
                  <div>Temp. cuarto frío: <strong>{maduracionYFiltrado.cuartoFrio.temperatura} °C</strong></div>
                  <div>Tiempo cuarto frío: <strong>{maduracionYFiltrado.cuartoFrio.tiempoTranscurrido || '24 h'}</strong></div>
                  <div>Tiempo filtrado lienzos: <strong>{maduracionYFiltrado.filtradoTelas.tiempoTranscurrido || '48 h'}</strong></div>
                  <div>Masa filtrada / Suero: <strong>{masaFiltradaKg} kg / {sueroEliminadoL} L</strong></div>
                </div>
              </div>

              {/* Etapa 4: Batido y Formulación */}
              <div className="p-4 bg-white rounded-2xl border border-[#D6DEEA]">
                <h4 className="font-black text-gray-900 text-sm mb-2 flex items-center justify-between">
                  <span>4. Batido (Sin Crema) y Formulación de Dos Variedades</span>
                  <span className="text-xs text-emerald-700 font-bold">✓ Completada</span>
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-gray-600">
                  <div>Velocidad batido: <strong>{batidoYAdiciones.batido.velocidadRpm} RPM</strong></div>
                  <div>Tiempo batido: <strong>{batidoYAdiciones.batido.tiempoBatido || '5 min'}</strong></div>
                  <div>Variedad Sin Estevia: <strong>{batidoYAdiciones.formulacion.variedadSinEstevia.masaKg} kg</strong></div>
                  <div>Variedad Con Estevia: <strong>{batidoYAdiciones.formulacion.variedadConEstevia.masaKg} kg ({batidoYAdiciones.formulacion.variedadConEstevia.gramosEstevia} g)</strong></div>
                </div>
              </div>

              {/* Etapa 5: Envasado */}
              <div className="p-4 bg-white rounded-2xl border border-[#D6DEEA]">
                <h4 className="font-black text-gray-900 text-sm mb-2 flex items-center justify-between">
                  <span>5. Envasado y Almacenamiento Final</span>
                  <span className="text-xs text-emerald-700 font-bold">✓ Completada</span>
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-gray-600">
                  <div>Lote PT: <strong>{envasado.loteProductoTerminado}</strong></div>
                  <div>Total envasado: <strong>{masaTotalEnvasadaKg} kg ({totalUnidades} unds)</strong></div>
                  <div>Cuarto frío: <strong>{envasado.almacenamientoCuartoFrio.temperaturaAlmacenamiento} °C</strong></div>
                  <div>Vencimiento: <strong>{envasado.fechaVencimiento}</strong></div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'certificado' && (
            <div className="space-y-6">
              {/* Equipo Operativo Interviniente */}
              <div className="bg-white p-5 rounded-2xl border border-[#D6DEEA] shadow-xs">
                <h3 className="text-sm font-black text-gray-900 uppercase tracking-wide mb-3 flex items-center gap-2">
                  <span className="material-symbols-outlined text-blue-700">group</span>
                  <span>Operarios y Responsables que Intervinieron</span>
                </h3>

                <div className="flex flex-wrap gap-2 mb-4">
                  {operariosList.map((op, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1.5 px-3 py-1 bg-cyan-50 text-cyan-900 border border-cyan-200 rounded-full text-xs font-bold"
                    >
                      <span>{op}</span>
                      {operariosList.length > 1 && (
                        <button
                          onClick={() => handleRemoveOperator(idx)}
                          className="hover:text-red-700 text-cyan-600 font-black cursor-pointer"
                        >
                          ×
                        </button>
                      )}
                    </span>
                  ))}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={selectedDropdownOp}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === 'custom') {
                        setShowCustomInput(true);
                      } else if (val) {
                        handleAddOperator(val);
                      }
                    }}
                    className="px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs font-bold text-gray-700 focus:bg-white focus:ring-2 focus:ring-cyan-500 outline-hidden"
                  >
                    <option value="">+ Agregar operario del catálogo...</option>
                    {DEFAULT_OPERATOR_CATALOG.filter((op) => !operariosList.includes(op)).map((op) => (
                      <option key={op} value={op}>
                        {op}
                      </option>
                    ))}
                    <option value="custom">+ Escribir otro nombre...</option>
                  </select>

                  {showCustomInput && (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={customOperatorName}
                        onChange={(e) => setCustomOperatorName(e.target.value)}
                        placeholder="Nombre y código de operario"
                        className="px-3 py-2 bg-white border border-gray-300 rounded-xl text-xs font-bold text-gray-800 outline-hidden focus:ring-2 focus:ring-cyan-500"
                      />
                      <button
                        onClick={() => handleAddOperator(customOperatorName)}
                        className="px-3 py-2 bg-cyan-700 text-white rounded-xl text-xs font-bold hover:bg-cyan-800 transition-all cursor-pointer"
                      >
                        Añadir
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Observaciones de Calidad */}
              <div className="bg-white p-5 rounded-2xl border border-[#D6DEEA] shadow-xs">
                <h3 className="text-sm font-black text-gray-900 uppercase tracking-wide mb-2">
                  Observaciones Técnicas y Liberación de Calidad
                </h3>
                <textarea
                  value={localObservaciones}
                  onChange={(e) => setLocalObservaciones(e.target.value)}
                  onBlur={handleSaveObservaciones}
                  rows={3}
                  placeholder="Registre cualquier novedad observada durante el filtrado o la formulación..."
                  className="w-full p-3 bg-gray-50 border border-gray-300 rounded-xl text-xs font-medium text-gray-800 focus:bg-white focus:ring-2 focus:ring-cyan-500 outline-hidden"
                />
              </div>

              {/* Constancia Visual del Lote (Solo Lectura) */}
              <div className="flex items-start gap-3 p-4 bg-emerald-50 rounded-2xl border border-emerald-200">
                <span className="material-symbols-outlined text-emerald-700 text-[22px] shrink-0 mt-0.5">
                  verified
                </span>
                <div>
                  <h4 className="text-xs font-bold text-emerald-950">
                    Constancia Digital del Lote · Verificación en Pantalla
                  </h4>
                  <p className="text-[11px] text-emerald-800 mt-0.5 leading-relaxed">
                    Todos los tiempos, temperaturas de pasteurización, inoculación, filtrado en mallas y balance de masas del lote <strong>{batch.id}</strong> quedan guardados directamente en la bitácora digital de planta.
                  </p>
                </div>
              </div>
            </div>
          )}
      </div>
    </Modal>

    {/* MODAL DE ADVERTENCIA: CONFIRMACIÓN CRÍTICA DE CIERRE DE LOTE */}
    {showConfirmAlert && (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
        <div className="w-full max-w-md bg-white rounded-3xl border-2 border-amber-300 shadow-2xl p-6 flex flex-col gap-5 animate-scaleUp">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 border border-amber-300 text-amber-800 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[28px]">
                warning
              </span>
            </div>
            <div className="flex flex-col gap-1 min-w-0">
              <span className="text-[10px] uppercase font-bold tracking-wider text-amber-800">
                Advertencia de Cierre Definitivo
              </span>
              <h3 className="text-base sm:text-lg font-black text-gray-900 leading-snug">
                ¿Deseas finalizar el lote?
              </h3>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-amber-50/90 border border-amber-200 text-xs text-amber-950 font-bold leading-relaxed">
            Una vez terminado el proceso no se podrá modificar. ¿Deseas finalizar el lote?
          </div>

          <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-200 flex flex-col gap-1.5 text-xs text-gray-600">
            <div className="flex justify-between items-center">
              <span className="font-bold">Lote:</span>
              <span className="font-mono font-black text-gray-900">{batch.id}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="font-bold">Producto:</span>
              <span className="font-semibold text-gray-800">{batch.productName}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="font-bold">Responsable:</span>
              <span className="font-semibold text-gray-800">{responsable}</span>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-200">
            <button
              type="button"
              className="h-10 px-4 bg-white border border-gray-300 text-gray-700 font-bold rounded-xl hover:bg-gray-100 transition-all text-xs cursor-pointer"
              onClick={() => setShowConfirmAlert(false)}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="h-10 px-5 bg-emerald-700 text-white font-bold rounded-xl hover:bg-emerald-800 transition-all shadow-md text-xs flex items-center gap-1.5 cursor-pointer active:scale-95"
              onClick={handleConfirmFinalize}
            >
              <span className="material-symbols-outlined text-[16px]">check_circle</span>
              <span>Aceptar / Finalizar</span>
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
};
