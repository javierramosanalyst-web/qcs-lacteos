import { AsyncLocalStorage } from 'async_hooks';
import { PoolClient } from 'pg';

type Json = Record<string, any>;

const num = (v: unknown): number | null => {
  const n = typeof v === 'string' ? parseFloat(v.replace(',', '.')) : Number(v);
  return v !== null && v !== undefined && v !== '' && Number.isFinite(n) ? n : null;
};

const ts = (v: unknown): Date | null => {
  const n = num(v);
  return n && n > 1_000_000_000_000 ? new Date(n) : null;
};

const isPera = (b: Json): boolean => b.productId === 'prod-queso-pera';
const isFerm = (b: Json): boolean => ['prod-yogur', 'prod-kumis', 'prod-yogur-griego'].includes(b.productId);
const isGriego = (b: Json): boolean => b.productId === 'prod-yogur-griego';
const baseDateStore = new AsyncLocalStorage<Date>();

const horaTs = (v: unknown): number | null => {
  if (typeof v !== 'string') return null;
  const m = v.trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([ap]m)?$/i);
  if (!m) return null;
  let h = Number(m[1]);
  const ap = m[4]?.toLowerCase();
  if (ap === 'pm' && h < 12) h += 12;
  if (ap === 'am' && h === 12) h = 0;
  const d = new Date(baseDateStore.getStore() ?? Date.now());
  d.setHours(h, Number(m[2]), Number(m[3] ?? 0), 0);
  return d.getTime();
};

const anyTs = (v: unknown): number | null => (typeof v === 'string' ? horaTs(v) : num(v));

const is7C = (b: Json): boolean => b.productId === 'prod-queso-7-cueros';

const parseDuracion = (v: unknown): number | null => {
  if (typeof v !== 'string') return null;
  const m = v.match(/(?:(\d+)\s*h)?\s*(?:(\d+)\s*min)?\s*(?:(\d+)\s*s)?/i);
  if (!m || (!m[1] && !m[2] && !m[3])) return null;
  return Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
};

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

interface Hito {
  etapa: string;
  codigo: string;
  inicio: Date | null;
  fin: Date | null;
  duracion: number | null;
  manual: boolean;
}

interface Medicion {
  etapa: string;
  parametro: string;
  valor: number | null;
  manual: boolean;
  at: Date | null;
}

interface Insumo {
  etapa: string | null;
  tipo: string;
  nombre: string;
  codigo: string;
  unidad: string;
  cantidad: number | null;
  manual: boolean;
  at: Date | null;
}

function collectHitosPera(b: Json, add: (etapa: string, codigo: string, inicio: unknown, fin: unknown, duracion: unknown, manual: unknown) => void): void {
  const a = b.acidificar ?? {};
  add('acidificar', 'inicio_calentamiento', a.inicioCalentamiento?.timestampInicio, null, null, false);
  const c = b.calentarYCuajar ?? {};
  add('calentar-y-cuajar', 'llegada_40', c.llegada40?.timestamp40Grados, null, parseDuracion(c.llegada40?.tiempoCalentamiento40), c.llegada40?.esManual);
  add('calentar-y-cuajar', 'cultivo_lactico', c.cultivoLacticoPera?.timestamp, null, null, c.cultivoLacticoPera?.esManual);
  add('calentar-y-cuajar', 'adicion_cuajo_pera', c.adicionCuajo?.timestampCuajo, null, parseDuracion(c.adicionCuajo?.tiempoTranscurridoDesdeCultivo), c.adicionCuajo?.esManual);
  add('calentar-y-cuajar', 'cuajado', c.cuajado?.timestampCuajado, null, parseDuracion(c.cuajado?.tiempoTranscurridoDesdeCuajo), c.cuajado?.esManual);
  add('calentar-y-cuajar', 'corte', c.corte?.timestampCorte, null, parseDuracion(c.corte?.tiempoTranscurridoDesdeCuajado), c.corte?.esManual);
  add('calentar-y-cuajar', 'fin_reposo_ph58', c.finReposoPh58?.timestampPh58, null, parseDuracion(c.finReposoPh58?.tiempoTotalReposo), c.finReposoPh58?.esManual);
  const d = b.desuerar ?? {};
  add('desuerar', 'desuerado', d.desuerado?.timestampDesuerado, null, d.desuerado?.segundosDesuerado, d.desuerado?.esManual);
  add('desuerar', 'escurrido', d.escurrido?.timestampInicio, d.escurrido?.timestampFin, d.escurrido?.segundosEscurrido, d.escurrido?.tiempoManual);
  const h = b.hilar ?? {};
  add('hilar', 'prueba_hilado', h.pruebaHilado?.timestampPruebaHilado, null, parseDuracion(h.pruebaHilado?.tiempoDesdeDesuerado), h.pruebaHilado?.esManual);
  const ini = num(h.hiladoEnPaila?.timestampInicio);
  const dur = parseDuracion(h.hiladoEnPaila?.duracion);
  add('hilar', 'hilado_en_paila', ini, ini !== null && dur !== null ? ini + dur * 1000 : null, dur, h.hiladoEnPaila?.esManual);
  add('hilar', 'salmuera_fria', h.salmueraFria?.timestamp, null, null, false);
}

