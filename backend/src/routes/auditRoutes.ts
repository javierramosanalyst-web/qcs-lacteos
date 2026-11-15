import { Router } from 'express';
import { authMiddleware } from '../middlewares/authMiddleware';
import { getBatchRectifications } from '../controllers/auditController';

export const auditRouter = Router({ mergeParams: true });

// Todas las rutas de auditoría requieren sesión activa
auditRouter.use(authMiddleware);

// Historial de correcciones del lote (las correcciones se hacen por /api/workspace/rectify)
auditRouter.get('/:batchId/rectifications', getBatchRectifications);

export default auditRouter;
