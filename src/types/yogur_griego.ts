import { ActividadOperario, ProcessTimerState, StageId } from './pastaHilada';
import type { OrigenYogur } from './yogur';

export interface PasteurizacionYogurGriegoState {
  loteYogurSinAzucar: string; // Lote compartido con el Yogur sin Azúcar del día
  litrosLeche: number;
  loteLeche: string;
  acidezDornic: number; // 16 °D
  phRecepcion: number; // 6.65
  temperaturaRecepcion: number; // 4.5 °C

  // Calentamiento en tina/tanque (hasta 85-90 °C)
  calentamiento: {
    iniciado: boolean;
    completado: boolean;
    horaInicio: string | null;
    horaFin: string | null;
    timestampInicio: number | null;
    temperaturaConsigna: number; // 88.0 °C
    temperaturaAlcanzada: number;
    tiempoCalentamiento: string | null;
    llego85a90: boolean;
    horaLlegada85a90: string | null;
    esManual: boolean;
  };

  // Sostenimiento térmico (15 min automáticos a 85-90 °C)
  sostenimiento: {
    iniciado: boolean;
    completado: boolean;
    horaInicio: string | null;
    horaFin: string | null;
    timestampInicio: number | null;
    duracionMinutos: number; // 15
    duracionReal: string | null;
  };

  // Enfriamiento a 45.0 °C (cronómetro automático tras sostenimiento)
  enfriamiento: {
    enfriamientoIniciado: boolean;
    enfriamientoCompletado: boolean; // "Llegó a 45 °C"
    horaInicio: string | null;
    horaFinEnfriamiento: string | null;
    timestampInicioEnfriamiento: number | null;
    temperaturaFinal: number; // 45.0 °C
    tiempoEnfriamiento: string | null;
    esManual: boolean;
  };

  // Trasegar a cantinas (cronómetro automático de trasiego al pulsar "Llegó a 45 °C")
  trasiego: {
    iniciado: boolean;
    completado: boolean; // "Ya trasegué"
    horaInicio: string | null;
    horaFin: string | null;
    timestampInicio: number | null;
    tiempoTrasiego: string | null;
  };
}

export interface InoculacionYogurGriegoState {
  temperaturaVerificada45: number; // 45.0 °C
  temperaturaConfirmada: boolean;
  loteCultivo: string; // ej: 'CULT-GRI-2026-01'
  cepasCultivo: string; // 'Streptococcus thermophilus, Lactobacillus delbrueckii subsp. bulgaricus'
  cantidadCultivoCucharadas: number; // 1 cucharada por cada 40 L (calculado, editable)
  cantidadCultivoGramos: number; // 2.5 g
  tiempoMezcladoMinutos: number; // 5 min
  mezcladoConfirmado: boolean;
  inoculacionConfirmada: boolean; // Pulsado: "Ya inoculé y mezclé"
  horaInoculacion: string | null;

  // Cronómetro de reposo / incubación automático por mínimo 8 horas a 42-44 °C
  incubacion: {
    iniciada: boolean;
    completada: boolean;
    horaInicio: string | null;
    horaFin: string | null;
    timestampInicio: number | null;
    tiempoTranscurrido: string | null;
    duracionObjetivoHoras: number; // Mínimo 8 horas
    temperaturaIncubacion: number; // 43.0 °C
    phFinalIncubacion: number; // 4.60
    consistenciaCoagulo: string; // "Coágulo firme y homogéneo listo para maduración y filtrado"
    esManual: boolean;
  };
}

export interface MaduracionYFiltradoYogurGriegoState {
  // ① Cuarto frío (0–4 °C): mínimo 1 día (24 h), máximo 2 días (48 h), con aviso a las 24 h
  cuartoFrio: {
    iniciado: boolean;
    completado: boolean;
    horaInicio: string | null;
    horaFin: string | null;
    timestampInicio: number | null;
    tiempoTranscurrido: string | null;
    temperatura: number; // 2.0 °C
    duracionMinimaDias: number; // 1 día (24 h)
    duracionMaximaDias: number; // 2 días (48 h)
    cumplio24h: boolean;
    esManual?: boolean;
  };

  // ② Filtrado en telas: cronómetro automático de 2 días (48 h)
  // Texto: "La masa se escurre en canastillas con lienzos para eliminar el suero y espesar el yogur."
  filtradoTelas: {
    iniciado: boolean;
    completado: boolean;
    horaInicio: string | null;
    horaFin: string | null;
    timestampInicio: number | null;
    tiempoTranscurrido: string | null;
    duracionObjetivoHoras: number; // 48 horas (2 días)
    temperaturaFiltrado: number; // 4.0 °C
    masaFiltradaKg: number; // ej: 35.0 kg
    sueroEliminadoEstimadoLitros: number; // ej: 65.0 L
    esManual: boolean;
  };
}

