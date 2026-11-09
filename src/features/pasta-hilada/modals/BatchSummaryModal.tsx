import React from 'react';
import { BatchData, UserProfile } from '../../../types';
import {
  ProductionSummaryModal,
  SummaryMetricsRow,
  SummarySection,
  EtapaResumen,
} from '../../../components/shared/ProductionSummaryModal';

interface BatchSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  batch: BatchData;
  users?: UserProfile[];
  onFinalizeBatch?: () => void;
  onChangeObservaciones?: (observaciones: string) => void;
  onChangeOperariosIntervinientes?: (operarios: string[]) => void;
}

export const BatchSummaryModal: React.FC<BatchSummaryModalProps> = ({
  isOpen,
  onClose,
  batch,
  users = [],
  onFinalizeBatch,
  onChangeObservaciones,
  onChangeOperariosIntervinientes,
}) => {
  const responsable = batch.responsableProceso || batch.operator || '';

  const is7Cueros = batch.productId === 'prod-queso-7-cueros';
  const isPera = batch.productId === 'prod-queso-pera' || batch.productName?.toLowerCase().includes('pera');
  const nombreProducto = (batch.productName || '').toLowerCase();
  const isIndustrial = !is7Cueros && !isPera && (nombreProducto.includes('industrial') || batch.productId === 'prod-doble-crema-industrial');

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
    : isIndustrial
    ? (batch.acidificar.insumos.lecheFresca || batch.lotesLeche.litrosLote2 || 0)
    : (batch.acidificar.insumos.lecheFresca || 0) + (batch.acidificar.insumos.lecheAcida || 0);

  if (!isOpen) return null;

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

  const hora = (v: unknown) => (v === undefined || v === null || v === '' ? '--:--' : String(v));
  const dato = (v: unknown) => (v === undefined || v === null || v === '' ? '--' : String(v));
  const kg = (unidades: number, gramos: number) => `${unidades} u · ${((unidades * gramos) / 1000).toFixed(2)} kg`;
  const rendimientoTexto = rendimientoPorcentaje === '--' ? '--' : `${rendimientoPorcentaje}%`;

  const moldesProducto: { label: string; unidades: number; gramos: number }[] = is7Cueros
    ? [
        { label: 'Queso 7 Cueros (350 g)', unidades: m7Cueros, gramos: 350 },
        { label: 'Queso Trenza (350 g)', unidades: mTrenza, gramos: 350 },
        ...(isArequipe7C ? [{ label: 'Quesadillas con Arequipe (60 g)', unidades: mQuesadillaArq, gramos: 60 }] : []),
        ...(isBocadillo7C ? [{ label: 'Quesadillas con Bocadillo (60 g)', unidades: mQuesadillaBoc, gramos: 60 }] : []),
      ]
    : isPera
    ? [
        { label: 'Queso Pera Grande (350 g)', unidades: m350, gramos: 350 },
        { label: 'Queso Pera Pequeño (60 g)', unidades: m60, gramos: 60 },
      ]
    : [
        { label: 'Moldes 100 g', unidades: m100, gramos: 100 },
        { label: 'Moldes 200 g', unidades: m200, gramos: 200 },
        { label: 'Moldes 400 g', unidades: m400, gramos: 400 },
        { label: 'Moldes 800 g', unidades: m800, gramos: 800 },
        { label: 'Moldes 1600 g', unidades: m1600, gramos: 1600 },
      ];

  const etapas: EtapaResumen[] = [
    {
      titulo: isPera ? '1. Leche e Insumos' : '1. Acidificar Leche',
      items: [
        { label: isPera ? 'Inicio premaduración' : 'Inicio calentamiento', value: hora(batch.acidificar.inicioCalentamiento?.horaInicio) },
        { label: isPera ? '40 °C alcanzado' : '35 °C alcanzado', value: hora(batch.acidificar.phase1.horaAlcanzo35) },
        { label: 'Tiempo calentamiento', value: dato(batch.acidificar.phase1.tiempoCalentamiento) },
        { label: 'Consigna', value: `${dato(batch.acidificar.tempConsigna)} °C` },
        { label: 'Leche utilizada', value: `${totalLecheUsada} L` },
        ...(isPera || is7Cueros
          ? []
          : isIndustrial
          ? [
              { label: 'Leche en tina', value: `${totalLecheUsada} L` },
              {
                label: 'Ácido acético',
                value: `${batch.acidificar.insumos.cultivoLacteoGramos || batch.lotesLeche.cultivoLacteoGramos || 0} ml (${batch.lotesLeche.loteCultivoLacteo || batch.acidificar.insumos.loteCultivoLacteo || 'Sin registrar'})`,
              },
            ]
          : [{ label: 'Leche fresca / ácida', value: `${batch.acidificar.insumos.lecheFresca || 0} L / ${batch.acidificar.insumos.lecheAcida || 0} L` }]),
        { label: 'pH medido', value: dato(batch.acidificar.insumos.phMezcla) },
        ...(is7Cueros ? [{ label: 'Rango pH', value: phRango7C }] : []),
        ...(isPera
          ? [
              { label: 'Adición cultivo láctico', value: hora(batch.acidificar.phase2.horaAdicionCultivo) },
              { label: 'Cultivo láctico', value: `${cultivoCdtas} cdtas` },
              { label: 'Lote cultivo', value: loteCultivoPera },
            ]
          : []),
        ...(is7Cueros ? [{ label: 'Lote ácido acético', value: loteAcidoAcetico7C }] : []),
      ],
    },
    {
      titulo: is7Cueros ? '2. Agregar Cuajo' : isPera ? '2. Premadurar y Cuajar' : '2. Calentar y Cuajar',
      items: [
        {
          label: 'Adición de cuajo',
          value: hora(
            batch.calentarYCuajar.adicionCuajo?.horaRegistro ||
              batch.acidificar.phase2.horaAdicionCuajo ||
              batch.calentarYCuajar.horaAdicionCuajo
          ),
        },
        { label: 'Cuajado', value: hora(batch.calentarYCuajar.cuajado.horaRegistro) },
        { label: 'Tiempo de cuajado', value: dato(batch.calentarYCuajar.cuajado.tiempoTranscurridoDesdeCuajo) },
        { label: 'Corte finalizado', value: hora(batch.calentarYCuajar.corte.horaRegistro) },
        { label: 'Tiempo de corte', value: dato(batch.calentarYCuajar.corte.tiempoTranscurridoDesdeCuajado) },
        { label: '40 °C alcanzado', value: hora(batch.calentarYCuajar.temperatura40.horaRegistro) },
        { label: 'Tiempo a 40 °C', value: dato(batch.calentarYCuajar.temperatura40.tiempoCalentamiento40) },
        { label: 'Lote cuajo', value: dato(batch.loteCuajo) },
      ],
    },
    {
      titulo: '3. Desuerar y Escurrir',
      items: [
        { label: 'Temp. verificada', value: `${batch.desuerar.temperaturaVerificada.toFixed(1)} °C` },
        { label: 'Hora desuerado', value: hora(batch.desuerar.desuerado.horaRegistro) },
        { label: 'Tiempo desuerado', value: dato(batch.desuerar.desuerado.tiempoDesuerado) },
        { label: 'Inicio escurrido', value: hora(batch.desuerar.escurrido?.horaInicio) },
        { label: 'Tiempo escurrido', value: dato(batch.desuerar.escurrido?.tiempoEscurrido) },
        { label: 'pH escurrido', value: dato(batch.desuerar.escurrido?.phEscurrido) },
      ],
    },
    {
      titulo: isPera ? '4. Hilar y Salmueras' : '4. Hilar y Salar',
      items: [
        { label: 'Prueba de hilado', value: hora(batch.hilar.pruebaHilado.horaRegistro) },
        { label: 'Tiempo desde desuerado', value: dato(batch.hilar.pruebaHilado.tiempoDesdeDesuerado) },
        ...(isPera
          ? [
              { label: 'Sal salmuera caliente', value: `${salCalientePeraG.toLocaleString('es-CO')} g` },
              { label: 'Sal salmuera fría', value: `${salFriaPeraG.toLocaleString('es-CO')} g` },
              { label: 'Sal total', value: `${totalSalPeraG.toLocaleString('es-CO')} g` },
            ]
          : [
              { label: 'Sal agregada', value: `${(batch.hilar.sal?.cantidadGramos || 0).toLocaleString('es-CO')} g` },
              { label: 'Lote sal', value: batch.hilar.sal?.loteSal || batch.loteSal || 'Sin registrar' },
            ]),
        { label: 'Inicio hilado', value: hora(batch.hilar.hiladoEnPaila?.horaInicio) },
        { label: 'Fin hilado', value: hora(batch.hilar.hiladoEnPaila?.horaFin) },
        { label: 'Duración hilado', value: dato(batch.hilar.hiladoEnPaila?.duracion || batch.hilar.extruirYAirear.duracion) },
        {
          label: 'Tiempo total proceso',
          value: batch.hilar.procesoFinalizado?.tiempoTotalProceso || batch.processTimer.formattedTime || '--:--:--',
        },
      ],
    },
    {
      titulo: '5. Moldear y Pesar',
      items: [
        { label: 'Pesado total hilado', value: `${pesadoHiladoKg.toFixed(2)} kg` },
        ...moldesProducto.map((m) => ({ label: m.label, value: kg(m.unidades, m.gramos) })),
        ...(isPera && isMexHabilitado
          ? [
              { label: 'Queso Mexicano', value: `${mexTotalUnidades} u · ${mexTotalKg.toFixed(2)} kg` },
              { label: 'Especias Mexicano', value: `${mexTotalEspeciasG} g` },
            ]
          : []),
        ...(isPera && isFhHabilitado
          ? [
              { label: 'Queso Finas Hierbas', value: `${fhTotalUnidades} u · ${fhTotalKg.toFixed(2)} kg` },
              { label: 'Especias Finas Hierbas', value: `${fhEspeciasConsumidasG} g` },
            ]
          : []),
        ...(isArequipe7C ? [{ label: 'Arequipe utilizado', value: `${arequipeGastadoG} g` }] : []),
        ...(isBocadillo7C ? [{ label: 'Bocadillo utilizado', value: `${bocadillosGastadosU} u · ${bocadilloGastadoG} g` }] : []),
        { label: 'Total moldes', value: `${totalMoldes}` },
        { label: 'Peso final queso', value: `${pesoFinalKg.toFixed(2)} kg` },
        { label: 'Rendimiento', value: rendimientoTexto },
      ],
    },
  ];

  return (
    <ProductionSummaryModal
      isOpen={isOpen}
      onClose={onClose}
      batchId={batch.id}
      productName={batch.productName}
      productBadge={
        is7Cueros
          ? 'Queso 7 Cueros y Quesadillas'
          : isPera
          ? 'Queso Pera y Derivados'
          : isIndustrial
          ? 'Doble Crema Industrial'
          : 'Doble Crema Premium'
      }
      standard="NTC-589"
      icon="fact_check"
      status={batch.status}
      responsable={responsable}
      users={users}
      observaciones={batch.observaciones}
      operariosIntervinientes={batch.operariosIntervinientes}
      actividadOperarios={batch.actividadOperarios}
      onFinalizeBatch={onFinalizeBatch}
      onChangeObservaciones={onChangeObservaciones}
      onChangeOperariosIntervinientes={onChangeOperariosIntervinientes}
      observacionesPlaceholder="Registre observaciones, desviaciones menores, ajustes de dosificación o incidencias técnicas del proceso..."
      constanciaTexto="Todos los tiempos, temperaturas, pH, insumos, moldeo y balance de masas del lote"
      etapas={etapas}
      resumen={
        <>
          <SummaryMetricsRow
            leche={{
              label: '1. Leche Utilizada',
              value: `${totalLecheUsada} L`,
              sub:
                isPera || is7Cueros
                  ? `${batch.acidificar.insumos.lecheFresca || totalLecheUsada} L fresca`
                  : isIndustrial
                  ? `${totalLecheUsada} L fresca en tina`
                  : `${batch.acidificar.insumos.lecheFresca || 0} L fresca · ${batch.acidificar.insumos.lecheAcida || 0} L ácida`,
            }}
            producido={{
              label: '2. Total Producido',
              value: `${pesoRendimientoKg.toFixed(2)} kg`,
              sub: `${totalMoldes} moldes${isPera && mexTotalUnidades + fhTotalUnidades > 0 ? ` + ${mexTotalUnidades + fhTotalUnidades} derivados` : ''}`,
            }}
            rendimiento={{ value: rendimientoTexto, sub: 'Kg de queso por cada 100 L de leche' }}
          />

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
                      {batch.acidificar.insumos.lecheAcida || 0} L volumen
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
                    {batch.acidificar.insumos.lecheFresca || 0} L volumen
                  </span>
                </div>
                <div className="bg-white p-2 rounded-lg border border-blue-200 flex flex-col justify-between">
                  <span className="text-[10px] text-[#434655] font-bold uppercase">
                    Lote Cuajo (Coagulante):
                  </span>
                  <span className="font-bold text-blue-900 font-mono text-xs mt-0.5">
                    {batch.loteCuajo || 'Sin registrar'}
                  </span>
                  <span className="text-[10px] text-blue-700 font-semibold">1.2 g / 100 L</span>
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

          {!is7Cueros && (
            <SummarySection
              title={isPera ? 'Producción de Queso Pera por Molde' : 'Producción por Molde'}
              icon="scale"
              aside={
                <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  {pesoFinalKg.toFixed(2)} kg · {totalMoldes} moldes
                </span>
              }
            >
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
                {moldesProducto.map((m) => (
                  <div key={m.label} className="p-3 rounded-xl border border-[#D6DEEA] bg-white">
                    <span className="text-[10px] uppercase font-bold text-gray-500 block">{m.label}</span>
                    <span className="text-base font-black text-[#1B4E9B] block mt-0.5">{m.unidades} u</span>
                    <span className="text-[10px] text-gray-500 block">
                      {(m.unidades * m.gramos).toLocaleString('es-CO')} g ({((m.unidades * m.gramos) / 1000).toFixed(2)} kg)
                    </span>
                  </div>
                ))}
              </div>
            </SummarySection>
          )}

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
        </>
      }
    />
  );
};
