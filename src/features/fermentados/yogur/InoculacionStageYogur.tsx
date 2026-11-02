import React from 'react';
import { InoculacionYogurState } from '../../../types/yogur';
import { ProcessTimerState } from '../../../types';
import { InoculacionStageCommon } from '../common/InoculacionStageCommon';

export interface InoculacionStageYogurProps {
  state: InoculacionYogurState;
  onChange: (updater: (prev: InoculacionYogurState) => InoculacionYogurState) => void;
  tempLlegada45?: number;
  horaLlegada45?: string | null;
  litrosLecheBase?: number;
  loteCultivoBase?: string;
  llevaAzucar?: boolean;
  processTimer: ProcessTimerState;
  onNextStage?: () => void;
  onGoToBatidoYSabores?: () => void;
  onFinalizeProcess?: () => void;
  onOpenReviewModal?: () => void;
  showToast: (msg: string, type?: 'success' | 'info' | 'warning') => void;
  onExtractKumis?: (litros: number) => void;
  onExtractGriego?: (litros: number) => void;
  extraccionKumisRealizada?: boolean;
  extraccionGriegoRealizada?: boolean;
  litrosExtraidosPrevios?: number;
}

export const InoculacionStageYogur: React.FC<InoculacionStageYogurProps> = ({
  state,
  onChange,
  horaLlegada45,
  litrosLecheBase = 100,
  loteCultivoBase,
  llevaAzucar,
  processTimer,
  onNextStage,
  onGoToBatidoYSabores,
  onOpenReviewModal,
  showToast,
  onExtractKumis,
  onExtractGriego,
  extraccionKumisRealizada,
  extraccionGriegoRealizada,
  litrosExtraidosPrevios,
}) => {
  return (
    <InoculacionStageCommon
      productType="yogur"
      state={state}
      onChange={onChange as any}
      horaLlegadaTemp={horaLlegada45}
      litrosLecheBase={litrosLecheBase}
      loteCultivoBase={loteCultivoBase}
      llevaAzucar={llevaAzucar}
      processTimer={processTimer}
      onGoToBatidoYSabores={onGoToBatidoYSabores || onNextStage || (() => {})}
      onNextStage={onNextStage}
      onOpenReviewModal={onOpenReviewModal}
      showToast={showToast}
      onExtractKumis={onExtractKumis}
      onExtractGriego={onExtractGriego}
      extraccionKumisRealizada={extraccionKumisRealizada}
      extraccionGriegoRealizada={extraccionGriegoRealizada}
      litrosExtraidosPrevios={litrosExtraidosPrevios}
    />
  );
};
