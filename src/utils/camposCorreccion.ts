// ============================================================================
// Campos que el administrador puede corregir en un lote, agrupados por las etapas
// reales de cada producto y con nombres claros.
//
// Solo aparecen los datos que el operario registra en cada etapa (y que van a la
// trazabilidad y al Excel). Los valores internos, de configuración o duplicados
// no se muestran. Cada campo sabe qué otros datos dependen de él:
//  - una cantidad que se guarda en dos lugares se corrige en los dos;
//  - una hora corrige también su marca de tiempo interna y vuelve a calcular las
//    duraciones que dependen de ella ("tiempo que tardó en cuajar", etc.);
//  - el saborizante y el colorante de cada sabor actualizan los totales del lote.
// ============================================================================
import { stageLabelFor } from './stageNav';
import { computeDurationBetweenTimes, formatHumanDuration, formatTimeFromStep1, toTimeInputStep1 } from './timer';

type Etapa = 'acidificar' | 'calentar-y-cuajar' | 'desuerar' | 'hilar' | 'moldeo';
const ORDEN_ETAPA: Record<Etapa, number> = { acidificar: 1, 'calentar-y-cuajar': 2, desuerar: 3, hilar: 4, moldeo: 5 };

interface DefNumero {
  tipo: 'numero';
  etapa: Etapa;
  label: string;
  unidad: string;
  /** El primero que exista es el valor; todos los que existan se corrigen juntos. */
  paths: string[];
  esPh?: boolean;
}

interface DefHora {
  tipo: 'hora';
  etapa: Etapa;
  clave: string;
  label: string;
  /** Textos de hora (ej. "10:15:30 am") que se ven en pantalla. Se corrigen todos los que existan. */
  horas?: string[];
  /** Marcas de tiempo internas (milisegundos) que usa la trazabilidad. Conservan su día. */
  ts?: string[];
}

interface DefDuracion {
  desde: string;
  hasta: string;
  texto?: string[];
  segundos?: string[];
}

interface Catalogo {
  campos: (DefNumero | DefHora)[];
  duraciones: DefDuracion[];
}

export interface CampoCorregible {
  id: string;
  tipo: 'numero' | 'hora';
  etapa: Etapa;
  etapaLabel: string;
  orden: number;
  label: string;
  unidad: string;
  /** Ruta principal (la que queda en la auditoría). */
  path: string;
  /** Número, o hora "HH:MM:SS" (24 h) para los campos de hora. */
  valor: number | string;
  /** Cómo se muestra el valor actual. */
  texto: string;
  esPh?: boolean;
}

export interface LoteUsado {
  etapaLabel: string;
  orden: number;
  label: string;
  codigo: string;
}

export interface CambioVinculado {
  path: string;
  value: unknown;
}

// ---------------------------------------------------------------------------
// Utilidades de rutas ("a.b.*.c": el * recorre las posiciones de una lista)
// ---------------------------------------------------------------------------
const expandir = (obj: any, path: string): string[] => {
  const partes = path.split('.');
  let rutas: string[] = [''];
  for (const p of partes) {
    const siguientes: string[] = [];
    for (const r of rutas) {
      if (p === '*') {
        const lista = leer(obj, r);
        if (Array.isArray(lista)) lista.forEach((_, i) => siguientes.push(r ? `${r}.${i}` : String(i)));
      } else {
        siguientes.push(r ? `${r}.${p}` : p);
      }
    }
    rutas = siguientes;
  }
  return rutas;
};

export const leer = (obj: any, path: string): any => {
  if (!path) return obj;
  let cur = obj;
  for (const k of path.split('.')) {
    if (cur === null || cur === undefined) return undefined;
    cur = cur[k];
  }
  return cur;
};

export const escribir = (obj: any, path: string, value: unknown): void => {
  const keys = path.split('.');
  let cur = obj;
  for (let i = 0; i < keys.length - 1; i += 1) {
    if (cur[keys[i]] === null || cur[keys[i]] === undefined || typeof cur[keys[i]] !== 'object') return;
    cur = cur[keys[i]];
  }
  cur[keys[keys.length - 1]] = value;
};

/** Rutas (expandiendo *) cuyo valor existe y cumple la condición. */
const existentes = (obj: any, paths: string[] | undefined, ok: (v: any) => boolean): string[] =>
  (paths ?? []).flatMap((p) => expandir(obj, p)).filter((r) => ok(leer(obj, r)));

const esNumero = (v: any) => typeof v === 'number' && Number.isFinite(v);
const esHoraTexto = (v: any) => typeof v === 'string' && /\d{1,2}:\d{2}/.test(v);
const esMarca = (v: any) => typeof v === 'number' && v > 1e11;

const dosDigitos = (n: number) => String(n).padStart(2, '0');
const horaDeMarca = (ms: number): string => {
  const d = new Date(ms);
  return `${dosDigitos(d.getHours())}:${dosDigitos(d.getMinutes())}:${dosDigitos(d.getSeconds())}`;
};

// ---------------------------------------------------------------------------
// Catálogos por producto
// ---------------------------------------------------------------------------
const P = 'pasteurizacion';
const I = 'inoculacion';
const B = 'batidoYAdiciones';

