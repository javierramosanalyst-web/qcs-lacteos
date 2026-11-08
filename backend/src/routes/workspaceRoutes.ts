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

export const workspaceRouter = Router();

workspaceRouter.use(authMiddleware);

workspaceRouter.get('/history', requireRole('administrador', 'superadmin'), getBatchHistory);
workspaceRouter.get('/audit', requireRole('administrador', 'superadmin'), listAuditLogs);
workspaceRouter.post('/rectify', requireRole('administrador', 'superadmin'), rectifyBatchField);
workspaceRouter.get('/batches/:loteId', requireRole('administrador', 'superadmin'), getBatchDetail);
workspaceRouter.post('/batches/:loteId/anular', requireRole('administrador', 'superadmin'), annulBatch);
workspaceRouter.get('/drafts', listOpenDrafts);
workspaceRouter.put('/drafts/:productUiId', saveDraft);
workspaceRouter.get('/drafts/:productUiId/estado', getDraftStatus);
workspaceRouter.delete('/drafts/:productUiId', discardDraft);
workspaceRouter.get('/:lineCode', getWorkspace);
workspaceRouter.put('/:lineCode', saveWorkspace);

export default workspaceRouter;
