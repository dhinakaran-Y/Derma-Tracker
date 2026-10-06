import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IPrescriptionItem {
  medicineId: Types.ObjectId;
  medicineName: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions?: string;
  quantity: number;
  isDispensed: boolean;
  dispensedBy?: Types.ObjectId;
  dispensedAt?: Date;
}

export interface IProcedure {
  name: string;
  notes?: string;
  fee: number;
}

export interface ILabTestItem {
  testName: string;
  notes?: string;
  fee?: number;
  status?: 'Ordered' | 'Sample Collected' | 'Report Ready' | 'Reviewed';
}

export interface IScalpHealth {
  dandruff?: 'None' | 'Mild' | 'Moderate' | 'Severe';
  erythema?: 'Absent' | 'Perifollicular' | 'Diffuse';
  pullTest?: 'Negative (<6 hairs)' | 'Positive (≥6 hairs)';
  sebum?: 'Dry' | 'Normal' | 'Oily';
}

export interface IVisit extends Document {
  hospitalId?: Types.ObjectId;
  patientId: Types.ObjectId;
  doctorId: Types.ObjectId;
  visitDate: Date;
  visitType: 'FirstVisit' | 'FollowUp';
  queueNumber?: number;
  status: 'Waiting' | 'InProgress' | 'Completed' | 'Cancelled';
  chiefComplaint?: string;
  diagnosis?: string;
  clinicalNotes?: string;
  hairDensity?: number;
  alopeciaStage?: string;
  dlqiScore?: number;
  scalpHealth?: IScalpHealth;
  followUpWeeks?: number;
  scalpImages: string[];
  prescriptions: IPrescriptionItem[];
  procedures: IProcedure[];
  labTests?: ILabTestItem[];
  weightKg?: number;
  heightCm?: number;
  consultFee: number;
  registrationFee?: number;
  feeStatus?: 'Pending' | 'Paid';
  consultationWorkflow?: 'fully_app' | 'prescription_booklet';
  bookletDispensed?: boolean;
  visitCount?: number;
  createdAt: Date;
  updatedAt: Date;
}

const PrescriptionItemSchema = new Schema<IPrescriptionItem>(
  {
    medicineId: { type: Schema.Types.ObjectId, ref: 'Medicine', required: true },
    medicineName: { type: String, required: true },
    dosage: { type: String, required: true },
    frequency: { type: String, required: true },
    duration: { type: String, required: true },
    instructions: { type: String },
    quantity: { type: Number, required: true, min: 1 },
    isDispensed: { type: Boolean, default: false },
    dispensedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    dispensedAt: { type: Date },
  },
  { _id: true }
);

const ProcedureSchema = new Schema<IProcedure>(
  {
    name: { type: String, required: true },
    notes: { type: String },
    fee: { type: Number, required: true, default: 0 },
  },
  { _id: true }
);

const LabTestItemSchema = new Schema<ILabTestItem>(
  {
    testName: { type: String, required: true },
    notes: { type: String },
    fee: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ['Ordered', 'Sample Collected', 'Report Ready', 'Reviewed'],
      default: 'Ordered',
    },
  },
  { _id: true }
);

const VisitSchema = new Schema<IVisit>(
  {
    hospitalId: { type: Schema.Types.ObjectId, ref: 'Hospital', index: true },
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
    doctorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    visitDate: { type: Date, required: true, default: Date.now },
    visitType: { type: String, enum: ['FirstVisit', 'FollowUp'], required: true },
    queueNumber: { type: Number },
    status: {
      type: String,
      enum: ['Waiting', 'InProgress', 'Completed', 'Cancelled'],
      default: 'Waiting',
    },
    chiefComplaint: { type: String },
    diagnosis: { type: String },
    clinicalNotes: { type: String },
    hairDensity: { type: Number, min: 0, max: 100 },
    alopeciaStage: { type: String },
    dlqiScore: { type: Number, min: 0, max: 30 },
    scalpHealth: {
      dandruff: { type: String },
      erythema: { type: String },
      pullTest: { type: String },
      sebum: { type: String },
    },
    followUpWeeks: { type: Number },
    weightKg: { type: Number, min: 1, max: 500 },
    heightCm: { type: Number, min: 20, max: 300 },
    scalpImages: [{ type: String }],
    prescriptions: [PrescriptionItemSchema],
    procedures: [ProcedureSchema],
    labTests: [LabTestItemSchema],
    consultFee: { type: Number, required: true, default: 0 },
    registrationFee: { type: Number, default: 0 },
    feeStatus: { type: String, enum: ['Pending', 'Paid'], default: 'Pending' },
    consultationWorkflow: {
      type: String,
      enum: ['fully_app', 'prescription_booklet'],
      default: 'fully_app',
    },
    bookletDispensed: { type: Boolean, default: false },
  },
  { timestamps: true }
);

VisitSchema.index({ patientId: 1, visitDate: -1 });
VisitSchema.index({ doctorId: 1, visitDate: -1 });

export const Visit = mongoose.model<IVisit>('Visit', VisitSchema);
