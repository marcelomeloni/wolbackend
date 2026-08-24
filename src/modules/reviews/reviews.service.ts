import { supabase } from '../../lib/supabase';
import { z } from 'zod';
import { reviewSchema } from './reviews.schema';

export class ReviewsService {
  static async addReview(userId: string, data: z.infer<typeof reviewSchema>) {
    const { data: result, error } = await supabase.from('reviews').insert({
      user_id: userId,
      product_id: data.productId,
      rating: data.rating,
      comment: data.comment || null
    }).select().single();

    if (error) throw new Error(error.message);
    return result;
  }

  static async getProductReviews(productId: string) {
    const { data, error } = await supabase
      .from('reviews')
      .select('*, users(name)')
      .eq('product_id', productId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    return data;
  }

  static async deleteReview(id: string) {
    const { error } = await supabase.from('reviews').delete().eq('id', id);
    if (error) throw new Error(error.message);
    return { success: true };
  }
}
