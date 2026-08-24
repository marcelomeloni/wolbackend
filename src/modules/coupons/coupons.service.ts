import { supabase } from '../../lib/supabase';
import { z } from 'zod';
import { couponSchema, validateCouponSchema } from './coupons.schema';

export class CouponsService {
  static async createCoupon(data: z.infer<typeof couponSchema>) {
    const { data: exists } = await supabase.from('coupons').select('id').eq('code', data.code).single();
    if (exists) throw new Error('COUPON_ALREADY_EXISTS');

    const { data: result, error } = await supabase.from('coupons').insert({
      code: data.code,
      discount_type: data.discountType,
      value: data.value,
      min_purchase_amount: data.minPurchaseAmount || null,
      expires_at: data.expiresAt ? new Date(data.expiresAt).toISOString() : null,
      is_active: data.isActive
    }).select().single();

    if (error) throw new Error(error.message);
    return result;
  }

  static async listCoupons() {
    const { data, error } = await supabase.from('coupons').select('*').order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return data;
  }

  static async validateCoupon(data: z.infer<typeof validateCouponSchema>) {
    const { data: coupon } = await supabase.from('coupons').select('*').eq('code', data.code).single();

    if (!coupon || !coupon.is_active) {
      throw new Error('INVALID_COUPON');
    }

    if (coupon.expires_at && new Date() > new Date(coupon.expires_at)) {
      throw new Error('EXPIRED_COUPON');
    }

    if (coupon.min_purchase_amount && data.subtotal < coupon.min_purchase_amount) {
      throw new Error('MIN_AMOUNT_NOT_REACHED');
    }

    let discountAmount = 0;
    if (coupon.discount_type === 'percentage') {
      discountAmount = data.subtotal * (coupon.value / 100);
    } else {
      discountAmount = coupon.value;
    }

    if (discountAmount > data.subtotal) {
      discountAmount = data.subtotal;
    }

    return {
      couponId: coupon.id,
      code: coupon.code,
      discountAmount,
    };
  }
}
