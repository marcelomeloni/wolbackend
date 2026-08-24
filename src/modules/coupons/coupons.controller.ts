import { Request, Response } from 'express';
import { CouponsService } from './coupons.service';
import { couponSchema, validateCouponSchema } from './coupons.schema';

export class CouponsController {
  static async create(req: Request, res: Response) {
    try {
      const data = couponSchema.parse(req.body);
      const coupon = await CouponsService.createCoupon(data);
      res.status(201).json(coupon);
    } catch (error: any) {
      if (error.message === 'COUPON_ALREADY_EXISTS') {
        res.status(409).json({ error: { code: 'COUPON_ALREADY_EXISTS', message: 'Código de cupom já existe' } });
      } else {
        res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: error.errors || error.message } });
      }
    }
  }

  static async list(req: Request, res: Response) {
    try {
      const coupons = await CouponsService.listCoupons();
      res.json(coupons);
    } catch (error: any) {
      res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: error.message } });
    }
  }

  static async validate(req: Request, res: Response) {
    try {
      const data = validateCouponSchema.parse(req.body);
      const result = await CouponsService.validateCoupon(data);
      res.json(result);
    } catch (error: any) {
      if (error.message === 'INVALID_COUPON') {
        res.status(400).json({ error: { code: 'INVALID_COUPON', message: 'Cupom inválido ou inativo' } });
      } else if (error.message === 'EXPIRED_COUPON') {
        res.status(400).json({ error: { code: 'EXPIRED_COUPON', message: 'Cupom expirado' } });
      } else if (error.message === 'MIN_AMOUNT_NOT_REACHED') {
        res.status(400).json({ error: { code: 'MIN_AMOUNT_NOT_REACHED', message: 'Valor mínimo não atingido para este cupom' } });
      } else {
        res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: error.errors || error.message } });
      }
    }
  }
}