function collectHitosFerm(b: Json): Hito[] {
  const out: Hito[] = [];
  const add = (etapa: string, codigo: string, inicio: unknown, fin: unknown, duracion: unknown, manual: unknown) => {
    const i = anyTs(inicio);
    const f = anyTs(fin);
    if (!i && !f) return;
    const d = typeof duracion === 'string' ? parseDuracion(duracion) : num(duracion);
    out.push({
      etapa,
      codigo,
      inicio: ts(i ?? f),
      fin: i && f ? ts(f) : null,
      duracion: d !== null && d >= 0 ? Math.round(d) : null,
      manual: manual === true,
    } as unknown as Hito);
  };
  const p = b.pasteurizacion ?? {};
  add('acidificar', 'calentamiento', p.calentamiento?.timestampInicio ?? p.calentamiento?.horaInicio, p.calentamiento?.horaLlegada85a90 ?? p.calentamiento?.horaFin, parseDuracion(p.calentamiento?.tiempoCalentamiento), p.calentamiento?.esManual);
  add('acidificar', 'sostenimiento_termico', p.sostenimiento?.timestampInicio ?? p.sostenimiento?.horaInicio, p.sostenimiento?.horaFin, parseDuracion(p.sostenimiento?.duracionReal), false);
  add('acidificar', 'adicion_azucar', p.azucar?.horaAdicion, null, null, p.azucar?.esManual);
  add('acidificar', 'enfriamiento', p.enfriamiento?.timestampInicioEnfriamiento ?? p.enfriamiento?.horaInicio, p.enfriamiento?.horaFinEnfriamiento, parseDuracion(p.enfriamiento?.tiempoEnfriamiento), p.enfriamiento?.esManual);
  add('acidificar', 'trasiego_cantinas', p.trasiego?.timestampInicio ?? p.trasiego?.horaInicio, p.trasiego?.horaFin, parseDuracion(p.trasiego?.tiempoTrasiego), false);
  const i = b.inoculacion ?? {};
  add('calentar-y-cuajar', 'mezclado_cultivo', i.horaInicioMezclado, null, (num(i.tiempoMezcladoMinutos) ?? 0) * 60, i.esManualMezclado);
  add('calentar-y-cuajar', 'inoculacion', i.horaInoculacion, null, null, false);
  add('calentar-y-cuajar', 'incubacion', i.incubacion?.timestampInicio ?? i.incubacion?.horaInicio, i.incubacion?.horaFin, parseDuracion(i.incubacion?.tiempoTranscurrido), i.incubacion?.esManual);
  const m = b.maduracionFrio ?? {};
  add('desuerar', 'traslado_cantinas_frio', m.trasladoCantinas?.horaInicio, m.trasladoCantinas?.horaFin, parseDuracion(m.trasladoCantinas?.tiempoTraslado), m.trasladoCantinas?.esManual);
  add('desuerar', 'refrigeracion', m.refrigeracion?.timestampInicio ?? m.refrigeracion?.horaInicio, m.refrigeracion?.horaFin, parseDuracion(m.refrigeracion?.tiempoTranscurrido), m.refrigeracion?.esManual);
  const g = b.maduracionYFiltrado ?? {};
  add('desuerar', 'cuarto_frio', g.cuartoFrio?.timestampInicio ?? g.cuartoFrio?.horaInicio, g.cuartoFrio?.horaFin, parseDuracion(g.cuartoFrio?.tiempoTranscurrido), false);
  add('desuerar', 'filtrado_telas', g.filtradoTelas?.timestampInicio ?? g.filtradoTelas?.horaInicio, g.filtradoTelas?.horaFin, parseDuracion(g.filtradoTelas?.tiempoTranscurrido), g.filtradoTelas?.esManual);
  const bt = b.batidoYAdiciones ?? {};
  const bb = bt.batidora ?? bt.batido ?? {};
  add('hilar', 'batido', bb.horaInicio, bb.horaFin, parseDuracion(bb.tiempoBatido), bb.esManual);
  add('hilar', 'salida_cuarto_frio', bt.salidaCuartoFrio?.hora, null, null, false);
  for (const l of (Array.isArray(bt.lotesSabor) ? bt.lotesSabor : []) as Json[]) {
    const clave = String(l.sabor ?? l.id).toLowerCase().replace(/[^a-z0-9]+/g, '_');
    add('hilar', `batido_${clave}`, l.batidoInicio, l.batidoFin, parseDuracion(l.tiempoBatido), false);
    add('hilar', `envasado_${clave}`, l.envasadoInicio, l.envasadoFin, parseDuracion(l.tiempoEnvasado), false);
    add('hilar', `batido_a_envasado_${clave}`, l.batidoInicio, l.envasadoFin, parseDuracion(l.tiempoTotal), false);
  }
  add('hilar', 'adiciones', bt.adiciones?.horaRegistro ?? bt.formulacion?.horaRegistro, null, null, false);
  add('hilar', 'preparacion_tolva', bt.preparacionTolva?.horaPreparacion, null, null, false);
  const e = b.envasado ?? {};
  add('moldeo', 'ingreso_cuarto_frio_final', e.almacenamientoCuartoFrio?.horaIngreso, null, null, false);
  add('moldeo', 'proceso_finalizado', e.procesoFinalizado?.horaFinalizacion, null, parseDuracion(e.procesoFinalizado?.tiempoTotalProceso), false);
  return out;
}

