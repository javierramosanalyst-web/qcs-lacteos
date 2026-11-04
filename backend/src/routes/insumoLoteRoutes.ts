import { Router } from 'express';
import { authMiddleware, requireRole } from '../middlewares/authMiddleware';
import {
  createInsumoLote,
  listInsumoLotes,
  setInsumoLoteActivo,
  updateInsumoLote,
} from '../controllers/insumoLoteController';

export const insumoLoteRouter = Router();

insumoLoteRouter.use(authMiddleware);

insumoLoteRouter.get('/', listInsumoLotes);
insumoLoteRouter.post('/', requireRole('administrador', 'superadmin'), createInsumoLote);
insumoLoteRouter.put('/:id', requireRole('administrador', 'superadmin'), updateInsumoLote);
insumoLoteRouter.post('/:id/reactivar', requireRole('administrador', 'superadmin'), setInsumoLoteActivo);
insumoLoteRouter.delete('/:id', requireRole('administrador', 'superadmin'), setInsumoLoteActivo);

export default insumoLoteRouter;
