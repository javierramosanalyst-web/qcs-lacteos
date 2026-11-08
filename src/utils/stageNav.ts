import { StageId } from '../types';

export interface StageNavItem {
  id: StageId;
  label: string;
  icon: string;
}

export type StageNavKind = 'griego' | 'kumis' | 'yogur' | 'siete-cueros' | 'pera' | 'doble-crema';

export const STAGE_NAV: Record<StageNavKind, StageNavItem[]> = {
  griego: [
    { id: 'acidificar', label: '1. Pasteurizar Leche', icon: 'local_fire_department' },
    { id: 'calentar-y-cuajar', label: '2. Inocular e Incubar', icon: 'biotech' },
    { id: 'desuerar', label: '3. Cuarto Frío y Escurrido', icon: 'filter_alt' },
    { id: 'hilar', label: '4. Batido y Envasado', icon: 'blender' },
    { id: 'moldeo', label: '5. Guardar', icon: 'inventory_2' },
  ],
  kumis: [
    { id: 'acidificar', label: '1. Pasteurizar Leche', icon: 'local_fire_department' },
    { id: 'calentar-y-cuajar', label: '2. Inocular e Incubar', icon: 'biotech' },
    { id: 'moldeo', label: '3. Envasar y Guardar', icon: 'inventory_2' },
  ],
  yogur: [
    { id: 'acidificar', label: '1. Pasteurizar Leche', icon: 'local_fire_department' },
    { id: 'calentar-y-cuajar', label: '2. Inocular e Incubar', icon: 'biotech' },
    { id: 'desuerar', label: '3. Receta y Sabores', icon: 'menu_book' },
    { id: 'hilar', label: '4. Batido y Envasado', icon: 'blender' },
    { id: 'moldeo', label: '5. Guardar', icon: 'inventory_2' },
  ],
  'siete-cueros': [
    { id: 'acidificar', label: '1. Acidificar Leche', icon: 'science' },
    { id: 'calentar-y-cuajar', label: '2. Agregar Cuajo', icon: 'thermostat' },
    { id: 'desuerar', label: '3. Desuerar y Escurrir', icon: 'filter_alt' },
    { id: 'hilar', label: '4. Hilar y Salar', icon: 'waves' },
    { id: 'moldeo', label: '5. Moldear y Pesar', icon: 'scale' },
  ],
  pera: [
    { id: 'acidificar', label: '1. Leche e Insumos', icon: 'water_drop' },
    { id: 'calentar-y-cuajar', label: '2. Premadurar y Cuajar', icon: 'biotech' },
    { id: 'desuerar', label: '3. Desuerar y Escurrir', icon: 'filter_alt' },
    { id: 'hilar', label: '4. Hilar y Salmueras', icon: 'waves' },
    { id: 'moldeo', label: '5. Moldear y Pesar', icon: 'scale' },
  ],
  'doble-crema': [
    { id: 'acidificar', label: '1. Acidificar Leche', icon: 'science' },
    { id: 'calentar-y-cuajar', label: '2. Calentar y Cuajar', icon: 'thermostat' },
    { id: 'desuerar', label: '3. Desuerar y Escurrir', icon: 'filter_alt' },
    { id: 'hilar', label: '4. Hilar y Salar', icon: 'waves' },
    { id: 'moldeo', label: '5. Moldear y Pesar', icon: 'scale' },
  ],
};

export const stageNavKindFromProductId = (productId: string): StageNavKind => {
  if (productId === 'prod-yogur-griego') return 'griego';
  if (productId === 'prod-kumis') return 'kumis';
  if (productId === 'prod-yogur') return 'yogur';
  if (productId === 'prod-queso-7-cueros') return 'siete-cueros';
  if (productId === 'prod-queso-pera') return 'pera';
  return 'doble-crema';
};

export const stageLabelFor = (productId: string, stage: string): string =>
  STAGE_NAV[stageNavKindFromProductId(productId)].find((s) => s.id === stage)?.label ?? stage;
