export type StageId = 
  | 'acidificar' 
  | 'calentar-y-cuajar' 
  | 'desuerar' 
  | 'hilar' 
  | 'moldeo';

export type UserRole = 'administrador' | 'operador';

export type AppView = 
  | 'admin_dashboard' 
  | 'operator_line_select' 
  | 'operator_product_select' 
  | 'batch_process';

export interface UserProfile {
  id: string;
  name: string;
  code: string;
  role: UserRole;
  shift: 'Jornada Continua' | 'Mañana' | 'Tarde' | 'Noche';
  pin?: string;
  password?: string;
  assignedLineId?: string;
}

export type LineType = 'pasta_hilada' | 'fermentacion' | 'dulces';

export interface ProductDefinition {
  id: string;
  name: string;
  code: string;
  lineType: LineType;
  description: string;
  standards: string;
  isTargetProduct?: boolean;
}

export interface ProductionLine {
  id: string;
  name: string;
  code: string;
  lineType: LineType;
  lineTypeName: string;
  capacityLiters: number;
  status: 'disponible' | 'en_produccion' | 'mantenimiento' | 'limpieza_cip';
  activeBatchId?: string | null;
  assignedOperatorName?: string | null;
  allowedProductIds: string[];
}

export interface AuditLogEntry {
  id: string;
  batchId: string;
  lineName: string;
  timestamp: number;
  dateStr: string;
  adminName: string;
  stageId: StageId;
  stageLabel: string;
  fieldKey: string;
  fieldLabel: string;
  oldValue: string | number;
  newValue: string | number;
  unit?: string;
  reasonCategory: string;
  justificationText: string;
}

export interface ToastMessage {
  id: string;
  message: string;
  type?: 'success' | 'info' | 'warning';
}

export interface ProcessTimerState {
  isRunning: boolean;
  isCompleted: boolean;
  startTime: string | null; // ej: "10:14:25 AM"
  startTimestamp: number | null; // Date.now() timestamp
  elapsedSeconds: number; // segundos acumulados
  formattedTime: string; // "00:14:32"
}

export interface AcidificarState {
  tempConsigna: number;
  acidezObjetivo: number;
  // Momento de inicio de calentamiento de la mezcla
  inicioCalentamiento: {
    iniciado: boolean;
    horaInicio: string | null;
    timestampInicio: number | null;
  };
  // Fase 01: Alcanzar 35 °C (Calentamiento de la Mezcla)
  phase1: {
    alcanzo35: boolean;
    horaAlcanzo35: string | null;
    timestampAlcanzo35?: number | null;
    tiempoCalentamiento: string | null; // ej: "14 min 32 s"
    segundosCalentamiento: number;
    temperaturaAlcanzada: number;
    duration: number; // compatibilidad minutos
    saved: boolean;
    temperaturaManual?: boolean;
    horaManual?: boolean;
  };
  // Fase 02: Se adiciona cuajo
  phase2: {
    cuajoAdicionado: boolean;
    horaAdicionCuajo: string | null;
    timestampAdicionCuajo?: number | null;
    tiempoDesde35: string | null; // ej: "3 min 12 s"
    tiempoTotalHastaCuajo: string | null; // ej: "17 min 44 s"
    cantidadCuajo: string; // ej: "1.05 g"
    cantidadCuajoGramos?: number; // Calculado: 1.4 g por cada 100 L total
    tipoCuajo: string; // ej: "Coagulante microbiano / Cuajo líquido"
    loteCuajo?: string; // Lote específico del cuajo
    esCuajoManual?: boolean; // Check para ingresar valor manual
    duration: number; // compatibilidad
    saved: boolean;
    cultivoAdicionado?: boolean;
    horaAdicionCultivo?: string | null;
    cantidadCultivoUnidades?: number;
    esManualCultivo?: boolean;
  };
  insumos: {
    lecheFresca: number;
    lecheAcida: number;
    phFresca: number;
    phAcida: number;
    phMezcla?: number; // Medición de pH de la leche (Objetivo: 5.7, Rango óptimo: 5.6 - 5.8)
    cultivoLacteoGramos?: number; // Cantidad de cultivo lácteo en gramos (Línea Industrial)
    cultivoLacteoUnidades?: number; // Cantidad en unidades de cultivo lácteo (Queso Pera / Premaduración)
    loteCultivoLacteo?: string; // Número de lote del cultivo lácteo (Línea Industrial / Queso Pera)
    loteCuajoPera?: string; // Lote específico de cuajo seleccionado para Queso Pera
    loteAcidoAcetico?: string; // Lote del Ácido Acético (Queso 7 Cueros)
    confirmacionAcidoDiluido5?: boolean; // Confirmación del Operador: Ácido Acético diluido al 5%
    confirmacionPh535?: boolean; // Confirmación de Acidez: pH de 5.35 alcanzado
    acidoBase98Ml?: number; // Ácido base al 98% usado (ml) - Insumo que descuenta en inventario
    solucionPreparada5Litros?: number; // Solución preparada al 5% (L)
    phRangoConfirmado?: boolean; // Confirmación de pH dentro del rango 5.30 - 5.35
    litrosConfirmados?: number; // Último valor confirmado de litros de leche
    saved: boolean;
  };
  telemetria: {
    temperatura: number;
    acidez: number;
    trend: string;
  };
}

