import React from 'react';
import { BatidoYAdicionesKumisState, EnvasadoYAlmacenamientoKumisState, KumisBatchData } from '../../../types/kumis';
import { EnvasadoStageCommon } from '../common/EnvasadoStageCommon';
import { BatidoEnvasadoTimerCard } from '../common/BatidoEnvasadoTimerCard';

export interface EnvasadoKumisStageProps {
  batch: KumisBatchData;
  llevaAzucar?: boolean;
  onChange: (
    updater: (prev: EnvasadoYAlmacenamientoKumisState) => EnvasadoYAlmacenamientoKumisState
  ) => void;
  onChangeBatido: (
    updater: (prev: BatidoYAdicionesKumisState) => BatidoYAdicionesKumisState
  ) => void;
  onFinalizeProcess: () => void;
  onOpenReviewModal: () => void;
  showToast: (msg: string, type?: 'success' | 'info' | 'warning') => void;
}

export const EnvasadoKumisStage: React.FC<EnvasadoKumisStageProps> = ({
  batch,
  llevaAzucar,
  onChange,
  onChangeBatido,
  onFinalizeProcess,
  onOpenReviewModal,
  showToast,
}) => {
  return (
    <EnvasadoStageCommon
      productType="kumis"
      batch={batch}
      llevaAzucar={llevaAzucar}
      onChange={onChange as any}
      batidoSlot={
        <BatidoEnvasadoTimerCard
          stepBadge="Batido"
          datos={batch.batidoYAdiciones?.batidora}
          onCambio={(cambios) =>
            onChangeBatido((prev) => ({
              ...prev,
              batidora: { ...prev.batidora, ...cambios } as any,
            }))
          }
          showToast={showToast}
        />
      }
      onFinalizeProcess={onFinalizeProcess}
      onOpenReviewModal={onOpenReviewModal}
      showToast={showToast}
    />
  );
};
