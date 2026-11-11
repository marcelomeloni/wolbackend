import { supabase } from '../../lib/supabase';
import { z } from 'zod';
import { couponSchema, validateCouponSchema, updateCouponSchema } from './coupons.schema';

// O enum `discount_type` no Postgres é maiúsculo; a API fala minúsculo.
type DbDiscountType = 'PERCENTAGE' | 'FIXED';
const toDbDiscountType = (value: 'percentage' | 'fixed'): DbDiscountType =>
  value === 'percentage' ? 'PERCENTAGE' : 'FIXED';
const toApiDiscountType = (value: string | null): 'percentage' | 'fixed' =>
  value === 'PERCENTAGE' ? 'percentage' : 'fixed';

// Serializa o cupom do banco (snake_case + enum maiúsculo) para o contrato da API.
function mapCouponToApi(coupon: Record<string, any> | null) {
  if (!coupon) return coupon;
  return { ...coupon, discount_type: toApiDiscountType(coupon.discount_type) };
}

export class CouponsService {
  static async createCoupon(data: z.infer<typeof couponSchema>) {
    const { data: exists } = await supabase.from('coupons').select('id').eq('code', data.code).single();
    if (exists) throw new Error('COUPON_ALREADY_EXISTS');

    const { data: result, error } = await supabase.from('coupons').insert({
      code: data.code,
      discount_type: toDbDiscountType(data.discountType),
      value: data.value,
      min_purchase_amount: data.minPurchaseAmount || null,
      expires_at: data.expiresAt ? new Date(data.expiresAt).toISOString() : null,
      is_active: data.isActive
    }).select().single();

    if (error) throw new Error(error.message);
    return mapCouponToApi(result);
  }

  static async listCoupons() {
    const { data, error } = await supabase.from('coupons').select('*').order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map(mapCouponToApi);
  }

  static async updateCoupon(id: string, data: z.infer<typeof updateCouponSchema>) {
    const { data: exists } = await supabase.from('coupons').select('id').eq('id', id).maybeSingle();
    if (!exists) throw new Error('COUPON_NOT_FOUND');

    const payload: Record<string, unknown> = {};

    if (data.code !== undefined) {
      const { data: duplicated } = await supabase
        .from('coupons')
        .select('id')
        .eq('code', data.code)
        .neq('id', id)
        .maybeSingle();
      if (duplicated) throw new Error('COUPON_ALREADY_EXISTS');
      payload.code = data.code;
    }

    if (data.discountType !== undefined) payload.discount_type = toDbDiscountType(data.discountType);
    if (data.value !== undefined) payload.value = data.value;
    if (data.minPurchaseAmount !== undefined) payload.min_purchase_amount = data.minPurchaseAmount;
    if (data.expiresAt !== undefined) {
      payload.expires_at = data.expiresAt ? new Date(data.expiresAt).toISOString() : null;
    }
    if (data.isActive !== undefined) payload.is_active = data.isActive;

    const { data: result, error } = await supabase
      .from('coupons')
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return mapCouponToApi(result);
  }

  static async deleteCoupon(id: string) {
    const { data: exists } = await supabase.from('coupons').select('id').eq('id', id).maybeSingle();
    if (!exists) throw new Error('COUPON_NOT_FOUND');

    const { error } = await supabase.from('coupons').delete().eq('id', id);
    if (error) throw new Error(error.message);
    return { success: true };
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
    if (coupon.discount_type === 'PERCENTAGE') {
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
