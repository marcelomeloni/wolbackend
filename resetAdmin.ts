import { supabase } from './src/lib/supabase';
import bcrypt from 'bcrypt';

async function resetAdmin() {
  const email = 'admin@byfer.com.br';
  const password = 'admin123';
  const hash = await bcrypt.hash(password, 10);

  const { data: user } = await supabase.from('users').select('*').eq('email', email).single();

  if (user) {
    const { error } = await supabase.from('users').update({ password_hash: hash, role: 'ADMIN' }).eq('email', email);
    if (error) console.error('Error updating admin:', error);
    else console.log('Admin password reset successfully to admin123');
  } else {
    const { error } = await supabase.from('users').insert({
      email,
      name: 'Administrador',
      cpf: '000.000.000-00',
      phone: '00000000000',
      password_hash: hash,
      role: 'ADMIN'
    });
    if (error) console.error('Error creating admin:', error);
    else console.log('Admin created successfully with password admin123');
  }
}

resetAdmin();
