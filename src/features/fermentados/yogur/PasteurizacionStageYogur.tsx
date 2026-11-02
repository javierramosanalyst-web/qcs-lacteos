import React from 'react';
import { PasteurizacionYogurState } from '../../../types/yogur';
import { ProcessTimerState, SplitMilkAllocationInput } from '../../../types';
import { PasteurizacionStageCommon } from '../common/PasteurizacionStageCommon';

export interface PasteurizacionStageYogurProps {
  state: PasteurizacionYogurState;
  onChange: (
    updater: (prev: PasteurizacionYogurState) => PasteurizacionYogurState
  ) => void;
  processTimer: ProcessTimerState;
  onStartProcessTimer: () => void;
  onSplitParentBatch?: (input: SplitMilkAllocationInput) => void;
  onExtractKumisChildBatch?: (litrosKumis: number) => void;
  onNextStage: () => void;
  onOpenReviewModal?: () => void;
  showToast: (msg: string, type?: 'success' | 'info' | 'warning') => void;
}

export const PasteurizacionStageYogur: React.FC<
  PasteurizacionStageYogurProps
> = (props) => {
  return (
    <PasteurizacionStageCommon
      {...props}
      productName="Yogur Probiótico"
      defaultCultivoLote="CUL-2026-09A"
    />
  );
};
