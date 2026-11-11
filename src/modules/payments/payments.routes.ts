import { Router } from 'express';
import { PaymentsController } from './payments.controller';
import { authMiddleware } from '../../middlewares/authMiddleware';
import { asyncHandler } from '../../middlewares/errorHandler';

const router = Router();

// Webhook (público, chamado pelo Mercado Pago)
router.post('/webhook', asyncHandler(PaymentsController.webhook));

// Checkout transparente: cria o pagamento na nossa página (autenticado)
router.post('/pay', authMiddleware, asyncHandler(PaymentsController.pay));

// Tokenização de cartão server-side (fallback)
router.post('/card-token', authMiddleware, asyncHandler(PaymentsController.cardToken));

export default router;
