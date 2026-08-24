import { Router } from 'express';
import { CategoriesController } from './categories.controller';
import { authMiddleware, adminMiddleware } from '../../middlewares/authMiddleware';

const router = Router();

router.get('/', CategoriesController.list);

// Rotas protegidas (apenas admin)
router.use(authMiddleware);
router.use(adminMiddleware);

router.post('/', CategoriesController.create);
router.put('/:id', CategoriesController.update);
router.delete('/:id', CategoriesController.delete);

export default router;
