import { Router } from 'express';
import { ShippingController } from './shipping.controller';
import { asyncHandler } from '../../middlewares/errorHandler';

const router = Router();

// Consulta pública de frete (não exige login)
router.post('/quote', asyncHandler(ShippingController.quote));

export default router;
