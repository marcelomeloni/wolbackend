import { supabase } from '../../lib/supabase';
import { z } from 'zod';
import { createOrderSchema, orderItemSchema, updateOrderStatusSchema } from './orders.schema';
import { AppError } from '../../middlewares/errorHandler';
import { ShippingService } from '../shipping/shipping.service';
import { sendMail } from '../../lib/mail';
import { orderShippedEmail } from '../../lib/emailTemplates';

type OrderItemInput = z.infer<typeof orderItemSchema>;

interface ResolvedVariant {
  variantId: string;
  productId: string;
  stock: number;
  unitPrice: number;
  productName: string;
  colorName: string;
  sizeName: string;
  slug: string;
}

const FALLBACK_SHIPPING = 25.0;

export class OrdersService {
  // Recalcula preço/estoque a partir do banco. Nunca confia no cliente.
  private static async resolveVariant(item: OrderItemInput): Promise<ResolvedVariant> {
    if (item.productVariantId) {
      const { data: v } = await supabase
        .from('product_variants')
        .select(
          'id, stock_quantity, price_override, product_id, products(name, slug, base_price), product_colors(color_name), product_sizes(size_name)',
        )
        .eq('id', item.productVariantId)
        .single();

      if (!v) throw new AppError('Variante não encontrada', 400, 'VARIANT_NOT_FOUND');
      const product = (v as any).products;
      return {
        variantId: v.id,
        productId: v.product_id,
        stock: v.stock_quantity,
        unitPrice: v.price_override ?? product?.base_price ?? 0,
        productName: product?.name ?? item.productName,
        colorName: (v as any).product_colors?.color_name ?? item.colorName,
        sizeName: (v as any).product_sizes?.size_name ?? item.sizeName,
        slug: product?.slug ?? item.productSlug,
      };
    }

    const { data: product } = await supabase
      .from('products')
      .select('id, name, slug, base_price')
      .eq('slug', item.productSlug)
      .single();

    if (!product) throw new AppError(`Produto "${item.productSlug}" não encontrado`, 400, 'PRODUCT_NOT_FOUND');

    const { data: color } = await supabase
      .from('product_colors')
      .select('id, color_name')
      .eq('product_id', product.id)
      .ilike('color_name', item.colorName)
      .maybeSingle();

    const { data: size } = await supabase
      .from('product_sizes')
      .select('id, size_name')
      .eq('product_id', product.id)
      .ilike('size_name', item.sizeName)
      .maybeSingle();

    if (!color || !size) {
      throw new AppError(`Cor/tamanho inválidos para "${product.name}"`, 400, 'VARIANT_NOT_FOUND');
    }

    const { data: v } = await supabase
      .from('product_variants')
      .select('id, stock_quantity, price_override')
      .eq('product_id', product.id)
      .eq('color_id', color.id)
      .eq('size_id', size.id)
      .maybeSingle();

    if (!v) throw new AppError(`Variante indisponível para "${product.name}"`, 400, 'VARIANT_NOT_FOUND');

    return {
      variantId: v.id,
      productId: product.id,
      stock: v.stock_quantity,
      unitPrice: v.price_override ?? product.base_price,
      productName: product.name,
      colorName: color.color_name,
      sizeName: size.size_name,
      slug: product.slug,
    };
  }

  // Recalcula o frete no servidor e devolve a opção efetivamente cobrada.
  private static async resolveShipping(
    data: z.infer<typeof createOrderSchema>,
    resolved: Array<ResolvedVariant & { quantity: number }>,
    zipCode: string | null,
  ): Promise<{ amount: number; service: string | null; company: string | null }> {
    const items = resolved.map((r) => ({ productId: r.productId, quantity: r.quantity }));

    // Sem CEP não é possível cotar: usa o fallback fixo.
    if (!zipCode || zipCode.length !== 8) {
      return {
        amount: FALLBACK_SHIPPING,
        service: data.shippingService ?? null,
        company: data.shippingCompany ?? null,
      };
    }

    const quote = await ShippingService.quote({ zipCode, items }, items);

    const match = data.shippingService
      ? quote.options.find(
          (o) =>
            o.id === data.shippingService ||
            o.name === data.shippingService ||
            (data.shippingCompany != null && o.company === data.shippingCompany),
        )
      : quote.options[0];

    if (!match) {
      throw new AppError('Opção de frete indisponível para este CEP', 422, 'INVALID_SHIPPING_OPTION');
    }

    return { amount: match.price, service: match.id, company: match.company };
  }

