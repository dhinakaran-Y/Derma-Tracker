import rateLimit from 'express-rate-limit';

/** OTP send: max 3 per 10 minutes per IP */
export const otpLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 3,
  message: { success: false, error: 'Too many OTP requests. Maximum 3 requests allowed per 10 minutes.', code: 'RATE_LIMITED' },
  standardHeaders: true,
  legacyHeaders: false,
});

/** Staff login: max 10 per 15 minutes per IP */
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, error: 'Too many login attempts, try again later', code: 'RATE_LIMITED' },
  standardHeaders: true,
  legacyHeaders: false,
});

/** File uploads: max 30 per 10 minutes per IP */
export const uploadLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 30,
  message: { success: false, error: 'Too many uploads, try again later', code: 'RATE_LIMITED' },
  standardHeaders: true,
  legacyHeaders: false,
});

/** General API: max 200 per 1 minute per IP */
export const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
});
