import { Router } from 'express';
import { authMiddleware, requireRole } from '../middlewares/authMiddleware';
import {
  annulBatch,
  discardDraft,
  getBatchDetail,
  getBatchHistory,
  getWorkspace,
  listAuditLogs,
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
workspaceRouter.put('/drafts/:productUiId', saveDraft);
workspaceRouter.delete('/drafts/:productUiId', discardDraft);
workspaceRouter.get('/:lineCode', getWorkspace);
workspaceRouter.put('/:lineCode', saveWorkspace);

export default workspaceRouter;
