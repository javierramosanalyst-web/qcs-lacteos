import { useSyncExternalStore } from 'react';

export type InsumoTipo = 'leche_fresca' | 'cultivo' | 'cuajo' | 'sal';

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
}

export const LOTES_LECHE_PROVEEDOR_DEFAULT: string[] = [];
export const LOTES_CULTIVO_LACTEO_DEFAULT: string[] = [];
export const LOTES_CUAJO_PERA_DEFAULT: string[] = [];
export const LOTES_SAL_CATALOG: string[] = [];

const BY_TIPO: Record<InsumoTipo, string[]> = {
  leche_fresca: LOTES_LECHE_PROVEEDOR_DEFAULT,
  cultivo: LOTES_CULTIVO_LACTEO_DEFAULT,
  cuajo: LOTES_CUAJO_PERA_DEFAULT,
  sal: LOTES_SAL_CATALOG,
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

let detailByCode = new Map<string, InsumoLoteRow>();

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