function collectHitos(b: Json): Hito[] {
  if (isFerm(b)) return collectHitosFerm(b);
  const out: Hito[] = [];
  const add = (etapa: string, codigo: string, inicio: unknown, fin: unknown, duracion: unknown, manual: unknown) => {
    const i = ts(inicio);
    const f = ts(fin);
    if (!i && !f) return;
    const d = num(duracion);
    out.push({
      etapa,
      codigo,
      inicio: i ?? f,
      fin: i && f ? f : null,
      duracion: d !== null && d >= 0 ? Math.round(d) : null,
      manual: manual === true,
    });
  };
  if (isPera(b)) {
    collectHitosPera(b, add);
    return out;
  }
  if (is7C(b)) {
    const a7 = b.acidificar ?? {};
    const c7 = b.calentarYCuajar ?? {};
    const d7 = b.desuerar ?? {};
    const h7 = b.hilar ?? {};
    add('acidificar', 'inicio_calentamiento', a7.inicioCalentamiento?.timestampInicio, null, null, false);
    add('acidificar', 'temperatura_35_alcanzada', a7.phase1?.timestampAlcanzo35, null, a7.phase1?.segundosCalentamiento, a7.phase1?.temperaturaManual);
    add('calentar-y-cuajar', 'adicion_cuajo', c7.adicionCuajo?.timestampCuajo, null, null, c7.adicionCuajo?.esManual);
    add('calentar-y-cuajar', 'cuajado', c7.cuajado?.timestampCuajado, null, c7.cuajado?.segundosCuajado ?? parseDuracion(c7.cuajado?.tiempoTranscurridoDesdeCuajo), c7.cuajado?.esManual);
    add('calentar-y-cuajar', 'corte', c7.corte?.timestampCorte, null, parseDuracion(c7.corte?.tiempoTranscurridoDesdeCuajado), c7.corte?.esManual);
    add('calentar-y-cuajar', 'temperatura_40_alcanzada', c7.temperatura40?.timestamp40Grados, null, parseDuracion(c7.temperatura40?.tiempoCalentamiento40), c7.temperatura40?.esManual);
    add('desuerar', 'desuerado', d7.desuerado?.timestampDesuerado, null, d7.desuerado?.segundosDesuerado, d7.desuerado?.esManual);
    add('desuerar', 'escurrido', d7.escurrido?.timestampInicio, d7.escurrido?.timestampFin, d7.escurrido?.segundosEscurrido, d7.escurrido?.tiempoManual);
    add('hilar', 'prueba_hilado', h7.pruebaHilado?.timestampPruebaHilado, null, parseDuracion(h7.pruebaHilado?.tiempoDesdeDesuerado), h7.pruebaHilado?.esManual);
    const ini7 = num(h7.hiladoEnPaila?.timestampInicio);
    const fin7 = num(h7.hiladoEnPaila?.timestampFin);
    add('hilar', 'hilado_en_paila', ini7, fin7, parseDuracion(h7.hiladoEnPaila?.duracion), h7.hiladoEnPaila?.esManual);
    return out;
  }
  const a = b.acidificar ?? {};
  add('acidificar', 'inicio_calentamiento', a.inicioCalentamiento?.timestampInicio, null, null, false);
  add('acidificar', 'temperatura_35_alcanzada', a.phase1?.timestampAlcanzo35, null, a.phase1?.segundosCalentamiento, a.phase1?.temperaturaManual);
  add('acidificar', 'adicion_cuajo', a.phase2?.timestampAdicionCuajo, null, null, a.phase2?.esCuajoManual);
  const c = b.calentarYCuajar ?? {};
  add('calentar-y-cuajar', 'adicion_cuajo_pera', c.adicionCuajo?.timestampCuajo, null, null, c.adicionCuajo?.esManual);
  add('calentar-y-cuajar', 'cuajado', c.cuajado?.timestampCuajado, null, c.cuajado?.segundosCuajado, c.cuajado?.esManual);
  add('calentar-y-cuajar', 'corte', c.corte?.timestampCorte, null, null, c.corte?.esManual);
  add('calentar-y-cuajar', 'temperatura_40_alcanzada', c.temperatura40?.timestamp40Grados, null, null, c.temperatura40?.esManual);
  const d = b.desuerar ?? {};
  add('desuerar', 'desuerado', d.desuerado?.timestampDesuerado, null, d.desuerado?.segundosDesuerado, d.desuerado?.esManual);
  add('desuerar', 'escurrido', d.escurrido?.timestampInicio, d.escurrido?.timestampFin, d.escurrido?.segundosEscurrido, d.escurrido?.tiempoManual);
  const h = b.hilar ?? {};
  add('hilar', 'prueba_hilado', h.pruebaHilado?.timestampPruebaHilado, null, null, h.pruebaHilado?.esManual);
  add('hilar', 'hilado_en_paila', h.hiladoEnPaila?.timestampInicio, h.hiladoEnPaila?.timestampFin, null, h.hiladoEnPaila?.esManual);
  return out;
}

