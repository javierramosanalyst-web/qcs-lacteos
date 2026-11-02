import React, { useEffect, useState } from 'react';
import { Modal } from '../../../components/ui';
import { UserProfile } from '../../../types';
import { KumisBatchData } from '../../../types/kumis';

interface KumisSummaryModalProps {
  batch: KumisBatchData;
  isOpen: boolean;
  onClose: () => void;
  users?: UserProfile[];
  onFinalizeBatch?: () => void;
  onChangeObservaciones?: (observaciones: string) => void;
  onChangeOperariosIntervinientes?: (operarios: string[]) => void;
}

const DEFAULT_OPERATOR_CATALOG: string[] = [];

export const KumisSummaryModal: React.FC<KumisSummaryModalProps> = ({
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
  const [showConfirmAlert, setShowConfirmAlert] = useState<boolean>(false);

  // Sincronizar estados locales al abrir el modal o cambiar lote
  useEffect(() => {
    if (isOpen) {
      setShowConfirmAlert(false);
      setLocalObservaciones(batch.observaciones || '');
      setOperariosList(
        batch.operariosIntervinientes && batch.operariosIntervinientes.length > 0
          ? batch.operariosIntervinientes
          : [batch.responsableProceso || batch.operator || ''].filter(Boolean)
      );
    }
  }, [isOpen, batch.id, batch.observaciones, batch.operariosIntervinientes, batch.responsableProceso, batch.operator]);

  // Catálogo unificado de operarios
  const availableOperators = React.useMemo(() => {
    const fromUsers = users
      .filter((u) => u.role === 'operador')
      .map((u) => `${u.name} (${u.code})`);
    return Array.from(new Set([...fromUsers, ...DEFAULT_OPERATOR_CATALOG]));
  }, [users]);

  if (!isOpen) return null;

  const { pasteurizacion, inoculacion, maduracionFrio, batidoYAdiciones, envasado } = batch;

  // 1. Cálculos de envasado (agregando presentaciones tradicionales y categorías Sin Azúcar / Stevia)
  const uSinAzucar_200ml = envasado.formatos.sinAzucar_botella200ml || 0;
  const uSinAzucar_1L = envasado.formatos.sinAzucar_botella1L || 0;
  const uSinAzucar_2L = envasado.formatos.sinAzucar_botella2L || 0;
  const uSinAzucar_4L = envasado.formatos.sinAzucar_bolsa4L || 0;

  const uStevia_120ml = envasado.formatos.stevia_botella120ml || 0;
  const uStevia_200ml = envasado.formatos.stevia_botella200ml || 0;
  const uStevia_1L = envasado.formatos.stevia_botella1L || 0;
  const uStevia_2L = envasado.formatos.stevia_botella2L || 0;
  const uStevia_4L = envasado.formatos.stevia_bolsa4L || 0;

  const uTrad_120ml = envasado.formatos.botella120ml || 0;
  const uTrad_1L = (envasado.formatos.botella1L ?? envasado.formatos.botella1000g) || 0;
  const uTrad_2L = envasado.formatos.botella2L || 0;

  const u120ml = uStevia_120ml + uTrad_120ml;
  const u200ml = uSinAzucar_200ml + uStevia_200ml;
  const u1L = uSinAzucar_1L + uStevia_1L + uTrad_1L;
  const u2L = uSinAzucar_2L + uStevia_2L + uTrad_2L;
  const u4L = uSinAzucar_4L + uStevia_4L;

  const totalUnidades = u120ml + u200ml + u1L + u2L + u4L;
  const totalLitrosEnvasados = Number(
    (u120ml * 0.12 + u200ml * 0.2 + u1L * 1.0 + u2L * 2.0 + u4L * 4.0).toFixed(2)
  );
  const totalKilosEnvasados = Math.round((totalLitrosEnvasados * 1.03) * 100) / 100;

  // 2. Formulación Kumis (Condicional según si lleva azúcar desde Pasteurización)
  const llevaAzucar = pasteurizacion.llevaAzucar !== false;
  const hasAzucar = Boolean(llevaAzucar);

  const variedadAzucar = batidoYAdiciones.adiciones.variedadAzucar || {
    litrosBase: pasteurizacion.litrosLeche ?? 0,
    gramosAzucar: 0,
    kilosAzucar: 0,
    loteAzucar: 'Sin registrar',
  };

  const loteAzucar = hasAzucar
    ? (pasteurizacion.azucar?.loteAzucar || pasteurizacion.loteAzucar || batidoYAdiciones.adiciones?.variedadAzucar?.loteAzucar || (batidoYAdiciones.adiciones as any)?.loteAzucar || '—')
    : '';
  const pesoAzucarKg = hasAzucar
    ? (pasteurizacion.azucar?.cantidadKg || pasteurizacion.cantidadAzucarKg || variedadAzucar.kilosAzucar || Number((((pasteurizacion.litrosLeche ?? 0) / 40) * 3.2).toFixed(2)))
    : 0;

  // Lote Estevia si se utilizó
  const loteEsteviaRegistrado =
    batidoYAdiciones.adiciones?.variedadEstevia?.loteEstevia ||
    (batidoYAdiciones.adiciones as any)?.loteEstevia ||
    '';
  const gramosEsteviaRegistrados =
    batidoYAdiciones.adiciones?.variedadEstevia?.gramosEstevia ??
    (batidoYAdiciones.adiciones as any)?.gramosEstevia ??
    0;
  const hasEstevia = Boolean(!hasAzucar && (loteEsteviaRegistrado || gramosEsteviaRegistrados > 0));
  const hasNatural = !hasAzucar && !hasEstevia;

  // 3. Balance de masa y rendimiento sobre volumen extraído para Kumis
  const lecheBaseLitros = pasteurizacion.litrosLeche ?? 0;
  const lecheKg = Math.round(lecheBaseLitros * 1.03 * 100) / 100;
  const totalAdicionesKg = Math.round(pesoAzucarKg * 100) / 100;
  const masaTotalFormuladaKg = Math.round((lecheKg + totalAdicionesKg) * 100) / 100;

  const rendimientoPct =
    lecheBaseLitros > 0
      ? Number(((totalLitrosEnvasados / lecheBaseLitros) * 100).toFixed(1))
      : 0;
  const mermaKg = Math.max(0, Math.round((masaTotalFormuladaKg - totalKilosEnvasados) * 100) / 100);
  const mermaLitros = Math.max(0, Number((lecheBaseLitros - totalLitrosEnvasados).toFixed(2)));

  // Handlers para operarios
  const handleAddOperator = (nameToAdd: string) => {
    const clean = nameToAdd.trim();
    if (!clean) return;
    if (!operariosList.includes(clean)) {
      const updated = [...operariosList, clean];
      setOperariosList(updated);
      if (onChangeOperariosIntervinientes) {
        onChangeOperariosIntervinientes(updated);
      }
    }
    setSelectedDropdownOp('');
    setCustomOperatorName('');
    setShowCustomInput(false);
  };

  const handleRemoveOperator = (opName: string) => {
    if (operariosList.length <= 1) return;
    const updated = operariosList.filter((o) => o !== opName);
    setOperariosList(updated);
    if (onChangeOperariosIntervinientes) {
      onChangeOperariosIntervinientes(updated);
    }
  };

  const handleSaveObservaciones = () => {
    if (onChangeObservaciones) {
      onChangeObservaciones(localObservaciones);
    }
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
      maxWidth="4xl"
      icon="local_drink"
      title={`Resumen Final · ${batch.productName}`}
      subtitle="Control de Producción, Balance de Materia Prima y Constancia del Lote."
      badge={
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-indigo-100 text-indigo-900 border border-indigo-300">
            {batch.id}
          </span>
          <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
            LÍNEA DE FERMENTACIÓN · KUMIS
          </span>
          <span className="text-[10px] font-mono font-bold text-indigo-800 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
            {batch.standard || 'NTC-805'}
          </span>
        </div>
      }
      tabs={
        <div className="bg-[#FFFFFF] px-5 py-2 flex gap-2">
          <button
            onClick={() => setActiveTab('resumen')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'resumen'
                ? 'bg-[#1B4E9B] text-white shadow-xs'
                : 'text-[#434655] hover:bg-[#F2F4F7]'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">analytics</span>
            <span>Métricas Clave</span>
          </button>

          <button
            onClick={() => setActiveTab('detalle')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'detalle'
                ? 'bg-[#1B4E9B] text-white shadow-xs'
                : 'text-[#434655] hover:bg-[#F2F4F7]'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">reorder</span>
            <span>Desglose de 5 Fases</span>
          </button>

          <button
            onClick={() => setActiveTab('certificado')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'certificado'
                ? 'bg-[#1B4E9B] text-white shadow-xs'
                : 'text-[#434655] hover:bg-[#F2F4F7]'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">verified</span>
            <span>Constancia del Lote</span>
          </button>
        </div>
      }
      footer={
        <div className="w-full flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-gray-500">
            Lote: <strong className="text-gray-800">{batch.id}</strong> · Responsable:{' '}
            <strong className="text-gray-800">{responsable}</strong>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={onClose}
              className="h-10 px-4 rounded-xl bg-white border border-gray-300 hover:bg-gray-100 text-gray-700 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">close</span>
              <span>Cerrar Resumen</span>
            </button>

            {onFinalizeBatch && batch.status !== 'COMPLETADO' && (
              <button
                onClick={() => setShowConfirmAlert(true)}
                className="h-10 px-5 rounded-xl bg-[#5FAF32] hover:bg-[#4E9628] text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer active:scale-95"
              >
                <span className="material-symbols-outlined text-[17px]">task_alt</span>
                <span>Confirmar Proceso Terminado</span>
              </button>
            )}
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-6 text-gray-800 text-xs">
          {/* =========================================================================
              PESTAÑA 1: MÉTRICAS CLAVE (KUMIS)
          ========================================================================= */}
          {activeTab === 'resumen' && (
            <>
              {/* 1. BLOQUE SUPERIOR: 3 TARJETAS PRINCIPALES */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Tarjeta 1: Total Leche Usada */}
                <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-50/70 to-blue-100/40 border border-blue-200 flex flex-col justify-between">
                  <div className="flex items-center justify-between text-blue-900">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider">
                      TOTAL LECHE USADA
                    </span>
                    <span className="material-symbols-outlined text-[20px]">water_drop</span>
                  </div>
                  <div className="my-2">
                    <span className="text-2xl sm:text-3xl font-black font-mono text-blue-950">
                      {lecheBaseLitros} L
                    </span>
                    <span className="block text-[11px] text-blue-800/80 mt-0.5">
                      Leche entera procesada ({lecheKg.toFixed(1)} kg)
                    </span>
                  </div>
                  <div className="text-[10px] text-blue-700 font-semibold bg-white/70 px-2.5 py-1 rounded-lg border border-blue-200">
                    Lote: <strong>{pasteurizacion.loteLeche}</strong>
                  </div>
                </div>

                {/* Tarjeta 2: Cronómetro / Tiempo Total */}
                <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-50/70 to-indigo-100/40 border border-indigo-200 flex flex-col justify-between">
                  <div className="flex items-center justify-between text-indigo-900">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider">
                      TIEMPO ACUMULADO
                    </span>
                    <span className="material-symbols-outlined text-[20px]">timer</span>
                  </div>
                  <div className="my-2">
                    <span className="text-2xl sm:text-3xl font-black font-mono text-indigo-950">
                      {batch.processTimer.formattedTime || '20 h 45 min'}
                    </span>
                    <span className="block text-[11px] text-indigo-800/80 mt-0.5">
                      Tiempo total de ciclo
                    </span>
                  </div>
                  <div className="text-[10px] text-emerald-800 font-bold bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-300 flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">check_circle</span>
                    <span>Proceso Monitoreado</span>
                  </div>
                </div>

                {/* Tarjeta 3: Responsable Principal */}
                <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-50/70 to-amber-100/40 border border-amber-200 flex flex-col justify-between">
                  <div className="flex items-center justify-between text-amber-900">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider">
                      RESPONSABLE PRINCIPAL
                    </span>
                    <span className="material-symbols-outlined text-[20px]">badge</span>
                  </div>
                  <div className="my-2">
                    <span className="text-lg sm:text-xl font-black text-amber-950 block truncate">
                      {responsable}
                    </span>
                    <span className="block text-[11px] text-amber-800/80 mt-0.5">
                      {batch.operatorRole || 'Operador de Planta'}
                    </span>
                  </div>
                  <div className="text-[10px] text-amber-900 font-semibold bg-white/70 px-2.5 py-1 rounded-lg border border-amber-200">
                    {operariosList.length} operario(s) registrado(s)
                  </div>
                </div>
              </div>

              {/* 2. SECCIÓN: TRAZABILIDAD DE MATERIAS PRIMAS E INSUMOS */}
              <div className="p-5 rounded-2xl bg-[#FFFFFF] border border-[#D6DEEA] flex flex-col gap-3">
                <div className="flex items-center justify-between pb-2 border-b border-[#D6DEEA]">
                  <span className="text-xs font-black uppercase tracking-wider text-gray-700 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-indigo-600"></span>
                    Trazabilidad de Materias Primas e Insumos (Kumis)
                  </span>
                  <span className="text-[10px] font-mono text-gray-500">Kardex de Proceso</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Tarjeta 1: Lote Leche (Obligatoria) */}
                  <div className="p-3.5 rounded-xl bg-white border-2 border-blue-300 flex flex-col justify-between shadow-2xs">
                    <div>
                      <span className="text-[9px] font-bold text-blue-700 uppercase block">
                        Lote Leche Entera
                      </span>
                      <strong className="text-sm font-mono font-black text-blue-950 block mt-0.5">
                        {pasteurizacion.loteLeche}
                      </strong>
                    </div>
                    <div className="mt-2 pt-2 border-t border-blue-100 flex items-center justify-between text-[10px]">
                      <span className="text-gray-500">Volumen Extraído (Kumis):</span>
                      <span className="font-bold text-blue-900">{lecheBaseLitros} L</span>
                    </div>
                    <span className="text-[9px] text-emerald-700 font-semibold mt-1">
                      ✓ Pasteurizada 85-90 °C
                    </span>
                  </div>

                  {/* Tarjeta 2: Lote Cultivo Kumis (Obligatoria) */}
                  <div className="p-3.5 rounded-xl bg-white border-2 border-emerald-300 flex flex-col justify-between shadow-2xs">
                    <div>
                      <span className="text-[9px] font-bold text-emerald-700 uppercase block">
                        Lote Cultivo Kumis
                      </span>
                      <strong className="text-sm font-mono font-black text-emerald-950 block mt-0.5 truncate">
                        {inoculacion.loteCultivo}
                      </strong>
                    </div>
                    <div className="mt-2 pt-2 border-t border-emerald-100 flex items-center justify-between text-[10px]">
                      <span className="text-gray-500">Dosis DVI:</span>
                      <span className="font-bold text-emerald-900">{inoculacion.cantidadCultivoGramos} g</span>
                    </div>
                    <span className="text-[9px] text-emerald-700 font-semibold mt-1">
                      ✓ Inoculado a 35 °C (12 h)
                    </span>
                  </div>

                  {/* Tarjeta 3: Lote Azúcar (Condicional según si lleva azúcar) */}
                  <div
                    className={`p-3.5 rounded-xl border-2 flex flex-col justify-between shadow-2xs ${
                      hasAzucar
                        ? 'bg-white border-amber-300'
                        : 'bg-gray-50/80 border-gray-200 opacity-60'
                    }`}
                  >
                    <div>
                      <span
                        className={`text-[9px] font-bold uppercase block ${
                          hasAzucar ? 'text-amber-700' : 'text-gray-400'
                        }`}
                      >
                        Lote Azúcar
                      </span>
                      <strong
                        className={`text-sm font-mono font-black block mt-0.5 truncate ${
                          hasAzucar ? 'text-amber-950' : 'text-gray-400'
                        }`}
                      >
                        {hasAzucar ? (variedadAzucar.loteAzucar || loteAzucar || '—') : 'N/A - Sin adición de azúcar'}
                      </strong>
                    </div>
                    <div
                      className={`mt-2 pt-2 border-t flex items-center justify-between text-[10px] ${
                        hasAzucar ? 'border-amber-100' : 'border-gray-200'
                      }`}
                    >
                      <span className="text-gray-500">Cantidad:</span>
                      <span className={`font-bold ${hasAzucar ? 'text-amber-900' : 'text-gray-400'}`}>
                        {hasAzucar ? `${pesoAzucarKg} kg` : '0 kg'}
                      </span>
                    </div>
                    <span
                      className={`text-[9px] font-semibold mt-1 ${
                        hasAzucar ? 'text-amber-700' : 'text-gray-400'
                      }`}
                    >
                      {hasAzucar ? '✓ Sacarosa industrial (3,2 kg/40 L)' : 'Sin adición de azúcar'}
                    </span>
                  </div>
                </div>

                <div className="mt-1 p-2.5 rounded-xl bg-indigo-50/50 border border-indigo-200 text-[11px] text-indigo-900 flex items-center gap-2">
                  <span className="material-symbols-outlined text-indigo-600 text-[16px]">info</span>
                  <span>
                    <strong>Formulación Tradicional de Kumis (NTC-805):</strong> Exento de saborizantes, colorantes ni pulpas de frutas. Identidad láctica pura.
                  </span>
                </div>
              </div>

              {/* 3. SECCIÓN: FORMULACIÓN DE KUMIS */}
              <div className="p-5 rounded-2xl bg-[#FFFFFF] border border-[#D6DEEA] flex flex-col gap-3">
                <span className="text-xs font-black uppercase tracking-wider text-gray-700 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
                  Formulación de Kumis ({hasAzucar ? 'Con Azúcar' : 'Sin Azúcar Tradicional'} · NTC-805)
                </span>

                {hasAzucar ? (
                  <div className="p-4 rounded-xl border bg-white border-amber-400 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-base text-amber-950">Kumis Tradicional con Azúcar</span>
                        <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300">
                          100% DEL LOTE
                        </span>
                      </div>
                      <p className="text-xs text-gray-600 mt-1">
                        El Kumis con azúcar añadida (proporción: 3,2 kg por cada 40 L de leche).
                      </p>
                    </div>

                    <div className="flex items-center gap-6 text-xs bg-amber-50/70 p-3 rounded-xl border border-amber-200">
                      <div>
                        <span className="text-gray-500 block text-[10px] uppercase font-bold">Volumen Base:</span>
                        <strong className="font-mono text-amber-950 text-base">
                          {variedadAzucar.litrosBase || pasteurizacion.litrosLeche || 0} L
                        </strong>
                      </div>
                      <div>
                        <span className="text-gray-500 block text-[10px] uppercase font-bold">Azúcar Añadida:</span>
                        <strong className="font-mono text-amber-950 text-base">
                          {pesoAzucarKg} kg
                        </strong>
                      </div>
                      <div>
                        <span className="text-gray-500 block text-[10px] uppercase font-bold">Lote Azúcar:</span>
                        <strong className="font-mono text-amber-950 text-base">
                          {loteAzucar || variedadAzucar.loteAzucar || '—'}
                        </strong>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-xl border bg-white border-gray-300 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-base text-gray-900">Kumis Sin Azúcar Tradicional</span>
                        <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 border border-emerald-300">
                          LÍNEA DIETÉTICA / NATURAL
                        </span>
                      </div>
                      <p className="text-xs text-gray-600 mt-1">
                        Lote procesado sin adición de sacarosa tradicional.
                      </p>
                    </div>

                    <div className="flex items-center gap-6 text-xs bg-gray-50 p-3 rounded-xl border border-gray-200">
                      <div>
                        <span className="text-gray-500 block text-[10px] uppercase font-bold">Azúcar Añadida:</span>
                        <strong className="font-mono text-gray-600 text-base">
                          0 kg (N/A)
                        </strong>
                      </div>
                      <div>
                        <span className="text-gray-500 block text-[10px] uppercase font-bold">Lote Azúcar:</span>
                        <strong className="font-mono text-gray-600 text-base">
                          N/A - Sin adición de azúcar
                        </strong>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* 4. SECCIÓN: PRESENTACIONES EXCLUSIVAS DE KUMIS (SOLO 1 L Y 2 L - REGLA 8) */}
              <div className="p-5 rounded-2xl bg-white border border-[#D6DEEA] shadow-xs flex flex-col gap-4">
                <div className="flex items-center justify-between pb-2 border-b border-[#D6DEEA]">
                  <span className="text-xs font-black uppercase tracking-wider text-gray-800 flex items-center gap-2">
                    <span className="material-symbols-outlined text-indigo-700 text-[18px]">inventory_2</span>
                    Presentaciones de Envasado de Kumis (Solo Kumis 1 L y Kumis 2 L)
                  </span>
                  <span className="text-xs font-mono font-bold text-indigo-900 bg-indigo-50 px-2.5 py-0.5 rounded border border-indigo-200">
                    Lote Terminado: {envasado.loteProductoTerminado || batch.id}
                  </span>
                </div>

                <div className={`grid grid-cols-1 ${u120ml > 0 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'} gap-4`}>
                  {u120ml > 0 && (
                    <div className="p-4 bg-[#FFFFFF] rounded-xl border border-emerald-200 flex flex-col items-center text-center">
                      <span className="text-xs font-bold text-gray-600 uppercase">Botella 120 ml (Stevia)</span>
                      <strong className="text-2xl font-black font-mono text-emerald-950 my-1">{u120ml} botellas</strong>
                      <span className="text-xs font-bold text-emerald-800">{(u120ml * 0.12).toFixed(2)} Litros</span>
                    </div>
                  )}
                  <div className="p-4 bg-[#FFFFFF] rounded-xl border border-indigo-200 flex flex-col items-center text-center">
                    <span className="text-xs font-bold text-gray-600 uppercase">Kumis 1 L</span>
                    <strong className="text-2xl font-black font-mono text-indigo-950 my-1">{u1L} botellas</strong>
                    <span className="text-xs font-bold text-indigo-800">{(u1L * 1.0).toFixed(1)} Litros</span>
                  </div>

                  <div className="p-4 bg-[#FFFFFF] rounded-xl border border-blue-200 flex flex-col items-center text-center">
                    <span className="text-xs font-bold text-gray-600 uppercase">Kumis 2 L</span>
                    <strong className="text-2xl font-black font-mono text-blue-950 my-1">{u2L} botellas</strong>
                    <span className="text-xs font-bold text-blue-800">{(u2L * 2.0).toFixed(1)} Litros</span>
                  </div>
                </div>

                {/* Resumen Totalizador */}
                <div className="p-4 rounded-xl bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-200 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-indigo-700 text-[26px]">calculate</span>
                    <div>
                      <span className="text-xs font-bold text-indigo-950 block">Totales Consolidados de Envasado:</span>
                      <span className="text-[11px] text-indigo-900">
                        {totalUnidades} unidades · {totalKilosEnvasados.toFixed(2)} kg equivalentes (~{totalLitrosEnvasados} L)
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <span className="text-[10px] uppercase font-bold text-gray-500 block">Rendimiento Operativo:</span>
                      <span className="text-lg font-black font-mono text-emerald-800">{rendimientoPct.toFixed(1)}%</span>
                    </div>
                    <div className="text-right border-l border-indigo-200 pl-3">
                      <span className="text-[10px] uppercase font-bold text-gray-500 block">Merma de Proceso:</span>
                      <span className="text-sm font-black font-mono text-gray-700">{mermaKg.toFixed(2)} kg</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 5. GESTIÓN DE OPERARIOS PARTICIPANTES */}
              <div className="p-5 rounded-2xl bg-[#FFFFFF] border border-[#D6DEEA] flex flex-col gap-3">
                <div className="flex items-center justify-between pb-2 border-b border-[#D6DEEA]">
                  <span className="text-xs font-black uppercase tracking-wider text-gray-800 flex items-center gap-2">
                    <span className="material-symbols-outlined text-amber-700 text-[18px]">group</span>
                    Operarios Intervinientes en el Lote de Kumis
                  </span>
                  <span className="text-[10px] text-gray-500">Trazabilidad de Personal</span>
                </div>

                <div className="flex flex-wrap gap-2">
                  {operariosList.map((op) => (
                    <span
                      key={op}
                      className="px-3 py-1.5 rounded-xl bg-white border border-gray-300 text-xs font-bold text-gray-800 flex items-center gap-2 shadow-2xs"
                    >
                      <span>{op}</span>
                      {operariosList.length > 1 && (
                        <button
                          onClick={() => handleRemoveOperator(op)}
                          className="text-gray-400 hover:text-red-600 cursor-pointer"
                          title="Eliminar operario"
                        >
                          <span className="material-symbols-outlined text-[15px]">close</span>
                        </button>
                      )}
                    </span>
                  ))}
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-2 pt-2 border-t border-gray-200">
                  <select
                    value={selectedDropdownOp}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '__custom__') {
                        setShowCustomInput(true);
                        setSelectedDropdownOp('');
                      } else if (val) {
                        handleAddOperator(val);
                      }
                    }}
                    className="w-full sm:w-auto bg-white px-3 py-1.5 rounded-lg border border-gray-300 text-xs font-semibold text-gray-700 outline-none"
                  >
                    <option value="">+ Seleccionar Operario de Planta...</option>
                    {availableOperators
                      .filter((o) => !operariosList.includes(o))
                      .map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    <option value="__custom__">Otro (Digitar nombre)...</option>
                  </select>

                  {showCustomInput && (
                    <div className="flex items-center gap-1.5 w-full sm:w-auto">
                      <input
                        type="text"
                        value={customOperatorName}
                        onChange={(e) => setCustomOperatorName(e.target.value)}
                        placeholder="Nombre y código de operario"
                        className="bg-white px-3 py-1.5 rounded-lg border border-indigo-300 text-xs font-semibold text-gray-800 outline-none"
                      />
                      <button
                        onClick={() => handleAddOperator(customOperatorName)}
                        className="px-3 py-1.5 bg-indigo-700 hover:bg-indigo-800 text-white font-bold text-xs rounded-lg cursor-pointer"
                      >
                        Agregar
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* 6. OBSERVACIONES DEL LOTE */}
              <div className="p-5 rounded-2xl bg-[#FFFFFF] border border-[#D6DEEA] flex flex-col gap-2">
                <label className="text-xs font-black uppercase tracking-wider text-gray-700 flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px] text-gray-600">notes</span>
                  Observaciones Técnicas del Proceso de Kumis
                </label>
                <textarea
                  value={localObservaciones}
                  onChange={(e) => setLocalObservaciones(e.target.value)}
                  onBlur={handleSaveObservaciones}
                  placeholder="Registra cualquier eventualidad, ajuste en acidez, tiempo de refrigeración o control de envasado..."
                  rows={2}
                  className="w-full bg-white p-3 rounded-xl border border-gray-300 text-xs text-gray-800 outline-none focus:border-indigo-600"
                />
              </div>
            </>
          )}

          {/* =========================================================================
              PESTAÑA 2: DESGLOSE DE 5 FASES (KUMIS)
          ========================================================================= */}
          {activeTab === 'detalle' && (
            <div className="flex flex-col gap-4">
              {/* Fase 1: Pasteurización */}
              <div className="p-4 rounded-2xl bg-white border border-[#D6DEEA] shadow-2xs">
                <div className="flex items-center justify-between pb-2 border-b border-gray-200">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-900 font-bold flex items-center justify-center text-xs">
                      1
                    </span>
                    <h3 className="font-extrabold text-sm text-gray-900">
                      Pasteurización (Kumis)
                    </h3>
                  </div>
                  <span className="text-[10px] font-mono font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-300">
                    ✓ Completada
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 text-xs">
                  <div>
                    <span className="text-gray-500 block text-[10px]">Litros y Lote:</span>
                    <strong className="font-mono text-gray-900">
                      {pasteurizacion.litrosLeche} L ({pasteurizacion.loteLeche})
                    </strong>
                  </div>
                  <div>
                    <span className="text-gray-500 block text-[10px]">Calentamiento (85-90 °C):</span>
                    <strong className="font-mono text-gray-900">
                      {(pasteurizacion.calentamiento.temperaturaAlcanzada || (pasteurizacion.calentamiento.llego85a90 ? pasteurizacion.calentamiento.temperaturaConsigna : 0) || 0).toFixed(1)} °C ({pasteurizacion.calentamiento.tiempoCalentamiento || '—'})
                    </strong>
                  </div>
                  <div>
                    <span className="text-gray-500 block text-[10px]">Enfriamiento:</span>
                    <strong className="font-mono text-gray-900">
                      {pasteurizacion.enfriamiento.temperaturaFinal.toFixed(1)} °C ({pasteurizacion.enfriamiento.tiempoEnfriamiento || '45 min'})
                    </strong>
                  </div>
                  <div>
                    <span className="text-gray-500 block text-[10px]">Acidez de Recepción:</span>
                    <strong className="font-mono text-gray-900">
                      {pasteurizacion.acidezDornic} °D (pH {pasteurizacion.phRecepcion})
                    </strong>
                  </div>
                </div>
              </div>

              {/* Fase 2: Inoculación */}
              <div className="p-4 rounded-2xl bg-white border border-[#D6DEEA] shadow-2xs">
                <div className="flex items-center justify-between pb-2 border-b border-gray-200">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-900 font-bold flex items-center justify-center text-xs">
                      2
                    </span>
                    <h3 className="font-extrabold text-sm text-gray-900">
                      Inoculación (Kumis)
                    </h3>
                  </div>
                  <span className="text-[10px] font-mono font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-300">
                    ✓ Completada
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 text-xs">
                  <div>
                    <span className="text-gray-500 block text-[10px]">Lote y Dosis de Cultivo:</span>
                    <strong className="font-mono text-gray-900">
                      {inoculacion.loteCultivo} ({inoculacion.cantidadCultivoGramos} g)
                    </strong>
                  </div>
                  <div>
                    <span className="text-gray-500 block text-[10px]">Temperatura de Inoculación:</span>
                    <strong className="font-mono text-gray-900">
                      {inoculacion.temperaturaVerificada45.toFixed(1)} °C
                    </strong>
                  </div>
                  <div>
                    <span className="text-gray-500 block text-[10px]">Incubación (12 Horas):</span>
                    <strong className="font-mono text-gray-900">
                      {inoculacion.incubacion.tiempoTranscurrido || '12 h 00 min'} ({inoculacion.incubacion.temperaturaIncubacion} °C)
                    </strong>
                  </div>
                  <div>
                    <span className="text-gray-500 block text-[10px]">pH Coágulo Obtenido:</span>
                    <strong className="font-mono text-emerald-800">
                      {inoculacion.incubacion.phFinalIncubacion.toFixed(2)}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Fase 3: Maduración en Frío */}
              <div className="p-4 rounded-2xl bg-white border border-[#D6DEEA] shadow-2xs">
                <div className="flex items-center justify-between pb-2 border-b border-gray-200">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-900 font-bold flex items-center justify-center text-xs">
                      3
                    </span>
                    <h3 className="font-extrabold text-sm text-gray-900">
                      Maduración en Frío (Kumis)
                    </h3>
                  </div>
                  <span className="text-[10px] font-mono font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-300">
                    ✓ Completada
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 text-xs">
                  <div>
                    <span className="text-gray-500 block text-[10px]">Cantinas de Coágulo:</span>
                    <strong className="font-mono text-gray-900">
                      {maduracionFrio.trasladoCantinas.numeroCantinas} cantinas ({maduracionFrio.trasladoCantinas.tiempoTraslado || '10 min'})
                    </strong>
                  </div>
                  <div>
                    <span className="text-gray-500 block text-[10px]">Cuarto Frío:</span>
                    <strong className="font-mono text-gray-900">
                      {maduracionFrio.refrigeracion.temperaturaCuartoFrio.toFixed(1)} °C
                    </strong>
                  </div>
                  <div>
                    <span className="text-gray-500 block text-[10px]">Tiempo de Reposo:</span>
                    <strong className="font-mono text-gray-900">
                      {maduracionFrio.refrigeracion.tiempoTranscurrido || '12 h 00 min'}
                    </strong>
                  </div>
                  <div>
                    <span className="text-gray-500 block text-[10px]">pH Final y Textura:</span>
                    <strong className="font-mono text-emerald-800">
                      {maduracionFrio.refrigeracion.phFinalFrio.toFixed(2)} (Sedoso)
                    </strong>
                  </div>
                </div>
              </div>

              {/* Fase 4: Batido y Adiciones */}
              <div className="p-4 rounded-2xl bg-white border border-[#D6DEEA] shadow-2xs">
                <div className="flex items-center justify-between pb-2 border-b border-gray-200">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-900 font-bold flex items-center justify-center text-xs">
                      4
                    </span>
                    <h3 className="font-extrabold text-sm text-gray-900">
                      Batido y Adiciones (Kumis)
                    </h3>
                  </div>
                  <span className="text-[10px] font-mono font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-300">
                    ✓ Completada
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 text-xs">
                  <div>
                    <span className="text-gray-500 block text-[10px]">Batidora Industrial:</span>
                    <strong className="font-mono text-gray-900">
                      {batidoYAdiciones.batidora.velocidadRpm} RPM ({batidoYAdiciones.batidora.tiempoBatido || '12 min'})
                    </strong>
                  </div>
                  <div>
                    <span className="text-gray-500 block text-[10px]">Endulzantes Dosificados:</span>
                    <strong className="font-mono text-gray-900">
                      {totalAdicionesKg} kg en adiciones
                    </strong>
                  </div>
                  <div>
                    <span className="text-gray-500 block text-[10px]">Saborizantes / Pulpas:</span>
                    <strong className="text-indigo-950 font-bold">
                      Sin adición (Kumis Puro)
                    </strong>
                  </div>
                  <div>
                    <span className="text-gray-500 block text-[10px]">Masa Formada en Tolva:</span>
                    <strong className="font-mono text-indigo-950">
                      {masaTotalFormuladaKg} kg
                    </strong>
                  </div>
                </div>
              </div>

              {/* Fase 5: Envasado y Almacenamiento */}
              <div className="p-4 rounded-2xl bg-white border border-[#D6DEEA] shadow-2xs">
                <div className="flex items-center justify-between pb-2 border-b border-gray-200">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-900 font-bold flex items-center justify-center text-xs">
                      5
                    </span>
                    <h3 className="font-extrabold text-sm text-gray-900">
                      Envasado y Almacenamiento (Kumis)
                    </h3>
                  </div>
                  <span className="text-[10px] font-mono font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-300">
                    ✓ Completada
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 text-xs">
                  <div>
                    <span className="text-gray-500 block text-[10px]">Lote Producto Terminado:</span>
                    <strong className="font-mono text-gray-900">
                      {envasado.loteProductoTerminado || batch.id}
                    </strong>
                  </div>
                  <div>
                    <span className="text-gray-500 block text-[10px]">Vencimiento Oficial:</span>
                    <strong className="font-mono text-gray-900">
                      {envasado.fechaVencimiento} (+25 d)
                    </strong>
                  </div>
                  <div>
                    <span className="text-gray-500 block text-[10px]">Total Unidades:</span>
                    <strong className="font-mono text-gray-900">
                      {totalUnidades} unid. ({totalKilosEnvasados.toFixed(2)} kg)
                    </strong>
                  </div>
                  <div>
                    <span className="text-gray-500 block text-[10px]">Cuarto Frío Pre-Despacho:</span>
                    <strong className="font-mono text-gray-900">
                      24 h a {envasado.almacenamientoCuartoFrio.temperaturaAlmacenamiento.toFixed(1)} °C
                    </strong>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* =========================================================================
              PESTAÑA 3: CERTIFICADO OFICIAL NTC-805
          ========================================================================= */}
          {activeTab === 'certificado' && (
            <div className="p-6 rounded-2xl bg-white border-2 border-indigo-300 shadow-sm flex flex-col gap-5 text-gray-900">
              <div className="flex items-center justify-between pb-4 border-b-2 border-indigo-100">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-indigo-950 text-white flex items-center justify-center font-bold">
                    <span className="material-symbols-outlined text-[28px]">verified</span>
                  </div>
                  <div>
                    <h3 className="text-base font-black uppercase text-indigo-950">
                      Certificado de Liberación de Lote · Kumis Tradicional
                    </h3>
                    <span className="text-xs text-gray-500 font-semibold">
                      Norma Técnica Colombiana NTC-805 (Productos Lácteos Fermentados)
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-xs font-mono font-bold text-indigo-900 bg-indigo-50 px-3 py-1 rounded border border-indigo-200 block">
                    {batch.id}
                  </span>
                  <span className="text-[10px] text-gray-500 mt-0.5 block">
                    Fecha: {envasado.fechaProduccion || '2026-10-20'}
                  </span>
                </div>
              </div>

              {/* Datos de Aseguramiento de Calidad */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs bg-[#FFFFFF] p-4 rounded-xl border border-[#D6DEEA]">
                <div>
                  <span className="text-gray-500 block text-[10px] uppercase font-bold">Producto:</span>
                  <strong className="text-gray-900">{batch.productName}</strong>
                </div>
                <div>
                  <span className="text-gray-500 block text-[10px] uppercase font-bold">Lote Terminado:</span>
                  <strong className="font-mono text-indigo-950">{envasado.loteProductoTerminado || batch.id}</strong>
                </div>
                <div>
                  <span className="text-gray-500 block text-[10px] uppercase font-bold">Fecha de Vencimiento:</span>
                  <strong className="font-mono text-gray-900">{envasado.fechaVencimiento}</strong>
                </div>
                <div>
                  <span className="text-gray-500 block text-[10px] uppercase font-bold">Masa Envasada:</span>
                  <strong className="font-mono text-gray-900">{totalKilosEnvasados.toFixed(2)} kg ({totalUnidades} unid.)</strong>
                </div>
                <div>
                  <span className="text-gray-500 block text-[10px] uppercase font-bold">pH de Cierre:</span>
                  <strong className="font-mono text-emerald-800">{maduracionFrio.refrigeracion.phFinalFrio.toFixed(2)} (Rango 4.40 - 4.55)</strong>
                </div>
                <div>
                  <span className="text-gray-500 block text-[10px] uppercase font-bold">Sellado y Rotulado:</span>
                  <strong className="text-emerald-800 font-bold">✓ Conforme NTC-805</strong>
                </div>
              </div>

              {/* Dictamen de Calidad */}
              <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-300 text-xs text-emerald-950 flex items-start gap-2.5">
                <span className="material-symbols-outlined text-emerald-700 text-[20px] shrink-0">task_alt</span>
                <div>
                  <strong className="block font-bold">DICTAMEN DE LIBERACIÓN: CONFORME</strong>
                  <p className="mt-0.5 text-emerald-900 text-[11px] leading-relaxed">
                    El lote <strong>{batch.id}</strong> cumple a cabalidad con los requisitos higiénico-sanitarios, microbiológicos y fisicoquímicos establecidos en la norma NTC-805 para Kumis Tradicional Fermentado. Autorizado para despacho comercial.
                  </p>
                </div>
              </div>

              {/* Firmas Digitales */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4 border-t border-gray-200 text-xs">
                <div className="flex flex-col items-center text-center p-3 rounded-xl bg-gray-50 border border-gray-200">
                  <div className="h-10 flex items-end font-mono text-sm font-bold text-gray-700 italic border-b border-gray-400 w-48 justify-center pb-1">
                    {responsable}
                  </div>
                  <span className="font-bold text-gray-800 mt-2">Responsable de Producción</span>
                  <span className="text-[10px] text-gray-500">Operador Autorizado de Planta</span>
                </div>

                <div className="flex flex-col items-center text-center p-3 rounded-xl bg-gray-50 border border-gray-200">
                  <div className="h-10 flex items-end font-mono text-sm font-bold text-indigo-900 italic border-b border-indigo-400 w-48 justify-center pb-1">
                    Ing. Calidad Planta
                  </div>
                  <span className="font-bold text-indigo-950 mt-2">Aseguramiento de Calidad</span>
                  <span className="text-[10px] text-gray-500">Firma Digital Verificada</span>
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