const horasPasteurizacion = (): (DefNumero | DefHora)[] => [
  { tipo: 'hora', etapa: 'acidificar', clave: 'azucar', label: 'Hora de adición del azúcar', horas: [`${P}.azucar.horaAdicion`] },
  { tipo: 'hora', etapa: 'acidificar', clave: 'cal_ini', label: 'Inicio del calentamiento', horas: [`${P}.calentamiento.horaInicio`], ts: [`${P}.calentamiento.timestampInicio`] },
  { tipo: 'hora', etapa: 'acidificar', clave: 'cal_fin', label: 'Llegada a 85–90 °C', horas: [`${P}.calentamiento.horaLlegada85a90`] },
  { tipo: 'hora', etapa: 'acidificar', clave: 'sos_ini', label: 'Inicio de la retención (85–90 °C)', horas: [`${P}.sostenimiento.horaInicio`], ts: [`${P}.sostenimiento.timestampInicio`] },
  { tipo: 'hora', etapa: 'acidificar', clave: 'sos_fin', label: 'Fin de la retención', horas: [`${P}.sostenimiento.horaFin`] },
  { tipo: 'hora', etapa: 'acidificar', clave: 'enf_ini', label: 'Inicio del enfriamiento', horas: [`${P}.enfriamiento.horaInicio`], ts: [`${P}.enfriamiento.timestampInicioEnfriamiento`] },
  { tipo: 'hora', etapa: 'acidificar', clave: 'enf_fin', label: 'Llegada a la temperatura de siembra', horas: [`${P}.enfriamiento.horaFinEnfriamiento`] },
  { tipo: 'hora', etapa: 'acidificar', clave: 'tra_ini', label: 'Inicio del traslado a cantinas', horas: [`${P}.trasiego.horaInicio`], ts: [`${P}.trasiego.timestampInicio`] },
  { tipo: 'hora', etapa: 'acidificar', clave: 'tra_fin', label: 'Fin del traslado a cantinas', horas: [`${P}.trasiego.horaFin`] },
];
const duracionesPasteurizacion: DefDuracion[] = [
  { desde: 'cal_ini', hasta: 'cal_fin', texto: [`${P}.calentamiento.tiempoCalentamiento`] },
  { desde: 'sos_ini', hasta: 'sos_fin', texto: [`${P}.sostenimiento.duracionReal`] },
  { desde: 'enf_ini', hasta: 'enf_fin', texto: [`${P}.enfriamiento.tiempoEnfriamiento`] },
  { desde: 'tra_ini', hasta: 'tra_fin', texto: [`${P}.trasiego.tiempoTrasiego`] },
];

const horasIncubacion = (): (DefNumero | DefHora)[] => [
  { tipo: 'hora', etapa: 'calentar-y-cuajar', clave: 'mezcla', label: 'Hora de adición / mezclado del cultivo', horas: [`${I}.horaInicioMezclado`] },
  { tipo: 'hora', etapa: 'calentar-y-cuajar', clave: 'inoc', label: 'Hora de inoculación', horas: [`${I}.horaInoculacion`] },
  { tipo: 'hora', etapa: 'calentar-y-cuajar', clave: 'inc_ini', label: 'Inicio de la incubación', horas: [`${I}.incubacion.horaInicio`], ts: [`${I}.incubacion.timestampInicio`] },
  { tipo: 'hora', etapa: 'calentar-y-cuajar', clave: 'inc_fin', label: 'Fin de la incubación', horas: [`${I}.incubacion.horaFin`] },
  { tipo: 'hora', etapa: 'calentar-y-cuajar', clave: 'cf', label: 'Entrada al cuarto frío', horas: [`${I}.incubacion.horaEntradaCuartoFrio`] },
];
const duracionesIncubacion: DefDuracion[] = [
  { desde: 'inc_ini', hasta: 'inc_fin', texto: [`${I}.incubacion.tiempoTranscurrido`] },
];

const envases = (prefijo: string, lista: [string, string][]): DefNumero[] =>
  lista.map(([k, label]) => ({ tipo: 'numero', etapa: 'moldeo', label, unidad: 'unid', paths: [`${prefijo}.${k}`] }));

const ENVASES_YOGUR: [string, string][] = [
  ['botella200ml', 'Envases · Botella 200 ml'],
  ['botella1L', 'Envases · Botella 1 L'],
  ['botella2L', 'Envases · Botella 2 L'],
  ['bolsa4L', 'Envases · Bolsa 4 L'],
  ['sinAzucar_botella200ml', 'Envases sin azúcar · Botella 200 ml'],
  ['sinAzucar_botella1L', 'Envases sin azúcar · Botella 1 L'],
  ['sinAzucar_botella2L', 'Envases sin azúcar · Botella 2 L'],
  ['sinAzucar_bolsa4L', 'Envases sin azúcar · Bolsa 4 L'],
  ['stevia_botella120ml', 'Envases con stevia · Botella 120 ml'],
  ['stevia_botella200ml', 'Envases con stevia · Botella 200 ml'],
  ['stevia_botella1L', 'Envases con stevia · Botella 1 L'],
  ['stevia_botella2L', 'Envases con stevia · Botella 2 L'],
  ['stevia_bolsa4L', 'Envases con stevia · Bolsa 4 L'],
];
const ENVASES_KUMIS: [string, string][] = [
  ['botella1L', 'Envases · Botella 1 L'],
  ['botella2L', 'Envases · Botella 2 L'],
];
const ENVASES_GRIEGO = (grupo: 'formatosSinEstevia' | 'formatosConEstevia', nombre: string): [string, string][] => [
  [`${grupo}.tarrina1000g`, `Envases ${nombre} · Tarrina / vaso 1000 g`],
  [`${grupo}.tarrina500g`, `Envases ${nombre} · Tarrina / vaso 500 g`],
  [`${grupo}.tarrina120g`, `Envases ${nombre} · Tarrina / vaso 120 g`],
  [`${grupo}.bolsa4L`, `Envases ${nombre} · Bolsa 4 L`],
];

