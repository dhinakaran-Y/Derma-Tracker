import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import { env } from '../config/env';

const router = Router();

const getHealthStatus = () => {
  const isDbConnected = mongoose.connection.readyState === 1;
  return {
    success: true,
    service: 'DermaTrack Clinical ERP Backend Server',
    status: 'ONLINE & OPERATIONAL',
    port: parseInt(env.PORT, 10) || 5000,
    environment: env.NODE_ENV,
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    database: {
      status: isDbConnected ? 'CONNECTED' : 'DISCONNECTED',
      readyState: mongoose.connection.readyState,
    },
    clientUrl: env.CLIENT_URL,
    message: `✅ DermaTrack API is running and healthy on port ${env.PORT || 5000}!`,
    endpoints: {
      health: '/api/health',
      auth: '/api/auth',
      hospitals: '/api/hospitals',
      receptionist: '/api/receptionist',
      doctor: '/api/doctor',
      appointments: '/api/appointments',
      billing: '/api/billing',
      pharmacy: '/api/pharmacy',
      stock: '/api/stock',
      admin: '/api/admin',
    },
  };
};

// Root endpoint: http://localhost:5000/
router.get('/', (_req: Request, res: Response) => {
  res.json(getHealthStatus());
});

// Health check endpoint: http://localhost:5000/health and http://localhost:5000/api/health
router.get('/health', (_req: Request, res: Response) => {
  res.json(getHealthStatus());
});

export default router;
