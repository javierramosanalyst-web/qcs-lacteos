import { useCallback, useEffect, useState } from 'react';
import { OperatorLayout } from './layouts/OperatorLayout';
import { Toast } from './components/ui/Toast';
import { LoginScreen } from './pages/auth/LoginScreen';
import { AdminGlobalDashboard } from './pages/admin/AdminGlobalDashboard';
import { AdminCorrectionModal } from './pages/admin/modals/AdminCorrectionModal';
import { AdminBatchCorrectionModal, BatchCorrectionPayload } from './pages/admin/modals/AdminBatchCorrectionModal';
import { AdminLineModal } from './pages/admin/modals/AdminLineModal';
import { AdminUserModal } from './pages/admin/modals/AdminUserModal';
import { AuditTrailModal } from './pages/admin/modals/AuditTrailModal';
import { OperatorLineSelector } from './pages/operator/OperatorLineSelector';
import { OperatorProductSelector } from './pages/operator/OperatorProductSelector';
import { BatchExecutionPage } from './pages/operator/BatchExecutionPage';
import { BatchSummaryModal } from './features/pasta-hilada/modals/BatchSummaryModal';
import { YogurSummaryModal } from './features/fermentados/modals/YogurSummaryModal';
import { KumisSummaryModal } from './features/fermentados/modals/KumisSummaryModal';
import { YogurGriegoSummaryModal } from './features/fermentados/modals/YogurGriegoSummaryModal';
import { INITIAL_LINES, INITIAL_PRODUCTS } from './data/initialData';
import {
  ApiError,
  annulBatchRequest,
  BatchDetail,
  BatchHistoryRow,
  clearToken,
  deactivateLineRequest,
  deactivateUserRequest,
  fetchAuditLogs,
  fetchBatchDetail,
  fetchBatchHistory,
  fetchInsumoLotes,
  fetchLines,
  fetchProducts,
  fetchUsers,
  getToken,
  meRequest,
  rectifyRequest,
} from './api/client';
import { useBatchManager } from './hooks/useBatchManager';
import {
  AppView,
  AuditLogEntry,
  BatchData,
  ProductDefinition,
  ProductionLine,
  ToastMessage,
  UserProfile,
  UserRole,
} from './types';
import { setInsumoLotes, useInsumoLotesVersion } from './data/insumoLotes';

