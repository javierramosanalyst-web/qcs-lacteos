import { Router } from 'express';
import { login, me } from '../controllers/authController';
import { authMiddleware } from '../middlewares/authMiddleware';

export const authRouter = Router();

authRouter.post('/login', login);
authRouter.get('/me', authMiddleware, me);

export default authRouter;
