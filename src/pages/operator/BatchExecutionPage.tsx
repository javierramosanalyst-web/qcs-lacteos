import React from 'react';
import { AppView, UserRole } from '../../types';
import { useBatchManager } from '../../hooks/useBatchManager';
import { SubBatchSwitcherBar } from '../../components/shared/SubBatchSwitcherBar';
import { Button, Card } from '../../components/ui';

// PASTA HILADA · DOBLE CREMA (PREMIUM E INDUSTRIAL UNIFICADOS)
import {
  AcidificarStage,
  AcidificarStageIndustrial,
} from '../../features/pasta-hilada/doble-crema/AcidificarStage';
import { CalentarYCuajarStage } from '../../features/pasta-hilada/doble-crema/CalentarYCuajarStage';
import { DesuerarStage } from '../../features/pasta-hilada/doble-crema/DesuerarStage';
import { HilarStage } from '../../features/pasta-hilada/doble-crema/HilarStage';
import { MoldeoStage } from '../../features/pasta-hilada/doble-crema/MoldeoStage';

// PASTA HILADA · QUESO PERA
import { PremaduracionStage } from '../../features/pasta-hilada/pera/PremaduracionStage';
import { CalentarYCuajarStagePera } from '../../features/pasta-hilada/pera/CalentarYCuajarStagePera';
import { DesuerarStagePera } from '../../features/pasta-hilada/pera/DesuerarStagePera';
import { HilarStagePera } from '../../features/pasta-hilada/pera/HilarStagePera';
import { MoldeoStagePera } from '../../features/pasta-hilada/pera/MoldeoStagePera';

// PASTA HILADA · QUESO 7 CUEROS
import { AcidificarStage7Cueros } from '../../features/pasta-hilada/siete-cueros/AcidificarStage7Cueros';
import { CalentarYCuajarStage7Cueros } from '../../features/pasta-hilada/siete-cueros/CalentarYCuajarStage7Cueros';
import { DesuerarStage7Cueros } from '../../features/pasta-hilada/siete-cueros/DesuerarStage7Cueros';
import { HilarStage7Cueros } from '../../features/pasta-hilada/siete-cueros/HilarStage7Cueros';
import { MoldeoStage7Cueros } from '../../features/pasta-hilada/siete-cueros/MoldeoStage7Cueros';

// FERMENTADOS · YOGUR
import { PasteurizacionStageYogur } from '../../features/fermentados/yogur/PasteurizacionStageYogur';
import { InoculacionStageYogur } from '../../features/fermentados/yogur/InoculacionStageYogur';
import { BatidoYAdicionesStageYogur } from '../../features/fermentados/yogur/BatidoYAdicionesStageYogur';
import { BatidoEnvasadoYogurStage } from '../../features/fermentados/yogur/BatidoEnvasadoYogurStage';
import { EnvasadoYogurStage } from '../../features/fermentados/yogur/EnvasadoYogurStage';

// FERMENTADOS · KUMIS
import { PasteurizacionStageKumis } from '../../features/fermentados/kumis/PasteurizacionStageKumis';
import { InoculacionStageKumis } from '../../features/fermentados/kumis/InoculacionStageKumis';
import { EnvasadoKumisStage } from '../../features/fermentados/kumis/EnvasadoKumisStage';

// FERMENTADOS · YOGUR GRIEGO
import { PasteurizacionStageGriego } from '../../features/fermentados/griego/PasteurizacionStageGriego';
import { InoculacionStageGriego } from '../../features/fermentados/griego/InoculacionStageGriego';
import { MaduracionYFiltradoStageGriego } from '../../features/fermentados/griego/MaduracionYFiltradoStageGriego';
import { BatidoYAdicionesStageGriego } from '../../features/fermentados/griego/BatidoYAdicionesStageGriego';
import { EnvasadoGriegoStage } from '../../features/fermentados/griego/EnvasadoGriegoStage';
import { formatSecondsToHMS } from '../../utils/timer';
import type { ProcessTimerState } from '../../types';

/**
 * Fermentados (Yogur, Kumis y Yogur Griego): el reloj del lote se detiene en el
 * momento en que el producto ingresa al cuarto frío (último paso de la etapa 5),
 * aunque el operario aún no haya cerrado el lote.
 * Si el reloj ya estaba detenido (p. ej. al corregir la hora a mano), no se toca.
 */
const ingresoCuartoFrio = (e: { almacenamientoCuartoFrio?: { ingresado?: boolean } }) =>
  Boolean(e.almacenamientoCuartoFrio?.ingresado);

function conRelojDetenidoAlHitoFinal<
  E,
  B extends { envasado: E; processTimer: ProcessTimerState }
>(prev: B, envasado: E, hitoCumplido: (e: E) => boolean): B {
  const recienCumplido = hitoCumplido(envasado) && !hitoCumplido(prev.envasado);
  if (!recienCumplido || prev.processTimer.isCompleted) {
    return { ...prev, envasado };
  }
  const { startTimestamp, elapsedSeconds } = prev.processTimer;
  const totalSeconds = startTimestamp
    ? Math.max(elapsedSeconds, Math.floor((Date.now() - startTimestamp) / 1000))
    : elapsedSeconds;
  return {
    ...prev,
    envasado,
    processTimer: {
      ...prev.processTimer,
      isRunning: false,
      isCompleted: true,
      elapsedSeconds: totalSeconds,
      formattedTime: formatSecondsToHMS(Math.max(0, totalSeconds)),
    },
  };
}

