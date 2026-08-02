import mongoose, { Schema, Model, Types } from "mongoose";

/**
 * MEAL CANCELLATION
 * ──────────────────
 * KEY DESIGN DECISION: we don't store a row for every meal everyone eats
 * (30 days × 2 meals × N users = thousands of rows/month). Instead:
 *
 *   "Everyone eats 2 meals a day UNLESS a cancellation row exists."
 *
 * So meals consumed = daysInMonth × 2 − (cancelled slots).
 *   type FULL   → 2 slots cancelled that day
 *   type LUNCH  → 1 slot
 *   type DINNER → 1 slot
 *
 * The CUTOFF RULE ("must cancel by the previous day") is business logic,
 * not schema logic — it lives in `src/lib/meals.ts` and runs in the API
 * route BEFORE this document is ever created.
 */
export type CancellationType = "FULL" | "LUNCH" | "DINNER";

export interface IMealCancellation {
  _id: Types.ObjectId;
  group: Types.ObjectId;
  user: Types.ObjectId;
  date: string; // "YYYY-MM-DD" — the day being cancelled
  type: CancellationType;
  createdAt: Date;
  updatedAt: Date;
}

const MealCancellationSchema = new Schema<IMealCancellation>(
  {
    group: { type: Schema.Types.ObjectId, ref: "Group", required: true },
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    type: { type: String, enum: ["FULL", "LUNCH", "DINNER"], required: true },
  },
  { timestamps: true }
);

// One cancellation row per user per day. To change LUNCH → FULL the API
// updates the existing row instead of inserting a second one.
MealCancellationSchema.index({ user: 1, date: 1 }, { unique: true });
// Monthly report: "all cancellations for this group in this date range"
MealCancellationSchema.index({ group: 1, date: 1 });

const MealCancellation: Model<IMealCancellation> =
  mongoose.models.MealCancellation ||
  mongoose.model<IMealCancellation>("MealCancellation", MealCancellationSchema);

export default MealCancellation;
