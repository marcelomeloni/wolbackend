import { supabase } from './src/lib/supabase';
import bcrypt from 'bcrypt';

async function resetPassword() {
  const passwordHash = await bcrypt.hash('admin123', 10);
  const { data, error } = await supabase.from('users').update({ password_hash: passwordHash }).eq('email', 'admin@byfer.com.br');
  if (error) console.error(error);
  else console.log('Reset password for admin@byfer.com.br to admin123');
}
resetPassword();
