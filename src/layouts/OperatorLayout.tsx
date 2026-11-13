import React from 'react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { AppView, BatchData, LotesLeche, StageId, UserProfile } from '../types';
import { SyncStatus } from '../hooks/useBatchPersistence';

export interface OperatorLayoutProps {
  batch: BatchData;
  lotesLeche?: LotesLeche;
  currentUser: UserProfile;
  currentView: AppView;
  currentStage: StageId;
  stageStatuses: Record<StageId, 'pendiente' | 'en_proceso' | 'completada'>;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  onOpenMobileMenu: () => void;
  onSelectStage: (stage: StageId) => void;
  syncStatus?: SyncStatus;
  onNavigateView: (view: AppView) => void;
  onOpenReviewModal: () => void;
  onOpenCorrectionModal?: () => void;
  onOpenAuditTrailModal?: () => void;
  onLogout: () => void;
  children: React.ReactNode;
}

export const OperatorLayout: React.FC<OperatorLayoutProps> = ({
  batch,
  lotesLeche,
  currentUser,
  currentView,
  currentStage,
  stageStatuses,
  mobileOpen,
  onCloseMobile,
  onOpenMobileMenu,
  onSelectStage,
  syncStatus,
  onNavigateView,
  onOpenReviewModal,
  onOpenCorrectionModal,
  onOpenAuditTrailModal,
  onLogout,
  children,
}) => {
  return (
    <div className="min-h-screen bg-[#F2F4F7] text-[#191c1e] flex flex-col font-sans selection:bg-[#8CC63F]/40">
      <Sidebar
        currentStage={currentStage}
        onSelectStage={onSelectStage}
        currentView={currentView}
        onNavigateView={onNavigateView}
        userRole={currentUser.role}
        batchId={batch.loteDia || batch.id}
        productName={batch.productName}
        productId={batch.productId}
        lotesLeche={lotesLeche}
        llevaAzucar={(batch as any).pasteurizacion?.llevaAzucar}
        stageStatuses={stageStatuses}
        mobileOpen={mobileOpen}
        onCloseMobile={onCloseMobile}
        onOpenAuditTrailModal={onOpenAuditTrailModal}
        onOpenCorrectionModal={onOpenCorrectionModal}
      />

      <div
        className={`${
          currentView === 'batch_process' ? 'lg:pl-72' : ''
        } flex flex-col min-h-screen transition-all duration-300`}
      >
        <Header
          batch={batch}
          currentUser={currentUser}
          currentView={currentView}
          syncStatus={syncStatus}
          onNavigateView={onNavigateView}
          onOpenMobileMenu={onOpenMobileMenu}
          onOpenReviewModal={onOpenReviewModal}
          onOpenCorrectionModal={onOpenCorrectionModal}
          onLogout={onLogout}
        />

        <main className="mt-16 flex-1 flex flex-col">{children}</main>
      </div>
    </div>
  );
};
