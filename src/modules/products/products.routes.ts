import { Router } from 'express';
import multer from 'multer';
import { ProductsController } from './products.controller';
import { authMiddleware, adminMiddleware } from '../../middlewares/authMiddleware';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// Rotas públicas
router.get('/', ProductsController.list);
router.get('/:slug', ProductsController.getBySlug);

// Rotas protegidas (apenas admin)
router.use(authMiddleware);
router.use(adminMiddleware);

router.post('/upload', upload.single('file'), ProductsController.uploadFile);
router.post('/', ProductsController.create);
router.put('/:id', ProductsController.update);
router.delete('/:id', ProductsController.delete);

// Variantes
router.post('/:id/variants', ProductsController.addVariant);
router.delete('/variants/:id', ProductsController.deleteVariant);

// Imagens
router.post('/:id/images', ProductsController.addImage);
router.delete('/images/:id', ProductsController.deleteImage);

// Cores
router.post('/:id/colors', ProductsController.addColor);
router.delete('/colors/:id', ProductsController.deleteColor);

// Tamanhos
router.post('/:id/sizes', ProductsController.addSize);
router.delete('/sizes/:id', ProductsController.deleteSize);

export default router;