function collectMedicionesFerm(b: Json): Medicion[] {
  const out: Medicion[] = [];
  const add = (etapa: string, parametro: string, valor: unknown, manual: unknown, at: unknown) => {
    const v = num(valor);
    if (v === null || (v === 0 && /^(ph_|temperatura_|acidez_)/.test(parametro))) return;
    out.push({ etapa, parametro, valor: v, manual: manual === true, at: ts(anyTs(at)) });
  };
  const p = b.pasteurizacion ?? {};
  add('acidificar', 'temperatura_recepcion', p.temperaturaRecepcion, false, null);
  add('acidificar', 'ph_recepcion', p.phRecepcion, false, null);
  add('acidificar', 'acidez_dornic', p.acidezDornic, false, null);
  add('acidificar', 'temperatura_pasteurizacion', p.calentamiento?.temperaturaAlcanzada || (p.calentamiento?.llego85a90 ? p.calentamiento?.temperaturaConsigna : null), p.calentamiento?.esManual, p.calentamiento?.horaLlegada85a90);
  add('acidificar', 'temperatura_enfriamiento', p.enfriamiento?.enfriamientoCompletado ? p.enfriamiento?.temperaturaFinal : null, p.enfriamiento?.esManual, p.enfriamiento?.horaFinEnfriamiento);
  const i = b.inoculacion ?? {};
  add('calentar-y-cuajar', 'temperatura_inoculacion', i.temperaturaConfirmada ? i.temperaturaVerificada45 : null, false, i.horaInoculacion);
  add('calentar-y-cuajar', 'temperatura_incubacion', i.incubacion?.temperaturaCamara ?? i.incubacion?.temperaturaIncubacion, i.incubacion?.esManual, i.incubacion?.horaInicio);
  add('calentar-y-cuajar', 'ph_final_incubacion', i.incubacion?.phFinalIncubacion, i.incubacion?.esManual, i.incubacion?.horaFin);
  const m = b.maduracionFrio?.refrigeracion ?? {};
  add('desuerar', 'ph_fin_reposo', m.iniciada || m.completada ? m.phFinalFrio : null, m.esManual, m.horaFin);
  add('desuerar', 'temperatura_cuarto_frio', m.iniciada || m.completada ? m.temperaturaCuartoFrio : null, m.esManual, m.horaInicio);
  const g = b.maduracionYFiltrado ?? {};
  add('desuerar', 'temperatura_cuarto_frio', g.cuartoFrio?.iniciado ? g.cuartoFrio?.temperatura : null, false, g.cuartoFrio?.horaInicio);
  add('desuerar', 'masa_filtrada_kg', g.filtradoTelas?.masaFiltradaKg, g.filtradoTelas?.esManual, g.filtradoTelas?.horaFin);
  add('desuerar', 'suero_eliminado_estimado_litros', g.filtradoTelas?.sueroEliminadoEstimadoLitros, g.filtradoTelas?.esManual, g.filtradoTelas?.horaFin);
  const bt = b.batidoYAdiciones ?? {};
  const bb = bt.batidora ?? bt.batido ?? {};
  add('hilar', 'velocidad_batido_rpm', bb.completado ? bb.velocidadRpm : null, bb.esManual, bb.horaFin);
  return out;
}

function collectMediciones(b: Json): Medicion[] {
  if (isFerm(b)) return collectMedicionesFerm(b);
  const out: Medicion[] = [];
  const add = (etapa: string, parametro: string, valor: unknown, manual: unknown, at: unknown) => {
    const v = num(valor);
    if (v === null || (v === 0 && parametro.startsWith('ph_'))) return;
    out.push({ etapa, parametro, valor: v, manual: manual === true, at: ts(at) });
  };
  if (isPera(b)) {
    const c = b.calentarYCuajar ?? {};
    const d = b.desuerar ?? {};
    const h = b.hilar ?? {};
    add('acidificar', 'ph_recepcion', b.acidificar?.insumos?.phFresca, false, null);
    add('acidificar', 'ph_leche_acida', b.acidificar?.insumos?.phAcida, false, null);
    add('calentar-y-cuajar', 'temperatura_40_alcanzada', c.llegada40?.temperaturaAlcanzada, c.llegada40?.esManual, c.llegada40?.timestamp40Grados);
    add('calentar-y-cuajar', 'ph_fin_reposo', c.finReposoPh58?.phAlcanzado, c.finReposoPh58?.esManual, c.finReposoPh58?.timestampPh58);
    add('desuerar', 'temperatura_desuerado', d.temperaturaVerificada, false, d.desuerado?.timestampDesuerado);
    add('desuerar', 'acidez_suero', d.acidezSuero, false, null);
    add('desuerar', 'ph_escurrido', d.escurrido?.phEscurrido, d.escurrido?.phEscurridoManual, d.escurrido?.timestampFin);
    add('hilar', 'temperatura_salmuera_hilado', h.salmuera?.temperaturaValor, false, null);
    add('hilar', 'ph_hilado', h.phActual, false, null);
    add('hilar', 'acidez_hilado', h.acidezLA, false, null);
    add('hilar', 'temperatura_bano_hilado', h.tempBano, false, null);
    add('hilar', 'numero_moldes', h.numeroMoldes, false, null);
    add('hilar', 'peso_total_queso_kg', h.pesoTotalQueso, b.moldesDesglose?.esPesoManual, null);
    return out;
  }
  const a = b.acidificar ?? {};
  add('acidificar', 'ph_recepcion', a.insumos?.phFresca, false, null);
  add('acidificar', 'ph_leche_acida', a.insumos?.phAcida, false, null);
  add('acidificar', 'ph_mezcla', a.insumos?.phMezcla, false, null);
  add('acidificar', 'temperatura_acidificacion', a.phase1?.temperaturaAlcanzada, a.phase1?.temperaturaManual, a.phase1?.timestampAlcanzo35);
  const c = b.calentarYCuajar ?? {};
  add('calentar-y-cuajar', 'temperatura_40_alcanzada', c.temperatura40?.temperaturaAlcanzada, c.temperatura40?.esManual, c.temperatura40?.timestamp40Grados);
  const d = b.desuerar ?? {};
  add('desuerar', 'temperatura_desuerado', d.temperaturaVerificada, false, d.desuerado?.timestampDesuerado);
  add('desuerar', 'acidez_suero', d.acidezSuero, false, null);
  add('desuerar', 'ph_escurrido', d.escurrido?.phEscurrido, d.escurrido?.phEscurridoManual, d.escurrido?.timestampFin);
  const h = b.hilar ?? {};
  add('hilar', 'ph_hilado', h.phActual, false, null);
  add('hilar', 'acidez_hilado', h.acidezLA, false, null);
  add('hilar', 'temperatura_bano_hilado', h.tempBano, false, null);
  add('hilar', 'numero_moldes', h.numeroMoldes, false, null);
  add('hilar', 'peso_total_queso_kg', h.pesoTotalQueso, b.moldesDesglose?.esPesoManual, null);
  return out;
}

