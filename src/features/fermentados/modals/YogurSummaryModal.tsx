import React from 'react';
import { UserProfile } from '../../../types';
import { YogurBatchData } from '../../../types/yogur';
import { computeDurationBetweenTimes } from '../../../utils/timer';
import {
  ProductionSummaryModal,
  SummaryMetricsRow,
} from '../../../components/shared/ProductionSummaryModal';
import { loteVisible } from '../../../utils/lote';

interface YogurSummaryModalProps {
  batch: YogurBatchData;
  isOpen: boolean;
  onClose: () => void;
  users?: UserProfile[];
  onFinalizeBatch?: () => void;
  onChangeObservaciones?: (observaciones: string) => void;
  onChangeOperariosIntervinientes?: (operarios: string[]) => void;
}

export const YogurSummaryModal: React.FC<YogurSummaryModalProps> = ({
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

  // Condicional de formulación según "¿Lleva azúcar?" definido en Pasteurización
  const llevaAzucar = pasteurizacion.llevaAzucar !== false;

  // 1. Cálculos de envasado reales por categoría
  // Categoría 1: Envases Sin Azúcar (Natural)
  const uSinAzucar_200ml = envasado.formatos.sinAzucar_botella200ml || 0;
  const uSinAzucar_1L = envasado.formatos.sinAzucar_botella1L || 0;
  const uSinAzucar_2L = envasado.formatos.sinAzucar_botella2L || 0;
  const uSinAzucar_4L = envasado.formatos.sinAzucar_bolsa4L || 0;
  const unidadesSinAzucar = uSinAzucar_200ml + uSinAzucar_1L + uSinAzucar_2L + uSinAzucar_4L;
  const litrosSinAzucar = Number(
    (uSinAzucar_200ml * 0.2 + uSinAzucar_1L * 1.0 + uSinAzucar_2L * 2.0 + uSinAzucar_4L * 4.0).toFixed(2)
  );

  // Categoría 2: Envases Con Stevia
  const uStevia_120ml = envasado.formatos.stevia_botella120ml || 0;
  const uStevia_200ml = envasado.formatos.stevia_botella200ml || 0;
  const uStevia_1L = envasado.formatos.stevia_botella1L || 0;
  const uStevia_2L = envasado.formatos.stevia_botella2L || 0;
  const uStevia_4L = envasado.formatos.stevia_bolsa4L || 0;
  const unidadesEstevia = uStevia_120ml + uStevia_200ml + uStevia_1L + uStevia_2L + uStevia_4L;
  const litrosEstevia = Number(
    (uStevia_120ml * 0.12 + uStevia_200ml * 0.2 + uStevia_1L * 1.0 + uStevia_2L * 2.0 + uStevia_4L * 4.0).toFixed(2)
  );

  // Categoría 3: Envases Tradicionales Con Azúcar (exclusivo para cuando llevaAzucar === true)
  const uTrad_120ml = llevaAzucar ? (envasado.formatos.botella120ml || 0) : 0;
  const uTrad_200ml = llevaAzucar ? ((envasado.formatos.botella200ml ?? envasado.formatos.vaso200g) || 0) : 0;
  const uTrad_1L = llevaAzucar ? ((envasado.formatos.botella1L ?? envasado.formatos.botella1000g) || 0) : 0;
  const uTrad_2L = llevaAzucar ? (envasado.formatos.botella2L || 0) : 0;
  const uTrad_4L = llevaAzucar ? (envasado.formatos.bolsa4L || 0) : 0;
  const unidadesAzucar = llevaAzucar
    ? (uTrad_120ml + uTrad_200ml + uTrad_1L + uTrad_2L + uTrad_4L)
    : 0;
  const litrosAzucar = llevaAzucar
    ? Number((uTrad_120ml * 0.12 + uTrad_200ml * 0.2 + uTrad_1L * 1.0 + uTrad_2L * 2.0 + uTrad_4L * 4.0).toFixed(2))
    : 0;

  // Unidades consolidadas por presentación
  const u120ml = uStevia_120ml + uTrad_120ml;
  const u200ml = uSinAzucar_200ml + uStevia_200ml + uTrad_200ml;
  const u1L = uSinAzucar_1L + uStevia_1L + uTrad_1L;
  const u2L = uSinAzucar_2L + uStevia_2L + uTrad_2L;
  const u4L = uSinAzucar_4L + uStevia_4L + uTrad_4L;

  const totalUnidades = unidadesSinAzucar + unidadesEstevia + unidadesAzucar;
  const totalLitrosEnvasados = Number((litrosSinAzucar + litrosEstevia + litrosAzucar).toFixed(2));
  const totalKilosEnvasados = Math.round((totalLitrosEnvasados * 1.03) * 100) / 100;
  const totalGramosEnvasados = Math.round(totalKilosEnvasados * 1000);

  // Estados de elaboración por variedad (evaluados estrictamente en base a unidades reales envasadas)
  const isElaboradoSinAzucar = unidadesSinAzucar > 0;
  const isElaboradoAzucar = Boolean(llevaAzucar && unidadesAzucar > 0);
  const isElaboradoEstevia = unidadesEstevia > 0;

  // Compatibilidad con identificadores anteriores
  const hasSinAzucar = isElaboradoSinAzucar;
  const hasAzucar = Boolean(llevaAzucar);

  // Insumos: LOTE AZÚCAR
  const loteAzucar = llevaAzucar
    ? (pasteurizacion.azucar?.loteAzucar || pasteurizacion.loteAzucar || batidoYAdiciones.adiciones?.variedadAzucar?.loteAzucar || (batidoYAdiciones.adiciones as any)?.loteAzucar || 'Sin registrar')
    : '';
  const gramosAzucar = llevaAzucar
    ? (pasteurizacion.azucar?.cantidadKg
        ? Math.round(pasteurizacion.azucar.cantidadKg * 1000)
        : pasteurizacion.cantidadAzucarKg
        ? Math.round(pasteurizacion.cantidadAzucarKg * 1000)
        : (batidoYAdiciones.adiciones?.variedadAzucar?.gramosAzucar || (batidoYAdiciones.adiciones as any)?.gramosAzucar || Math.round(((pasteurizacion.litrosLeche ?? 0) / 40) * 3200)))
    : 0;

  // Insumos: LOTE ESTEVIA
  const loteEsteviaRegistrado =
    batidoYAdiciones.adiciones?.variedadEstevia?.loteEstevia ||
    (batidoYAdiciones.adiciones as any)?.loteEstevia ||
    '';
  const gramosEsteviaRegistrados =
    batidoYAdiciones.adiciones?.variedadEstevia?.gramosEstevia ??
    (batidoYAdiciones.adiciones as any)?.gramosEstevia ??
    (batidoYAdiciones.adiciones as any)?.cantidadSteviaGramos ??
    0;
  const isSteviaUtilizada = Boolean(
    !llevaAzucar && (
      (batidoYAdiciones.adiciones as any)?.steviaConfirmada ||
      (batidoYAdiciones.adiciones as any)?.horaAdicionStevia ||
      batidoYAdiciones.adiciones?.variedadEstevia?.horaAdicion ||
      loteEsteviaRegistrado ||
      gramosEsteviaRegistrados > 0 ||
      unidadesEstevia > 0
    )
  );
  const hasEstevia = isSteviaUtilizada;
  const loteEstevia = isSteviaUtilizada ? (loteEsteviaRegistrado || 'Sin registrar') : '';
  const gramosEstevia = isSteviaUtilizada ? gramosEsteviaRegistrados : 0;

  // Datos de saborizante y colorante (estrictamente deshabilitados si el lote es Sin Azúcar)
  const rawSaborizante = batidoYAdiciones.adiciones?.saborizante;
  const rawVariedadAzucar = batidoYAdiciones.adiciones?.variedadAzucar;
  const rawAdiciones = batidoYAdiciones.adiciones as any;

  const hasSaborizante = Boolean(
    llevaAzucar && (
      rawSaborizante?.habilitado ??
      rawVariedadAzucar?.llevaSaborizante ??
      Boolean(
        rawAdiciones?.saborizanteMl ||
        rawVariedadAzucar?.saborizanteMl ||
        rawAdiciones?.loteSaborizante ||
        rawVariedadAzucar?.loteSaborizante ||
        (rawSaborizante?.cantidad && rawSaborizante.cantidad > 0)
      )
    ) &&
    rawSaborizante?.sabor !== 'Sin Saborizante' &&
    rawVariedadAzucar?.sabor !== 'Sin Saborizante'
  );

  const saborNombre = hasSaborizante
    ? (rawSaborizante?.sabor || rawVariedadAzucar?.sabor || rawAdiciones?.sabor || 'Sin registrar')
    : 'Natural';
  const cantidadSaborizante = hasSaborizante
    ? Number(rawSaborizante?.cantidad || rawVariedadAzucar?.saborizanteMl || rawAdiciones?.saborizanteMl || 0)
    : 0;
  const loteSaborizante = hasSaborizante
    ? (rawSaborizante?.loteSaborizante || rawVariedadAzucar?.loteSaborizante || rawAdiciones?.loteSaborizante || '')
    : '';

  const saborizante = {
    habilitado: hasSaborizante,
    sabor: saborNombre,
    cantidad: cantidadSaborizante,
    unidad: 'ml',
    loteSaborizante: loteSaborizante,
  };

  // Desviaciones a sub-lotes (Kumis y Yogur Griego)
  const extraccionKumisLitros = pasteurizacion.extraccionKumis?.realizado
    ? Number(pasteurizacion.extraccionKumis.litrosExtraidos) || 0
    : 0;
  const extraccionGriegoLitros = pasteurizacion.extraccionGriego?.realizado
    ? Number(pasteurizacion.extraccionGriego.litrosExtraidos) || 0
    : 0;
  const totalDesviadoSublotes = extraccionKumisLitros + extraccionGriegoLitros;
  const volumenBaseRemanenteL = pasteurizacion.litrosLeche ?? 0;
  const volumenInicialPadreL = volumenBaseRemanenteL + totalDesviadoSublotes;

  // Balance de masa total formulada vs. envasada (calculada sobre volumen neto remanente)
  const lecheKg = volumenBaseRemanenteL * 1.03;
  const adicAzucarKg = hasAzucar ? gramosAzucar / 1000 : 0;
  const adicEsteviaKg = hasEstevia ? gramosEstevia / 1000 : 0;
  const adicSaborKg = hasSaborizante ? cantidadSaborizante / 1000 : 0;
  const totalFormuladoKg = Math.round((lecheKg + adicAzucarKg + adicEsteviaKg + adicSaborKg) * 100) / 100;
  const rendimientoPct = totalFormuladoKg > 0 ? (totalKilosEnvasados / totalFormuladoKg) * 100 : 0;
  const rendimientoSobreLechePct = volumenBaseRemanenteL > 0
    ? Number(((totalLitrosEnvasados / volumenBaseRemanenteL) * 100).toFixed(1))
    : 0;
  const batidora = batidoYAdiciones.batidora;
  const salidaCF = batidoYAdiciones.salidaCuartoFrio?.hora || null;
  const ingresoCF = envasado.almacenamientoCuartoFrio.horaIngreso || null;
  const tiempoAfueraCF = salidaCF && ingresoCF ? computeDurationBetweenTimes(salidaCF, ingresoCF).human : '--';
  const saboresLote = (batidoYAdiciones.lotesSabor || []).map((l) => l.sabor).join(', ');

  return (
    <ProductionSummaryModal
      isOpen={isOpen}
      onClose={onClose}
      batchId={batch.id}
      loteVisible={loteVisible(batch)}
      productName={batch.productName || 'Yogur Entero Probiótico'}
      productBadge={llevaAzucar ? 'Yogur con Azúcar' : 'Yogur sin Azúcar'}
      standard={batch.standard || 'NTC-805'}
      icon="icecream"
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
      observacionesPlaceholder="Registre cualquier novedad observada en pasteurización, incubación, receta o envasado..."
      constanciaTexto="Todos los tiempos, temperaturas de pasteurización, inoculación, receta de sabores y balance de envasado del lote"
      etapas={[
        {
          titulo: '1. Pasteurización y Enfriamiento',
          items: [
            { label: 'Leche', value: `${pasteurizacion.litrosLeche ?? 0} L (${pasteurizacion.loteLeche || '--'})` },
            { label: 'Temp. alcanzada', value: `${pasteurizacion.calentamiento.temperaturaAlcanzada || 0} °C` },
            { label: 'Calentamiento', value: pasteurizacion.calentamiento.tiempoCalentamiento || '--' },
            {
              label: 'Enfriamiento',
              value: `${pasteurizacion.enfriamiento.temperaturaFinal || 0} °C (${pasteurizacion.enfriamiento.tiempoEnfriamiento || '--'})`,
            },
            { label: 'Desvío a sub-lotes', value: `${totalDesviadoSublotes} L` },
          ],
        },
        {
          titulo: '2. Inoculación e Incubación',
          items: [
            { label: 'Lote cultivo', value: inoculacion.loteCultivo || '--' },
            { label: 'Dosificación', value: `${inoculacion.cantidadCultivoGramos || 0} g` },
            { label: 'Temp. siembra', value: `${inoculacion.temperaturaVerificada45 || 0} °C` },
            {
              label: 'Incubación',
              value: `${inoculacion.incubacion.tiempoTranscurrido || '--'} (pH ${inoculacion.incubacion.phFinalIncubacion || '--'})`,
            },
          ],
        },
        {
          titulo: '3. Receta y Sabores',
          items: [
            { label: 'Azúcar', value: hasAzucar ? `${gramosAzucar} g (${loteAzucar || '--'})` : 'Sin azúcar' },
            { label: 'Stevia', value: hasEstevia ? `${gramosEstevia} g (${loteEstevia || '--'})` : 'No aplica' },
            { label: 'Saborizante', value: hasSaborizante ? `${saborNombre} · ${cantidadSaborizante} ml` : 'Natural' },
            { label: 'Masa formulada', value: `${totalFormuladoKg.toFixed(2)} kg` },
          ],
        },
        {
          titulo: '4. Batido y Envasado',
          items: [
            { label: 'Salida cuarto frío', value: salidaCF || '--' },
            { label: 'Inicio → Fin', value: `${batidora.horaInicio || '--'} → ${batidora.horaFin || '--'}` },
            { label: 'Tiempo total', value: batidora.tiempoBatido || '--' },
            { label: 'Sabores', value: saboresLote || '--' },
          ],
        },
        {
          titulo: '5. Guardar',
          items: [
            { label: 'Total envasado', value: `${totalUnidades} unds (${totalLitrosEnvasados.toFixed(1)} L)` },
            { label: 'Masa envasada', value: `${totalKilosEnvasados.toFixed(2)} kg` },
            { label: 'Ingreso cuarto frío', value: ingresoCF || '--' },
            { label: 'Tiempo fuera de frío', value: tiempoAfueraCF },
          ],
        },
      ]}
      resumen={
        <>
          <SummaryMetricsRow
            leche={{ label: '1. Leche Base', value: `${volumenBaseRemanenteL} L`, sub: `Lote: ${pasteurizacion.loteLeche || '--'}` }}
            producido={{ value: `${totalLitrosEnvasados} L`, sub: `${totalUnidades} envases · ${totalKilosEnvasados.toFixed(2)} kg` }}
            rendimiento={{ value: `${rendimientoSobreLechePct}%`, sub: 's/ Leche' }}
          />

          {/* 2. SECCIÓN: "Trazabilidad de Materias Primas e Insumos" */}
          <div className="bg-[#FFFFFF] p-3.5 rounded-xl border border-[#D6DEEA] flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#191c1e] flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[18px] text-purple-800">
                  inventory_2
                </span>
                Trazabilidad de Materias Primas e Insumos
              </span>
              <span className="text-[10px] text-gray-500 font-semibold bg-white px-2 py-0.5 rounded border border-[#D6DEEA]">
                Lotes Registrados · Yogur
              </span>
            </div>

            {/* Grid Dinámico de 5 Tarjetas */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-2.5 text-xs">
              {/* Tarjeta 1 (Borde Azul - Obligatoria): LOTE LECHE */}
              <div className="bg-white p-3 rounded-xl border-2 border-sky-400 flex flex-col justify-between shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-sky-900 font-extrabold uppercase tracking-wide">
                    LOTE LECHE
                  </span>
                  <span className="material-symbols-outlined text-sky-500 text-[18px]">
                    water_drop
                  </span>
                </div>
                <span className="font-bold text-sky-950 font-mono text-sm mt-1">
                  {pasteurizacion.loteLeche || '--'}
                </span>
                <div className="mt-1 pt-1 border-t border-sky-100 flex items-center justify-between">
                  <span className="text-[11px] text-sky-800 font-bold">
                    {volumenBaseRemanenteL} L usados
                  </span>
                  <span className="text-[9px] font-semibold text-sky-700 bg-sky-50 px-1.5 py-0.5 rounded">
                    {totalDesviadoSublotes > 0
                      ? `Neto (-${totalDesviadoSublotes} L desviados)`
                      : 'Pasteurizada a 85-90 °C'}
                  </span>
                </div>
              </div>

              {/* Tarjeta 2 (Borde Verde - Obligatoria): LOTE CULTIVO LÁCTICO */}
              <div className="bg-white p-3 rounded-xl border-2 border-emerald-500 flex flex-col justify-between shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-emerald-900 font-extrabold uppercase tracking-wide">
                    LOTE CULTIVO LÁCTICO
                  </span>
                  <span className="material-symbols-outlined text-emerald-600 text-[18px]">
                    science
                  </span>
                </div>
                <span className="font-bold text-emerald-950 font-mono text-sm mt-1">
                  {inoculacion.loteCultivo || '--'}
                </span>
                <div className="mt-1 pt-1 border-t border-emerald-100 flex items-center justify-between">
                  <span className="text-[11px] text-emerald-800 font-bold">
                    {inoculacion.cantidadCultivoGramos || 0} g dosificados
                  </span>
                  <span className="text-[9px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                    ✓ Inoculado a 45 °C (8 h)
                  </span>
                </div>
              </div>

              {/* Tarjeta 3 (Condicional - Azúcar): LOTE AZÚCAR */}
              <div
                className={`p-3 rounded-xl border flex flex-col justify-between transition-all ${
                  hasAzucar
                    ? 'bg-white border-2 border-amber-500 shadow-2xs'
                    : 'bg-gray-50/80 border-gray-200 opacity-60'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`text-[10px] font-extrabold uppercase tracking-wide ${
                      hasAzucar ? 'text-amber-900' : 'text-gray-400'
                    }`}
                  >
                    LOTE AZÚCAR
                  </span>
                  <span
                    className={`material-symbols-outlined text-[18px] ${
                      hasAzucar ? 'text-amber-600' : 'text-gray-400'
                    }`}
                  >
                    cookie
                  </span>
                </div>
                <span
                  className={`font-bold font-mono text-sm mt-1 truncate ${
                    hasAzucar ? 'text-amber-950' : 'text-gray-400'
                  }`}
                >
                  {hasAzucar ? (loteAzucar || '--') : 'N/A - Sin adición de azúcar'}
                </span>
                <div
                  className={`mt-1 pt-1 border-t flex items-center justify-between ${
                    hasAzucar ? 'border-amber-100' : 'border-gray-200'
                  }`}
                >
                  {hasAzucar ? (
                    <>
                      <span className="text-[11px] text-amber-800 font-bold">
                        {gramosAzucar} g usados
                      </span>
                      <span className="text-[9px] font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
                        Sacarosa refinada
                      </span>
                    </>
                  ) : (
                    <span className="text-[11px] text-gray-400 font-medium italic">
                      Sin adición de azúcar
                    </span>
                  )}
                </div>
              </div>

              {/* Tarjeta 4 (Condicional - Estevia): LOTE ESTEVIA */}
              <div
                className={`p-3 rounded-xl border flex flex-col justify-between transition-all ${
                  hasEstevia
                    ? 'bg-white border-2 border-indigo-500 shadow-2xs'
                    : 'bg-gray-50/80 border-gray-200 opacity-60'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`text-[10px] font-extrabold uppercase tracking-wide ${
                      hasEstevia ? 'text-indigo-900' : 'text-gray-400'
                    }`}
                  >
                    LOTE ESTEVIA
                  </span>
                  <span
                    className={`material-symbols-outlined text-[18px] ${
                      hasEstevia ? 'text-indigo-600' : 'text-gray-400'
                    }`}
                  >
                    spa
                  </span>
                </div>
                <span
                  className={`font-bold font-mono text-sm mt-1 truncate ${
                    hasEstevia ? 'text-indigo-950' : 'text-gray-400'
                  }`}
                >
                  {hasEstevia ? loteEstevia : 'N/A'}
                </span>
                <div
                  className={`mt-1 pt-1 border-t flex items-center justify-between ${
                    hasEstevia ? 'border-indigo-100' : 'border-gray-200'
                  }`}
                >
                  {hasEstevia ? (
                    <>
                      <span className="text-[11px] text-indigo-800 font-bold">
                        {gramosEstevia} g usados
                      </span>
                      <span className="text-[9px] font-semibold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded">
                        Glucósidos
                      </span>
                    </>
                  ) : (
                    <span className="text-[11px] text-gray-400 font-medium italic">
                      Sin adición de estevia
                    </span>
                  )}
                </div>
              </div>

              {/* Tarjeta 5 (Condicional - Saborizante): LOTE SABORIZANTE */}
              <div
                className={`p-3 rounded-xl border flex flex-col justify-between transition-all ${
                  hasSaborizante
                    ? 'bg-white border-2 border-rose-400 shadow-2xs'
                    : 'bg-gray-50/80 border-gray-200 opacity-60'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`text-[10px] font-extrabold uppercase tracking-wide ${
                      hasSaborizante ? 'text-rose-900' : 'text-gray-400'
                    }`}
                  >
                    LOTE SABORIZANTE
                  </span>
                  <span
                    className={`material-symbols-outlined text-[18px] ${
                      hasSaborizante ? 'text-rose-600' : 'text-gray-400'
                    }`}
                  >
                    local_florist
                  </span>
                </div>
                <span
                  className={`font-bold font-mono text-sm mt-1 truncate ${
                    hasSaborizante ? 'text-rose-950' : 'text-gray-400'
                  }`}
                >
                  {hasSaborizante ? (loteSaborizante || '--') : 'N/A'}
                </span>
                <div
                  className={`mt-1 pt-1 border-t flex items-center justify-between ${
                    hasSaborizante ? 'border-rose-100' : 'border-gray-200'
                  }`}
                >
                  {hasSaborizante ? (
                    <>
                      <span className="text-[11px] text-rose-800 font-bold truncate">
                        {saborNombre}
                      </span>
                      <span className="text-[9px] font-semibold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded shrink-0">
                        {cantidadSaborizante} ml
                      </span>
                    </>
                  ) : (
                    <span className="text-[11px] text-gray-400 font-medium italic">
                      Sin adición de saborizante
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 3. SECCIÓN: "Resumen de Producción y Variedades (Yogur)" */}
          <div className="bg-[#FFFFFF] p-3.5 rounded-xl border border-purple-200 flex flex-col gap-2.5 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#191c1e] flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[18px] text-purple-900">
                  view_agenda
                </span>
                Resumen de Producción y Variedades (Yogur)
              </span>
              <span className="text-[10px] text-purple-950 font-bold bg-purple-100/90 px-3 py-1 rounded-full border border-purple-300">
                {totalUnidades} unidades totales · {totalLitrosEnvasados.toFixed(1)} Litros envasados
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {/* Tarjeta A (Yogur sin azúcar) */}
              <div
                className={`p-3 rounded-xl border flex flex-col justify-between transition-all ${
                  isElaboradoSinAzucar
                    ? 'bg-emerald-50/70 border-emerald-400 shadow-2xs'
                    : 'bg-gray-100/90 border-gray-300 text-gray-500'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`material-symbols-outlined text-[18px] ${
                        isElaboradoSinAzucar ? 'text-emerald-700' : 'text-gray-400'
                      }`}
                    >
                      eco
                    </span>
                    <span
                      className={`text-xs font-bold ${
                        isElaboradoSinAzucar ? 'text-emerald-950' : 'text-gray-600'
                      }`}
                    >
                      Yogur sin azúcar (Natural)
                    </span>
                  </div>
                  <span
                    className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                      isElaboradoSinAzucar
                        ? 'bg-emerald-200 text-emerald-900 border border-emerald-300'
                        : 'bg-gray-200 text-gray-500'
                    }`}
                  >
                    {isElaboradoSinAzucar ? 'ELABORADO' : 'SIN UNIDADES'}
                  </span>
                </div>

                <div className="mt-2.5">
                  {isElaboradoSinAzucar ? (
                    <div>
                      <span className="text-sm font-black font-mono text-emerald-950 block">
                        {unidadesSinAzucar} unidades obtenidas
                      </span>
                      <span className="text-[10px] text-emerald-800 font-medium mt-0.5 block">
                        {litrosSinAzucar} L envasados ({(litrosSinAzucar * 1.03).toFixed(1)} kg) · Exento de azúcar y saborizante
                      </span>
                    </div>
                  ) : (
                    <div className="py-1">
                      <span className="text-xs font-bold text-gray-500 italic block">
                        No elaborado en este lote
                      </span>
                      <span className="text-[10px] text-gray-400 mt-0.5 block">
                        0 L base · 0 unidades
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Tarjeta B (Yogur Con Azúcar) */}
              <div
                className={`p-3 rounded-xl border flex flex-col justify-between transition-all ${
                  isElaboradoAzucar
                    ? 'bg-amber-50/70 border-amber-400 shadow-2xs'
                    : 'bg-gray-100/90 border-gray-300 text-gray-500'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`material-symbols-outlined text-[18px] ${
                        isElaboradoAzucar ? 'text-amber-700' : 'text-gray-400'
                      }`}
                    >
                      cookie
                    </span>
                    <span
                      className={`text-xs font-bold ${
                        isElaboradoAzucar ? 'text-amber-950' : 'text-gray-600'
                      }`}
                    >
                      Yogur Con Azúcar
                    </span>
                  </div>
                  <span
                    className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                      isElaboradoAzucar
                        ? 'bg-amber-200 text-amber-900 border border-amber-300'
                        : 'bg-gray-200 text-gray-500'
                    }`}
                  >
                    {isElaboradoAzucar ? 'ELABORADO' : 'SIN UNIDADES'}
                  </span>
                </div>

                <div className="mt-2.5">
                  {isElaboradoAzucar ? (
                    <div>
                      <span className="text-sm font-black font-mono text-amber-950 block">
                        {unidadesAzucar} unidades obtenidas
                      </span>
                      <span className="text-[10px] text-amber-800 font-medium mt-0.5 block">
                        {litrosAzucar} L envasados · {gramosAzucar} g azúcar ({(gramosAzucar / 1000).toFixed(2)} kg)
                      </span>
                    </div>
                  ) : (
                    <div className="py-1">
                      <span className="text-xs font-bold text-gray-500 italic block">
                        No elaborado en este lote
                      </span>
                      <span className="text-[10px] text-gray-400 mt-0.5 block">
                        0 L base · 0 unidades
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Tarjeta C (Yogur Con Estevia) */}
              <div
                className={`p-3 rounded-xl border flex flex-col justify-between transition-all ${
                  isElaboradoEstevia
                    ? 'bg-indigo-50/70 border-indigo-400 shadow-2xs'
                    : 'bg-gray-100/90 border-gray-300 text-gray-500'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`material-symbols-outlined text-[18px] ${
                        isElaboradoEstevia ? 'text-indigo-700' : 'text-gray-400'
                      }`}
                    >
                      spa
                    </span>
                    <span
                      className={`text-xs font-bold ${
                        isElaboradoEstevia ? 'text-indigo-950' : 'text-gray-600'
                      }`}
                    >
                      Yogur Con Estevia
                    </span>
                  </div>
                  <span
                    className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                      isElaboradoEstevia
                        ? 'bg-indigo-200 text-indigo-900 border border-indigo-300'
                        : 'bg-gray-200 text-gray-500'
                    }`}
                  >
                    {isElaboradoEstevia ? 'ELABORADO' : 'SIN UNIDADES'}
                  </span>
                </div>

                <div className="mt-2.5">
                  {isElaboradoEstevia ? (
                    <div>
                      <span className="text-sm font-black font-mono text-indigo-950 block">
                        {unidadesEstevia} unidades obtenidas
                      </span>
                      <span className="text-[10px] text-indigo-800 font-medium mt-0.5 block">
                        {litrosEstevia} L envasados · {gramosEstevia} g estevia adicionada
                      </span>
                    </div>
                  ) : (
                    <div className="py-1">
                      <span className="text-xs font-bold text-gray-500 italic block">
                        No elaborado en este lote
                      </span>
                      <span className="text-[10px] text-gray-400 mt-0.5 block">
                        0 L base · 0 unidades
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      }
    />
  );
};
