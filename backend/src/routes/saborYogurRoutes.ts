import { Router } from 'express';
import { authMiddleware, requireRole } from '../middlewares/authMiddleware';
import {
  createSaborYogur,
  listSaboresYogur,
  setSaborYogurActivo,
  updateSaborYogur,
} from '../controllers/saborYogurController';

export const saborYogurRouter = Router();

saborYogurRouter.use(authMiddleware);

saborYogurRouter.get('/', listSaboresYogur);
saborYogurRouter.post('/', requireRole('administrador', 'superadmin'), createSaborYogur);
saborYogurRouter.put('/:id', requireRole('administrador', 'superadmin'), updateSaborYogur);
saborYogurRouter.post('/:id/reactivar', requireRole('administrador', 'superadmin'), setSaborYogurActivo);
saborYogurRouter.delete('/:id', requireRole('administrador', 'superadmin'), setSaborYogurActivo);

export default saborYogurRouter;
