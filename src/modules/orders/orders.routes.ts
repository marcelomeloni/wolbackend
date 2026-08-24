import { Router } from 'express';
import { OrdersController } from './orders.controller';
import { authMiddleware, adminMiddleware } from '../../middlewares/authMiddleware';

const router = Router();

// Todas as rotas de pedidos requerem usuário autenticado
router.use(authMiddleware);

router.post('/', OrdersController.create);
router.get('/', OrdersController.listMyOrders);

// Rotas de admin ANTES do /:id
router.get('/all', adminMiddleware, OrdersController.listAll);
router.put('/:id/status', adminMiddleware, OrdersController.updateStatus);

router.get('/:id', OrdersController.getById);

export default router;
