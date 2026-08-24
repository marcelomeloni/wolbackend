import { Request, Response } from 'express';
import { ReviewsService } from './reviews.service';
import { reviewSchema } from './reviews.schema';

export class ReviewsController {
  static async add(req: Request, res: Response) {
    try {
      if (!req.user) throw new Error('UNAUTHORIZED');
      const data = reviewSchema.parse(req.body);
      const review = await ReviewsService.addReview(req.user.userId, data);
      res.status(201).json(review);
    } catch (error: any) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: error.errors || error.message } });
    }
  }

  static async listByProduct(req: Request, res: Response) {
    try {
      const reviews = await ReviewsService.getProductReviews(req.params.id as string as string);
      res.json(reviews);
    } catch (error: any) {
      res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: error.message } });
    }
  }

  static async delete(req: Request, res: Response) {
    try {
      await ReviewsService.deleteReview(req.params.id as string as string);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: error.message } });
    }
  }
}
