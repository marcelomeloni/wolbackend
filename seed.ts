import { supabase } from './src/lib/supabase';

async function seed() {
  console.log('Seeding products...');
  
  // 1. Criar Categoria
  const { data: cat } = await supabase.from('categories').insert({
    name: 'Camisetas Oversized',
    slug: 'camisetas-oversized',
  }).select().single();
  
  if (!cat) throw new Error('Falha ao criar categoria');
  
  // 2. Criar Tamanhos
  const sizes = ['P', 'M', 'G', 'GG'];
  const sizeMap: any = {};
  for (const s of sizes) {
     const { data } = await supabase.from('product_sizes').insert({ size_name: s }).select().single();
     if (data) sizeMap[s] = data.id;
  }
  
  // Produtos do Frontend
  const products = [
    { slug: 'every-good', name: 'Every Good', price: 139.90 },
    { slug: 'god-is-with-you', name: 'God Is With You', price: 139.90 },
    { slug: 'bloom-with-grace', name: 'Bloom With Grace', price: 139.90 },
    { slug: 'jesus-loves-you', name: 'Jesus Loves You', price: 139.90 },
    { slug: 'love', name: 'Love', price: 139.90 },
    { slug: 'love-never-fail', name: 'Love Never Fail', price: 139.90 },
  ];

  const colors = [
    { name: 'preto', hex: '#000000' },
    { name: 'branco', hex: '#ffffff' }
  ];

  for (const p of products) {
    const { data: prod } = await supabase.from('products').insert({
      category_id: cat.id,
      name: p.name,
      slug: p.slug,
      description: 'Camiseta oversized premium ' + p.name,
      base_price: p.price,
      is_active: true
    }).select().single();

    if (!prod) continue;
    console.log(`Criado produto ${p.name} com ID: ${prod.id}`);

    for (const c of colors) {
      const { data: color } = await supabase.from('product_colors').insert({
        product_id: prod.id,
        color_name: c.name,
        color_hex: c.hex
      }).select().single();
      
      if (!color) continue;

      // Imagem
      await supabase.from('product_images').insert({
        product_id: prod.id,
        color_id: color.id,
        image_url: `/camisas/${p.slug}/${c.name}/frente.jpg`,
        is_main: true
      });

      // Variantes (Tamanhos)
      for (const s of sizes) {
        await supabase.from('product_variants').insert({
          product_id: prod.id,
          color_id: color.id,
          size_id: sizeMap[s],
          sku: `${p.slug.toUpperCase()}-${c.name.substring(0,2).toUpperCase()}-${s}`,
          stock_quantity: 100
        });
      }
    }
  }

  console.log('Seed concluído com sucesso!');
}

seed();
