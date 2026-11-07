/**
 * Reglas de negocio de fermentados que aún deben confirmarse con el ingeniero.
 * Cambiar aquí afecta a Kumis y Yogur Griego por igual.
 */

/**
 * ¿Se permite desviar TODA la leche del Yogur hacia Kumis o Griego?
 *  - true  -> el Yogur puede quedar en 0 L y se cierra solo (comportamiento actual).
 *  - false -> el Yogur siempre debe conservar al menos 1 L.
 */
export const PERMITIR_DESVIO_TOTAL = true;

/** Litros mínimos que deben quedar en el Yogur cuando el desvío total NO está permitido. */
export const LITROS_MINIMOS_YOGUR = 1;

/** Máximo de litros que se pueden desviar de un Yogur con `disponibles` litros. */
export function maxLitrosDesviables(disponibles: number): number {
  if (PERMITIR_DESVIO_TOTAL) return Math.max(0, disponibles);
  return Math.max(0, disponibles - LITROS_MINIMOS_YOGUR);
}
