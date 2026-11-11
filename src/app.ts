import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { corsOrigins, integrationFlags, env } from './lib/env';

import authRoutes from './modules/auth/auth.routes';
import addressesRoutes from './modules/addresses/addresses.routes';
import categoriesRoutes from './modules/categories/categories.routes';
import productsRoutes from './modules/products/products.routes';
import favoritesRoutes from './modules/favorites/favorites.routes';
import reviewsRoutes from './modules/reviews/reviews.routes';
import couponsRoutes from './modules/coupons/coupons.routes';
import ordersRoutes from './modules/orders/orders.routes';
import newsletterRoutes from './modules/newsletter/newsletter.routes';
import usersRoutes from './modules/users/users.routes';
import shippingRoutes from './modules/shipping/shipping.routes';
import paymentsRoutes from './modules/payments/payments.routes';
import contactRoutes from './modules/contact/contact.routes';
import { OrdersService } from './modules/orders/orders.service';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler';

export function createApp() {
  const app = express();

  app.set('trust proxy', 1);

  app.use(helmet());
  app.use(express.json({ limit: '1mb' }));

  app.use(
    cors({
      origin(origin, callback) {
        // Permite server-to-server e ferramentas sem Origin
        if (!origin) return callback(null, true);
        if (corsOrigins.length === 0) return callback(null, true); // dev
        if (corsOrigins.includes(origin)) return callback(null, true);
        return callback(new Error('Not allowed by CORS'));
      },
      credentials: true,
    }),
  );

  // Limite global
  app.use(
    '/api',
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 600,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
    }),
  );

  app.use('/api/auth', authRoutes);
  app.use('/api/addresses', addressesRoutes);
  app.use('/api/categories', categoriesRoutes);
  app.use('/api/products', productsRoutes);
  app.use('/api/favorites', favoritesRoutes);
  app.use('/api/reviews', reviewsRoutes);
  app.use('/api/coupons', couponsRoutes);
  app.use('/api/orders', ordersRoutes);
  app.use('/api/newsletter', newsletterRoutes);
  app.use('/api/users', usersRoutes);
  app.use('/api/shipping', shippingRoutes);
  app.use('/api/payments', paymentsRoutes);
  app.use('/api/contact', contactRoutes);

  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      message: 'WOL Backend API is running',
      integrations: integrationFlags,
    });
  });

  // Cron da Vercel: cancela pedidos expirados e devolve o estoque reservado.
  app.get('/api/cron/release-expired-orders', async (req, res) => {
    const secret = env.CRON_SECRET;
    if (secret && req.headers.authorization !== `Bearer ${secret}`) {
      res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Não autorizado' } });
      return;
    }
    const result = await OrdersService.releaseExpiredOrders();
    res.json(result);
  });

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

const app = createApp();

export default app;
// Compatível com require() em CommonJS (Vercel @vercel/node).
module.exports = app;
module.exports.default = app;
