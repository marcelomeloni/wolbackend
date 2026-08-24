import { Router } from 'express';
import { UsersController } from './users.controller';
import { authMiddleware, adminMiddleware } from '../../middlewares/authMiddleware';

const router = Router();

// Todas as rotas de usuários requerem permissão de admin
router.use(authMiddleware);
router.use(adminMiddleware);

router.get('/', UsersController.listAll);
router.put('/:id/role', UsersController.updateRole);
router.delete('/:id', UsersController.delete);

export default router;
