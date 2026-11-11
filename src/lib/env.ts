import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3333),

  // Obrigatórios
  JWT_SECRET: z.string().min(1, 'JWT_SECRET é obrigatório'),
  SUPABASE_URL: z.string().url('SUPABASE_URL inválida'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, 'SUPABASE_SERVICE_ROLE_KEY é obrigatório'),

  // Integrações (opcionais até serem configuradas)
  MP_ACCESS_TOKEN: z.string().optional().default(''),
  MP_PUBLIC_KEY: z.string().optional().default(''),
  MP_WEBHOOK_SECRET: z.string().optional().default(''),

  MELHORENVIO_TOKEN: z.string().optional().default(''),
  MELHORENVIO_BASE_URL: z.string().optional().default('https://www.melhorenvio.com.br'),
  SHIPPING_ORIGIN_CEP: z.string().optional().default(''),

  RESEND_API_KEY: z.string().optional().default(''),
  MAIL_FROM: z.string().optional().default('WOL <no-reply@wearwol.com>'),
  CONTACT_EMAIL: z.string().optional().default(''),

  SITE_URL: z.string().optional().default('https://wearwol.com'),
  API_PUBLIC_URL: z.string().optional().default(''),

  CRON_SECRET: z.string().optional().default(''),

  CORS_ORIGINS: z.string().optional().default(''),

  // Providers (opcionais). Sem valor, o modo é escolhido automaticamente:
  // chave de integração vazia => mock (demo), preenchida => integração real.
  PAYMENT_PROVIDER: z.enum(['mercadopago', 'mock']).optional(),
  SHIPPING_PROVIDER: z.enum(['melhorenvio', 'mock']).optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Variáveis de ambiente inválidas:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;

export const corsOrigins = env.CORS_ORIGINS.split(',')
  .map((o) => o.trim())
  .filter(Boolean);

export const integrationFlags = {
  mercadoPago: Boolean(env.MP_ACCESS_TOKEN),
  melhorEnvio: Boolean(env.MELHORENVIO_TOKEN),
  email: Boolean(env.RESEND_API_KEY),
};

export type PaymentProvider = 'mercadopago' | 'mock';
export type ShippingProvider = 'melhorenvio' | 'mock';

// Modo demo: sem as chaves configuradas, usa os providers simulados.
// Para voltar ao real basta preencher as chaves (ou definir a env explicitamente).
export const paymentProvider: PaymentProvider =
  env.PAYMENT_PROVIDER ?? (integrationFlags.mercadoPago ? 'mercadopago' : 'mock');

export const shippingProvider: ShippingProvider =
  env.SHIPPING_PROVIDER ?? (integrationFlags.melhorEnvio ? 'melhorenvio' : 'mock');
