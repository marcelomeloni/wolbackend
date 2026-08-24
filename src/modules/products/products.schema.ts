import { z } from 'zod';

export const productColorSchema = z.object({
  colorName: z.string(),
  colorHex: z.string(),
});

export const productSizeSchema = z.object({
  sizeName: z.string(),
});

export const productImageSchema = z.object({
  colorId: z.string().uuid().optional().nullable(),
  imageUrl: z.string().url(),
  isMain: z.boolean().default(false),
  displayOrder: z.number().default(0),
});

export const productVariantSchema = z.object({
  colorId: z.string().uuid(),
  sizeId: z.string().uuid(),
  sku: z.string(),
  stockQuantity: z.number().min(0).default(0),
  priceOverride: z.number().optional().nullable(),
});

export const productSchema = z.object({
  categoryId: z.string().uuid(),
  name: z.string().min(2),
  slug: z.string().min(2),
  description: z.string(),
  basePrice: z.number().min(0),
  isActive: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
  salesCount: z.number().optional(),
  viewCount: z.number().optional(),
});

export const createProductFullSchema = productSchema.extend({
  colors: z.array(productColorSchema).optional(),
  sizes: z.array(productSizeSchema).optional(),
});
