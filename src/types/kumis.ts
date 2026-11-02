export interface PasteurizacionKumisState {
  litrosLeche: number;
  loteLeche: string;
  loteCultivoLacticoPastur?: string;
  acidezDornic: number; // 16 °D
  phRecepcion: number; // 6.65
  temperaturaRecepcion: number; // 4.5 °C

  // Interruptor: ¿Este lote lleva azúcar? (Sí/No)
  llevaAzucar: boolean;
  azucarElegido?: boolean;
  loteAzucar?: string;
  cantidadAzucarKg?: number;
  loteAzucarPastur?: string;
  azucar: {
    adicionado: boolean;
    horaAdicion: string | null;
    cantidadKg: number; // Calculado: 3.2 kg por cada 40 L (editable)
    loteAzucar: string;
    esManual: boolean;
  };

  // Calentamiento en tina/tanque (hasta 85-90 °C)
  calentamiento: {
    iniciado: boolean;
    completado: boolean;
    horaInicio: string | null;
    horaFin: string | null;
    timestampInicio: number | null;
    temperaturaConsigna: number; // 85 - 90 °C (ej: 88.0)
    temperaturaAlcanzada: number;
    tiempoCalentamiento: string | null;
    duracionMantenimientoMinutos?: number;
    esManual: boolean;
    temperatura60Alcanzada?: boolean;
    llego85a90?: boolean;
    horaLlegada85a90?: string | null;
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

  // Enfriamiento a 35.0 °C (cronómetro automático tras sostenimiento)
  enfriamiento: {
    enfriamientoIniciado: boolean;
    enfriamientoCompletado: boolean; // "Llegó a 35 °C"
    horaInicio: string | null;
    horaInicioEnfriamiento?: string | null;
    horaFinEnfriamiento: string | null;
    timestampInicioEnfriamiento: number | null;
    temperaturaFinal: number; // 35.0 °C
    tiempoEnfriamiento: string | null;
    esManual: boolean;
    trasladoCantinasIniciado?: boolean; // compat
    horaTraslado?: string | null; // compat
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

  // Sección nueva: División de la leche (visible al llegar a 45 °C)
  divisionLeche: {
    // Si CON azúcar:
    litrosYogurConAzucar: number;
    litrosKumis: number;
    // Si SIN azúcar:
    litrosYogurSinAzucar: number;
    litrosYogurGriego: number;
    // Kumis: enfriamiento adicional hasta 35 °C y trasiego posterior
    kumisEnfriando35: boolean;
    kumisTimestampInicio35: number | null;
    kumisLlego35: boolean;
    kumisHora35: string | null;
    kumisTiempoEnfriamiento35?: string | null;
    kumisTrasiegoIniciado: boolean;
    kumisTimestampInicioTrasiego: number | null;
    kumisTrasegado: boolean;
    kumisHoraTrasegado: string | null;
    kumisTiempoTrasiego: string | null;
  };
}

export interface InoculacionKumisState {
  temperaturaVerificada45: number; // 45.0 °C
  temperaturaConfirmada: boolean;
  loteCultivo: string; // ej: 'CULT-KUM-2026-02'
  cepasCultivo: string; // 'Lactococcus lactis subsp. lactis, subsp. cremoris, biovar diacetylactis'
  cantidadCultivoCucharadas: number; // Calculado (1 cucharada / 40 L)
  cantidadCultivoGramos?: number; // 2.5 g DVI para 100 L (compat)
  tiempoMezcladoMinutos: number; // 5 min
  tiempoMezcladoCalculado?: string | null;
  horaInicioMezclado?: string | null;
  mezcladoConfirmado: boolean;
  inoculacionConfirmada: boolean; // Pulsado: "Ya inoculé y mezclé"
  horaInoculacion: string | null;
  esManualMezclado?: boolean;
  esManualIncubacion?: boolean;

  // Cronómetro de reposo / incubación AUTOMÁTICO por 12 horas a 22-26 °C
  incubacion: {
    iniciada: boolean;
    completada: boolean;
    horaInicio: string | null;
    horaFin: string | null;
    timestampInicio: number | null;
    tiempoTranscurrido: string | null;
    duracionObjetivoHoras: number; // 12 horas (no 8)
    temperaturaIncubacion: number; // 24.0 °C
    phFinalIncubacion: number; // 4.55 (rango 4.50 - 4.60)
    consistenciaCoagulo: string; // "Coágulo uniforme con aroma láctico fresco propio de kumis"
    esManual: boolean;
    productoEntroCuartoFrio?: boolean;
    horaEntradaCuartoFrio?: string | null;
  };
}

export interface MaduracionFrioKumisState {
  // Traslado a cantinas de almacenamiento (10 min)
  trasladoCantinas: {
    iniciado: boolean;
    completado: boolean;
    horaInicio: string | null;
    horaFin: string | null;
    tiempoTraslado: string | null; // ej: 10 min
    numeroCantinas: number;
    esManual: boolean;
  };

  // Refrigeración en cuarto frío durante 12 horas (2 °C - 4 °C)
  refrigeracion: {
    iniciada: boolean;
    completada: boolean;
    horaInicio: string | null;
    horaFin: string | null;
    timestampInicio: number | null;
    tiempoTranscurrido: string | null;
    duracionObjetivoHoras: number; // 12 horas
    temperaturaCuartoFrio: number; // 3.0 °C
    phFinalFrio: number; // 4.45
    viscosidadApreciada: string; // "Viscosidad cremosa, cuerpo sedoso y acidez refrescante"
    esManual: boolean;
  };
}

export interface BatidoYAdicionesKumisState {
  // Batido en batidora industrial (30 - 35 rpm) durante 10-15 min
  batidora: {
    iniciado: boolean;
    completado: boolean;
    horaInicio: string | null;
    horaFin: string | null;
    velocidadRpm: number; // 32 rpm (batido suave moderado)
    tiempoBatido: string | null; // 12 min
    esManual: boolean;
  };

  // REGLA 6: Kumis siempre es CON azúcar. No existe "kumis sin azúcar".
  adiciones: {
    // Formulación exclusiva con azúcar para Kumis
    variedadAzucar: {
      litrosBase: number;
      kilosAzucar: number; // Calculado 3,2 kg / 40 L (editable)
      loteAzucar: string;
      gramosAzucar?: number; // compat
      esManual?: boolean;
    };

    // Compatibilidad
    variedadNatural?: {
      litrosBase: number;
      gramosEndulzante: number;
      notaInformativa: string;
    };
    variedadEstevia?: {
      litrosBase: number;
      gramosEstevia: number;
      loteEstevia: string;
    };

    // Controles de guardado y manual
    recetaConfirmada?: boolean;
    horaPreparacionReceta?: string | null;
    esManualReceta?: boolean;
    sabor?: string;
    coloranteMl?: number;
    loteColorante?: string;
    saborizanteMl?: number;
    loteSaborizante?: string;
    habilitarModificacionManual: boolean;
    registrado: boolean;
    horaRegistro: string | null;
  };

  // Preparación y bombeo a tolva de envasado
  preparacionTolva: {
    completado: boolean;
    horaPreparacion: string | null;
    temperaturaMezcla: number; // 6.5 °C
  };
}

export interface EnvasadoFormatoKumis {
  unidades: number;
  volumenLitrosPorUnidad: number;
  subtotalLitros: number;
  // compat
  gramosPorUnidad?: number;
  kilosPorUnidad?: number;
  subtotalGramos?: number;
  subtotalKilos?: number;
}

export interface EnvasadoYAlmacenamientoKumisState {
  // Rotulado y trazabilidad
  loteProductoTerminado: string; // ej: 'KUM-01-20261020'
  fechaProduccion: string;
  fechaVencimiento: string; // +25 días
  temperaturaEnvasado: number; // 6.5 °C

  // REGLA 8: Presentaciones del kumis: SOLO Kumis 1 L y Kumis 2 L. Eliminar cualquier otra presentación.
  formatos: {
    botella120ml?: number; // Botella 120 ml (Stevia)
    botella1L: number; // Kumis 1 L
    botella2L: number; // Kumis 2 L

    // Categoría 1: Envases "Sin Azúcar" (Natural)
    sinAzucar_botella200ml?: number;
    sinAzucar_botella1L?: number;
    sinAzucar_botella2L?: number;
    sinAzucar_bolsa4L?: number;

    // Categoría 2: Envases "Con Stevia"
    stevia_botella120ml?: number;
    stevia_botella200ml?: number;
    stevia_botella1L?: number;
    stevia_botella2L?: number;
    stevia_bolsa4L?: number;

    // Compat opcional
    botella1000g?: number;
    botella500g?: number;
    vaso200g?: number;
    vaso150g?: number;
  };

  selladoVerificado: boolean;
  rotuladoCumpleNTC805: boolean;

  // Cuarto frío (24 horas / 1 día antes de despacho)
  almacenamientoCuartoFrio: {
    ingresado: boolean;
    horaIngreso: string | null;
    temperaturaAlmacenamiento: number; // 3.0 °C
    tiempoEstabilizacion: string; // '24 horas (1 día)'
  };

  procesoFinalizado: {
    finalizado: boolean;
    horaFinalizacion: string | null;
    tiempoTotalProceso: string | null;
  };
}

export interface KumisBatchData {
  id: string; // 'Lote KUM-01'
  productName: string; // 'Kumis Tradicional Fermentado'
  productId: string; // 'prod-kumis'
  lineId: string; // 'line-fermentacion'
  line: string; // 'Línea de Fermentación'
  standard: string; // 'NTC-805'
  operator: string;
  operatorRole: string;
  responsableProceso?: string;
  operariosIntervinientes?: string[];
  status: 'NOMINAL' | 'EN AJUSTE' | 'COMPLETADO';
  pasteurizacion: PasteurizacionKumisState;
  inoculacion: InoculacionKumisState;
  maduracionFrio: MaduracionFrioKumisState;
  batidoYAdiciones: BatidoYAdicionesKumisState;
  envasado: EnvasadoYAlmacenamientoKumisState;
  processTimer: {
    isRunning: boolean;
    isCompleted: boolean;
    startTime: string | null;
    startTimestamp: number | null;
    elapsedSeconds: number;
    formattedTime: string;
  };
  stageStatuses: {
    acidificar: 'pendiente' | 'en_proceso' | 'completada'; // Pasteurización y Enfriamiento
    'calentar-y-cuajar': 'pendiente' | 'en_proceso' | 'completada'; // Inoculación (Cultivo Kumis)
    desuerar: 'pendiente' | 'en_proceso' | 'completada'; // Maduración en Frío
    hilar: 'pendiente' | 'en_proceso' | 'completada'; // Batido y Adiciones (Endulzantes)
    moldeo: 'pendiente' | 'en_proceso' | 'completada'; // Envasado y Almacenamiento
  };
  observaciones?: string;
}

export const INITIAL_KUMIS_BATCH: KumisBatchData = {
  id: 'KUM · Nuevo lote',
  productName: 'Kumis Tradicional Fermentado',
  productId: 'prod-kumis',
  lineId: 'line-fermentacion',
  line: 'Línea de Fermentación',
  standard: 'NTC-805',
  operator: '',
  operatorRole: 'Operador de Planta',
  responsableProceso: '',
  operariosIntervinientes: [],
  observaciones: '',
  status: 'NOMINAL',
  processTimer: {
    isRunning: false,
    isCompleted: false,
    startTime: null,
    startTimestamp: null,
    elapsedSeconds: 0,
    formattedTime: '00:00:00',
  },
  stageStatuses: {
    acidificar: 'en_proceso',
    'calentar-y-cuajar': 'pendiente',
    desuerar: 'pendiente',
    hilar: 'pendiente',
    moldeo: 'pendiente',
  },
  pasteurizacion: {
    litrosLeche: 0,
    loteLeche: '',
    loteCultivoLacticoPastur: '',
    acidezDornic: 16.0,
    phRecepcion: 6.65,
    temperaturaRecepcion: 4.5,
    llevaAzucar: true,
    azucarElegido: true,
    azucar: {
      adicionado: false,
      horaAdicion: null,
      cantidadKg: 0,
      loteAzucar: '',
      esManual: false,
    },
    calentamiento: {
      iniciado: false,
      completado: false,
      horaInicio: null,
      horaFin: null,
      timestampInicio: null,
      temperaturaConsigna: 88.0,
      temperaturaAlcanzada: 0,
      tiempoCalentamiento: null,
      duracionMantenimientoMinutos: 15,
      esManual: false,
      temperatura60Alcanzada: false,
      llego85a90: false,
      horaLlegada85a90: null,
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
      trasladoCantinasIniciado: false,
      horaTraslado: null,
    },
    trasiego: {
      iniciado: false,
      completado: false,
      horaInicio: null,
      horaFin: null,
      timestampInicio: null,
      tiempoTrasiego: null,
    },
    divisionLeche: {
      litrosYogurConAzucar: 0,
      litrosKumis: 0,
      litrosYogurSinAzucar: 0,
      litrosYogurGriego: 0,
      kumisEnfriando35: false,
      kumisTimestampInicio35: null,
      kumisLlego35: false,
      kumisHora35: null,
      kumisTiempoEnfriamiento35: null,
      kumisTrasiegoIniciado: false,
      kumisTimestampInicioTrasiego: null,
      kumisTrasegado: false,
      kumisHoraTrasegado: null,
      kumisTiempoTrasiego: null,
    },
  },
  inoculacion: {
    temperaturaVerificada45: 35.0,
    temperaturaConfirmada: false,
    loteCultivo: '',
    cepasCultivo: 'Lactococcus lactis subsp. lactis, subsp. cremoris, biovar diacetylactis',
    cantidadCultivoCucharadas: 0, // Se calcula dinámicamente como litros / 40
    cantidadCultivoGramos: 0,
    tiempoMezcladoMinutos: 5,
    tiempoMezcladoCalculado: null,
    horaInicioMezclado: null,
    mezcladoConfirmado: false,
    inoculacionConfirmada: false,
    horaInoculacion: null,
    esManualMezclado: false,
    esManualIncubacion: false,
    incubacion: {
      iniciada: false,
      completada: false,
      horaInicio: null,
      horaFin: null,
      timestampInicio: null,
      tiempoTranscurrido: null,
      duracionObjetivoHoras: 12, // 12 horas para Kumis (no 8)
      temperaturaIncubacion: 24.0,
      phFinalIncubacion: 4.55,
      consistenciaCoagulo: 'Coágulo uniforme con aroma láctico fresco propio de kumis',
      esManual: false,
      productoEntroCuartoFrio: false,
      horaEntradaCuartoFrio: null,
    },
  },
  maduracionFrio: {
    trasladoCantinas: {
      iniciado: false,
      completado: false,
      horaInicio: null,
      horaFin: null,
      tiempoTraslado: null,
      numeroCantinas: 3,
      esManual: false,
    },
    refrigeracion: {
      iniciada: false,
      completada: false,
      horaInicio: null,
      horaFin: null,
      timestampInicio: null,
      tiempoTranscurrido: null,
      duracionObjetivoHoras: 12,
      temperaturaCuartoFrio: 3.0,
      phFinalFrio: 4.45,
      viscosidadApreciada: 'Viscosidad cremosa, cuerpo sedoso y acidez refrescante',
      esManual: false,
    },
  },
  batidoYAdiciones: {
    batidora: {
      iniciado: false,
      completado: false,
      horaInicio: null,
      horaFin: null,
      velocidadRpm: 32,
      tiempoBatido: null,
      esManual: false,
    },
    adiciones: {
      // REGLA 6: Kumis siempre es CON azúcar
      variedadAzucar: {
        litrosBase: 0,
        kilosAzucar: 0,
        loteAzucar: '',
      },
      habilitarModificacionManual: false,
      registrado: false,
      horaRegistro: null,
    },
    preparacionTolva: {
      completado: false,
      horaPreparacion: null,
      temperaturaMezcla: 6.5,
    },
  },
  envasado: {
    loteProductoTerminado: '',
    fechaProduccion: '',
    fechaVencimiento: '',
    temperaturaEnvasado: 6.5,
    // REGLA 8: Solo Kumis 1 L y Kumis 2 L (con botella 120 ml si es sin azúcar)
    formatos: {
      botella120ml: 0,
      botella1L: 0,
      botella2L: 0,
      sinAzucar_botella200ml: 0,
      sinAzucar_botella1L: 0,
      sinAzucar_botella2L: 0,
      sinAzucar_bolsa4L: 0,
      stevia_botella120ml: 0,
      stevia_botella200ml: 0,
      stevia_botella1L: 0,
      stevia_botella2L: 0,
      stevia_bolsa4L: 0,
    },
    selladoVerificado: false,
    rotuladoCumpleNTC805: false,
    almacenamientoCuartoFrio: {
      ingresado: false,
      horaIngreso: null,
      temperaturaAlmacenamiento: 3.0,
      tiempoEstabilizacion: '24 horas (1 día)',
    },
    procesoFinalizado: {
      finalizado: false,
      horaFinalizacion: null,
      tiempoTotalProceso: null,
    },
  },
};
