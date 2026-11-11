import { Request, Response } from 'express';
import { z } from 'zod';
import { PaymentsService } from './payments.service';
import { supabase } from '../../lib/supabase';
import { AppError } from '../../middlewares/errorHandler';
import { orderPaidEmail, orderPendingEmail } from '../../lib/emailTemplates';
import { sendMail } from '../../lib/mail';
import { env, integrationFlags, paymentProvider } from '../../lib/env';

const paySchema = z.object({
  orderId: z.string().uuid(),
  method: z.enum(['pix', 'credit_card']),
  token: z.string().min(4).optional(),
  installments: z.number().int().min(1).max(12).optional(),
});

const cardTokenSchema = z.object({
  cardNumber: z.string().min(12).max(25),
  expirationMonth: z.string().min(1).max(2),
  expirationYear: z.string().length(4),
  securityCode: z.string().min(3).max(4),
});

export class PaymentsController {
  // Checkout transparente: cria o pagamento na nossa página e devolve o resultado.
  static async pay(req: Request, res: Response) {
    if (!req.user) throw new AppError('Não autenticado', 401, 'UNAUTHORIZED');
    if (paymentProvider === 'mercadopago' && !integrationFlags.mercadoPago) {
      throw new AppError('Pagamento indisponível no momento', 503, 'PAYMENT_NOT_CONFIGURED');
    }

    const data = paySchema.parse(req.body);

    const { data: order } = await supabase
      .from('orders')
      .select('*, order_items(*), users(email, name, cpf)')
      .eq('id', data.orderId)
      .eq('user_id', req.user.userId)
      .single();

    if (!order) throw new AppError('Pedido não encontrado', 404, 'ORDER_NOT_FOUND');

    if (order.payment_status === 'PAID') {
      throw new AppError('Este pedido já foi pago', 409, 'ORDER_ALREADY_PAID');
    }
    if (order.status === 'CANCELED') {
      throw new AppError('Este pedido foi cancelado', 409, 'ORDER_CANCELED');
    }
    if (order.expires_at && new Date(order.expires_at) < new Date()) {
      throw new AppError('O tempo de pagamento deste pedido expirou', 410, 'ORDER_EXPIRED');
    }

    const total = Number(order.total_amount);
    if (!Number.isFinite(total) || total <= 0) {
      throw new AppError('Valor do pedido inválido', 500, 'INVALID_ORDER_TOTAL');
    }

    const notificationUrl = `${env.API_PUBLIC_URL}/api/payments/webhook`;

    const result = await PaymentsService.createPayment({
      orderId: order.id,
      amount: total,
      method: data.method,
      payerEmail: (order as any).users?.email ?? '',
      payerName: (order as any).users?.name ?? undefined,
      payerDocument: (order as any).users?.cpf ?? undefined,
      token: data.token,
      installments: data.installments,
      notificationUrl,
    });

    await supabase
      .from('orders')
      .update({
        mp_payment_id: result.paymentId ? String(result.paymentId) : null,
        payment_method: data.method === 'credit_card' ? 'CREDIT_CARD' : 'PIX',
      })
      .eq('id', order.id);

    if (result.status === 'approved') {
      await PaymentsController.markAsPaid(order.id);
    } else if (result.status === 'rejected') {
      await supabase
        .from('orders')
        .update({ payment_status: 'WAITING' })
        .eq('id', order.id);
    }

    res.json({
      orderId: order.id,
      paymentId: result.paymentId,
      status: result.status,
      statusDetail: result.statusDetail,
      pixQrCodeBase64: result.pixQrCodeBase64,
      pixQrCode: result.pixQrCode,
    });
  }

  // Tokenização de cartão server-side (fallback). Recomendado: tokenizar no browser.
  static async cardToken(req: Request, res: Response) {
    if (!req.user) throw new AppError('Não autenticado', 401, 'UNAUTHORIZED');
    const data = cardTokenSchema.parse(req.body);
    const result = await PaymentsService.createCardToken(data);
    res.json(result);
  }

