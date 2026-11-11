import { z } from 'zod';

export const orderItemSchema = z.object({
  productVariantId: z.string().uuid().optional().nullable(), // preferencial
  productSlug: z.string(), // e.g. 'every-good'
  productName: z.string(),
  colorName: z.string(),
  sizeName: z.string(),
  quantity: z.number().int().positive(),
  // unitPrice enviado pelo cliente é apenas informativo; o backend recalcula.
  unitPrice: z.number().positive().optional(),
});

export const createOrderSchema = z.object({
  addressId: z.string().uuid().optional().nullable(), // Allow optional/nullable for now to simplify
  addressData: z.any().optional(), // In case they send full address
  couponCode: z.string().optional().nullable(),
  items: z.array(orderItemSchema).min(1),
  paymentMethod: z.enum(['pix', 'credit_card', 'boleto', 'cartao']),
  // Opções de frete (P3 - Melhor Envio). Quando ausentes, usa fallback.
  shippingService: z.string().optional(),
  shippingCompany: z.string().optional(),
  shippingAmount: z.number().nonnegative().optional(),
});

export const updateOrderStatusSchema = z.object({
  status: z.enum(['PENDING', 'PAYMENT_APPROVED', 'PREPARING', 'SHIPPED', 'DELIVERED', 'CANCELED']).optional(),
  paymentStatus: z.enum(['WAITING', 'PAID', 'REFUNDED']).optional(),
  trackingCode: z.string().optional(),
});
