export interface PasteurizacionYogurState {
  litrosLeche: number;
  loteLeche: string;
  acidezDornic?: number; // compat
  phRecepcion?: number; // compat
  temperaturaRecepcion: number; // 4.5 °C

  // Interruptor: ¿Este lote incluye Kumis? (Sí/No)
  incluyeKumis?: boolean;
  loteAzucarPastur?: string;
  loteCultivoLacticoPastur?: string;
  litrosKumisDestinados?: number;
  extraccionKumis?: {
    realizado: boolean;
    litrosExtraidos: number;
    hora: string;
  };
  extraccionGriego?: {
    realizado: boolean;
    litrosExtraidos: number;
    hora: string;
  };

  // Interruptor: ¿Este lote lleva azúcar? (Sí/No)
  llevaAzucar: boolean;
  azucarElegido?: boolean;
  azucarGuardado?: boolean;
  loteAzucar?: string;
  cantidadAzucarKg?: number;
  azucar: {
    adicionado: boolean;
    horaAdicion: string | null;
    cantidadKg: number; // Calculado: 3.2 kg por cada 40 L (editable)
    loteAzucar: string;
    esManual: boolean;
  };

  // Calentamiento en tanque (hasta 85-90 °C)
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

  // Enfriamiento a 45.0 °C (cronómetro automático tras sostenimiento)
  enfriamiento: {
    enfriamientoIniciado: boolean;
    enfriamientoCompletado: boolean; // "Llegó a 45 °C"
    horaInicio: string | null;
    horaInicioEnfriamiento?: string | null;
    horaFinEnfriamiento: string | null;
    timestampInicioEnfriamiento: number | null;
    temperaturaFinal: number; // 45.0 °C
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
    kumisDivisionConfirmada?: boolean;
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

export interface InoculacionYogurState {
  temperaturaVerificada45: number; // 45.0 °C
  temperaturaConfirmada: boolean;
  loteCultivo: string; // ej: 'CULT-PROB-2026-04'
  cepasProbioticas: string; // Lactobacillus bulgaricus, Streptococcus thermophilus, Bifidobacterium
  cantidadCultivoCucharadas: number; // 1 cucharada por cada 40 L (calculado, editable)
  cantidadCultivoGramos?: number; // compat
  tiempoMezcladoMinutos: number; // 5 min
  tiempoMezcladoCalculado?: string | null;
  horaInicioMezclado?: string | null;
  mezcladoConfirmado: boolean;
  inoculacionConfirmada: boolean; // Pulsado: "Ya inoculé y mezclé"
  horaInoculacion: string | null;
  esManualMezclado?: boolean;
  esManualIncubacion?: boolean;

  // Cronómetro de reposo/incubación automático por mínimo 8 horas a 42-45 °C
  incubacion: {
    iniciada: boolean;
    completada: boolean;
    horaInicio: string | null;
    horaFin: string | null;
    timestampInicio: number | null;
    tiempoTranscurrido: string | null;
    duracionObjetivoHoras: number; // Mínimo 8 horas
    temperaturaCamara: number; // 43.0 °C
    phFinalIncubacion: number; // 4.55 (rango 4.5 - 4.6)
    consistenciaCoagulo: string; // "Coágulo firme y uniforme sin sinéresis"
    esManual: boolean;
    productoEntroCuartoFrio: boolean; // Pulsado: "Producto entró al cuarto frío"
    horaEntradaCuartoFrio: string | null;
  };
}

export interface MaduracionFrioYogurState {
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
    temperaturaCuartoFrio: number; // 3.5 °C
    phFinalFrio: number; // 4.45
    viscosidadApreciada: string; // "Cuerpo consistente y gel estructurado"
    esManual: boolean;
  };
}

export interface SaborYogurReceta {
  id: string;
  sabor: string;
  saborizanteMl: number | '';
  loteSaborizante: string;
  coloranteMl: number | '';
  loteColorante: string;
}

export interface LoteSaborYogurProceso {
  id: string;
  sabor: string;
  batidoInicio: string | null;
  batidoFin: string | null;
  envasadoInicio: string | null;
  envasadoFin: string | null;
  tiempoBatido: string | null;
  tiempoEnvasado: string | null;
  tiempoTotal: string | null;
}

export interface BatidoYAdicionesYogurState {
  lotesSabor?: LoteSaborYogurProceso[];
  salidaCuartoFrio?: { hora: string | null; confirmada: boolean };
  // Proceso en batidora industrial
  batidora: {
    iniciado: boolean;
    completado: boolean;
    horaInicio: string | null;
    horaFin: string | null;
    velocidadRpm: number; // 35 rpm (batido suave)
    tiempoBatido: string | null; // 12 min
    esManual: boolean;
  };

