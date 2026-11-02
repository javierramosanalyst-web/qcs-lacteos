import { Router } from 'express';
import { authMiddleware } from '../middlewares/authMiddleware';
import { validateBatchNotCompleted } from '../middlewares/batchStateValidator';
import {
  updateStageStatus,
  addMeasurement,
  addIngredient,
} from '../controllers/executionController';

export const executionRouter = Router({ mergeParams: true });

// Todas las rutas de ejecución requieren sesión activa
executionRouter.use(authMiddleware);

// Middleware de candado de seguridad: bloquea con 403 cualquier edición operativa en lotes COMPLETADOS o ANULADOS
const batchLockGuard = validateBatchNotCompleted({ paramName: 'batchId' });

executionRouter.put('/:batchId/stages/:stageId', batchLockGuard, updateStageStatus);
executionRouter.post('/:batchId/measurements', batchLockGuard, addMeasurement);
executionRouter.post('/:batchId/ingredients', batchLockGuard, addIngredient);

export default executionRouter;
