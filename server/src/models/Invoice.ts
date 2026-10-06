import mongoose, { Schema, Document, Types } from 'mongoose';

export type PaymentMode = 'Cash' | 'UPI' | 'Card' | 'BankTransfer' | 'Razorpay';
export type InvoiceStatus = 'Unpaid' | 'Partially Paid' | 'Paid';

export interface IInvoiceLineItem {
  itemType: 'Consultation' | 'Procedure' | 'Medicine' | 'Lab Test';
  description: string;
  quantity: number;
  unitPrice: number;
  gstRate: number;
  gstAmount: number;
  total: number;
}

export interface IPayment {
  amount: number;
  mode: PaymentMode;
  reference?: string;
  paidAt: Date;
  recordedBy: Types.ObjectId;
}

export interface IInvoice extends Document {
  hospitalId?: Types.ObjectId;
  invoiceNumber: string;
  patientId: Types.ObjectId;
  visitId?: Types.ObjectId;
  lineItems: IInvoiceLineItem[];
  subtotal: number;
  totalGst: number;
  grandTotal: number;
  payments: IPayment[];
  amountPaid: number;
  status: InvoiceStatus;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const LineItemSchema = new Schema<IInvoiceLineItem>(
  {
    itemType: { type: String, enum: ['Consultation', 'Procedure', 'Medicine', 'Lab Test'], required: true },
    description: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    gstRate: { type: Number, required: true, default: 0 },
    gstAmount: { type: Number, required: true, default: 0 },
    total: { type: Number, required: true },
  },
  { _id: false }
);

const PaymentSchema = new Schema<IPayment>(
  {
    amount: { type: Number, required: true, min: 0 },
    mode: { type: String, enum: ['Cash', 'UPI', 'Card', 'BankTransfer', 'Razorpay'], required: true },
    reference: { type: String },
    paidAt: { type: Date, default: Date.now },
    recordedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { _id: true }
);

const InvoiceSchema = new Schema<IInvoice>(
  {
    hospitalId: { type: Schema.Types.ObjectId, ref: 'Hospital', index: true },
    invoiceNumber: { type: String, required: true, unique: true },
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
    visitId: { type: Schema.Types.ObjectId, ref: 'Visit' },
    lineItems: [LineItemSchema],
    subtotal: { type: Number, required: true, default: 0 },
    totalGst: { type: Number, required: true, default: 0 },
    grandTotal: { type: Number, required: true, default: 0 },
    payments: [PaymentSchema],
    amountPaid: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ['Unpaid', 'Partially Paid', 'Paid'],
      default: 'Unpaid',
    },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

InvoiceSchema.index({ patientId: 1, createdAt: -1 });

export const Invoice = mongoose.model<IInvoice>('Invoice', InvoiceSchema);
