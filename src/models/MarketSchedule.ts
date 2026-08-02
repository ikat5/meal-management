import mongoose, { Schema, Model, Types } from "mongoose";

/**
 * MARKET SCHEDULE (bazar duty roster)
 * ────────────────────────────────────
 * ONE document per group per month. `assignments` holds exactly one entry
 * per calendar day: { date: "2026-08-01", user: <id> }.
 *
 * Why `date` is a "YYYY-MM-DD" STRING and not a Date object:
 * a Date is a precise instant in UTC, so "Aug 1 midnight in Dhaka" stored
 * as a Date can read back as "Jul 31" in another timezone. A plain string
 * has no timezone, sorts correctly alphabetically, and matches how humans
 * think about a duty day. We use this convention in every schema below.
 *
 * Swapping dates = just exchanging the two `user` values inside this
 * document (done atomically when a SwapRequest is accepted).
 */
export interface IAssignment {
  date: string; // "YYYY-MM-DD"
  user: Types.ObjectId;
}

export interface IMarketSchedule {
  _id: Types.ObjectId;
  group: Types.ObjectId;
  month: string; // "YYYY-MM"
  assignments: IAssignment[];
  createdAt: Date;
  updatedAt: Date;
}

const MarketScheduleSchema = new Schema<IMarketSchedule>(
  {
    group: { type: Schema.Types.ObjectId, ref: "Group", required: true },
    month: {
      type: String,
      required: true,
      match: /^\d{4}-\d{2}$/, // enforce the "YYYY-MM" shape at the DB layer
    },
    assignments: [
      {
        date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
        user: { type: Schema.Types.ObjectId, ref: "User", required: true },
      },
    ],
  },
  { timestamps: true }
);

// One schedule per group per month — a duplicate insert fails at the DB
// level even if two admins click "Generate" at the same moment.
MarketScheduleSchema.index({ group: 1, month: 1 }, { unique: true });

const MarketSchedule: Model<IMarketSchedule> =
  mongoose.models.MarketSchedule ||
  mongoose.model<IMarketSchedule>("MarketSchedule", MarketScheduleSchema);

export default MarketSchedule;