export interface CalentarYCuajarState {
  tempConsigna: number;
  temperaturaManual?: boolean;
  horaAdicionCuajo: string | null;
  timestampAdicionCuajo?: number | null;
  // Fase 01: Adición del cuajo
  adicionCuajo?: {
    registrado: boolean;
    horaRegistro: string | null;
    timestampCuajo?: number | null;
    tiempoTranscurridoDesdeCultivo: string | null;
    cantidadGramos?: number;
    loteCuajo?: string;
    esManual?: boolean;
  };
  // Fase 02: Tiempo de cuajado
  cuajado: {
    registrado: boolean;
    horaRegistro: string | null;
    timestampCuajado?: number | null;
    tiempoTranscurridoDesdeCuajo: string | null;
    segundosCuajado: number;
    consistencia: string;
    esManual?: boolean;
  };
  // 2. Tiempo de corte de cuajado
  corte: {
    registrado: boolean;
    horaRegistro: string | null;
    timestampCorte?: number | null;
    tiempoTranscurridoDesdeCuajado: string | null;
    esManual?: boolean;
  };
  // 3. Ya se llegó a 40 grados para el desuerado
  temperatura40: {
    alcanzado: boolean;
    horaRegistro: string | null;
    timestamp40Grados?: number | null;
    temperaturaAlcanzada: number; // 40.0 °C
    tiempoCalentamiento40: string | null;
    esManual?: boolean;
  };
  lecturasPhReposo?: LecturaPhReposo[];
  cultivoLacticoPera?: {
    registrado: boolean;
    horaRegistro: string | null;
    timestamp?: number | null;
    cucharadas: number;
    loteCultivo: string;
    esManual?: boolean;
  };
  llegada40?: {
    alcanzado: boolean;
    horaRegistro: string | null;
    timestamp40Grados?: number | null;
    temperaturaAlcanzada: number;
    tiempoCalentamiento40: string | null;
    esManual?: boolean;
  };
  finReposoPh58?: {
    alcanzado: boolean;
    horaRegistro: string | null;
    timestampPh58?: number | null;
    phAlcanzado: number;
    tiempoTotalReposo: string | null;
    esManual?: boolean;
  };
  reposoIniciado?: boolean;
  timestampInicioReposo?: number | null;
  telemetria: {
    temperatura: number;
    rpm: number;
  };
}

export interface LecturaPhReposo {
  id: string;
  hora: string;
  ph: number;
}

export interface EscurridoState {
  iniciado?: boolean;
  completado?: boolean;
  horaInicio?: string | null;
  horaFin?: string | null;
  timestampInicio?: number | null;
  timestampFin?: number | null;
  tiempoTraslado?: string | null; // Tiempo de traslado a camilla
  segundosTraslado?: number;
  tiempoEscurrido?: string | null; // Calculado entre pasar a bandeja/camilla y finalizar escurrido
  segundosEscurrido?: number;
  phEscurrido: number; // Medición de pH en bandeja de escurrido (ej: 5.3)
  phEscurridoManual?: boolean; // Check para ingresar pH manual
  tiempoManual?: boolean; // Check para ingresar tiempo manual
  esManualPaso2?: boolean;
  esManualPaso3?: boolean;
}

export interface DesuerarState {
  temperaturaVerificada: number; // 40.0 °C
  temperaturaEn40Confirmada: boolean;
  temperaturaManual?: boolean;
  sueroExtraido?: number; // Litros opcional (deprecado)
  acidezSuero: number; // ej: 0.12 %
  desuerado: {
    registrado: boolean;
    horaInicio: string | null;
    horaRegistro: string | null;
    timestampDesuerado?: number | null;
    tiempoDesuerado: string | null;
    segundosDesuerado: number;
    hora40GradosReferencia?: string | null;
    esManual?: boolean;
  };
  // 4. Apartado de Escurrido en Bandeja
  escurrido: EscurridoState;
  telemetria: {
    temperatura: number;
    caudal: number;
  };
}

