import { Router } from 'express';
import { authMiddleware, requireRole } from '../middlewares/authMiddleware';
import { createUser, deactivateUser, listUsers, reactivateUser, updateUser } from '../controllers/userController';
import { listSecurityEvents } from '../controllers/securityController';

export const userRouter = Router();

userRouter.use(authMiddleware);

userRouter.get('/', listUsers);
// Bitácora de accesos: solo el superadmin.
userRouter.get('/eventos-seguridad', requireRole('superadmin'), listSecurityEvents);
userRouter.post('/', requireRole('administrador', 'superadmin'), createUser);
userRouter.put('/:id', requireRole('administrador', 'superadmin'), updateUser);
userRouter.post('/:id/reactivar', requireRole('administrador', 'superadmin'), reactivateUser);
userRouter.delete('/:id', requireRole('administrador', 'superadmin'), deactivateUser);

export default userRouter;
