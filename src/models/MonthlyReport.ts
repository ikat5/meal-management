import mongoose, { Schema, Model, Types } from "mongoose";

/**
 * MONTHLY REPORT (the frozen end-of-month ledger)
 * ────────────────────────────────────────────────
 * Why store it at all, when it can be computed from Expenses + Deposits +
 * Cancellations? Because bills must be STABLE: once everyone settles up,
 * a late-edited expense shouldn't silently change last month's numbers.
 * Generating a report snapshots the math at that moment.
 *
 * rows[i].balance:
 *   > 0 → the group owes this user money (they deposited more than they ate)
 *   < 0 → this user owes the group money
 */
export interface IReportRow {
  user: Types.ObjectId;
  mealsConsumed: number; // lunch + dinner count for the month
  mealCost: number; //      mealsConsumed × perMealRate
  deposits: number; //      Σ their deposits this month
  balance: number; //       deposits − mealCost
}

export interface IMonthlyReport {
  _id: Types.ObjectId;
  group: Types.ObjectId;
  month: string; // "YYYY-MM"
  totalCost: number; //     Σ all expenses
  totalMeals: number; //    Σ all members' meals
  perMealRate: number; //   totalCost / totalMeals
  rows: IReportRow[];
  generatedBy: Types.ObjectId; // which admin clicked "generate"
  createdAt: Date;
  updatedAt: Date;
}

const MonthlyReportSchema = new Schema<IMonthlyReport>(
  {
    group: { type: Schema.Types.ObjectId, ref: "Group", required: true },
    month: { type: String, required: true, match: /^\d{4}-\d{2}$/ },
    totalCost: { type: Number, required: true, min: 0 },
    totalMeals: { type: Number, required: true, min: 0 },
    perMealRate: { type: Number, required: true, min: 0 },
    rows: [
      {
        user: { type: Schema.Types.ObjectId, ref: "User", required: true },
        mealsConsumed: { type: Number, required: true, min: 0 },
        mealCost: { type: Number, required: true, min: 0 },
        deposits: { type: Number, required: true, min: 0 },
        balance: { type: Number, required: true }, // may be negative!
      },
    ],
    generatedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

// One report per group per month (regenerating replaces it via upsert)
MonthlyReportSchema.index({ group: 1, month: 1 }, { unique: true });

const MonthlyReport: Model<IMonthlyReport> =
  mongoose.models.MonthlyReport ||
  mongoose.model<IMonthlyReport>("MonthlyReport", MonthlyReportSchema);

export default MonthlyReport;
