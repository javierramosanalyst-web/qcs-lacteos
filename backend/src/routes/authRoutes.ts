import { Router } from 'express';
import { login, me } from '../controllers/authController';
import { authMiddleware } from '../middlewares/authMiddleware';
import { loginGuard } from '../middlewares/loginGuard';

export const authRouter = Router();

authRouter.post('/login', loginGuard, login);
authRouter.get('/me', authMiddleware, me);

export default authRouter;
