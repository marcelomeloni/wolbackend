import { Router } from 'express';
import { FavoritesController } from './favorites.controller';
import { authMiddleware } from '../../middlewares/authMiddleware';

const router = Router();

// Todas as rotas de favoritos requerem usuário autenticado
router.use(authMiddleware);

router.post('/', FavoritesController.add);
router.delete('/:productId', FavoritesController.remove);
router.get('/', FavoritesController.list);

export default router;
