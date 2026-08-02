import mongoose, { Schema, Model, Types } from "mongoose";

/**
 * MESSAGE (group chat)
 * ─────────────────────
 * Deliberately simple: text only, newest-first pagination.
 * The compound index (group + createdAt) makes "latest 50 messages for
 * this group" a single fast index scan.
 */
export interface IMessage {
  _id: Types.ObjectId;
  group: Types.ObjectId;
  sender: Types.ObjectId;
  text: string;
  createdAt: Date;
  updatedAt: Date;
}

const MessageSchema = new Schema<IMessage>(
  {
    group: { type: Schema.Types.ObjectId, ref: "Group", required: true },
    sender: { type: Schema.Types.ObjectId, ref: "User", required: true },
    text: { type: String, required: true, trim: true, maxlength: 1000 },
  },
  { timestamps: true }
);

MessageSchema.index({ group: 1, createdAt: -1 });

const Message: Model<IMessage> =
  mongoose.models.Message || mongoose.model<IMessage>("Message", MessageSchema);

export default Message;
