import { Router } from 'express';
import { authMiddleware, requireRole } from '../middlewares/authMiddleware';
import {
  deactivateLine,
  getLines,
  getProducts,
  getInactiveLines,
  reactivateLine,
  updateLine,
} from '../controllers/catalogController';

export const catalogRouter = Router();

catalogRouter.get('/lines', getLines);
catalogRouter.get('/products', getProducts);

catalogRouter.get('/lines/inactive', authMiddleware, requireRole('administrador', 'superadmin'), getInactiveLines);
catalogRouter.post('/lines/:lineId/reactivar', authMiddleware, requireRole('administrador', 'superadmin'), reactivateLine);
catalogRouter.put('/lines/:lineId', authMiddleware, requireRole('administrador', 'superadmin'), updateLine);
catalogRouter.delete('/lines/:lineId', authMiddleware, requireRole('administrador', 'superadmin'), deactivateLine);

export default catalogRouter;
