import { Router } from 'express';
import { authMiddleware, requireRole } from '../middlewares/authMiddleware';
import { createUser, deactivateUser, listUsers, updateUser } from '../controllers/userController';

export const userRouter = Router();

userRouter.use(authMiddleware);

userRouter.get('/', listUsers);
userRouter.post('/', requireRole('administrador', 'superadmin'), createUser);
userRouter.put('/:id', requireRole('administrador', 'superadmin'), updateUser);
userRouter.delete('/:id', requireRole('administrador', 'superadmin'), deactivateUser);

export default userRouter;