export interface BatidoYAdicionesYogurGriegoState {
  // ④ Batido (sin crema): botón "Iniciar batido" -> botón "Terminó batido"
  batido: {
    iniciado: boolean;
    completado: boolean;
    horaInicio: string | null;
    horaFin: string | null;
    velocidadRpm: number; // 35 rpm
    tiempoBatido: string | null; // ej: 5 min
    esManual: boolean;
  };

  // ⑤ Formulación por variedad: SOLO "Griego sin estevia" y "Griego con estevia"
  formulacion: {
    llevaStevia?: boolean;
    tipo?: 'sin_stevia' | 'con_stevia' | 'ambas';
    variedadSinEstevia: {
      masaKg: number; // Masa en kg
      nota: string;
    };
    variedadConEstevia: {
      masaKg: number; // Masa en kg
      gramosEstevia: number; // Cantidad de estevia en gramos
      loteEstevia: string;
      horaAdicion?: string | null;
      confirmado?: boolean;
    };
    registrado: boolean;
    horaRegistro: string | null;
  };
}

export interface FormatosGriegoSinEstevia {
  tarro1L: number;
  tarro500ml: number;
  vasito120ml?: number;
  tarrina1000g?: number;
  tarrina500g?: number;
  tarrina120g?: number;
  bolsa4L?: number; // Bolsa de 4 L (≈ 4 kg)
}

export interface FormatosGriegoConEstevia {
  tarro1L: number;
  tarro500ml: number;
  vasito120ml: number; // SOLO para con estevia
  tarrina1000g?: number;
  tarrina500g?: number;
  tarrina120g?: number;
  bolsa4L?: number; // Bolsa de 4 L (≈ 4 kg)
}

export interface EnvasadoYAlmacenamientoYogurGriegoState {
  loteProductoTerminado: string; // ej: 'YGR-01-20261020'
  fechaProduccion: string;
  fechaVencimiento: string; // +30 días
  temperaturaEnvasado: number; // 5.0 °C
  conteoConfirmado?: boolean;
  esManualConteo?: boolean;

  // 5. Envasado del Griego:
  // - Tarro 1 L: disponible para "sin estevia" Y "con estevia".
  // - Tarro 500 ml: disponible para "sin estevia" Y "con estevia".
  // - Vasito 120 ml: SOLO para "con estevia".
  formatosSinEstevia: FormatosGriegoSinEstevia;
  formatosConEstevia: FormatosGriegoConEstevia;

  selladoHermeticoVerificado: boolean;
  rotuladoCumpleNTC805: boolean;

  almacenamientoCuartoFrio: {
    ingresado: boolean;
    horaIngreso: string | null;
    temperaturaAlmacenamiento: number; // 4.0 °C
    tiempoEstabilizacion: string; // '24 horas antes de despacho'
  };

  procesoFinalizado: {
    finalizado: boolean;
    horaFinalizacion: string | null;
    tiempoTotalProceso: string | null;
  };
}

export interface YogurGriegoBatchData {
  id: string; // 'Lote YGR-01'
  /** Lote visible por día en letras (DD+M+AA), asignado por el servidor. `id` sigue siendo el código interno. */
  loteDia?: string;
  productName: string; // 'Yogur Griego'
  productId: string; // 'prod-yogur-griego'
  lineId: string; // 'line-fermentacion'
  line: string; // 'Línea de Fermentación'
  standard: string; // 'NTC-805'
  operator: string;
  operatorRole: string;
  responsableProceso?: string;
  operariosIntervinientes?: string[];
  actividadOperarios?: ActividadOperario[];
  stageStatuses: Record<StageId, 'pendiente' | 'en_proceso' | 'completada'>;
  status: 'NOMINAL' | 'EN AJUSTE' | 'COMPLETADO';
  processTimer: ProcessTimerState;

  pasteurizacion: PasteurizacionYogurGriegoState;
  inoculacion: InoculacionYogurGriegoState;
  maduracionYFiltrado: MaduracionYFiltradoYogurGriegoState;
  batidoYAdiciones: BatidoYAdicionesYogurGriegoState;
  envasado: EnvasadoYAlmacenamientoYogurGriegoState;

  /** Lote de Yogur del que se desvió este Griego (toda la leche entra por el Yogur). */
  origenYogur?: OrigenYogur;

  observaciones?: string;
}

