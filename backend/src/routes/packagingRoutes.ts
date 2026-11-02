import { Router } from 'express';
import { authMiddleware } from '../middlewares/authMiddleware';
import { validateBatchNotCompleted } from '../middlewares/batchStateValidator';
import {
  addPackagingRecord,
  getPackagingRecords,
  addCheeseDerivation,
} from '../controllers/packagingController';

export const packagingRouter = Router({ mergeParams: true });

// Exigir sesión activa
packagingRouter.use(authMiddleware);

// El envasado y moldeo solo se registran antes de cerrar el lote en cuarto frío
const batchLockGuard = validateBatchNotCompleted({ paramName: 'batchId' });

packagingRouter.post('/:batchId/packaging', batchLockGuard, addPackagingRecord);
packagingRouter.get('/:batchId/packaging', getPackagingRecords);
packagingRouter.post('/:batchId/derivations', batchLockGuard, addCheeseDerivation);

export default packagingRouter;
