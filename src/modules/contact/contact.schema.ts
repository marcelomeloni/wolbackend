import { z } from 'zod';

export const contactSchema = z.object({
  name: z.string().min(2, 'Informe seu nome'),
  email: z.string().email('E-mail inválido'),
  subject: z.string().min(2, 'Informe o assunto'),
  message: z.string().min(10, 'Escreva uma mensagem com pelo menos 10 caracteres'),
});