  // Formulación por Variedades: 3 Tipos de yogur (Yogur sin azúcar, Yogur con estevia, Yogur con azúcar)
  adiciones: {
    tipoYogur: 'sin_azucar' | 'con_estevia' | 'con_azucar';

    // 1. "Yogur sin azúcar" (en lugar de natural): sin campos de azúcar ni saborizante
    variedadSinAzucar: {
      litrosBase: number;
      notaInformativa: string; // 'Exento de azúcar, saborizantes y colorantes. Directo a envasado.'
    };
    variedadNatural?: {
      litrosBase: number;
      gramosEndulzante: number;
      notaInformativa: string;
    }; // compat

    // 2. "Yogur con estevia": campo de cantidad de estevia (g) y lote
    variedadEstevia: {
      litrosBase: number;
      gramosEstevia: number; // en g
      loteEstevia: string;
      horaAdicion?: string | null;
      confirmado?: boolean;
    };

    // 3. "Yogur con azúcar": campo de azúcar (calculado 3,2 kg/40L, editable), saborizante (ml) y colorante (ml) opcionales
    variedadAzucar: {
      litrosBase: number;
      kilosAzucar: number; // Calculado 3,2 kg / 40 L (editable)
      loteAzucar: string;
      esAzucarManual?: boolean;
      // Saborizante y colorante OPCIONALES pero solo aparecen en esta variante
      llevaSaborizante: boolean;
      sabor: string; // 'Mora' | 'Fresa' | 'Melocotón' | 'Frutos Rojos' | 'Vainilla'
      saborizanteMl: number; // ml
      loteSaborizante: string;
      llevaColorante: boolean;
      coloranteMl: number; // ml
      loteColorante: string;
      gramosAzucar?: number; // compat
    };



    sabores?: SaborYogurReceta[];

    // Compatibilidad y totales generales
    sabor?: string;
    loteSaborizante?: string;
    kilosSaborizante?: number;
    kilosAzucar?: number;
    adicionarAzucar?: boolean;
    loteAzucar?: string;
    saborizante?: {
      habilitado: boolean;
      sabor: string;
      cantidad: number;
      unidad: 'g' | 'ml';
      loteSaborizante: string;
    };

    // Controles de guardado y manual
    recetaConfirmada?: boolean;
    horaPreparacionReceta?: string | null;
    esManualReceta?: boolean;
    coloranteMl?: number;
    loteColorante?: string;
    saborizanteMl?: number;
    habilitarModificacionManual: boolean;
    registrado: boolean;
    horaRegistro: string | null;
  };

  // Re-envasado / preparación de tolva
  preparacionTolva: {
    completado: boolean;
    horaPreparacion: string | null;
    temperaturaMezcla: number; // 6 - 8 °C
  };
}

export interface EnvasadoFormatoYogur {
  unidades: number;
  volumenMlPorUnidad: number;
  subtotalLitros: number;
  // compat
  gramosPorUnidad?: number;
  kilosPorUnidad?: number;
  subtotalGramos?: number;
  subtotalKilos?: number;
}

export interface EnvasadoYAlmacenamientoYogurState {
  // Etiquetado
  loteProductoTerminado: string; // 'YOG-01-20261020'
  fechaProduccion: string;
  fechaVencimiento: string; // +25 días
  temperaturaEnvasado: number; // 6.5 °C

  // Presentaciones de ENVASADO de yogur (en ml/L, no en gramos)
  // Botella 120 ml (Stevia), Botella 200 ml, Botella 1 L, Botella 2 L, Bolsa 4 L.
  formatos: {
    botella120ml?: number; // Botella 120 ml (Stevia)
    botella200ml: number; // Botella 200 ml
    botella1L: number;    // Botella 1 L
    botella2L: number;    // Botella 2 L
    bolsa4L: number;      // Bolsa 4 L

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

    // Backwards compat
    botella1000g?: number;
    botella500g?: number;
    vaso200g?: number;
    vaso150g?: number;
  };

  // Presentaciones de Kumis (Tarro 1 L y Tarro 2 L) - solo si se habilitó Kumis en pasteurización
  formatosKumis?: {
    tarro1L: number;
    tarro2L: number;
  };

  selladoVerificado: boolean;
  rotuladoCumpleNTC805: boolean;

  // Paso a cuarto frío (1 día / 24 horas antes de despacho)
  almacenamientoCuartoFrio: {
    ingresado: boolean;
    horaIngreso: string | null;
    temperaturaAlmacenamiento: number; // 3.0 °C
    tiempoEstabilizacion: string; // '24 horas (1 día)'
  };