function catalogoYogurKumis(batch: any, esYogur: boolean): Catalogo {
  const adiciones = batch?.[B]?.adiciones ?? {};
  const llevaAzucar = batch?.[P]?.llevaAzucar !== false;
  const sabores: any[] = Array.isArray(adiciones.sabores) ? adiciones.sabores : [];
  const campos: (DefNumero | DefHora)[] = [
    { tipo: 'numero', etapa: 'acidificar', label: 'Leche fresca', unidad: 'L', paths: [`${P}.litrosLeche`] },
    { tipo: 'numero', etapa: 'acidificar', label: 'Azúcar agregada en la pasteurización', unidad: 'kg', paths: [`${P}.azucar.cantidadKg`] },
    ...horasPasteurizacion(),
    { tipo: 'numero', etapa: 'calentar-y-cuajar', label: 'Cultivo láctico', unidad: 'cdas', paths: [`${I}.cantidadCultivoCucharadas`, `${I}.cantidadCultivoGramos`] },
    { tipo: 'numero', etapa: 'calentar-y-cuajar', label: 'Tiempo de mezclado del cultivo', unidad: 'min', paths: [`${I}.tiempoMezcladoMinutos`] },
    ...horasIncubacion(),
  ];
  const duraciones: DefDuracion[] = [...duracionesPasteurizacion, ...duracionesIncubacion];

  if (esYogur) {
    // 3. Receta y Sabores
    sabores.forEach((s, i) => {
      const nombre = String(s?.sabor || `Sabor ${i + 1}`);
      campos.push(
        { tipo: 'numero', etapa: 'desuerar', label: `${nombre} › Saborizante`, unidad: 'ml', paths: [`${B}.adiciones.sabores.${i}.saborizanteMl`] },
        { tipo: 'numero', etapa: 'desuerar', label: `${nombre} › Colorante`, unidad: 'ml', paths: [`${B}.adiciones.sabores.${i}.coloranteMl`] }
      );
    });
    if (!llevaAzucar && adiciones.llevaStevia !== false) {
      campos.push({
        tipo: 'numero',
        etapa: 'desuerar',
        label: 'Stevia',
        unidad: 'g',
        paths: [`${B}.adiciones.gramosStevia`, `${B}.adiciones.variedadEstevia.gramosEstevia`],
      });
    }
    campos.push(
      llevaAzucar
        ? {
            tipo: 'hora',
            etapa: 'desuerar',
            clave: 'receta',
            label: 'Hora en que quedó lista la receta',
            horas: [`${B}.adiciones.horaPreparacionReceta`, `${B}.adiciones.horaRegistro`],
          }
        : {
            tipo: 'hora',
            etapa: 'desuerar',
            clave: 'stevia',
            label: adiciones.llevaStevia === false ? 'Hora de confirmación (sin stevia)' : 'Hora de adición de la stevia',
            horas: [
              `${B}.adiciones.horaAdicionStevia`,
              `${B}.adiciones.variedadEstevia.horaAdicion`,
              `${B}.adiciones.horaPreparacionReceta`,
              `${B}.adiciones.horaRegistro`,
            ],
          }
    );
    // 4. Batido y Envasado (un solo cronómetro para todos los sabores)
    campos.push(
      { tipo: 'hora', etapa: 'hilar', clave: 'salida', label: 'Salida del cuarto frío', horas: [`${B}.salidaCuartoFrio.hora`] },
      {
        tipo: 'hora',
        etapa: 'hilar',
        clave: 'bat_ini',
        label: 'Inicio del batido y envasado',
        horas: [`${B}.batidora.horaInicio`, `${B}.lotesSabor.*.batidoInicio`, `${B}.lotesSabor.*.envasadoInicio`],
        ts: [`${B}.batidora.timestampInicio`],
      },
      {
        tipo: 'hora',
        etapa: 'hilar',
        clave: 'bat_fin',
        label: 'Fin del batido y envasado',
        horas: [`${B}.batidora.horaFin`, `${B}.lotesSabor.*.batidoFin`, `${B}.lotesSabor.*.envasadoFin`, `${B}.preparacionTolva.horaPreparacion`],
      }
    );
    duraciones.push({
      desde: 'bat_ini',
      hasta: 'bat_fin',
      texto: [`${B}.batidora.tiempoBatido`, `${B}.lotesSabor.*.tiempoBatido`, `${B}.lotesSabor.*.tiempoEnvasado`, `${B}.lotesSabor.*.tiempoTotal`],
    });
    // Solo los envases que corresponden a este lote (con azúcar, o sin azúcar y con stevia si la llevó).
    const grupo = ENVASES_YOGUR.filter(([k]) =>
      llevaAzucar
        ? !k.includes('_')
        : k.startsWith('sinAzucar_') || (k.startsWith('stevia_') && adiciones.llevaStevia !== false)
    );
    campos.push(...envases('envasado.formatos', grupo));
  } else {
    // Kumis: 3. Envasar y Guardar
    campos.push(
      { tipo: 'hora', etapa: 'moldeo', clave: 'bat_ini', label: 'Inicio del batido y envasado', horas: [`${B}.batidora.horaInicio`], ts: [`${B}.batidora.timestampInicio`] },
      { tipo: 'hora', etapa: 'moldeo', clave: 'bat_fin', label: 'Fin del batido y envasado', horas: [`${B}.batidora.horaFin`] }
    );
    duraciones.push({ desde: 'bat_ini', hasta: 'bat_fin', texto: [`${B}.batidora.tiempoBatido`] });
    campos.push(...envases('envasado.formatos', ENVASES_KUMIS));
  }
  campos.push({ tipo: 'hora', etapa: 'moldeo', clave: 'ingreso', label: 'Ingreso al cuarto frío', horas: ['envasado.almacenamientoCuartoFrio.horaIngreso'] });
  return { campos, duraciones };
}

