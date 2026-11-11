import { MercadoPagoConfig, Preference, Payment, CardToken } from 'mercadopago';
import { createHmac, timingSafeEqual } from 'crypto';
import { env, integrationFlags, paymentProvider } from '../../lib/env';
import { AppError } from '../../middlewares/errorHandler';
import { MockPayments } from './payments.mock';

let mpClient: MercadoPagoConfig | null = null;
function getClient(): MercadoPagoConfig {
  if (!integrationFlags.mercadoPago) {
    throw new AppError('Pagamento não configurado', 503, 'PAYMENT_NOT_CONFIGURED');
  }
  if (!mpClient) mpClient = new MercadoPagoConfig({ accessToken: env.MP_ACCESS_TOKEN });
  return mpClient;
}

export type PaymentMethodKind = 'pix' | 'credit_card';

export interface PaymentItem {
  id: string;
  title: string;
  quantity: number;
  unit_price: number;
}

export interface CreatePaymentArgs {
  orderId: string;
  amount: number;
  method: PaymentMethodKind;
  payerEmail: string;
  payerName?: string;
  payerDocument?: string;
  // Cartão: token gerado no browser (PCI-safe). PIX: não usa token.
  token?: string;
  installments?: number;
  notificationUrl?: string;
}

export interface PaymentResult {
  paymentId: number | null;
  status: 'approved' | 'pending' | 'rejected' | 'unknown';
  statusDetail: string | null;
  // PIX: QR code em base64 (imagem) e copia-e-cola.
  pixQrCodeBase64: string | null;
  pixQrCode: string | null;
}

export class PaymentsService {
  // Cria o pagamento direto na nossa página (Checkout Transparente / Core API).
  static async createPayment(args: CreatePaymentArgs): Promise<PaymentResult> {
    // Modo demo: aprova na hora sem chamar o Mercado Pago.
    if (paymentProvider === 'mock') {
      return MockPayments.createPayment(args);
    }

    const client = getClient();
    const payment = new Payment(client);

    const payer: Record<string, unknown> = { email: args.payerEmail };
    if (args.payerName) {
      const parts = args.payerName.trim().split(/\s+/);
      payer.first_name = parts[0];
      payer.last_name = parts.slice(1).join(' ') || parts[0];
    }
    if (args.payerDocument) {
      payer.identification = { type: 'CPF', number: args.payerDocument.replace(/\D/g, '') };
    }

    const body: Record<string, unknown> = {
      transaction_amount: Number(args.amount.toFixed(2)),
      payer,
      external_reference: args.orderId,
      description: 'Compra WOL',
      statement_descriptor: 'WOL',
    };

    if (args.notificationUrl) body.notification_url = args.notificationUrl;

    if (args.method === 'pix') {
      body.payment_method_id = 'pix';
    } else {
      if (!args.token) {
        throw new AppError('Token do cartão é obrigatório', 400, 'CARD_TOKEN_REQUIRED');
      }
      body.token = args.token;
      body.payment_method_id = 'credit_card';
      body.installments = Math.max(1, args.installments ?? 1);
    }

    try {
      const result = await payment.create({ body: body as any });

      const transactionData = (result as any)?.point_of_interaction?.transaction_data;

      return {
        paymentId: result.id ?? null,
        status: PaymentsService.mapStatus(result.status),
        statusDetail: result.status_detail ?? null,
        pixQrCodeBase64: transactionData?.qr_code_base64 ?? null,
        pixQrCode: transactionData?.qr_code ?? null,
      };
    } catch (err: any) {
      const detail = err?.response?.data?.message ?? err?.message ?? 'Falha ao processar pagamento';
      console.error('[payments] Erro ao criar pagamento:', err?.response?.data ?? err);
      throw new AppError(detail, 402, 'PAYMENT_ERROR');
    }
  }

  // Tokenização de cartão server-side (fallback quando o browser não gera o token).
  static async createCardToken(card: {
    cardNumber: string;
    expirationMonth: string;
    expirationYear: string;
    securityCode: string;
  }) {
    // Modo demo: devolve um token fake para não depender do Mercado Pago.
    if (paymentProvider === 'mock') {
      return MockPayments.createCardToken();
    }

    const client = getClient();
    const cardToken = new CardToken(client);

    const result = await cardToken.create({
      body: {
        card_number: card.cardNumber.replace(/\s/g, ''),
        expiration_month: card.expirationMonth,
        expiration_year: card.expirationYear,
        security_code: card.securityCode,
      },
    });

    return { id: result.id };
  }

  // Busca um pagamento no Mercado Pago (usado pelo webhook para confirmar status).
  static async getPayment(paymentId: string) {
    const client = getClient();
    const payment = new Payment(client);
    return payment.get({ id: paymentId });
  }

  // Cria uma Preference (usada apenas se algum fluxo futuro exigir host do MP).
  static async createPreference(args: {
    orderId: string;
    payerEmail: string;
    items: PaymentItem[];
    shippingAmount: number;
    backUrls: { success: string; failure: string; pending: string };
    notificationUrl: string;
  }) {
    const client = getClient();

    const items = args.items.map((i) => ({
      id: i.id,
      title: i.title,
      quantity: i.quantity,
      unit_price: i.unit_price,
      currency_id: 'BRL',
    }));

    if (args.shippingAmount > 0) {
      items.push({
        id: 'shipping',
        title: 'Frete',
        quantity: 1,
        unit_price: args.shippingAmount,
        currency_id: 'BRL',
      });
    }

    const preference = new Preference(client);
    const result = await preference.create({
      body: {
        external_reference: args.orderId,
        items,
        payer: { email: args.payerEmail },
        back_urls: args.backUrls,
        auto_return: 'approved',
        notification_url: args.notificationUrl,
        statement_descriptor: 'WOL',
      },
    });

    return { preferenceId: result.id ?? null, initPoint: result.init_point ?? null };
  }

  private static mapStatus(status?: string): PaymentResult['status'] {
    switch (status) {
      case 'approved':
        return 'approved';
      case 'pending':
      case 'in_process':
      case 'authorized':
        return 'pending';
      case 'rejected':
      case 'cancelled':
      case 'charged_back':
        return 'rejected';
      default:
        return 'unknown';
    }
  }

  // Valida a assinatura do webhook (x-signature: ts=...,v1=...).
  // Sem MP_WEBHOOK_SECRET configurado, a validação é ignorada.
  static validateWebhookSignature(
    headers: Record<string, unknown>,
    dataId: string,
    rawBody: string,
  ): boolean {
    if (!env.MP_WEBHOOK_SECRET) return true;

    const signature = headers['x-signature'];
    const timestamp = headers['x-timestamp'];
    if (typeof signature !== 'string' || typeof timestamp !== 'string') return false;

    const manifest = `id:${dataId.toLowerCase()};request-id:${headers['x-request-id'] ?? ''};ts:${timestamp};`;
    const expected = createHmac('sha256', env.MP_WEBHOOK_SECRET).update(manifest).digest('hex');

    const v1 = signature.split(',').find((p) => p.trim().startsWith('v1='))?.split('=')[1];
    if (!v1) return false;

    const a = Buffer.from(v1, 'utf8');
    const b = Buffer.from(expected, 'utf8');
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  }
}
