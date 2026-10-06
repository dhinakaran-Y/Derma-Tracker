import mongoose, { Schema, Document } from 'mongoose';
import bcrypt from 'bcryptjs';

export type UserRole = 'Admin' | 'Receptionist' | 'Doctor' | 'MedicationGiver' | 'StockManager';
export type UserStatus = 'Active' | 'Suspended' | 'Deactivated';

export interface IUser extends Document {
  username: string;
  passwordHash: string;
  fullName: string;
  email?: string;
  role: UserRole;
  status: UserStatus;
  hospitalId?: mongoose.Types.ObjectId;
  // Doctor-specific fields
  specialization?: string;
  consultFee?: number;
  firstVisitFee?: number;
  consultationWorkflow?: 'fully_app' | 'prescription_booklet';
  isAvailable?: boolean;
  isOnDuty?: boolean;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const UserSchema = new Schema<IUser>(
  {
    username: { type: String, required: true, unique: true, trim: true, lowercase: true },
    passwordHash: { type: String, required: true },
    fullName: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true },
    role: {
      type: String,
      required: true,
      enum: ['Admin', 'Receptionist', 'Doctor', 'MedicationGiver', 'StockManager'],
    },
    status: {
      type: String,
      enum: ['Active', 'Suspended', 'Deactivated'],
      default: 'Active',
    },
    hospitalId: { type: Schema.Types.ObjectId, ref: 'Hospital', index: true },
    // Doctor-specific
    specialization: { type: String },
    consultFee: { type: Number },
    firstVisitFee: { type: Number },
    consultationWorkflow: {
      type: String,
      enum: ['fully_app', 'prescription_booklet'],
      default: 'fully_app',
    },
    isAvailable: { type: Boolean, default: true },
    isOnDuty: { type: Boolean, default: true },
  },
  { timestamps: true }
);

UserSchema.pre('save', async function (next) {
  if (!this.isModified('passwordHash')) return next();
  this.passwordHash = await bcrypt.hash(this.passwordHash, 12);
  next();
});

UserSchema.methods.comparePassword = async function (candidatePassword: string): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.passwordHash);
};

// Don't return passwordHash in JSON
UserSchema.set('toJSON', {
  transform: (_doc, ret: any) => {
    delete ret.passwordHash;
    return ret;
  },
});

export const User = mongoose.model<IUser>('User', UserSchema);
