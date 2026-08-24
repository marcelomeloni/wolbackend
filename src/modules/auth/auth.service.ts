import { supabase } from '../../lib/supabase';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { registerSchema, loginSchema } from './auth.schema';

export class AuthService {
  static async register(data: z.infer<typeof registerSchema>) {
    const { data: userExists } = await supabase
      .from('users')
      .select('*')
      .or(`email.eq.${data.email},cpf.eq.${data.cpf}`)
      .single();

    if (userExists) {
      throw new Error('USER_ALREADY_EXISTS');
    }

    const passwordHash = await bcrypt.hash(data.password, 10);

    const { data: user, error } = await supabase.from('users').insert({
      name: data.name,
      email: data.email,
      cpf: data.cpf,
      phone: data.phone,
      password_hash: passwordHash,
      role: 'CUSTOMER'
    }).select().single();

    if (error) throw new Error(error.message);

    return user;
  }

  static async login(data: z.infer<typeof loginSchema>) {
    const { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('email', data.email)
      .single();

    if (!user) {
      throw new Error('INVALID_CREDENTIALS');
    }

    const isPasswordValid = await bcrypt.compare(data.password, user.password_hash);

    if (!isPasswordValid) {
      throw new Error('INVALID_CREDENTIALS');
    }

    const token = jwt.sign(
      { userId: user.id, role: user.role },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '2h' }
    );

    return { user, token };
  }
}
