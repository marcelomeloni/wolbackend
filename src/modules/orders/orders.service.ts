import { supabase } from '../../lib/supabase';
import { z } from 'zod';
import { createOrderSchema, updateOrderStatusSchema } from './orders.schema';

export class OrdersService {
  static async createOrder(userId: string, data: z.infer<typeof createOrderSchema>) {
    let subtotalAmount = 0;
    const orderItemsToInsert: any[] = [];

    for (const item of data.items) {
      subtotalAmount += item.unitPrice * item.quantity;

      orderItemsToInsert.push({
        snapshot_product_name: item.productName,
        snapshot_color_name: item.colorName,
        snapshot_size_name: item.sizeName,
        snapshot_sku: `${item.productSlug.toUpperCase()}-${item.colorName.substring(0,2).toUpperCase()}-${item.sizeName}`,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        // Since we don't have UUIDs in frontend, we leave product_variant_id null
        // Make sure database allows null for product_variant_id in order_items!
        // Supabase foreign keys sometimes allow null. We'll find out.
      });
    }

    let discountAmount = 0;
    let couponId = null;

    if (data.couponCode) {
      const { data: coupon } = await supabase.from('coupons').select('*').eq('code', data.couponCode).single();
      if (coupon && coupon.is_active) {
        const isValidDate = !coupon.expires_at || new Date() <= new Date(coupon.expires_at);
        const isValidMinAmount = !coupon.min_purchase_amount || subtotalAmount >= coupon.min_purchase_amount;

        if (isValidDate && isValidMinAmount) {
          couponId = coupon.id;
          if (coupon.discount_type === 'percentage') {
            discountAmount = subtotalAmount * (coupon.value / 100);
          } else {
            discountAmount = coupon.value;
          }
          if (discountAmount > subtotalAmount) discountAmount = subtotalAmount;
        }
      }
    }

    const shippingAmount = 25.0; // Fixo para simulaÃ§Ã£o
    const totalAmount = subtotalAmount - discountAmount + shippingAmount;

    let finalAddressId = data.addressId;
    if (!finalAddressId && data.addressData) {
      const { data: newAddr, error: addrError } = await supabase.from('addresses').insert({
        user_id: userId,
        ...data.addressData
      }).select().single();
      if (addrError) throw new Error(addrError.message);
      finalAddressId = newAddr.id;
    }

    // Supabase transaction workaround (create order first, then items, then update stock)
    const dbPaymentMethod = data.paymentMethod === 'credit_card' ? 'CREDIT_CARD' : data.paymentMethod.toUpperCase();

    const { data: order, error: orderError } = await supabase.from('orders').insert({
      user_id: userId,
      address_id: finalAddressId,
      coupon_id: couponId,
      subtotal_amount: subtotalAmount,
      shipping_amount: shippingAmount,
      discount_amount: discountAmount,
      total_amount: totalAmount,
      payment_method: dbPaymentMethod,
      status: 'PREPARING', // Auto-approved for simulation
      payment_status: 'PAID' // Auto-approved for simulation
    }).select().single();

    if (orderError) throw new Error(orderError.message);

    for (const item of orderItemsToInsert) {
      await supabase.from('order_items').insert({
        order_id: order.id,
        ...item
      });
      // decrement stock
      const { data: currentVar } = await supabase.from('product_variants').select('stock_quantity').eq('id', item.product_variant_id).single();
      if (currentVar) {
        await supabase.from('product_variants').update({ stock_quantity: currentVar.stock_quantity - item.quantity }).eq('id', item.product_variant_id);
      }
    }

    const { data: fullOrder } = await supabase.from('orders').select('*, order_items(*)').eq('id', order.id).single();
    return fullOrder;
  }

  static async getOrders(userId: string, isAdmin: boolean = false) {
    if (!isAdmin) {
      const { data } = await supabase.from('orders').select('*, order_items(*), coupons(*)').eq('user_id', userId).order('created_at', { ascending: false });
      return data;
    }
    // Admin list
    const { data } = await supabase.from('orders').select('*, order_items(*), users(name, email, cpf), coupons(*)').order('created_at', { ascending: false });
    return data;
  }

  static async getAllOrders() {
    const { data } = await supabase.from('orders').select('*, order_items(*), users(name, email, cpf)').order('created_at', { ascending: false });
    return data;
  }

  static async getOrderById(userId: string, orderId: string, isAdmin: boolean = false) {
    let query = supabase.from('orders').select('*, order_items(*), addresses(*), users(name, email, cpf), coupons(*)').eq('id', orderId);
    if (!isAdmin) {
      query = query.eq('user_id', userId);
    }
    const { data } = await query.single();
    return data;
  }

  static async updateOrderStatus(orderId: string, data: z.infer<typeof updateOrderStatusSchema>) {
    const { data: order } = await supabase.from('orders').select('*, order_items(*)').eq('id', orderId).single();
    if (!order) throw new Error('ORDER_NOT_FOUND');

    const updatePayload: any = {};
    if (data.status) updatePayload.status = data.status;
    if (data.paymentStatus) updatePayload.payment_status = data.paymentStatus;
    if (data.trackingCode) updatePayload.tracking_code = data.trackingCode;

    const { data: result, error } = await supabase.from('orders').update(updatePayload).eq('id', orderId).select().single();
    if (error) throw new Error(error.message);

    if (data.paymentStatus === 'PAID' && order.payment_status !== 'PAID') {
      for (const item of order.order_items) {
        if (item.product_variant_id) {
          const { data: variant } = await supabase.from('product_variants').select('product_id').eq('id', item.product_variant_id).single();
          if (variant) {
             const { data: prod } = await supabase.from('products').select('sales_count').eq('id', variant.product_id).single();
             if (prod) {
               await supabase.from('products').update({ sales_count: prod.sales_count + item.quantity }).eq('id', variant.product_id);
             }
          }
        }
      }
    }

    return result;
  }
}



