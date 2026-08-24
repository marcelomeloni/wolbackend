import { Request, Response } from 'express';
import { CategoriesService } from './categories.service';
import { categorySchema } from './categories.schema';

export class CategoriesController {
  static async create(req: Request, res: Response) {
    try {
      const data = categorySchema.parse(req.body);
      const category = await CategoriesService.createCategory(data);
      res.status(201).json(category);
    } catch (error: any) {
      if (error.message === 'SLUG_ALREADY_EXISTS') {
        res.status(409).json({ error: { code: 'SLUG_ALREADY_EXISTS', message: 'Slug já está em uso' } });
      } else {
        res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: error.errors || error.message } });
      }
    }
  }

  static async list(req: Request, res: Response) {
    try {
      const categories = await CategoriesService.getCategories();
      res.json(categories);
    } catch (error: any) {
      res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: error.message } });
    }
  }

  static async update(req: Request, res: Response) {
    try {
      const data = categorySchema.parse(req.body);
      const category = await CategoriesService.updateCategory(req.params.id as string as string, data);
      res.json(category);
    } catch (error: any) {
      if (error.message === 'CATEGORY_NOT_FOUND') {
        res.status(404).json({ error: { code: 'CATEGORY_NOT_FOUND', message: 'Categoria não encontrada' } });
      } else if (error.message === 'SLUG_ALREADY_EXISTS') {
        res.status(409).json({ error: { code: 'SLUG_ALREADY_EXISTS', message: 'Slug já está em uso' } });
      } else {
        res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: error.errors || error.message } });
      }
    }
  }

  static async delete(req: Request, res: Response) {
    try {
      await CategoriesService.deleteCategory(req.params.id as string as string);
      res.status(204).send();
    } catch (error: any) {
      if (error.message === 'CATEGORY_NOT_FOUND') {
        res.status(404).json({ error: { code: 'CATEGORY_NOT_FOUND', message: 'Categoria não encontrada' } });
      } else {
        res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: error.message } });
      }
    }
  }
}
