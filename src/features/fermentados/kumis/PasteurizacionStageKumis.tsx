import React from 'react';
import { PasteurizacionKumisState } from '../../../types/kumis';
import { ProcessTimerState } from '../../../types';
import { PasteurizacionStageCommon } from '../common/PasteurizacionStageCommon';

export interface PasteurizacionStageKumisProps {
  state: PasteurizacionKumisState;
  onChange: (
    updater: (prev: PasteurizacionKumisState) => PasteurizacionKumisState
  ) => void;
  processTimer: ProcessTimerState;
  onStartProcessTimer: () => void;
  onNextStage: () => void;
  onOpenReviewModal?: () => void;
  showToast: (msg: string, type?: 'success' | 'info' | 'warning') => void;
}

export const PasteurizacionStageKumis: React.FC<
  PasteurizacionStageKumisProps
> = (props) => {
  return (
    <PasteurizacionStageCommon
      {...props}
      productName="Kumis Tradicional"
      defaultCultivoLote="CUL-2026-10B"
    />
  );
};
