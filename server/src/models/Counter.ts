import mongoose, { Schema, Document } from 'mongoose';

export interface ICounter extends Document {
  name: string;
  seq: number;
  financialYear?: string;
}

const CounterSchema = new Schema<ICounter>({
  name: { type: String, required: true },
  seq: { type: Number, default: 0 },
  financialYear: { type: String },
});

CounterSchema.index({ name: 1, financialYear: 1 }, { unique: true });

export const Counter = mongoose.model<ICounter>('Counter', CounterSchema);

/** Atomically increment and return the next sequence number */
export async function getNextSequence(name: string, financialYear?: string): Promise<number> {
  const filter: any = { name };
  if (financialYear) filter.financialYear = financialYear;

  const counter = await Counter.findOneAndUpdate(
    filter,
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return counter.seq;
}