function catalogoGriego(): Catalogo {
  const M = 'maduracionYFiltrado';
  const F = `${B}.formulacion.variedadConEstevia`;
  const campos: (DefNumero | DefHora)[] = [
    { tipo: 'numero', etapa: 'acidificar', label: 'Leche', unidad: 'L', paths: [`${P}.litrosLeche`] },
    { tipo: 'numero', etapa: 'acidificar', label: 'Acidez de la leche (Dornic)', unidad: '°D', paths: [`${P}.acidezDornic`] },
    { tipo: 'numero', etapa: 'acidificar', label: 'Temperatura de recepción de la leche', unidad: '°C', paths: [`${P}.temperaturaRecepcion`] },
    { tipo: 'numero', etapa: 'acidificar', label: 'Temperatura alcanzada en pasteurización', unidad: '°C', paths: [`${P}.calentamiento.temperaturaAlcanzada`] },
    { tipo: 'numero', etapa: 'acidificar', label: 'Temperatura al terminar de enfriar', unidad: '°C', paths: [`${P}.enfriamiento.temperaturaFinal`] },
    ...horasPasteurizacion(),
    { tipo: 'numero', etapa: 'calentar-y-cuajar', label: 'Temperatura medida en la cantina', unidad: '°C', paths: [`${I}.temperaturaVerificada45`] },
    { tipo: 'numero', etapa: 'calentar-y-cuajar', label: 'Cultivo láctico (cucharadas)', unidad: 'cdas', paths: [`${I}.cantidadCultivoCucharadas`] },
    { tipo: 'numero', etapa: 'calentar-y-cuajar', label: 'Cultivo láctico (gramos)', unidad: 'g', paths: [`${I}.cantidadCultivoGramos`] },
    { tipo: 'numero', etapa: 'calentar-y-cuajar', label: 'Temperatura de incubación', unidad: '°C', paths: [`${I}.incubacion.temperaturaIncubacion`] },
    { tipo: 'numero', etapa: 'calentar-y-cuajar', label: 'pH al terminar de cuajar', unidad: 'pH', paths: [`${I}.incubacion.phFinalIncubacion`], esPh: true },
    ...horasIncubacion(),
    { tipo: 'hora', etapa: 'desuerar', clave: 'cf_ini', label: 'Entrada al cuarto frío', horas: [`${M}.cuartoFrio.horaInicio`], ts: [`${M}.cuartoFrio.timestampInicio`] },
    { tipo: 'hora', etapa: 'desuerar', clave: 'cf_fin', label: 'Salida del cuarto frío', horas: [`${M}.cuartoFrio.horaFin`] },
    { tipo: 'hora', etapa: 'desuerar', clave: 'fil_ini', label: 'Inicio del escurrido en telas', horas: [`${M}.filtradoTelas.horaInicio`], ts: [`${M}.filtradoTelas.timestampInicio`] },
    { tipo: 'hora', etapa: 'desuerar', clave: 'fil_fin', label: 'Fin del escurrido en telas', horas: [`${M}.filtradoTelas.horaFin`] },
    { tipo: 'numero', etapa: 'hilar', label: 'Stevia', unidad: 'g', paths: [`${F}.gramosEstevia`] },
    { tipo: 'hora', etapa: 'hilar', clave: 'stevia', label: 'Hora de adición de la stevia', horas: [`${F}.horaAdicion`, `${B}.formulacion.horaRegistro`] },
    {
      tipo: 'hora',
      etapa: 'hilar',
      clave: 'bat_ini',
      label: 'Inicio del batido y envasado',
      horas: [`${B}.batido.horaInicio`, `${B}.lotesSabor.*.batidoInicio`, `${B}.lotesSabor.*.envasadoInicio`],
      ts: [`${B}.batido.timestampInicio`],
    },
    {
      tipo: 'hora',
      etapa: 'hilar',
      clave: 'bat_fin',
      label: 'Fin del batido y envasado',
      horas: [`${B}.batido.horaFin`, `${B}.lotesSabor.*.batidoFin`, `${B}.lotesSabor.*.envasadoFin`],
    },
    ...envases('envasado', [...ENVASES_GRIEGO('formatosSinEstevia', 'naturales'), ...ENVASES_GRIEGO('formatosConEstevia', 'con stevia')]),
    { tipo: 'hora', etapa: 'moldeo', clave: 'ingreso', label: 'Ingreso al cuarto frío', horas: ['envasado.almacenamientoCuartoFrio.horaIngreso'] },
  ];
  const duraciones: DefDuracion[] = [
    ...duracionesPasteurizacion,
    ...duracionesIncubacion,
    { desde: 'cf_ini', hasta: 'cf_fin', texto: [`${M}.cuartoFrio.tiempoTranscurrido`] },
    { desde: 'fil_ini', hasta: 'fil_fin', texto: [`${M}.filtradoTelas.tiempoTranscurrido`] },
    {
      desde: 'bat_ini',
      hasta: 'bat_fin',
      texto: [`${B}.batido.tiempoBatido`, `${B}.lotesSabor.*.tiempoBatido`, `${B}.lotesSabor.*.tiempoEnvasado`, `${B}.lotesSabor.*.tiempoTotal`],
    },
  ];
  return { campos, duraciones };
}

// Quesos de pasta hilada ------------------------------------------------------
type Queso = 'doble-crema' | 'industrial' | 'pera' | 'siete-cueros';

