import mongoose, { Schema, Document } from 'mongoose';

export interface IGstRule {
  _id?: string;
  itemType: string;
  gstRate: number;
  updatedAt: Date;
}

export interface IPharmacyPaymentConfig {
  staticQrEnabled: boolean;
  staticQrVpa: string;          // UPI VPA e.g. "clinic@upi"
  staticQrDisplayName: string;  // shown on QR screen e.g. "DermaTrack Clinic"
  dynamicQrEnabled: boolean;
}

export interface IClinicSettings extends Document<string> {
  _id: string;
  clinicName: string;
  address?: string;
  phone?: string;
  email?: string;
  gstNumber?: string;
  registrationFee: number; // One-time patient registration & history book log fee
  gstRules: IGstRule[];
  workingHours?: { start: string; end: string };
  appointmentDuration: number; // minutes
  pharmacyPayment: IPharmacyPaymentConfig;
  createdAt: Date;
  updatedAt: Date;
}

const GstRuleSchema = new Schema<IGstRule>(
  {
    itemType: { type: String, required: true },
    gstRate: { type: Number, required: true, min: 0 },
    updatedAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const ClinicSettingsSchema = new Schema<IClinicSettings>(
  {
    _id: { type: String, default: 'clinic_settings' },
    clinicName: { type: String, required: true, default: 'DermaTrack Clinic' },
    address: { type: String },
    phone: { type: String },
    email: { type: String },
    gstNumber: { type: String },
    registrationFee: { type: Number, default: 0 },
    gstRules: {
      type: [GstRuleSchema],
      default: [
        { itemType: 'Consultation', gstRate: 18, updatedAt: new Date() },
        { itemType: 'Procedure', gstRate: 18, updatedAt: new Date() },
        { itemType: 'Medicine', gstRate: 5, updatedAt: new Date() },
        { itemType: 'Lab Test', gstRate: 12, updatedAt: new Date() },
      ],
    },
    workingHours: {
      start: { type: String, default: '09:00' },
      end: { type: String, default: '18:00' },
    },
    appointmentDuration: { type: Number, default: 30 },
    pharmacyPayment: {
      staticQrEnabled:     { type: Boolean, default: false },
      staticQrVpa:         { type: String,  default: '' },
      staticQrDisplayName: { type: String,  default: 'DermaTrack Clinic' },
      dynamicQrEnabled:    { type: Boolean, default: false },
    },
  },
  { timestamps: true }
);

// Singleton pattern: use a fixed _id
const SINGLETON_ID = 'clinic_settings';

export async function getClinicSettings(): Promise<IClinicSettings> {
  let settings = await ClinicSettings.findById(SINGLETON_ID);
  if (!settings) {
    settings = await ClinicSettings.create({ _id: SINGLETON_ID });
  }
  return settings;
}

export const ClinicSettings = mongoose.model<IClinicSettings>('ClinicSettings', ClinicSettingsSchema);
