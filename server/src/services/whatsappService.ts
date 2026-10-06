/**
 * whatsappService.ts
 * ──────────────────────────────────────────────────────────────────────────────
 * Manages a persistent Baileys (WhatsApp Web) socket session.
 *
 * HOW IT WORKS:
 *  1. Call initWhatsApp() once when the server starts (if WHATSAPP_ENABLED=true).
 *  2. On first run → Baileys prints a QR code in your terminal.
 *  3. Open WhatsApp on your clinic phone → Linked Devices → Link a Device → scan QR.
 *  4. Session is saved to MongoDB (whatsapp_sessions collection) and auto-restores on restart.
 *  5. Call sendWhatsApp(phone, message) from anywhere to send a WhatsApp message.
 */

import { env } from '../config/env';
import { useMongoDBAuthState } from './mongoAuthState';

// ─── State ─────────────────────────────────────────────────────────────────────

let waSocket: any = null;       // Active Baileys socket
let isConnected = false;        // Whether WA is currently connected
let isInitializing = false;     // Prevents concurrent init calls
let qrPrinted = false;          // Only print QR once per session attempt
let reconnectAttempts = 0;      // Tracks consecutive reconnect attempts for back-off
let lastQrString: string | null = null;  // Raw QR data to serve to the admin UI



// ─── Public API ────────────────────────────────────────────────────────────────

export interface WhatsAppSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Initialise the WhatsApp Baileys session.
 * Call this once from server.ts during startup (non-blocking).
 */
export async function initWhatsApp(): Promise<void> {
  if (env.WHATSAPP_ENABLED !== 'true') {
    console.log('ℹ️  [WHATSAPP] WHATSAPP_ENABLED=false — skipping WhatsApp initialisation');
    return;
  }

  if (isInitializing || isConnected) return;
  isInitializing = true;
  qrPrinted = false;

  // isInitializing is intentionally NOT reset here — it is reset inside
  // the 'connection.update' event handler once the socket actually opens
  // or definitively closes. This prevents a race where a second init call
  // sneaks in while we are still waiting for the WA handshake.
  _connect().catch((err: any) => {
    console.error('❌ [WHATSAPP] Init failed:', err?.message ?? err);
    isInitializing = false; // reset only on hard failure
  });
}

/**
 * Send a WhatsApp message to a phone number.
 *
 * @param toPhone  E.164 format — e.g. "+916379743592"
 * @param message  Plain-text message body
 */
export async function sendWhatsApp(toPhone: string, message: string): Promise<WhatsAppSendResult> {
  if (env.WHATSAPP_ENABLED !== 'true') {
    console.log(`📱 [WHATSAPP] DISABLED — Would send to ${toPhone}: "${message}"`);
    return { success: false, error: 'WhatsApp is not enabled on this server' };
  }

  if (!isConnected || !waSocket) {
    console.error('❌ [WHATSAPP] Socket not connected. Cannot send message.');
    return { success: false, error: 'WhatsApp session not connected. Please scan the QR code.' };
  }

  try {
    // Baileys JID format: pure digits, append '@s.whatsapp.net'
    const digits = toPhone.replace(/\D/g, '');
    const jid = `${digits}@s.whatsapp.net`;

    const result = await waSocket.sendMessage(jid, { text: message });
    const messageId = result?.key?.id ?? 'unknown';

    console.log(`✅ [WHATSAPP] Message sent to ${toPhone} — id=${messageId}`);
    return { success: true, messageId };
  } catch (err: any) {
    console.error(`❌ [WHATSAPP] Failed to send to ${toPhone}:`, err?.message ?? err);
    return { success: false, error: err?.message ?? 'Unknown error' };
  }
}

/**
 * Returns current WhatsApp connection status.
 */
export function getWhatsAppStatus(): { connected: boolean; enabled: boolean; hasQr: boolean } {
  return {
    connected: isConnected,
    enabled: env.WHATSAPP_ENABLED === 'true',
    hasQr: !!lastQrString && !isConnected,  // QR available and not yet connected
  };
}