function catalogoQueso(tipo: Queso): Catalogo {
  const A = 'acidificar';
  const C = 'calentarYCuajar';
  const D = 'desuerar';
  const H = 'hilar';
  const MD = 'moldesDesglose';
  const campos: (DefNumero | DefHora)[] = [];
  const duraciones: DefDuracion[] = [];
  const num = (etapa: Etapa, label: string, unidad: string, paths: string[], esPh = false) =>
    campos.push({ tipo: 'numero', etapa, label, unidad, paths, esPh });
  const hora = (etapa: Etapa, clave: string, label: string, horas: string[], ts: string[] = []) =>
    campos.push({ tipo: 'hora', etapa, clave, label, horas, ts });
  const dur = (desde: string, hasta: string, texto: string[], segundos: string[] = []) =>
    duraciones.push({ desde, hasta, texto, segundos });

  // 1. Acidificar / Leche e insumos
  if (tipo === 'doble-crema') {
    num('acidificar', 'Leche ácida', 'L', ['lotesLeche.litrosLote1', `${A}.insumos.lecheAcida`]);
    num('acidificar', 'Leche fresca', 'L', ['lotesLeche.litrosLote2', `${A}.insumos.lecheFresca`]);
  } else if (tipo === 'industrial') {
    num('acidificar', 'Leche fresca', 'L', [`${A}.insumos.lecheFresca`, 'lotesLeche.litrosLote2']);
    num('acidificar', 'Ácido acético', 'ml', [`${A}.insumos.cultivoLacteoGramos`, 'lotesLeche.cultivoLacteoGramos']);
  } else if (tipo === 'pera') {
    num('acidificar', 'Leche fresca', 'L', [`${A}.insumos.lecheFresca`, 'lotesLeche.litrosConfirmados', 'litrosLeche']);
  } else {
    num('acidificar', 'Leche fresca', 'L', [`${A}.insumos.lecheFresca`, 'lotesLeche.litrosConfirmados', 'lotesLeche.litrosLote1', 'litrosLeche']);
    num('acidificar', 'Ácido acético al 98 %', 'ml', [`${A}.insumos.acidoBase98Ml`, 'lotesLeche.acidoBase98Ml']);
    num('acidificar', 'Agua para preparar el ácido', 'ml', [`${A}.insumos.aguaDiluyenteMl`]);
  }
  num('acidificar', 'pH de recepción de la leche', 'pH', [`${A}.insumos.phFresca`], true);
  num('acidificar', 'pH leche ácida', 'pH', [`${A}.insumos.phAcida`], true);
  if (tipo !== 'pera') {
    num('acidificar', 'pH de la leche (mezcla)', 'pH', [`${A}.insumos.phMezcla`], true);
    num('acidificar', 'Temperatura alcanzada al calentar (35 °C)', '°C', [`${A}.phase1.temperaturaAlcanzada`]);
  }
  hora('acidificar', 'cal_ini', 'Inicio del calentamiento', [`${A}.inicioCalentamiento.horaInicio`], [`${A}.inicioCalentamiento.timestampInicio`]);
  if (tipo !== 'pera') {
    hora('acidificar', 'llegada35', 'Llegada a 35 °C', [`${A}.phase1.horaAlcanzo35`], [`${A}.phase1.timestampAlcanzo35`]);
    dur('cal_ini', 'llegada35', [`${A}.phase1.tiempoCalentamiento`], [`${A}.phase1.segundosCalentamiento`]);
  }
  if (tipo === 'doble-crema' || tipo === 'industrial') {
    num('acidificar', 'Cuajo', 'g', [`${A}.phase2.cantidadCuajoGramos`]);
    hora('acidificar', 'cuajo', 'Hora de adición del cuajo', [`${A}.phase2.horaAdicionCuajo`], [`${A}.phase2.timestampAdicionCuajo`]);
    dur('llegada35', 'cuajo', [`${A}.phase2.tiempoDesde35`]);
    dur('cal_ini', 'cuajo', [`${A}.phase2.tiempoTotalHastaCuajo`]);
  }

  // 2. Cuajar
  if (tipo === 'pera') {
    num('calentar-y-cuajar', 'Temperatura al llegar a 40 °C', '°C', [`${C}.llegada40.temperaturaAlcanzada`]);
    hora('calentar-y-cuajar', 'llegada40', 'Llegada a 40 °C', [`${C}.llegada40.horaRegistro`], [`${C}.llegada40.timestamp40Grados`]);
    dur('cal_ini', 'llegada40', [`${C}.llegada40.tiempoCalentamiento40`]);
    num('calentar-y-cuajar', 'Cultivo láctico', 'cdas', [`${C}.cultivoLacticoPera.cucharadas`, `${A}.insumos.cultivoLacteoUnidades`]);
    hora('calentar-y-cuajar', 'cultivo', 'Hora de adición del cultivo', [`${C}.cultivoLacticoPera.horaRegistro`], [`${C}.cultivoLacticoPera.timestamp`]);
  }
  if (tipo === 'pera' || tipo === 'siete-cueros') {
    num('calentar-y-cuajar', 'Cuajo', 'g', [`${C}.adicionCuajo.cantidadGramos`, `${A}.phase2.cantidadCuajoGramos`]);
    hora(
      'calentar-y-cuajar',
      'cuajo',
      'Hora de adición del cuajo',
      [`${C}.adicionCuajo.horaRegistro`, `${C}.horaAdicionCuajo`],
      [`${C}.adicionCuajo.timestampCuajo`, `${C}.adicionCuajo.timestampAdicionCuajo`]
    );
    if (tipo === 'pera') dur('cultivo', 'cuajo', [`${C}.adicionCuajo.tiempoTranscurridoDesdeCultivo`]);
  }
  hora('calentar-y-cuajar', 'cuajado', 'Hora en que cuajó', [`${C}.cuajado.horaRegistro`], [`${C}.cuajado.timestampCuajado`]);
  dur('cuajo', 'cuajado', [`${C}.cuajado.tiempoTranscurridoDesdeCuajo`], [`${C}.cuajado.segundosCuajado`]);
  hora('calentar-y-cuajar', 'corte', 'Corte terminado', [`${C}.corte.horaRegistro`], [`${C}.corte.timestampCorte`]);
  dur('cuajado', 'corte', [`${C}.corte.tiempoTranscurridoDesdeCuajado`]);
  if (tipo === 'pera') {
    num('calentar-y-cuajar', 'pH al terminar el reposo', 'pH', [`${C}.finReposoPh58.phAlcanzado`], true);
    hora('calentar-y-cuajar', 'ph58', 'Llegada a pH 5.8 (fin del reposo)', [`${C}.finReposoPh58.horaRegistro`], [`${C}.finReposoPh58.timestampPh58`]);
    dur('corte', 'ph58', [`${C}.finReposoPh58.tiempoTotalReposo`]);
  } else {
    num('calentar-y-cuajar', 'Temperatura alcanzada (40 °C)', '°C', [`${C}.temperatura40.temperaturaAlcanzada`]);
    hora('calentar-y-cuajar', 'llegada40', 'Llegada a 40 °C', [`${C}.temperatura40.horaRegistro`], [`${C}.temperatura40.timestamp40Grados`]);
    dur('cuajado', 'llegada40', [`${C}.temperatura40.tiempoCalentamiento40`]);
  }

  // 3. Desuerar y escurrir
  num('desuerar', 'Temperatura en el desuerado', '°C', [`${D}.temperaturaVerificada`]);
  num('desuerar', 'Acidez del lactosuero', '% LA', [`${D}.acidezSuero`]);
  num('desuerar', 'pH en el escurrido', 'pH', [`${D}.escurrido.phEscurrido`], true);
  hora('desuerar', 'desuerado', 'Fin del desuerado', [`${D}.desuerado.horaRegistro`], [`${D}.desuerado.timestampDesuerado`]);
  dur(tipo === 'pera' ? 'ph58' : 'llegada40', 'desuerado', [`${D}.desuerado.tiempoDesuerado`], [`${D}.desuerado.segundosDesuerado`]);
  hora('desuerar', 'camilla', 'Paso a camilla (inicio del escurrido)', [`${D}.escurrido.horaInicio`], [`${D}.escurrido.timestampInicio`]);
  dur('desuerado', 'camilla', [`${D}.escurrido.tiempoTraslado`], [`${D}.escurrido.segundosTraslado`]);
  hora('desuerar', 'escurrido_fin', 'Fin del escurrido', [`${D}.escurrido.horaFin`], [`${D}.escurrido.timestampFin`]);
  dur('camilla', 'escurrido_fin', [`${D}.escurrido.tiempoEscurrido`], [`${D}.escurrido.segundosEscurrido`]);

  // 4. Hilar
  num('hilar', 'pH de hilado', 'pH', [`${H}.phActual`], true);
  num('hilar', 'Acidez de la masa al hilar', '% LA', [`${H}.acidezLA`]);
  num('hilar', 'Temperatura del baño de hilado', '°C', [`${H}.tempBano`]);
  if (tipo === 'pera') {
    num('hilar', 'Temperatura de la salmuera caliente', '°C', [`${H}.salmuera.temperaturaValor`]);
    num('hilar', 'Sal de la salmuera caliente', 'g', [`${H}.salmuera.cantidadSalGramos`, `${H}.sal.cantidadGramos`]);
    num('hilar', 'Sal de la salmuera fría', 'g', [`${H}.salmueraFria.salGramos`]);
  } else {
    num('hilar', 'Sal', 'g', [`${H}.sal.cantidadGramos`]);
    hora('hilar', 'sal', 'Hora en que se agregó la sal', [`${H}.sal.horaRegistro`]);
  }
  hora('hilar', 'prueba', 'Prueba de hilado', [`${H}.pruebaHilado.horaRegistro`], [`${H}.pruebaHilado.timestampPruebaHilado`]);
  dur('desuerado', 'prueba', [`${H}.pruebaHilado.tiempoDesdeDesuerado`]);
  hora('hilar', 'paila_ini', 'Inicio del hilado en paila', [`${H}.hiladoEnPaila.horaInicio`], [`${H}.hiladoEnPaila.timestampInicio`]);
  hora('hilar', 'paila_fin', 'Fin del hilado en paila', [`${H}.hiladoEnPaila.horaFin`], [`${H}.hiladoEnPaila.timestampFin`]);
  dur('paila_ini', 'paila_fin', [`${H}.hiladoEnPaila.duracion`]);
  num('hilar', 'Número de moldes llenados', 'unid', [`${H}.numeroMoldes`]);
  num('hilar', 'Peso total de queso obtenido', 'kg', [`${H}.pesoTotalQueso`]);

  // 5. Moldear y pesar
  if (tipo === 'pera') {
    num('moldeo', 'Moldes Pera grande (350 g)', 'unid', [`${MD}.moldesPeraGrande350g`]);
    num('moldeo', 'Moldes Pera pequeño (60 g)', 'unid', [`${MD}.moldesPeraPequeno60g`]);
    for (const [der, nombre] of [['mexicano', 'Mexicano'], ['finasHierbas', 'Finas Hierbas']] as const) {
      for (const g of [100, 200, 350]) num('moldeo', `${nombre} · Moldes de ${g} g`, 'unid', [`derivaciones.${der}.moldes${g}g`]);
    }
  } else if (tipo === 'siete-cueros') {
    num('moldeo', 'Moldes 7 Cueros (350 g)', 'unid', [`${MD}.moldes7Cueros350g`]);
    num('moldeo', 'Moldes Trenza (350 g)', 'unid', [`${MD}.moldesTrenza350g`]);
    num('moldeo', 'Quesadillas de bocadillo (60 g)', 'unid', [`${MD}.moldesQuesadillaBocadillo60g`]);
    num('moldeo', 'Quesadillas de arequipe (60 g)', 'unid', [`${MD}.moldesQuesadillaArequipe60g`]);
  } else {
    for (const g of [100, 200, 400, 800, 1600]) num('moldeo', `Moldes de ${g} g`, 'unid', [`${MD}.moldes${g}g`]);
  }
  return { campos, duraciones };
}