function collectInsumosFerm(b: Json): Insumo[] {
  const out: Insumo[] = [];
  const add = (etapa: string, tipo: string, nombre: string, codigo: unknown, unidad: string, cantidad: unknown, manual: unknown, at: unknown) => {
    const q = num(cantidad);
    const code = str(codigo);
    if (!code && !(q && q > 0)) return;
    out.push({ etapa, tipo, nombre, codigo: code || 'SIN-LOTE', unidad, cantidad: q !== null && q >= 0 ? q : 0, manual: manual === true, at: ts(anyTs(at)) });
  };
  const p = b.pasteurizacion ?? {};
  const i = b.inoculacion ?? {};
  const a = b.batidoYAdiciones?.adiciones ?? {};
  const f = b.batidoYAdiciones?.formulacion ?? {};
  add('acidificar', 'leche_fresca', 'Leche fresca', p.loteLeche, 'L', p.litrosLeche, false, p.calentamiento?.horaInicio);
  add('acidificar', 'cultivo_lactico', 'Cultivo láctico (pasteurización)', p.loteCultivoLacticoPastur || p.loteCultivoLactico, 'g', null, false, null);
  add('acidificar', 'azucar', 'Azúcar', p.azucar?.loteAzucar || p.loteAzucarPastur || p.loteAzucar, 'kg', p.azucar?.adicionado ? p.azucar?.cantidadKg : null, p.azucar?.esManual, p.azucar?.horaAdicion);
  add('calentar-y-cuajar', 'cultivo_lactico', 'Cultivo láctico (inoculación)', i.loteCultivo, 'g', i.cantidadCultivoGramos, i.esManualMezclado, i.horaInoculacion);
  const v = a.variedadAzucar ?? {};
  const saboresReceta: Json[] = Array.isArray(a.sabores) ? a.sabores : [];
  if (saboresReceta.length > 0) {
    for (const s of saboresReceta) {
      add('desuerar', 'saborizante', `Saborizante (${s.sabor})`, s.loteSaborizante, 'ml', s.saborizanteMl, false, a.horaRegistro);
      add('desuerar', 'colorante', `Colorante (${s.sabor})`, s.loteColorante, 'ml', s.coloranteMl, false, a.horaRegistro);
    }
  } else {
    add('hilar', 'saborizante', 'Saborizante', a.loteSaborizante || v.loteSaborizante, 'ml', a.saborizanteMl ?? v.saborizanteMl, false, a.horaRegistro);
    add('hilar', 'colorante', 'Colorante', a.loteColorante || v.loteColorante, 'ml', a.coloranteMl ?? v.coloranteMl, false, a.horaRegistro);
  }
  add('hilar', 'azucar', 'Azúcar (batido)', a.loteAzucar || v.loteAzucar, 'kg', a.kilosAzucar ?? v.kilosAzucar, false, a.horaRegistro);
  const est = a.variedadEstevia ?? f.variedadConEstevia ?? {};
  add('hilar', 'estevia', 'Estevia', est.loteEstevia, 'g', est.gramosEstevia, false, a.horaRegistro ?? f.horaRegistro);
  return out;
}

