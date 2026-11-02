import { Router } from 'express';
import { authMiddleware, requireRole } from '../middlewares/authMiddleware';
import {
  createBatchRectification,
  getBatchRectifications,
} from '../controllers/auditController';

export const auditRouter = Router({ mergeParams: true });

// Todas las rutas de auditoría requieren sesión activa
auditRouter.use(authMiddleware);

// Endpoint de rectificación administrativa post-cierre:
// Exige rol administrador o superadmin, pero NO validateBatchNotCompleted (permite modificar lotes cerrados vía override transaccional)
auditRouter.post(
  '/:batchId/rectifications',
  requireRole('administrador', 'superadmin'),
  createBatchRectification
);

// Consulta del Audit Trail de rectificaciones del lote
auditRouter.get('/:batchId/rectifications', getBatchRectifications);

export default auditRouter;
