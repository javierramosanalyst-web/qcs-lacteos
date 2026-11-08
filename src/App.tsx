import { useCallback, useEffect, useRef, useState } from 'react';
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
  discardDraftRequest,
  fetchAuditLogs,
  fetchBatchDetail,
  fetchBatchHistory,
  fetchDraftStatus,
  fetchOpenDrafts,
  fetchInsumoLotes,
  fetchLines,
  fetchProducts,
  fetchUsers,
  fetchSaboresYogur,
  hasSession,
  logoutRequest,
  meRequest,
  rectifyRequest,
} from './api/client';
import type { OpenDraftRow } from './api/client';
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
import { setInsumoLotes, setSaboresYogur, useInsumoLotesVersion } from './data/insumoLotes';

const ACTIVITY_KEY = 'qcs_last_activity';
const IDLE_LIMIT_MS = 15 * 60 * 1000;
const SPLASH_MIN_MS = 4000;

export default function App() {
  useInsumoLotesVersion();
  // 1. Autenticación y Rol Activo
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [userRole, setUserRole] = useState<UserRole>('operador');
  const [currentView, setCurrentView] = useState<AppView>('operator_line_select');
  const [openDrafts, setOpenDrafts] = useState<OpenDraftRow[]>([]);

  // 2. Catálogos de Planta y Auditoría
  const [restoring, setRestoring] = useState<boolean>(() => hasSession());
  const [finishing, setFinishing] = useState<boolean>(false);
  const finishingTimer = useRef<number | null>(null);
  const [loteCerrado, setLoteCerrado] = useState<{
    estado: string;
    codigo: string | null;
    por: string | null;
  } | null>(null);
  const loteEnProcesoRef = useRef<Record<string, string>>({});
  const loteCerradoMostradoRef = useRef<string | null>(null);
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
  const batchManager = useBatchManager({ showToast, persistenceEnabled: isAuthenticated, currentUser });
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
        fetchUsers().catch(() => []),
        fetchInsumoLotes().catch(() => []),
      ]);
      setInsumoLotes(apiInsumos);
      fetchSaboresYogur().then(setSaboresYogur).catch(() => undefined);
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
    if (!hasSession()) return;
    const splashStart = Date.now();
    const lastAct = Number(sessionStorage.getItem(ACTIVITY_KEY) || 0);
    if (lastAct && Date.now() - lastAct >= IDLE_LIMIT_MS) {
      clearToken();
      sessionStorage.removeItem(ACTIVITY_KEY);
      setRestoring(false);
      return;
    }
    let cancelled = false;
    meRequest()
      .then((user) => {
        if (cancelled) return;
        setCurrentUser(user);
        setUserRole(user.role);
        setIsAuthenticated(true);
        if (user.role === 'operador') assignOperatorToAllBatches(user);
        const savedProduct = sessionStorage.getItem('qcs_product');
        const savedLine = sessionStorage.getItem('qcs_line');
        const savedView = sessionStorage.getItem('qcs_view') as AppView | null;
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
        const wait = Math.max(0, SPLASH_MIN_MS - (Date.now() - splashStart));
        window.setTimeout(() => {
          if (!cancelled) setRestoring(false);
        }, wait);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    if (window.history.state?.qcsView !== currentView) {
      window.history.pushState({ qcsView: currentView }, '');
    }
  }, [isAuthenticated, currentView]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const onPop = (e: PopStateEvent) => {
      const v = e.state?.qcsView as AppView | undefined;
      if (v && (v !== 'admin_dashboard' || userRole === 'administrador')) {
        setCurrentView(v);
      } else {
        window.history.pushState({ qcsView: currentView }, '');
      }
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [isAuthenticated, userRole, currentView]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const id = window.setInterval(() => {
      fetchInsumoLotes().then(setInsumoLotes).catch(() => undefined);
      fetchSaboresYogur().then(setSaboresYogur).catch(() => undefined);
    }, 60000);
    return () => window.clearInterval(id);
  }, [isAuthenticated]);

  useEffect(() => {
    let last = 0;
    const onExpired = (event: Event) => {
      const now = Date.now();
      if (now - last < 30000) return;
      last = now;
      const detalle = (event as CustomEvent<{ error?: string }>).detail;
      if (detalle?.error === 'SESSION_REPLACED') {
        showToast(
          'Se inició sesión con otro usuario en este dispositivo. Esta pestaña se cerró; ingresa de nuevo.',
          'warning'
        );
        handleLogoutRef.current('Se inició sesión con otro usuario en este dispositivo.');
        return;
      }
      showToast('Tu sesion vencio y los cambios no se estan guardando en el servidor. Cierra sesion e ingresa de nuevo; tu avance local se conserva.', 'warning');
    };
    window.addEventListener('qcs:session-expired', onExpired);
    return () => window.removeEventListener('qcs:session-expired', onExpired);
  }, [showToast]);

  useEffect(() => {
    if (!isAuthenticated) return;
    sessionStorage.setItem('qcs_view', currentView);
    sessionStorage.setItem('qcs_line', selectedLineId);
    sessionStorage.setItem('qcs_product', activeProductId);
  }, [isAuthenticated, currentView, selectedLineId, activeProductId]);

  useEffect(() => {
    const vistaConBorradores =
      currentView === 'operator_line_select' || currentView === 'admin_dashboard';
    if (!isAuthenticated || !vistaConBorradores) return;
    let cancelled = false;
    const cargar = () => {
      fetchOpenDrafts()
        .then((rows) => {
          if (!cancelled) setOpenDrafts(rows);
        })
        .catch(() => undefined);
    };
    cargar();
    const id = window.setInterval(cargar, 15000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [isAuthenticated, currentView]);

  useEffect(() => {
    if (!isAuthenticated || userRole !== 'administrador' || currentView !== 'admin_dashboard') return;
    const id = window.setInterval(() => void loadCatalogs('administrador', true), 30000);
    return () => window.clearInterval(id);
  }, [isAuthenticated, userRole, currentView, loadCatalogs]);

  useEffect(() => {
    if (!isAuthenticated || currentView !== 'batch_process') return;
    let cancelado = false;
    const revisar = async () => {
      try {
        const estado = await fetchDraftStatus(activeProductId);
        if (cancelado) return;
        if (estado.estado === 'EN_PROCESO') {
          loteEnProcesoRef.current[activeProductId] = estado.codigo_lote ?? '';
          return;
        }
        if (estado.estado !== 'COMPLETADO' && estado.estado !== 'ANULADO') return;
        const abierto = loteEnProcesoRef.current[activeProductId];
        if (!abierto) return;
        if (!estado.codigo_lote || estado.codigo_lote !== abierto) return;
        const clave = `${activeProductId}:${estado.codigo_lote}`;
        if (loteCerradoMostradoRef.current === clave) return;
        loteCerradoMostradoRef.current = clave;
        delete loteEnProcesoRef.current[activeProductId];
        setLoteCerrado({
          estado: estado.estado,
          codigo: estado.codigo_lote,
          por: estado.finalizado_por,
        });
      } catch {
        return;
      }
    };
    void revisar();
    const id = window.setInterval(() => void revisar(), 5000);
    return () => {
      cancelado = true;
      window.clearInterval(id);
    };
  }, [isAuthenticated, currentView, activeProductId]);

  useEffect(() => {
    if (!loteCerrado) return;
    const id = window.setTimeout(() => {
      setLoteCerrado(null);
      finishToLineSelect();
    }, 9000);
    return () => window.clearTimeout(id);
  }, [loteCerrado]);

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

  const handleLogout = (reason?: string) => {
    clearToken();
    void logoutRequest();
    sessionStorage.removeItem(ACTIVITY_KEY);
    setCurrentView('operator_line_select');
    setUserRole('operador');
    sessionStorage.removeItem('qcs_view');
    sessionStorage.removeItem('qcs_line');
    sessionStorage.removeItem('qcs_product');
    setIsAuthenticated(false);
    setCurrentUser(null);
    setUsers([]);
    setAuditLogs([]);
    setBatchHistory([]);
    showToast(reason || 'Cerraste tu turno. Ingresa tu código para volver a entrar.');
  };

  const handleLogoutRef = useRef(handleLogout);
  handleLogoutRef.current = handleLogout;

  useEffect(() => {
    if (!isAuthenticated) return;
    const touch = () => sessionStorage.setItem(ACTIVITY_KEY, String(Date.now()));
    touch();
    const events = ['mousedown', 'keydown', 'touchstart', 'scroll', 'click'];
    let last = 0;
    const onActivity = () => {
      const now = Date.now();
      if (now - last < 5000) return;
      last = now;
      touch();
    };
    events.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));
    const timer = window.setInterval(() => {
      const stored = Number(sessionStorage.getItem(ACTIVITY_KEY) || Date.now());
      if (Date.now() - stored >= IDLE_LIMIT_MS) {
        handleLogoutRef.current('Sesión cerrada por 15 minutos de inactividad. Ingresa de nuevo.');
      }
    }, 15000);
    return () => {
      events.forEach((e) => window.removeEventListener(e, onActivity));
      window.clearInterval(timer);
    };
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated && currentView === 'admin_dashboard' && userRole !== 'administrador') {
      setCurrentView('operator_line_select');
    }
  }, [isAuthenticated, currentView, userRole]);

  const handleSelectLine = (lineId: string) => {
    setSelectedLineId(lineId);
    setCurrentView('operator_product_select');
  };

  const handleSelectProduct = (productId: string) => {
    selectProductBatch(productId);
    setCurrentView('batch_process');
  };

  const handleContinueProduct = (productId: string) => {
    selectProductBatch(productId, true);
    setCurrentView('batch_process');
  };

  const handleDiscardDraft = async (productId: string) => {
    try {
      await discardDraftRequest(productId);
      setOpenDrafts((prev) => prev.filter((d) => d.producto_ui_id !== productId));
      showToast('✓ Borrador descartado. El producto quedó libre para un nuevo lote.', 'success');
    } catch (err) {
      showToast(
        `No se pudo descartar el borrador: ${err instanceof Error ? err.message : 'error desconocido'}`,
        'warning'
      );
    }
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

  const finishToLineSelect = () => {
    setFinishing(true);
    if (finishingTimer.current) window.clearTimeout(finishingTimer.current);
    finishingTimer.current = window.setTimeout(() => {
      setCurrentView('operator_line_select');
      setFinishing(false);
      finishingTimer.current = null;
    }, SPLASH_MIN_MS);
  };

  if (restoring || finishing) {
    return (
      <div className="min-h-screen bg-[#F2F4F7] flex flex-col items-center justify-center gap-4 font-sans">
        <img src="/brand/logo-color.jpg" alt="Lácteos Colombia" className="w-28 h-28 rounded-3xl object-cover shadow-md" />
        <div className="flex items-center gap-2 text-sm font-bold text-[#1B4E9B]">
          <span className="material-symbols-outlined animate-spin text-[20px]">progress_activity</span>
          <span>{finishing ? 'Guardando el lote y volviendo a las líneas de producción...' : 'Recuperando tu sesión...'}</span>
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
      onLogout={() => handleLogout()}
    >
      <Toast toasts={toasts} onDismiss={handleDismissToast} />

      {currentView === 'admin_dashboard' && userRole === 'administrador' && currentUser?.role === 'administrador' && (
        <AdminGlobalDashboard
          lines={lines}
          products={products}
          users={users}
          currentUser={activeUser}
          auditLogsCount={auditLogs.length}
          history={batchHistory}
          loading={loadingData}
          onRefresh={() => {
            void handleRefreshDashboard();
            void fetchOpenDrafts()
              .then(setOpenDrafts)
              .catch(() => undefined);
          }}
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
          openDrafts={openDrafts}
          onDiscardDraft={handleDiscardDraft}
        />
      )}

      {currentView === 'operator_line_select' && (
        <OperatorLineSelector
          lines={lines}
          products={products}
          currentUser={activeUser}
          activeBatchId={activeHeaderBatch.id}
          activeBatchStatus={activeHeaderBatch.status}
          openDrafts={openDrafts}
          onSelectLine={handleSelectLine}
          onContinueProduct={handleContinueProduct}
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
          derivedLots={{
            'prod-kumis': {
              activo: Boolean(batchKumis.origenYogur) && batchKumis.status !== 'COMPLETADO',
              yogurId: batchKumis.origenYogur?.yogurId,
              litros: batchKumis.origenYogur?.litros,
            },
            'prod-yogur-griego': {
              activo:
                Boolean(batchYogurGriego.origenYogur) && batchYogurGriego.status !== 'COMPLETADO',
              yogurId: batchYogurGriego.origenYogur?.yogurId,
              litros: batchYogurGriego.origenYogur?.litros,
            },
          }}
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
          if (
            batchYogur.pasteurizacion.extraccionKumis?.realizado &&
            batchKumis.status !== 'COMPLETADO'
          ) {
            selectProductBatch('prod-kumis', true);
            setCurrentView('batch_process');
          } else {
            finishToLineSelect();
          }
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
          finishToLineSelect();
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
          finishToLineSelect();
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
          finishToLineSelect();
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

      {loteCerrado && (
        <div className="fixed inset-0 z-[120] bg-[#0B1B33]/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-[#D6DEEA] overflow-hidden">
            <div className="px-6 pt-8 pb-6 flex flex-col items-center text-center gap-4">
              <img
                src="/brand/logo-color.jpg"
                alt="Lácteos Colombia"
                className="w-24 h-24 rounded-3xl object-cover shadow-md"
              />
              <span
                className={`material-symbols-outlined text-[52px] ${
                  loteCerrado.estado === 'ANULADO' ? 'text-[#B42318]' : 'text-[#5FAF32]'
                }`}
              >
                {loteCerrado.estado === 'ANULADO' ? 'cancel' : 'verified'}
              </span>
              <h2 className="text-xl font-black text-[#191C1E] leading-tight">
                {loteCerrado.estado === 'ANULADO'
                  ? 'Este lote fue anulado'
                  : 'Este lote fue completado satisfactoriamente'}
              </h2>
              <p className="text-sm text-[#434655]">
                {loteCerrado.estado === 'ANULADO' ? 'Anulado por' : 'Fue terminado por'}{' '}
                <strong className="text-[#143A73]">{loteCerrado.por || 'Operador de planta'}</strong>
              </p>
              {loteCerrado.codigo && (
                <span className="text-[11px] font-mono font-bold px-3 py-1 rounded-full bg-[#F2F4F7] border border-[#D6DEEA] text-[#143A73]">
                  {loteCerrado.codigo}
                </span>
              )}
              <p className="text-xs text-[#6B7280]">
                El proceso se cerró en otra sesión. Serás enviado a la selección de líneas de producción.
              </p>
            </div>
            <div className="px-6 pb-6">
              <button
                onClick={() => {
                  setLoteCerrado(null);
                  finishToLineSelect();
                }}
                className="w-full h-12 bg-[#1B4E9B] hover:bg-[#143A73] text-white rounded-xl text-sm font-bold shadow-sm transition-all cursor-pointer active:scale-[0.99] flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
                Ir a selección de líneas
              </button>
            </div>
          </div>
        </div>
      )}
    </OperatorLayout>
  );
}