export interface BatchExecutionPageProps {
  batchManager: ReturnType<typeof useBatchManager>;
  userRole: UserRole;
  onOpenCorrectionModal: () => void;
  onNavigateView: (view: AppView) => void;
  showToast: (msg: string, type?: 'success' | 'info' | 'warning') => void;
}

export const BatchExecutionPage: React.FC<BatchExecutionPageProps> = ({
  batchManager,
  userRole,
  onOpenCorrectionModal,
  onNavigateView,
  showToast,
}) => {
  const {
    activeProductId,
    selectProductBatch,
    currentStage,
    handleNextStage,
    isIndustrial,
    isQuesoPera,
    isQueso7Cueros,
    isYogurGriego,
    isKumis,
    isYogur,
    isFermentacionLine,
    parentBatch,
    splitParentBatch,
    handleExtractKumisChildBatch,
    handleExtractYogurGriegoChildBatch,
    subBatchTabs,
    batch,
    setBatch,
    batchYogur,
    setBatchYogur,
    batchKumis,
    setBatchKumis,
    batchYogurGriego,
    setBatchYogurGriego,
    activeHeaderBatch,
    handleStartProcessTimer,
    handleStopProcessTimer,
    handleStartProcessTimerYogur,
    handleStartProcessTimerKumis,
    handleStartProcessTimerYogurGriego,
    handleFinalizeBatch,
    handleFinalizeYogurBatch,
    handleFinalizeKumisBatch,
    handleFinalizeYogurGriegoBatch,
    setReviewModalOpen,
    setYogurReviewModalOpen,
    setKumisReviewModalOpen,
    setYogurGriegoReviewModalOpen,
    setCurrentStage,
  } = batchManager;

  const isReadOnly = activeHeaderBatch.status === 'COMPLETADO';
  const griegoHeredaDeYogur = Boolean(batchYogurGriego.origenYogur);

  const handleInoculacionToBatidoYSabores = React.useCallback(() => {
    if (isKumis) {
      setBatchKumis((prev) => ({
        ...prev,
        stageStatuses: {
          ...prev.stageStatuses,
          'calentar-y-cuajar': 'completada',
          moldeo: 'en_proceso',
        },
      }));
      setCurrentStage('moldeo');
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      return;
    } else if (isYogur) {
      setBatchYogur((prev) => ({
        ...prev,
        stageStatuses: {
          ...prev.stageStatuses,
          'calentar-y-cuajar': 'completada',
          desuerar: 'en_proceso',
        },
      }));
      setCurrentStage('desuerar');
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      return;
    }
    setCurrentStage('hilar');
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [isKumis, isYogur, setBatchKumis, setBatchYogur, setCurrentStage]);

  return (
    <div className="flex flex-col flex-1">
      {/* Banner de Modo Administrador si está en vista de inspección */}
      {userRole === 'administrador' && (
        <div className="bg-red-800 text-white px-3 sm:px-4 py-2 text-[11px] sm:text-xs font-bold flex flex-wrap items-center justify-between gap-2 shadow-xs">
          <div className="flex items-start sm:items-center gap-2 min-w-0 flex-1">
            <span className="material-symbols-outlined text-[18px] text-amber-300 shrink-0">
              admin_panel_settings
            </span>
            <span className="min-w-0 break-words">
              Modo Supervisor Activo · Revisando lote en vivo (
              {activeHeaderBatch.productName} · {activeHeaderBatch.loteDia || activeHeaderBatch.id})
            </span>
          </div>
          <button
            onClick={onOpenCorrectionModal}
            className="w-full sm:w-auto px-3 py-1.5 bg-white text-red-900 rounded-lg hover:bg-red-100 transition-all font-black flex items-center justify-center gap-1 cursor-pointer shrink-0"
          >
            <span className="material-symbols-outlined text-[15px]">
              edit_note
            </span>
            <span className="text-center leading-tight">Corregir Dato (Con Justificación)</span>
          </button>
        </div>
      )}

      {/* Banner de Modo Solo Lectura para Lotes Cerrados y Auditados */}
      {isReadOnly && (
        <div className="bg-slate-100 border-b border-slate-300 text-slate-800 px-3 lg:px-6 py-2.5 text-[11px] sm:text-xs font-black flex flex-wrap items-center justify-between gap-2 sm:gap-3 shadow-xs">
          <div className="flex items-start sm:items-center gap-2 min-w-0 flex-1">
            <span className="material-symbols-outlined text-[18px] text-slate-600 shrink-0">
              lock
            </span>
            <span className="min-w-0 break-words">
              🔒 Lote Cerrado y Auditado - Modo de Solo Lectura ({activeHeaderBatch.productName} · {activeHeaderBatch.loteDia || activeHeaderBatch.id})
            </span>
          </div>
          <button
            type="button"
            onClick={batchManager.openActiveReviewModal}
            className="w-full sm:w-auto px-3 py-1.5 bg-white text-slate-900 border border-slate-300 rounded-lg hover:bg-slate-50 transition-all font-bold flex items-center justify-center gap-1 cursor-pointer text-xs shadow-2xs shrink-0"
          >
            <span className="material-symbols-outlined text-[15px]">
              visibility
            </span>
            <span>Ver Resumen del Lote</span>
          </button>
        </div>
      )}

      {/* BARRA DE CONMUTACIÓN RÁPIDA DE SUB-LOTES */}
      <SubBatchSwitcherBar
        tabs={subBatchTabs}
        activeProductId={activeProductId}
        onSelectSubBatch={(productId) => selectProductBatch(productId)}
        isFermentacionLine={isFermentacionLine}
        parentBatch={parentBatch}
      />

      {/* CONTENEDOR DE ETAPAS (Protegido por Candado Read-Only cuando el lote está COMPLETADO) */}
      <fieldset
        disabled={isReadOnly}
        className={`contents ${isReadOnly ? 'pointer-events-none select-none opacity-95' : ''}`}
      >

      {/* RAMA 1: YOGUR GRIEGO */}
      {isYogurGriego ? (
        <>
          {/* Etapas 1 y 2 heredadas del Yogur de origen: solo lectura */}
          {griegoHeredaDeYogur &&
            (currentStage === 'acidificar' || currentStage === 'calentar-y-cuajar') && (
              <div className="mb-4 p-4 rounded-2xl bg-[#F7F9FC] border-2 border-[#D6DEEA] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-[#1B4E9B] text-white flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-[22px]">lock</span>
                  </div>
                  <div className="text-xs sm:text-sm text-[#434655]">
                    <p className="font-bold text-[#191C1E]">
                      Etapa heredada del Yogur {batchYogurGriego.origenYogur?.yogurId}
                    </p>
                    <p>
                      Es la misma leche: estos datos se registraron en el Yogur y se
                      muestran solo para consulta. Si hay que corregir algo, corrígelo en
                      el Yogur y se actualizará aquí. Este Griego recibió{' '}
                      <strong>{batchYogurGriego.origenYogur?.litros} L</strong> a las{' '}
                      {batchYogurGriego.origenYogur?.hora}.
                    </p>
                  </div>
                </div>
              </div>
            )}

          <fieldset
            disabled={griegoHeredaDeYogur && (currentStage === 'acidificar' || currentStage === 'calentar-y-cuajar')}
            className="contents"
          >
          {currentStage === 'acidificar' && (
            <PasteurizacionStageGriego
              state={batchYogurGriego.pasteurizacion}
              onChange={(updater) =>
                setBatchYogurGriego((prev) => ({
                  ...prev,
                  pasteurizacion: updater(prev.pasteurizacion),
                }))
              }
              processTimer={batchYogurGriego.processTimer}
              onStartProcessTimer={handleStartProcessTimerYogurGriego}
              onNextStage={handleNextStage}
              onOpenReviewModal={() => setYogurGriegoReviewModalOpen(true)}
              showToast={showToast}
            />
          )}

          {currentStage === 'calentar-y-cuajar' && (
            <InoculacionStageGriego
              state={batchYogurGriego.inoculacion}
              onChange={(updater) =>
                setBatchYogurGriego((prev) => ({
                  ...prev,
                  inoculacion: updater(prev.inoculacion),
                }))
              }
              tempLlegada45={
                batchYogurGriego.pasteurizacion.enfriamiento.temperaturaFinal
              }
              horaLlegada45={
                batchYogurGriego.pasteurizacion.enfriamiento.horaFinEnfriamiento
              }
              processTimer={batchYogurGriego.processTimer}
              onNextStage={handleNextStage}
              onOpenReviewModal={() => setYogurGriegoReviewModalOpen(true)}
              showToast={showToast}
            />
          )}
          </fieldset>

          {currentStage === 'desuerar' && (
            <MaduracionYFiltradoStageGriego
              state={batchYogurGriego.maduracionYFiltrado}
              onChange={(updater) =>
                setBatchYogurGriego((prev) => ({
                  ...prev,
                  maduracionYFiltrado: updater(prev.maduracionYFiltrado),
                }))
              }
              litrosLecheBase={batchYogurGriego.pasteurizacion.litrosLeche}
              processTimer={batchYogurGriego.processTimer}
              onNextStage={handleNextStage}
              onOpenReviewModal={() => setYogurGriegoReviewModalOpen(true)}
              showToast={showToast}
            />
          )}

          {currentStage === 'hilar' && (
            <BatidoYAdicionesStageGriego
              state={batchYogurGriego.batidoYAdiciones}
              onChange={(updater) =>
                setBatchYogurGriego((prev) => ({
                  ...prev,
                  batidoYAdiciones: updater(prev.batidoYAdiciones),
                }))
              }
              litrosLecheBase={batchYogurGriego.pasteurizacion.litrosLeche}
              processTimer={batchYogurGriego.processTimer}
              onNextStage={handleNextStage}
              onOpenReviewModal={() => setYogurGriegoReviewModalOpen(true)}
              showToast={showToast}
            />
          )}

          {currentStage === 'moldeo' && (
            <EnvasadoGriegoStage
              batch={batchYogurGriego}
              onChange={(updater) =>
                setBatchYogurGriego((prev) =>
                  conRelojDetenidoAlHitoFinal(prev, updater(prev.envasado), ingresoCuartoFrio)
                )
              }
              onFinalizeProcess={handleFinalizeYogurGriegoBatch}
              onOpenReviewModal={() => setYogurGriegoReviewModalOpen(true)}
              showToast={showToast}
            />
          )}
        </>
      ) : isKumis ? (
        /* RAMA 2: KUMIS TRADICIONAL */
        <>
          {currentStage === 'acidificar' && (
            <PasteurizacionStageKumis
              state={batchKumis.pasteurizacion}
              onChange={(updater) =>
                setBatchKumis((prev) => ({
                  ...prev,
                  pasteurizacion: updater(prev.pasteurizacion),
                }))
              }
              processTimer={batchKumis.processTimer}
              onStartProcessTimer={handleStartProcessTimerKumis}
              onNextStage={handleNextStage}
              onOpenReviewModal={() => setKumisReviewModalOpen(true)}
              showToast={showToast}
            />
          )}

          {currentStage === 'calentar-y-cuajar' && (
            <InoculacionStageKumis
              state={batchKumis.inoculacion}
              onChange={(updater) =>
                setBatchKumis((prev) => ({
                  ...prev,
                  inoculacion: updater(prev.inoculacion),
                }))
              }
              tempLlegada45={
                batchKumis.pasteurizacion.enfriamiento.temperaturaFinal
              }
              horaLlegada45={
                batchKumis.pasteurizacion.enfriamiento.horaFinEnfriamiento
              }
              litrosLecheBase={batchKumis.pasteurizacion.litrosLeche}
              loteCultivoBase={
                batchKumis.pasteurizacion.loteCultivoLacticoPastur ||
                (batchKumis.pasteurizacion as any).loteCultivoLactico
              }
              processTimer={batchKumis.processTimer}
              onNextStage={handleInoculacionToBatidoYSabores}
              onGoToBatidoYSabores={handleInoculacionToBatidoYSabores}
              onOpenReviewModal={() => setKumisReviewModalOpen(true)}
              showToast={showToast}
            />
          )}

          {currentStage === 'moldeo' && (
            <EnvasadoKumisStage
              batch={batchKumis}
              llevaAzucar={batchKumis.pasteurizacion.llevaAzucar}
              onChange={(updater) =>
                setBatchKumis((prev) =>
                  conRelojDetenidoAlHitoFinal(prev, updater(prev.envasado), ingresoCuartoFrio)
                )
              }
              onChangeBatido={(updater) =>
                setBatchKumis((prev) => ({
                  ...prev,
                  batidoYAdiciones: updater(prev.batidoYAdiciones),
                }))
              }
              onFinalizeProcess={handleFinalizeKumisBatch}
              onOpenReviewModal={() => setKumisReviewModalOpen(true)}
              showToast={showToast}
            />
          )}
        </>
      ) : isYogur ? (
        /* RAMA 3: YOGUR PROBIÓTICO */
        <>
          {currentStage === 'acidificar' && (
            <PasteurizacionStageYogur
              state={batchYogur.pasteurizacion}
              onChange={(updater) =>
                setBatchYogur((prev) => ({
                  ...prev,
                  pasteurizacion: updater(prev.pasteurizacion),
                }))
              }
              processTimer={batchYogur.processTimer}
              onStartProcessTimer={handleStartProcessTimerYogur}
              onSplitParentBatch={splitParentBatch}
              onExtractKumisChildBatch={handleExtractKumisChildBatch}
              onNextStage={handleNextStage}
              onOpenReviewModal={() => setYogurReviewModalOpen(true)}
              showToast={showToast}
            />
          )}

          {currentStage === 'calentar-y-cuajar' && (
            <InoculacionStageYogur
              state={batchYogur.inoculacion}
              onChange={(updater) =>
                setBatchYogur((prev) => ({
                  ...prev,
                  inoculacion: updater(prev.inoculacion),
                }))
              }
              tempLlegada45={
                batchYogur.pasteurizacion.enfriamiento.temperaturaFinal
              }
              horaLlegada45={
                batchYogur.pasteurizacion.enfriamiento.horaFinEnfriamiento
              }
              litrosLecheBase={batchYogur.pasteurizacion.litrosLeche}
              loteCultivoBase={
                batchYogur.pasteurizacion.loteCultivoLacticoPastur ||
                (batchYogur.pasteurizacion as any).loteCultivoLactico
              }
              llevaAzucar={batchYogur.pasteurizacion.llevaAzucar}
              processTimer={batchYogur.processTimer}
              onNextStage={handleInoculacionToBatidoYSabores}
              onGoToBatidoYSabores={handleInoculacionToBatidoYSabores}
              onFinalizeProcess={handleFinalizeYogurBatch}
              onOpenReviewModal={() => setYogurReviewModalOpen(true)}
              showToast={showToast}
              onExtractKumis={handleExtractKumisChildBatch}
              onExtractGriego={handleExtractYogurGriegoChildBatch}
              extraccionKumisRealizada={Boolean(
                batchYogur.pasteurizacion.extraccionKumis?.realizado
              )}
              extraccionGriegoRealizada={Boolean(
                batchYogur.pasteurizacion.extraccionGriego?.realizado
              )}
              litrosExtraidosPrevios={
                (batchYogur.pasteurizacion.extraccionGriego?.litrosExtraidos || 0) +
                (batchYogur.pasteurizacion.extraccionKumis?.litrosExtraidos || 0)
              }
            />
          )}

          {currentStage === 'hilar' && (
            <BatidoEnvasadoYogurStage
              state={batchYogur.batidoYAdiciones}
              onChange={(updater) =>
                setBatchYogur((prev) => ({
                  ...prev,
                  batidoYAdiciones: updater(prev.batidoYAdiciones),
                }))
              }
              llevaAzucar={batchYogur.pasteurizacion.llevaAzucar}
              litrosLecheBase={batchYogur.pasteurizacion.litrosLeche}
              horaIngresoCuartoFrio={
                batchYogur.envasado.almacenamientoCuartoFrio.horaIngreso
              }
              onNextStage={handleNextStage}
              showToast={showToast}
            />
          )}

          {currentStage === 'desuerar' && (
            <BatidoYAdicionesStageYogur
              state={batchYogur.batidoYAdiciones}
              onChange={(updater) =>
                setBatchYogur((prev) => ({
                  ...prev,
                  batidoYAdiciones: updater(prev.batidoYAdiciones),
                }))
              }
              llevaAzucar={batchYogur.pasteurizacion.llevaAzucar}
              litrosLecheBase={batchYogur.pasteurizacion.litrosLeche}
              processTimer={batchYogur.processTimer}
              onNextStage={handleNextStage}
              onOpenReviewModal={() => setYogurReviewModalOpen(true)}
              showToast={showToast}
            />
          )}

          {currentStage === 'moldeo' && (
            <EnvasadoYogurStage
              batch={batchYogur}
              llevaAzucar={batchYogur.pasteurizacion.llevaAzucar}
              onChange={(updater) =>
                setBatchYogur((prev) =>
                  conRelojDetenidoAlHitoFinal(prev, updater(prev.envasado), ingresoCuartoFrio)
                )
              }
              onFinalizeProcess={handleFinalizeYogurBatch}
              onOpenReviewModal={() => setYogurReviewModalOpen(true)}
              showToast={showToast}
            />
          )}
        </>
      ) : isIndustrial ? (
        /* RAMA 4: QUESO DOBLE CREMA INDUSTRIAL */
        <>
          {currentStage === 'acidificar' && (
            <AcidificarStageIndustrial
              state={batch.acidificar}
              onChange={(updater) =>
                setBatch((prev) => ({
                  ...prev,
                  acidificar: updater(prev.acidificar),
                }))
              }
              processTimer={batch.processTimer}
              onStartProcessTimer={handleStartProcessTimer}
              lotesLeche={batch.lotesLeche}
              onUpdateLotesLeche={(updater) =>
                setBatch((prev) => ({
                  ...prev,
                  lotesLeche: updater(prev.lotesLeche),
                }))
              }
              loteCuajo={batch.loteCuajo}
              onUpdateLoteCuajo={(val) =>
                setBatch((p) => ({ ...p, loteCuajo: val }))
              }
              loteSal={batch.loteSal}
              onUpdateLoteSal={(val) =>
                setBatch((p) => ({ ...p, loteSal: val }))
              }
              responsableProceso={batch.responsableProceso}
              onNextStage={handleNextStage}
              onOpenReviewModal={() => setReviewModalOpen(true)}
              showToast={showToast}
            />
          )}

          {currentStage === 'calentar-y-cuajar' && (
            <CalentarYCuajarStage
              state={batch.calentarYCuajar}
              onChange={(updater) =>
                setBatch((prev) => ({
                  ...prev,
                  calentarYCuajar: updater(prev.calentarYCuajar),
                }))
              }
              processTimer={batch.processTimer}
              horaAdicionCuajoDesdeAcidificar={
                batch.acidificar.phase2.horaAdicionCuajo
              }
              timestampAdicionCuajoDesdeAcidificar={
                batch.acidificar.phase2.timestampAdicionCuajo
              }
              cantidadCuajoSugerida={
                batch.acidificar.phase2.cantidadCuajoGramos
              }
              loteCuajo={batch.acidificar.phase2.loteCuajo || batch.loteCuajo}
              tipoCuajo={batch.acidificar.phase2.tipoCuajo}
              totalLecheMezcla={
                (batch.acidificar.insumos.lecheFresca || 0) +
                (batch.acidificar.insumos.lecheAcida || 0)
              }
              onUpdateCuajoLote={(newLote: string) =>
                setBatch((prev) => ({
                  ...prev,
                  loteCuajo: newLote,
                  acidificar: {
                    ...prev.acidificar,
                    phase2: {
                      ...prev.acidificar.phase2,
                      loteCuajo: newLote,
                    },
                  },
                }))
              }
              lotesLeche={batch.lotesLeche}
              onNextStage={handleNextStage}
              onOpenReviewModal={() => setReviewModalOpen(true)}
              showToast={showToast}
            />
          )}

          {currentStage === 'desuerar' && (
            <DesuerarStage
              state={batch.desuerar}
              onChange={(updater) =>
                setBatch((prev) => ({
                  ...prev,
                  desuerar: updater(prev.desuerar),
                }))
              }
              timestamp40Grados={
                batch.calentarYCuajar.temperatura40.timestamp40Grados
              }
              hora40Grados={batch.calentarYCuajar.temperatura40.horaRegistro}
              processTimer={batch.processTimer}
              onNextStage={handleNextStage}
              onOpenReviewModal={() => setReviewModalOpen(true)}
              showToast={showToast}
            />
          )}

          {currentStage === 'hilar' && (
            <HilarStage
              state={batch.hilar}
              onChange={(updater) =>
                setBatch((prev) => ({
                  ...prev,
                  hilar: updater(prev.hilar),
                }))
              }
              timestampDesuerado={batch.desuerar.desuerado.timestampDesuerado}
              horaDesuerado={batch.desuerar.desuerado.horaRegistro}
              horaFinEscurrido={
                batch.desuerar.escurrido?.horaFin ||
                batch.desuerar.desuerado.horaRegistro
              }
              timestampFinEscurrido={
                batch.desuerar.escurrido?.timestampFin ||
                batch.desuerar.desuerado.timestampDesuerado
              }
              loteSal={batch.loteSal}
              phEscurrido={batch.desuerar.escurrido.phEscurrido}
              totalLecheMezcla={
                (batch.acidificar.insumos.lecheFresca || 0) +
                (batch.acidificar.insumos.lecheAcida || 0)
              }
              processTimer={batch.processTimer}
              onStopProcessTimer={handleStopProcessTimer}
              onFinalizeProcess={handleFinalizeBatch}
              onNextStage={handleNextStage}
              onOpenModal={() => setReviewModalOpen(true)}
              showToast={showToast}
            />
          )}

          {currentStage === 'moldeo' && (
            <MoldeoStage
              batch={batch}
              onUpdateBatch={setBatch}
              onFinalizeProcess={handleFinalizeBatch}
              onOpenReviewModal={() => setReviewModalOpen(true)}
              showToast={showToast}
            />
          )}
        </>
      ) : isQuesoPera ? (
        /* RAMA 5: QUESO PERA */
        <>
          {currentStage === 'acidificar' && (
            <PremaduracionStage
              state={batch.acidificar}
              onChange={(updater) =>
                setBatch((prev) => ({
                  ...prev,
                  acidificar: updater(prev.acidificar),
                }))
              }
              processTimer={batch.processTimer}
              onStartProcessTimer={handleStartProcessTimer}
              lotesLeche={batch.lotesLeche}
              onUpdateLotesLeche={(updater) =>
                setBatch((prev) => ({
                  ...prev,
                  lotesLeche: updater(prev.lotesLeche),
                }))
              }
              loteCuajo={batch.loteCuajoPera || batch.loteCuajo}
              onUpdateLoteCuajo={(val) =>
                setBatch((p) => ({ ...p, loteCuajo: val, loteCuajoPera: val }))
              }
              loteCuajoPera={
                batch.loteCuajoPera ||
                batch.lotesLeche.loteCuajoPera ||
                batch.acidificar.insumos.loteCuajoPera ||
                batch.loteCuajo
              }
              onUpdateLoteCuajoPera={(val) =>
                setBatch((p) => ({
                  ...p,
                  loteCuajo: val,
                  loteCuajoPera: val,
                  lotesLeche: { ...p.lotesLeche, loteCuajoPera: val },
                }))
              }
              loteSal={batch.loteSal}
              onUpdateLoteSal={(val) =>
                setBatch((p) => ({ ...p, loteSal: val }))
              }
              responsableProceso={batch.responsableProceso}
              onNextStage={handleNextStage}
              onOpenReviewModal={() => setReviewModalOpen(true)}
              showToast={showToast}
            />
          )}

          {currentStage === 'calentar-y-cuajar' && (
            <CalentarYCuajarStagePera
              state={batch.calentarYCuajar}
              onChange={(updater) =>
                setBatch((prev) => ({
                  ...prev,
                  calentarYCuajar: updater(prev.calentarYCuajar),
                }))
              }
              processTimer={batch.processTimer}
              horaInicioCalentamientoDesdeAcidificar={
                batch.acidificar.inicioCalentamiento?.horaInicio
              }
              timestampInicioCalentamientoDesdeAcidificar={
                batch.acidificar.inicioCalentamiento?.timestampInicio
              }
              horaAdicionCuajoDesdeAcidificar={
                batch.acidificar.phase2.horaAdicionCuajo
              }
              timestampAdicionCuajoDesdeAcidificar={
                batch.acidificar.phase2.timestampAdicionCuajo
              }
              cantidadCuajoSugerida={
                batch.acidificar.phase2.cantidadCuajoGramos
              }
              loteCuajo={
                batch.loteCuajoPera ||
                batch.acidificar.phase2.loteCuajo ||
                batch.loteCuajo
              }
              loteCultivoPera={
                batch.acidificar.insumos.loteCultivoLacteo ||
                batch.lotesLeche.loteCultivoLacteo
              }
              tipoCuajo={batch.acidificar.phase2.tipoCuajo}
              totalLecheMezcla={
                (batch.acidificar.insumos.lecheFresca || 0) +
                (batch.acidificar.insumos.lecheAcida || 0)
              }
              onUpdateCuajoLote={(newLote: string) =>
                setBatch((prev) => ({
                  ...prev,
                  loteCuajo: newLote,
                  loteCuajoPera: newLote,
                  acidificar: {
                    ...prev.acidificar,
                    phase2: {
                      ...prev.acidificar.phase2,
                      loteCuajo: newLote,
                    },
                  },
                }))
              }
              lotesLeche={batch.lotesLeche}
              onNextStage={handleNextStage}
              onOpenReviewModal={() => setReviewModalOpen(true)}
              showToast={showToast}
            />
          )}

          {currentStage === 'desuerar' && (
            <DesuerarStagePera
              state={batch.desuerar}
              onChange={(updater) =>
                setBatch((prev) => ({
                  ...prev,
                  desuerar: updater(prev.desuerar),
                }))
              }
              timestamp40Grados={
                batch.calentarYCuajar.finReposoPh58?.timestampPh58 ||
                batch.calentarYCuajar.temperatura40.timestamp40Grados
              }
              hora40Grados={
                batch.calentarYCuajar.finReposoPh58?.horaRegistro ||
                batch.calentarYCuajar.temperatura40.horaRegistro
              }
              processTimer={batch.processTimer}
              onNextStage={handleNextStage}
              onOpenReviewModal={() => setReviewModalOpen(true)}
              showToast={showToast}
            />
          )}

          {currentStage === 'hilar' && (
            <HilarStagePera
              state={batch.hilar}
              onChange={(updater) =>
                setBatch((prev) => ({
                  ...prev,
                  hilar: updater(prev.hilar),
                }))
              }
              timestampDesuerado={batch.desuerar.desuerado.timestampDesuerado}
              horaDesuerado={batch.desuerar.desuerado.horaRegistro}
              horaFinEscurrido={
                batch.desuerar.escurrido?.horaFin ||
                batch.desuerar.desuerado.horaRegistro
              }
              timestampFinEscurrido={
                batch.desuerar.escurrido?.timestampFin ||
                batch.desuerar.desuerado.timestampDesuerado
              }
              loteSal={batch.loteSal || (batch.acidificar.insumos as any)?.loteSal}
              phEscurrido={batch.desuerar.escurrido.phEscurrido}
              totalLecheMezcla={
                (batch.acidificar.insumos.lecheFresca || 0) +
                (batch.acidificar.insumos.lecheAcida || 0)
              }
              processTimer={batch.processTimer}
              onFinalizeProcess={handleFinalizeBatch}
              onNextStage={handleNextStage}
              onOpenModal={() => setReviewModalOpen(true)}
              showToast={showToast}
            />
          )}

          {currentStage === 'moldeo' && (
            <MoldeoStagePera
              batch={batch}
              onUpdateBatch={setBatch}
              onFinalizeProcess={handleFinalizeBatch}
              onOpenReviewModal={() => setReviewModalOpen(true)}
              showToast={showToast}
            />
          )}
        </>
      ) : isQueso7Cueros ? (
        /* RAMA 6: QUESO 7 CUEROS */
        <>
          {currentStage === 'acidificar' && (
            <AcidificarStage7Cueros
              state={batch.acidificar}
              onChange={(updater) =>
                setBatch((prev) => ({
                  ...prev,
                  acidificar: updater(prev.acidificar),
                }))
              }
              processTimer={batch.processTimer}
              onStartProcessTimer={handleStartProcessTimer}
              lotesLeche={batch.lotesLeche}
              onUpdateLotesLeche={(updater) =>
                setBatch((prev) => ({
                  ...prev,
                  lotesLeche: updater(prev.lotesLeche),
                }))
              }
              loteCuajo={batch.loteCuajo}
              onUpdateLoteCuajo={(val) =>
                setBatch((p) => ({ ...p, loteCuajo: val }))
              }
              loteSal={batch.loteSal}
              onUpdateLoteSal={(val) =>
                setBatch((p) => ({ ...p, loteSal: val }))
              }
              responsableProceso={batch.responsableProceso}
              onNextStage={handleNextStage}
              onOpenReviewModal={() => setReviewModalOpen(true)}
              showToast={showToast}
            />
          )}

          {currentStage === 'calentar-y-cuajar' && (
            <CalentarYCuajarStage7Cueros
              state={batch.calentarYCuajar}
              onChange={(updater) =>
                setBatch((prev) => ({
                  ...prev,
                  calentarYCuajar: updater(prev.calentarYCuajar),
                }))
              }
              processTimer={batch.processTimer}
              horaAdicionCuajoDesdeAcidificar={
                batch.acidificar.phase2.horaAdicionCuajo
              }
              timestampAdicionCuajoDesdeAcidificar={
                batch.acidificar.phase2.timestampAdicionCuajo
              }
              cantidadCuajoSugerida={
                batch.acidificar.phase2.cantidadCuajoGramos
              }
              loteCuajo={batch.acidificar.phase2.loteCuajo || batch.loteCuajo}
              tipoCuajo={batch.acidificar.phase2.tipoCuajo}
              totalLecheMezcla={
                (batch.acidificar.insumos.lecheFresca || 0) +
                (batch.acidificar.insumos.lecheAcida || 0)
              }
              onUpdateCuajoLote={(newLote: string) =>
                setBatch((prev) => ({
                  ...prev,
                  loteCuajo: newLote,
                  acidificar: {
                    ...prev.acidificar,
                    phase2: {
                      ...prev.acidificar.phase2,
                      loteCuajo: newLote,
                    },
                  },
                }))
              }
              lotesLeche={batch.lotesLeche}
              onNextStage={handleNextStage}
              onOpenReviewModal={() => setReviewModalOpen(true)}
              showToast={showToast}
            />
          )}

          {currentStage === 'desuerar' && (
            <DesuerarStage7Cueros
              state={batch.desuerar}
              onChange={(updater) =>
                setBatch((prev) => ({
                  ...prev,
                  desuerar: updater(prev.desuerar),
                }))
              }
              timestamp40Grados={
                batch.calentarYCuajar.temperatura40.timestamp40Grados
              }
              hora40Grados={batch.calentarYCuajar.temperatura40.horaRegistro}
              processTimer={batch.processTimer}
              onNextStage={handleNextStage}
              onOpenReviewModal={() => setReviewModalOpen(true)}
              showToast={showToast}
            />
          )}

          {currentStage === 'hilar' && (
            <HilarStage7Cueros
              state={batch.hilar}
              onChange={(updater) =>
                setBatch((prev) => ({
                  ...prev,
                  hilar: updater(prev.hilar),
                }))
              }
              timestampDesuerado={batch.desuerar.desuerado.timestampDesuerado}
              horaDesuerado={batch.desuerar.desuerado.horaRegistro}
              horaFinEscurrido={
                batch.desuerar.escurrido?.horaFin ||
                batch.desuerar.desuerado.horaRegistro
              }
              timestampFinEscurrido={
                batch.desuerar.escurrido?.timestampFin ||
                batch.desuerar.desuerado.timestampDesuerado
              }
              loteSal={batch.loteSal || (batch.acidificar.insumos as any)?.loteSal}
              phEscurrido={batch.desuerar.escurrido.phEscurrido}
              totalLecheMezcla={
                batch.acidificar.insumos.litrosConfirmados ||
                (batch.acidificar.insumos.saved
                  ? batch.acidificar.insumos.lecheFresca
                  : undefined) ||
                batch.lotesLeche.litrosConfirmados ||
                batch.lotesLeche.litrosLote1 ||
                0
              }
              processTimer={batch.processTimer}
              onStopProcessTimer={handleStopProcessTimer}
              onFinalizeProcess={handleFinalizeBatch}
              onNextStage={handleNextStage}
              onOpenModal={() => setReviewModalOpen(true)}
              showToast={showToast}
            />
          )}

          {currentStage === 'moldeo' && (
            <MoldeoStage7Cueros
              batch={batch}
              onUpdateBatch={setBatch}
              onFinalizeProcess={handleFinalizeBatch}
              onOpenReviewModal={() => setReviewModalOpen(true)}
              onNavigateToProductSelect={() =>
                onNavigateView('operator_product_select')
              }
              showToast={showToast}
            />
          )}
        </>
      ) : (
        /* RAMA 7: QUESO DOBLE CREMA PREMIUM (TRADICIONAL) */
        <>
          {currentStage === 'acidificar' && (
            <AcidificarStage
              state={batch.acidificar}
              onChange={(updater) =>
                setBatch((prev) => ({
                  ...prev,
                  acidificar: updater(prev.acidificar),
                }))
              }
              processTimer={batch.processTimer}
              onStartProcessTimer={handleStartProcessTimer}
              lotesLeche={batch.lotesLeche}
              onUpdateLotesLeche={(updater) =>
                setBatch((prev) => ({
                  ...prev,
                  lotesLeche: updater(prev.lotesLeche),
                }))
              }
              loteCuajo={batch.loteCuajo}
              onUpdateLoteCuajo={(val) =>
                setBatch((p) => ({ ...p, loteCuajo: val }))
              }
              loteSal={batch.loteSal}
              onUpdateLoteSal={(val) =>
                setBatch((p) => ({ ...p, loteSal: val }))
              }
              responsableProceso={batch.responsableProceso}
              onNextStage={handleNextStage}
              onOpenReviewModal={() => setReviewModalOpen(true)}
              showToast={showToast}
            />
          )}

          {currentStage === 'calentar-y-cuajar' && (
            <CalentarYCuajarStage
              state={batch.calentarYCuajar}
              onChange={(updater) =>
                setBatch((prev) => ({
                  ...prev,
                  calentarYCuajar: updater(prev.calentarYCuajar),
                }))
              }
              processTimer={batch.processTimer}
              horaAdicionCuajoDesdeAcidificar={
                batch.acidificar.phase2.horaAdicionCuajo
              }
              timestampAdicionCuajoDesdeAcidificar={
                batch.acidificar.phase2.timestampAdicionCuajo
              }
              cantidadCuajoSugerida={
                batch.acidificar.phase2.cantidadCuajoGramos
              }
              loteCuajo={batch.acidificar.phase2.loteCuajo || batch.loteCuajo}
              tipoCuajo={batch.acidificar.phase2.tipoCuajo}
              totalLecheMezcla={
                (batch.acidificar.insumos.lecheFresca || 0) +
                (batch.acidificar.insumos.lecheAcida || 0)
              }
              onUpdateCuajoLote={(newLote: string) =>
                setBatch((prev) => ({
                  ...prev,
                  loteCuajo: newLote,
                  acidificar: {
                    ...prev.acidificar,
                    phase2: {
                      ...prev.acidificar.phase2,
                      loteCuajo: newLote,
                    },
                  },
                }))
              }
              lotesLeche={batch.lotesLeche}
              onNextStage={handleNextStage}
              onOpenReviewModal={() => setReviewModalOpen(true)}
              showToast={showToast}
            />
          )}

          {currentStage === 'desuerar' && (
            <DesuerarStage
              state={batch.desuerar}
              onChange={(updater) =>
                setBatch((prev) => ({
                  ...prev,
                  desuerar: updater(prev.desuerar),
                }))
              }
              timestamp40Grados={
                batch.calentarYCuajar.temperatura40.timestamp40Grados
              }
              hora40Grados={batch.calentarYCuajar.temperatura40.horaRegistro}
              processTimer={batch.processTimer}
              onNextStage={handleNextStage}
              onOpenReviewModal={() => setReviewModalOpen(true)}
              showToast={showToast}
            />
          )}

          {currentStage === 'hilar' && (
            <HilarStage
              state={batch.hilar}
              onChange={(updater) =>
                setBatch((prev) => ({
                  ...prev,
                  hilar: updater(prev.hilar),
                }))
              }
              timestampDesuerado={batch.desuerar.desuerado.timestampDesuerado}
              horaDesuerado={batch.desuerar.desuerado.horaRegistro}
              horaFinEscurrido={
                batch.desuerar.escurrido?.horaFin ||
                batch.desuerar.desuerado.horaRegistro
              }
              timestampFinEscurrido={
                batch.desuerar.escurrido?.timestampFin ||
                batch.desuerar.desuerado.timestampDesuerado
              }
              loteSal={batch.loteSal}
              phEscurrido={batch.desuerar.escurrido.phEscurrido}
              totalLecheMezcla={
                (batch.acidificar.insumos.lecheFresca || 0) +
                (batch.acidificar.insumos.lecheAcida || 0)
              }
              processTimer={batch.processTimer}
              onStopProcessTimer={handleStopProcessTimer}
              onFinalizeProcess={handleFinalizeBatch}
              onNextStage={handleNextStage}
              onOpenModal={() => setReviewModalOpen(true)}
              showToast={showToast}
            />
          )}

          {currentStage === 'moldeo' && (
            <MoldeoStage
              batch={batch}
              onUpdateBatch={setBatch}
              onFinalizeProcess={handleFinalizeBatch}
              onOpenReviewModal={() => setReviewModalOpen(true)}
              showToast={showToast}
            />
          )}
        </>
      )}
      </fieldset>
    </div>
  );
};
