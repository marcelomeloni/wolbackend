import { supabase } from '../../lib/supabase';

export class FavoritesService {
  static async addFavorite(userId: string, productId: string) {
    const { data, error } = await supabase.from('favorites').insert({
      user_id: userId,
      product_id: productId
    }).select().single();

    if (error) throw new Error(error.message);
    return data;
  }

  static async removeFavorite(userId: string, productId: string) {
    const { error } = await supabase
      .from('favorites')
      .delete()
      .eq('user_id', userId)
      .eq('product_id', productId);

    if (error) throw new Error(error.message);
    return { success: true };
  }

  static async getFavorites(userId: string) {
    const { data, error } = await supabase
      .from('favorites')
      .select('*, products(*, product_images(*))')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    return data;
  }
}
