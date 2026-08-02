import mongoose, { Schema, Model, Types } from "mongoose";

/**
 * DEPOSIT (contribution to the group fund)
 * ─────────────────────────────────────────
 * Simple ledger entries. The monthly report sums these per user to compute
 * `balance = deposits − mealCost`.
 */
export interface IDeposit {
  _id: Types.ObjectId;
  group: Types.ObjectId;
  user: Types.ObjectId;
  amount: number;
  date: string; // "YYYY-MM-DD"
  note?: string;
  createdAt: Date;
  updatedAt: Date;
}

const DepositSchema = new Schema<IDeposit>(
  {
    group: { type: Schema.Types.ObjectId, ref: "Group", required: true },
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    amount: { type: Number, required: true, min: 0.01 },
    date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    note: { type: String, trim: true, maxlength: 200 },
  },
  { timestamps: true }
);

DepositSchema.index({ group: 1, date: 1 });

const Deposit: Model<IDeposit> =
  mongoose.models.Deposit || mongoose.model<IDeposit>("Deposit", DepositSchema);

export default Deposit;
