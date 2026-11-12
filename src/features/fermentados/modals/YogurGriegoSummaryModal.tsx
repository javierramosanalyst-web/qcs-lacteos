import React from 'react';
import { UserProfile } from '../../../types';
import { YogurGriegoBatchData } from '../../../types/yogur_griego';
import {
  ProductionSummaryModal,
  SummaryMetricsRow,
} from '../../../components/shared/ProductionSummaryModal';

interface YogurGriegoSummaryModalProps {
  batch: YogurGriegoBatchData;
  isOpen: boolean;
  onClose: () => void;
  users?: UserProfile[];
  onFinalizeBatch?: () => void;
  onChangeObservaciones?: (observaciones: string) => void;
  onChangeOperariosIntervinientes?: (operarios: string[]) => void;
}

export const YogurGriegoSummaryModal: React.FC<YogurGriegoSummaryModalProps> = ({
  batch,
  isOpen,
  onClose,
  users = [],
  onFinalizeBatch,
  onChangeObservaciones,
  onChangeOperariosIntervinientes,
}) => {
  if (!isOpen) return null;

  const responsable = batch.operator || '';

  const {
    pasteurizacion,
    inoculacion,
    maduracionYFiltrado,
    batidoYAdiciones,
    envasado,
  } = batch;

  // 1. Leche inicial
  const lecheInicialL = pasteurizacion.litrosLeche ?? 0;

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
  const sinEstBolsa4L = envasado.formatosSinEstevia?.bolsa4L || 0;
  const masaEnvasadaSinEstevia = Number(
    (sinEst1L * 1.0 + sinEst500ml * 0.5 + sinEst120ml * 0.12 + sinEstBolsa4L * 4.0).toFixed(2)
  );
  const undsSinEstevia = sinEst1L + sinEst500ml + sinEst120ml + sinEstBolsa4L;

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
  const conEstBolsa4L = envasado.formatosConEstevia?.bolsa4L || 0;
  const masaEnvasadaConEstevia = Number(
    (conEst1L * 1.0 + conEst500ml * 0.5 + conEst120ml * 0.12 + conEstBolsa4L * 4.0).toFixed(2)
  );
  const undsConEstevia = conEst1L + conEst500ml + conEst120ml + conEstBolsa4L;

  const masaTotalEnvasadaKg = Number((masaEnvasadaSinEstevia + masaEnvasadaConEstevia).toFixed(2));
  const totalUnidades = undsSinEstevia + undsConEstevia;

  // 3. Rendimiento lácteo sobre volumen de leche desviada
  const rendimientoLacteoPct =
    lecheInicialL > 0 ? Number(((masaTotalEnvasadaKg / lecheInicialL) * 100).toFixed(1)) : 0;

  // Stevia en Griego (si aplica)
  const loteEsteviaGriego = batidoYAdiciones.formulacion?.variedadConEstevia?.loteEstevia || '';
  const gramosEsteviaGriego = batidoYAdiciones.formulacion?.variedadConEstevia?.gramosEstevia || 0;
  const hasEsteviaGriego = Boolean(loteEsteviaGriego || gramosEsteviaGriego > 0 || undsConEstevia > 0);

  return (
    <ProductionSummaryModal
      isOpen={isOpen}
      onClose={onClose}
      batchId={batch.id}
      productName="Yogur Griego"
      productBadge="Yogur Griego Concentrado"
      standard="NTC-805"
      icon="filter_alt"
      status={batch.status}
      responsable={responsable}
      users={users}
      observaciones={batch.observaciones}
      operariosIntervinientes={batch.operariosIntervinientes}
      actividadOperarios={batch.actividadOperarios}
      onFinalizeBatch={onFinalizeBatch}
      motivoNoCierre={totalUnidades === 0 ? 'Registra al menos un recipiente antes de cerrar el lote.' : null}
      onChangeObservaciones={onChangeObservaciones}
      onChangeOperariosIntervinientes={onChangeOperariosIntervinientes}
      observacionesPlaceholder="Registre cualquier novedad observada durante el filtrado o la formulación..."
      constanciaTexto="Todos los tiempos, temperaturas de pasteurización, inoculación, filtrado en mallas y balance de masas del lote"
      etapas={[
        {
          titulo: '1. Pasteurización Térmica Pura (Sin Azúcar Ni Crema)',
          items: [
            { label: 'Leche', value: `${lecheInicialL} L` },
            { label: 'Lote compartido', value: <span className="text-amber-800 font-mono">{pasteurizacion.loteYogurSinAzucar || 'Sin registrar'}</span> },
            { label: 'Temp. alcanzada', value: `${pasteurizacion.calentamiento.temperaturaAlcanzada} °C` },
            { label: 'Sostenimiento', value: pasteurizacion.sostenimiento.duracionReal || '--' },
            { label: 'Enfriamiento', value: `${pasteurizacion.enfriamiento.temperaturaFinal} °C` },
          ],
        },
        {
          titulo: '2. Inoculación e Incubación Termófila',
          items: [
            { label: 'Temp. siembra', value: `${inoculacion.temperaturaVerificada45} °C` },
            { label: 'Lote cultivo', value: inoculacion.loteCultivo || '--' },
            { label: 'Dosificación', value: `${inoculacion.cantidadCultivoCucharadas} cd (${inoculacion.cantidadCultivoGramos} g)` },
            { label: 'Incubación', value: `${inoculacion.incubacion.tiempoTranscurrido || '--'} (pH ${inoculacion.incubacion.phFinalIncubacion})` },
          ],
        },
        {
          titulo: '3. Cuarto Frío y Filtrado en Telas (Desuerado)',
          items: [
            { label: 'Temp. cuarto frío', value: `${maduracionYFiltrado.cuartoFrio.temperatura} °C` },
            { label: 'Tiempo cuarto frío', value: maduracionYFiltrado.cuartoFrio.tiempoTranscurrido || '--' },
            { label: 'Tiempo filtrado lienzos', value: maduracionYFiltrado.filtradoTelas.tiempoTranscurrido || '--' },
          ],
        },
        {
          titulo: '4. Batido y Envasado',
          items: [
            { label: 'Inicio → Fin', value: `${batidoYAdiciones.batido.horaInicio || '--'} → ${batidoYAdiciones.batido.horaFin || '--'}` },
            { label: 'Tiempo total', value: batidoYAdiciones.batido.tiempoBatido || '--' },
            { label: 'Stevia', value: `${gramosEsteviaGriego} g (${loteEsteviaGriego || 'sin lote'})` },
            { label: 'Velocidad batido', value: `${batidoYAdiciones.batido.velocidadRpm} RPM` },
          ],
        },
        {
          titulo: '5. Guardar',
          items: [
            { label: 'Griego natural', value: `${masaEnvasadaSinEstevia} kg (${undsSinEstevia} unds)` },
            { label: 'Griego con stevia', value: `${masaEnvasadaConEstevia} kg (${undsConEstevia} unds)` },
            { label: 'Total envasado', value: `${masaTotalEnvasadaKg} kg (${totalUnidades} unds)` },
            { label: 'Ingreso cuarto frío', value: envasado.almacenamientoCuartoFrio.horaIngreso || '--' },
          ],
        },
      ]}
      resumen={
        <>
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

          <SummaryMetricsRow
            leche={{ label: '1. Leche Base Desviada', value: `${lecheInicialL} L`, sub: `Lote: ${pasteurizacion.loteLeche || '--'}` }}
            producido={{ value: `${masaTotalEnvasadaKg} kg`, sub: `${totalUnidades} recipientes` }}
            rendimiento={{ value: `${rendimientoLacteoPct}%`, sub: 's/ Leche' }}
          />

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
                    {pasteurizacion.loteLeche || '--'}
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
                    {inoculacion.loteCultivo || '--'}
                  </strong>
                </div>
                <div className="mt-2 pt-2 border-t border-emerald-100 flex items-center justify-between text-[10px]">
                  <span className="text-gray-500">Dosis DVI:</span>
                  <span className="font-bold text-emerald-900">{inoculacion.cantidadCultivoGramos || 0} g</span>
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
                    {hasEsteviaGriego ? (loteEsteviaGriego || '--') : 'N/A - 100% Natural Sin Endulzar'}
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
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
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
                  <div className="p-2 bg-white rounded-xl border border-blue-100">
                    <span className="text-gray-500 block text-[10px]">Bolsa 4 L:</span>
                    <span className="font-bold text-blue-900">{sinEstBolsa4L} und</span>
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
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
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
                  <div className="p-2 bg-white rounded-xl border border-emerald-100">
                    <span className="text-gray-500 block text-[10px]">Bolsa 4 L:</span>
                    <span className="font-bold text-emerald-900">{conEstBolsa4L} und</span>
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
                <span className="font-bold text-gray-900">{pasteurizacion.sostenimiento.duracionReal || '--'}</span>
              </div>
              <div className="p-3 bg-gray-50 rounded-xl">
                <span className="text-gray-500 block">Incubación (43 °C):</span>
                <span className="font-bold text-gray-900">
                  {inoculacion.incubacion.tiempoTranscurrido || '--'}
                </span>
              </div>
              <div className="p-3 bg-gray-50 rounded-xl">
                <span className="text-gray-500 block">Cuarto Frío (0–4 °C):</span>
                <span className="font-bold text-gray-900">
                  {maduracionYFiltrado.cuartoFrio.tiempoTranscurrido || '--'}
                </span>
              </div>
              <div className="p-3 bg-gray-50 rounded-xl">
                <span className="text-gray-500 block">Filtrado en Lienzos:</span>
                <span className="font-bold text-gray-900">
                  {maduracionYFiltrado.filtradoTelas.tiempoTranscurrido || '--'}
                </span>
              </div>
            </div>
          </div>
        </>
      }
    />
  );
};
