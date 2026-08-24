import { supabase } from '../../lib/supabase';
import { z } from 'zod';
import { createProductFullSchema, productVariantSchema, productImageSchema, productSchema, productColorSchema, productSizeSchema } from './products.schema';

export class ProductsService {
  static async createProduct(data: z.infer<typeof createProductFullSchema>) {
    const { data: exists } = await supabase.from('products').select('id').eq('slug', data.slug).single();
    if (exists) throw new Error('SLUG_ALREADY_EXISTS');

    const { colors, sizes, ...productData } = data;

    const { data: product, error } = await supabase.from('products').insert({
      category_id: productData.categoryId,
      name: productData.name,
      slug: productData.slug,
      description: productData.description || null,
      base_price: productData.basePrice,
      is_active: productData.isActive !== undefined ? productData.isActive : true,
      is_featured: productData.isFeatured !== undefined ? productData.isFeatured : false,
      sales_count: productData.salesCount || 0,
      view_count: productData.viewCount || 0
    }).select().single();

    if (error) throw new Error(error.message);

    if (colors && colors.length > 0) {
      await supabase.from('product_colors').insert(colors.map(c => ({
        product_id: product.id,
        color_name: c.colorName,
        color_hex: c.colorHex
      })));
    }

    if (sizes && sizes.length > 0) {
      await supabase.from('product_sizes').insert(sizes.map(s => ({
        product_id: product.id,
        size_name: s.sizeName
      })));
    }

    const { data: fullProduct } = await supabase.from('products').select('*, product_colors(*), product_sizes(*)').eq('id', product.id).single();
    return fullProduct;
  }

  static async getProducts(query: any) {
    const { categoryId, search, isFeatured } = query;
    let dbQuery = supabase.from('products').select('*, product_images(*), categories(*), product_colors(*), product_sizes(*)').eq('is_active', true);

    if (categoryId) dbQuery = dbQuery.eq('category_id', categoryId);
    if (search) dbQuery = dbQuery.ilike('name', `%${search}%`);
    if (isFeatured === 'true') dbQuery = dbQuery.eq('is_featured', true);

    const { data, error } = await dbQuery.order('created_at', { ascending: false });
    if (error) throw new Error(error.message);

    // Filter only main images for the response
    return data.map((p: any) => ({
      ...p,
      images: p.product_images ? p.product_images.filter((img: any) => img.is_main).map((img: any) => ({
        ...img,
        imageUrl: img.image_url,
        isMain: img.is_main
      })) : [],
      colors: p.product_colors ? p.product_colors.map((c: any) => ({
        ...c,
        colorName: c.color_name,
        colorHex: c.color_hex
      })) : [],
      sizes: p.product_sizes ? p.product_sizes.map((s: any) => ({
        ...s,
        sizeName: s.size_name
      })) : []
    }));
  }

  static async getProductBySlug(slug: string) {
    const { data: product, error } = await supabase
      .from('products')
      .select('*, product_colors(*), product_sizes(*), product_images(*), product_variants(*), categories(*), reviews(*, users(name))')
      .eq('slug', slug)
      .single();

    if (error && error.code !== 'PGRST116') throw new Error(error.message);

    if (product) {
      supabase.from('products').update({ view_count: product.view_count + 1 }).eq('id', product.id).then();
      
      // Map relations to expected frontend format (camelCase)
      return {
        ...product,
        images: product.product_images ? product.product_images.map((img: any) => ({
          ...img,
          imageUrl: img.image_url,
          isMain: img.is_main,
          colorId: img.color_id
        })) : [],
        colors: product.product_colors ? product.product_colors.map((c: any) => ({
          ...c,
          colorName: c.color_name,
          colorHex: c.color_hex
        })) : [],
        sizes: product.product_sizes ? product.product_sizes.map((s: any) => ({
          ...s,
          sizeName: s.size_name
        })) : [],
        variants: product.product_variants ? product.product_variants.map((v: any) => ({
          ...v,
          colorId: v.color_id,
          sizeId: v.size_id,
          stockQuantity: v.stock_quantity,
          priceOverride: v.price_override
        })) : [],
        category: product.categories,
        reviews: product.reviews || []
      };
    }

    return null;
  }