function collectInsumos(b: Json): Insumo[] {
  if (isFerm(b)) return collectInsumosFerm(b);
  const out: Insumo[] = [];
  const l = b.lotesLeche ?? {};
  const add = (etapa: string | null, tipo: string, nombre: string, codigo: unknown, unidad: string, cantidad: unknown, manual: boolean, at: unknown) => {
    const q = num(cantidad);
    const code = str(codigo);
    if (!code && !(q && q > 0)) return;
    out.push({ etapa, tipo, nombre, codigo: code || 'SIN-LOTE', unidad, cantidad: q !== null && q >= 0 ? q : 0, manual, at: ts(at) });
  };
  if (isPera(b)) {
    const ins = b.acidificar?.insumos ?? {};
    const cy = b.calentarYCuajar ?? {};
    const h = b.hilar ?? {};
    add('acidificar', 'leche_fresca', 'Leche fresca', l.loteLecheFresca || l.loteLeche1, 'L', ins.lecheFresca ?? l.litrosConfirmados, false, null);
    add('calentar-y-cuajar', 'cultivo_lactico', 'Cultivo láctico', cy.cultivoLacticoPera?.loteCultivo || ins.loteCultivoLacteo || l.loteCultivoLacteo, 'cdas', cy.cultivoLacticoPera?.cucharadas ?? ins.cultivoLacteoUnidades, cy.cultivoLacticoPera?.esManual === true, cy.cultivoLacticoPera?.timestamp);
    add('calentar-y-cuajar', 'cuajo', 'Cuajo (Pera)', cy.adicionCuajo?.loteCuajo || b.loteCuajoPera || l.loteCuajoPera, 'g', cy.adicionCuajo?.cantidadGramos, cy.adicionCuajo?.esManual === true, cy.adicionCuajo?.timestampCuajo);
    if (h.salmuera?.lista || h.sal?.registrado) {
      add('hilar', 'sal', 'Sal (salmuera caliente)', h.salmuera?.loteSal || h.sal?.loteSal || b.loteSal, 'g', h.salmuera?.cantidadSalGramos ?? h.sal?.cantidadGramos, h.sal?.esManual === true, null);
    }
    if (h.salmueraFria?.preparada) {
      add('hilar', 'sal', 'Sal (salmuera fría)', h.salmueraFria?.loteSal || h.sal?.loteSal || b.loteSal, 'g', h.salmueraFria?.salGramos, false, h.salmueraFria?.timestamp);
    }
    return out;
  }
  if (is7C(b)) {
    const ins7 = b.acidificar?.insumos ?? {};
    const p27 = b.acidificar?.phase2 ?? {};
    const cc = b.calentarYCuajar?.adicionCuajo ?? {};
    const sal7 = b.hilar?.sal ?? {};
    const ts35 = b.acidificar?.phase1?.timestampAlcanzo35;
    add('acidificar', 'leche_fresca', 'Leche fresca', l.loteLecheFresca || l.loteLeche1, 'L', ins7.lecheFresca || l.litrosConfirmados || l.litrosLote1, false, ts35);
    add('acidificar', 'acido_acetico', 'Ácido acético al 98%', ins7.loteAcidoAcetico || l.loteAcidoAcetico, 'ml', ins7.acidoBase98Ml ?? l.acidoBase98Ml, false, ts35);
    if (num(ins7.aguaDiluyenteMl)) {
      add('acidificar', 'agua', 'Agua (preparación ácido acético al 5%)', 'AGUA', 'ml', ins7.aguaDiluyenteMl, false, ts35);
    }
    add('calentar-y-cuajar', 'cuajo', 'Cuajo', cc.loteCuajo || p27.loteCuajo || b.loteCuajo, 'g', cc.cantidadGramos || p27.cantidadCuajoGramos, cc.esManual === true, cc.timestampCuajo);
    if (sal7.registrado) {
      add('hilar', 'sal', 'Sal', sal7.loteSal || b.loteSal, 'g', sal7.cantidadGramos, sal7.esManual === true, null);
    }
    return out;
  }
  add('acidificar', 'leche_acida', 'Leche ácida', l.loteLeche1 || l.loteLecheBase, 'L', l.litrosLote1 ?? b.acidificar?.insumos?.lecheAcida, false, null);
  add('acidificar', 'leche_fresca', 'Leche fresca', l.loteLeche2 || l.loteLecheFresca, 'L', l.litrosLote2 ?? b.acidificar?.insumos?.lecheFresca, false, null);
  const p2 = b.acidificar?.phase2 ?? {};
  add('acidificar', 'cuajo', 'Cuajo', p2.loteCuajo || b.loteCuajo, 'g', p2.cantidadCuajoGramos, p2.esCuajoManual === true, p2.timestampAdicionCuajo);
  const pera = b.calentarYCuajar?.adicionCuajo ?? {};
  if (pera.registrado) {
    add('calentar-y-cuajar', 'cuajo', 'Cuajo (Pera)', pera.loteCuajo || b.loteCuajoPera, 'g', pera.cantidadGramos, pera.esManual === true, pera.timestampCuajo);
  }
  const sal = b.hilar?.sal ?? {};
  if (sal.registrado) {
    add('hilar', 'sal', 'Sal', sal.loteSal || b.loteSal, 'g', sal.cantidadGramos, sal.esManual === true, null);
  }
  return out;
}

interface Derivacion {
  tipo: string;
  codigo: string;
  origen: string | null;
  pesoKg: number | null;
  manual: boolean;
  insumos: { tipo: string; nombre: string; codigo: string; ini: number | null; fin: number | null; usado: number }[];
  presentaciones: { formato: string; unidades: number }[];
}

function pesoUsado(ini: number | null, fin: number | null, usado: unknown): { ini: number | null; fin: number | null; usado: number } {
  if (ini !== null && fin !== null && ini - fin >= 0) {
    return { ini, fin, usado: Math.round((ini - fin) * 1000) / 1000 };
  }
  return { ini: null, fin: null, usado: Math.max(0, num(usado) ?? 0) };
}

