import { Request, Response } from 'express';
import { z } from 'zod';
import { contactSchema } from './contact.schema';
import { sendMail } from '../../lib/mail';
import { env, integrationFlags } from '../../lib/env';
import { AppError } from '../../middlewares/errorHandler';

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

export class ContactController {
  static async send(req: Request, res: Response) {
    const data = contactSchema.parse(req.body);

    if (!integrationFlags.email) {
      throw new AppError(
        'Envio de mensagens indisponível no momento. Fale conosco pelo WhatsApp.',
        503,
        'EMAIL_NOT_CONFIGURED',
      );
    }

    const html = `
      <div style="font-family:Arial,Helvetica,sans-serif;color:#303039;line-height:1.6">
        <h2 style="font-size:16px;text-transform:uppercase;letter-spacing:2px">Novo contato pelo site</h2>
        <p><strong>Assunto:</strong> ${escapeHtml(data.subject)}</p>
        <p><strong>Nome:</strong> ${escapeHtml(data.name)}</p>
        <p><strong>E-mail:</strong> ${escapeHtml(data.email)}</p>
        <hr style="border:none;border-top:1px solid #eee" />
        <p style="white-space:pre-wrap">${escapeHtml(data.message)}</p>
      </div>`;

    await sendMail({
      to: env.CONTACT_EMAIL || env.MAIL_FROM,
      subject: `[Contato WOL] ${data.subject}`,
      html,
    });

    res.status(201).json({ sent: true });
  }
}
