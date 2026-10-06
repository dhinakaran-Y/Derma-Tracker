import mongoose, { Schema, Document } from 'mongoose';

export interface IWhatsAppSession extends Document {
  sessionId: string;
  data: string;
}

const whatsAppSessionSchema = new Schema<IWhatsAppSession>(
  {
    sessionId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    data: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
    collection: 'whatsapp_sessions',
  }
);

export const WhatsAppSession = mongoose.model<IWhatsAppSession>('WhatsAppSession', whatsAppSessionSchema);
