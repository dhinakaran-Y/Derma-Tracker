import mongoose, { Schema, Document, Types } from 'mongoose';

export type PharmacyPaymentMode = 'static_qr' | 'dynamic_qr';
export type PharmacyPaymentStatus = 'pending' | 'paid' | 'failed';

export interface IPharmacyPayment extends Document {
  hospitalId?: Types.ObjectId;
  visitId?: Types.ObjectId;
  patientName?: string;
  amount: number;
  mode: PharmacyPaymentMode;
  // Dynamic QR (Razorpay) fields
  razorpayOrderId?: string;
  razorpayPaymentId?: string;  // set after webhook confirms payment
  // Status & audit
  status: PharmacyPaymentStatus;
  notes?: string;
  recordedBy: Types.ObjectId;
  paidAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const PharmacyPaymentSchema = new Schema<IPharmacyPayment>(
  {
    hospitalId:        { type: Schema.Types.ObjectId, ref: 'Hospital', index: true },
    visitId:           { type: Schema.Types.ObjectId, ref: 'Visit' },
    patientName:       { type: String },
    amount:            { type: Number, required: true, min: 1 },
    mode:              { type: String, enum: ['static_qr', 'dynamic_qr'], required: true },
    razorpayOrderId:   { type: String, sparse: true, index: true },
    razorpayPaymentId: { type: String, sparse: true, unique: true },  // prevents double-payment
    status:            { type: String, enum: ['pending', 'paid', 'failed'], default: 'pending' },
    notes:             { type: String },
    recordedBy:        { type: Schema.Types.ObjectId, ref: 'User', required: true },
    paidAt:            { type: Date },
  },
  { timestamps: true }
);

// Index for history queries (newest first per hospital)
PharmacyPaymentSchema.index({ hospitalId: 1, createdAt: -1 });
PharmacyPaymentSchema.index({ status: 1, mode: 1 });

export const PharmacyPayment = mongoose.model<IPharmacyPayment>(
  'PharmacyPayment',
  PharmacyPaymentSchema
);
