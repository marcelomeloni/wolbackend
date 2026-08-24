import { Router } from 'express';
import { AddressesController } from './addresses.controller';
import { authMiddleware } from '../../middlewares/authMiddleware';

const router = Router();

// Todas as rotas de endereços requerem usuário autenticado
router.use(authMiddleware);

router.post('/', AddressesController.create);
router.get('/', AddressesController.list);
router.put('/:id', AddressesController.update);
router.delete('/:id', AddressesController.delete);

export default router;
