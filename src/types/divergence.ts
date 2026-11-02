import { ProcessTimerState, StageId } from './pastaHilada';

/**
 * MODELOS DE PRODUCCIÓN DIVERGENTE (LOTE PADRE → LOTES HIJOS)
 * Diseñado para mapear directamente a tablas relacionales en PostgreSQL local
 * (parent_batches y child_batches) sin dependencias externas.
 */

export type FermentadoVariant =
  | 'yogur_con_azucar'
  | 'yogur_sin_azucar'
  | 'kumis'
  | 'yogur_griego';

export interface ChildBatchReference {
  id: string;
  parentBatchId: string;
  variant: FermentadoVariant;
  productId: string;
  productName: string;
  allocatedLiters: number;
  llevaAzucar: boolean;
  targetInoculationTempRange: string;
  createdAt: string;
  status: 'pendiente' | 'en_proceso' | 'completado';
}

export interface ParentMilkBatch {
  id: string;
  codigoLotePadre: string;
  fechaProduccion: string;
  responsable: string;
  totalMilkLiters: number;
  allocatedLiters: number;
  remainingLiters: number;
  proveedorPrincipal: string;
  loteLecheProveedor: string;
  isStarted: boolean;
  startedAt: string | null;
  isDivided: boolean;
  dividedAt: string | null;
  childBatches: ChildBatchReference[];
}

export interface SplitMilkAllocationInput {
  totalParentLiters?: number;
  litrosYogurConAzucar: number;
  litrosYogurSinAzucar?: number;
  litrosKumis: number;
  litrosYogurGriego: number;
  loteLeche?: string;
  loteYogurSinAzucar?: string;
}

export interface SubBatchTabInfo {
  productId: string;
  batchId: string;
  shortName: string;
  fullName: string;
  icon: string;
  allocatedLiters: number;
  currentStage: StageId;
  currentStageNumber: number;
  stageLabel: string;
  status: 'NOMINAL' | 'COMPLETADO' | string;
  timer: ProcessTimerState;
  isChildOfParent: boolean;
}
