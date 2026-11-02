import { Router } from 'express';
import { authMiddleware, requireRole } from '../middlewares/authMiddleware';
import {
  createLine,
  deactivateLine,
  getLines,
  getProducts,
  getProductsByLine,
  updateLine,
} from '../controllers/catalogController';

export const catalogRouter = Router();

catalogRouter.get('/lines', getLines);
catalogRouter.get('/products', getProducts);
catalogRouter.get('/lines/:lineId/products', getProductsByLine);

catalogRouter.post('/lines', authMiddleware, requireRole('administrador', 'superadmin'), createLine);
catalogRouter.put('/lines/:lineId', authMiddleware, requireRole('administrador', 'superadmin'), updateLine);
catalogRouter.delete('/lines/:lineId', authMiddleware, requireRole('administrador', 'superadmin'), deactivateLine);

export default catalogRouter;
