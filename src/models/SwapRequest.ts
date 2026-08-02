import mongoose, { Schema, Model, Types } from "mongoose";

/**
 * SWAP REQUEST (exchange two bazar dates)
 * ────────────────────────────────────────
 * Lifecycle:  pending → accepted | rejected | cancelled
 *
 * "requester gives up `requesterDate` and takes `targetDate`;
 *  requestedTo does the opposite."
 *
 * The actual schedule is only modified when the target ACCEPTS —
 * the request document itself is just an inbox item until then.
 */
export type SwapStatus = "pending" | "accepted" | "rejected" | "cancelled";

export interface ISwapRequest {
  _id: Types.ObjectId;
  group: Types.ObjectId;
  requester: Types.ObjectId;
  requestedTo: Types.ObjectId;
  requesterDate: string; // "YYYY-MM-DD" — currently assigned to requester
  targetDate: string; //    "YYYY-MM-DD" — currently assigned to requestedTo
  status: SwapStatus;
  createdAt: Date;
  updatedAt: Date;
}

const SwapRequestSchema = new Schema<ISwapRequest>(
  {
    group: { type: Schema.Types.ObjectId, ref: "Group", required: true },
    requester: { type: Schema.Types.ObjectId, ref: "User", required: true },
    requestedTo: { type: Schema.Types.ObjectId, ref: "User", required: true },
    requesterDate: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    targetDate: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    status: {
      type: String,
      enum: ["pending", "accepted", "rejected", "cancelled"],
      default: "pending",
    },
  },
  { timestamps: true }
);

// "Show me my pending requests" — both directions
SwapRequestSchema.index({ requestedTo: 1, status: 1 });
SwapRequestSchema.index({ requester: 1, status: 1 });

const SwapRequest: Model<ISwapRequest> =
  mongoose.models.SwapRequest ||
  mongoose.model<ISwapRequest>("SwapRequest", SwapRequestSchema);

export default SwapRequest;