export const INITIAL_YOGUR_GRIEGO_BATCH: YogurGriegoBatchData = {
  id: 'YGR · Nuevo lote',
  productName: 'Yogur Griego',
  productId: 'prod-yogur-griego',
  lineId: 'line-fermentacion',
  line: 'Línea de Fermentación · Yogur Griego Concentrado',
  standard: 'NTC-805 (Productos Lácteos Fermentados)',
  operator: '',
  operatorRole: 'Operador de Planta',
  responsableProceso: '',
  operariosIntervinientes: [],
  status: 'NOMINAL',
  stageStatuses: {
    acidificar: 'completada',
    'calentar-y-cuajar': 'completada',
    desuerar: 'en_proceso',
    hilar: 'pendiente',
    moldeo: 'pendiente',
  },
  processTimer: {
    isRunning: false,
    isCompleted: false,
    startTime: null,
    startTimestamp: null,
    elapsedSeconds: 0,
    formattedTime: '00:00:00',
  },

  pasteurizacion: {
    loteYogurSinAzucar: '',
    litrosLeche: 0,
    loteLeche: '',
    acidezDornic: 16.0,
    phRecepcion: 6.65,
    temperaturaRecepcion: 4.5,
    calentamiento: {
      iniciado: false,
      completado: false,
      horaInicio: null,
      horaFin: null,
      timestampInicio: null,
      temperaturaConsigna: 88.0,
      temperaturaAlcanzada: 88.0,
      tiempoCalentamiento: null,
      llego85a90: false,
      horaLlegada85a90: null,
      esManual: false,
    },
    sostenimiento: {
      iniciado: false,
      completado: false,
      horaInicio: null,
      horaFin: null,
      timestampInicio: null,
      duracionMinutos: 15,
      duracionReal: null,
    },
    enfriamiento: {
      enfriamientoIniciado: false,
      enfriamientoCompletado: false,
      horaInicio: null,
      horaFinEnfriamiento: null,
      timestampInicioEnfriamiento: null,
      temperaturaFinal: 45.0,
      tiempoEnfriamiento: null,
      esManual: false,
    },
    trasiego: {
      iniciado: false,
      completado: false,
      horaInicio: null,
      horaFin: null,
      timestampInicio: null,
      tiempoTrasiego: null,
    },
  },

  inoculacion: {
    temperaturaVerificada45: 45.0,
    temperaturaConfirmada: false,
    loteCultivo: '',
    cepasCultivo: 'Streptococcus thermophilus, Lactobacillus delbrueckii subsp. bulgaricus',
    cantidadCultivoCucharadas: 0,
    cantidadCultivoGramos: 0,
    tiempoMezcladoMinutos: 5,
    mezcladoConfirmado: false,
    inoculacionConfirmada: false,
    horaInoculacion: null,
    incubacion: {
      iniciada: false,
      completada: false,
      horaInicio: null,
      horaFin: null,
      timestampInicio: null,
      tiempoTranscurrido: null,
      duracionObjetivoHoras: 8,
      temperaturaIncubacion: 43.0,
      phFinalIncubacion: 4.60,
      consistenciaCoagulo: 'Coágulo firme y homogéneo listo para maduración y filtración',
      esManual: false,
    },
  },

  maduracionYFiltrado: {
    cuartoFrio: {
      iniciado: false,
      completado: false,
      horaInicio: null,
      horaFin: null,
      timestampInicio: null,
      tiempoTranscurrido: null,
      temperatura: 2.0,
      duracionMinimaDias: 1,
      duracionMaximaDias: 2,
      cumplio24h: false,
    },
    filtradoTelas: {
      iniciado: false,
      completado: false,
      horaInicio: null,
      horaFin: null,
      timestampInicio: null,
      tiempoTranscurrido: null,
      duracionObjetivoHoras: 48, // 2 días
      temperaturaFiltrado: 4.0,
      masaFiltradaKg: 0,
      sueroEliminadoEstimadoLitros: 0,
      esManual: false,
    },
  },

  batidoYAdiciones: {
    batido: {
      iniciado: false,
      completado: false,
      horaInicio: null,
      horaFin: null,
      velocidadRpm: 35,
      tiempoBatido: null,
      esManual: false,
    },
    formulacion: {
      variedadSinEstevia: {
        masaKg: 0,
        nota: 'Yogur Griego puro concentrado, natural sin endulzante',
      },
      variedadConEstevia: {
        masaKg: 0,
        gramosEstevia: 0,
        loteEstevia: '',
      },
      registrado: false,
      horaRegistro: null,
    },
  },

  envasado: {
    loteProductoTerminado: '',
    fechaProduccion: '',
    fechaVencimiento: '',
    temperaturaEnvasado: 5.0,
    formatosSinEstevia: {
      tarro1L: 0,
      tarro500ml: 0,
    },
    formatosConEstevia: {
      tarro1L: 0,
      tarro500ml: 0,
      vasito120ml: 0,
    },
    selladoHermeticoVerificado: false,
    rotuladoCumpleNTC805: false,
    almacenamientoCuartoFrio: {
      ingresado: false,
      horaIngreso: null,
      temperaturaAlmacenamiento: 4.0,
      tiempoEstabilizacion: '24 horas antes de despacho',
    },
    procesoFinalizado: {
      finalizado: false,
      horaFinalizacion: null,
      tiempoTotalProceso: null,
    },
  },

  observaciones: '',
};
