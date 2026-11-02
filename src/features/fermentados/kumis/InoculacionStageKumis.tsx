import React from 'react';
import { InoculacionKumisState } from '../../../types/kumis';
import { ProcessTimerState } from '../../../types';
import { InoculacionStageCommon } from '../common/InoculacionStageCommon';

export interface InoculacionStageKumisProps {
  state: InoculacionKumisState;
  onChange: (updater: (prev: InoculacionKumisState) => InoculacionKumisState) => void;
  tempLlegada45?: number;
  tempLlegada35?: number;
  horaLlegada45?: string | null;
  horaLlegada35?: string | null;
  litrosLecheBase?: number;
  loteCultivoBase?: string;
  processTimer: ProcessTimerState;
  onNextStage?: () => void;
  onGoToBatidoYSabores?: () => void;
  onOpenReviewModal?: () => void;
  showToast: (msg: string, type?: 'success' | 'info' | 'warning') => void;
}

export const InoculacionStageKumis: React.FC<InoculacionStageKumisProps> = ({
  state,
  onChange,
  horaLlegada45,
  horaLlegada35,
  litrosLecheBase = 100,
  loteCultivoBase,
  processTimer,
  onNextStage,
  onGoToBatidoYSabores,
  onOpenReviewModal,
  showToast,
}) => {
  const horaTemp = horaLlegada35 || horaLlegada45;

  return (
    <InoculacionStageCommon
      productType="kumis"
      state={state}
      onChange={onChange as any}
      horaLlegadaTemp={horaTemp}
      litrosLecheBase={litrosLecheBase}
      loteCultivoBase={loteCultivoBase}
      processTimer={processTimer}
      onGoToBatidoYSabores={onGoToBatidoYSabores || onNextStage || (() => {})}
      onNextStage={onNextStage}
      onOpenReviewModal={onOpenReviewModal}
      showToast={showToast}
    />
  );
};
