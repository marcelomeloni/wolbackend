import { Request, Response } from 'express';
import { FavoritesService } from './favorites.service';
import { favoriteSchema } from './favorites.schema';

export class FavoritesController {
  static async add(req: Request, res: Response) {
    try {
      if (!req.user) throw new Error('UNAUTHORIZED');
      const data = favoriteSchema.parse(req.body);
      const favorite = await FavoritesService.addFavorite(req.user.userId, data.productId);
      res.status(201).json(favorite);
    } catch (error: any) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: error.errors || error.message } });
    }
  }

  static async remove(req: Request, res: Response) {
    try {
      if (!req.user) throw new Error('UNAUTHORIZED');
      await FavoritesService.removeFavorite(req.user.userId, req.params.id as string as string);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: error.message } });
    }
  }

  static async list(req: Request, res: Response) {
    try {
      if (!req.user) throw new Error('UNAUTHORIZED');
      const favorites = await FavoritesService.getFavorites(req.user.userId);
      res.json(favorites);
    } catch (error: any) {
      res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: error.message } });
    }
  }
}
