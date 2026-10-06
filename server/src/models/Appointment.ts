import mongoose, { Schema, Document, Types } from 'mongoose';

export type AppointmentStatus = 'Scheduled' | 'Waiting' | 'InProgress' | 'Completed' | 'Cancelled' | 'NoShow' | 'Postponed';
export type AppointmentMode = 'Offline' | 'Online';
export type AppointmentType = 'Consult' | 'Surgery';

export interface IAppointment extends Document {
  hospitalId?: Types.ObjectId;
  patientId: Types.ObjectId;
  doctorId: Types.ObjectId;
  scheduledAt: Date;
  endTime?: Date;
  mode: AppointmentMode;
  type: AppointmentType;
  status: AppointmentStatus;
  bookedBy: Types.ObjectId;
  bookedByRole: 'Staff' | 'Patient';
  notes?: string;
  cancellationReason?: string;
  rescheduleReason?: string;
  postponedReason?: string;
  postponedWithoutDate?: boolean;
  lastModifiedByRole?: 'Staff' | 'Patient' | 'Doctor';
  lastModifiedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const AppointmentSchema = new Schema<IAppointment>(
  {
    hospitalId: { type: Schema.Types.ObjectId, ref: 'Hospital', index: true },
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
    doctorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    scheduledAt: { type: Date, required: true },
    endTime: { type: Date },
    mode: { type: String, enum: ['Offline', 'Online'], required: true, default: 'Offline' },
    type: { type: String, enum: ['Consult', 'Surgery'], required: true, default: 'Consult' },
    status: {
      type: String,
      enum: ['Scheduled', 'Waiting', 'InProgress', 'Completed', 'Cancelled', 'NoShow', 'Postponed'],
      default: 'Scheduled',
    },
    bookedBy: { type: Schema.Types.ObjectId, required: true },
    bookedByRole: { type: String, enum: ['Staff', 'Patient'], required: true },
    notes: { type: String },
    cancellationReason: { type: String },
    rescheduleReason: { type: String },
    postponedReason: { type: String },
    postponedWithoutDate: { type: Boolean, default: false },
    lastModifiedByRole: { type: String, enum: ['Staff', 'Patient', 'Doctor'] },
    lastModifiedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

// Prevent double-booking: unique slot per doctor (exclude cancelled and postponed)
AppointmentSchema.index(
  { doctorId: 1, scheduledAt: 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $nin: ['Cancelled', 'NoShow', 'Postponed'] } },
  }
);

AppointmentSchema.index({ patientId: 1, scheduledAt: -1 });

export const Appointment = mongoose.model<IAppointment>('Appointment', AppointmentSchema);
