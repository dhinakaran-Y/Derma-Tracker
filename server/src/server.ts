import './config/asyncErrors';
import http from 'http';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './config/env';
import { connectDB, disconnectDB } from './config/db';
import { initSocket } from './config/socket';
import { generalLimiter } from './middleware/rateLimitMiddleware';
import { errorHandler, notFound } from './middleware/errorMiddleware';
import { authMiddleware } from './middleware/authMiddleware';
import { adminOnly } from './middleware/roleMiddleware';

// Route imports
import healthRoutes from './routes/healthRoutes';
import authRoutes from './routes/authRoutes';
import adminRoutes from './routes/adminRoutes';
import receptionistRoutes from './routes/receptionistRoutes';
import doctorRoutes from './routes/doctorRoutes';
import appointmentRoutes from './routes/appointmentRoutes';
import pharmacyRoutes from './routes/pharmacyRoutes';
import stockRoutes from './routes/stockRoutes';
import billingRoutes from './routes/billingRoutes';
import clientRoutes from './routes/clientRoutes';
import uploadRoutes from './routes/uploadRoutes';
import hospitalRoutes from './routes/hospitalRoutes';
import captureSessionRoutes from './routes/captureSessionRoutes';
import devicePairingRoutes from './routes/devicePairingRoutes';
import tunnelRoutes from './routes/tunnelRoutes';
import paymentRoutes from './routes/paymentRoutes';
import { tunnelManager } from './config/tunnelManager';
import { initWhatsApp, getWhatsAppStatus, getWhatsAppQr, triggerReconnect } from './services/whatsappService';

const app = express();
const server = http.createServer(app);

// CORS configuration supporting localhost, LAN IP, and public tunnels
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl, same-origin)
      if (!origin) return callback(null, true);
      return callback(null, true);
    },
    credentials: true,
  })
);

app.use(cookieParser());
app.use(express.json({
  limit: '25mb',
  // Stash raw body for Razorpay webhook HMAC verification
  verify: (req: any, _res, buf) => { req.rawBody = buf.toString(); },
}));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// API Router grouping all clinical ERP routes
const apiRouter = express.Router();
apiRouter.use(generalLimiter);

// Health check inside apiRouter
apiRouter.use('/', healthRoutes);

// Clinical ERP Feature Routes
apiRouter.use('/auth', authRoutes);
apiRouter.use('/hospitals', hospitalRoutes);
apiRouter.use('/admin', adminRoutes);
apiRouter.use('/receptionist', receptionistRoutes);
apiRouter.use('/doctor', doctorRoutes);
apiRouter.use('/capture-sessions', captureSessionRoutes);
apiRouter.use('/device-pairing', devicePairingRoutes);
apiRouter.use('/tunnel', tunnelRoutes);
apiRouter.use('/appointments', appointmentRoutes);
apiRouter.use('/pharmacy', pharmacyRoutes);
apiRouter.use('/stock', stockRoutes);
apiRouter.use('/billing', billingRoutes);
apiRouter.use('/client', clientRoutes);
apiRouter.use('/uploads', uploadRoutes);
apiRouter.use('/payment', paymentRoutes);

// WhatsApp admin endpoints — status is public for UI feature flags; QR and reconnect require Admin role
apiRouter.get('/whatsapp/status', (_req, res) => {
  res.json({ success: true, data: getWhatsAppStatus() });
});

apiRouter.get('/whatsapp/qr', authMiddleware, adminOnly, async (_req, res) => {
  const dataUrl = await getWhatsAppQr();
  if (!dataUrl) {
    res.json({ success: false, reason: 'No QR available — already connected or WhatsApp not initialised' });
    return;
  }
  res.json({ success: true, qr: dataUrl });
});

apiRouter.post('/whatsapp/reconnect', authMiddleware, adminOnly, (_req, res) => {
  triggerReconnect();
  res.json({ success: true, message: 'Reconnect triggered — check /api/whatsapp/status for QR in ~3s' });
});

// Root health check endpoint (e.g. http://localhost:5000/ and http://localhost:5000/health)
app.use('/', healthRoutes);

// Mount API routes at both /api (standard) and / (fallback for clients omitting /api prefix)
app.use('/api', apiRouter);
app.use('/', apiRouter);

// Catch 404 & Global Error Handling
app.use(notFound);
app.use(errorHandler);

// Initialize Socket.io (must be after express app is fully configured)
initSocket(server);

// Start Server
async function start() {
  await connectDB();

  const port = parseInt(env.PORT, 10) || 5000;
  server.listen(port, () => {
    console.log(`🚀 DermaTrack API Server running on port ${port} in ${env.NODE_ENV} mode`);
    console.log(`📡 Socket.io initialized with CORS origin: ${env.CLIENT_URL}`);

    // Initialise WhatsApp session in background (non-blocking)
    initWhatsApp().catch((err) =>
      console.error('❌ [WHATSAPP] Background init failed:', err?.message ?? err)
    );
  });
}

// Graceful Shutdown
const shutdown = async () => {
  console.log('\n🛑 Gracefully shutting down...');
  tunnelManager.stopTunnel();
  server.close(async () => {
    await disconnectDB();
    process.exit(0);
  });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

process.on('unhandledRejection', (reason: any) => {
  console.error('⚠️ [PROCESS] Unhandled Rejection:', reason);
});

process.on('uncaughtException', (err: any) => {
  console.error('⚠️ [PROCESS] Uncaught Exception:', err);
});

start().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
