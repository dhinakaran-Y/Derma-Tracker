import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { AppError } from './errorMiddleware';
import { User } from '../models/User';
import { Patient } from '../models/Patient';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    role: string;
    type: 'staff' | 'patient';
    hospitalId?: string;
    fullName?: string;
  };
}

export async function authMiddleware(req: AuthRequest, _res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : undefined;
  const token = req.cookies?.token || bearerToken;

  if (!token) {
    return next(new AppError('Authentication required', 401, 'UNAUTHORIZED'));
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as {
      id: string;
      role: string;
      type: 'staff' | 'patient';
      hospitalId?: string;
      fullName?: string;
    };
    req.user = decoded;

    // Ensure hospitalId is always populated
    if (!req.user.hospitalId && req.user.id) {
      try {
        if (req.user.type === 'staff') {
          const u = await User.findById(req.user.id).select('hospitalId');
          if (u?.hospitalId) {
            req.user.hospitalId = u.hospitalId.toString();
          }
        } else if (req.user.type === 'patient') {
          const p = await Patient.findById(req.user.id).select('hospitalId');
          if (p?.hospitalId) {
            req.user.hospitalId = p.hospitalId.toString();
          }
        }
      } catch (dbErr) {
        // Non-blocking: continue with authenticated token payload even if DB is momentarily slow
      }
    }

    next();
  } catch {
    next(new AppError('Invalid or expired token', 401, 'INVALID_TOKEN'));
  }
}

export async function optionalAuth(req: AuthRequest, _res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : undefined;
  const token = req.cookies?.token || bearerToken;
  if (token) {
    try {
      const decoded = jwt.verify(token, env.JWT_SECRET) as {
        id: string;
        role: string;
        type: 'staff' | 'patient';
        hospitalId?: string;
      };
      req.user = decoded;
      if (!req.user.hospitalId && req.user.id) {
        if (req.user.type === 'staff') {
          const u = await User.findById(req.user.id).select('hospitalId');
          if (u?.hospitalId) req.user.hospitalId = u.hospitalId.toString();
        }
      }
    } catch {
      // Token invalid — continue without auth
    }
  }
  next();
}
