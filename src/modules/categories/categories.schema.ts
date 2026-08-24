import { z } from 'zod';

export const categorySchema = z.object({
  name: z.string().min(2),
  slug: z.string().min(2),
  description: z.string().optional().nullable(),
  imageUrl: z.string().url().optional().nullable(),
  parentId: z.string().uuid().optional().nullable(),
  isMenu: z.boolean().optional().default(false),
});
