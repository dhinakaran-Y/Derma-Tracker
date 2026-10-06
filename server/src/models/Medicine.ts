import mongoose, { Schema, Document } from 'mongoose';

export type MedicineCategory =
  | 'Serum'
  | 'Tablet'
  | 'Capsule'
  | 'Shampoo'
  | 'Lotion'
  | 'Oil'
  | 'Ointment'
  | 'Solution';

export interface IBatch {
  batchNumber: string;
  quantity: number;
  expiryDate: Date;
  purchasePrice: number;
  addedAt: Date;
}

export interface IMedicine extends Document {
  hospitalId?: mongoose.Types.ObjectId;
  name: string;
  genericName?: string;
  description?: string;
  category: MedicineCategory;
  manufacturer?: string;
  imageUrl?: string;
  sellingPrice: number;
  costPrice: number;
  reorderLevel: number;
  unit: string;
  batches: IBatch[];
  isActive: boolean;
  totalStock: number; // virtual
  createdAt: Date;
  updatedAt: Date;
}

const BatchSchema = new Schema<IBatch>(
  {
    batchNumber: { type: String, required: true },
    quantity: { type: Number, required: true, min: 0 },
    expiryDate: { type: Date, required: true },
    purchasePrice: { type: Number, required: true, min: 0 },
    addedAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const MedicineSchema = new Schema<IMedicine>(
  {
    hospitalId: { type: Schema.Types.ObjectId, ref: 'Hospital', index: true },
    name: { type: String, required: true, trim: true },
    genericName: { type: String, trim: true },
    description: { type: String, trim: true },
    category: {
      type: String,
      required: true,
      enum: ['Serum', 'Tablet', 'Capsule', 'Shampoo', 'Lotion', 'Oil', 'Ointment', 'Solution'],
    },
    manufacturer: { type: String, trim: true },
    imageUrl: { type: String, trim: true },
    sellingPrice: { type: Number, required: true, min: 0 },
    costPrice: { type: Number, required: true, min: 0 },
    reorderLevel: { type: Number, default: 10 },
    unit: { type: String, required: true, default: 'pcs' },
    batches: [BatchSchema],
    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual: compute totalStock from batches sum (issue #11 fix)
MedicineSchema.virtual('totalStock').get(function (this: IMedicine) {
  return this.batches.reduce((sum, b) => sum + b.quantity, 0);
});

MedicineSchema.index({ name: 'text', genericName: 'text' });

export const Medicine = mongoose.model<IMedicine>('Medicine', MedicineSchema);
