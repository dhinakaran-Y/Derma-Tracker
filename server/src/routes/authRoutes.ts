import { Router, Response } from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { env } from '../config/env';
import { User } from '../models/User';
import { Patient } from '../models/Patient';
import { OTP } from '../models/OTP';
import { AuthRequest, authMiddleware } from '../middleware/authMiddleware';
import { validate } from '../middleware/validateMiddleware';
import { loginLimiter, otpLimiter } from '../middleware/rateLimitMiddleware';
import { AppError } from '../middleware/errorMiddleware';
import { dispatchOtp, OtpChannel } from '../services/otpDispatcher';

const router = Router();

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: (env.NODE_ENV === 'production' ? 'none' : 'lax') as 'none' | 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  path: '/',
};

// --- Staff Login ---
const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

router.post('/staff/login', loginLimiter, validate(loginSchema), async (req: AuthRequest, res: Response) => {
  const { username, password } = req.body;
  const cleanIdentifier = username.trim();
  const escaped = cleanIdentifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  console.log(`\n🔑 [AUTH] Login attempt for identifier: "${cleanIdentifier}"`);

  const user = await User.findOne({
    $or: [
      { username: { $regex: new RegExp(`^${escaped}$`, 'i') } },
      { email: { $regex: new RegExp(`^${escaped}$`, 'i') } },
    ],
    status: 'Active',
  });

  if (!user) {
    console.warn(`❌ [AUTH] No active user found matching "${cleanIdentifier}"`);
    throw new AppError(
      env.NODE_ENV === 'development'
        ? `No account found with username or email "${cleanIdentifier}"`
        : 'Invalid credentials',
      401,
      'INVALID_CREDENTIALS'
    );
  }

  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    console.warn(`❌ [AUTH] Incorrect password for user: "${user.username}"`);
    throw new AppError(
      env.NODE_ENV === 'development'
        ? 'Incorrect password'
        : 'Invalid credentials',
      401,
      'INVALID_CREDENTIALS'
    );
  }

  console.log(`✅ [AUTH] Login successful for "${user.username}" (${user.role})`);

  const token = jwt.sign(
    { id: user._id, role: user.role, type: 'staff', hospitalId: user.hospitalId, fullName: user.fullName },
    env.JWT_SECRET,
    { expiresIn: '7d' }
  );

  const { Hospital } = await import('../models/Hospital');
  let hospital = null;
  if (user.hospitalId) {
    hospital = await Hospital.findById(user.hospitalId);
  }
  if (!hospital) {
    hospital = await Hospital.findOne({ status: 'Active' });
  }

  res.cookie('token', token, COOKIE_OPTIONS);
  res.json({
    success: true,
    data: {
      user: user.toJSON(),
      hospital,
      token, // Also return token for socket auth
    },
  });
});

// --- Patient OTP Send ---
const sendOtpSchema = z.object({
  phone: z.string().min(10).max(15),
  channel: z.enum(['sms', 'whatsapp']).default('sms'),
});

router.post('/otp/send', otpLimiter, validate(sendOtpSchema), async (req: AuthRequest, res: Response) => {
  const { phone } = req.body;
  const channel: OtpChannel = req.body.channel ?? 'sms';

  // Check if patient exists
  const patient = await Patient.findOne({ phone, isActive: true });
  if (!patient) throw new AppError('No patient found with this phone number', 404, 'PATIENT_NOT_FOUND');

  const existing = await OTP.findOne({ phone });

  // 1. Check account lockout (15-min lockout after 5 failed attempts)
  if (existing?.lockedUntil && existing.lockedUntil > new Date()) {
    const remainingMins = Math.max(1, Math.ceil((existing.lockedUntil.getTime() - Date.now()) / (60 * 1000)));
    throw new AppError(`Account temporarily locked due to repeated failed attempts. Please try again in ${remainingMins} minute${remainingMins === 1 ? '' : 's'}.`, 429, 'OTP_LOCKED');
  }

  // 2. Per-phone rate limit: maximum 3 requests within a rolling 10-minute window
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
  let requestCount = 1;
  let firstRequestedAt = new Date();

  if (existing && existing.firstRequestedAt && existing.firstRequestedAt > tenMinutesAgo) {
    if (existing.requestCount >= 3) {
      const waitMins = Math.max(1, Math.ceil((existing.firstRequestedAt.getTime() + 10 * 60 * 1000 - Date.now()) / (60 * 1000)));
      throw new AppError(`Too many OTP requests for this phone number. Maximum 3 requests allowed per 10 minutes. Please try again in ${waitMins} minute${waitMins === 1 ? '' : 's'}.`, 429, 'OTP_RATE_LIMITED');
    }
    requestCount = (existing.requestCount || 1) + 1;
    firstRequestedAt = existing.firstRequestedAt;
  }

  // 3. OTP generation: HARDCODE_DEV_OTP=true forces 123456 for quick testing;
  //    otherwise always use cryptographically secure CSPRNG regardless of NODE_ENV.
  const useHardcoded = env.HARDCODE_DEV_OTP === 'true';
  const otp = useHardcoded
    ? '123456'
    : crypto.randomInt(100000, 1000000).toString();

  // Upsert OTP with tracking metadata — store channel for audit trail
  await OTP.findOneAndUpdate(
    { phone },
    {
      otp,
      channel,        // OPT 1: persist chosen delivery channel
      attempts: 0,
      requestCount,
      firstRequestedAt,
      lockedUntil: undefined,
      createdAt: new Date(),
    },
    { upsert: true, new: true }
  );

  console.log(`📱 [SECURE OTP] OTP for ${phone} via ${channel}${useHardcoded ? ' [HARDCODED]' : ' [CSPRNG]'}: ${otp}`);

  // ── Dispatch OTP via chosen channel (SMS or WhatsApp) ────────────────────
  const dispatchResult = await dispatchOtp({ phone, otp, channel });

  if (!dispatchResult.success && !dispatchResult.fallback) {
    console.error(`❌ [AUTH] OTP dispatch failed via ${channel} to ${phone}: ${dispatchResult.error}`);
    if (env.NODE_ENV === 'production' && !useHardcoded) {
      throw new AppError('Failed to send OTP. Please try again.', 503, 'OTP_DELIVERY_FAILED');
    }
    console.warn(`⚠️  [AUTH] DEV: OTP delivery failed. Use devOtp from response.`);
  }

  // Actual delivery channel may differ from requested if WhatsApp fell back to SMS
  const deliveredVia = dispatchResult.channel;

  res.json({
    success: true,
    message: `OTP sent via ${deliveredVia}`,
    channel: deliveredVia,
    ...(dispatchResult.fallback ? { fallback: true, fallbackReason: 'WhatsApp unavailable — sent via SMS instead' } : {}),
    ...(useHardcoded ? { devOtp: otp } : {}),
  });
});

