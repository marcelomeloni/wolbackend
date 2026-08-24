import { supabase } from '../../lib/supabase';
import { z } from 'zod';
import { categorySchema } from './categories.schema';

export class CategoriesService {
  static async createCategory(data: z.infer<typeof categorySchema>) {
    const { data: exists } = await supabase.from('categories').select('id').eq('slug', data.slug).single();
    if (exists) throw new Error('SLUG_ALREADY_EXISTS');

    const { data: result, error } = await supabase.from('categories').insert({
      parent_id: data.parentId || null,
      name: data.name,
      slug: data.slug,
      description: data.description || null,
      image_url: data.imageUrl || null,
      is_menu: data.isMenu || false
    }).select().single();

    if (error) throw new Error(error.message);
    return result;
  }

  static async getCategories() {
    // Note: Emulação de children via query única e montagem ou via supabase self-join
    const { data: categories, error } = await supabase.from('categories').select('*');
    if (error) throw new Error(error.message);
    
    // Montando a árvore no backend para compatibilidade com o frontend
    const map = new Map();
    categories.forEach((c: any) => {
      map.set(c.id, { ...c, children: [] });
    });
    
    const roots: any[] = [];
    categories.forEach((c: any) => {
      if (c.parent_id) {
        const parent = map.get(c.parent_id);
        if (parent) parent.children.push(map.get(c.id));
      } else {
        roots.push(map.get(c.id));
      }
    });

    return roots;
  }

  static async updateCategory(id: string, data: z.infer<typeof categorySchema>) {
    const { data: exists } = await supabase.from('categories').select('id, slug').eq('id', id).single();
    if (!exists) throw new Error('CATEGORY_NOT_FOUND');

    if (data.slug !== exists.slug) {
      const { data: slugExists } = await supabase.from('categories').select('id').eq('slug', data.slug).single();
      if (slugExists) throw new Error('SLUG_ALREADY_EXISTS');
    }

    const { data: result, error } = await supabase.from('categories').update({
      parent_id: data.parentId || null,
      name: data.name,
      slug: data.slug,
      description: data.description || null,
      image_url: data.imageUrl || null,
      is_menu: data.isMenu || false
    }).eq('id', id).select().single();

    if (error) throw new Error(error.message);
    return result;
  }

  static async deleteCategory(id: string) {
    const { data: exists } = await supabase.from('categories').select('id').eq('id', id).single();
    if (!exists) throw new Error('CATEGORY_NOT_FOUND');

    const { error } = await supabase.from('categories').delete().eq('id', id);
    if (error) throw new Error(error.message);
    return { success: true };
  }
}
