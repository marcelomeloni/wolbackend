import { Request, Response } from 'express';
import { FavoritesService } from './favorites.service';
import { favoriteSchema } from './favorites.schema';
import { AppError } from '../../middlewares/errorHandler';

export class FavoritesController {
  static async add(req: Request, res: Response) {
    if (!req.user) throw new AppError('Não autenticado', 401, 'UNAUTHORIZED');
    const data = favoriteSchema.parse(req.body);
    const favorite = await FavoritesService.addFavorite(req.user.userId, data.productId);
    res.status(201).json(favorite);
  }

  static async remove(req: Request, res: Response) {
    if (!req.user) throw new AppError('Não autenticado', 401, 'UNAUTHORIZED');
    await FavoritesService.removeFavorite(req.user.userId, req.params.productId as string);
    res.status(204).send();
  }

  static async list(req: Request, res: Response) {
    if (!req.user) throw new AppError('Não autenticado', 401, 'UNAUTHORIZED');
    const favorites = await FavoritesService.getFavorites(req.user.userId);
    res.json(favorites);
  }
}
