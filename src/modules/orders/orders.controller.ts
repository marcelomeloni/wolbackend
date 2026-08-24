import { Request, Response } from 'express';
import { OrdersService } from './orders.service';
import { createOrderSchema, updateOrderStatusSchema } from './orders.schema';

export class OrdersController {
  static async create(req: Request, res: Response) {
    try {
      if (!req.user) throw new Error('UNAUTHORIZED');
      const data = createOrderSchema.parse(req.body);
      const order = await OrdersService.createOrder(req.user.userId, data);
      res.status(201).json(order);
    } catch (error: any) {
      res.status(400).json({ error: { code: 'ORDER_CREATION_FAILED', message: error.message } });
    }
  }

  static async listMyOrders(req: Request, res: Response) {
    try {
      if (!req.user) throw new Error('UNAUTHORIZED');
      const orders = await OrdersService.getOrders(req.user.userId);
      res.json(orders);
    } catch (error: any) {
      res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: error.message } });
    }
  }

  static async listAll(req: Request, res: Response) {
    try {
      if (!req.user || req.user.role !== 'ADMIN') throw new Error('UNAUTHORIZED');
      const orders = await OrdersService.getAllOrders();
      res.json(orders);
    } catch (error: any) {
      res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: error.message } });
    }
  }

  static async getById(req: Request, res: Response) {
    try {
      if (!req.user) throw new Error('UNAUTHORIZED');
      const isAdmin = req.user.role === 'ADMIN';
      const order = await OrdersService.getOrderById(req.user.userId, req.params.id as string as string, isAdmin);
      if (!order) {
        res.status(404).json({ error: { code: 'ORDER_NOT_FOUND', message: 'Pedido nÃ£o encontrado' } });
        return;
      }
      res.json(order);
    } catch (error: any) {
      res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: error.message } });
    }
  }

  static async updateStatus(req: Request, res: Response) {
    try {
      const data = updateOrderStatusSchema.parse(req.body);
      const order = await OrdersService.updateOrderStatus(req.params.id as string as string, data);
      res.json(order);
    } catch (error: any) {
      if (error.message === 'ORDER_NOT_FOUND') {
        res.status(404).json({ error: { code: 'ORDER_NOT_FOUND', message: 'Pedido nÃ£o encontrado' } });
      } else {
        res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: error.errors || error.message } });
      }
    }
  }
}

