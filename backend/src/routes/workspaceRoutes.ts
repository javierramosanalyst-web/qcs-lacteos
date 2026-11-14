import { Router } from 'express';
import { authMiddleware, requireRole } from '../middlewares/authMiddleware';
import {
  annulBatch,
  discardDraft,
  getBatchDetail,
  getBatchHistory,
  getDraftStatus,
  getWorkspace,
  listAuditLogs,
  listOpenDrafts,
  rectifyBatchField,
  saveDraft,
  saveWorkspace,
} from '../controllers/workspaceController';
import { getBatchTimes, getProductionReport } from '../controllers/reportController';

export const workspaceRouter = Router();

workspaceRouter.use(authMiddleware);

workspaceRouter.get('/history', requireRole('administrador', 'superadmin'), getBatchHistory);
workspaceRouter.get('/audit', requireRole('administrador', 'superadmin'), listAuditLogs);
workspaceRouter.get('/reporte', requireRole('administrador', 'superadmin'), getProductionReport);
// Tiempos de etapas y pasos de un lote: también los ve el operario en el resumen al cerrar.
workspaceRouter.get('/batches/:loteId/tiempos', getBatchTimes);
workspaceRouter.post('/rectify', requireRole('administrador', 'superadmin'), rectifyBatchField);
workspaceRouter.get('/batches/:loteId', requireRole('administrador', 'superadmin'), getBatchDetail);
workspaceRouter.post('/batches/:loteId/anular', requireRole('administrador', 'superadmin'), annulBatch);
workspaceRouter.get('/drafts', listOpenDrafts);
workspaceRouter.put('/drafts/:productUiId', saveDraft);
workspaceRouter.get('/drafts/:productUiId/estado', getDraftStatus);
workspaceRouter.delete('/drafts/:productUiId', requireRole('administrador', 'superadmin'), discardDraft);
workspaceRouter.get('/:lineCode', getWorkspace);
workspaceRouter.put('/:lineCode', saveWorkspace);

export default workspaceRouter;
