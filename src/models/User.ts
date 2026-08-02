import mongoose, { Schema, Model, Types } from "mongoose";

/**
 * USER
 * ─────
 * The `groupId` field is the heart of the "one group per user" rule:
 * - null  → the user is free to create or join a group
 * - set   → every create/join attempt is rejected until they leave
 *
 * `bazarPreference` = how many CONSECUTIVE market days this user prefers
 * (1, 2, 3 or 5). The scheduler reads this when distributing duties.
 * Default is 2 — the system assigns bazar days in blocks of 2 consecutive
 * days unless the user picks something else.
 */
export interface IUser {
  _id: Types.ObjectId;
  name: string;
  email: string;
  password: string; // bcrypt hash — never the plain password
  groupId: Types.ObjectId | null;
  bazarPreference: 1 | 2 | 3 | 5;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true, maxlength: 60 },
    email: {
      type: String,
      required: true,
      unique: true, // also creates a DB index → fast login lookups
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
      select: false, // excluded from queries by default — must opt in with .select("+password")
    },
    groupId: { type: Schema.Types.ObjectId, ref: "Group", default: null },
    bazarPreference: { type: Number, enum: [1, 2, 3, 5], default: 2 },
  },
  { timestamps: true }
);

// Next.js hot-reloads files in dev, which would try to compile the model
// twice and crash. This "reuse if it exists" pattern appears in every model.
const User: Model<IUser> =
  mongoose.models.User || mongoose.model<IUser>("User", UserSchema);

export default User;