export default function App() {
  useInsumoLotesVersion();
  // 1. Autenticación y Rol Activo
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [userRole, setUserRole] = useState<UserRole>('operador');
  const [currentView, setCurrentView] = useState<AppView>('operator_line_select');

  // 2. Catálogos de Planta y Auditoría
  const [restoring, setRestoring] = useState<boolean>(() => Boolean(getToken()));
  const [lines, setLines] = useState<ProductionLine[]>(INITIAL_LINES);
  const [products, setProducts] = useState<ProductDefinition[]>(INITIAL_PRODUCTS);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [batchHistory, setBatchHistory] = useState<BatchHistoryRow[]>([]);
  const [loadingData, setLoadingData] = useState<boolean>(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [editingLine, setEditingLine] = useState<ProductionLine | null>(null);

  // 3. Notificaciones (Toasts)
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback(
    (message: string, type: 'success' | 'info' | 'warning' = 'info') => {
      const id = `${Date.now()}-${Math.random()}`;
      setToasts((prev) => [...prev, { id, message, type }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4500);
    },
    []
  );

  const handleDismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // 4. Motor Central de Lotes (Lote Padre, Lotes Hijos y Cronómetros Independientes)
  const batchManager = useBatchManager({ showToast, persistenceEnabled: isAuthenticated });
  const {
    syncStatus,
    markRectified,
    selectedLineId,
    setSelectedLineId,
    activeProductId,
    selectProductBatch,
    currentStage,
    setCurrentStage,
    isQueso7Cueros,
    isFermentacionLine,
    batch,
    setBatch,
    batchYogur,
    setBatchYogur,
    batchKumis,
    setBatchKumis,
    batchYogurGriego,
    setBatchYogurGriego,
    activeHeaderBatch,
    activeStageStatuses,
    handleFinalizeBatch,
    handleFinalizeYogurBatch,
    handleFinalizeKumisBatch,
    handleFinalizeYogurGriegoBatch,
    reviewModalOpen,
    setReviewModalOpen,
    yogurReviewModalOpen,
    setYogurReviewModalOpen,
    kumisReviewModalOpen,
    setKumisReviewModalOpen,
    yogurGriegoReviewModalOpen,
    setYogurGriegoReviewModalOpen,
    openActiveReviewModal,
    assignOperatorToAllBatches,
  } = batchManager;

  // 5. Modales de Navegación y Administración
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [correctionModalOpen, setCorrectionModalOpen] = useState(false);
  const [viewerDetail, setViewerDetail] = useState<BatchDetail | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerCorrectOpen, setViewerCorrectOpen] = useState(false);
  const [createLineModalOpen, setCreateLineModalOpen] = useState(false);
  const [createUserModalOpen, setCreateUserModalOpen] = useState(false);
  const [auditTrailModalOpen, setAuditTrailModalOpen] = useState(false);

  const activeUser: UserProfile = currentUser ?? {
    id: '',
    name: '',
    code: '',
    role: userRole,
    shift: 'Jornada Continua',
  };

  const loadCatalogs = useCallback(async (role: UserRole, silent = false) => {
    setLoadingData(true);
    try {
      const [apiLines, apiProducts, apiUsers, apiInsumos] = await Promise.all([
        fetchLines(),
        fetchProducts(),
        fetchUsers(),
        fetchInsumoLotes(),
      ]);
      setInsumoLotes(apiInsumos);
      setLines(apiLines);
      if (apiProducts.length > 0) setProducts(apiProducts);
      setUsers(apiUsers);
      if (role === 'administrador') {
        const [logs, history] = await Promise.all([fetchAuditLogs(), fetchBatchHistory(200)]);
        setAuditLogs(logs);
        setBatchHistory(history);
      }
    } catch (err) {
      if (!silent) showToast(
        `No se pudieron cargar los datos: ${err instanceof Error ? err.message : 'error desconocido'}`,
        'warning'
      );
    } finally {
      setLoadingData(false);
    }
  }, [showToast]);

  useEffect(() => {
    if (!getToken()) return;
    let cancelled = false;
    meRequest()
      .then((user) => {
        if (cancelled) return;
        setCurrentUser(user);
        setUserRole(user.role);
        setIsAuthenticated(true);
        if (user.role === 'operador') assignOperatorToAllBatches(user);
        const savedProduct = localStorage.getItem('qcs_product');
        const savedLine = localStorage.getItem('qcs_line');
        const savedView = localStorage.getItem('qcs_view') as AppView | null;
        if (savedProduct) selectProductBatch(savedProduct, true);
        if (savedLine) setSelectedLineId(savedLine);
        const fallback: AppView = user.role === 'administrador' ? 'admin_dashboard' : 'operator_line_select';
        const view =
          savedView && (savedView !== 'admin_dashboard' || user.role === 'administrador')
            ? savedView
            : fallback;
        setCurrentView(view);
        void loadCatalogs(user.role);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
          clearToken();
        } else {
          showToast('No hay conexión con el servidor. Vuelve a intentar en unos segundos.', 'warning');
        }
      })
      .finally(() => {
        if (!cancelled) setRestoring(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    const id = window.setInterval(() => {
      fetchInsumoLotes().then(setInsumoLotes).catch(() => undefined);
    }, 60000);
    return () => window.clearInterval(id);
  }, [isAuthenticated]);

  useEffect(() => {
    let last = 0;
    const onExpired = () => {
      const now = Date.now();
      if (now - last < 30000) return;
      last = now;
      showToast('Tu sesion vencio y los cambios no se estan guardando en el servidor. Cierra sesion e ingresa de nuevo; tu avance local se conserva.', 'warning');
    };
    window.addEventListener('qcs:session-expired', onExpired);
    return () => window.removeEventListener('qcs:session-expired', onExpired);
  }, [showToast]);

  useEffect(() => {
    if (!isAuthenticated) return;
    localStorage.setItem('qcs_view', currentView);
    localStorage.setItem('qcs_line', selectedLineId);
    localStorage.setItem('qcs_product', activeProductId);
  }, [isAuthenticated, currentView, selectedLineId, activeProductId]);

  useEffect(() => {
    if (!isAuthenticated || userRole !== 'administrador' || currentView !== 'admin_dashboard') return;
    const id = window.setInterval(() => void loadCatalogs('administrador', true), 30000);
    return () => window.clearInterval(id);
  }, [isAuthenticated, userRole, currentView, loadCatalogs]);

  // Scroll automático al cambiar de vista, etapa o sub-lote
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [currentStage, currentView, activeProductId]);

  // Handlers de Autenticación y Navegación
  const handleLogin = (user: UserProfile) => {
    setIsAuthenticated(true);
    setCurrentUser(user);
    setUserRole(user.role);

    if (user.role === 'operador') {
      assignOperatorToAllBatches(user);
    }

    void loadCatalogs(user.role);

    if (user.role === 'administrador') {
      setCurrentView('admin_dashboard');
      showToast(`Hola ${user.name} (${user.code}) · Panel de Supervisor activado.`, 'success');
    } else {
      if (user.assignedLineId) setSelectedLineId(user.assignedLineId);
      setCurrentView('operator_line_select');
      showToast(`¡Bienvenido ${user.name}! Turno ${user.shift || 'Jornada Continua'}.`, 'success');
    }
  };

  const handleLogout = () => {
    clearToken();
    localStorage.removeItem('qcs_view');
    localStorage.removeItem('qcs_line');
    localStorage.removeItem('qcs_product');
    setIsAuthenticated(false);
    setCurrentUser(null);
    setUsers([]);
    setAuditLogs([]);
    setBatchHistory([]);
    showToast('Cerraste tu turno. Ingresa tu código para volver a entrar.');
  };

  const handleSelectLine = (lineId: string) => {
    setSelectedLineId(lineId);
    setCurrentView('operator_product_select');
  };

  const handleSelectProduct = (productId: string) => {
    selectProductBatch(productId);
    setCurrentView('batch_process');
  };

  const handleApplyCorrection = async (
    updatedBatch: BatchData,
    logEntry: AuditLogEntry
  ): Promise<string | null> => {
    try {
      await rectifyRequest({
        codigoLote: batch.id,
        estado: { batch: updatedBatch, stage: currentStage },
        stageId: logEntry.stageId,
        stageLabel: logEntry.stageLabel,
        fieldKey: logEntry.fieldKey,
        fieldLabel: logEntry.fieldLabel,
        oldValue: logEntry.oldValue,
        newValue: logEntry.newValue,
        unit: logEntry.unit,
        reasonCategory: logEntry.reasonCategory,
        justification: logEntry.justificationText,
      });
    } catch (err) {
      return err instanceof Error ? err.message : 'No se pudo registrar la corrección.';
    }
    markRectified(activeProductId, updatedBatch);
    setBatch(updatedBatch);
    void loadCatalogs(userRole, true);
    showToast(
      `Corrección guardada: ${logEntry.fieldLabel} ajustado a ${logEntry.newValue} ${logEntry.unit || ''}.`,
      'success'
    );
    return null;
  };

  const handleLineSaved = (name: string, isNew: boolean) => {
    showToast(`Línea "${name}" ${isNew ? 'creada' : 'actualizada'} en la base de datos.`, 'success');
    void loadCatalogs(userRole, true);
  };

  const handleUserSaved = (user: UserProfile, isNew: boolean) => {
    showToast(`Usuario "${user.name}" ${isNew ? 'registrado' : 'actualizado'}.`, 'success');
    void loadCatalogs(userRole, true);
  };

  const handleDeactivateUser = async (user: UserProfile) => {
    if (!window.confirm(`¿Dar de baja a ${user.name} (${user.code})? Ya no podrá ingresar al sistema.`)) return;
    try {
      await deactivateUserRequest(user.id);
      showToast(`Usuario ${user.code} dado de baja.`, 'success');
      void loadCatalogs(userRole, true);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'No se pudo dar de baja.', 'warning');
    }
  };

  const handleDeactivateLine = async (line: ProductionLine) => {
    if (!window.confirm(`¿Desactivar la línea ${line.name} (${line.code})? Dejará de aparecer para los operarios.`)) return;
    try {
      await deactivateLineRequest(line.code);
      showToast(`Línea ${line.code} desactivada.`, 'success');
      void loadCatalogs(userRole, true);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'No se pudo desactivar la línea.', 'warning');
    }
  };

  const loadViewerDetail = async (row: BatchHistoryRow): Promise<BatchDetail | null> => {
    try {
      const detail = await fetchBatchDetail(row.id);
      if (!detail.estado_ui?.batch) {
        showToast('Este lote no tiene datos de proceso registrados.', 'warning');
        return null;
      }
      setViewerDetail(detail);
      return detail;
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'No se pudo cargar el lote.', 'warning');
      return null;
    }
  };

  const handleViewBatchDetail = async (row: BatchHistoryRow) => {
    if (await loadViewerDetail(row)) setViewerOpen(true);
  };

  const handleCorrectBatchDetail = async (row: BatchHistoryRow) => {
    if (await loadViewerDetail(row)) setViewerCorrectOpen(true);
  };

  const handleAnnulBatch = async (row: BatchHistoryRow, justification: string): Promise<string | null> => {
    try {
      await annulBatchRequest(row.id, justification.trim());
    } catch (err) {
      return err instanceof Error ? err.message : 'No se pudo anular el lote.';
    }
    showToast(`Lote ${row.codigo_lote} anulado.`, 'success');
    await loadCatalogs(userRole, true);
    return null;
  };

  const handleRefreshDashboard = async () => {
    await loadCatalogs(userRole);
    showToast('Datos actualizados.', 'success');
  };

  const handleApplyViewerCorrection = async (payload: BatchCorrectionPayload): Promise<string | null> => {
    if (!viewerDetail?.estado_ui?.batch) return 'No hay lote cargado.';
    const nextBatch = JSON.parse(JSON.stringify(viewerDetail.estado_ui.batch));
    const keys = payload.path.split('.');
    let cursor = nextBatch;
    for (let i = 0; i < keys.length - 1; i += 1) cursor = cursor?.[keys[i]];
    if (cursor === undefined || cursor === null) return 'No se encontró la variable en el lote.';
    cursor[keys[keys.length - 1]] = payload.newValue;
    const estado = { ...viewerDetail.estado_ui, batch: nextBatch };
    try {
      await rectifyRequest({
        codigoLote: viewerDetail.codigo_lote,
        estado,
        stageId: keys[0],
        stageLabel: payload.stageLabel,
        fieldKey: payload.path,
        fieldLabel: payload.label,
        oldValue: payload.oldValue,
        newValue: payload.newValue,
        reasonCategory: payload.reasonCategory,
        justification: payload.justification,
      });
    } catch (err) {
      return err instanceof Error ? err.message : 'No se pudo registrar la corrección.';
    }
    setViewerDetail({ ...viewerDetail, estado_ui: estado });
    void loadCatalogs(userRole, true);
    showToast(`Corrección guardada: ${payload.label} ajustado a ${payload.newValue}.`, 'success');
    return null;
  };

  const openBatchFromDashboard = (productUiId: string, correct = false) => {
    selectProductBatch(productUiId, true);
    setCurrentView('batch_process');
    if (correct) setCorrectionModalOpen(true);
  };

  const currentSelectedLine =
    lines.find((l) => l.id === selectedLineId) || lines[0];

  if (restoring) {
    return (
      <div className="min-h-screen bg-[#F2F4F7] flex flex-col items-center justify-center gap-4 font-sans">
        <img src="/brand/logo-color.jpg" alt="Lácteos Colombia" className="w-28 h-28 rounded-3xl object-cover shadow-md" />
        <div className="flex items-center gap-2 text-sm font-bold text-[#1B4E9B]">
          <span className="material-symbols-outlined animate-spin text-[20px]">progress_activity</span>
          <span>Recuperando tu sesión...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#F2F4F7] text-[#191c1e] flex flex-col font-sans selection:bg-[#8CC63F]/40">
        <Toast toasts={toasts} onDismiss={handleDismissToast} />
        <LoginScreen onLogin={handleLogin} />
      </div>
    );
  }

  return (
    <OperatorLayout
      batch={activeHeaderBatch}
      lotesLeche={isFermentacionLine ? undefined : batch.lotesLeche}
      currentUser={activeUser}
      currentView={currentView}
      currentStage={currentStage}
      stageStatuses={activeStageStatuses}
      mobileOpen={mobileMenuOpen}
      onCloseMobile={() => setMobileMenuOpen(false)}
      onOpenMobileMenu={() => setMobileMenuOpen(true)}
      onSelectStage={(stage) => {
        setCurrentStage(stage);
        setCurrentView('batch_process');
      }}
      syncStatus={syncStatus}
      onNavigateView={setCurrentView}
      onOpenReviewModal={openActiveReviewModal}
      onOpenCorrectionModal={
        userRole === 'administrador' && currentView === 'batch_process' && !isFermentacionLine
          ? () => setCorrectionModalOpen(true)
          : undefined
      }
      onOpenAuditTrailModal={() => setAuditTrailModalOpen(true)}
      onLogout={handleLogout}
    >
      <Toast toasts={toasts} onDismiss={handleDismissToast} />

      {currentView === 'admin_dashboard' && (
        <AdminGlobalDashboard
          lines={lines}
          products={products}
          users={users}
          currentUser={activeUser}
          auditLogsCount={auditLogs.length}
          history={batchHistory}
          loading={loadingData}
          onRefresh={() => void handleRefreshDashboard()}
          onCreateLine={() => {
            setEditingLine(null);
            setCreateLineModalOpen(true);
          }}
          onEditLine={(line) => {
            setEditingLine(line);
            setCreateLineModalOpen(true);
          }}
          onDeactivateLine={handleDeactivateLine}
          onCreateUser={() => {
            setEditingUser(null);
            setCreateUserModalOpen(true);
          }}
          onEditUser={(user) => {
            setEditingUser(user);
            setCreateUserModalOpen(true);
          }}
          onDeactivateUser={handleDeactivateUser}
          onOpenAuditTrail={() => setAuditTrailModalOpen(true)}
          onOpenLine={handleSelectLine}
          onOpenBatch={(pid) => openBatchFromDashboard(pid)}
          onCorrectBatch={(pid) => openBatchFromDashboard(pid, true)}
          onViewBatchDetail={handleViewBatchDetail}
          onCorrectBatchDetail={handleCorrectBatchDetail}
          onAnnulBatch={handleAnnulBatch}
        />
      )}

      {currentView === 'operator_line_select' && (
        <OperatorLineSelector
          lines={lines}
          currentUser={activeUser}
          activeBatchId={activeHeaderBatch.id}
          activeBatchStatus={activeHeaderBatch.status}
          onSelectLine={handleSelectLine}
          onContinueCurrentBatch={() => setCurrentView('batch_process')}
          onViewBatchSummary={openActiveReviewModal}
        />
      )}

      {currentView === 'operator_product_select' && (
        <OperatorProductSelector
          selectedLine={currentSelectedLine}
          products={products}
          onSelectProduct={handleSelectProduct}
          onBackToLines={() => setCurrentView('operator_line_select')}
        />
      )}

      {currentView === 'batch_process' && (
        <BatchExecutionPage
          batchManager={batchManager}
          userRole={userRole}
          onOpenCorrectionModal={() => setCorrectionModalOpen(true)}
          onNavigateView={setCurrentView}
          showToast={showToast}
        />
      )}

      {/* Modales de Resumen y Certificación por Producto */}
      <YogurSummaryModal
        isOpen={yogurReviewModalOpen}
        onClose={() => setYogurReviewModalOpen(false)}
        batch={batchYogur}
        users={users}
        onFinalizeBatch={() => {
          handleFinalizeYogurBatch(false);
          setYogurReviewModalOpen(false);
          setCurrentView('operator_line_select');
        }}
        onChangeObservaciones={(obs) =>
          setBatchYogur((prev) => ({ ...prev, observaciones: obs }))
        }
        onChangeOperariosIntervinientes={(operarios) =>
          setBatchYogur((prev) => ({
            ...prev,
            operariosIntervinientes: operarios,
          }))
        }
      />

      <KumisSummaryModal
        isOpen={kumisReviewModalOpen}
        onClose={() => setKumisReviewModalOpen(false)}
        batch={batchKumis}
        users={users}
        onFinalizeBatch={() => {
          handleFinalizeKumisBatch(false);
          setKumisReviewModalOpen(false);
          setCurrentView('operator_line_select');
        }}
        onChangeObservaciones={(obs) =>
          setBatchKumis((prev) => ({ ...prev, observaciones: obs }))
        }
        onChangeOperariosIntervinientes={(operarios) =>
          setBatchKumis((prev) => ({
            ...prev,
            operariosIntervinientes: operarios,
          }))
        }
      />

      <YogurGriegoSummaryModal
        isOpen={yogurGriegoReviewModalOpen}
        onClose={() => setYogurGriegoReviewModalOpen(false)}
        batch={batchYogurGriego}
        users={users}
        onFinalizeBatch={() => {
          handleFinalizeYogurGriegoBatch(false);
          setYogurGriegoReviewModalOpen(false);
          setCurrentView('operator_line_select');
        }}
        onChangeObservaciones={(obs) =>
          setBatchYogurGriego((prev) => ({ ...prev, observaciones: obs }))
        }
        onChangeOperariosIntervinientes={(operarios) =>
          setBatchYogurGriego((prev) => ({
            ...prev,
            operariosIntervinientes: operarios,
          }))
        }
      />

      <BatchSummaryModal
        isOpen={reviewModalOpen}
        onClose={() => setReviewModalOpen(false)}
        batch={batch}
        users={users}
        onFinalizeBatch={() => {
          handleFinalizeBatch(false);
          setReviewModalOpen(false);
          setCurrentView('operator_line_select');
        }}
        onChangeObservaciones={(obs) =>
          setBatch((prev) => ({ ...prev, observaciones: obs }))
        }
        onChangeOperariosIntervinientes={(operarios) =>
          setBatch((prev) => ({ ...prev, operariosIntervinientes: operarios }))
        }
      />

      {viewerDetail?.estado_ui?.batch && viewerDetail.producto_ui_id === 'prod-yogur' && (
        <YogurSummaryModal
          isOpen={viewerOpen}
          onClose={() => setViewerOpen(false)}
          batch={{ ...viewerDetail.estado_ui.batch, status: viewerDetail.estado === 'COMPLETADO' ? 'COMPLETADO' : viewerDetail.estado_ui.batch.status }}
          users={users}
        />
      )}
      {viewerDetail?.estado_ui?.batch && viewerDetail.producto_ui_id === 'prod-kumis' && (
        <KumisSummaryModal
          isOpen={viewerOpen}
          onClose={() => setViewerOpen(false)}
          batch={{ ...viewerDetail.estado_ui.batch, status: viewerDetail.estado === 'COMPLETADO' ? 'COMPLETADO' : viewerDetail.estado_ui.batch.status }}
          users={users}
        />
      )}
      {viewerDetail?.estado_ui?.batch && viewerDetail.producto_ui_id === 'prod-yogur-griego' && (
        <YogurGriegoSummaryModal
          isOpen={viewerOpen}
          onClose={() => setViewerOpen(false)}
          batch={{ ...viewerDetail.estado_ui.batch, status: viewerDetail.estado === 'COMPLETADO' ? 'COMPLETADO' : viewerDetail.estado_ui.batch.status }}
          users={users}
        />
      )}
      {viewerDetail?.estado_ui?.batch &&
        !['prod-yogur', 'prod-kumis', 'prod-yogur-griego'].includes(viewerDetail.producto_ui_id ?? '') && (
          <BatchSummaryModal
            isOpen={viewerOpen}
            onClose={() => setViewerOpen(false)}
            batch={{ ...viewerDetail.estado_ui.batch, status: viewerDetail.estado === 'COMPLETADO' ? 'COMPLETADO' : viewerDetail.estado_ui.batch.status }}
            users={users}
          />
        )}

      <AdminBatchCorrectionModal
        isOpen={viewerCorrectOpen}
        onClose={() => setViewerCorrectOpen(false)}
        batch={viewerDetail?.estado_ui?.batch ?? {}}
        title={viewerDetail ? `Lote ${viewerDetail.codigo_lote} · ${viewerDetail.producto_nombre}` : ''}
        adminName={activeUser.name}
        onApply={handleApplyViewerCorrection}
      />

      {/* Modales Administrativos */}
      <AdminCorrectionModal
        isOpen={correctionModalOpen}
        onClose={() => setCorrectionModalOpen(false)}
        batch={batch}
        adminName={activeUser.name}
        onApplyCorrection={handleApplyCorrection}
      />

      <AdminLineModal
        isOpen={createLineModalOpen}
        onClose={() => setCreateLineModalOpen(false)}
        products={products}
        editingLine={editingLine}
        onSaved={handleLineSaved}
      />

      <AdminUserModal
        isOpen={createUserModalOpen}
        onClose={() => setCreateUserModalOpen(false)}
        lines={lines}
        editingUser={editingUser}
        onSaved={handleUserSaved}
      />

      <AuditTrailModal
        isOpen={auditTrailModalOpen}
        onClose={() => setAuditTrailModalOpen(false)}
        logs={auditLogs}
      />
    </OperatorLayout>
  );
}
