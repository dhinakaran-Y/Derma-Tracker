import { Response, NextFunction } from 'express';
import { AuthRequest } from './authMiddleware';
import { AppError } from './errorMiddleware';

export function requireRole(...roles: string[]) {
  return (req: AuthRequest, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
    }
    if (!roles.includes(req.user.role)) {
      throw new AppError('Insufficient permissions', 403, 'FORBIDDEN');
    }
    next();
  };
}

/** Convenience shortcuts */
export const adminOnly = requireRole('Admin');
export const receptionistOrAdmin = requireRole('Admin', 'Receptionist');
export const doctorOnly = requireRole('Doctor');
export const medicationGiverOrAdmin = requireRole('Admin', 'MedicationGiver');
export const stockManagerOrAdmin = requireRole('Admin', 'StockManager');
export const pharmacyViewers = requireRole('Admin', 'MedicationGiver', 'StockManager');
export const staffOnly = requireRole('Admin', 'Receptionist', 'Doctor', 'MedicationGiver', 'StockManager');