  static async createOrder(userId: string, data: z.infer<typeof createOrderSchema>) {
    const resolved: Array<ResolvedVariant & { quantity: number }> = [];
    let subtotalAmount = 0;

    for (const item of data.items) {
      const variant = await this.resolveVariant(item);

      if (variant.stock < item.quantity) {
        throw new AppError(
          `Estoque insuficiente para "${variant.productName}" (${variant.colorName}/${variant.sizeName})`,
          409,
          'INSUFFICIENT_STOCK',
        );
      }

      subtotalAmount += variant.unitPrice * item.quantity;
      resolved.push({ ...variant, quantity: item.quantity });
    }

    let discountAmount = 0;
    let couponId: string | null = null;

    if (data.couponCode) {
      const { data: coupon } = await supabase
        .from('coupons')
        .select('*')
        .eq('code', data.couponCode)
        .maybeSingle();

      if (coupon && coupon.is_active) {
        const isValidDate = !coupon.expires_at || new Date() <= new Date(coupon.expires_at);
        const isValidMinAmount = !coupon.min_purchase_amount || subtotalAmount >= coupon.min_purchase_amount;

        if (isValidDate && isValidMinAmount) {
          couponId = coupon.id;
          discountAmount =
            coupon.discount_type === 'PERCENTAGE'
              ? subtotalAmount * (coupon.value / 100)
              : coupon.value;
          if (discountAmount > subtotalAmount) discountAmount = subtotalAmount;
        }
      }
    }

    // CEP de destino: vem do endereço salvo ou do endereço novo informado.
    let zipCode: string | null = null;
    if (data.addressId) {
      const { data: addr } = await supabase
        .from('addresses')
        .select('zip_code')
        .eq('id', data.addressId)
        .eq('user_id', userId)
        .maybeSingle();
      zipCode = addr?.zip_code ?? null;
    } else if (data.addressData?.zipCode) {
      zipCode = String(data.addressData.zipCode).replace(/\D/g, '');
    }

    // O frete é recalculado no servidor: o valor do cliente nunca é confiado.
    const shipping = await this.resolveShipping(data, resolved, zipCode);
    const shippingAmount = shipping.amount;
    const totalAmount = subtotalAmount - discountAmount + shippingAmount;

    let finalAddressId = data.addressId ?? null;
    if (!finalAddressId && data.addressData) {
      const { data: newAddr, error: addrError } = await supabase
        .from('addresses')
        .insert({ user_id: userId, ...data.addressData })
        .select()
        .single();
      if (addrError) throw new AppError(addrError.message, 400, 'ADDRESS_CREATION_FAILED');
      finalAddressId = newAddr.id;
    }

    const dbPaymentMethod =
      data.paymentMethod === 'credit_card' ? 'CREDIT_CARD' : data.paymentMethod.toUpperCase();

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        user_id: userId,
        address_id: finalAddressId,
        coupon_id: couponId,
        subtotal_amount: subtotalAmount,
        shipping_amount: shippingAmount,
        discount_amount: discountAmount,
        total_amount: totalAmount,
        payment_method: dbPaymentMethod,
        status: 'PENDING',
        payment_status: 'WAITING',
        expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      })
      .select()
      .single();

    if (orderError) throw new AppError(orderError.message, 400, 'ORDER_CREATION_FAILED');

    for (const item of resolved) {
      const base = {
        order_id: order.id,
        product_variant_id: item.variantId,
        snapshot_product_name: item.productName,
        snapshot_color_name: item.colorName,
        snapshot_size_name: item.sizeName,
        snapshot_sku: `${item.slug.toUpperCase()}-${item.colorName.substring(0, 2).toUpperCase()}-${item.sizeName}`,
        quantity: item.quantity,
        unit_price: item.unitPrice,
      };

      const { error: itemError } = await supabase
        .from('order_items')
        .insert({ ...base, product_id: item.productId });

      if (itemError) {
        // A migration 002_order_items_product_id.sql pode ainda não ter sido
        // executada: nesse caso a coluna product_id não existe e o item é
        // gravado sem ela para não travar o checkout. Sem product_id o pedido
        // fica não avaliável (minha-conta/pedidos).
        if (/product_id/.test(itemError.message)) {
          console.warn(
            '[orders] coluna order_items.product_id ausente — aplique migrations/002_order_items_product_id.sql',
          );
          const { error: fallbackError } = await supabase.from('order_items').insert(base);
          if (fallbackError) {
            throw new AppError(fallbackError.message, 400, 'ORDER_ITEM_CREATION_FAILED');
          }
        } else {
          throw new AppError(itemError.message, 400, 'ORDER_ITEM_CREATION_FAILED');
        }
      }

      await supabase
        .from('product_variants')
        .update({ stock_quantity: item.stock - item.quantity })
        .eq('id', item.variantId);
    }

    const { data: fullOrder } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .eq('id', order.id)
      .single();

    return fullOrder;
  }

  // Cancela pedidos expirados (não pagos) e devolve o estoque reservado.
  static async releaseExpiredOrders() {
    const { data: expired } = await supabase
      .from('orders')
      .select('id, order_items(product_variant_id, quantity)')
      .eq('payment_status', 'WAITING')
      .eq('status', 'PENDING')
      .lt('expires_at', new Date().toISOString());

    if (!expired || expired.length === 0) return { released: 0 };

    for (const order of expired) {
      for (const item of order.order_items ?? []) {
        if (!item.product_variant_id) continue;
        const { data: variant } = await supabase
          .from('product_variants')
          .select('stock_quantity')
          .eq('id', item.product_variant_id)
          .single();
        if (variant) {
          await supabase
            .from('product_variants')
            .update({ stock_quantity: (variant.stock_quantity ?? 0) + item.quantity })
            .eq('id', item.product_variant_id);
        }
      }

      await supabase.from('orders').update({ status: 'CANCELED' }).eq('id', order.id);
    }

    return { released: expired.length };
  }

  static async getOrders(userId: string, isAdmin: boolean = false) {    if (!isAdmin) {
      const { data } = await supabase
        .from('orders')
        .select('*, order_items(*), coupons(*)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      return data;
    }
    const { data } = await supabase
      .from('orders')
      .select('*, order_items(*), users(name, email, cpf), coupons(*)')
      .order('created_at', { ascending: false });
    return data;
  }

  static async getAllOrders() {
    const { data } = await supabase
      .from('orders')
      .select('*, order_items(*), users(name, email, cpf), addresses(*), coupons(*)')
      .order('created_at', { ascending: false });
    return data;
  }

  static async getOrderById(userId: string, orderId: string, isAdmin: boolean = false) {
    let query = supabase
      .from('orders')
      .select('*, order_items(*), addresses(*), users(name, email, cpf), coupons(*)')
      .eq('id', orderId);
    if (!isAdmin) {
      query = query.eq('user_id', userId);
    }
    const { data } = await query.single();
    return data;
  }

  static async updateOrderStatus(orderId: string, data: z.infer<typeof updateOrderStatusSchema>) {
    const { data: order } = await supabase
      .from('orders')
      .select('*, order_items(*), users(email, name)')
      .eq('id', orderId)
      .single();
    if (!order) throw new AppError('Pedido não encontrado', 404, 'ORDER_NOT_FOUND');

    const updatePayload: Record<string, unknown> = {};
    if (data.status) updatePayload.status = data.status;
    if (data.paymentStatus) updatePayload.payment_status = data.paymentStatus;
    if (data.trackingCode) updatePayload.tracking_code = data.trackingCode;

    const { data: result, error } = await supabase
      .from('orders')
      .update(updatePayload)
      .eq('id', orderId)
      .select()
      .single();
    if (error) throw new AppError(error.message, 400, 'ORDER_UPDATE_FAILED');

    // Cancelamento devolve o estoque reservado.
    if (data.status === 'CANCELED' && order.status !== 'CANCELED') {
      await this.restoreStock(order.order_items ?? []);
    }

    // Pagamento confirmado: a contagem de vendas é feita em um único lugar
    // (PaymentsService.markAsPaid), evitando contagem dupla entre webhook e painel.
    if (data.paymentStatus === 'PAID' && order.payment_status !== 'PAID') {
      const { PaymentsController } = await import('../payments/payments.controller');
      await PaymentsController.markAsPaid(orderId, order);
    }

    // E-mail de envio (o cliente recebe o código de rastreio).
    if (data.status === 'SHIPPED' && order.status !== 'SHIPPED') {
      const customerEmail = (order as any).users?.email;
      if (customerEmail) {
        const items = (order.order_items ?? []).map((i: any) => ({
          snapshot_product_name: i.snapshot_product_name,
          snapshot_color_name: i.snapshot_color_name,
          snapshot_size_name: i.snapshot_size_name,
          quantity: i.quantity,
          unit_price: i.unit_price,
        }));
        const subtotal = items.reduce((acc: number, i: any) => acc + i.unit_price * i.quantity, 0);

        await sendMail({
          to: customerEmail,
          subject: 'Seu pedido foi enviado — WOL',
          html: orderShippedEmail({
            orderId,
            customerName: (order as any).users?.name ?? 'Cliente',
            items,
            subtotal,
            shipping: order.shipping_amount ?? 0,
            discount: order.discount_amount ?? 0,
            total: order.total_amount ?? subtotal,
            paymentMethod: order.payment_method ?? 'PIX',
            trackingCode: data.trackingCode ?? order.tracking_code ?? null,
          }),
        });
      }
    }

    return result;
  }

  // Devolve ao estoque as quantidades de um pedido cancelado.
  private static async restoreStock(items: Array<{ product_variant_id: string | null; quantity: number }>) {
    for (const item of items) {
      if (!item.product_variant_id) continue;
      const { data: variant } = await supabase
        .from('product_variants')
        .select('stock_quantity')
        .eq('id', item.product_variant_id)
        .single();
      if (!variant) continue;
      await supabase
        .from('product_variants')
        .update({ stock_quantity: (variant.stock_quantity ?? 0) + item.quantity })
        .eq('id', item.product_variant_id);
    }
  }
}
