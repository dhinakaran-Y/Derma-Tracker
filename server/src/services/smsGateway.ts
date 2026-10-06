import { env } from '../config/env';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SmsGatewayRecipient {
  phoneNumber: string;
  state: string;
}

interface SmsGatewayResponse {
  id: string;
  deviceId: string;
  state: 'Pending' | 'Processed' | 'Sent' | 'Delivered' | 'Failed';
  recipients: SmsGatewayRecipient[];
  textMessage: { text: string };
}

export interface SmsSendResult {
  success: boolean;
  messageId?: string;
  state?: string;
  error?: string;
}

// ─── Configuration ─────────────────────────────────────────────────────────────

const ENDPOINT = `${env.SMS_GATEWAY_URL}/message`;
const MAX_RETRIES = 2;
const TIMEOUT_MS = 15000;

// ─── Core sender ──────────────────────────────────────────────────────────────

/**
 * Sends a single SMS via your Android SMS Gateway (capcom6/android-sms-gateway).
 * The phone running the gateway must be on the same Wi-Fi network as the server.
 *
 * @param toPhone  - recipient phone in E.164 format  e.g. "+916379743592"
 * @param message  - plain-text body of the SMS
 * @returns SmsSendResult
 */
export async function sendSms(toPhone: string, message: string): Promise<SmsSendResult> {
  // ── Dev shortcut: if no credentials configured, just log the OTP ────────────
  if (!env.SMS_GATEWAY_USERNAME || !env.SMS_GATEWAY_PASSWORD) {
    console.log(`📱 [SMS-GATEWAY] DEV MODE — No credentials. Would send to ${toPhone}: "${message}"`);
    return { success: true, messageId: 'dev-mode', state: 'Pending' };
  }

  const basicAuth = Buffer.from(`${env.SMS_GATEWAY_USERNAME}:${env.SMS_GATEWAY_PASSWORD}`).toString('base64');
  const body = JSON.stringify({ phoneNumbers: [toPhone], message });

  for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${basicAuth}`,
        },
        body,
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!response.ok) {
        const text = await response.text().catch(() => response.statusText);
        throw new Error(`Gateway returned HTTP ${response.status}: ${text}`);
      }

      const data = (await response.json()) as SmsGatewayResponse;
      console.log(`✅ [SMS-GATEWAY] SMS queued for ${toPhone} — id=${data.id} state=${data.state}`);

      return {
        success: true,
        messageId: data.id,
        state: data.state,
      };
    } catch (err: any) {
      const isLastAttempt = attempt > MAX_RETRIES;
      const errorMsg = err?.name === 'AbortError' ? 'Request timed out' : (err?.message ?? 'Unknown error');

      if (isLastAttempt) {
        console.error(`❌ [SMS-GATEWAY] Failed to send SMS to ${toPhone} after ${attempt} attempt(s): ${errorMsg}`);
        return { success: false, error: errorMsg };
      }

      console.warn(`⚠️  [SMS-GATEWAY] Attempt ${attempt} failed (${errorMsg}). Retrying…`);
      await sleep(1000 * attempt); // back-off: 1 s, 2 s
    }
  }

  // Unreachable — TypeScript needs this
  return { success: false, error: 'Exhausted retries' };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
