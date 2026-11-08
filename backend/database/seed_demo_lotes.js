/* ============================================================================
 * QCS PRO LÁCTEOS · DATOS DE PRUEBA DE LOTES (SOLO DESARROLLO)
 *
 * Crea lotes de demostración para los 7 productos, en distintos estados, con su
 * estado_ui completo para poder abrir el resumen, el historial y el panel.
 *
 * USO (desde la carpeta backend):
 *   node database/seed_demo_lotes.js
 *   node database/seed_demo_lotes.js --limpiar   (borra solo los lotes DEMO-)
 *
 * Requiere: init.sql + seed.sql + seed_demo.sql y backend/.env con DATABASE_URL.
 * Idempotente: si el lote ya existe (codigo_lote) no se duplica.
 * NO ejecutar en producción.
 * ========================================================================== */
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { Pool } = require('pg');

const PREFIJO = 'DEMO-';
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const esObjeto = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

function mezclar(base, cambios) {
  if (!esObjeto(cambios)) return cambios;
  const salida = Array.isArray(base) ? [...base] : { ...(base || {}) };
  for (const [clave, valor] of Object.entries(cambios)) {
    salida[clave] = esObjeto(valor) && esObjeto(salida[clave]) ? mezclar(salida[clave], valor) : valor;
  }
  return salida;
}

const hora = (h, m = 0) => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;

const etapasCompletas = (etapas, hasta) => {
  const salida = {};
  etapas.forEach((e, i) => {
    salida[e] = i < hasta ? 'completada' : i === hasta ? 'en_proceso' : 'pendiente';
  });
  return salida;
};

const ETAPAS = {
  'prod-doble-crema-premium': ['acidificar', 'calentar-y-cuajar', 'desuerar', 'hilar', 'moldeo'],
  'prod-doble-crema-industrial': ['acidificar', 'calentar-y-cuajar', 'desuerar', 'hilar', 'moldeo'],
  'prod-queso-pera': ['acidificar', 'calentar-y-cuajar', 'desuerar', 'hilar', 'moldeo'],
  'prod-queso-7-cueros': ['acidificar', 'calentar-y-cuajar', 'desuerar', 'hilar', 'moldeo'],
  'prod-yogur': ['acidificar', 'calentar-y-cuajar', 'desuerar', 'hilar', 'moldeo'],
  'prod-kumis': ['acidificar', 'calentar-y-cuajar', 'moldeo'],
  'prod-yogur-griego': ['acidificar', 'calentar-y-cuajar', 'desuerar', 'hilar', 'moldeo'],
};

// Kumis y Griego nacen de un Yogur: se declara el yogur de origen para que el
// estado_ui traiga `origenYogur` y el backend enlace lote_origen_id / lote_padre_id.
const origenYogur = (yogurId, litros, horaDesvio, desvioTotal = false) => ({
  yogurId,
  yogurProductUiId: 'prod-yogur',
  litros,
  hora: horaDesvio,
  desvioTotal,
});

const timerCompleto = (inicio, fin) => ({
  isRunning: false,
  isCompleted: true,
  startTime: inicio,
  startTimestamp: null,
  elapsedSeconds: 3600,
  formattedTime: fin,
});

