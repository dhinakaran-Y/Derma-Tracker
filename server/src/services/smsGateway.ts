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

const MAX_RETRIES = 2;
const TIMEOUT_MS = 15000;

/**
 * Resolves whether the gateway URL is using the Cloud server (api.sms-gate.app)
 * or a local private Wi-Fi server (http://<ip>:8080).
 */
export function resolveGatewayConfig(url: string) {
  let cleaned = (url || '').trim().replace(/\/+$/, '');
  if (!cleaned.startsWith('http://') && !cleaned.startsWith('https://')) {
    cleaned = `https://${cleaned}`;
  }

  const isCloud = cleaned.includes('sms-gate.app') || cleaned.includes('3rdparty');

  let endpoint = cleaned;
  if (isCloud) {
    endpoint = endpoint.replace(':443', '');
    if (!endpoint.includes('/3rdparty/v1/messages')) {
      endpoint = `${endpoint}/3rdparty/v1/messages`;
    }
  } else {
    if (!endpoint.endsWith('/message')) {
      endpoint = `${endpoint}/message`;
    }
  }

  return { isCloud, endpoint };
}

// ─── Core sender ──────────────────────────────────────────────────────────────

/**
 * Sends a single SMS via Android SMS Gateway (capcom6/android-sms-gateway).
 * Supports both:
 *   1. Cloud server (api.sms-gate.app) - Works anywhere on deployed cloud servers.
 *   2. Local server (http://<phone-ip>:8080) - Works on local Wi-Fi during local dev.
 *
 * @param toPhone  - recipient phone in E.164 format  e.g. "+917806964630"
 * @param message  - plain-text body of the SMS
 * @returns SmsSendResult
 */
export async function sendSms(toPhone: string, message: string): Promise<SmsSendResult> {
  // ── Dev shortcut: if no credentials configured, just log the OTP ────────────
  if (!env.SMS_GATEWAY_USERNAME || !env.SMS_GATEWAY_PASSWORD) {
    console.log(`📱 [SMS-GATEWAY] DEV MODE — No credentials. Would send to ${toPhone}: "${message}"`);
    return { success: true, messageId: 'dev-mode', state: 'Pending' };
  }

  const { isCloud, endpoint } = resolveGatewayConfig(env.SMS_GATEWAY_URL);
  const basicAuth = Buffer.from(`${env.SMS_GATEWAY_USERNAME}:${env.SMS_GATEWAY_PASSWORD}`).toString('base64');

  // Cloud API expects { textMessage: { text }, phoneNumbers, deviceId? }
  // Local API expects { phoneNumbers, message }
  const body = isCloud
    ? JSON.stringify({
        textMessage: { text: message },
        phoneNumbers: [toPhone],
        ...(env.SMS_GATEWAY_DEVICE_ID ? { deviceId: env.SMS_GATEWAY_DEVICE_ID } : {}),
      })
    : JSON.stringify({
        phoneNumbers: [toPhone],
        message,
      });

  console.log(`📱 [SMS-GATEWAY] Dispatching SMS via ${isCloud ? 'Cloud' : 'Local'} Gateway (${endpoint}) to ${toPhone}`);

  for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

      const response = await fetch(endpoint, {
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

      const data = (await response.json().catch(() => ({}))) as any;
      const messageId = data?.id || 'queued';
      const state = data?.state || 'Pending';
      console.log(`✅ [SMS-GATEWAY] SMS queued for ${toPhone} — id=${messageId} state=${state}`);

      return {
        success: true,
        messageId,
        state,
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
