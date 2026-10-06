import mongoose, { Schema, Document } from 'mongoose';

export interface IPatient extends Document {
  patientId: string; // e.g. PAT-9F21A6
  name: string;
  phone: string;
  email?: string;
  location?: string;
  age?: number;
  dateOfBirth?: Date;
  gender?: 'Male' | 'Female' | 'Other';
  bloodGroup?: 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-' | 'Unknown';
  maritalStatus?: 'Single' | 'Married' | 'Divorced' | 'Widowed';
  heightCm?: number;
  allergies?: string[];             // e.g. ['Penicillin', 'Sulfa drugs']
  medicalHistoryNotes?: string;     // free-text: diabetes, thyroid, PCOS, etc.
  hospitalId?: mongoose.Types.ObjectId;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const PatientSchema = new Schema<IPatient>(
  {
    patientId: { type: String, required: true, unique: true },
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, unique: true, index: true },
    email: { type: String, trim: true, lowercase: true },
    location: { type: String, trim: true },
    age: { type: Number, min: 0, max: 130 },
    dateOfBirth: { type: Date },
    gender: { type: String, enum: ['Male', 'Female', 'Other'] },
    maritalStatus: { type: String, enum: ['Single', 'Married', 'Divorced', 'Widowed'] },
    heightCm: { type: Number, min: 20, max: 300 },
    bloodGroup: {
      type: String,
      enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Unknown'],
    },
    allergies: [{ type: String, trim: true }],
    medicalHistoryNotes: { type: String, trim: true },
    hospitalId: { type: Schema.Types.ObjectId, ref: 'Hospital', index: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const Patient = mongoose.model<IPatient>('Patient', PatientSchema);
