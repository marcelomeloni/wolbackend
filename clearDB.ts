import { supabase } from './src/lib/supabase';

const tablesToDelete = [
  'order_items',
  'reviews',
  'favorites',
  'product_images',
  'product_colors',
  'product_sizes',
  'product_variants',
  'orders',
  'addresses',
  'coupons',
  'products',
  'categories',
  'users',
  'newsletter_subscribers'
];

async function clearDB() {
  console.log('Iniciando limpeza do banco de dados...');
  for (const table of tablesToDelete) {
    console.log(`Limpando tabela: ${table}`);
    const { error } = await supabase
      .from(table)
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Dummy condition that's true for all UUIDs (or use a simple true condition)
    
    if (error) {
       // Se o ID não existir, vamos tentar deletar com eq 1=1 (embora o Supabase JS exija um filtro)
       // Um truque no Supabase JS é fazer inq com um array gigante, ou filter nulo, ou gte.
       // Mas o mais seguro é deletar os registros se gte('created_at', '2000-01-01') que sempre é verdade
       const { error: error2 } = await supabase
         .from(table)
         .delete()
         .not('created_at', 'is', null);

       if (error2) {
         console.error(`Erro ao limpar ${table}:`, error2.message);
       } else {
         console.log(`Tabela ${table} limpa com sucesso.`);
       }
    } else {
      console.log(`Tabela ${table} limpa com sucesso.`);
    }
  }
  console.log('Limpeza concluída!');
}

clearDB();
