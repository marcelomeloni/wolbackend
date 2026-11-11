import { z } from 'zod';

export const shippingQuoteSchema = z.object({
  zipCode: z.string().min(8).max(9),
  items: z
    .array(
      z.object({
        productId: z.string().uuid(),
        quantity: z.number().int().positive(),
      }),
    )
    .min(1),
});