  // Webhook do Mercado Pago: notifica a confirmação do pagamento.
  static async webhook(req: Request, res: Response) {
    // Modo demo não usa webhook externo (pagamento é aprovado na hora).
    if (paymentProvider === 'mock') {
      return res.status(200).json({ received: true });
    }

    const topic = req.query.type ?? req.query.topic;
    const paymentId = (req.query['data.id'] ?? req.query.id ?? req.body?.data?.id) as string | undefined;

    // Outros tópicos (merchant_order etc.) apenas confirmam recebimento.
    if (topic !== 'payment' || !paymentId) {
      return res.status(200).json({ received: true });
    }

    if (
      !PaymentsService.validateWebhookSignature(
        req.headers as Record<string, unknown>,
        String(paymentId),
        JSON.stringify(req.body ?? {}),
      )
    ) {
      return res
        .status(401)
        .json({ error: { code: 'INVALID_SIGNATURE', message: 'Assinatura inválida' } });
    }

    try {
      const payment = await PaymentsService.getPayment(String(paymentId));
      const orderId = payment.external_reference;
      if (!orderId) return res.status(200).json({ received: true });

      const { data: existing } = await supabase
        .from('orders')
        .select('id, payment_status, users(email, name), order_items(*)')
        .eq('id', orderId)
        .single();

      if (!existing) return res.status(200).json({ received: true });

      const status = payment.status;
      const dbPaymentStatus =
        status === 'approved' ? 'PAID' : status === 'refunded' ? 'REFUNDED' : 'WAITING';

      await supabase
        .from('orders')
        .update({
          payment_status: dbPaymentStatus,
          status: dbPaymentStatus === 'PAID' ? 'PREPARING' : 'PENDING',
          mp_payment_id: String(paymentId),
        })
        .eq('id', orderId);

      // Idempotência: só promove uma vez.
      if (dbPaymentStatus === 'PAID' && existing.payment_status !== 'PAID') {
        await PaymentsController.markAsPaid(orderId, existing);
      }

      return res.status(200).json({ received: true });
    } catch (err) {
      console.error('[webhook] Erro ao processar pagamento:', err);
      // 200 para evitar reenvios infinitos em erros de negócio.
      return res.status(200).json({ received: true });
    }
  }

  // Promove o pedido para PAGO: status, vendas e e-mail de confirmação.
  static async markAsPaid(orderId: string, preloaded?: any) {
    const { data: order } = preloaded
      ? { data: preloaded }
      : await supabase
          .from('orders')
          .select('*, order_items(*), users(email, name)')
          .eq('id', orderId)
          .single();

    if (!order) return;

    await supabase
      .from('orders')
      .update({ payment_status: 'PAID', status: 'PREPARING' })
      .eq('id', orderId);

    await PaymentsController.registerSale(orderId);

    const items = (order.order_items ?? []).map((i: any) => ({
      snapshot_product_name: i.snapshot_product_name,
      snapshot_color_name: i.snapshot_color_name,
      snapshot_size_name: i.snapshot_size_name,
      quantity: i.quantity,
      unit_price: i.unit_price,
    }));

    const subtotal = items.reduce((acc: number, i: any) => acc + i.unit_price * i.quantity, 0);
    const email = (order as any).users?.email;
    const name = (order as any).users?.name ?? 'Cliente';

    if (email) {
      await sendMail({
        to: email,
        subject: 'Pagamento confirmado — WOL',
        html: orderPaidEmail({
          orderId,
          customerName: name,
          items,
          subtotal,
          shipping: order.shipping_amount ?? 0,
          discount: order.discount_amount ?? 0,
          total: order.total_amount ?? subtotal,
          paymentMethod: order.payment_method ?? 'PIX',
        }),
      });
    }
  }

  // E-mail "pedido recebido aguardando pagamento" (PIX).
  static async sendPendingEmail(orderId: string, pixCode?: string | null) {
    const { data: order } = await supabase
      .from('orders')
      .select('*, order_items(*), users(email, name)')
      .eq('id', orderId)
      .single();

    if (!order) return;
    const email = (order as any).users?.email;
    if (!email) return;

    const items = (order.order_items ?? []).map((i: any) => ({
      snapshot_product_name: i.snapshot_product_name,
      snapshot_color_name: i.snapshot_color_name,
      snapshot_size_name: i.snapshot_size_name,
      quantity: i.quantity,
      unit_price: i.unit_price,
    }));
    const subtotal = items.reduce((acc: number, i: any) => acc + i.unit_price * i.quantity, 0);

    await sendMail({
      to: email,
      subject: 'Pedido recebido — finalize o pagamento',
      html: orderPendingEmail({
        orderId,
        customerName: (order as any).users?.name ?? 'Cliente',
        items,
        subtotal,
        shipping: order.shipping_amount ?? 0,
        discount: order.discount_amount ?? 0,
        total: order.total_amount ?? subtotal,
        paymentMethod: order.payment_method ?? 'PIX',
        pixCode,
      }),
    });
  }

  private static async registerSale(orderId: string) {
    const { data: items } = await supabase
      .from('order_items')
      .select('product_variant_id, quantity')
      .eq('order_id', orderId);

    for (const item of items ?? []) {
      if (!item.product_variant_id) continue;
      const { data: variant } = await supabase
        .from('product_variants')
        .select('product_id')
        .eq('id', item.product_variant_id)
        .single();
      if (!variant) continue;
      const { data: prod } = await supabase
        .from('products')
        .select('sales_count')
        .eq('id', variant.product_id)
        .single();
      if (prod) {
        await supabase
          .from('products')
          .update({ sales_count: (prod.sales_count ?? 0) + item.quantity })
          .eq('id', variant.product_id);
      }
    }
  }
}
