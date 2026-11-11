import { Request, Response } from 'express';
import { ShippingService } from './shipping.service';
import { shippingQuoteSchema } from './shipping.schema';

export class ShippingController {
  static async quote(req: Request, res: Response) {
    const data = shippingQuoteSchema.parse(req.body);
    const result = await ShippingService.quote(data, data.items);
    res.json(result);
  }
}