const LOTES = [
  {
    codigo: 'DEMO-QDC-PREM-001',
    producto: 'QDC-PREM',
    ui: 'prod-doble-crema-premium',
    estado: 'COMPLETADO',
    etapa: 'moldeo',
    litros: 600,
    dias: 2,
    responsable: 'OP-104',
    operarios: ['OP-104', 'OP-105'],
    overrides: {
      status: 'COMPLETADO',
      lotesLeche: { loteLeche1: 'LCH-DEMO-001', litrosLote1: 400, loteLeche2: 'LCH-DEMO-002', litrosLote2: 200, loteLecheBase: 'LCH-DEMO-001' },
      loteCuajo: 'CUA-DEMO-001',
      loteSal: 'SAL-DEMO-001',
      stageStatuses: etapasCompletas(ETAPAS['prod-doble-crema-premium'], 5),
      processTimer: timerCompleto(hora(6), '04:10:00'),
      acidificar: { insumos: { lecheFresca: 600, lecheAcida: 0, phMezcla: 6.4 } },
      hilar: { pesoTotalQueso: 78.5, numeroMoldes: 196, procesoFinalizado: true },
      moldesDesglose: { moldes100g: 40, moldes200g: 60, moldes400g: 60, moldes800g: 30, moldes1600g: 6, pesadoTotalHiladoKg: 78.5, pesoTotalCalculadoKg: 78.4, esPesoManual: false },
    },
  },
  {
    codigo: 'DEMO-QDC-IND-001',
    producto: 'QDC-IND',
    ui: 'prod-doble-crema-industrial',
    estado: 'EN_PROCESO',
    etapa: 'desuerar',
    litros: 900,
    dias: 0,
    responsable: 'OP-105',
    operarios: ['OP-105'],
    overrides: {
      status: 'EN_PROCESO',
      lotesLeche: { loteLeche1: 'LCH-DEMO-002', litrosLote1: 900, loteLecheBase: 'LCH-DEMO-002' },
      loteCuajo: 'CUA-DEMO-002',
      loteSal: 'SAL-DEMO-002',
      stageStatuses: etapasCompletas(ETAPAS['prod-doble-crema-industrial'], 2),
      processTimer: { isRunning: true, isCompleted: false, startTime: hora(7), startTimestamp: null, elapsedSeconds: 5400, formattedTime: '01:30:00' },
      acidificar: { insumos: { lecheFresca: 900, lecheAcida: 0, phMezcla: 6.5 } },
    },
  },
  {
    codigo: 'DEMO-QP-001',
    producto: 'QP-2026',
    ui: 'prod-queso-pera',
    estado: 'COMPLETADO',
    etapa: 'moldeo',
    litros: 500,
    dias: 5,
    responsable: 'OP-104',
    operarios: ['OP-104', 'OP-106'],
    overrides: {
      status: 'COMPLETADO',
      lotesLeche: { loteLeche1: 'LCH-DEMO-001', litrosLote1: 500, loteLecheBase: 'LCH-DEMO-001' },
      loteCuajo: 'CUA-DEMO-001',
      loteSal: 'SAL-DEMO-001',
      stageStatuses: etapasCompletas(ETAPAS['prod-queso-pera'], 5),
      processTimer: timerCompleto(hora(5, 30), '03:45:00'),
      hilar: { pesoTotalQueso: 62.0, numeroMoldes: 180, procesoFinalizado: true },
      moldesDesglose: { moldesPeraGrande350g: 150, moldesPeraPequeno60g: 30, pesadoTotalHiladoKg: 62.0, pesoTotalCalculadoKg: 54.3, esPesoManual: false },
      derivaciones: {
        mexicano: { habilitado: true, moldes100g: 20, moldes200g: 15, moldes350g: 10 },
        finasHierbas: { habilitado: true, moldes100g: 12, moldes200g: 8, moldes350g: 6, pesoInicialGramos: 500, pesoFinalGramos: 380 },
      },
    },
  },
  {
    codigo: 'DEMO-Q7C-001',
    producto: 'Q7C-2026',
    ui: 'prod-queso-7-cueros',
    estado: 'EN_PROCESO',
    etapa: 'hilar',
    litros: 400,
    dias: 0,
    responsable: 'OP-106',
    operarios: ['OP-106'],
    overrides: {
      status: 'EN_PROCESO',
      lotesLeche: { loteLeche1: 'LCH-DEMO-002', litrosLote1: 400, loteLecheBase: 'LCH-DEMO-002' },
      loteCuajo: 'CUA-DEMO-002',
      loteSal: 'SAL-DEMO-002',
      stageStatuses: etapasCompletas(ETAPAS['prod-queso-7-cueros'], 3),
      processTimer: { isRunning: true, isCompleted: false, startTime: hora(8), startTimestamp: null, elapsedSeconds: 7200, formattedTime: '02:00:00' },
    },
  },
  {
    codigo: 'DEMO-YOG-001',
    producto: 'YOG-101',
    ui: 'prod-yogur',
    estado: 'COMPLETADO',
    etapa: 'moldeo',
    litros: 200,
    dias: 1,
    responsable: 'OP-104',
    operarios: ['OP-104', 'OP-105'],
    overrides: {
      status: 'COMPLETADO',
      stageStatuses: etapasCompletas(ETAPAS['prod-yogur'], 5),
      processTimer: timerCompleto(hora(4), '09:20:00'),
      pasteurizacion: {
        litrosLeche: 200,
        loteLeche: 'LCH-DEMO-001',
        llevaAzucar: true,
        azucarElegido: true,
        azucar: { adicionado: true, horaAdicion: hora(4, 20), cantidadKg: 16, loteAzucar: 'AZU-DEMO-001', esManual: false },
        calentamiento: { iniciado: true, completado: true, horaInicio: hora(4), horaFin: hora(4, 40), temperaturaAlcanzada: 88, llego85a90: true, horaLlegada85a90: hora(4, 35), tiempoCalentamiento: '40 min', esManual: false },
        sostenimiento: { iniciado: true, completado: true, horaInicio: hora(4, 40), horaFin: hora(4, 55), duracionReal: '15 min' },
        enfriamiento: { enfriamientoIniciado: true, enfriamientoCompletado: true, horaInicio: hora(4, 55), horaFinEnfriamiento: hora(5, 25), temperaturaFinal: 45, tiempoEnfriamiento: '30 min', esManual: false },
        trasiego: { iniciado: true, completado: true, horaInicio: hora(5, 25), horaFin: hora(5, 40), tiempoTrasiego: '15 min' },
      },
      inoculacion: {
        temperaturaConfirmada: true,
        loteCultivo: 'CUL-DEMO-001',
        cantidadCultivoGramos: 5,
        cantidadCultivoCucharadas: 5,
        mezcladoConfirmado: true,
        horaInicioMezclado: hora(5, 45),
        inoculacionConfirmada: true,
        horaInoculacion: hora(5, 50),
        incubacion: { iniciada: true, completada: true, horaInicio: hora(6), horaFin: hora(14), temperaturaIncubacion: 45, phFinal: 4.55 },
      },
      maduracionFrio: {
        trasladoCantinas: { iniciado: true, completado: true, horaInicio: hora(14), horaFin: hora(14, 20) },
        refrigeracion: { iniciada: true, completada: true, horaInicio: hora(14, 20), horaFin: hora(22, 20), temperatura: 4 },
      },
      batidoYAdiciones: {
        batidora: { iniciado: true, completado: true, horaInicio: hora(22, 30), horaFin: hora(22, 55), velocidadRpm: 35, tiempoBatido: '25 min', esManual: false },
        salidaCuartoFrio: { hora: hora(22, 25), confirmada: true },
        adiciones: {
          recetaConfirmada: true,
          registrado: true,
          horaRegistro: hora(22, 40),
          variedadAzucar: { loteAzucar: 'AZU-DEMO-001', gramosAzucar: 16000, llevaSaborizante: true, sabor: 'Fresa', saborizanteMl: 1200, loteSaborizante: 'SAB-DEMO-001' },
        },
        lotesSabor: [
          { id: 'fresa', sabor: 'Fresa', batidoInicio: hora(22, 30), batidoFin: hora(22, 55), envasadoInicio: hora(22, 30), envasadoFin: hora(22, 55), tiempoBatido: '25 min', tiempoEnvasado: '25 min', tiempoTotal: '25 min' },
        ],
      },
      envasado: {
        loteProductoTerminado: 'YOG-101-DEMO-001',
        fechaVencimiento: null,
        temperaturaEnvasado: 12,
        formatos: { botella200ml: 240, botella1L: 90, botella2L: 20, bolsa4L: 6 },
        selladoVerificado: true,
        rotuladoCumpleNTC805: true,
        almacenamientoCuartoFrio: { ingresado: true, horaIngreso: hora(23, 30), temperaturaAlmacenamiento: 4, tiempoEstabilizacion: '24 horas (1 día)' },
        procesoFinalizado: true,
      },
    },
  },
  {
    codigo: 'DEMO-YOG-002',
    producto: 'YOG-101',
    ui: 'prod-yogur',
    estado: 'EN_PROCESO',
    etapa: 'hilar',
    litros: 150,
    dias: 0,
    responsable: 'OP-105',
    operarios: ['OP-105'],
    overrides: {
      status: 'EN_PROCESO',
      stageStatuses: etapasCompletas(ETAPAS['prod-yogur'], 3),
      processTimer: { isRunning: true, isCompleted: false, startTime: hora(5), startTimestamp: null, elapsedSeconds: 10800, formattedTime: '03:00:00' },
      pasteurizacion: {
        litrosLeche: 150,
        loteLeche: 'LCH-DEMO-002',
        llevaAzucar: false,
        azucarElegido: true,
        calentamiento: { iniciado: true, completado: true, horaInicio: hora(5), horaFin: hora(5, 40), temperaturaAlcanzada: 88, llego85a90: true, horaLlegada85a90: hora(5, 35), tiempoCalentamiento: '40 min' },
        sostenimiento: { iniciado: true, completado: true, horaInicio: hora(5, 40), horaFin: hora(5, 55), duracionReal: '15 min' },
        enfriamiento: { enfriamientoIniciado: true, enfriamientoCompletado: true, horaInicio: hora(5, 55), horaFinEnfriamiento: hora(6, 25), temperaturaFinal: 45, tiempoEnfriamiento: '30 min' },
        trasiego: { iniciado: true, completado: true, horaInicio: hora(6, 25), horaFin: hora(6, 40), tiempoTrasiego: '15 min' },
      },
      inoculacion: { temperaturaConfirmada: true, loteCultivo: 'CUL-DEMO-002', cantidadCultivoGramos: 4, mezcladoConfirmado: true, inoculacionConfirmada: true, horaInoculacion: hora(6, 50) },
      maduracionFrio: { refrigeracion: { iniciada: true, completada: true, horaInicio: hora(15), horaFin: hora(23), temperatura: 4 } },
      batidoYAdiciones: {
        salidaCuartoFrio: { hora: hora(23, 5), confirmada: true },
        adiciones: { recetaConfirmada: true, registrado: true, horaRegistro: hora(23, 10), variedadEstevia: { loteEstevia: 'EST-DEMO-001', gramosEstevia: 900, horaAdicion: hora(23, 12) } },
      },
    },
  },
  {
    codigo: 'DEMO-YOG-003',
    producto: 'YOG-101',
    ui: 'prod-yogur',
    estado: 'EN_PROCESO',
    etapa: 'hilar',
    litros: 240,
    dias: 0,
    responsable: 'OP-105',
    operarios: ['OP-105'],
    overrides: {
      status: 'NOMINAL',
      stageStatuses: etapasCompletas(ETAPAS['prod-yogur'], 3),
      processTimer: { isRunning: true, isCompleted: false, startTime: hora(4), startTimestamp: null, elapsedSeconds: 16200, formattedTime: '04:30:00' },
      pasteurizacion: {
        litrosLeche: 240,
        loteLeche: 'LCH-DEMO-002',
        llevaAzucar: true,
        azucarElegido: true,
        azucar: { adicionado: true, horaAdicion: hora(4, 20), cantidadKg: 19.2, loteAzucar: 'AZU-DEMO-001', esManual: false },
        calentamiento: { iniciado: true, completado: true, horaInicio: hora(4), horaFin: hora(4, 40), temperaturaAlcanzada: 88, llego85a90: true, horaLlegada85a90: hora(4, 35), tiempoCalentamiento: '40 min' },
        sostenimiento: { iniciado: true, completado: true, horaInicio: hora(4, 40), horaFin: hora(4, 55), duracionReal: '15 min' },
        enfriamiento: { enfriamientoIniciado: true, enfriamientoCompletado: true, horaInicio: hora(4, 55), horaFinEnfriamiento: hora(5, 25), temperaturaFinal: 45, tiempoEnfriamiento: '30 min' },
        trasiego: { iniciado: true, completado: true, horaInicio: hora(5, 25), horaFin: hora(5, 40), tiempoTrasiego: '15 min' },
        divisionLeche: { litrosYogurConAzucar: 240, litrosKumis: 80, litrosYogurSinAzucar: 0, litrosYogurGriego: 120 },
      },
      inoculacion: { temperaturaConfirmada: true, loteCultivo: 'CUL-DEMO-002', cantidadCultivoGramos: 6, mezcladoConfirmado: true, inoculacionConfirmada: true, horaInoculacion: hora(5, 50), incubacion: { iniciada: true, completada: true, horaInicio: hora(6), horaFin: hora(14), temperaturaIncubacion: 45, phFinal: 4.55 } },
      maduracionFrio: { refrigeracion: { iniciada: true, completada: true, horaInicio: hora(14), horaFin: hora(22), temperatura: 4 } },
      batidoYAdiciones: {
        salidaCuartoFrio: { hora: hora(22, 5), confirmada: true },
        adiciones: { recetaConfirmada: true, registrado: true, horaRegistro: hora(22, 10), variedadAzucar: { loteAzucar: 'AZU-DEMO-001', gramosAzucar: 19200 } },
      },
    },
  },
  {
    codigo: 'DEMO-KUM-001',
    producto: 'KUM-102',
    ui: 'prod-kumis',
    estado: 'COMPLETADO',
    etapa: 'moldeo',
    litros: 80,
    dias: 3,
    responsable: 'OP-106',
    operarios: ['OP-106', 'OP-104'],
    overrides: {
      status: 'COMPLETADO',
      origenYogur: origenYogur('DEMO-YOG-003', 80, hora(5, 40)),
      stageStatuses: etapasCompletas(ETAPAS['prod-kumis'], 3),
      processTimer: timerCompleto(hora(6), '08:30:00'),
      pasteurizacion: {
        litrosLeche: 80,
        loteLeche: 'LCH-DEMO-001',
        llevaAzucar: true,
        azucarElegido: true,
        azucar: { adicionado: true, horaAdicion: hora(6, 15), cantidadKg: 6.4, loteAzucar: 'AZU-DEMO-002', esManual: false },
        calentamiento: { iniciado: true, completado: true, horaInicio: hora(6), horaFin: hora(6, 35), temperaturaAlcanzada: 88, llego85a90: true, horaLlegada85a90: hora(6, 30), tiempoCalentamiento: '35 min' },
        sostenimiento: { iniciado: true, completado: true, horaInicio: hora(6, 35), horaFin: hora(6, 50), duracionReal: '15 min' },
        enfriamiento: { enfriamientoIniciado: true, enfriamientoCompletado: true, horaInicio: hora(6, 50), horaFinEnfriamiento: hora(7, 20), temperaturaFinal: 35, tiempoEnfriamiento: '30 min' },
        trasiego: { iniciado: true, completado: true, horaInicio: hora(7, 20), horaFin: hora(7, 35), tiempoTrasiego: '15 min' },
      },
      inoculacion: { temperaturaConfirmada: true, loteCultivo: 'CUL-DEMO-001', cantidadCultivoGramos: 2, mezcladoConfirmado: true, inoculacionConfirmada: true, horaInoculacion: hora(7, 40), incubacion: { iniciada: true, completada: true, horaInicio: hora(7, 45), horaFin: hora(15, 45), temperaturaIncubacion: 35, phFinal: 4.6 } },
      maduracionFrio: { refrigeracion: { iniciada: true, completada: true, horaInicio: hora(15, 45), horaFin: hora(23, 45), temperatura: 4 } },
      batidoYAdiciones: {
        batidora: { iniciado: true, completado: true, horaInicio: hora(23, 50), horaFin: hora(0, 10), velocidadRpm: 30, tiempoBatido: '20 min', esManual: false },
        adiciones: { recetaConfirmada: true, registrado: true, horaRegistro: hora(0, 5), variedadAzucar: { loteAzucar: 'AZU-DEMO-002', gramosAzucar: 6400 } },
      },
      envasado: {
        loteProductoTerminado: 'KUM-102-DEMO-001',
        temperaturaEnvasado: 10,
        formatos: { botella1L: 60, botella2L: 8 },
        selladoVerificado: true,
        rotuladoCumpleNTC805: true,
        almacenamientoCuartoFrio: { ingresado: true, horaIngreso: hora(0, 40), temperaturaAlmacenamiento: 4, tiempoEstabilizacion: '24 horas (1 día)' },
        procesoFinalizado: true,
      },
    },
  },
  {
    codigo: 'DEMO-KUM-002',
    producto: 'KUM-102',
    ui: 'prod-kumis',
    estado: 'EN_PROCESO',
    etapa: 'moldeo',
    litros: 60,
    dias: 0,
    responsable: 'OP-104',
    operarios: ['OP-104'],
    overrides: {
      status: 'EN_PROCESO',
      origenYogur: origenYogur('DEMO-YOG-003', 60, hora(5, 40)),
      stageStatuses: etapasCompletas(ETAPAS['prod-kumis'], 2),
      processTimer: { isRunning: true, isCompleted: false, startTime: hora(6), startTimestamp: null, elapsedSeconds: 9000, formattedTime: '02:30:00' },
      pasteurizacion: {
        litrosLeche: 60,
        loteLeche: 'LCH-DEMO-002',
        llevaAzucar: true,
        azucarElegido: true,
        azucar: { adicionado: true, horaAdicion: hora(6, 15), cantidadKg: 4.8, loteAzucar: 'AZU-DEMO-001', esManual: false },
        calentamiento: { iniciado: true, completado: true, horaInicio: hora(6), horaFin: hora(6, 35), temperaturaAlcanzada: 88, llego85a90: true, horaLlegada85a90: hora(6, 30), tiempoCalentamiento: '35 min' },
        sostenimiento: { iniciado: true, completado: true, horaInicio: hora(6, 35), horaFin: hora(6, 50), duracionReal: '15 min' },
        enfriamiento: { enfriamientoIniciado: true, enfriamientoCompletado: true, horaInicio: hora(6, 50), horaFinEnfriamiento: hora(7, 20), temperaturaFinal: 35, tiempoEnfriamiento: '30 min' },
        trasiego: { iniciado: true, completado: true, horaInicio: hora(7, 20), horaFin: hora(7, 35), tiempoTrasiego: '15 min' },
      },
      inoculacion: { temperaturaConfirmada: true, loteCultivo: 'CUL-DEMO-002', cantidadCultivoGramos: 1.5, mezcladoConfirmado: true, inoculacionConfirmada: true, horaInoculacion: hora(7, 40) },
    },
  },
  {
    codigo: 'DEMO-YGR-001',
    producto: 'YGR-103',
    ui: 'prod-yogur-griego',
    estado: 'COMPLETADO',
    etapa: 'moldeo',
    litros: 200,
    dias: 4,
    responsable: 'OP-105',
    operarios: ['OP-105', 'OP-106'],
    overrides: {
      status: 'COMPLETADO',
      origenYogur: origenYogur('DEMO-YOG-003', 120, hora(22)),
      stageStatuses: etapasCompletas(ETAPAS['prod-yogur-griego'], 5),
      processTimer: timerCompleto(hora(4), '18:00:00'),
      pasteurizacion: {
        litrosLeche: 200,
        loteLeche: 'LCH-DEMO-001',
        llevaAzucar: false,
        azucarElegido: true,
        calentamiento: { iniciado: true, completado: true, horaInicio: hora(4), horaFin: hora(4, 40), temperaturaAlcanzada: 88, llego85a90: true, horaLlegada85a90: hora(4, 35), tiempoCalentamiento: '40 min' },
        sostenimiento: { iniciado: true, completado: true, horaInicio: hora(4, 40), horaFin: hora(4, 55), duracionReal: '15 min' },
        enfriamiento: { enfriamientoIniciado: true, enfriamientoCompletado: true, horaInicio: hora(4, 55), horaFinEnfriamiento: hora(5, 25), temperaturaFinal: 45, tiempoEnfriamiento: '30 min' },
        trasiego: { iniciado: true, completado: true, horaInicio: hora(5, 25), horaFin: hora(5, 40), tiempoTrasiego: '15 min' },
      },
      inoculacion: { temperaturaConfirmada: true, loteCultivo: 'CUL-DEMO-001', cantidadCultivoGramos: 5, mezcladoConfirmado: true, inoculacionConfirmada: true, horaInoculacion: hora(5, 50), incubacion: { iniciada: true, completada: true, horaInicio: hora(6), horaFin: hora(14), temperaturaIncubacion: 45, phFinal: 4.55 } },
      maduracionYFiltrado: {
        cuartoFrio: { iniciado: true, completado: true, horaInicio: hora(14), horaFin: hora(22), temperatura: 4 },
        filtradoTelas: { iniciado: true, completado: true, horaInicio: hora(22), horaFin: hora(6), tiempoFiltrado: '8 h 0 min' },
      },
      batidoYAdiciones: {
        batido: { iniciado: true, completado: true, horaInicio: hora(6, 10), horaFin: hora(6, 35), velocidadRpm: 35, tiempoBatido: '25 min', esManual: false },
        formulacion: {
          llevaStevia: true,
          tipo: 'dos_variedades',
          variedadSinEstevia: { masaKg: 11.24, nota: 'Griego natural' },
          variedadConEstevia: { masaKg: 11.24, gramosEstevia: 2544, loteEstevia: 'EST-DEMO-001', horaAdicion: hora(6, 30), confirmado: true },
          registrado: true,
          horaRegistro: hora(6, 32),
        },
      },
      envasado: {
        loteProductoTerminado: 'YGR-103-DEMO-001',
        temperaturaEnvasado: 8,
        formatosSinEstevia: { tarrina1000g: 8, tarrina500g: 4, tarrina120g: 10 },
        formatosConEstevia: { tarrina1000g: 8, tarrina500g: 4, tarrina120g: 10 },
        selladoHermeticoVerificado: true,
        rotuladoCumpleNTC805: true,
        almacenamientoCuartoFrio: { ingresado: true, horaIngreso: hora(7, 30), temperaturaAlmacenamiento: 4, tiempoEstabilizacion: '24 horas (1 día)' },
        procesoFinalizado: true,
      },
    },
  },
  {
    codigo: 'DEMO-YGR-002',
    producto: 'YGR-103',
    ui: 'prod-yogur-griego',
    estado: 'EN_PROCESO',
    etapa: 'desuerar',
    litros: 120,
    dias: 0,
    responsable: 'OP-106',
    operarios: ['OP-106'],
    overrides: {
      status: 'EN_PROCESO',
      origenYogur: origenYogur('DEMO-YOG-003', 120, hora(22)),
      stageStatuses: etapasCompletas(ETAPAS['prod-yogur-griego'], 2),
      processTimer: { isRunning: true, isCompleted: false, startTime: hora(5), startTimestamp: null, elapsedSeconds: 14400, formattedTime: '04:00:00' },
      pasteurizacion: {
        litrosLeche: 120,
        loteLeche: 'LCH-DEMO-002',
        llevaAzucar: false,
        azucarElegido: true,
        calentamiento: { iniciado: true, completado: true, horaInicio: hora(5), horaFin: hora(5, 40), temperaturaAlcanzada: 88, llego85a90: true, horaLlegada85a90: hora(5, 35), tiempoCalentamiento: '40 min' },
        sostenimiento: { iniciado: true, completado: true, horaInicio: hora(5, 40), horaFin: hora(5, 55), duracionReal: '15 min' },
        enfriamiento: { enfriamientoIniciado: true, enfriamientoCompletado: true, horaInicio: hora(5, 55), horaFinEnfriamiento: hora(6, 25), temperaturaFinal: 45, tiempoEnfriamiento: '30 min' },
        trasiego: { iniciado: true, completado: true, horaInicio: hora(6, 25), horaFin: hora(6, 40), tiempoTrasiego: '15 min' },
      },
      inoculacion: { temperaturaConfirmada: true, loteCultivo: 'CUL-DEMO-002', cantidadCultivoGramos: 3, mezcladoConfirmado: true, inoculacionConfirmada: true, horaInoculacion: hora(6, 50) },
      maduracionYFiltrado: { cuartoFrio: { iniciado: true, completado: false, horaInicio: hora(15), horaFin: null, temperatura: 4 } },
    },
  },
];

