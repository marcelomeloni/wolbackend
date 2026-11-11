import { Request, Response } from 'express';
import { OrdersService } from './orders.service';
import { createOrderSchema, updateOrderStatusSchema } from './orders.schema';
import { AppError } from '../../middlewares/errorHandler';

const isAdminRole = (role?: string) => role === 'ADMIN' || role === 'admin';

export class OrdersController {
  static async create(req: Request, res: Response) {
    if (!req.user) throw new AppError('Não autenticado', 401, 'UNAUTHORIZED');
    const data = createOrderSchema.parse(req.body);
    const order = await OrdersService.createOrder(req.user.userId, data);
    res.status(201).json(order);
  }

  static async listMyOrders(req: Request, res: Response) {
    if (!req.user) throw new AppError('Não autenticado', 401, 'UNAUTHORIZED');
    const orders = await OrdersService.getOrders(req.user.userId);
    res.json(orders);
  }

  static async listAll(req: Request, res: Response) {
    if (!req.user || !isAdminRole(req.user.role)) {
      throw new AppError('Acesso restrito a administradores', 403, 'FORBIDDEN');
    }
    const orders = await OrdersService.getAllOrders();
    res.json(orders);
  }

  static async getById(req: Request, res: Response) {
    if (!req.user) throw new AppError('Não autenticado', 401, 'UNAUTHORIZED');
    const isAdmin = isAdminRole(req.user.role);
    const order = await OrdersService.getOrderById(req.user.userId, req.params.id as string, isAdmin);
    if (!order) throw new AppError('Pedido não encontrado', 404, 'ORDER_NOT_FOUND');
    res.json(order);
  }

  static async updateStatus(req: Request, res: Response) {
    if (!req.user || !isAdminRole(req.user.role)) {
      throw new AppError('Acesso restrito a administradores', 403, 'FORBIDDEN');
    }
    const data = updateOrderStatusSchema.parse(req.body);
    const order = await OrdersService.updateOrderStatus(req.params.id as string, data);
    res.json(order);
  }
}