function collectDerivaciones(b: Json, loteBase: string): Derivacion[] {
  const out: Derivacion[] = [];
  const especiasNombres: Record<string, string> = {
    pimienta: 'Pimienta',
    ajiPicante: 'Ají picante',
    mezclaHierbas: 'Mezcla de hierbas finas',
  };
  const pasta = (tipo: string, sufijo: string, nombreInsumo: string, tipoInsumo: string, d: Json | undefined, especias: Json | undefined) => {
    if (!d?.habilitado) return;
    const w = pesoUsado(num(d.pesoInicialGramos), num(d.pesoFinalGramos), d.pesoUtilizadoGramos);
    const codigo = str(d.codigoLote) || `${loteBase}-${sufijo}`;
    const detalle: Derivacion['insumos'] = [];
    for (const [k, e] of Object.entries(especias ?? {})) {
      const ew = pesoUsado(num((e as Json)?.pesoInicialGramos), num((e as Json)?.pesoFinalGramos), (e as Json)?.pesoUtilizadoGramos);
      if (ew.usado > 0) detalle.push({ tipo: tipoInsumo, nombre: especiasNombres[k] ?? k, codigo: 'SIN-LOTE', ...ew });
    }
    const pres: { formato: string; unidades: number }[] = [];
    for (const g of [100, 200, 350]) {
      const n = num(d[`moldes${g}g`]);
      if (n && n > 0) pres.push({ formato: `moldes${g}g`, unidades: Math.round(n) });
    }
    out.push({
      tipo,
      codigo,
      origen: str(d.loteBaseOrigen) || loteBase,
      pesoKg: null,
      manual: d.edicionManualAvanzada === true,
      insumos: detalle.length > 0 ? detalle : w.usado > 0 ? [{ tipo: tipoInsumo, nombre: nombreInsumo, codigo: 'SIN-LOTE', ...w }] : [],
      presentaciones: pres,
    });
  };
  pasta('mexicano', 'MEX', 'Especias Queso Mexicano', 'especia', b.derivaciones?.mexicano, b.derivaciones?.mexicano?.especiasMexicano);
  pasta('finas_hierbas', 'FH', 'Especias Finas Hierbas', 'especia', b.derivaciones?.finasHierbas, b.derivaciones?.finasHierbas?.especiasFinasHierbas);
  const q = (tipo: string, nombre: string, tipoInsumo: string, loteKey: string, formato: string, d: Json | undefined) => {
    if (!d?.habilitado) return;
    const w = pesoUsado(num(d.pesoInicialGramos), num(d.pesoFinalGramos), d.pesoUtilizadoGramos);
    const codigo = str(d[loteKey]) || 'SIN-LOTE';
    const n = num(d.moldes60g);
    out.push({
      tipo,
      codigo,
      origen: loteBase,
      pesoKg: null,
      manual: false,
      insumos: w.usado > 0 || codigo !== 'SIN-LOTE' ? [{ tipo: tipoInsumo, nombre, codigo, ...w }] : [],
      presentaciones: n && n > 0 ? [{ formato, unidades: Math.round(n) }] : [],
    });
  };
  q('quesadilla_arequipe', 'Arequipe', 'arequipe', 'loteArequipe', 'moldesQuesadillaArequipe60g', b.derivaciones7Cueros?.arequipe);
  q('quesadilla_bocadillo', 'Bocadillo', 'bocadillo', 'loteBocadillo', 'moldesQuesadillaBocadillo60g', b.derivaciones7Cueros?.bocadillo);
  return out;
}

