import { z } from 'zod';

export const addressSchema = z.object({
  zipCode: z.string().min(8).max(9),
  street: z.string().min(2),
  number: z.string().min(1),
  complement: z.string().optional(),
  neighborhood: z.string().min(2),
  city: z.string().min(2),
  state: z.string().length(2),
  isMain: z.boolean().optional().default(false),
});
