import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IAuditLog extends Document {
  hospitalId?: Types.ObjectId;
  userId?: Types.ObjectId;
  userRole?: string;
  actorName?: string;
  action: string;
  resource: string;
  resourceId?: string;
  description?: string;
  details?: Record<string, any>;
  ipAddress?: string;
  createdAt: Date;
}

const AuditLogSchema = new Schema<IAuditLog>(
  {
    hospitalId: { type: Schema.Types.ObjectId, ref: 'Hospital', index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
    userRole: { type: String },
    actorName: { type: String },
    action: { type: String, required: true },
    resource: { type: String, required: true },
    resourceId: { type: String },
    description: { type: String },
    details: { type: Schema.Types.Mixed },
    ipAddress: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// Auto-cleanup: remove logs older than 1 year
AuditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 365 * 24 * 60 * 60 });
AuditLogSchema.index({ action: 1, createdAt: -1 });

export const AuditLog = mongoose.model<IAuditLog>('AuditLog', AuditLogSchema);
