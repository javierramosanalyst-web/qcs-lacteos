/**
 * Lote visible por día (5 letras: DD + M + AA, con la fecha de inicio del lote).
 *
 * El sistema sigue identificando cada lote por su id y su código interno (únicos);
 * las letras se repiten entre los lotes que arrancan el mismo día, así que SOLO se
 * usan para mostrar y para buscar, nunca para enlazar datos.
 */

/** Lote a mostrar para un lote del operario (estado de la pantalla). */
export const loteVisible = (batch?: { id?: string | null; loteDia?: string | null } | null): string =>
  batch?.loteDia || batch?.id || '';

/** Lote a mostrar para una fila que viene de la API (historial, detalle, borradores…). */
export const loteDeFila = (row?: { codigo_lote?: string | null; lote_dia?: string | null } | null): string =>
  row?.lote_dia || row?.codigo_lote || '';
