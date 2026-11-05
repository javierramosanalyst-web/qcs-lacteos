import type { YogurBatchData, YogurGriegoBatchData } from '../../../types';

/**
 * Herencia Yogur -> Yogur Griego.
 *
 * El Griego sale de la MISMA leche del Yogur sin azúcar: comparte Pasteurización
 * e Inoculación/Incubación. Por eso esas dos etapas se copian completas
 * (horas, temperaturas, pH, acidez, lotes, cultivo, cronómetros) y solo cambia
 * la cantidad de leche, que es la que se desvió al Griego.
 *
 * La cantidad de cultivo se reparte en proporción a los litros desviados
 * (el cultivo se agregó a toda la leche, al Griego le corresponde su parte).
 */
export function heredarEtapasDeYogur(
  griego: YogurGriegoBatchData,
  yogur: YogurBatchData,
  litrosGriego: number,
  volumenTotalInoculado: number
): Pick<YogurGriegoBatchData, 'pasteurizacion' | 'inoculacion'> {
  const p = yogur.pasteurizacion;
  const i = yogur.inoculacion;
  const proporcion =
    volumenTotalInoculado > 0 ? litrosGriego / volumenTotalInoculado : 0;
  const cucharadas = Number(
    ((i.cantidadCultivoCucharadas || 0) * proporcion).toFixed(2)
  );
  const gramos =
    i.cantidadCultivoGramos !== undefined
      ? Number((i.cantidadCultivoGramos * proporcion).toFixed(2))
      : griego.inoculacion.cantidadCultivoGramos;

  return {
    pasteurizacion: {
      ...griego.pasteurizacion,
      loteYogurSinAzucar: yogur.id,
      litrosLeche: litrosGriego,
      loteLeche: p.loteLeche,
      acidezDornic: p.acidezDornic ?? griego.pasteurizacion.acidezDornic,
      phRecepcion: p.phRecepcion ?? griego.pasteurizacion.phRecepcion,
      temperaturaRecepcion: p.temperaturaRecepcion,
      calentamiento: {
        iniciado: p.calentamiento.iniciado,
        completado: p.calentamiento.completado,
        horaInicio: p.calentamiento.horaInicio,
        horaFin: p.calentamiento.horaFin,
        timestampInicio: p.calentamiento.timestampInicio,
        temperaturaConsigna: p.calentamiento.temperaturaConsigna,
        temperaturaAlcanzada: p.calentamiento.temperaturaAlcanzada,
        tiempoCalentamiento: p.calentamiento.tiempoCalentamiento,
        llego85a90: p.calentamiento.llego85a90 ?? p.calentamiento.completado,
        horaLlegada85a90:
          p.calentamiento.horaLlegada85a90 ?? p.calentamiento.horaFin,
        esManual: p.calentamiento.esManual,
      },
      sostenimiento: { ...p.sostenimiento },
      enfriamiento: {
        enfriamientoIniciado: p.enfriamiento.enfriamientoIniciado,
        enfriamientoCompletado: p.enfriamiento.enfriamientoCompletado,
        horaInicio:
          p.enfriamiento.horaInicio ?? p.enfriamiento.horaInicioEnfriamiento ?? null,
        horaFinEnfriamiento: p.enfriamiento.horaFinEnfriamiento,
        timestampInicioEnfriamiento: p.enfriamiento.timestampInicioEnfriamiento,
        temperaturaFinal: p.enfriamiento.temperaturaFinal,
        tiempoEnfriamiento: p.enfriamiento.tiempoEnfriamiento,
        esManual: p.enfriamiento.esManual,
      },
      trasiego: { ...p.trasiego },
    },
    inoculacion: {
      ...griego.inoculacion,
      temperaturaVerificada45: i.temperaturaVerificada45,
      temperaturaConfirmada: i.temperaturaConfirmada,
      loteCultivo: i.loteCultivo || p.loteCultivoLacticoPastur || '',
      cepasCultivo: i.cepasProbioticas,
      cantidadCultivoCucharadas: cucharadas,
      cantidadCultivoGramos: gramos,
      tiempoMezcladoMinutos: i.tiempoMezcladoMinutos,
      mezcladoConfirmado: i.mezcladoConfirmado,
      inoculacionConfirmada: i.inoculacionConfirmada,
      horaInoculacion: i.horaInoculacion,
      incubacion: {
        iniciada: i.incubacion.iniciada,
        completada: i.incubacion.completada,
        horaInicio: i.incubacion.horaInicio,
        horaFin: i.incubacion.horaFin,
        timestampInicio: i.incubacion.timestampInicio,
        tiempoTranscurrido: i.incubacion.tiempoTranscurrido,
        duracionObjetivoHoras: i.incubacion.duracionObjetivoHoras,
        temperaturaIncubacion: i.incubacion.temperaturaCamara,
        phFinalIncubacion: i.incubacion.phFinalIncubacion,
        consistenciaCoagulo: i.incubacion.consistenciaCoagulo,
        esManual: i.incubacion.esManual,
      },
    },
  };
}
