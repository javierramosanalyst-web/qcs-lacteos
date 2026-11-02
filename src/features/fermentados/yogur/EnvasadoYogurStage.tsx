import React from 'react';
import { EnvasadoYAlmacenamientoYogurState, YogurBatchData } from '../../../types/yogur';
import { EnvasadoStageCommon } from '../common/EnvasadoStageCommon';

export interface EnvasadoYogurStageProps {
  batch: YogurBatchData;
  llevaAzucar?: boolean;
  onChange: (
    updater: (prev: EnvasadoYAlmacenamientoYogurState) => EnvasadoYAlmacenamientoYogurState
  ) => void;
  onFinalizeProcess: () => void;
  onOpenReviewModal: () => void;
  showToast: (msg: string, type?: 'success' | 'info' | 'warning') => void;
}

export const EnvasadoYogurStage: React.FC<EnvasadoYogurStageProps> = ({
  batch,
  llevaAzucar,
  onChange,
  onFinalizeProcess,
  onOpenReviewModal,
  showToast,
}) => {
  return (
    <EnvasadoStageCommon
      productType="yogur"
      batch={batch}
      llevaAzucar={llevaAzucar}
      onChange={onChange as any}
      onFinalizeProcess={onFinalizeProcess}
      onOpenReviewModal={onOpenReviewModal}
      showToast={showToast}
    />
  );
};
