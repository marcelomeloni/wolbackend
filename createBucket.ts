import { supabase } from './src/lib/supabase';

async function main() {
  const { data, error } = await supabase.storage.getBucket('products');
  if (error && error.message.includes('not found')) {
    console.log('Bucket "products" not found. Creating...');
    const { data: createData, error: createError } = await supabase.storage.createBucket('products', {
      public: true,
      allowedMimeTypes: ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'],
      fileSizeLimit: 5242880 // 5MB
    });
    if (createError) {
      console.error('Failed to create bucket:', createError);
      process.exit(1);
    }
    console.log('Bucket "products" created successfully!');
  } else if (error) {
    console.error('Error checking bucket:', error);
  } else {
    console.log('Bucket "products" already exists.');
  }
}

main();
