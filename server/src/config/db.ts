import mongoose from 'mongoose';
import { env } from './env';

const mongooseOptions: mongoose.ConnectOptions = {
  maxPoolSize: 10,
  minPoolSize: 2,
  serverSelectionTimeoutMS: 20000,
  socketTimeoutMS: 45000,
  connectTimeoutMS: 30000,
  family: 4, // Force IPv4 to prevent IPv6 DNS timeout glitches on Linux
  heartbeatFrequencyMS: 10000,
  retryWrites: true,
  retryReads: true,
};

let keepAliveInterval: NodeJS.Timeout | null = null;
let listenersAttached = false;
let isShuttingDown = false;
let reconnectTimer: NodeJS.Timeout | null = null;

function scheduleReconnect(delay = 5000) {
  if (isShuttingDown || reconnectTimer) return;

  reconnectTimer = setTimeout(async () => {
    reconnectTimer = null;
    // Only attempt manual reconnect if strictly disconnected (readyState === 0).
    // If readyState is 1 (connected) or 2 (connecting), Mongoose is already handling it.
    if (isShuttingDown || mongoose.connection.readyState !== 0) return;

    console.log('🔄 Attempting to re-establish MongoDB connection...');
    try {
      await mongoose.connect(env.MONGODB_URI, mongooseOptions);
      console.log('✅ MongoDB re-established successfully');
    } catch (err: any) {
      console.error('❌ MongoDB reconnect failed:', err.message);
      scheduleReconnect(Math.min(delay * 1.5, 20000));
    }
  }, delay);
}

function startKeepAlive() {
  if (keepAliveInterval) clearInterval(keepAliveInterval);
  // Send a lightweight ping every 45 seconds to keep the Atlas connection active
  // and prevent AWS/Atlas load balancers from killing idle sockets.
  keepAliveInterval = setInterval(async () => {
    if (mongoose.connection.readyState === 1 && mongoose.connection.db) {
      try {
        await mongoose.connection.db.admin().ping();
      } catch {
        // Ping error will be handled by connection event listeners
      }
    }
  }, 45000);
}

function attachListeners() {
  if (listenersAttached) return;
  listenersAttached = true;

  mongoose.connection.on('connected', () => {
    console.log('✅ MongoDB connected');
    startKeepAlive();
  });

  mongoose.connection.on('reconnected', () => {
    console.log('🔄 MongoDB reconnected');
    startKeepAlive();
  });

  mongoose.connection.on('error', (err: any) => {
    console.error('❌ MongoDB error:', err?.message || err);
    if (mongoose.connection.readyState === 0) {
      scheduleReconnect();
    }
  });

  mongoose.connection.on('disconnected', () => {
    if (!isShuttingDown) {
      console.warn('⚠️  MongoDB disconnected. Will automatically reconnect...');
      scheduleReconnect();
    }
  });
}

export async function connectDB(retries = 5, delay = 3000): Promise<void> {
  isShuttingDown = false;
  attachListeners();

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await mongoose.connect(env.MONGODB_URI, mongooseOptions);
      break;
    } catch (err) {
      console.error(`❌ MongoDB connection attempt ${attempt}/${retries} failed:`, err);
      if (attempt === retries) {
        console.error('❌ All MongoDB connection attempts failed.');
        process.exit(1);
      }
      console.log(`⏳ Retrying MongoDB connection in ${delay / 1000}s...`);
      await new Promise((res) => setTimeout(res, delay));
    }
  }
}

export async function disconnectDB(): Promise<void> {
  isShuttingDown = true;
  if (keepAliveInterval) {
    clearInterval(keepAliveInterval);
    keepAliveInterval = null;
  }
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  await mongoose.connection.close();
  console.log('MongoDB connection closed');
}
