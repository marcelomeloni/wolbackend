import { supabase } from '../../lib/supabase';
import { z } from 'zod';
import { addressSchema } from './addresses.schema';

export class AddressesService {
  static async createAddress(userId: string, data: z.infer<typeof addressSchema>) {
    if (data.isMain) {
      await supabase.from('addresses').update({ is_main: false }).eq('user_id', userId);
    }

    const { data: result, error } = await supabase.from('addresses').insert({
      user_id: userId,
      zip_code: data.zipCode,
      street: data.street,
      number: data.number,
      complement: data.complement || null,
      neighborhood: data.neighborhood,
      city: data.city,
      state: data.state,
      is_main: data.isMain || false
    }).select().single();

    if (error) throw new Error(error.message);
    return result;
  }

  static async getAddresses(userId: string) {
    const { data: addresses, error } = await supabase
      .from('addresses')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    return addresses;
  }

  static async updateAddress(userId: string, addressId: string, data: z.infer<typeof addressSchema>) {
    const { data: existing } = await supabase
      .from('addresses')
      .select('id')
      .eq('id', addressId)
      .eq('user_id', userId)
      .single();

    if (!existing) {
      throw new Error('ADDRESS_NOT_FOUND');
    }

    if (data.isMain) {
      await supabase.from('addresses').update({ is_main: false }).eq('user_id', userId).neq('id', addressId);
    }

    const { data: result, error } = await supabase.from('addresses').update({
      zip_code: data.zipCode,
      street: data.street,
      number: data.number,
      complement: data.complement || null,
      neighborhood: data.neighborhood,
      city: data.city,
      state: data.state,
      is_main: data.isMain || false
    }).eq('id', addressId).select().single();

    if (error) throw new Error(error.message);
    return result;
  }

  static async deleteAddress(userId: string, addressId: string) {
    const { data: existing } = await supabase
      .from('addresses')
      .select('id')
      .eq('id', addressId)
      .eq('user_id', userId)
      .single();

    if (!existing) {
      throw new Error('ADDRESS_NOT_FOUND');
    }

    const { error } = await supabase.from('addresses').delete().eq('id', addressId);
    if (error) throw new Error(error.message);
    return { success: true };
  }
}
