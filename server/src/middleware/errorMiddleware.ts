import { Request, Response, NextFunction } from 'express';

export interface ApiErrorResponse {
  success: false;
  error: string;
  code: string;
}

export class AppError extends Error {
  statusCode: number;
  code: string;

  constructor(message: string, statusCode: number, code: string = 'ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      error: err.message,
      code: err.code,
    } as ApiErrorResponse);
    return;
  }

  // Handle MongoDB duplicate key error (E11000)
  if (err?.code === 11000 || err?.name === 'MongoServerError' && err?.code === 11000) {
    const keyPattern = err.keyPattern || err.keyValue || {};
    const field = Object.keys(keyPattern)[0] || 'field';
    const isPhone = field.toLowerCase().includes('phone');
    const message = isPhone
      ? 'A patient with this phone number is already registered'
      : `${field.charAt(0).toUpperCase() + field.slice(1)} already exists`;

    res.status(409).json({
      success: false,
      error: message,
      code: isPhone ? 'DUPLICATE_PHONE' : 'DUPLICATE_KEY',
      field,
    });
    return;
  }

  // Handle Mongoose Validation Error
  if (err?.name === 'ValidationError') {
    const messages = Object.values(err.errors || {}).map((e: any) => e.message);
    res.status(400).json({
      success: false,
      error: messages[0] || 'Validation error',
      details: messages,
      code: 'VALIDATION_ERROR',
    });
    return;
  }

  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    code: 'INTERNAL_ERROR',
  } as ApiErrorResponse);
}

export function notFound(_req: Request, _res: Response, next: NextFunction): void {
  next(new AppError('Route not found', 404, 'NOT_FOUND'));
}
