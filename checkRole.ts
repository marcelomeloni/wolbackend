import { supabase } from './src/lib/supabase';

async function checkRole() {
  const { data: users, error } = await supabase.from('users').select('role').limit(5);
  if (error) console.error(error);
  else console.log('Roles found:', users.map(u => u.role));
}

checkRole();
