import { Request, Response } from 'express';
import { UsersService, updateRoleSchema } from './users.service';

export class UsersController {
  static async listAll(req: Request, res: Response) {
    try {
      const users = await UsersService.getAllUsers();
      res.json(users);
    } catch (error: any) {
      res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: error.message } });
    }
  }

  static async updateRole(req: Request, res: Response) {
    try {
      const data = updateRoleSchema.parse(req.body);
      const user = await UsersService.updateUserRole(req.params.id, data);
      res.json(user);
    } catch (error: any) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: error.errors || error.message } });
    }
  }

  static async delete(req: Request, res: Response) {
    try {
      // Prevent deleting self
      if (req.user && req.user.userId === req.params.id) {
        res.status(400).json({ error: { code: 'CANNOT_DELETE_SELF', message: 'Você não pode excluir sua própria conta.' } });
        return;
      }
      await UsersService.deleteUser(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: error.message } });
    }
  }
}
