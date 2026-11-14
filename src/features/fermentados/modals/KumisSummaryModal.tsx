import React from 'react';
import { UserProfile } from '../../../types';
import { KumisBatchData } from '../../../types/kumis';
import {
  ProductionSummaryModal,
  SummaryMetricsRow,
} from '../../../components/shared/ProductionSummaryModal';
import { loteVisible } from '../../../utils/lote';

interface KumisSummaryModalProps {
  batch: KumisBatchData;
  isOpen: boolean;
  onClose: () => void;
  users?: UserProfile[];
  onFinalizeBatch?: () => void;
  onChangeObservaciones?: (observaciones: string) => void;
  onChangeOperariosIntervinientes?: (operarios: string[]) => void;
}

export const KumisSummaryModal: React.FC<KumisSummaryModalProps> = ({
  batch,
  isOpen,
  onClose,
  users = [],
  onFinalizeBatch,
  onChangeObservaciones,
  onChangeOperariosIntervinientes,
}) => {
  if (!isOpen) return null;

  const responsable = batch.responsableProceso || batch.operator || '';
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
  const batidora = batidoYAdiciones.batidora;

  return (
    <ProductionSummaryModal
      isOpen={isOpen}
      onClose={onClose}
      batchId={batch.id}
      loteVisible={loteVisible(batch)}
      productName={batch.productName || 'Kumis Tradicional'}
      productBadge={hasAzucar ? 'Kumis con Azúcar' : 'Kumis sin Azúcar'}
      standard={batch.standard || 'NTC-805'}
      icon="local_drink"
      status={batch.status}
      responsable={responsable}
      users={users}
      observaciones={batch.observaciones}
      operariosIntervinientes={batch.operariosIntervinientes}
      actividadOperarios={batch.actividadOperarios}
      onFinalizeBatch={onFinalizeBatch}
      motivoNoCierre={totalUnidades === 0 ? 'Registra al menos un envase antes de cerrar el lote.' : null}
      onChangeObservaciones={onChangeObservaciones}
      onChangeOperariosIntervinientes={onChangeOperariosIntervinientes}
      observacionesPlaceholder="Registra cualquier eventualidad, ajuste en acidez, tiempo de incubación o control de envasado..."
      constanciaTexto="Todos los tiempos, temperaturas de pasteurización, inoculación, incubación y balance de envasado del lote"
      etapas={[
        {
          titulo: '1. Pasteurización',
          items: [
            { label: 'Leche', value: `${pasteurizacion.litrosLeche ?? 0} L (${pasteurizacion.loteLeche || '--'})` },
            {
              label: 'Calentamiento',
              value: `${Number(pasteurizacion.calentamiento.temperaturaAlcanzada || 0).toFixed(1)} °C (${pasteurizacion.calentamiento.tiempoCalentamiento || '--'})`,
            },
            {
              label: 'Enfriamiento',
              value: `${Number(pasteurizacion.enfriamiento.temperaturaFinal || 0).toFixed(1)} °C (${pasteurizacion.enfriamiento.tiempoEnfriamiento || '--'})`,
            },
            { label: 'Azúcar', value: hasAzucar ? `${pesoAzucarKg} kg (${loteAzucar || '--'})` : 'Sin azúcar' },
          ],
        },
        {
          titulo: '2. Inocular e Incubar',
          items: [
            { label: 'Lote cultivo', value: `${inoculacion.loteCultivo || '--'} (${inoculacion.cantidadCultivoGramos || 0} g)` },
            { label: 'Temp. inoculación', value: `${Number(inoculacion.temperaturaVerificada45 || 0).toFixed(1)} °C` },
            {
              label: 'Incubación',
              value: `${inoculacion.incubacion.tiempoTranscurrido || '--'} (${inoculacion.incubacion.temperaturaIncubacion ?? '--'} °C)`,
            },
            { label: 'pH final', value: Number(inoculacion.incubacion.phFinalIncubacion || 0).toFixed(2) },
          ],
        },
        {
          titulo: '3. Envasar y Guardar',
          items: [
            { label: 'Batido y envasado', value: `${batidora.horaInicio || '--'} → ${batidora.horaFin || '--'} (${batidora.tiempoBatido || '--'})` },
            { label: 'Total envasado', value: `${totalUnidades} unds (${totalLitrosEnvasados} L)` },
            { label: 'Rendimiento', value: `${rendimientoPct.toFixed(1)} %` },
            { label: 'Ingreso cuarto frío', value: envasado.almacenamientoCuartoFrio.horaIngreso || '--' },
          ],
        },
      ]}
      resumen={
        <>
          <SummaryMetricsRow
            leche={{ label: '1. Leche Base Kumis', value: `${lecheBaseLitros} L`, sub: `Lote: ${pasteurizacion.loteLeche || '--'}` }}
            producido={{ value: `${totalLitrosEnvasados} L`, sub: `${totalUnidades} unidades · ${totalKilosEnvasados.toFixed(2)} kg` }}
            rendimiento={{ value: `${rendimientoPct.toFixed(1)}%`, sub: 's/ Leche' }}
          />

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
        </>
      }
    />
  );
};
