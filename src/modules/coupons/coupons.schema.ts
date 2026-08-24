import { z } from 'zod';

export const couponSchema = z.object({
  code: z.string().toUpperCase(),
  discountType: z.enum(['percentage', 'fixed']),
  value: z.number().positive(),
  minPurchaseAmount: z.number().nonnegative().optional().nullable(),
  expiresAt: z.string().datetime().optional().nullable(),
  isActive: z.boolean().default(true),
});

export const validateCouponSchema = z.object({
  code: z.string().toUpperCase(),
  subtotal: z.number().nonnegative(),
});
