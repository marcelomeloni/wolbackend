import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

interface AuthPayload {
  userId: string;
  role: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

export const authMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Token is missing' } });
    return;
  }

  const [, token] = authHeader.split(' ');

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret') as AuthPayload;
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Invalid token' } });
    return;
  }
};

export const adminMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  if (req.user?.role !== 'admin' && req.user?.role !== 'ADMIN') {
    res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Admin privileges required' } });
    return;
  }
  next();
};
