/**
 * otpDispatcher.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Unified OTP delivery router.
 * Routes OTP messages to either:
 *   - SMS    → Android SMS Gateway (smsGateway.ts)
 *   - whatsapp → Baileys WhatsApp session (whatsappService.ts)
 *
 * Usage:
 *   const result = await dispatchOtp({ phone: '+916379743592', otp: '482910', channel: 'sms' });
 */

import { sendSms } from './smsGateway';
import { sendWhatsApp } from './whatsappService';

// ─── Types ────────────────────────────────────────────────────────────────────

export type OtpChannel = 'sms' | 'whatsapp';

export interface DispatchOtpOptions {
  phone: string;     // E.164 format e.g. "+916379743592" or bare "6379743592"
  otp: string;       // 6-digit code
  channel: OtpChannel;
}

export interface DispatchOtpResult {
  success: boolean;
  channel: OtpChannel;      // actual channel used (may differ if fallback occurred)
  messageId?: string;
  error?: string;
  fallback?: boolean;       // true if WhatsApp fell back to SMS
}

// ─── Message templates ────────────────────────────────────────────────────────

function buildMessage(otp: string, channel: OtpChannel): string {
  if (channel === 'whatsapp') {
    return (
      `🏥 *DermaTrack Clinic*\n\n` +
      `Your login verification code is:\n\n` +
      `*${otp}*\n\n` +
      `⏱ Valid for *5 minutes*. Do not share this code with anyone.`
    );
  }
  // SMS — keep it short, no special characters
  return `DermaTrack OTP: ${otp}. Valid for 5 min. Do not share.`;
}

// ─── Core dispatcher ──────────────────────────────────────────────────────────

/**
 * Dispatch an OTP to a patient via their chosen channel.
 * Normalises phone to E.164 before sending.
 */
export async function dispatchOtp(options: DispatchOtpOptions): Promise<DispatchOtpResult> {
  const { otp, channel } = options;

  // Normalise to E.164  (add +91 prefix for bare 10-digit Indian numbers)
  const phone = normalisePhone(options.phone);
  const message = buildMessage(otp, channel);

  console.log(`📤 [OTP-DISPATCH] Sending ${channel.toUpperCase()} OTP to ${phone}`);

  if (channel === 'sms') {
    const result = await sendSms(phone, message);
    return {
      success: result.success,
      channel: 'sms',
      messageId: result.messageId,
      error: result.error,
    };
  }

  if (channel === 'whatsapp') {
    const result = await sendWhatsApp(phone, message);

    // ── OPT 3: Auto-fallback to SMS if WhatsApp is unavailable ───────────────
    if (!result.success) {
      console.warn(`⚠️  [OTP-DISPATCH] WhatsApp failed (${result.error}). Auto-falling back to SMS…`);
      const smsMessage = buildMessage(otp, 'sms');
      const smsFallback = await sendSms(phone, smsMessage);
      return {
        success: smsFallback.success,
        channel: 'sms',         // report actual delivery channel
        messageId: smsFallback.messageId,
        error: smsFallback.success ? undefined : smsFallback.error,
        fallback: true,          // signals that we fell back from WA → SMS
      };
    }

    return {
      success: true,
      channel: 'whatsapp',
      messageId: result.messageId,
    };
  }

  return {
    success: false,
    channel,
    error: `Unknown OTP channel: "${channel}"`,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalisePhone(phone: string): string {
  const digits = phone.replace(/\D/g, ''); // strip all non-digits first
  if (digits.length === 10) return `+91${digits}`; // bare Indian number
  if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`; // 91XXXXXXXXXX
  return `+${digits}`; // fallback
}