function catalogo(batch: any, productId: string): Catalogo | null {
  switch (productId) {
    case 'prod-yogur':
      return catalogoYogurKumis(batch, true);
    case 'prod-kumis':
      return catalogoYogurKumis(batch, false);
    case 'prod-yogur-griego':
      return catalogoGriego();
    case 'prod-doble-crema-premium':
      return catalogoQueso('doble-crema');
    case 'prod-doble-crema-industrial':
      return catalogoQueso('industrial');
    case 'prod-queso-pera':
      return catalogoQueso('pera');
    case 'prod-queso-7-cueros':
      return catalogoQueso('siete-cueros');
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Lectura de horas
// ---------------------------------------------------------------------------
/** Hora "HH:MM:SS" (24 h) de un campo de hora, o null si no tiene. */
const horaActual = (batch: any, def: DefHora): string | null => {
  const ts = existentes(batch, def.ts, esMarca)[0];
  if (ts) return horaDeMarca(leer(batch, ts));
  const h = existentes(batch, def.horas, esHoraTexto)[0];
  return h ? toTimeInputStep1(leer(batch, h)) : null;
};

/** Momento (ms) de una hora para calcular duraciones: marca interna si la tiene. */
const momento = (batch: any, def: DefHora): { ms: number | null; texto: string | null } => {
  const ts = existentes(batch, def.ts, esMarca)[0];
  const h = existentes(batch, def.horas, esHoraTexto)[0];
  return { ms: ts ? leer(batch, ts) : null, texto: h ? leer(batch, h) : null };
};

const texto12 = (hhmmss: string) => formatTimeFromStep1(hhmmss);

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------
export function camposCorregibles(batch: any, productId: string): CampoCorregible[] {
  const cat = catalogo(batch, productId);
  if (!cat) return [];
  const out: CampoCorregible[] = [];
  cat.campos.forEach((def, i) => {
    const etapaLabel = stageLabelFor(productId, def.etapa);
    const orden = ORDEN_ETAPA[def.etapa] * 1000 + i;
    if (def.tipo === 'numero') {
      const rutas = existentes(batch, def.paths, esNumero);
      if (rutas.length === 0) return;
      const valor = leer(batch, rutas[0]) as number;
      out.push({
        id: `n:${def.paths[0]}`,
        tipo: 'numero',
        etapa: def.etapa,
        etapaLabel,
        orden,
        label: def.label,
        unidad: def.unidad,
        path: rutas[0],
        valor,
        texto: `${valor}${def.unidad && def.unidad !== 'unid' ? ` ${def.unidad}` : ''}`,
        esPh: def.esPh,
      });
    } else {
      const h = horaActual(batch, def);
      if (!h) return;
      const principal =
        existentes(batch, def.horas, esHoraTexto)[0] ?? existentes(batch, def.ts, esMarca)[0];
      out.push({
        id: `h:${def.clave}`,
        tipo: 'hora',
        etapa: def.etapa,
        etapaLabel,
        orden,
        label: def.label,
        unidad: 'hora',
        path: principal,
        valor: h,
        texto: texto12(h),
      });
    }
  });
  return out.sort((a, b) => a.orden - b.orden);
}

/**
 * Cambios que produce corregir un campo: el propio y los vinculados.
 * Devuelve error si el valor no es válido o deja una duración negativa.
 */
export function cambiosDeCorreccion(
  batch: any,
  productId: string,
  campo: CampoCorregible,
  nuevo: number | string
): { cambios: CambioVinculado[]; error?: string } {
  const cat = catalogo(batch, productId);
  if (!cat) return { cambios: [], error: 'Este producto no tiene campos corregibles.' };
  const copia = JSON.parse(JSON.stringify(batch));
  const cambios = new Map<string, unknown>();
  const poner = (path: string, value: unknown) => {
    escribir(copia, path, value);
    cambios.set(path, value);
  };

  if (campo.tipo === 'numero') {
    const def = cat.campos.find((d) => d.tipo === 'numero' && `n:${d.paths[0]}` === campo.id) as DefNumero | undefined;
    if (!def) return { cambios: [], error: 'Campo no encontrado.' };
    const v = Number(nuevo);
    if (!Number.isFinite(v) || v < 0) return { cambios: [], error: 'El valor debe ser un número igual o mayor que 0.' };
    if (def.esPh && v > 14) return { cambios: [], error: 'El pH debe estar entre 0 y 14.' };
    for (const r of existentes(batch, def.paths, esNumero)) poner(r, v);
    // Totales del yogur por sabor: el lote guarda también la suma de saborizante y colorante.
    if (/\.adiciones\.sabores\.\d+\.(saborizanteMl|coloranteMl)$/.test(campo.path)) {
      const sabores: any[] = leer(copia, `${B}.adiciones.sabores`) ?? [];
      const totalSab = sabores.reduce((a, s) => a + (Number(s?.saborizanteMl) || 0), 0);
      const totalCol = sabores.reduce((a, s) => a + (Number(s?.coloranteMl) || 0), 0);
      for (const r of existentes(copia, [`${B}.adiciones.saborizanteMl`, `${B}.adiciones.variedadAzucar.saborizanteMl`], esNumero)) poner(r, totalSab);
      for (const r of existentes(copia, [`${B}.adiciones.coloranteMl`, `${B}.adiciones.variedadAzucar.coloranteMl`], esNumero)) poner(r, totalCol);
    }
    return { cambios: Array.from(cambios, ([path, value]) => ({ path, value })) };
  }

  // Hora
  const def = cat.campos.find((d) => d.tipo === 'hora' && `h:${d.clave}` === campo.id) as DefHora | undefined;
  if (!def) return { cambios: [], error: 'Campo no encontrado.' };
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(String(nuevo).trim());
  if (!m || Number(m[1]) > 23 || Number(m[2]) > 59 || Number(m[3] ?? 0) > 59) {
    return { cambios: [], error: 'Escribe una hora válida (hh:mm:ss).' };
  }
  const hhmmss = `${dosDigitos(Number(m[1]))}:${m[2]}:${m[3] ?? '00'}`;
  for (const r of existentes(batch, def.horas, esHoraTexto)) poner(r, texto12(hhmmss));
  for (const r of existentes(batch, def.ts, esMarca)) {
    const d = new Date(leer(batch, r));
    d.setHours(Number(m[1]), Number(m[2]), Number(m[3] ?? 0), 0);
    poner(r, d.getTime());
  }

  // Duraciones que dependen de esta hora
  const porClave = new Map(cat.campos.filter((d): d is DefHora => d.tipo === 'hora').map((d) => [d.clave, d]));
  for (const du of cat.duraciones) {
    if (du.desde !== def.clave && du.hasta !== def.clave) continue;
    const a = porClave.get(du.desde);
    const b = porClave.get(du.hasta);
    if (!a || !b) continue;
    const ia = momento(copia, a);
    const ib = momento(copia, b);
    let segundos: number | null = null;
    if (ia.ms !== null && ib.ms !== null) {
      segundos = Math.round((ib.ms - ia.ms) / 1000);
      if (segundos < 0) {
        return {
          cambios: [],
          error: `Con esa hora, "${b.label}" quedaría antes de "${a.label}". Revisa la hora.`,
        };
      }
    } else if (ia.texto && ib.texto) {
      segundos = computeDurationBetweenTimes(ia.texto, ib.texto).seconds;
    }
    if (segundos === null) continue;
    for (const r of existentes(copia, du.texto, (v) => v === null || typeof v === 'string')) poner(r, formatHumanDuration(segundos));
    for (const r of existentes(copia, du.segundos, (v) => v === null || typeof v === 'number')) poner(r, segundos);
  }
  return { cambios: Array.from(cambios, ([path, value]) => ({ path, value })) };
}

// ---------------------------------------------------------------------------
// Lotes de insumos usados (solo para consultar)
// ---------------------------------------------------------------------------
const NOMBRE_LOTE: Record<string, string> = {
  loteLeche: 'Leche',
  loteLeche1: 'Leche (lote 1)',
  loteLeche2: 'Leche (lote 2)',
  loteLecheBase: 'Leche ácida',
  loteLecheFresca: 'Leche fresca',
  loteCultivo: 'Cultivo láctico',
  loteCultivoLacticoPastur: 'Cultivo láctico',
  loteCultivoLacteo: 'Cultivo láctico / ácido',
  loteAzucar: 'Azúcar',
  loteAzucarPastur: 'Azúcar',
  loteEstevia: 'Stevia',
  loteStevia: 'Stevia',
  loteCuajo: 'Cuajo',
  loteCuajoPera: 'Cuajo',
  loteSal: 'Sal',
  loteAcidoAcetico: 'Ácido acético',
  loteBocadillo: 'Bocadillo',
  loteArequipe: 'Arequipe',
  loteYogurSinAzucar: 'Yogur sin azúcar de origen',
};
const ETAPA_DE_RAIZ: Record<string, Etapa> = {
  pasteurizacion: 'acidificar',
  inoculacion: 'calentar-y-cuajar',
  maduracionYFiltrado: 'desuerar',
  envasado: 'moldeo',
  lotesLeche: 'acidificar',
  acidificar: 'acidificar',
  calentarYCuajar: 'calentar-y-cuajar',
  desuerar: 'desuerar',
  hilar: 'hilar',
  moldesDesglose: 'moldeo',
  derivaciones: 'moldeo',
  derivaciones7Cueros: 'moldeo',
  loteCuajo: 'calentar-y-cuajar',
  loteCuajoPera: 'calentar-y-cuajar',
  loteSal: 'hilar',
  loteLeche: 'acidificar',
};

export function lotesUsados(batch: any, productId: string): LoteUsado[] {
  const out: LoteUsado[] = [];
  const vistos = new Set<string>();
  const agregar = (etapa: Etapa, label: string, codigo: string) => {
    const c = codigo.trim();
    if (!c || vistos.has(`${label}|${c}`)) return;
    vistos.add(`${label}|${c}`);
    out.push({ etapaLabel: stageLabelFor(productId, etapa), orden: ORDEN_ETAPA[etapa], label, codigo: c });
  };
  const adiciones = batch?.[B]?.adiciones;
  const sabores: any[] = Array.isArray(adiciones?.sabores) ? adiciones.sabores : [];
  sabores.forEach((s) => {
    const sabor = String(s?.sabor || 'Sabor');
    if (s?.loteSaborizante) agregar('desuerar', `Saborizante (${sabor})`, String(s.loteSaborizante));
    if (s?.loteColorante && Number(s?.coloranteMl) > 0) agregar('desuerar', `Colorante (${sabor})`, String(s.loteColorante));
  });
  const recorrer = (n: any, ruta: string[]) => {
    if (!n || typeof n !== 'object') return;
    for (const [k, v] of Object.entries(n)) {
      if (k === 'sabores' || k === 'variedadAzucar' || k === 'processTimer') continue;
      if (typeof v === 'string' && NOMBRE_LOTE[k]) {
        const raiz = ruta[0] ?? k;
        let etapa: Etapa = ETAPA_DE_RAIZ[raiz] ?? 'acidificar';
        if (raiz === B) etapa = productId === 'prod-yogur-griego' ? 'hilar' : 'desuerar';
        agregar(etapa, NOMBRE_LOTE[k], v);
      } else if (v && typeof v === 'object' && !Array.isArray(v)) {
        recorrer(v, [...ruta, k]);
      }
    }
  };
  recorrer(batch, []);
  // Lotes antiguos sin receta por sabor: saborizante y colorante del lote completo.
  if (sabores.length === 0 && adiciones) {
    const va = adiciones.variedadAzucar ?? {};
    const sab = adiciones.loteSaborizante || va.loteSaborizante;
    const col = adiciones.loteColorante || va.loteColorante;
    if (sab) agregar('desuerar', 'Saborizante', String(sab));
    if (col) agregar('desuerar', 'Colorante', String(col));
  }
  return out.sort((a, b) => a.orden - b.orden);
}

// ---------------------------------------------------------------------------
// Alinear marcas internas con las horas escritas a mano
// ---------------------------------------------------------------------------
/**
 * En varios pasos, la "edición manual" de una hora cambia el texto que se ve pero no la
 * marca interna (milisegundos) que usa la trazabilidad y el Excel. Antes de guardar el
 * lote se alinean: si la hora escrita no coincide con la marca, la marca toma esa hora
 * (en el día más cercano, por si cruzó la medianoche). Devuelve el mismo objeto si no
 * hay nada que alinear.
 */
export function alinearMarcasDeTiempo<T>(batch: T, productId: string): T {
  try {
    const cat = catalogo(batch, productId);
    if (!cat) return batch;
    let copia: any = null;
    for (const def of cat.campos) {
      if (def.tipo !== 'hora' || !def.ts?.length || !def.horas?.length) continue;
      const fuente = copia ?? batch;
      const h = existentes(fuente, def.horas, esHoraTexto)[0];
      if (!h) continue;
      const hhmmss = toTimeInputStep1(leer(fuente, h));
      const [hh, mm, ss] = hhmmss.split(':').map(Number);
      for (const r of existentes(fuente, def.ts, esMarca)) {
        const actual = leer(fuente, r) as number;
        if (horaDeMarca(actual) === hhmmss) continue;
        const base = new Date(actual);
        base.setHours(hh, mm, ss || 0, 0);
        const candidatos = [base.getTime() - 86400000, base.getTime(), base.getTime() + 86400000];
        const elegido = candidatos.reduce((a, b) => (Math.abs(b - actual) < Math.abs(a - actual) ? b : a));
        if (!copia) copia = JSON.parse(JSON.stringify(batch));
        escribir(copia, r, elegido);
      }
    }
    return (copia ?? batch) as T;
  } catch {
    return batch;
  }
}