const PADRES = [
  { codigo: 'DEMO-LP-001', linea: 'L-HILADA-01', total: 1200, asignado: 900, remanente: 300, proveedor: 'Finca La Esperanza', lote: 'LCH-DEMO-001', dias: 2, temp: 4.2, acidez: 16, ph: 6.6 },
  { codigo: 'DEMO-LP-002', linea: 'L-FERMENT-02', total: 800, asignado: 610, remanente: 190, proveedor: 'Hacienda El Roble', lote: 'LCH-DEMO-002', dias: 1, temp: 4.5, acidez: 15, ph: 6.5 },
];

async function limpiar(client) {
  const { rows } = await client.query(
    `SELECT lp.id, lp.codigo_lote
       FROM lotes_produccion lp
      WHERE lp.codigo_lote LIKE $1
        AND lp.estado IN ('EN_PROCESO', 'PENDIENTE')
        AND NOT EXISTS (SELECT 1 FROM auditoria_rectificaciones ar WHERE ar.lote_id = lp.id);`,
    [`${PREFIJO}%`]
  );
  const ids = rows.map((r) => r.id);
  if (ids.length > 0) {
    // El desvío Yogur → Kumis/Griego referencia ambos lotes: se borra primero el registro del desvío.
    await client.query(
      `DELETE FROM lote_extracciones_sublote
        WHERE lote_origen_id = ANY($1::uuid[]) OR lote_destino_id = ANY($1::uuid[]);`,
      [ids]
    );
    await client.query(`DELETE FROM lotes_produccion WHERE id = ANY($1::uuid[]);`, [ids]);
  }
  const retenidos = await client.query(
    `SELECT lp.codigo_lote, lp.estado FROM lotes_produccion lp
      WHERE lp.codigo_lote LIKE $1 ORDER BY lp.codigo_lote;`,
    [`${PREFIJO}%`]
  );
  await client.query(`DELETE FROM lotes_padre WHERE codigo_lote LIKE $1;`, [`${PREFIJO}%`]);
  console.log(`Limpieza: ${ids.length} lotes DEMO en proceso eliminados.`);
  if (retenidos.rowCount > 0) {
    console.log(
      `Conservados por trazabilidad (lotes cerrados o auditados son de solo lectura): ${retenidos.rows
        .map((r) => `${r.codigo_lote} (${r.estado})`)
        .join(', ')}.`
    );
  }
}

