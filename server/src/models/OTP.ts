import mongoose, { Schema, Document } from 'mongoose';

export interface IOTP extends Document {
  phone: string;
  otp: string;
  channel: 'sms' | 'whatsapp';
  attempts: number;
  requestCount: number;
  firstRequestedAt?: Date;
  lockedUntil?: Date;
  createdAt: Date;
}

const OTPSchema = new Schema<IOTP>({
  phone: { type: String, required: true, unique: true },
  otp: { type: String, required: true },
  channel: { type: String, enum: ['sms', 'whatsapp'], default: 'sms' },
  attempts: { type: Number, default: 0 },
  requestCount: { type: Number, default: 1 },
  firstRequestedAt: { type: Date, default: Date.now },
  lockedUntil: { type: Date },
  createdAt: { type: Date, default: Date.now, expires: 1200 }, // 20-minute document retention for lockouts
});

export const OTP = mongoose.model<IOTP>('OTP', OTPSchema);