export async function normalizeBatchTraceability(
  client: PoolClient,
  loteId: string,
  userId: string,
  estadoUi: unknown
): Promise<void> {
  const root = (estadoUi ?? {}) as Json;
  const b: Json = root.batch ?? null;
  if (!b || typeof b !== 'object') return;

  const stagesRes = await client.query(
    `SELECT le.id, ec.codigo_ui FROM lote_etapas_ejecucion le
     JOIN etapas_catalogo ec ON ec.id = le.etapa_catalogo_id WHERE le.lote_id = $1;`,
    [loteId]
  );
  const stageId = new Map<string, string>(stagesRes.rows.map((r) => [r.codigo_ui, r.id]));

  if (isFerm(b)) {
    if (!stageId.has('desuerar') && stageId.has('calentar-y-cuajar')) stageId.set('desuerar', stageId.get('calentar-y-cuajar') as string);
    if (!stageId.has('hilar') && stageId.has('moldeo')) stageId.set('hilar', stageId.get('moldeo') as string);
  }
  const baseRow = await client.query(`SELECT created_at FROM lotes_produccion WHERE id = $1;`, [loteId]);
  baseDateStore.enterWith(baseRow.rows[0]?.created_at ? new Date(baseRow.rows[0].created_at) : new Date());

  await client.query(`DELETE FROM lote_hitos_proceso WHERE lote_id = $1;`, [loteId]);
  for (const h of collectHitos(b)) {
    const etapaId = stageId.get(h.etapa);
    if (!etapaId) continue;
    await client.query(
      `INSERT INTO lote_hitos_proceso (lote_etapa_id, lote_id, codigo_hito, iniciado_at, finalizado_at, duracion_segundos, es_captura_manual, operario_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (lote_etapa_id, codigo_hito) DO NOTHING;`,
      [etapaId, loteId, h.codigo, h.inicio, h.fin, h.duracion, h.manual, userId]
    );
  }

  await client.query(`DELETE FROM mediciones_fisicoquimicas WHERE lote_id = $1;`, [loteId]);
  for (const m of collectMediciones(b)) {
    const etapaId = stageId.get(m.etapa);
    if (!etapaId || m.valor === null) continue;
    await client.query(
      `INSERT INTO mediciones_fisicoquimicas (lote_etapa_id, lote_id, parametro_codigo, valor_numerico, es_captura_manual, registrado_at, operario_id)
       SELECT $1, $2, pm.codigo, $4, $5, COALESCE($6, NOW()), $7 FROM parametros_medicion pm WHERE pm.codigo = $3;`,
      [etapaId, loteId, m.parametro, m.valor, m.manual, m.at ?? baseDateStore.getStore() ?? null, userId]
    );
  }

  await client.query(`DELETE FROM lote_insumos_utilizados WHERE lote_id = $1;`, [loteId]);
  await client.query(`DELETE FROM lote_presentaciones_envasado WHERE lote_id = $1;`, [loteId]);
  await client.query(`DELETE FROM lote_derivaciones_quesos WHERE lote_id = $1;`, [loteId]);

  const insertInsumo = (i: {
    etapa: string | null; derivacionId: string | null; tipo: string; nombre: string; codigo: string; unidad: string;
    ini: number | null; fin: number | null; cantidad: number; manual: boolean; at: Date | null;
  }) =>
    client.query(
      `INSERT INTO lote_insumos_utilizados
         (lote_id, lote_etapa_id, derivacion_id, tipo_insumo, insumo_nombre_snapshot, codigo_lote_insumo, unidad_medida,
          peso_inicial_gramos, peso_final_gramos, cantidad_utilizada, es_dosificacion_manual, registrado_at, operario_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, COALESCE($12, NOW()), $13);`,
      [loteId, i.etapa ? stageId.get(i.etapa) ?? null : null, i.derivacionId, i.tipo, i.nombre, i.codigo, i.unidad, i.ini, i.fin, i.cantidad, i.manual, i.at ?? baseDateStore.getStore() ?? null, userId]
    );

  for (const i of collectInsumos(b)) {
    await insertInsumo({ etapa: i.etapa, derivacionId: null, tipo: i.tipo, nombre: i.nombre, codigo: i.codigo, unidad: i.unidad, ini: null, fin: null, cantidad: i.cantidad ?? 0, manual: i.manual, at: i.at });
  }

  const insertPresentacion = (formato: string, unidades: number, derivacionId: string | null, manual: boolean) =>
    client.query(
      `INSERT INTO lote_presentaciones_envasado
         (lote_id, derivacion_id, formato_id, descripcion_formato, capacidad_unitaria, unidad_medida, categoria_variedad, unidades_conteo, es_captura_manual)
       SELECT $1, $2, f.id, f.descripcion, f.capacidad_unitaria, f.unidad_medida, f.categoria_variedad, $4, $5
       FROM formatos_envase f WHERE f.codigo = $3
       ON CONFLICT DO NOTHING;`,
      [loteId, derivacionId, formato, unidades, manual]
    );

  if (isFerm(b)) {
    const e: Json = b.envasado ?? {};
    const fmts: Record<string, number> = {};
    for (const [k, v] of Object.entries((e.formatos ?? {}) as Json)) fmts[k] = num(v) ?? 0;
    const griegoMap: Record<string, Record<string, string>> = {
      formatosSinEstevia: { tarro1L: 'griego_natural_tarrina1000g', tarro500ml: 'griego_natural_tarrina500g', vasito120ml: 'griego_natural_tarrina120g', bolsa4L: 'griego_natural_bolsa4L' },
      formatosConEstevia: { tarro1L: 'griego_stevia_tarrina1000g', tarro500ml: 'griego_stevia_tarrina500g', vasito120ml: 'griego_stevia_tarrina120g', bolsa4L: 'griego_stevia_bolsa4L' },
    };
    if (isGriego(b)) {
      for (const [grupo, mapa] of Object.entries(griegoMap)) {
        for (const [k, code] of Object.entries(mapa)) fmts[code] = num((e[grupo] ?? {})[k]) ?? 0;
      }
    }
    for (const [code, n] of Object.entries(fmts)) {
      if (n > 0) await insertPresentacion(code, Math.round(n), null, false);
    }
  }

  const moldes: Json = b.moldesDesglose ?? {};
  const moldesValidos7C = ['moldes7Cueros350g', 'moldesTrenza350g'];
  for (const [key, value] of Object.entries(moldes)) {
    if (!/^moldes.+/.test(key)) continue;
    if (is7C(b) && !moldesValidos7C.includes(key)) continue;
    const n = num(value);
    if (n && n > 0) await insertPresentacion(key, Math.round(n), null, moldes.esPesoManual === true);
  }

  const loteRow = await client.query(`SELECT codigo_lote FROM lotes_produccion WHERE id = $1;`, [loteId]);
  const loteBase: string = loteRow.rows[0]?.codigo_lote ?? '';
  for (const d of collectDerivaciones(b, loteBase)) {
    const ins = await client.query(
      `INSERT INTO lote_derivaciones_quesos (lote_id, tipo_derivacion, codigo_sub_lote, lote_base_origen, peso_pasta_utilizado_kg, es_edicion_manual)
       VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (lote_id, tipo_derivacion) DO NOTHING RETURNING id;`,
      [loteId, d.tipo, d.codigo, d.origen, d.pesoKg, d.manual]
    );
    const derId: string | undefined = ins.rows[0]?.id;
    if (!derId) continue;
    for (const i of d.insumos) {
      await insertInsumo({ etapa: 'moldeo', derivacionId: derId, tipo: i.tipo, nombre: i.nombre, codigo: i.codigo, unidad: 'g', ini: i.ini, fin: i.fin, cantidad: i.usado, manual: d.manual, at: null });
    }
    for (const p of d.presentaciones) await insertPresentacion(p.formato, p.unidades, derId, d.manual);
  }

  const nombres: unknown[] = Array.isArray(b.operariosIntervinientes) ? b.operariosIntervinientes : [];
  for (const raw of nombres) {
    const text = str(raw);
    if (!text) continue;
    const code = text.match(/\(([A-Za-z0-9-]+)\)\s*$/)?.[1];
    await client.query(
      `INSERT INTO lote_operarios_intervinientes (lote_id, usuario_id, rol_en_proceso)
       SELECT $1, u.id, 'Operario interviniente' FROM usuarios u
       WHERE ($2::text IS NOT NULL AND u.codigo_empleado = $2) OR ($2::text IS NULL AND u.nombre_completo = $3)
       ON CONFLICT (lote_id, usuario_id) DO NOTHING;`,
      [loteId, code ?? null, text]
    );
  }

  const obs = str(b.observaciones);
  if (obs) {
    await client.query(`UPDATE lotes_produccion SET observaciones_finales = $2 WHERE id = $1 AND estado = 'EN_PROCESO';`, [loteId, obs]);
  }
}