async function main() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (process.argv.includes('--limpiar')) {
      await limpiar(client);
      await client.query('COMMIT');
      return;
    }

    await client.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto;`);
    await client.query(
      `INSERT INTO usuarios (codigo_empleado, nombre_completo, rol, turno, pin_hash, password_hash, linea_asignada_id)
       VALUES
         ('ADM-902', 'Ing. Paola Restrepo',  'administrador', 'Jornada Continua',
            crypt('9091', gen_salt('bf', 10)), crypt('admin', gen_salt('bf', 10)), NULL),
         ('OP-106',  'María Fernanda López', 'operador', 'Mañana',
            crypt('1060', gen_salt('bf', 10)), crypt('1234', gen_salt('bf', 10)),
            (SELECT id FROM lineas_produccion WHERE codigo = 'L-HILADA-01')),
         ('OP-107',  'Andrés Felipe Gómez',  'operador', 'Tarde',
            crypt('1070', gen_salt('bf', 10)), crypt('1234', gen_salt('bf', 10)),
            (SELECT id FROM lineas_produccion WHERE codigo = 'L-FERMENT-02')),
         ('OP-108',  'Diana Carolina Muñoz', 'operador', 'Noche',
            crypt('1080', gen_salt('bf', 10)), crypt('1234', gen_salt('bf', 10)),
            (SELECT id FROM lineas_produccion WHERE codigo = 'L-FERMENT-02'))
       ON CONFLICT (codigo_empleado) DO NOTHING;`
    );

    const usuarios = await client.query(`SELECT id, codigo_empleado FROM usuarios;`);
    const usuarioId = new Map(usuarios.rows.map((u) => [u.codigo_empleado, u.id]));
    const productos = await client.query(`SELECT id, codigo, nombre, norma_tecnica FROM productos;`);
    const productoPorCodigo = new Map(productos.rows.map((p) => [p.codigo, p]));
    const lineas = await client.query(`SELECT id, codigo FROM lineas_produccion;`);
    const lineaPorCodigo = new Map(lineas.rows.map((l) => [l.codigo, l.id]));
    const etapas = await client.query(
      `SELECT ec.id, ec.codigo_ui, ec.orden_secuencia, p.codigo AS producto_codigo
         FROM etapas_catalogo ec JOIN productos p ON p.id = ec.producto_id;`
    );
    const etapasPorProducto = new Map();
    for (const e of etapas.rows) {
      if (!etapasPorProducto.has(e.producto_codigo)) etapasPorProducto.set(e.producto_codigo, []);
      etapasPorProducto.get(e.producto_codigo).push(e);
    }
    const formatos = await client.query(`SELECT id, codigo FROM formatos_envase;`);
    const formatoPorCodigo = new Map(formatos.rows.map((f) => [f.codigo, f.id]));

    const plantillas = JSON.parse(fs.readFileSync(path.join(__dirname, 'seed_demo_lotes.json'), 'utf8')).templates;

    for (const padre of PADRES) {
      const existe = await client.query(`SELECT 1 FROM lotes_padre WHERE codigo_lote = $1;`, [padre.codigo]);
      if (existe.rowCount > 0) continue;
      const ins = await client.query(
        `INSERT INTO lotes_padre (codigo_lote, linea_id, responsable_id, fecha_produccion, total_leche_litros,
                                  litros_asignados, litros_remanentes, proveedor_principal, lote_leche_proveedor,
                                  estado, iniciado_at, dividido_at)
         VALUES ($1,$2,$3, CURRENT_DATE - $4::int, $5,$6,$7,$8,$9,'EN_PROCESO', NOW() - ($4::int || ' days')::interval, NOW() - ($4::int || ' days')::interval)
         RETURNING id;`,
        [padre.codigo, lineaPorCodigo.get(padre.linea), usuarioId.get('OP-104'), padre.dias, padre.total, padre.asignado, padre.remanente, padre.proveedor, padre.lote]
      );
      await client.query(
        `INSERT INTO lote_padre_recepcion (lote_padre_id, temperatura_recepcion_celsius, acidez_dornic, ph_recepcion, observaciones_plataforma)
         VALUES ($1,$2,$3,$4,$5);`,
        [ins.rows[0].id, padre.temp, padre.acidez, padre.ph, 'Recepción de prueba DEMO.']
      );
    }

    for (const lote of LOTES) {
      const existe = await client.query(`SELECT 1 FROM lotes_produccion WHERE codigo_lote = $1;`, [lote.codigo]);
      if (existe.rowCount > 0) {
        console.log(`= ${lote.codigo} ya existe, se omite.`);
        continue;
      }
      const producto = productoPorCodigo.get(lote.producto);
      if (!producto) throw new Error(`Producto ${lote.producto} no existe.`);
      const lineaCodigo = lote.ui.startsWith('prod-yogur') || lote.ui === 'prod-kumis' ? 'L-FERMENT-02' : 'L-HILADA-01';
      const estadoUi = mezclar(plantillas[lote.ui], lote.overrides);
      // estado_ui se guarda siempre envuelto como { batch, stage } (mismo formato que el endpoint).
      const estadoGuardado = { batch: estadoUi, stage: lote.etapa };
      estadoUi.id = lote.codigo;
      estadoUi.operator = 'Operador de Planta';
      estadoUi.responsableProceso = lote.responsable;
      estadoUi.operariosIntervinientes = lote.operarios;

      const finalizado = lote.estado === 'COMPLETADO' || lote.estado === 'ANULADO';
      const origen = lote.overrides.origenYogur ?? null;
      const origenRow = origen
        ? (await client.query(`SELECT id, lote_padre_id FROM lotes_produccion WHERE codigo_lote = $1;`, [origen.yogurId])).rows[0]
        : null;
      if (origen && !origenRow) {
        throw new Error(`El yogur de origen ${origen.yogurId} de ${lote.codigo} no existe; cárgalo antes.`);
      }
      const ins = await client.query(
        `INSERT INTO lotes_produccion (
           codigo_lote, producto_id, linea_id, responsable_id, norma_tecnica_aplicada, receta_snapshot,
           variante_fermentado, volumen_leche_base_litros, lleva_azucar, estado, etapa_actual_codigo,
           iniciado_at, finalizado_at, duracion_total_segundos, motivo_cierre, ingreso_cuarto_frio_at,
           temp_almacenamiento_celsius, lote_producto_terminado, observaciones_finales,
           anulado_at, anulado_por_id, motivo_anulacion, estado_ui, producto_ui_id,
           lote_origen_id, lote_padre_id
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,
                   NOW() - ($12::int || ' days')::interval,
                   $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26)
         RETURNING id;`,
        [
          lote.codigo,
          producto.id,
          lineaPorCodigo.get(lineaCodigo),
          usuarioId.get(lote.responsable),
          producto.norma_tecnica,
          JSON.stringify({ producto_codigo: producto.codigo, estandar: producto.nombre, norma: producto.norma_tecnica }),
          lote.ui === 'prod-yogur' ? (lote.overrides.pasteurizacion?.llevaAzucar === false ? 'yogur_sin_azucar' : 'yogur_con_azucar')
            : lote.ui === 'prod-kumis' ? 'kumis'
            : lote.ui === 'prod-yogur-griego' ? 'yogur_griego'
            : null,
          lote.litros,
          lote.overrides.pasteurizacion?.llevaAzucar !== false,
          'EN_PROCESO',
          lote.etapa,
          lote.dias,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          JSON.stringify(estadoGuardado),
          lote.ui,
          origenRow?.id ?? null,
          origenRow?.lote_padre_id ?? null,
        ]
      );
      const loteId = ins.rows[0].id;

      const etapasProducto = (etapasPorProducto.get(lote.producto) || []).sort((a, b) => a.orden_secuencia - b.orden_secuencia);
      const indiceActual = etapasProducto.findIndex((e) => e.codigo_ui === lote.etapa);
      for (let i = 0; i < etapasProducto.length; i++) {
        const e = etapasProducto[i];
        const estado = lote.estado === 'COMPLETADO' || i < indiceActual ? 'completada' : i === indiceActual ? (lote.estado === 'ANULADO' ? 'pendiente' : 'en_proceso') : 'pendiente';
        const inicio = estado === 'pendiente' ? null : new Date(Date.now() - lote.dias * 86400000 + (6 + i) * 3600000);
        const fin = estado === 'completada' ? new Date(Date.now() - lote.dias * 86400000 + (7 + i) * 3600000) : null;
        await client.query(
          `INSERT INTO lote_etapas_ejecucion (lote_id, etapa_catalogo_id, estado, iniciado_at, finalizado_at, duracion_segundos, operario_responsable_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7);`,
          [loteId, e.id, estado, inicio, fin, fin ? 3600 : null, usuarioId.get(lote.responsable)]
        );
      }

      for (const codigo of lote.operarios) {
        await client.query(
          `INSERT INTO lote_operarios_intervinientes (lote_id, usuario_id, rol_en_proceso)
           VALUES ($1,$2,$3) ON CONFLICT (lote_id, usuario_id) DO NOTHING;`,
          [loteId, usuarioId.get(codigo), codigo === lote.responsable ? 'Responsable del lote' : 'Operador de Etapa']
        );
      }

      // Desvío Yogur → Kumis/Griego (mismo registro que deja el endpoint al crear el sub-lote).
      if (origenRow) {
        await client.query(
          `INSERT INTO lote_extracciones_sublote
             (lote_origen_id, lote_destino_id, etapa_origen_codigo, litros_anteriores, litros_nuevos, es_desvio_total, operario_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7);`,
          [
            origenRow.id,
            loteId,
            lote.ui === 'prod-kumis' ? 'acidificar' : 'calentar-y-cuajar',
            0,
            Number(origen.litros) || 0,
            origen.desvioTotal === true,
            usuarioId.get(lote.responsable),
          ]
        );
      }

      // Borrador abierto: es lo que alimenta "Continuar" por línea y "Borradores Abiertos" del panel.
      if (!finalizado) {
        await client.query(
          `INSERT INTO borradores_lote (producto_ui_id, linea_id, estado, etapa_actual, version, lote_id, actualizado_por_id)
           VALUES ($1,$2,$3,$4,1,$5,$6)
           ON CONFLICT (producto_ui_id) DO UPDATE SET
             linea_id = EXCLUDED.linea_id,
             estado = EXCLUDED.estado,
             etapa_actual = EXCLUDED.etapa_actual,
             lote_id = EXCLUDED.lote_id,
             actualizado_por_id = EXCLUDED.actualizado_por_id,
             version = borradores_lote.version + 1,
             updated_at = NOW();`,
          [lote.ui, lineaPorCodigo.get(lineaCodigo), JSON.stringify(estadoGuardado), lote.etapa, loteId, usuarioId.get(lote.responsable)]
        );
      }

      if (lote.estado === 'COMPLETADO') {
        const filas = [];
        if (lote.ui === 'prod-yogur' || lote.ui === 'prod-kumis') {
          for (const [codigo, unidades] of Object.entries(lote.overrides.envasado?.formatos || {})) {
            filas.push({ codigo, unidades, categoria: 'estandar' });
          }
        } else if (lote.ui === 'prod-yogur-griego') {
          for (const [codigo, unidades] of Object.entries(lote.overrides.envasado?.formatosSinEstevia || {})) {
            filas.push({ codigo: `griego_natural_${codigo}`, unidades, categoria: 'natural' });
          }
          for (const [codigo, unidades] of Object.entries(lote.overrides.envasado?.formatosConEstevia || {})) {
            filas.push({ codigo: `griego_stevia_${codigo}`, unidades, categoria: 'stevia' });
          }
        } else {
          for (const [codigo, unidades] of Object.entries(lote.overrides.moldesDesglose || {})) {
            filas.push({ codigo, unidades, categoria: 'estandar' });
          }
        }
        for (const fila of filas) {
          const formatoId = formatoPorCodigo.get(fila.codigo);
          if (!formatoId || !Number.isFinite(Number(fila.unidades)) || Number(fila.unidades) <= 0) continue;
          const f = await client.query(`SELECT descripcion, capacidad_unitaria, unidad_medida FROM formatos_envase WHERE id = $1;`, [formatoId]);
          await client.query(
            `INSERT INTO lote_presentaciones_envasado (lote_id, formato_id, descripcion_formato, capacidad_unitaria, unidad_medida, categoria_variedad, unidades_conteo)
             VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING;`,
            [loteId, formatoId, f.rows[0].descripcion, f.rows[0].capacidad_unitaria, f.rows[0].unidad_medida, fila.categoria, Number(fila.unidades)]
          );
        }
      }

      if (finalizado) {
        await client.query(
          `UPDATE lotes_produccion SET
             estado = $2::estado_lote_enum,
             finalizado_at = CASE WHEN $2 = 'COMPLETADO' THEN NOW() - ($3::int || ' days')::interval + interval '8 hours' ELSE NULL END,
             duracion_total_segundos = CASE WHEN $2 = 'COMPLETADO' THEN 28800 ELSE NULL END,
             motivo_cierre = CASE WHEN $2 = 'COMPLETADO' THEN 'CUARTO_FRIO'::motivo_cierre_enum ELSE NULL END,
             ingreso_cuarto_frio_at = CASE WHEN $2 = 'COMPLETADO' THEN NOW() - ($3::int || ' days')::interval + interval '8 hours' ELSE NULL END,
             temp_almacenamiento_celsius = CASE WHEN $2 = 'COMPLETADO' THEN 4 ELSE NULL END,
             lote_producto_terminado = CASE WHEN $2 = 'COMPLETADO' THEN $4 ELSE NULL END,
             observaciones_finales = CASE WHEN $2 = 'COMPLETADO' THEN 'Lote de demostración cerrado en cuarto frío.' ELSE NULL END,
             anulado_at = CASE WHEN $2 = 'ANULADO' THEN NOW() - ($3::int || ' days')::interval + interval '1 hour' ELSE NULL END,
             anulado_por_id = CASE WHEN $2 = 'ANULADO' THEN $5::uuid ELSE NULL END,
             motivo_anulacion = CASE WHEN $2 = 'ANULADO' THEN $6 ELSE NULL END,
             updated_at = NOW()
           WHERE id = $1;`,
          [loteId, lote.estado, lote.dias, `${lote.producto}-DEMO-001`, usuarioId.get('ADM-901'), lote.anulado || null]
        );
      }

      console.log(`+ ${lote.codigo} (${lote.estado})`);
    }

    await client.query('COMMIT');
    console.log('Datos DEMO cargados.');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al cargar datos DEMO:', error.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main();
