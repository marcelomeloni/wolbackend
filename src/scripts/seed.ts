import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_KEY in env.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

const productsData = [
  { id: '6bcd73a1-ca66-44c4-8de9-4bc3e6ef4284', slug: 'every-good', name: 'Every Good', price: 139.90, description: 'Camiseta oversized premium com estampa exclusiva Every Good. Disponível em preto e branco.', isNew: true },
  { id: '91d0fbf9-3845-44fb-8dc6-cbd04dfecfca', slug: 'god-is-with-you', name: 'God Is With You', price: 139.90, description: 'Camiseta oversized premium com estampa exclusiva God Is With You. Mensagem de fé e propósito.', isNew: false },
  { id: 'feb76983-6f6f-4cb7-a86c-c2ebca21a533', slug: 'bloom-with-grace', name: 'Bloom With Grace', price: 139.90, description: 'Camiseta streetwear Bloom With Grace, estampa floral abstrata. Design minimalista.', isNew: false },
  { id: '803b0240-0e83-4d3c-892b-95e3f54dc06f', slug: 'jesus-loves-you', name: 'Jesus Loves You', price: 139.90, description: 'Camiseta oversized Jesus Loves You. Estética streetwear com mensagem clara.', isNew: false },
  { id: '257b26cd-2219-4e0b-9052-520fa1805caf', slug: 'love', name: 'Love', price: 139.90, description: 'Camiseta Love essencial. Corte premium urbano e caimento perfeito.', isNew: false },
  { id: 'dd81873b-4cc5-4290-b1d4-61bde30ccb36', slug: 'love-never-fail', name: 'Love Never Fail', price: 139.90, description: 'Camiseta Love Never Fail. Streetwear com propósito e impacto visual.', isNew: false }
];

const variants = [
  { color: 'preto', label: 'Preto', hex: '#000000' },
  { color: 'branco', label: 'Branco', hex: '#FFFFFF' }
];
const sizes = ['P', 'M', 'G', 'GG'];

async function runSeed() {
  console.log('Starting seed...');
  let { data: category } = await supabase.from('categories').select('*').eq('slug', 'camisetas').single();
  if (!category) {
    const { data: newCat, error } = await supabase.from('categories').insert({ name: 'Camisetas', slug: 'camisetas', description: 'Camisetas exclusivas WOL', is_menu: true }).select().single();
    if (error) throw error;
    category = newCat;
  }
  for (const prod of productsData) {
    let { data: insertedProd } = await supabase.from('products').select('*').eq('id', prod.id).single();
    if (!insertedProd) {
      const { data: newProd, error: prodErr } = await supabase.from('products').insert({
        id: prod.id, category_id: category.id, name: prod.name, slug: prod.slug,
        description: prod.description, base_price: prod.price, is_active: true, is_featured: prod.isNew
      }).select().single();
      if (prodErr) { console.error('Error prod:', prodErr); continue; }
      insertedProd = newProd;
    } else {
       await supabase.from('products').update({ name: prod.name, description: prod.description, base_price: prod.price }).eq('id', prod.id);
    }
    for (const v of variants) {
      let { data: colorData } = await supabase.from('product_colors').select('*').eq('product_id', insertedProd.id).eq('color_name', v.label).single();
      if (!colorData) {
        const { data: newColor, error: colorErr } = await supabase.from('product_colors').insert({ product_id: insertedProd.id, color_name: v.label, color_hex: v.hex }).select().single();
        if (colorErr) { console.error('Error color:', colorErr); continue; }
        colorData = newColor;
      }
      const frontUrl = `/camisas/${prod.slug.replace(/-/g, ' ')}/${v.color}/frente.jpg`;
      const backUrl = `/camisas/${prod.slug.replace(/-/g, ' ')}/${v.color}/verso.jpg`;
      let { data: frontImg } = await supabase.from('product_images').select('*').eq('product_id', insertedProd.id).eq('color_id', colorData.id).eq('image_url', frontUrl).single();
      if (!frontImg) await supabase.from('product_images').insert({ product_id: insertedProd.id, color_id: colorData.id, image_url: frontUrl, is_main: true, display_order: 1 });
      let { data: backImg } = await supabase.from('product_images').select('*').eq('product_id', insertedProd.id).eq('color_id', colorData.id).eq('image_url', backUrl).single();
      if (!backImg) await supabase.from('product_images').insert({ product_id: insertedProd.id, color_id: colorData.id, image_url: backUrl, is_main: false, display_order: 2 });
      for (const s of sizes) {
        let { data: sizeData } = await supabase.from('product_sizes').select('*').eq('product_id', insertedProd.id).eq('size_name', s).single();
        if (!sizeData) {
          const { data: newSize, error: sizeErr } = await supabase.from('product_sizes').insert({ product_id: insertedProd.id, size_name: s }).select().single();
          if (sizeErr) { console.error('Error size:', sizeErr); continue; }
          sizeData = newSize;
        }
        const sku = `${prod.slug.toUpperCase()}-${v.color.substring(0,2).toUpperCase()}-${s}`;
        let { data: variantData } = await supabase.from('product_variants').select('*').eq('sku', sku).single();
        if (!variantData) {
          await supabase.from('product_variants').insert({
            product_id: insertedProd.id, color_id: colorData.id, size_id: sizeData.id, sku: sku, stock_quantity: 100
          });
        }
      }
    }
  }
  console.log('Seed completed successfully!');
}
runSeed();
