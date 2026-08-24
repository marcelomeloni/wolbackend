import { supabase } from '../../lib/supabase';
import { z } from 'zod';

export const updateRoleSchema = z.object({
  role: z.enum(['ADMIN', 'customer'])
});

export class UsersService {
  static async getAllUsers() {
    const { data } = await supabase.from('users').select('id, name, email, cpf, phone, role, created_at').order('created_at', { ascending: false });
    return data;
  }

  static async updateUserRole(userId: string, data: z.infer<typeof updateRoleSchema>) {
    const { data: result, error } = await supabase.from('users').update({ role: data.role }).eq('id', userId).select('id, name, email, cpf, phone, role').single();
    if (error) throw new Error(error.message);
    return result;
  }

  static async deleteUser(userId: string) {
    const { error } = await supabase.from('users').delete().eq('id', userId);
    if (error) throw new Error(error.message);
    return { success: true };
  }
}