/**
 * Returns the current QR code as a PNG data-URL (base64).
 * Returns null if no QR is pending (already connected or not initialised).
 */
export async function getWhatsAppQr(): Promise<string | null> {
  if (!lastQrString || isConnected) return null;
  try {
    // Dynamic import — qrcode is a CJS module, import lazily to avoid startup cost
    const QRCode = await import('qrcode');
    const dataUrl = await QRCode.toDataURL(lastQrString, {
      width: 280,
      margin: 2,
      color: { dark: '#1a1a1a', light: '#ffffff' },
    });
    return dataUrl;
  } catch (err: any) {
    console.error('[WHATSAPP] QR generation failed:', err?.message ?? err);
    return null;
  }
}

/**
 * Force a fresh connection attempt (useful from admin UI without server restart).
 */
export function triggerReconnect(): void {
  if (isInitializing || isConnected) return;
  lastQrString = null;
  reconnectAttempts = 0;
  initWhatsApp().catch(() => {});
}

// ─── Internal: Connect / Reconnect ────────────────────────────────────────────

async function _connect(): Promise<void> {
  // Baileys is ESM-only in v7 — use dynamic import to stay compatible with CJS server
  const {
    default: makeWASocket,
    DisconnectReason,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
  } = await import('@whiskeysockets/baileys' as any);

  const { state, saveCreds } = await useMongoDBAuthState();
  const { version } = await fetchLatestBaileysVersion();

  console.log(`🔗 [WHATSAPP] Connecting with WA version ${version.join('.')}`);

  const pino = require('pino');
  const logger = pino({ level: 'silent' });

  const sock = makeWASocket({
    version,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, logger),
    },
    logger,
    printQRInTerminal: true,   // prints scannable QR directly in your terminal
    syncFullHistory: false,
    markOnlineOnConnect: false,
    generateHighQualityLinkPreview: false,
    browser: ['DermaTrack', 'Chrome', '120.0.0'],
  });

  waSocket = sock;

  // ── Credentials update ────────────────────────────────────────────────────
  sock.ev.on('creds.update', saveCreds);

  // ── Connection state ──────────────────────────────────────────────────────
  sock.ev.on('connection.update', async (update: any) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      lastQrString = qr;  // always capture latest QR (Baileys may refresh it)
      if (!qrPrinted) {
        qrPrinted = true;
        console.log('\n');
        console.log('╔══════════════════════════════════════════════════════╗');
        console.log('║  📱  WHATSAPP QR CODE — Scan with WhatsApp           ║');
        console.log('║  Browser UI: http://localhost:3000/admin/whatsapp    ║');
        console.log('║  Open WhatsApp → Linked Devices → Link a Device     ║');
        console.log('╚══════════════════════════════════════════════════════╝');
      }
    }

    if (connection === 'open') {
      isConnected = true;
      isInitializing = false;  // connection confirmed open — safe to clear
      reconnectAttempts = 0;   // reset back-off counter
      lastQrString = null;     // QR no longer needed — clear it
      console.log('✅ [WHATSAPP] Connected and ready to send messages!');
    }

    if (connection === 'close') {
      isConnected = false;
      isInitializing = false;
      waSocket = null;

      const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

      console.warn(`⚠️  [WHATSAPP] Connection closed (code=${statusCode}). Reconnect=${shouldReconnect}`);

      if (shouldReconnect) {
        reconnectAttempts += 1;
        // Exponential back-off: 3s, 6s, 12s … capped at 30s
        const delay = Math.min(3000 * reconnectAttempts, 30000);
        console.log(`🔄 [WHATSAPP] Reconnecting in ${delay / 1000}s (attempt ${reconnectAttempts})…`);
        await _sleep(delay);
        await initWhatsApp();
      } else {
        console.error('🔴 [WHATSAPP] Logged out — clear the whatsapp_sessions collection in MongoDB and restart server to re-link.');
      }
    }
  });
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function _sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
