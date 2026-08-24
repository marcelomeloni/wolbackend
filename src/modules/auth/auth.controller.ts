import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { registerSchema, loginSchema } from './auth.schema';
import { supabase } from '../../lib/supabase';

export class AuthController {
  static async register(req: Request, res: Response) {
    try {
      const data = registerSchema.parse(req.body);
      const user = await AuthService.register(data);
      const { password_hash, ...userWithoutPassword } = user;
      res.status(201).json(userWithoutPassword);
    } catch (error: any) {
      if (error.message === 'USER_ALREADY_EXISTS') {
        res.status(409).json({ error: { code: 'USER_ALREADY_EXISTS', message: 'E-mail ou CPF já cadastrado' } });
      } else {
        res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: error.errors || error.message } });
      }
    }
  }

  static async login(req: Request, res: Response) {
    try {
      const data = loginSchema.parse(req.body);
      const { user, token } = await AuthService.login(data);
      const { password_hash, ...userWithoutPassword } = user;
      res.json({ user: userWithoutPassword, token });
    } catch (error: any) {
      if (error.message === 'INVALID_CREDENTIALS') {
        res.status(401).json({ error: { code: 'INVALID_CREDENTIALS', message: 'Credenciais inválidas' } });
      } else {
        res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: error.errors || error.message } });
      }
    }
  }

  static async getMe(req: Request, res: Response) {
    try {
      if (!req.user) {
        res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'User not found in request' } });
        return;
      }
      // @ts-ignore
      const { supabase } = await import('../../lib/supabase');
      const { data: user } = await supabase.from('users').select('*').eq('id', req.user.userId).single();
      if (!user) {
        res.status(404).json({ error: { code: 'USER_NOT_FOUND', message: 'User not found' } });
        return;
      }
      const { password_hash, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error: any) {
      res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: error.message } });
    }
  }

  static async updateMe(req: Request, res: Response) {
    try {
      if (!req.user) throw new Error('UNAUTHORIZED');
      const { name, phone } = req.body;
      
      // @ts-ignore
      const { supabase } = await import('../../lib/supabase');
      const { data: user, error } = await supabase.from('users')
        .update({ name, phone })
        .eq('id', req.user.userId)
        .select().single();
        
      if (error) throw new Error(error.message);
      
      const { password_hash, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error: any) {
      res.status(400).json({ error: { code: 'UPDATE_FAILED', message: error.message } });
    }
  }
}
