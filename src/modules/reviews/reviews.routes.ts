import { Router } from 'express';
import { ReviewsController } from './reviews.controller';
import { authMiddleware, adminMiddleware } from '../../middlewares/authMiddleware';

const router = Router();

// Rota pública para listar avaliações de um produto
router.get('/product/:productId', ReviewsController.listByProduct);

// Rotas protegidas
router.use(authMiddleware);
router.post('/', ReviewsController.add);

// Apenas admin pode deletar avaliações (moderação)
router.delete('/:id', adminMiddleware, ReviewsController.delete);

export default router;
