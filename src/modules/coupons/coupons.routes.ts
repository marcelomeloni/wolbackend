import { Router } from 'express';
import { CouponsController } from './coupons.controller';
import { authMiddleware, adminMiddleware } from '../../middlewares/authMiddleware';

const router = Router();

// Rota pública (ou acessível via carrinho) para validar cupom
router.post('/validate', CouponsController.validate);

// Rotas protegidas (apenas admin)
router.use(authMiddleware);
router.use(adminMiddleware);

router.post('/', CouponsController.create);
router.get('/', CouponsController.list);

export default router;
