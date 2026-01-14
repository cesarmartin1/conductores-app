import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import db, { Usuario } from '../models/database';

const JWT_SECRET = process.env.JWT_SECRET || 'conductores-app-secret-key-2024';

export interface AuthRequest extends Request {
  user?: {
    id: number;
    email: string;
    nombre: string;
    rol: 'admin' | 'supervisor' | 'conductor';
    conductorId: number | null;
  };
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token no proporcionado' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    const user = db.prepare('SELECT * FROM usuarios WHERE id = ? AND activo = 1').get(decoded.id) as Usuario | undefined;

    if (!user) {
      return res.status(401).json({ error: 'Usuario no encontrado o inactivo' });
    }

    req.user = {
      id: user.id,
      email: user.email,
      nombre: user.nombre,
      rol: user.rol,
      conductorId: user.conductor_id
    };

    next();
  } catch (error) {
    return res.status(401).json({ error: 'Token inválido' });
  }
}

// Middleware para verificar roles
export function requireRole(...roles: Array<'admin' | 'supervisor' | 'conductor'>) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    if (!roles.includes(req.user.rol)) {
      return res.status(403).json({ error: 'No tienes permisos para esta acción' });
    }

    next();
  };
}

// Generar token JWT
export function generateToken(user: Usuario): string {
  return jwt.sign(
    { id: user.id, email: user.email, rol: user.rol },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}
