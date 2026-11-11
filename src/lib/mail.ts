import { Resend } from 'resend';
import { env, integrationFlags } from './env';

let client: Resend | null = null;
function getClient(): Resend | null {
  if (!integrationFlags.email) return null;
  if (!client) client = new Resend(env.RESEND_API_KEY);
  return client;
}

interface SendArgs {
  to: string | string[];
  subject: string;
  html: string;
}

// Envia e-mail transacional. Sem RESEND_API_KEY, apenas loga (no-op) para não
// quebrar o fluxo de pedido em ambientes sem integração configurada.
export async function sendMail({ to, subject, html }: SendArgs): Promise<void> {
  const resend = getClient();
  if (!resend) {
    console.warn(`[mail] RESEND_API_KEY ausente — e-mail "${subject}" para ${to} não enviado.`);
    return;
  }

  try {
    await resend.emails.send({ from: env.MAIL_FROM, to, subject, html });
  } catch (err) {
    // Falha de e-mail nunca deve derrubar o fluxo principal.
    console.error('[mail] Falha ao enviar e-mail:', err);
  }
}

export function formatBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}
