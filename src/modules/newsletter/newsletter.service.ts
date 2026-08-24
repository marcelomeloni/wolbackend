import { supabase } from '../../lib/supabase';
import { z } from 'zod';
import { newsletterSchema } from './newsletter.schema';

export class NewsletterService {
  static async subscribe(data: z.infer<typeof newsletterSchema>) {
    const { data: result, error } = await supabase
      .from('newsletter_subscribers')
      .upsert({ email: data.email, is_active: true }, { onConflict: 'email' })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return result;
  }

  static async unsubscribe(email: string) {
    const { data, error } = await supabase
      .from('newsletter_subscribers')
      .update({ is_active: false })
      .eq('email', email)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  }
}
