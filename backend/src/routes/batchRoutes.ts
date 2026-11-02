import { Router } from 'express';
import { authMiddleware } from '../middlewares/authMiddleware';
import {
  getActiveBatches,
  createParentBatch,
  createChildBatch,
  completeBatch,
} from '../controllers/batchController';

export const batchRouter = Router();

// Todas las operaciones sobre lotes exigen sesión activa
batchRouter.use(authMiddleware);

batchRouter.get('/', getActiveBatches);
batchRouter.post('/parent', createParentBatch);
batchRouter.post('/child', createChildBatch);
batchRouter.post('/:batchId/complete', completeBatch);

export default batchRouter;
