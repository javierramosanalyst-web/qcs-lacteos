import React from 'react';
import { EnvasadoYAlmacenamientoKumisState, KumisBatchData } from '../../../types/kumis';
import { EnvasadoStageCommon } from '../common/EnvasadoStageCommon';

export interface EnvasadoKumisStageProps {
  batch: KumisBatchData;
  llevaAzucar?: boolean;
  onChange: (
    updater: (prev: EnvasadoYAlmacenamientoKumisState) => EnvasadoYAlmacenamientoKumisState
  ) => void;
  onFinalizeProcess: () => void;
  onOpenReviewModal: () => void;
  showToast: (msg: string, type?: 'success' | 'info' | 'warning') => void;
}

export const EnvasadoKumisStage: React.FC<EnvasadoKumisStageProps> = ({
  batch,
  llevaAzucar,
  onChange,
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
      onFinalizeProcess={onFinalizeProcess}
      onOpenReviewModal={onOpenReviewModal}
      showToast={showToast}
    />
  );
};