  procesoFinalizado: {
    finalizado: boolean;
    horaFinalizacion: string | null;
    tiempoTotalProceso?: string | null;
  };
}

export interface YogurBatchData {
  id: string; // 'Lote YOG-01'
  productName: string; // 'Yogur Entero Probiótico'
  productId: string; // 'prod-yogur'
  lineId: string; // 'line-fermentacion'
  line: string; // 'Línea de Fermentación'
  standard: string; // 'NTC-805'
  operator: string;
  operatorRole: string;
  responsableProceso?: string;
  operariosIntervinientes?: string[];
  status: 'NOMINAL' | 'EN AJUSTE' | 'COMPLETADO';
  pasteurizacion: PasteurizacionYogurState;
  inoculacion: InoculacionYogurState;
  maduracionFrio: MaduracionFrioYogurState;
  batidoYAdiciones: BatidoYAdicionesYogurState;
  envasado: EnvasadoYAlmacenamientoYogurState;
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
    'calentar-y-cuajar': 'pendiente' | 'en_proceso' | 'completada'; // Inoculación (Cultivo)
    desuerar: 'pendiente' | 'en_proceso' | 'completada'; // Maduración en Frío
    hilar: 'pendiente' | 'en_proceso' | 'completada'; // Batido y Adiciones
    moldeo: 'pendiente' | 'en_proceso' | 'completada'; // Envasado y Rendimiento
  };
  observaciones?: string;
}

export const INITIAL_YOGUR_BATCH: YogurBatchData = {
  id: 'YOG · Nuevo lote',
  productName: 'Yogur Entero',
  productId: 'prod-yogur',
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
    temperaturaRecepcion: 4.5,
    incluyeKumis: false,
    loteAzucarPastur: '',
    loteCultivoLacticoPastur: '',
    litrosKumisDestinados: 0,
    llevaAzucar: true,
    azucarElegido: false,
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
    temperaturaVerificada45: 45.0,
    temperaturaConfirmada: false,
    loteCultivo: '',
    cepasProbioticas: 'Lactobacillus bulgaricus, Streptococcus thermophilus, Bifidobacterium lactis',
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
      duracionObjetivoHoras: 8,
      temperaturaCamara: 43.0,
      phFinalIncubacion: 4.55,
      consistenciaCoagulo: 'Coágulo firme y uniforme sin sinéresis',
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
      temperaturaCuartoFrio: 3.5,
      phFinalFrio: 4.45,
      viscosidadApreciada: 'Cuerpo consistente y gel estructurado',
      esManual: false,
    },
  },
  batidoYAdiciones: {
    batidora: {
      iniciado: false,
      completado: false,
      horaInicio: null,
      horaFin: null,
      velocidadRpm: 35,
      tiempoBatido: null,
      esManual: false,
    },
    adiciones: {
      tipoYogur: 'con_azucar',
      variedadSinAzucar: {
        litrosBase: 0,
        notaInformativa: 'Exento de azúcar, saborizantes y colorantes. Directo a envasado.',
      },
      variedadEstevia: {
        litrosBase: 0,
        gramosEstevia: 0,
        loteEstevia: '',
      },
      variedadAzucar: {
        litrosBase: 0,
        kilosAzucar: 0,
        loteAzucar: '',
        llevaSaborizante: true,
        sabor: 'Mora',
        saborizanteMl: 0,
        loteSaborizante: '',
        llevaColorante: false,
        coloranteMl: 0,
        loteColorante: '',
      },

      // Compatibilidad
      variedadNatural: {
        litrosBase: 0,
        gramosEndulzante: 0,
        notaInformativa: 'Exento de azúcar y estevia. Pasa directo de batido a envasado.',
      },
      sabor: 'Mora',
      loteSaborizante: '',
      kilosSaborizante: 0,
      kilosAzucar: 0,
      adicionarAzucar: true,
      loteAzucar: '',
      habilitarModificacionManual: false,
      registrado: false,
      horaRegistro: null,
    },
    preparacionTolva: {
      completado: false,
      horaPreparacion: null,
      temperaturaMezcla: 7.0,
    },
  },
  envasado: {
    loteProductoTerminado: '',
    fechaProduccion: '',
    fechaVencimiento: '',
    temperaturaEnvasado: 6.5,
    formatos: {
      botella120ml: 0,
      botella200ml: 0,
      botella1L: 0,
      botella2L: 0,
      bolsa4L: 0,
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
    formatosKumis: {
      tarro1L: 0,
      tarro2L: 0,
    },
    selladoVerificado: true,
    rotuladoCumpleNTC805: true,
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

