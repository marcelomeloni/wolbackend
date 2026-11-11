import { z } from 'zod';

// O contrato exposto (API/painel) usa minúsculo por conveniência, mas o enum
// do Postgres é maiúsculo (PERCENTAGE/FIXED). A conversão fica no service.
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

// Atualização parcial: qualquer campo pode ser enviado.
export const updateCouponSchema = z.object({
  code: z.string().min(2).toUpperCase().optional(),
  discountType: z.enum(['percentage', 'fixed']).optional(),
  value: z.number().positive().optional(),
  minPurchaseAmount: z.number().nonnegative().nullable().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
  isActive: z.boolean().optional(),
});
