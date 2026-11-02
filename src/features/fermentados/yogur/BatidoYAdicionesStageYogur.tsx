import React from 'react';
import { BatidoYAdicionesYogurState } from '../../../types/yogur';
import { ProcessTimerState } from '../../../types';
import { BatidoYSaboresStageCommon } from '../common/BatidoYSaboresStageCommon';

export interface BatidoYAdicionesStageYogurProps {
  state: BatidoYAdicionesYogurState;
  onChange: (
    updater: (prev: BatidoYAdicionesYogurState) => BatidoYAdicionesYogurState
  ) => void;
  llevaAzucar?: boolean;
  litrosLecheBase?: number;
  processTimer: ProcessTimerState;
  onNextStage?: () => void;
  onOpenReviewModal?: () => void;
  showToast: (msg: string, type?: 'success' | 'info' | 'warning') => void;
}

export const BatidoYAdicionesStageYogur: React.FC<BatidoYAdicionesStageYogurProps> = ({
  state,
  onChange,
  llevaAzucar = true,
  litrosLecheBase = 100,
  processTimer,
  onNextStage,
  onOpenReviewModal,
  showToast,
}) => {
  return (
    <BatidoYSaboresStageCommon
      productType="yogur"
      state={state}
      onChange={onChange as any}
      llevaAzucar={llevaAzucar}
      litrosLecheBase={litrosLecheBase}
      processTimer={processTimer}
      onNextStage={onNextStage}
      onOpenReviewModal={onOpenReviewModal}
      showToast={showToast}
    />
  );
};
