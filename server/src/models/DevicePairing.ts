import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IDevicePairing extends Document {
  token: string;
  doctorId: Types.ObjectId;
  deviceName: string;
  isCustomName?: boolean;
  isPasswordVerified: boolean;
  deviceSecretHash?: string;
  claimedAt?: Date;
  expiresAt: Date;
  status: 'active' | 'revoked';
  lastActiveAt: Date;
  createdAt: Date;
}

const devicePairingSchema = new Schema<IDevicePairing>(
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
      index: true,
    },
    deviceName: {
      type: String,
      default: 'Pending Mobile Connection',
    },
    isCustomName: {
      type: Boolean,
      default: false,
    },
    isPasswordVerified: {
      type: Boolean,
      default: false,
    },
    deviceSecretHash: {
      type: String,
      default: null,
    },
    claimedAt: {
      type: Date,
      default: null,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 }, // Mongo TTL auto-cleanup after expiry
    },
    status: {
      type: String,
      enum: ['active', 'revoked'],
      default: 'active',
    },
    lastActiveAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

export const DevicePairing = mongoose.model<IDevicePairing>('DevicePairing', devicePairingSchema);
