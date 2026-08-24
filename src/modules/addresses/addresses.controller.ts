import { Request, Response } from 'express';
import { AddressesService } from './addresses.service';
import { addressSchema } from './addresses.schema';

export class AddressesController {
  static async create(req: Request, res: Response) {
    try {
      if (!req.user) throw new Error('UNAUTHORIZED');
      const data = addressSchema.parse(req.body);
      const address = await AddressesService.createAddress(req.user.userId, data);
      res.status(201).json(address);
    } catch (error: any) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: error.errors || error.message } });
    }
  }

  static async list(req: Request, res: Response) {
    try {
      if (!req.user) throw new Error('UNAUTHORIZED');
      const addresses = await AddressesService.getAddresses(req.user.userId);
      res.json(addresses);
    } catch (error: any) {
      res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: error.message } });
    }
  }

  static async update(req: Request, res: Response) {
    try {
      if (!req.user) throw new Error('UNAUTHORIZED');
      const data = addressSchema.parse(req.body);
      const address = await AddressesService.updateAddress(req.user.userId, req.params.id as string as string, data);
      res.json(address);
    } catch (error: any) {
      if (error.message === 'ADDRESS_NOT_FOUND') {
        res.status(404).json({ error: { code: 'ADDRESS_NOT_FOUND', message: 'Endereço não encontrado' } });
      } else {
        res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: error.errors || error.message } });
      }
    }
  }

  static async delete(req: Request, res: Response) {
    try {
      if (!req.user) throw new Error('UNAUTHORIZED');
      await AddressesService.deleteAddress(req.user.userId, req.params.id as string as string);
      res.status(204).send();
    } catch (error: any) {
      if (error.message === 'ADDRESS_NOT_FOUND') {
        res.status(404).json({ error: { code: 'ADDRESS_NOT_FOUND', message: 'Endereço não encontrado' } });
      } else {
        res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: error.message } });
      }
    }
  }
}