export interface SalState {
  registrado: boolean;
  horaRegistro?: string | null;
  cantidadGramos: number; // Fórmula: 360 g por cada 300 L de mezcla (1.2 g/L)
  loteSal: string; // Número de lote de la sal
  esManual?: boolean; // Check para ingresar valor manual
}

export interface HiladoEnPailaState {
  iniciado?: boolean;
  completado?: boolean;
  horaInicio?: string | null;
  horaFin?: string | null;
  timestampInicio?: number | null;
  timestampFin?: number | null;
  duracion?: string | null;
  esManual?: boolean;
}

export interface HilarState {
  tempBano: number;
  tempBanoManual?: boolean;
  acidezLA: number;
  phActual: number;
  phActualManual?: boolean;
  pesoTotalQueso: number;
  numeroMoldes: number;
  // 5. Adición de sal (antes del hilado)
  sal: SalState;
  // Prueba de hilado (hebra en agua caliente)
  pruebaHilado: {
    exitosa: boolean;
    horaRegistro: string | null;
    timestampPruebaHilado?: number | null;
    resultado: string;
    tiempoDesdeDesuerado?: string | null;
    esManual?: boolean;
  };
  // Hilado y amasado en paila (con botón inicio y fin)
  hiladoEnPaila: HiladoEnPailaState;
  extruirYAirear: {
    completado: boolean;
    horaFin: string | null;
    timestampExtruirYAirear?: number | null;
    duracion: string | null;
  };
  // Salmuera caliente de hilado (Queso Pera)
  salmuera?: {
    lista?: boolean;
    temperaturaAlcanzada85?: boolean;
    temperaturaValor?: number;
    litrosAgua?: number;
    cantidadSalKg?: number;
    cantidadSalGramos?: number;
    loteSal?: string;
    horaLista?: string | null;
    horaTemperatura85?: string | null;
  };
  // Salmuera fría de enfriamiento (Queso Pera)
  salmueraFria?: {
    preparada: boolean;
    horaRegistro: string | null;
    timestamp?: number | null;
    litrosAgua: number; // 30 L fijos
    salGramos: number;  // 500 g fijos
    loteSal?: string;
  };
  procesoFinalizado: {
    finalizado: boolean;
    horaFinalizacion: string | null;
    tiempoTotalProceso: string | null;
  };
}

export interface MoldesDesglose {
  moldes100g?: number; // Moldes de 100 gramos (0.10 kg)
  moldes200g?: number; // Moldes de 200 gramos (0.20 kg)
  moldes400g: number;  // Moldes de 400 gramos (0.40 kg)
  moldes800g: number;  // Moldes de 800 gramos (0.80 kg)
  moldes1600g: number; // Moldes de 1600 gramos (1.60 kg)
  // Presentaciones principales Queso Pera:
  moldesPeraGrande350g?: number; // Moldes Queso Pera Grande (350 g = 0.35 kg)
  moldesPeraPequeno60g?: number; // Moldes Queso Pera Pequeño (60 g = 0.06 kg)
  // Presentaciones principales Queso 7 Cueros:
  moldes7Cueros350g?: number; // Queso 7 Cueros (350 g = 0.35 kg)
  moldesTrenza350g?: number;   // Queso Trenza (350 g = 0.35 kg)
  moldesQuesadillaArequipe60g?: number; // Quesadilla con Arequipe (60 g = 0.06 kg)
  moldesQuesadillaBocadillo60g?: number; // Quesadilla con Bocadillo (60 g = 0.06 kg)
  pesadoTotalHiladoKg?: number; // Espacio de pesado total del hilado (en báscula)
  pesoTotalCalculadoKg?: number;
  esPesoManual: boolean;
  confirmado?: boolean;
}

export interface LotesLeche {
  loteLeche1: string; // ej: '1-09-26 #1M'
  loteLeche2: string; // ej: '1-09-26 #2A'
  litrosLote1?: number;
  litrosLote2?: number;
  loteLecheBase: string; // compatibilidad
  loteLecheFresca: string; // compatibilidad
  loteCultivoLacteo?: string; // Número de lote del cultivo lácteo industrial / queso pera
  loteCuajoPera?: string; // Lote específico de cuajo seleccionado para Queso Pera
  cultivoLacteoGramos?: number; // Cantidad de cultivo lácteo en gramos
  cultivoLacteoUnidades?: number; // Cantidad en unidades de cultivo lácteo (Queso Pera)
  loteAcidoAcetico?: string; // Lote específico de Ácido Acético (Queso 7 Cueros)
  confirmacionAcidoDiluido5?: boolean; // Checkbox obligatorio dilución 5%
  confirmacionPh535?: boolean; // Checkbox destacado pH 5.35
  acidoBase98Ml?: number; // Ácido base al 98% usado (ml)
  solucionPreparada5Litros?: number; // Solución preparada al 5% (L)
  phRangoConfirmado?: boolean; // Confirmación rango 5.30 - 5.35
  litrosConfirmados?: number; // Último valor confirmado de litros de leche
}