  static async updateProduct(id: string, data: z.infer<typeof productSchema>) {
    const { data: exists } = await supabase.from('products').select('id').eq('id', id).single();
    if (!exists) throw new Error('PRODUCT_NOT_FOUND');

    const updatePayload: any = {};
    if (data.categoryId !== undefined) updatePayload.category_id = data.categoryId;
    if (data.name !== undefined) updatePayload.name = data.name;
    if (data.slug !== undefined) updatePayload.slug = data.slug;
    if (data.description !== undefined) updatePayload.description = data.description;
    if (data.basePrice !== undefined) updatePayload.base_price = data.basePrice;
    if (data.isActive !== undefined) updatePayload.is_active = data.isActive;
    if (data.isFeatured !== undefined) updatePayload.is_featured = data.isFeatured;
    if (data.salesCount !== undefined) updatePayload.sales_count = data.salesCount;
    if (data.viewCount !== undefined) updatePayload.view_count = data.viewCount;

    const { data: result, error } = await supabase.from('products').update(updatePayload).eq('id', id).select().single();
    if (error) throw new Error(error.message);
    return result;
  }

  static async deleteProduct(id: string) {
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) throw new Error(error.message);
    return { success: true };
  }

  static async uploadImage(file: Express.Multer.File) {
    const fileExt = file.originalname.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
    
    const { data, error } = await supabase.storage
      .from('products')
      .upload(fileName, file.buffer, {
        contentType: file.mimetype,
        upsert: false
      });
      
    if (error) throw new Error(error.message);
    
    const { data: publicUrlData } = supabase.storage
      .from('products')
      .getPublicUrl(fileName);
      
    return publicUrlData.publicUrl;
  }

  // --- VARIANTS ---
  static async addVariant(productId: string, data: z.infer<typeof productVariantSchema>) {
    const { data: skuExists } = await supabase.from('product_variants').select('id').eq('sku', data.sku).single();
    if (skuExists) throw new Error('SKU_ALREADY_EXISTS');

    const { data: result, error } = await supabase.from('product_variants').insert({
      product_id: productId,
      color_id: data.colorId,
      size_id: data.sizeId,
      sku: data.sku,
      price_override: data.priceOverride || null,
      stock_quantity: data.stockQuantity
    }).select().single();

    if (error) throw new Error(error.message);
    return result;
  }

  static async deleteVariant(variantId: string) {
    const { error } = await supabase.from('product_variants').delete().eq('id', variantId);
    if (error) throw new Error(error.message);
    return { success: true };
  }

  // --- IMAGES ---
  static async addImage(productId: string, data: z.infer<typeof productImageSchema>) {
    if (data.isMain) {
      await supabase.from('product_images').update({ is_main: false }).eq('product_id', productId);
    }

    const { data: result, error } = await supabase.from('product_images').insert({
      product_id: productId,
      color_id: data.colorId || null,
      image_url: data.imageUrl,
      display_order: data.displayOrder || 0,
      is_main: data.isMain || false
    }).select().single();

    if (error) throw new Error(error.message);
    return result;
  }

  static async deleteImage(imageId: string) {
    const { error } = await supabase.from('product_images').delete().eq('id', imageId);
    if (error) throw new Error(error.message);
    return { success: true };
  }

  // --- COLORS ---
  static async addColor(productId: string, data: z.infer<typeof productColorSchema>) {
    const { data: result, error } = await supabase.from('product_colors').insert({
      product_id: productId,
      color_name: data.colorName,
      color_hex: data.colorHex
    }).select().single();

    if (error) throw new Error(error.message);
    return result;
  }

  static async deleteColor(colorId: string) {
    const { error } = await supabase.from('product_colors').delete().eq('id', colorId);
    if (error) throw new Error(error.message);
    return { success: true };
  }

  // --- SIZES ---
  static async addSize(productId: string, data: z.infer<typeof productSizeSchema>) {
    const { data: result, error } = await supabase.from('product_sizes').insert({
      product_id: productId,
      size_name: data.sizeName
    }).select().single();

    if (error) throw new Error(error.message);
    return result;
  }

  static async deleteSize(sizeId: string) {
    const { error } = await supabase.from('product_sizes').delete().eq('id', sizeId);
    if (error) throw new Error(error.message);
    return { success: true };
  }
}