// --- Patient OTP Verify ---
const verifyOtpSchema = z.object({
  phone: z.string().min(10).max(15),
  otp: z.string().length(6),
});

router.post('/otp/verify', validate(verifyOtpSchema), async (req: AuthRequest, res: Response) => {
  const { phone, otp } = req.body;

  const otpRecord = await OTP.findOne({ phone });
  if (!otpRecord) throw new AppError('OTP expired or not found. Please request a new code.', 400, 'OTP_EXPIRED');

  // Check 15-minute lockout
  if (otpRecord.lockedUntil && otpRecord.lockedUntil > new Date()) {
    const remainingMins = Math.max(1, Math.ceil((otpRecord.lockedUntil.getTime() - Date.now()) / (60 * 1000)));
    throw new AppError(`Account locked due to 5 consecutive failed attempts. Try again in ${remainingMins} minute${remainingMins === 1 ? '' : 's'}.`, 429, 'OTP_LOCKED');
  }

  // Check 5-minute validity window
  const fiveMinutesMs = 5 * 60 * 1000;
  if (Date.now() - new Date(otpRecord.createdAt).getTime() > fiveMinutesMs) {
    await OTP.deleteOne({ phone });
    throw new AppError('OTP expired after 5 minutes. Please request a new verification code.', 400, 'OTP_EXPIRED');
  }

  // Validate OTP code
  if (otpRecord.otp !== otp) {
    otpRecord.attempts = (otpRecord.attempts || 0) + 1;
    if (otpRecord.attempts >= 5) {
      otpRecord.lockedUntil = new Date(Date.now() + 15 * 60 * 1000); // 15-minute lockout
      await otpRecord.save();
      throw new AppError('Account locked for 15 minutes due to 5 consecutive failed attempts.', 429, 'OTP_LOCKED');
    }
    await otpRecord.save();
    const remainingAttempts = 5 - otpRecord.attempts;
    throw new AppError(`Invalid OTP. ${remainingAttempts} attempt${remainingAttempts === 1 ? '' : 's'} remaining before 15-minute lockout.`, 400, 'INVALID_OTP');
  }

  // OTP valid — find patient
  const patient = await Patient.findOne({ phone, isActive: true });
  if (!patient) throw new AppError('Patient not found', 404, 'PATIENT_NOT_FOUND');

  // Cleanup OTP record on successful verification
  await OTP.deleteOne({ phone });

  const token = jwt.sign(
    { id: patient._id, role: 'Patient', type: 'patient', fullName: patient.name },
    env.JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.cookie('token', token, COOKIE_OPTIONS);
  res.json({
    success: true,
    data: {
      patient: patient.toJSON(),
      token,
    },
  });
});

// --- Logout ---
router.post('/logout', (_req, res: Response) => {
  res.clearCookie('token', { path: '/' });
  res.json({ success: true, message: 'Logged out' });
});

// --- Get current user/patient ---
router.get('/me', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { Hospital } = await import('../models/Hospital');
    if (req.user?.type === 'staff') {
      const user = await User.findById(req.user.id);
      if (!user) throw new AppError('User not found', 404, 'NOT_FOUND');
      let hospital = null;
      if (user.hospitalId) {
        hospital = await Hospital.findById(user.hospitalId).catch(() => null);
      }
      if (!hospital) {
        hospital = await Hospital.findOne({ status: 'Active' }).catch(() => null);
      }
      res.json({ success: true, data: { user: user.toJSON(), hospital, type: 'staff' } });
    } else {
      const patient = await Patient.findById(req.user?.id);
      if (!patient) throw new AppError('Patient not found', 404, 'NOT_FOUND');
      let hospital = null;
      if (patient.hospitalId) {
        hospital = await Hospital.findById(patient.hospitalId).catch(() => null);
      }
      if (!hospital) {
        hospital = await Hospital.findOne({ status: 'Active' }).catch(() => null);
      }
      res.json({ success: true, data: { patient: patient.toJSON(), hospital, type: 'patient' } });
    }
  } catch (err: any) {
    if (err instanceof AppError) throw err;
    console.error('Error in /api/auth/me:', err?.message || err);
    throw new AppError(
      'Database connection temporarily unavailable. Please retry.',
      503,
      'DB_UNAVAILABLE'
    );
  }
});

export default router;
