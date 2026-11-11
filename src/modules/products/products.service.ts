import { supabase } from '../../lib/supabase';
import { z } from 'zod';
import { createProductFullSchema, productVariantSchema, productImageSchema, productSchema, productColorSchema, productSizeSchema } from './products.schema';

// Converte o registro bruto do Supabase no contrato consumido pelo frontend.
// variants[] é o formato-chave: uma entrada por combinação cor+tamanho, com
// id (para o carrinho/pedido), estoque, preço e imagens frente/verso.
function mapProductToFrontend(p: any) {
  const colors = (p.product_colors ?? []).map((c: any) => ({
    id: c.id,
    colorName: c.color_name,
    colorHex: c.color_hex,
  }));
  const sizes = (p.product_sizes ?? []).map((s: any) => ({
    id: s.id,
    sizeName: s.size_name,
  }));
  const images = (p.product_images ?? []).map((img: any) => ({
    id: img.id,
    colorId: img.color_id,
    imageUrl: img.image_url,
    isMain: img.is_main,
    displayOrder: img.display_order,
  }));

  const colorById = new Map(colors.map((c: any) => [c.id, c]));
  const sizeById = new Map(sizes.map((s: any) => [s.id, s]));

  const imageFor = (colorId: string, order: number) =>
    images.find((img: any) => img.colorId === colorId && img.displayOrder === order)?.imageUrl ?? null;

  const variants = (p.product_variants ?? []).map((v: any) => {
    const color = colorById.get(v.color_id) as any;
    const size = sizeById.get(v.size_id) as any;
    return {
      id: v.id,
      color: v.color_id,
      colorLabel: color?.colorName ?? null,
      colorHex: color?.colorHex ?? null,
      size: size?.sizeName ?? null,
      stockQuantity: v.stock_quantity,
      price: v.price_override ?? p.base_price,
      frontImage: imageFor(v.color_id, 1),
      backImage: imageFor(v.color_id, 2),
    };
  });

  // Fallback: se não houver variants, gera uma entrada por cor (catálogo/vitrine).
  const colorVariants =
    variants.length > 0
      ? variants
      : colors.map((c: any) => ({
          id: null,
          color: c.id,
          colorLabel: c.colorName,
          colorHex: c.colorHex,
          size: null,
          stockQuantity: null,
          price: p.base_price,
          frontImage: imageFor(c.id, 1),
          backImage: imageFor(c.id, 2),
        }));

  // "Novo" é derivado da data de cadastro (30 dias) — não existe flag própria
  // e is_featured é o destaque da vitrine, que é outra coisa.
  const isNew = p.created_at
    ? Date.now() - new Date(p.created_at).getTime() < 30 * 24 * 60 * 60 * 1000
    : false;

  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    description: p.description ?? '',
    price: p.base_price,
    isFeatured: p.is_featured,
    isNew,
    category: p.categories ? { id: p.categories.id, name: p.categories.name } : null,
    colors,
    sizes,
    images,
    variants: colorVariants,
    reviews: p.reviews ?? [],
  };
}

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
      view_count: productData.viewCount || 0,
      weight_kg: productData.weightKg ?? null,
      height_cm: productData.heightCm ?? null,
      width_cm: productData.widthCm ?? null,
      length_cm: productData.lengthCm ?? null
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
    let dbQuery = supabase
      .from('products')
      .select('*, product_images(*), categories(*), product_colors(*), product_sizes(*), product_variants(*)')
      .eq('is_active', true);

    if (categoryId) dbQuery = dbQuery.eq('category_id', categoryId);
    if (search) dbQuery = dbQuery.ilike('name', `%${search}%`);
    if (isFeatured === 'true') dbQuery = dbQuery.eq('is_featured', true);

    const { data, error } = await dbQuery.order('created_at', { ascending: false });
    if (error) throw new Error(error.message);

    return (data ?? []).map(mapProductToFrontend);
  }

  // Lista completa do painel admin: inclui inativos e traz os campos de gestão
  // que o contrato público do storefront não expõe.
  static async getProductsForAdmin() {
    const { data, error } = await supabase
      .from('products')
      .select(
        '*, product_images(*), categories(*), product_colors(*), product_sizes(*), product_variants(*), reviews(*, users(name))',
      )
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);

    return (data ?? []).map((p: any) => ({
      ...mapProductToFrontend(p),
      categoryId: p.category_id,
      isActive: p.is_active,
      salesCount: p.sales_count,
      viewCount: p.view_count,
      weightKg: p.weight_kg,
      heightCm: p.height_cm,
      widthCm: p.width_cm,
      lengthCm: p.length_cm,
      createdAt: p.created_at,
      updatedAt: p.updated_at,
    }));
  }

  static async getProductBySlug(slug: string) {
    const { data: product, error } = await supabase
      .from('products')
      .select('*, product_colors(*), product_sizes(*), product_images(*), product_variants(*), categories(*), reviews(*, users(name))')
      .eq('slug', slug)
      .single();

    if (error && error.code !== 'PGRST116') throw new Error(error.message);
    if (!product) return null;

    // incrementa visualização (fire-and-forget)
    supabase
      .from('products')
      .update({ view_count: (product.view_count ?? 0) + 1 })
      .eq('id', product.id)
      .then();

    return mapProductToFrontend(product);
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
    if (data.weightKg !== undefined) updatePayload.weight_kg = data.weightKg;
    if (data.heightCm !== undefined) updatePayload.height_cm = data.heightCm;
    if (data.widthCm !== undefined) updatePayload.width_cm = data.widthCm;
    if (data.lengthCm !== undefined) updatePayload.length_cm = data.lengthCm;

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

