import mongoose, { Schema, Model, Types } from "mongoose";

/**
 * GROUP (a "Meal System Group" / mess)
 * ─────────────────────────────────────
 * Membership is stored in TWO places, always updated together:
 *   1. Group.members[]  → fast "who is in this group?" queries
 *   2. User.groupId     → fast "which group am I in?" + the one-group rule
 *
 * `members[].joinedAt` matters for billing: someone who joins on the 15th
 * is only charged meals from the 15th onward.
 *
 * `inviteCode` is a short random string (e.g. "X7KP2Q") shared out-of-band
 * so friends can join.
 */
export interface IGroupMember {
  user: Types.ObjectId;
  joinedAt: Date;
}

/**
 * MEAL SYSTEM STATE (per group, per month)
 * ─────────────────────────────────────────
 *   status ACTIVE  → normal operation
 *   status FROZEN  → the admin stopped the month: meal changes are rejected
 *                    and the live report counts meals only up to `frozenAt`.
 *
 * `cycleStart` marks where the CURRENT billing cycle begins. Normally the
 * 1st of the month; after an admin "hard reset" it becomes the reset day,
 * so meals/expenses before it are excluded from the ledger.
 *
 * `month` records which month this state belongs to. When a request arrives
 * in a NEWER month, the state auto-resets (unfreeze + cycleStart = the 1st)
 * — that is the automatic month rollover, no cron strictly required.
 */
export type MealSystemStatus = "ACTIVE" | "FROZEN";

export interface IMealSystem {
  status: MealSystemStatus;
  month: string; // "YYYY-MM" the state applies to
  cycleStart: string; // "YYYY-MM-DD" — billing starts here
  frozenAt: string | null; // "YYYY-MM-DD" — last counted day when FROZEN
}

export interface IGroup {
  _id: Types.ObjectId;
  name: string;
  admin: Types.ObjectId; // the creator; transferred if they leave
  inviteCode: string;
  members: IGroupMember[];
  mealSystem: IMealSystem;
  createdAt: Date;
  updatedAt: Date;
}

const GroupSchema = new Schema<IGroup>(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    admin: { type: Schema.Types.ObjectId, ref: "User", required: true },
    inviteCode: { type: String, required: true, unique: true },
    members: [
      {
        user: { type: Schema.Types.ObjectId, ref: "User", required: true },
        joinedAt: { type: Date, default: Date.now },
      },
    ],
    mealSystem: {
      status: { type: String, enum: ["ACTIVE", "FROZEN"], default: "ACTIVE" },
      month: { type: String, default: "" }, // set on first touch by ensureCurrentCycle()
      cycleStart: { type: String, default: "" },
      frozenAt: { type: String, default: null },
    },
  },
  { timestamps: true }
);

const Group: Model<IGroup> =
  mongoose.models.Group || mongoose.model<IGroup>("Group", GroupSchema);

export default Group;
