import mongoose, { Schema, Document, Types } from 'mongoose';

export interface ICaptureSession extends Document {
  token: string;
  doctorId: Types.ObjectId;
  patientId: Types.ObjectId;
  visitId: Types.ObjectId;
  expiresAt: Date;
  status: 'active' | 'completed' | 'expired';
  isPasswordVerified: boolean;
  createdAt: Date;
}

const captureSessionSchema = new Schema<ICaptureSession>(
  {
    token: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    doctorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    patientId: {
      type: Schema.Types.ObjectId,
      ref: 'Patient',
      required: true,
    },
    visitId: {
      type: Schema.Types.ObjectId,
      ref: 'Visit',
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: '15m' }, // Mongo TTL auto-cleanup after expiry
    },
    status: {
      type: String,
      enum: ['active', 'completed', 'expired'],
      default: 'active',
    },
    isPasswordVerified: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

export const CaptureSession = mongoose.model<ICaptureSession>('CaptureSession', captureSessionSchema);
