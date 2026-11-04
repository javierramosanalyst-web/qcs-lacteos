import React, { useEffect, useState } from 'react';
import { Modal } from '../../../components/ui';
import { BatchData, UserProfile } from '../../../types';

interface BatchSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  batch: BatchData;
  users?: UserProfile[];
  onFinalizeBatch?: () => void;
  onChangeObservaciones?: (observaciones: string) => void;
  onChangeOperariosIntervinientes?: (operarios: string[]) => void;
}

const DEFAULT_OPERATOR_CATALOG: string[] = [];

export const BatchSummaryModal: React.FC<BatchSummaryModalProps> = ({
  isOpen,
  onClose,
  batch,
  users = [],
  onFinalizeBatch,
  onChangeObservaciones,
  onChangeOperariosIntervinientes,
}) => {
  const [activeTab, setActiveTab] = useState<'resumen' | 'detalle' | 'certificado'>('resumen');
  const [localObservaciones, setLocalObservaciones] = useState<string>(batch.observaciones || '');
  const [showConfirmAlert, setShowConfirmAlert] = useState<boolean>(false);

  useEffect(() => {
    if (!isOpen) {
      setShowConfirmAlert(false);
    }
  }, [isOpen]);

  const responsable = batch.responsableProceso || batch.operator || '';

  // Operarios que intervinieron en el proceso
  const [operariosList, setOperariosList] = useState<string[]>(() =>
    batch.operariosIntervinientes && batch.operariosIntervinientes.length > 0
      ? batch.operariosIntervinientes
      : [responsable].filter(Boolean)
  );
  const [selectedDropdownOp, setSelectedDropdownOp] = useState<string>('');
  const [customOperatorName, setCustomOperatorName] = useState<string>('');
  const [showCustomInput, setShowCustomInput] = useState<boolean>(false);

  // Sync local states when batch changes or modal opens
  useEffect(() => {
    if (isOpen) {
      setLocalObservaciones(batch.observaciones || '');
      setOperariosList(
        batch.operariosIntervinientes && batch.operariosIntervinientes.length > 0
          ? batch.operariosIntervinientes
          : [batch.responsableProceso || batch.operator || ''].filter(Boolean)
      );
    }
  }, [isOpen, batch.id]);

  // Construir catálogo de operarios para el menú desplegable
  const availableOperators = React.useMemo(() => {
    const fromUsers = users
      .filter((u) => u.role === 'operador')
      .map((u) => `${u.name} (${u.code})`);
    const combined = Array.from(new Set([...fromUsers, ...DEFAULT_OPERATOR_CATALOG]));
    return combined;
  }, [users]);

  const is7Cueros = batch.productId === 'prod-queso-7-cueros';
  const ph7C = Number(batch.acidificar.insumos.phMezcla) || 0;
  const phRango7C =
    ph7C > 0 && ph7C < 5.3
      ? 'pH menor al rango sugerido (5,30–5,35)'
      : ph7C > 5.35
      ? 'pH mayor al rango sugerido (5,30–5,35)'
      : 'pH dentro de rango (5,30–5,35)';
  const totalLecheUsada = is7Cueros
    ? (batch.acidificar.insumos.litrosConfirmados ||
       (batch.acidificar.insumos.saved ? batch.acidificar.insumos.lecheFresca : undefined) ||
       batch.lotesLeche.litrosConfirmados ||
       batch.lotesLeche.litrosLote1 ||
       0)
    : (batch.acidificar.insumos.lecheFresca || 0) + (batch.acidificar.insumos.lecheAcida || 0);

  if (!isOpen) return null;

  const handleAddOperator = (opName: string) => {
    const trimmed = opName.trim();
    if (!trimmed) return;
    if (!operariosList.includes(trimmed)) {
      const updated = [...operariosList, trimmed];
      setOperariosList(updated);
      if (onChangeOperariosIntervinientes) {
        onChangeOperariosIntervinientes(updated);
      }
    }
  };

  const handleRemoveOperator = (opName: string) => {
    const updated = operariosList.filter((item) => item !== opName);
    setOperariosList(updated);
    if (onChangeOperariosIntervinientes) {
      onChangeOperariosIntervinientes(updated);
    }
  };

  const handleDropdownChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (value === '__custom__') {
      setShowCustomInput(true);
      setSelectedDropdownOp('');
      return;
    }
    setShowCustomInput(false);
    if (value) {
      handleAddOperator(value);
      setSelectedDropdownOp('');
    }
  };

  const handleAddCustomOperator = () => {
    if (customOperatorName.trim()) {
      handleAddOperator(customOperatorName.trim());
      setCustomOperatorName('');
      setShowCustomInput(false);
    }
  };

  const handleConfirmFinalize = () => {
    if (onChangeObservaciones) {
      onChangeObservaciones(localObservaciones);
    }
    if (onChangeOperariosIntervinientes) {
      onChangeOperariosIntervinientes(operariosList);
    }
    setShowConfirmAlert(false);
    if (onFinalizeBatch) onFinalizeBatch();
    onClose();
  };

  // Moldes breakdown helpers (350g/60g for Queso Pera, 7 Cueros, 100g-1600g for Doble Crema)
  const isPera = batch.productId === 'prod-queso-pera' || batch.productName?.toLowerCase().includes('pera');

  // Variables específicas de 7 Cueros
  const m7Cueros = batch.moldesDesglose?.moldes7Cueros350g ?? 0;
  const mTrenza = batch.moldesDesglose?.moldesTrenza350g ?? 0;
  const isArequipe7C = Boolean(batch.derivaciones7Cueros?.arequipe?.habilitado);
  const mQuesadillaArq = isArequipe7C ? (batch.derivaciones7Cueros?.arequipe?.moldes60g ?? 0) : 0;
  const arequipeGastadoG = isArequipe7C
    ? (batch.derivaciones7Cueros?.arequipe?.pesoUtilizadoGramos ??
        Math.max(
          0,
          (batch.derivaciones7Cueros?.arequipe?.pesoInicialGramos ?? 0) -
            (batch.derivaciones7Cueros?.arequipe?.pesoFinalGramos ?? 0)
        ))
    : 0;

  const isBocadillo7C = Boolean(batch.derivaciones7Cueros?.bocadillo?.habilitado);
  const mQuesadillaBoc = isBocadillo7C ? (batch.derivaciones7Cueros?.bocadillo?.moldes60g ?? 0) : 0;
  const bocadilloGastadoG = isBocadillo7C
    ? (batch.derivaciones7Cueros?.bocadillo?.pesoUtilizadoGramos ??
        Math.max(
          0,
          (batch.derivaciones7Cueros?.bocadillo?.pesoInicialGramos ?? 0) -
            (batch.derivaciones7Cueros?.bocadillo?.pesoFinalGramos ?? 0)
        ))
    : 0;
  const bocadillosGastadosU = isBocadillo7C
    ? (batch.derivaciones7Cueros?.bocadillo?.unidadesBocadilloGastadas ?? mQuesadillaBoc)
    : 0;

  // Trazabilidad exclusiva de Queso 7 Cueros (SUB-PARTE B.6: Último valor confirmado)
  const litrosLecheFresca7C =
    batch.acidificar.insumos.litrosConfirmados ||
    (batch.acidificar.insumos.saved ? batch.acidificar.insumos.lecheFresca : undefined) ||
    batch.lotesLeche.litrosConfirmados ||
    batch.lotesLeche.litrosLote1 ||
    totalLecheUsada ||
    0;
  const loteLecheFresca7C =
    batch.lotesLeche.loteLecheFresca ||
    batch.lotesLeche.loteLeche1 ||
    'Sin registrar';
  const loteAcidoAcetico7C =
    batch.acidificar.insumos.loteAcidoAcetico ||
    batch.lotesLeche.loteAcidoAcetico ||
    'Sin registrar';

  // Grid dinámico según ingredientes habilitados (Leche Fresca + Ácido Acético 5% + opcional Arequipe + opcional Bocadillo)
  const cardsCount7C = 2 + (isArequipe7C ? 1 : 0) + (isBocadillo7C ? 1 : 0);
  const gridColsClass7C =
    cardsCount7C === 2
      ? 'grid-cols-1 sm:grid-cols-2'
      : cardsCount7C === 3
      ? 'grid-cols-1 sm:grid-cols-3'
      : 'grid-cols-2 lg:grid-cols-4';

  // Estado de producción para panel de lectura de variedades 7 Cueros
  const has7Cueros = m7Cueros > 0;
  const hasTrenza = mTrenza > 0;
  const hasArequipe = isArequipe7C && mQuesadillaArq > 0;
  const hasBocadillo = isBocadillo7C && mQuesadillaBoc > 0;

  const totalMoldes7Cueros = m7Cueros + mTrenza + mQuesadillaArq + mQuesadillaBoc;
  const pesoTotalGramos7Cueros =
    m7Cueros * 350 + mTrenza * 350 + mQuesadillaArq * 60 + mQuesadillaBoc * 60;

  const m350 = batch.moldesDesglose?.moldesPeraGrande350g ?? 0;
  const m60 = batch.moldesDesglose?.moldesPeraPequeno60g ?? 0;
  const m100 = batch.moldesDesglose?.moldes100g ?? 0;
  const m200 = batch.moldesDesglose?.moldes200g ?? 0;
  const m400 = batch.moldesDesglose?.moldes400g ?? 0;
  const m800 = batch.moldesDesglose?.moldes800g ?? 0;
  const m1600 = batch.moldesDesglose?.moldes1600g ?? 0;

  const totalMoldes = is7Cueros
    ? totalMoldes7Cueros
    : isPera
    ? m350 + m60
    : m100 + m200 + m400 + m800 + m1600;
  const pesoTotalGramos = is7Cueros
    ? pesoTotalGramos7Cueros
    : isPera
    ? m350 * 350 + m60 * 60
    : m100 * 100 + m200 * 200 + m400 * 400 + m800 * 800 + m1600 * 1600;
  const pesoFinalKg = batch.moldesDesglose?.esPesoManual
    ? batch.hilar.pesoTotalQueso
    : batch.moldesDesglose?.pesoTotalCalculadoKg ||
      Number((pesoTotalGramos / 1000).toFixed(2)) ||
      batch.hilar.pesoTotalQueso ||
      0;
  const pesadoHiladoKg = batch.moldesDesglose?.pesadoTotalHiladoKg ?? pesoFinalKg;
  const pesadoHiladoGramos = Math.round(pesadoHiladoKg * 1000);

  // Derivados para Queso Pera (Mexicano y Finas Hierbas)
  const isMexHabilitado = Boolean(batch.derivaciones?.mexicano?.habilitado);
  const mex100 = isMexHabilitado ? (batch.derivaciones?.mexicano?.moldes100g ?? 0) : 0;
  const mex200 = isMexHabilitado ? (batch.derivaciones?.mexicano?.moldes200g ?? 0) : 0;
  const mex350 = isMexHabilitado ? (batch.derivaciones?.mexicano?.moldes350g ?? 0) : 0;
  const mexTotalUnidades = mex100 + mex200 + mex350;
  const mexTotalGramos = mex100 * 100 + mex200 * 200 + mex350 * 350;
  const mexTotalKg = Number((mexTotalGramos / 1000).toFixed(2));

  const isFhHabilitado = Boolean(batch.derivaciones?.finasHierbas?.habilitado);
  const fh100 = isFhHabilitado ? (batch.derivaciones?.finasHierbas?.moldes100g ?? 0) : 0;
  const fh200 = isFhHabilitado ? (batch.derivaciones?.finasHierbas?.moldes200g ?? 0) : 0;
  const fh350 = isFhHabilitado ? (batch.derivaciones?.finasHierbas?.moldes350g ?? 0) : 0;
  const fhDirectUnidades = isFhHabilitado ? batch.derivaciones?.finasHierbas?.unidades : undefined;
  const fhTotalUnidades = isFhHabilitado
    ? (fhDirectUnidades !== undefined ? fhDirectUnidades : (fh100 + fh200 + fh350))
    : 0;
  const fhTotalGramos = isFhHabilitado
    ? (fhDirectUnidades !== undefined
        ? fhDirectUnidades * (batch.derivaciones?.finasHierbas?.gramosPorUnidad || 350)
        : (fh100 * 100 + fh200 * 200 + fh350 * 350))
    : 0;
  const fhTotalKg = Number((fhTotalGramos / 1000).toFixed(2));
  const pesoRendimientoKg = isPera ? pesoFinalKg + mexTotalKg + fhTotalKg : pesoFinalKg;
  const rendimientoPorcentaje =
    totalLecheUsada > 0 ? ((pesoRendimientoKg / totalLecheUsada) * 100).toFixed(2) : '--';
  const fhEspeciasConsumidasG = isFhHabilitado
    ? (batch.derivaciones?.finasHierbas?.pesoUtilizadoGramos ??
        Math.max(0, (batch.derivaciones?.finasHierbas?.pesoInicialGramos ?? 0) - (batch.derivaciones?.finasHierbas?.pesoFinalGramos ?? 0)))
    : 0;

  // Especias Mexicano por separado
  const mexAjiConsumidoG = isMexHabilitado
    ? (batch.derivaciones?.mexicano?.especiasMexicano?.ajiPicante?.pesoUtilizadoGramos ??
        Math.max(0, (batch.derivaciones?.mexicano?.especiasMexicano?.ajiPicante?.pesoInicialGramos ?? 0) - (batch.derivaciones?.mexicano?.especiasMexicano?.ajiPicante?.pesoFinalGramos ?? 0)))
    : 0;
  const mexPimientaConsumidoG = isMexHabilitado
    ? (batch.derivaciones?.mexicano?.especiasMexicano?.pimienta?.pesoUtilizadoGramos ??
        Math.max(0, (batch.derivaciones?.mexicano?.especiasMexicano?.pimienta?.pesoInicialGramos ?? 0) - (batch.derivaciones?.mexicano?.especiasMexicano?.pimienta?.pesoFinalGramos ?? 0)))
    : 0;
  const mexTotalEspeciasG = isMexHabilitado
    ? (batch.derivaciones?.mexicano?.pesoUtilizadoGramos ?? (mexAjiConsumidoG + mexPimientaConsumidoG))
    : 0;

  // Sal de ambas salmueras (caliente + fría) para Queso Pera
  const salCalientePeraG =
    batch.hilar.salmuera?.cantidadSalGramos ?? (batch.hilar.sal?.cantidadGramos && batch.hilar.sal.cantidadGramos >= 1000 ? batch.hilar.sal.cantidadGramos : 0);
  const salFriaPeraG =
    batch.hilar.salmueraFria?.salGramos ?? 0;
  const totalSalPeraG = salCalientePeraG + salFriaPeraG;

  // Trazabilidad específica de Queso Pera
  const litrosLecheFrescaPera = batch.acidificar.insumos.lecheFresca || totalLecheUsada || 0;
  const loteLecheFrescaPera =
    batch.lotesLeche.loteLecheFresca ||
    batch.lotesLeche.loteLeche1 ||
    batch.lotesLeche.loteLeche2 ||
    'Sin registrar';
  const loteCultivoPera =
    batch.acidificar.insumos.loteCultivoLacteo ||
    batch.lotesLeche.loteCultivoLacteo ||
    'Sin registrar';
  const cultivoCdtas =
    batch.calentarYCuajar.cultivoLacticoPera?.cucharadas ??
    batch.acidificar.insumos.cultivoLacteoUnidades ??
    batch.lotesLeche.cultivoLacteoUnidades ??
    (litrosLecheFrescaPera > 0 ? Number((litrosLecheFrescaPera / 40).toFixed(2)) : 0);

  return (
    <>
      <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="4xl"
      icon="fact_check"
      title={`Resumen Final · ${batch.id}`}
      subtitle={
        <span>
          Producto: <span className="font-semibold text-amber-900">{batch.productName}</span> · {batch.line}
        </span>
      }
      badge={
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] text-[#1B4E9B] tracking-wider uppercase font-bold flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            VERIFICACIÓN DE LOTE Y CONTROL DE CALIDAD
          </span>
          {(batch.processTimer.isCompleted || batch.status === 'COMPLETADO') && (
            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300 text-[10px] font-black uppercase tracking-wider">
              ✓ PROCESO TERMINADO · RELOJ DETENIDO
            </span>
          )}
        </div>
      }
      tabs={
        <div className="flex items-center gap-2 px-5 py-2 bg-[#FFFFFF]">
          <button
            onClick={() => setActiveTab('resumen')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'resumen'
                ? 'bg-[#1B4E9B] text-white shadow-xs'
                : 'text-[#434655] hover:bg-[#F2F4F7]'
            }`}
          >
            Métricas Clave
          </button>
          <button
            onClick={() => setActiveTab('detalle')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'detalle'
                ? 'bg-[#1B4E9B] text-white shadow-xs'
                : 'text-[#434655] hover:bg-[#F2F4F7]'
            }`}
          >
            Desglose de 5 Fases
          </button>
          <button
            onClick={() => setActiveTab('certificado')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'certificado'
                ? 'bg-[#1B4E9B] text-white shadow-xs'
                : 'text-[#434655] hover:bg-[#F2F4F7]'
            }`}
          >
            Constancia del Lote
          </button>
        </div>
      }
      footer={
        <div className="w-full flex flex-wrap items-center justify-between gap-2.5">
          <div className="text-xs text-gray-500">
            Lote: <strong className="text-gray-800">{batch.id}</strong> · Responsable:{' '}
            <strong className="text-gray-800">{responsable}</strong>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <button
              className="h-10 px-4 bg-white border border-gray-300 text-gray-700 font-bold rounded-xl hover:bg-gray-100 transition-all text-xs flex items-center gap-1.5 cursor-pointer"
              onClick={onClose}
            >
              <span className="material-symbols-outlined text-[16px]">close</span>
              <span>Cerrar Resumen</span>
            </button>
            {onFinalizeBatch && batch.status !== 'COMPLETADO' && (
              <button
                className="h-10 px-5 bg-emerald-700 text-white font-bold rounded-xl hover:bg-emerald-800 transition-all shadow-md text-xs flex items-center gap-1.5 cursor-pointer active:scale-95"
                onClick={() => setShowConfirmAlert(true)}
              >
                {!is7Cueros && <span className="material-symbols-outlined text-[17px]">task_alt</span>}
                <span>{is7Cueros ? '✅ Confirmar proceso terminado' : 'Confirmar Proceso Terminado'}</span>
              </button>
            )}
          </div>
        </div>
      }
    >
          {activeTab === 'resumen' && (
            <div className="flex flex-col gap-4">
              {/* Key Metrics Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-[#FFFFFF] p-3.5 rounded-2xl border border-[#D6DEEA]">
                {/* Total Leche Usada */}
                <div className="bg-white p-3 rounded-xl border border-[#D6DEEA] shadow-2xs flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-[#434655] uppercase font-bold tracking-wider">
                      Total Leche Usada
                    </span>
                    <span className="material-symbols-outlined text-[#1B4E9B] text-[20px]">
                      water_drop
                    </span>
                  </div>
                  <div className="my-1">
                    <span className="font-black text-xl text-[#1B4E9B] font-mono">
                      {totalLecheUsada} L
                    </span>
                  </div>
                  <span className="text-[10px] text-gray-500 font-medium">
                    {isPera || is7Cueros
                      ? `${batch.acidificar.insumos.lecheFresca || totalLecheUsada} L fresca`
                      : `${batch.acidificar.insumos.lecheFresca} L fresca · ${batch.acidificar.insumos.lecheAcida} L ácida`}
                  </span>
                </div>

                {/* Cronómetro / Tiempo Total */}
                <div className="bg-white p-3 rounded-xl border border-[#D6DEEA] shadow-2xs flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-[#434655] uppercase font-bold tracking-wider">
                      Cronómetro / Tiempo Total
                    </span>
                    <span className="material-symbols-outlined text-amber-600 text-[20px]">
                      timer
                    </span>
                  </div>
                  <div className="my-1">
                    <span className="font-black text-xl text-gray-900 font-mono">
                      {batch.hilar.procesoFinalizado?.tiempoTotalProceso ||
                        batch.processTimer.formattedTime ||
                        '--:--:--'}
                    </span>
                  </div>
                  <span className="text-[10px] text-emerald-600 font-semibold">
                    {batch.processTimer.startTime
                      ? `Hora Inicio: ${batch.processTimer.startTime}`
                      : '✓ Proceso Monitoreado'}
                  </span>
                </div>

                {/* Responsable del Proceso */}
                <div className="bg-white p-3 rounded-xl border border-[#D6DEEA] shadow-2xs flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-[#434655] uppercase font-bold tracking-wider">
                      Responsable Principal
                    </span>
                    <span className="material-symbols-outlined text-gray-500 text-[20px]">
                      badge
                    </span>
                  </div>
                  <div className="my-1">
                    <span className="font-bold text-base text-gray-900 block truncate">
                      {responsable}
                    </span>
                  </div>
                  <span className="text-[10px] text-emerald-700 font-bold block truncate">
                    {operariosList.length} operario(s) registrado(s)
                  </span>
                </div>
              </div>

              {/* Trazabilidad de Materia Prima y Aditivos */}
              <div className="bg-[#FFFFFF] p-3 rounded-xl border border-[#D6DEEA] flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#191c1e] flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px] text-[#1B4E9B]">
                      inventory_2
                    </span>
                    {is7Cueros
                      ? 'Trazabilidad de Materias Primas e Insumos'
                      : isPera
                      ? 'Trazabilidad de Materias Primas y Aditivos'
                      : 'Trazabilidad de Materias Primas y Aditivos (2 Lotes de Leche, Cuajo y Sal)'}
                  </span>
                  <span className="text-[10px] text-gray-500 font-semibold bg-white px-2 py-0.5 rounded border border-[#D6DEEA]">
                    Lotes Registrados
                  </span>
                </div>
                {is7Cueros ? (
                  /* QUESO 7 CUEROS: TARJETAS DINÁMICAS EXCLUSIVAS DE INGREDIENTES */
                  <div className={`grid ${gridColsClass7C} gap-2.5 text-xs`}>
                    {/* Tarjeta 1: LOTE LECHE FRESCA */}
                    <div className="bg-white p-3 rounded-xl border-2 border-sky-400 flex flex-col justify-between shadow-2xs">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-sky-900 font-extrabold uppercase tracking-wide">
                          LOTE LECHE FRESCA
                        </span>
                        <span className="material-symbols-outlined text-sky-500 text-[18px]">
                          water_drop
                        </span>
                      </div>
                      <span className="font-bold text-sky-950 font-mono text-sm mt-1">
                        {loteLecheFresca7C}
                      </span>
                      <div className="mt-1 pt-1 border-t border-sky-100 flex items-center justify-between">
                        <span className="text-[11px] text-sky-800 font-bold">
                          {litrosLecheFresca7C} L usados
                        </span>
                        <span className="text-[9px] font-semibold text-sky-600 bg-sky-50 px-1.5 py-0.5 rounded">
                          Leche fresca
                        </span>
                      </div>
                    </div>

                    {/* Tarjeta 2: LOTE ÁCIDO ACÉTICO (SUB-PARTE A.1 y A.3) */}
                    <div className="bg-white p-3 rounded-xl border-2 border-teal-500 flex flex-col justify-between shadow-2xs">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-teal-900 font-extrabold uppercase tracking-wide">
                          LOTE ÁCIDO ACÉTICO
                        </span>
                        <span className="material-symbols-outlined text-teal-600 text-[18px]">
                          science
                        </span>
                      </div>
                      <span className="font-bold text-teal-950 font-mono text-sm mt-1">
                        {loteAcidoAcetico7C}
                      </span>
                      <div className="mt-1 pt-1 border-t border-teal-100 flex flex-col gap-0.5">
                        <span className="text-[11px] text-teal-800 font-bold flex items-center gap-1">
                          <span className="material-symbols-outlined text-[13px] text-emerald-600 font-bold">check_circle</span>
                          {phRango7C}
                        </span>
                        <div className="text-[10px] text-gray-600 flex items-center justify-between mt-0.5">
                          <span>Ácido 98%: <strong>{batch.acidificar.insumos.acidoBase98Ml ?? batch.lotesLeche.acidoBase98Ml ?? 0} ml</strong> · Agua: <strong>{batch.acidificar.insumos.aguaDiluyenteMl ?? 0} ml</strong></span>
                          <span>Solución 5%: <strong>{batch.acidificar.insumos.solucionPreparada5Litros ?? batch.lotesLeche.solucionPreparada5Litros ?? 0} L</strong></span>
                        </div>
                      </div>
                    </div>

                    {/* Tarjeta 3: LOTE AREQUIPE (Mostrar solo si se habilitó) */}
                    {isArequipe7C && (
                      <div className="bg-white p-3 rounded-xl border-2 border-amber-500 flex flex-col justify-between shadow-2xs">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-amber-900 font-extrabold uppercase tracking-wide">
                            LOTE AREQUIPE
                          </span>
                          <span className="material-symbols-outlined text-amber-600 text-[18px]">
                            bakery_dining
                          </span>
                        </div>
                        <span className="font-bold text-amber-950 font-mono text-sm mt-1">
                          {batch.derivaciones7Cueros?.arequipe?.loteArequipe || 'Sin registrar'}
                        </span>
                        <div className="mt-1 pt-1 border-t border-amber-100 flex items-center justify-between">
                          <span className="text-[11px] text-amber-800 font-bold">
                            {arequipeGastadoG.toLocaleString('es-CO')} g gastados
                          </span>
                          <span className="text-[9px] font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
                            Quesadillas
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Tarjeta 4: LOTE BOCADILLO (Mostrar solo si se habilitó) */}
                    {isBocadillo7C && (
                      <div className="bg-white p-3 rounded-xl border-2 border-rose-500 flex flex-col justify-between shadow-2xs">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-rose-900 font-extrabold uppercase tracking-wide">
                            LOTE BOCADILLO
                          </span>
                          <span className="material-symbols-outlined text-rose-600 text-[18px]">
                            cake
                          </span>
                        </div>
                        <span className="font-bold text-rose-950 font-mono text-sm mt-1">
                          {batch.derivaciones7Cueros?.bocadillo?.loteBocadillo || 'Sin registrar'}
                        </span>
                        <div className="mt-1 pt-1 border-t border-rose-100 flex items-center justify-between">
                          <span className="text-[11px] text-rose-800 font-bold">
                            {bocadillosGastadosU} {bocadillosGastadosU === 1 ? 'unidad gastada' : 'unidades gastadas'}
                          </span>
                          <span className="text-[9px] font-semibold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded">
                            Quesadillas
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                ) : isPera ? (
                  /* QUESO PERA: 4 TARJETAS ESPECÍFICAS CON BORDES DIFERENCIADOS */
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 text-xs">
                    {/* Tarjeta 1 (Cultivo - Borde Verde) */}
                    <div className="bg-white p-2.5 rounded-lg border-2 border-emerald-500 flex flex-col justify-between shadow-2xs">
                      <span className="text-[10px] text-emerald-900 font-extrabold uppercase tracking-wide">
                        LOTE CULTIVO LÁCTEO RSF - 742
                      </span>
                      <span className="font-bold text-emerald-950 font-mono text-xs sm:text-sm mt-0.5">
                        {loteCultivoPera}
                      </span>
                      <span className="text-[10px] text-emerald-700 font-bold mt-1">
                        {cultivoCdtas} cda{cultivoCdtas !== 1 ? 's' : ''} dosificadas
                      </span>
                    </div>

                    {/* Tarjeta 2 (Leche - Borde Azul claro) */}
                    <div className="bg-white p-2.5 rounded-lg border-2 border-sky-400 flex flex-col justify-between shadow-2xs">
                      <span className="text-[10px] text-sky-900 font-extrabold uppercase tracking-wide">
                        LOTE LECHE FRESCA
                      </span>
                      <span className="font-bold text-sky-950 font-mono text-xs sm:text-sm mt-0.5">
                        {loteLecheFrescaPera}
                      </span>
                      <span className="text-[10px] text-sky-700 font-bold mt-1">
                        {litrosLecheFrescaPera} L volumen
                      </span>
                    </div>

                    {/* Tarjeta 3 (Cuajo - Borde Azul medio) */}
                    <div className="bg-white p-2.5 rounded-lg border-2 border-blue-500 flex flex-col justify-between shadow-2xs">
                      <span className="text-[10px] text-blue-900 font-extrabold uppercase tracking-wide">
                        LOTE CUAJO (COAGULANTE)
                      </span>
                      <span className="font-bold text-blue-950 font-mono text-xs sm:text-sm mt-0.5">
                        {batch.loteCuajo || 'Sin registrar'}
                      </span>
                      <span className="text-[10px] text-blue-700 font-bold mt-1">
                        1.2 g / 100 L
                      </span>
                    </div>

                    {/* Tarjeta 4 (Sal - Borde Amarillo) */}
                    <div className="bg-white p-2.5 rounded-lg border-2 border-amber-400 flex flex-col justify-between shadow-2xs">
                      <span className="text-[10px] text-amber-900 font-extrabold uppercase tracking-wide">
                        LOTE SAL (AMBAS SALMUERAS)
                      </span>
                      <span className="font-bold text-amber-950 font-mono text-xs sm:text-sm mt-0.5">
                        {batch.hilar.sal?.loteSal || batch.loteSal || 'Sin registrar'}
                      </span>
                      <span className="text-[10px] text-amber-900 font-bold mt-1">
                        Total: {totalSalPeraG.toLocaleString('es-CO')} g ({ (totalSalPeraG / 1000).toFixed(2) } kg)
                      </span>
                      <span className="text-[9px] text-gray-500">
                        Caliente: {salCalientePeraG} g + Fría: {salFriaPeraG} g
                      </span>
                    </div>
                  </div>
                ) : (
                  /* PRODUCTOS INDUSTRIAL / TRADICIONAL */
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 text-xs">
                    {batch.productId === 'prod-doble-crema-industrial' ? (
                      <div className="bg-white p-2 rounded-lg border border-emerald-300 flex flex-col justify-between">
                        <span className="text-[10px] text-emerald-900 font-bold uppercase">
                          Ácido Acético:
                        </span>
                        <span className="font-bold text-emerald-950 font-mono text-xs mt-0.5">
                          {batch.lotesLeche.loteCultivoLacteo || batch.acidificar.insumos.loteCultivoLacteo || 'Sin registrar'}
                        </span>
                        <span className="text-[10px] text-emerald-800 font-semibold">
                          {batch.acidificar.insumos.cultivoLacteoGramos || batch.lotesLeche.cultivoLacteoGramos || 0} ml dosificado
                        </span>
                      </div>
                    ) : (
                      <div className="bg-white p-2 rounded-lg border border-amber-200 flex flex-col justify-between">
                        <span className="text-[10px] text-[#434655] font-bold uppercase">
                          Lote Leche 1 (Base/Ácida):
                        </span>
                        <span className="font-bold text-amber-900 font-mono text-xs mt-0.5">
                          {batch.lotesLeche.loteLecheBase || batch.lotesLeche.loteLeche1 || 'Sin registrar'}
                        </span>
                        <span className="text-[10px] text-gray-500">
                          {batch.acidificar.insumos.lecheAcida} L volumen
                        </span>
                      </div>
                    )}
                    <div className="bg-white p-2 rounded-lg border border-blue-200 flex flex-col justify-between">
                      <span className="text-[10px] text-[#434655] font-bold uppercase">
                        Lote Leche 2 (Fresca):
                      </span>
                      <span className="font-bold text-[#1B4E9B] font-mono text-xs mt-0.5">
                        {batch.lotesLeche.loteLecheFresca || batch.lotesLeche.loteLeche2 || 'Sin registrar'}
                      </span>
                      <span className="text-[10px] text-gray-500">
                        {batch.acidificar.insumos.lecheFresca} L volumen
                      </span>
                    </div>
                    <div className="bg-white p-2 rounded-lg border border-blue-200 flex flex-col justify-between">
                      <span className="text-[10px] text-[#434655] font-bold uppercase">
                        Lote Cuajo (Coagulante):
                      </span>
                      <span className="font-bold text-blue-900 font-mono text-xs mt-0.5">
                        {batch.loteCuajo || 'Sin registrar'}
                      </span>
                      <span className="text-[10px] text-blue-700 font-semibold">1.4 g / 100 L</span>
                    </div>
                    <div className="bg-white p-2 rounded-lg border border-amber-200 flex flex-col justify-between">
                      <span className="text-[10px] text-[#434655] font-bold uppercase">
                        Lote Sal:
                      </span>
                      <span className="font-bold text-amber-900 font-mono text-xs mt-0.5">
                        {batch.loteSal || 'Sin registrar'}
                      </span>
                      <span className="text-[10px] text-amber-700 font-semibold">360 g / 300 L</span>
                    </div>
                  </div>
                )}
              </div>

              {/* NUEVA SECCIÓN: Resumen de Derivados (Mexicano y Finas Hierbas) - EXCLUSIVO QUESO PERA */}
              {isPera && (
                <div className="bg-[#FFFFFF] p-3 rounded-xl border border-[#D6DEEA] flex flex-col gap-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#191c1e] flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[16px] text-amber-700">
                        account_tree
                      </span>
                      Producción de Derivados del Lote
                    </span>
                    <span className="text-[10px] text-gray-500 font-semibold bg-white px-2 py-0.5 rounded border border-[#D6DEEA]">
                      Derivaciones de Pasta Resultante
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {/* Tarjeta A (Queso Mexicano) */}
                    <div
                      className={`p-3 rounded-xl border flex flex-col justify-between transition-all ${
                        isMexHabilitado
                          ? 'bg-amber-50/70 border-amber-300 shadow-2xs'
                          : 'bg-gray-50/80 border-gray-200'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`material-symbols-outlined text-[18px] ${
                              isMexHabilitado ? 'text-amber-600' : 'text-gray-400'
                            }`}
                          >
                            local_fire_department
                          </span>
                          <span
                            className={`text-xs font-bold ${
                              isMexHabilitado ? 'text-amber-950' : 'text-gray-500'
                            }`}
                          >
                            Queso Mexicano
                          </span>
                        </div>
                        <span
                          className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                            isMexHabilitado
                              ? 'bg-amber-200 text-amber-900 border border-amber-300'
                              : 'bg-gray-200 text-gray-500'
                          }`}
                        >
                          {isMexHabilitado ? 'Habilitado' : 'Inactivo'}
                        </span>
                      </div>

                      <div className="mt-2.5">
                        {isMexHabilitado ? (
                          <div>
                            <span className="text-xs sm:text-sm font-bold text-amber-950 block">
                              Sí se elaboró - {mexTotalUnidades} unidades obtenidas ({mexTotalKg.toFixed(2)} kg)
                            </span>
                            <div className="text-[10px] text-amber-900 mt-1 font-medium bg-amber-100/60 p-1.5 rounded-lg border border-amber-200">
                              Especias por separado: Ají: <strong className="font-mono text-orange-950">{mexAjiConsumidoG} g</strong> · Pimienta: <strong className="font-mono text-amber-950">{mexPimientaConsumidoG} g</strong> (Total: {mexTotalEspeciasG} g)
                            </div>
                            {batch.derivaciones?.mexicano?.codigoLote && (
                              <span className="text-[10px] font-mono text-amber-800 mt-1 block">
                                Lote derivado: {batch.derivaciones.mexicano.codigoLote}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs font-medium text-gray-400 block">
                            No utilizado en este lote
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Tarjeta B (Finas Hierbas) */}
                    <div
                      className={`p-3 rounded-xl border flex flex-col justify-between transition-all ${
                        isFhHabilitado
                          ? 'bg-emerald-50/70 border-emerald-300 shadow-2xs'
                          : 'bg-gray-50/80 border-gray-200'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`material-symbols-outlined text-[18px] ${
                              isFhHabilitado ? 'text-emerald-600' : 'text-gray-400'
                            }`}
                          >
                            eco
                          </span>
                          <span
                            className={`text-xs font-bold ${
                              isFhHabilitado ? 'text-emerald-950' : 'text-gray-500'
                            }`}
                          >
                            Finas Hierbas
                          </span>
                        </div>
                        <span
                          className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                            isFhHabilitado
                              ? 'bg-emerald-200 text-emerald-900 border border-emerald-300'
                              : 'bg-gray-200 text-gray-500'
                          }`}
                        >
                          {isFhHabilitado ? 'Habilitado' : 'Inactivo'}
                        </span>
                      </div>

                      <div className="mt-2.5">
                        {isFhHabilitado ? (
                          <div>
                            <span className="text-xs sm:text-sm font-bold text-emerald-950 block">
                              Sí se elaboró - {fhTotalUnidades} unidades obtenidas ({fhTotalKg.toFixed(2)} kg)
                            </span>
                            <div className="text-[10px] text-emerald-900 mt-1 font-medium bg-emerald-100/60 p-1.5 rounded-lg border border-emerald-200">
                              Especias: <strong className="font-mono text-emerald-950">{fhEspeciasConsumidasG} g</strong> consumidos (sin pimienta)
                            </div>
                            {batch.derivaciones?.finasHierbas?.codigoLote && (
                              <span className="text-[10px] font-mono text-emerald-800 mt-1 block">
                                Lote derivado: {batch.derivaciones.finasHierbas.codigoLote}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs font-medium text-gray-400 block">
                            No utilizado en este lote
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* RESUMEN DE PRODUCCIÓN Y DERIVADOS - EXCLUSIVO QUESO 7 CUEROS */}
              {is7Cueros && (
                <div className="bg-[#FFFFFF] p-3.5 rounded-xl border border-teal-300 flex flex-col gap-2.5 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#191c1e] flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[18px] text-teal-800">
                        inventory_2
                      </span>
                      Resumen de Producción y Derivados
                    </span>
                    <span className="text-[10px] text-teal-900 font-bold bg-teal-50 px-2.5 py-0.5 rounded-full border border-teal-200">
                      {totalMoldes7Cueros} unidades totales · {pesoFinalKg.toFixed(2)} kg
                    </span>
                  </div>

                  <div className={`grid grid-cols-1 ${
                    (2 + (isArequipe7C ? 1 : 0) + (isBocadillo7C ? 1 : 0)) === 2
                      ? 'sm:grid-cols-2'
                      : (2 + (isArequipe7C ? 1 : 0) + (isBocadillo7C ? 1 : 0)) === 3
                      ? 'sm:grid-cols-3'
                      : 'sm:grid-cols-2 lg:grid-cols-4'
                  } gap-2.5`}>
                    {/* Variedad 1: Formato 7 Cueros (350g) */}
                    <div
                      className={`p-3 rounded-xl border flex flex-col justify-between transition-all ${
                        has7Cueros
                          ? 'bg-teal-50/70 border-teal-400 shadow-2xs'
                          : 'bg-gray-100/90 border-gray-300 text-gray-500'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`material-symbols-outlined text-[18px] ${
                              has7Cueros ? 'text-teal-700' : 'text-gray-400'
                            }`}
                          >
                            layers
                          </span>
                          <span
                            className={`text-xs font-bold ${
                              has7Cueros ? 'text-teal-950' : 'text-gray-600'
                            }`}
                          >
                            Formato 7 Cueros (350g)
                          </span>
                        </div>
                        <span
                          className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                            has7Cueros
                              ? 'bg-teal-200 text-teal-900 border border-teal-300'
                              : 'bg-gray-200 text-gray-500'
                          }`}
                        >
                          {has7Cueros ? 'Elaborado' : 'Sin unidades'}
                        </span>
                      </div>

                      <div className="mt-2.5">
                        {has7Cueros ? (
                          <div>
                            <span className="text-sm font-black font-mono text-teal-950 block">
                              Formato 7 Cueros (350g): {m7Cueros} unidades
                            </span>
                            <span className="text-[10px] text-teal-800 font-medium mt-0.5 block">
                              {(m7Cueros * 350).toLocaleString('es-CO')} g ({(m7Cueros * 0.35).toFixed(2)} kg)
                            </span>
                          </div>
                        ) : (
                          <div className="py-1">
                            <span className="text-xs font-bold text-gray-500 italic block">
                              No elaborado en este lote
                            </span>
                            <span className="text-[10px] text-gray-400 mt-0.5 block">
                              0 unidades reportadas
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Variedad 2: Formato Trenza (350g) */}
                    <div
                      className={`p-3 rounded-xl border flex flex-col justify-between transition-all ${
                        hasTrenza
                          ? 'bg-amber-50/70 border-amber-400 shadow-2xs'
                          : 'bg-gray-100/90 border-gray-300 text-gray-500'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`material-symbols-outlined text-[18px] ${
                              hasTrenza ? 'text-amber-700' : 'text-gray-400'
                            }`}
                          >
                            grain
                          </span>
                          <span
                            className={`text-xs font-bold ${
                              hasTrenza ? 'text-amber-950' : 'text-gray-600'
                            }`}
                          >
                            Formato Trenza (350g)
                          </span>
                        </div>
                        <span
                          className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                            hasTrenza
                              ? 'bg-amber-200 text-amber-900 border border-amber-300'
                              : 'bg-gray-200 text-gray-500'
                          }`}
                        >
                          {hasTrenza ? 'Elaborado' : 'Sin unidades'}
                        </span>
                      </div>

                      <div className="mt-2.5">
                        {hasTrenza ? (
                          <div>
                            <span className="text-sm font-black font-mono text-amber-950 block">
                              Formato Trenza (350g): {mTrenza} unidades
                            </span>
                            <span className="text-[10px] text-amber-800 font-medium mt-0.5 block">
                              {(mTrenza * 350).toLocaleString('es-CO')} g ({(mTrenza * 0.35).toFixed(2)} kg)
                            </span>
                          </div>
                        ) : (
                          <div className="py-1">
                            <span className="text-xs font-bold text-gray-500 italic block">
                              No elaborado en este lote
                            </span>
                            <span className="text-[10px] text-gray-400 mt-0.5 block">
                              0 unidades reportadas
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Variedad 3: Quesadillas con Arequipe (60g) - Solo si está habilitado */}
                    {isArequipe7C && (
                      <div className="p-3 rounded-xl border flex flex-col justify-between transition-all bg-amber-50/70 border-amber-400 shadow-2xs">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-[18px] text-amber-800">
                              bakery_dining
                            </span>
                            <span className="text-xs font-bold text-amber-950">
                              Quesadillas con Arequipe (60g)
                            </span>
                          </div>
                          <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-200 text-amber-950 border border-amber-300">
                            {hasArequipe ? 'Elaborado' : 'Sin unidades'}
                          </span>
                        </div>

                        <div className="mt-2.5">
                          <span className="text-sm font-black font-mono text-amber-950 block">
                            Quesadillas con Arequipe (60g): {mQuesadillaArq} unidades
                          </span>
                          <span className="text-[10px] text-amber-800 font-medium mt-0.5 block">
                            {(mQuesadillaArq * 60).toLocaleString('es-CO')} g ({(mQuesadillaArq * 0.06).toFixed(2)} kg) · {arequipeGastadoG}g gastados
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Variedad 4: Quesadillas con Bocadillo (60g) - Solo si está habilitado */}
                    {isBocadillo7C && (
                      <div className="p-3 rounded-xl border flex flex-col justify-between transition-all bg-rose-50/70 border-rose-400 shadow-2xs">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-[18px] text-rose-800">
                              cake
                            </span>
                            <span className="text-xs font-bold text-rose-950">
                              Quesadillas con Bocadillo (60g)
                            </span>
                          </div>
                          <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-rose-200 text-rose-950 border border-rose-300">
                            {hasBocadillo ? 'Elaborado' : 'Sin unidades'}
                          </span>
                        </div>

                        <div className="mt-2.5">
                          <span className="text-sm font-black font-mono text-rose-950 block">
                            Quesadillas con Bocadillo (60g): {mQuesadillaBoc} unidades
                          </span>
                          <span className="text-[10px] text-rose-800 font-medium mt-0.5 block">
                            {(mQuesadillaBoc * 60).toLocaleString('es-CO')} g ({(mQuesadillaBoc * 0.06).toFixed(2)} kg) · {bocadillosGastadosU} {bocadillosGastadosU === 1 ? 'unidad de bocadillo' : 'unidades de bocadillo'}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* FORMULARIO DE OBSERVACIONES AL CIERRE DEL PROCESO */}
              <div className="p-3.5 rounded-xl bg-white border border-[#D6DEEA] shadow-2xs flex flex-col gap-2">
                <div className="flex items-center justify-between pb-1.5 border-b border-[#D6DEEA]/70">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px] text-amber-700">
                      notes
                    </span>
                    <h3 className="font-bold text-xs sm:text-sm text-gray-900">
                      Formulario de Observaciones al Cierre del Proceso
                    </h3>
                  </div>
                  <span className="text-[10px] text-gray-500 font-medium">
                    Bitácora Oficial de Lote
                  </span>
                </div>
                <textarea
                  rows={2}
                  value={localObservaciones}
                  onChange={(e) => {
                    const val = e.target.value;
                    setLocalObservaciones(val);
                    if (onChangeObservaciones) onChangeObservaciones(val);
                  }}
                  placeholder="Ingresa aquí observaciones, desviaciones menores, ajustes de dosificación o incidencias técnicas ocurridas durante el proceso..."
                  className="w-full p-2.5 rounded-lg bg-[#FFFFFF] border border-[#D6DEEA] text-xs text-gray-900 placeholder:text-gray-400 outline-none focus:border-[#1B4E9B] focus:bg-white transition-all resize-y"
                />
                <div className="flex items-center justify-between text-[10px] text-gray-500">
                  <span>
                    Responsable de registro: <strong>{responsable}</strong>
                  </span>
                  <span>{localObservaciones.length} caracteres</span>
                </div>
              </div>

              {/* MENÚ DESPLEGABLE DE OPERARIOS QUE INTERVINIERON EN EL PROCESO (JUSTO DEBAJO DE OBSERVACIONES) */}
              <div className="p-3.5 rounded-xl bg-[#FFFFFF] border border-[#D6DEEA] shadow-2xs flex flex-col gap-2.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pb-1.5 border-b border-[#D6DEEA]/70">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px] text-[#1B4E9B]">
                      group_add
                    </span>
                    <h3 className="font-bold text-xs sm:text-sm text-gray-900">
                      Operarios que Intervinieron en el Proceso
                    </h3>
                  </div>
                  <span className="text-[10px] font-bold text-[#1B4E9B] bg-blue-50 px-2 py-0.5 rounded border border-blue-200 self-start sm:self-auto">
                    {operariosList.length} operario(s) en el lote
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <div className="relative flex-1">
                    <select
                      value={selectedDropdownOp}
                      onChange={handleDropdownChange}
                      className="w-full p-2.5 rounded-xl bg-white border border-[#D6DEEA] text-xs font-bold text-gray-900 outline-none focus:border-[#1B4E9B] focus:ring-2 focus:ring-blue-100 cursor-pointer"
                    >
                      <option value="">
                        -- Seleccionar operario del menú desplegable para agregar al lote --
                      </option>
                      {availableOperators.map((op) => (
                        <option key={op} value={op}>
                          {operariosList.includes(op) ? `✓ ${op} (Ya agregado)` : `+ ${op}`}
                        </option>
                      ))}
                      <option value="__custom__">
                        + Ingresar otro operario manualmente...
                      </option>
                    </select>
                  </div>
                </div>

                {showCustomInput && (
                  <div className="flex items-center gap-2 bg-white p-2 rounded-xl border border-blue-200">
                    <input
                      type="text"
                      value={customOperatorName}
                      onChange={(e) => setCustomOperatorName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddCustomOperator();
                        }
                      }}
                      placeholder="Nombre completo y código del operario (ej: Pedro Gómez OP-120)..."
                      className="flex-1 px-2.5 py-1.5 text-xs rounded-lg bg-[#FFFFFF] border border-[#D6DEEA] outline-none focus:border-[#1B4E9B]"
                    />
                    <button
                      type="button"
                      onClick={handleAddCustomOperator}
                      className="px-3 py-1.5 rounded-lg bg-[#1B4E9B] hover:bg-blue-800 text-white text-xs font-bold cursor-pointer"
                    >
                      Agregar
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowCustomInput(false);
                        setCustomOperatorName('');
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs font-bold cursor-pointer"
                    >
                      Cancelar
                    </button>
                  </div>
                )}

                {/* Lista de etiquetas (chips) de los operarios seleccionados */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {operariosList.length === 0 ? (
                    <span className="text-[11px] text-gray-400 italic">
                      Ningún operario seleccionado. Usa el menú desplegable para agregar los operarios que participaron.
                    </span>
                  ) : (
                    operariosList.map((op) => (
                      <span
                        key={op}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-blue-200 text-xs font-bold text-gray-800 shadow-2xs"
                      >
                        <span className="material-symbols-outlined text-[14px] text-[#1B4E9B]">
                          person
                        </span>
                        <span>{op}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveOperator(op)}
                          className="ml-0.5 text-gray-400 hover:text-red-600 transition-colors cursor-pointer flex items-center"
                          title={`Quitar a ${op}`}
                        >
                          <span className="material-symbols-outlined text-[15px]">close</span>
                        </button>
                      </span>
                    ))
                  )}
                </div>
              </div>

              {/* Critical limits LCC banner */}
              <div className="flex items-start gap-2.5 bg-amber-50 p-3 rounded-xl border border-amber-200">
                <span className="material-symbols-outlined text-amber-700 text-[20px] shrink-0 mt-0.5">
                  verified
                </span>
                <div>
                  <div className="text-xs font-bold text-amber-900">
                    Límites Críticos de Control (LCC) Cumplidos
                  </div>
                  <p className="text-[11px] text-amber-800 mt-0.5">
                    Todos los parámetros ingresados (pH de acidificación, temperatura de hilado, coagulación y moldeo)
                    se encuentran dentro de los límites críticos de control (LCC) establecidos.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'detalle' && (
            <div className="space-y-3 text-xs">
              {/* FASE 1: ACIDIFICAR Y CALENTAR A 35 °C */}
              <div className="p-3.5 rounded-2xl bg-white border border-[#D6DEEA] shadow-2xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2.5 border-b border-[#D6DEEA]/70 gap-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-md bg-blue-100 text-[#1B4E9B] text-[10px] font-black uppercase tracking-wider border border-blue-200">
                      Fase 01
                    </span>
                    <h3 className="font-bold text-sm text-gray-900">
                      {batch.productId === 'prod-queso-pera'
                        ? 'Etapa de Premaduración'
                        : 'Acidificación y Calentamiento a 35 °C'}
                    </h3>
                  </div>
                  <div className="text-[11px] font-semibold text-amber-900 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200 self-start sm:self-auto flex items-center gap-1.5 flex-wrap">
                    <span>Consigna: {batch.acidificar.tempConsigna} °C</span>
                    <span>·</span>
                    {is7Cueros ? (
                      <>
                        <span>pH Medido: <strong className="font-mono text-[#1B4E9B]">{batch.acidificar.insumos.phMezcla ?? '--'}</strong></span>
                        <span className="text-[10px] text-emerald-800 bg-emerald-100/70 px-1.5 py-0.2 rounded border border-emerald-300">
                          {phRango7C}
                        </span>
                      </>
                    ) : (
                      <>
                        <span>pH Medido Leche: <strong className="font-mono text-[#1B4E9B]">{batch.acidificar.insumos.phMezcla ?? '--'}</strong></span>
                        <span className="text-[10px] text-emerald-800 bg-emerald-100/70 px-1.5 py-0.2 rounded border border-emerald-300">
                          Obj: 5.7 (5.6 - 5.8)
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-2.5">
                  <div className="p-2.5 rounded-xl bg-[#FFFFFF] border border-[#D6DEEA]/80 flex flex-col">
                    <span className="text-[9px] uppercase font-bold text-gray-500">
                      {batch.productId === 'prod-queso-pera' ? 'Inicio Premaduración' : 'Inicio Calentamiento'}
                    </span>
                    <span className="text-sm font-black font-mono text-gray-900 mt-0.5">
                      {batch.acidificar.inicioCalentamiento?.horaInicio || '--:--'}
                    </span>
                    <span className="text-[9px] text-gray-400 mt-0.5">Arranque de tina</span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-[#FFFFFF] border border-[#D6DEEA]/80 flex flex-col">
                    <span className="text-[9px] uppercase font-bold text-gray-500">
                      {batch.productId === 'prod-queso-pera' ? '40 °C Alcanzado' : '35 °C Alcanzado'}
                    </span>
                    <span className="text-sm font-black font-mono text-amber-900 mt-0.5">
                      {batch.acidificar.phase1.horaAlcanzo35 || '--:--'}
                    </span>
                    <span className="text-[9px] text-gray-500 mt-0.5">
                      Tardó: {batch.acidificar.phase1.tiempoCalentamiento || '--'}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-[#FFFFFF] border border-[#D6DEEA]/80 flex flex-col">
                    <span className="text-[9px] uppercase font-bold text-gray-500">
                      {batch.productId === 'prod-queso-pera' ? 'Adición Cultivo Láctico' : 'Adición de Cuajo'}
                    </span>
                    <span className="text-sm font-black font-mono text-[#1B4E9B] mt-0.5">
                      {batch.acidificar.phase2.horaAdicionCultivo || batch.acidificar.phase2.horaAdicionCuajo || '--:--'}
                    </span>
                    <span className="text-[9px] text-gray-500 mt-0.5">
                      {batch.productId === 'prod-queso-pera'
                        ? `${batch.acidificar.phase2.cantidadCultivoUnidades ?? batch.acidificar.insumos.cultivoLacteoUnidades ?? 0} cucharaditas`
                        : (batch.acidificar.phase2.cantidadCuajo || '--')}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-[#FFFFFF] border border-[#D6DEEA]/80 flex flex-col">
                    <span className="text-[9px] uppercase font-bold text-gray-500">
                      {batch.productId === 'prod-queso-pera' ? 'Leche & Cultivo (U)' : 'Leche Involucrada'}
                    </span>
                    <span className="text-sm font-black font-mono text-emerald-800 mt-0.5">
                      {batch.productId === 'prod-queso-pera'
                        ? `${batch.lotesLeche.litrosLote1 || batch.acidificar.insumos.lecheFresca} L`
                        : `${totalLecheUsada} L`}
                    </span>
                    <span className="text-[9px] text-gray-500 mt-0.5">
                      {batch.productId === 'prod-queso-pera'
                        ? `Cultivo: ${batch.lotesLeche.cultivoLacteoUnidades ?? batch.acidificar.insumos.cultivoLacteoUnidades ?? 0} Unidades`
                        : `${batch.acidificar.insumos.lecheFresca}L fres. / ${batch.acidificar.insumos.lecheAcida}L ác.`}
                    </span>
                  </div>
                </div>
              </div>

              {/* FASE 2: CALENTAR Y CUAJAR */}
              <div className="p-3.5 rounded-2xl bg-white border border-[#D6DEEA] shadow-2xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2.5 border-b border-[#D6DEEA]/70 gap-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-md bg-blue-100 text-[#1B4E9B] text-[10px] font-black uppercase tracking-wider border border-blue-200">
                      Fase 02
                    </span>
                    <h3 className="font-bold text-sm text-gray-900">
                      {is7Cueros ? 'Agregar Cuajo' : 'Calentar y Cuajar (Coagulación, Corte Finalizado y 40 °C)'}
                    </h3>
                  </div>
                  <div className="text-[11px] font-semibold text-amber-900 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200 self-start sm:self-auto">
                    Consigna Térmica: 40.0 °C
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-2.5">
                  <div className="p-2.5 rounded-xl bg-[#FFFFFF] border border-[#D6DEEA]/80 flex flex-col">
                    <span className="text-[9px] uppercase font-bold text-gray-500">Hora Adición Cuajo</span>
                    <span className="text-sm font-black font-mono text-gray-900 mt-0.5">
                      {batch.calentarYCuajar.adicionCuajo?.horaRegistro || batch.acidificar.phase2.horaAdicionCuajo || batch.calentarYCuajar.horaAdicionCuajo || '--:--'}
                    </span>
                    <span className="text-[9px] text-gray-400 mt-0.5">Punto de partida</span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-[#FFFFFF] border border-[#D6DEEA]/80 flex flex-col">
                    <span className="text-[9px] uppercase font-bold text-gray-500">Tiempo de Cuajado</span>
                    <span className="text-sm font-black font-mono text-amber-900 mt-0.5">
                      {batch.calentarYCuajar.cuajado.horaRegistro || '--:--'}
                    </span>
                    <span className="text-[9px] text-[#1B4E9B] font-bold mt-0.5">
                      Tardó: {batch.calentarYCuajar.cuajado.tiempoTranscurridoDesdeCuajo || '--'}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-[#FFFFFF] border border-[#D6DEEA]/80 flex flex-col">
                    <span className="text-[9px] uppercase font-bold text-gray-500">Corte Finalizado</span>
                    <span className="text-sm font-black font-mono text-amber-900 mt-0.5">
                      {batch.calentarYCuajar.corte.horaRegistro || '--:--'}
                    </span>
                    <span className="text-[9px] text-[#1B4E9B] font-bold mt-0.5">
                      Tardó: {batch.calentarYCuajar.corte.tiempoTranscurridoDesdeCuajado || '--'}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-[#FFFFFF] border border-[#D6DEEA]/80 flex flex-col">
                    <span className="text-[9px] uppercase font-bold text-gray-500">Ya se llegó a 40 °C</span>
                    <span className="text-sm font-black font-mono text-emerald-800 mt-0.5">
                      {batch.calentarYCuajar.temperatura40.horaRegistro || '--:--'}
                    </span>
                    <span className="text-[9px] text-[#1B4E9B] font-bold mt-0.5">
                      Tardó: {batch.calentarYCuajar.temperatura40.tiempoCalentamiento40 || '--'}
                    </span>
                  </div>
                </div>
              </div>

              {/* FASE 3: DESUERAR Y ESCURRIDO */}
              <div className="p-3.5 rounded-2xl bg-white border border-[#D6DEEA] shadow-2xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2.5 border-b border-[#D6DEEA]/70 gap-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-md bg-blue-100 text-[#1B4E9B] text-[10px] font-black uppercase tracking-wider border border-blue-200">
                      Fase 03
                    </span>
                    <h3 className="font-bold text-sm text-gray-900">
                      Ya Desueré y He Escurrido (Medición de pH)
                    </h3>
                  </div>
                  <div className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 self-start sm:self-auto">
                    ✓ 40.0 °C Verificado · pH Escurrido: {batch.desuerar.escurrido?.phEscurrido || '--'}
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-2.5">
                  <div className="p-2.5 rounded-xl bg-[#FFFFFF] border border-[#D6DEEA]/80 flex flex-col">
                    <span className="text-[9px] uppercase font-bold text-gray-500">Temp. Verificada</span>
                    <span className="text-sm font-black font-mono text-emerald-700 mt-0.5">
                      {batch.desuerar.temperaturaVerificada.toFixed(1)} °C
                    </span>
                    <span className="text-[9px] text-gray-400 mt-0.5">
                      Hora: {batch.desuerar.desuerado.horaRegistro || '--:--'}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-[#FFFFFF] border border-[#D6DEEA]/80 flex flex-col">
                    <span className="text-[9px] uppercase font-bold text-gray-500">Tiempo de Desuerado</span>
                    <span className="text-sm font-black font-mono text-[#1B4E9B] mt-0.5">
                      {batch.desuerar.desuerado.tiempoDesuerado || '--'}
                    </span>
                    <span className="text-[9px] text-gray-500 mt-0.5">
                      Registro: {batch.desuerar.desuerado.horaRegistro || '--:--'}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-[#FFFFFF] border border-amber-200 flex flex-col">
                    <span className="text-[9px] uppercase font-bold text-amber-900">Tiempo de Escurrido</span>
                    <span className="text-sm font-black font-mono text-[#1B4E9B] mt-0.5">
                      {batch.desuerar.escurrido?.tiempoEscurrido || '--'}
                    </span>
                    <span className="text-[9px] text-gray-500 mt-0.5">
                      Bandeja: {batch.desuerar.escurrido?.horaInicio || '--:--'}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-[#FFFFFF] border border-emerald-200 flex flex-col">
                    <span className="text-[9px] uppercase font-bold text-emerald-800">pH en Escurrido</span>
                    <span className="text-base font-black font-mono text-emerald-700 mt-0.5">
                      {batch.desuerar.escurrido?.phEscurrido || '--'}
                    </span>
                    <span className="text-[9px] text-emerald-600 font-semibold mt-0.5">Óptimo: 5.2 - 5.4</span>
                  </div>
                </div>
              </div>

              {/* FASE 4: PRUEBA DE HILADO, ADICIÓN DE SAL Y PROCESO DE HILADO */}
              <div className="p-3.5 rounded-2xl bg-white border border-[#D6DEEA] shadow-2xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2.5 border-b border-[#D6DEEA]/70 gap-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-md bg-blue-100 text-[#1B4E9B] text-[10px] font-black uppercase tracking-wider border border-blue-200">
                      Fase 04
                    </span>
                    <h3 className="font-bold text-sm text-gray-900">
                      Prueba de Hilado Exitosa, Adición de Sal y Proceso de Hilado
                    </h3>
                  </div>
                  <div className="text-[11px] font-semibold text-amber-900 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200 self-start sm:self-auto">
                    pH Escurrido: {batch.desuerar.escurrido?.phEscurrido || '--'} · Sal: {isPera ? `${totalSalPeraG.toLocaleString('es-CO')} g (Salmueras caliente + fría)` : `${batch.hilar.sal?.cantidadGramos || (is7Cueros ? Math.round((totalLecheUsada * 560) / 300) : Math.round((totalLecheUsada * 360) / 300))} g`}
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-2.5">
                  <div className="p-2.5 rounded-xl bg-[#FFFFFF] border border-[#D6DEEA]/80 flex flex-col">
                    <span className="text-[9px] uppercase font-bold text-gray-500">Prueba de Hilado</span>
                    <span className="text-sm font-black font-mono text-emerald-700 mt-0.5">
                      {batch.hilar.pruebaHilado.horaRegistro || '--:--'}
                    </span>
                    <span className="text-[9px] text-[#1B4E9B] font-bold mt-0.5">
                      Tardó: {batch.hilar.pruebaHilado.tiempoDesdeDesuerado || '--'}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-[#FFFFFF] border border-amber-200 flex flex-col">
                    <span className="text-[9px] uppercase font-bold text-amber-900">
                      {isPera ? 'Sal Ambas Salmueras' : 'Adición de Sal'}
                    </span>
                    <span className="text-sm font-black font-mono text-amber-900 mt-0.5">
                      {isPera ? `${totalSalPeraG.toLocaleString('es-CO')} g` : `${batch.hilar.sal?.cantidadGramos || 0} g`}
                    </span>
                    <span className="text-[9px] text-gray-500 mt-0.5">
                      {isPera
                        ? `Caliente: ${salCalientePeraG}g · Fría: ${salFriaPeraG}g`
                        : `Lote Sal: ${batch.hilar.sal?.loteSal || batch.loteSal || 'Sin registrar'}`}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-[#FFFFFF] border border-[#D6DEEA]/80 flex flex-col">
                    <span className="text-[9px] uppercase font-bold text-gray-500">Proceso de Hilado</span>
                    <span className="text-sm font-black font-mono text-[#1B4E9B] mt-0.5">
                      {batch.hilar.hiladoEnPaila?.duracion || batch.hilar.extruirYAirear.duracion || '--'}
                    </span>
                    <span className="text-[9px] text-gray-500 mt-0.5">
                      {batch.hilar.hiladoEnPaila?.horaInicio || '--:--'} a {batch.hilar.hiladoEnPaila?.horaFin || '--:--'}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-[#FFFFFF] border border-[#D6DEEA]/80 flex flex-col">
                    <span className="text-[9px] uppercase font-bold text-gray-500">Tiempo Total Proceso</span>
                    <span className="text-sm font-black font-mono text-gray-900 mt-0.5">
                      {batch.hilar.procesoFinalizado?.tiempoTotalProceso || batch.processTimer.formattedTime || '--:--:--'}
                    </span>
                    <span className="text-[9px] text-emerald-600 font-semibold mt-0.5">✓ Consolidado</span>
                  </div>
                </div>
              </div>

              {/* FASE 5: RENDIMIENTO Y MOLDEO */}
              <div className="p-3.5 rounded-2xl bg-white border border-[#D6DEEA] shadow-2xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2.5 border-b border-[#D6DEEA]/70 gap-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-md bg-blue-100 text-[#1B4E9B] text-[10px] font-black uppercase tracking-wider border border-blue-200">
                      Fase 05
                    </span>
                    <h3 className="font-bold text-sm text-gray-900">
                      Rendimiento y Moldeo (Pesado Total del Hilado y Moldes en Gramos/Kilos)
                    </h3>
                  </div>
                  <div className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 self-start sm:self-auto">
                    Pesado Hilado: {pesadoHiladoGramos.toLocaleString('es-CO')} g ({pesadoHiladoKg.toFixed(2)} kg) · Rendimiento: {rendimientoPorcentaje}%
                  </div>
                </div>

                {is7Cueros ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 mt-2.5">
                    <div className="p-2.5 rounded-xl bg-[#FFFFFF] border-2 border-teal-300 flex flex-col justify-between">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] uppercase font-bold text-teal-900">Queso 7 Cueros (350 g)</span>
                        <span className="text-[9px] font-mono font-bold bg-teal-100 text-teal-900 px-1.5 py-0.5 rounded">0.35 kg/u</span>
                      </div>
                      <span className="text-base font-black font-mono text-teal-950 mt-1">{m7Cueros} unidades</span>
                      <span className="text-[10px] text-gray-500 mt-0.5">
                        {(m7Cueros * 350).toLocaleString('es-CO')} g ({(m7Cueros * 0.35).toFixed(2)} kg)
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-[#FFFFFF] border-2 border-amber-300 flex flex-col justify-between">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] uppercase font-bold text-amber-900">Queso Trenza (350 g)</span>
                        <span className="text-[9px] font-mono font-bold bg-amber-100 text-amber-900 px-1.5 py-0.5 rounded">0.35 kg/u</span>
                      </div>
                      <span className="text-base font-black font-mono text-amber-950 mt-1">{mTrenza} unidades</span>
                      <span className="text-[10px] text-gray-500 mt-0.5">
                        {(mTrenza * 350).toLocaleString('es-CO')} g ({(mTrenza * 0.35).toFixed(2)} kg)
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-[#FFFFFF] border border-amber-300 flex flex-col justify-between">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] uppercase font-bold text-amber-900">Quesadillas (60 g)</span>
                        <span className="text-[9px] font-mono font-bold bg-amber-100 text-amber-900 px-1.5 py-0.5 rounded">Derivados</span>
                      </div>
                      <span className="text-xs font-bold text-amber-950 mt-1">
                        Arq: {isArequipe7C ? `${mQuesadillaArq} u` : 'No'} · Boc: {isBocadillo7C ? `${mQuesadillaBoc} u` : 'No'}
                      </span>
                      <span className="text-[10px] text-gray-500 mt-0.5">
                        {isArequipe7C || isBocadillo7C
                          ? `Insumos: ${arequipeGastadoG}g arq / ${bocadillosGastadosU}u boc`
                          : 'Sin quesadillas en lote'}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-teal-50 border-2 border-teal-400 flex flex-col justify-between">
                      <span className="text-[9px] uppercase font-bold text-teal-900">Total Queso 7 Cueros</span>
                      <span className="text-base font-black font-mono text-teal-950 mt-1">
                        {pesoFinalKg.toFixed(2)} kg
                      </span>
                      <span className="text-[10px] text-teal-700 font-semibold mt-0.5">
                        {Math.round(pesoFinalKg * 1000).toLocaleString('es-CO')} g ({totalMoldes} moldes físicos)
                      </span>
                    </div>
                  </div>
                ) : isPera ? (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mt-2.5">
                    <div className="p-2.5 rounded-xl bg-[#FFFFFF] border-2 border-amber-300 flex flex-col justify-between">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] uppercase font-bold text-amber-900">Queso Pera Grande (350 g)</span>
                        <span className="text-[9px] font-mono font-bold bg-amber-100 text-amber-900 px-1.5 py-0.5 rounded">0.35 kg/u</span>
                      </div>
                      <span className="text-base font-black font-mono text-amber-900 mt-1">{m350} unidades</span>
                      <span className="text-[10px] text-gray-500 mt-0.5">
                        {(m350 * 350).toLocaleString('es-CO')} g ({(m350 * 0.35).toFixed(2)} kg)
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-[#FFFFFF] border-2 border-blue-300 flex flex-col justify-between">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] uppercase font-bold text-blue-900">Queso Pera Pequeño (60 g)</span>
                        <span className="text-[9px] font-mono font-bold bg-blue-100 text-blue-900 px-1.5 py-0.5 rounded">0.06 kg/u</span>
                      </div>
                      <span className="text-base font-black font-mono text-blue-900 mt-1">{m60} unidades</span>
                      <span className="text-[10px] text-gray-500 mt-0.5">
                        {(m60 * 60).toLocaleString('es-CO')} g ({(m60 * 0.06).toFixed(2)} kg)
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-emerald-50 border-2 border-emerald-300 flex flex-col justify-between">
                      <span className="text-[9px] uppercase font-bold text-emerald-800">Total Queso Pera Moldeado</span>
                      <span className="text-base font-black font-mono text-emerald-700 mt-1">
                        {pesoFinalKg.toFixed(2)} kg
                      </span>
                      <span className="text-[10px] text-emerald-600 font-semibold mt-0.5">
                        {Math.round(pesoFinalKg * 1000).toLocaleString('es-CO')} g ({totalMoldes} moldes en total)
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 mt-2.5">
                    <div className="p-2 rounded-xl bg-[#FFFFFF] border border-[#D6DEEA]/80 flex flex-col">
                      <span className="text-[9px] uppercase font-bold text-gray-500">Moldes 400 g</span>
                      <span className="text-sm font-black font-mono text-[#1B4E9B] mt-0.5">{m400} unid</span>
                      <span className="text-[9px] text-gray-500 mt-0.5">
                        {(m400 * 400).toLocaleString('es-CO')} g ({(m400 * 0.4).toFixed(2)} kg)
                      </span>
                    </div>

                    <div className="p-2 rounded-xl bg-[#FFFFFF] border border-[#D6DEEA]/80 flex flex-col">
                      <span className="text-[9px] uppercase font-bold text-gray-500">Moldes 1600 g</span>
                      <span className="text-sm font-black font-mono text-purple-900 mt-0.5">{m1600} unid</span>
                      <span className="text-[9px] text-gray-500 mt-0.5">
                        {(m1600 * 1600).toLocaleString('es-CO')} g ({(m1600 * 1.6).toFixed(2)} kg)
                      </span>
                    </div>

                    <div className="p-2 rounded-xl bg-[#FFFFFF] border border-[#D6DEEA]/80 flex flex-col">
                      <span className="text-[9px] uppercase font-bold text-gray-500">Moldes 200 g</span>
                      <span className="text-sm font-black font-mono text-blue-900 mt-0.5">{m200} unid</span>
                      <span className="text-[9px] text-gray-500 mt-0.5">
                        {(m200 * 200).toLocaleString('es-CO')} g ({(m200 * 0.2).toFixed(2)} kg)
                      </span>
                    </div>

                    <div className="p-2 rounded-xl bg-[#FFFFFF] border border-[#D6DEEA]/80 flex flex-col">
                      <span className="text-[9px] uppercase font-bold text-gray-500">Moldes 100 g</span>
                      <span className="text-sm font-black font-mono text-emerald-900 mt-0.5">{m100} unid</span>
                      <span className="text-[9px] text-gray-500 mt-0.5">
                        {(m100 * 100).toLocaleString('es-CO')} g ({(m100 * 0.1).toFixed(2)} kg)
                      </span>
                    </div>

                    <div className="p-2 rounded-xl bg-[#FFFFFF] border border-[#D6DEEA]/80 flex flex-col">
                      <span className="text-[9px] uppercase font-bold text-gray-500">Moldes 800 g</span>
                      <span className="text-sm font-black font-mono text-amber-900 mt-0.5">{m800} unid</span>
                      <span className="text-[9px] text-gray-500 mt-0.5">
                        {(m800 * 800).toLocaleString('es-CO')} g ({(m800 * 0.8).toFixed(2)} kg)
                      </span>
                    </div>

                    <div className="p-2 rounded-xl bg-[#FFFFFF] border border-emerald-200 flex flex-col">
                      <span className="text-[9px] uppercase font-bold text-emerald-800">Total Queso</span>
                      <span className="text-sm font-black font-mono text-emerald-700 mt-0.5">
                        {pesoFinalKg.toFixed(2)} kg
                      </span>
                      <span className="text-[9px] text-emerald-600 font-semibold mt-0.5">
                        {Math.round(pesoFinalKg * 1000).toLocaleString('es-CO')} g ({totalMoldes} moldes)
                      </span>
                    </div>
                  </div>
                )}

                {/* DERIVACIONES DE PASTA RESULTANTE REGISTRADAS */}
                {(batch.derivaciones?.mexicano?.habilitado || batch.derivaciones?.finasHierbas?.habilitado) && (
                  <div className="mt-3 p-3 rounded-xl bg-amber-50/70 border border-amber-200">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="material-symbols-outlined text-amber-700 text-[18px]">account_tree</span>
                      <span className="text-xs font-bold text-amber-950 uppercase">
                        Derivaciones de Pasta Resultante Habilitadas
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      {batch.derivaciones?.mexicano?.habilitado && (() => {
                        const m = batch.derivaciones.mexicano;
                        const quesoG = m.moldes100g * 100 + m.moldes200g * 200 + m.moldes350g * 350;
                        const quesoKg = (quesoG / 1000).toFixed(2);
                        const mCount = m.moldes100g + m.moldes200g + m.moldes350g;
                        return (
                          <div className="p-2.5 bg-white rounded-lg border border-amber-300 shadow-2xs">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-amber-900">Queso Mexicano ({m.codigoLote})</span>
                              <span className="font-mono font-bold text-[10px] bg-amber-100 text-amber-900 px-1.5 py-0.5 rounded">
                                {quesoKg} kg queso ({mCount} unidades)
                              </span>
                            </div>
                            <div className="text-[10px] text-gray-600 mt-1 flex flex-col gap-1">
                              <span>Unidades: {m.moldes100g} (100g) · {m.moldes200g} (200g) · {m.moldes350g} (350g)</span>
                              <div className="text-orange-950 font-mono text-[10px] font-bold bg-orange-50 p-1.5 rounded border border-orange-200">
                                Especias por separado: Ají Picante: {mexAjiConsumidoG} g · Pimienta: {mexPimientaConsumidoG} g (Total: {mexTotalEspeciasG} g)
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                      {batch.derivaciones?.finasHierbas?.habilitado && (() => {
                        const fh = batch.derivaciones.finasHierbas;
                        const quesoKg = fhTotalKg.toFixed(2);
                        const fhCount = fhTotalUnidades;
                        return (
                          <div className="p-2.5 bg-white rounded-lg border border-emerald-300 shadow-2xs">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-emerald-900">Queso Finas Hierbas ({fh.codigoLote})</span>
                              <span className="font-mono font-bold text-[10px] bg-emerald-100 text-emerald-900 px-1.5 py-0.5 rounded">
                                {quesoKg} kg queso ({fhCount} unidades)
                              </span>
                            </div>
                            <div className="text-[10px] text-gray-600 mt-1 flex flex-col gap-1">
                              <span>Unidades: {fhCount} unidades producidas</span>
                              <div className="text-emerald-950 font-mono text-[10px] font-bold bg-emerald-50 p-1.5 rounded border border-emerald-200">
                                Especias: {fhEspeciasConsumidasG} g consumidos (la pimienta NO aplica a Finas Hierbas)
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'certificado' && (
            <div className="p-4 rounded-xl border-2 border-dashed border-amber-300 bg-amber-50/40 text-xs flex flex-col gap-3">
              <div className="flex justify-between items-center border-b border-amber-200 pb-2">
                <div>
                  <div className="font-bold text-sm text-gray-900">CERTIFICADO DE LIBERACIÓN DE LOTE</div>
                  <div className="text-amber-900 font-semibold">Identificador Oficial: CERT-{batch.id}-QCS</div>
                </div>
                <div className="px-2.5 py-1 bg-amber-500 text-white font-bold rounded-lg text-[10px]">
                  CONFORME
                </div>
              </div>
              <p className="text-gray-700 leading-relaxed">
                Se certifica que el producto elaborado ({batch.productName}) bajo el lote <strong>{batch.id}</strong> con materia prima trazable de <strong>Leche Base (Lote: {batch.lotesLeche.loteLecheBase || batch.lotesLeche.loteLeche1 || 'Sin registrar'})</strong> y <strong>Leche Fresca (Lote: {batch.lotesLeche.loteLecheFresca || batch.lotesLeche.loteLeche2 || 'Sin registrar'})</strong>, Cuajo (Lote: <strong>{batch.loteCuajo || 'Sin registrar'}</strong>) y Sal (Lote: <strong>{batch.loteSal || 'Sin registrar'}</strong>{isPera ? `, Consumo Total Sal: ${totalSalPeraG.toLocaleString()} g [1,000 g Caliente + 500 g Fría]` : ''}) en la {batch.line} ha completado
                las etapas de {isPera ? 'Pre-Maduración / Acidificación' : 'Acidificación'}, Calentamiento a 35 °C, Cuajado, Corte Finalizado, Calentamiento a 40 °C, Desuerado, Proceso de Hilado en Salmuera Caliente{isPera ? ', Salmuera Fría' : ''} y Moldeo / Derivaciones ({isPera ? `4 productos elaborados: Pera Pequeño (${m60} u), Pera Grande (${m350} u), Mexicano (${mexTotalUnidades} u), Finas Hierbas (${fhTotalUnidades} u)` : `${totalMoldes} moldes en total: ${m400} de 400g, ${m1600} de 1600g, ${m200} de 200g, ${m100} de 100g, ${m800} de 800g`}).
              </p>

              {/* Operarios que intervinieron en el certificado */}
              <div className="p-2.5 bg-white rounded-lg border border-amber-200">
                <span className="text-[10px] font-bold text-gray-500 uppercase block">
                  Operarios que Intervinieron en el Proceso:
                </span>
                <span className="text-gray-900 font-semibold mt-0.5 block">
                  {operariosList.length > 0 ? operariosList.join(' · ') : responsable}
                </span>
              </div>

              {localObservaciones && (
                <div className="p-2.5 bg-white rounded-lg border border-amber-200">
                  <span className="text-[10px] font-bold text-gray-500 uppercase block">Observaciones:</span>
                  <span className="text-gray-800 italic mt-0.5 block">{localObservaciones}</span>
                </div>
              )}
              <div className="flex items-center justify-between text-[11px] text-gray-600 pt-2 border-t border-amber-200">
                <span>Responsable Principal: {responsable}</span>
                <span>Fecha: {new Date().toLocaleDateString()}</span>
              </div>
            </div>
          )}
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
              <span>Aceptar</span>
            </button>
          </div>
        </div>
      </div>
    )}
  </>
  );
};
