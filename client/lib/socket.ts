import { io, Socket } from 'socket.io-client';

/**
 * Known DermaTrack real-time event signatures
 */
export interface DermaSocketEvents {
  'queue:updated': (data?: { department?: string; doctorId?: string }) => void;
  'billing:updated': (data?: { invoiceId?: string; patientId?: string }) => void;
  'doctor:duty-changed': (data?: { doctorId: string; isOnDuty: boolean }) => void;
  'pairing:qr-scanned': (data: { pairingToken: string }) => void;
  'pairing:photo-captured': (data: { pairingToken: string; imageUrl: string }) => void;
  'stock:low': (data: { medicineId: string; currentStock: number; threshold: number }) => void;
  'notification:new': (data: { title: string; message: string; type?: 'info' | 'warning' | 'alert' }) => void;
}

let socket: Socket | null = null;

/**
 * Retrieve auth token from parameter, localStorage, or cookie
 */
function resolveAuthToken(explicitToken?: string): string {
  if (explicitToken) return explicitToken;
  if (typeof window === 'undefined') return '';

  // Check localStorage first
  const stored = localStorage.getItem('token');
  if (stored) return stored;

  // Fall back to reading token cookie if available
  const match = document.cookie.match(/(?:^|;\s*)token=([^;]+)/);
  return match ? match[1] : '';
}

/**
 * Singleton Socket.io client initializer
 * Lazily creates and configures the socket instance with reconnection handling and JWT auth
 */
export function getSocket(token?: string): Socket {
  const authToken = resolveAuthToken(token);

  if (!socket) {
    const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:5000';

    socket = io(SOCKET_URL, {
      withCredentials: true,
      auth: { token: authToken },
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      transports: ['websocket', 'polling'], // Prioritize websocket, fallback to polling
    });

    if (process.env.NODE_ENV !== 'production') {
      socket.on('connect', () => {
        console.log('⚡ [Socket] Connected to DermaTrack real-time server (id: ' + socket?.id + ')');
      });

      socket.on('disconnect', (reason) => {
        console.log('🔌 [Socket] Disconnected:', reason);
      });

      socket.on('connect_error', (err) => {
        console.warn('⚠️ [Socket] Connection error:', err.message);
      });

      socket.on('reconnect', (attemptNumber) => {
        console.log(`🔄 [Socket] Successfully reconnected after ${attemptNumber} attempts`);
      });

      socket.on('reconnect_attempt', (attemptNumber) => {
        console.log(`⏳ [Socket] Reconnect attempt #${attemptNumber}`);
      });
    }
  } else if (authToken && socket.auth && typeof socket.auth === 'object' && (socket.auth as any).token !== authToken) {
    // Auth token changed (e.g. login or switch account)
    (socket.auth as any).token = authToken;
    if (!socket.connected) {
      socket.connect();
    }
  }

  return socket;
}

/**
 * Check whether the singleton socket is currently connected
 */
export function isSocketConnected(): boolean {
  return socket !== null && socket.connected;
}

/**
 * Reconnect the singleton socket with optional updated token
 */
export function reconnectSocket(token?: string): Socket {
  const s = getSocket(token);
  if (!s.connected) {
    s.connect();
  }
  return s;
}

/**
 * Cleanly disconnect and destroy the singleton socket instance
 */
export function disconnectSocket(): void {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
}

export default getSocket;
