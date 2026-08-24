import { Request, Response } from 'express';
import { NewsletterService } from './newsletter.service';
import { newsletterSchema } from './newsletter.schema';

export class NewsletterController {
  static async subscribe(req: Request, res: Response) {
    try {
      const data = newsletterSchema.parse(req.body);
      const sub = await NewsletterService.subscribe(data);
      res.status(201).json(sub);
    } catch (error: any) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: error.errors || error.message } });
    }
  }
}
