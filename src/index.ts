import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

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

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'By Fer Backend API is running' });
});

const PORT = process.env.PORT || 3333;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