export const LOTES_CUAJO_PERA_DEFAULT = [
  'CJ-2026-09A',
  'CJ-2026-09B',
  'CJ-2026-10A',
];

export const LOTES_LECHE_PROVEEDOR_DEFAULT = [
  '1-09-26 #1M',
  '1-09-26 #2A',
  '1-09-26 #3T',
  '2-09-26 #1M',
  '2-09-26 #2M',
  '31-08-26 #1T',
  '31-08-26 #2M',
];

export const LOTES_CULTIVO_LACTEO_DEFAULT = [
  'AA-2026-12D',
  'AA-2026-08A',
  'AA-2026-33M',
  'AC-2026-01',
  'CL-2026-12D',
  'CL-2026-08A',
  'CL-2026-33M',
  'CL-2026-45T',
  'FERM-2026-01',
];

export interface EspeciaPesaje {
  pesoInicialGramos: number;
  pesoFinalGramos: number;
  pesoUtilizadoGramos: number;
}

export interface DerivacionPastaResultante {
  habilitado: boolean;
  codigoLote: string;
  loteBaseOrigen: string;
  pesoInicialGramos: number; // Insumo total o suma de especias
  pesoFinalGramos: number;
  pesoUtilizadoGramos: number;
  moldes100g: number;
  moldes200g: number;
  moldes350g: number;
  unidades?: number; // Campo directo de unidades para Finas Hierbas o total
  gramosPorUnidad?: number; // Formato en gramos por unidad (ej: 350 g)
  edicionManualAvanzada: boolean;
  // Desglose de especias para Queso Mexicano: Ají Picante y Pimienta
  especiasMexicano?: {
    ajiPicante: EspeciaPesaje;
    pimienta: EspeciaPesaje;
  };
  // Desglose de especias para Queso Finas Hierbas (sin pimienta)
  especiasFinasHierbas?: {
    mezclaHierbas: EspeciaPesaje;
  };
}

export interface DerivacionesBatchState {
  mexicano: DerivacionPastaResultante;
  finasHierbas: DerivacionPastaResultante;
}

export interface QuesadillaArequipeState {
  habilitado: boolean;
  loteArequipe: string;
  pesoInicialGramos: number;
  pesoFinalGramos: number;
  pesoUtilizadoGramos: number; // Calculado: pesoInicialGramos - pesoFinalGramos
  moldes60g: number; // Cantidad de moldes de quesadilla (60 g)
}

export interface QuesadillaBocadilloState {
  habilitado: boolean;
  loteBocadillo: string;
  pesoInicialGramos?: number;
  pesoFinalGramos?: number;
  pesoUtilizadoGramos?: number; // Calculado: pesoInicialGramos - pesoFinalGramos
  moldes60g: number; // Cantidad de moldes de quesadilla (60 g)
  unidadesBocadilloGastadas?: number; // 1 unidad por cada molde de quesadilla
}

export interface Derivaciones7CuerosState {
  arequipe: QuesadillaArequipeState;
  bocadillo: QuesadillaBocadilloState;
}

export interface BatchData {
  id: string;
  productName: string;
  productId: string;
  lineId: string;
  line: string;
  operator: string;
  operatorRole: string;
  responsableProceso?: string; // 1 responsable único asignado al iniciar el proceso
  status: 'NOMINAL' | 'EN AJUSTE' | 'COMPLETADO';
  lotesLeche: LotesLeche;
  loteCuajo: string; // Lote del cuajo
  loteCuajoPera?: string; // Lote específico de cuajo (Queso Pera)
  loteSal: string; // Lote de la sal
  observaciones?: string; // Formulario de observaciones al final del proceso
  operariosIntervinientes?: string[]; // Lista de operarios que intervinieron en el proceso
  moldesDesglose?: MoldesDesglose; // Desglose automático de moldes
  derivaciones?: DerivacionesBatchState; // Derivaciones opcionales: Queso Mexicano y Finas Hierbas (Queso Pera)
  derivaciones7Cueros?: Derivaciones7CuerosState; // Derivaciones opcionales: Quesadillas Arequipe y Bocadillo (7 Cueros)
  processTimer: ProcessTimerState;
  stageStatuses: Record<StageId, 'pendiente' | 'en_proceso' | 'completada'>;
  acidificar: AcidificarState;
  calentarYCuajar: CalentarYCuajarState;
  desuerar: DesuerarState;
  hilar: HilarState;
  auditLogs?: AuditLogEntry[];
}

