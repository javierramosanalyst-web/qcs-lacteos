import { useSyncExternalStore } from 'react';

export type InsumoTipo = 'leche_fresca' | 'cultivo' | 'cuajo' | 'sal' | 'azucar' | 'saborizante' | 'colorante' | 'estevia' | 'acido_acetico' | 'especia';

export interface InsumoLoteRow {
  id: string;
  tipo: InsumoTipo;
  codigo_lote: string;
  descripcion: string | null;
  proveedor: string | null;
  fecha_vencimiento: string | null;
  cantidad_recibida: string | number | null;
  unidad: string;
  activo: boolean;
  eliminado_at?: string | null;
}

export const LOTES_LECHE_PROVEEDOR_DEFAULT: string[] = [];
export const LOTES_CULTIVO_LACTEO_DEFAULT: string[] = [];
export const LOTES_CUAJO_PERA_DEFAULT: string[] = [];
export const LOTES_SAL_CATALOG: string[] = [];
export const LOTES_AZUCAR_CATALOG: string[] = [];
export const LOTES_SABORIZANTE_CATALOG: string[] = [];
export const LOTES_COLORANTE_CATALOG: string[] = [];
export const LOTES_ESTEVIA_CATALOG: string[] = [];
export const LOTES_ACIDO_ACETICO_CATALOG: string[] = [];
export const LOTES_ESPECIA_CATALOG: string[] = [];
export const SABORES_YOGUR_CATALOG: string[] = [];

export interface SaborYogurRow {
  id: string;
  nombre: string;
  activo: boolean;
}

const BY_TIPO: Record<InsumoTipo, string[]> = {
  leche_fresca: LOTES_LECHE_PROVEEDOR_DEFAULT,
  cultivo: LOTES_CULTIVO_LACTEO_DEFAULT,
  cuajo: LOTES_CUAJO_PERA_DEFAULT,
  sal: LOTES_SAL_CATALOG,
  azucar: LOTES_AZUCAR_CATALOG,
  saborizante: LOTES_SABORIZANTE_CATALOG,
  colorante: LOTES_COLORANTE_CATALOG,
  estevia: LOTES_ESTEVIA_CATALOG,
  acido_acetico: LOTES_ACIDO_ACETICO_CATALOG,
  especia: LOTES_ESPECIA_CATALOG,
};

let version = 0;
const listeners = new Set<() => void>();

export function setInsumoLotes(rows: InsumoLoteRow[]): void {
  (Object.keys(BY_TIPO) as InsumoTipo[]).forEach((tipo) => {
    BY_TIPO[tipo].splice(
      0,
      BY_TIPO[tipo].length,
      ...rows.filter((r) => r.tipo === tipo && r.activo).map((r) => r.codigo_lote)
    );
  });
  detailByCode = new Map(rows.filter((r) => r.activo).map((r) => [`${r.tipo}:${r.codigo_lote}`, r]));
  version += 1;
  listeners.forEach((l) => l());
}

export function setSaboresYogur(rows: SaborYogurRow[]): void {
  SABORES_YOGUR_CATALOG.splice(0, SABORES_YOGUR_CATALOG.length, ...rows.filter((r) => r.activo).map((r) => r.nombre));
  version += 1;
  listeners.forEach((l) => l());
}

export const saborOptions = (): { value: string; label: string }[] =>
  SABORES_YOGUR_CATALOG.map((n) => ({ value: n, label: n }));

let detailByCode = new Map<string, InsumoLoteRow>();

export const getInsumoLoteDetail = (tipo: InsumoTipo, codigo: string): InsumoLoteRow | undefined =>
  detailByCode.get(`${tipo}:${codigo}`);

export const insumoLabel = (tipo: InsumoTipo, codigo: string): string => {
  const r = detailByCode.get(`${tipo}:${codigo}`);
  const extra = [r?.descripcion, r?.proveedor].filter(Boolean).join(' - ');
  return extra ? `${codigo} (${extra})` : codigo;
};

export const insumoOptions = (tipo: InsumoTipo): { value: string; label: string }[] =>
  BY_TIPO[tipo].map((c) => ({ value: c, label: insumoLabel(tipo, c) }));

export function useInsumoLotesVersion(): number {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => version
  );
}
