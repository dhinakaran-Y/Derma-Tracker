import mongoose, { Schema, Document } from 'mongoose';

export interface IHospital extends Document {
  name: string; // Full official name, e.g. "Maga Health Care Trichology & Scalp Hospital"
  shortName: string; // Short display name, e.g. "Maga Health Care"
  type: 'BigHospital' | 'Hospital' | 'Clinic';
  email: string; // Admin / contact email, unique
  websiteUrl?: string; // Optional website link
  logoUrl?: string; // Uploaded logo image URL/path
  imageUrl?: string; // Optional facility photo URL/path
  phone?: string;
  address?: string;
  gstNumber?: string;
  registrationFee?: number; // One-time patient registration & history book log fee
  status: 'Active' | 'PendingApproval' | 'Suspended';
  createdAt: Date;
  updatedAt: Date;
}

const HospitalSchema = new Schema<IHospital>(
  {
    name: { type: String, required: true, unique: true, trim: true },
    shortName: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ['BigHospital', 'Hospital', 'Clinic'],
      default: 'Clinic',
      required: true,
    },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    websiteUrl: { type: String, trim: true },
    logoUrl: { type: String },
    imageUrl: { type: String },
    phone: { type: String, trim: true },
    address: { type: String, trim: true },
    gstNumber: { type: String, trim: true },
    registrationFee: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ['Active', 'PendingApproval', 'Suspended'],
      default: 'Active',
    },
  },
  { timestamps: true }
);

export const Hospital = mongoose.model<IHospital>('Hospital', HospitalSchema);
